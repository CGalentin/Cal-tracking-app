import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import sharp from "sharp";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const geminiApiKeySecret = defineSecret("GEMINI_API_KEY");

/** Max dimension (width or height) for resized image before sending to vision API. */
const MAX_IMAGE_DIMENSION = 1024;

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_VISION_PROMPT = `Look at this image of a meal or food.
1. List the foods you see in a short comma-separated list. Only list food items, nothing else. Example: chicken, rice, broccoli.
2. On the next line, estimate the total calories for the whole meal and write exactly: Estimated total calories: N
where N is a single number (e.g. 450 or 650). Base the estimate on typical portion sizes for the foods shown.`;

/**
 * Send image to Gemini vision API and get text description of foods.
 */
async function sendImageToVisionModel(imageBuffer: Buffer, apiKey: string): Promise<{ text: string } | null> {
  if (!apiKey) {
    logger.warn("sendImageToVisionModel: apiKey is empty");
    return null;
  }

  const base64Image = imageBuffer.toString("base64");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [
          { text: GEMINI_VISION_PROMPT },
          { inline_data: { mime_type: "image/jpeg", data: base64Image } },
        ],
      },
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    logger.warn("sendImageToVisionModel: Gemini API failed", { status: response.status, body: errText });
    return null;
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    promptFeedback?: { blockReason?: string };
  };
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    const reason = candidate?.finishReason ?? data.promptFeedback?.blockReason ?? "unknown";
    logger.warn("sendImageToVisionModel: no text in response", {
      finishReason: candidate?.finishReason,
      blockReason: data.promptFeedback?.blockReason,
      hasCandidates: (data.candidates?.length ?? 0) > 0,
      reason,
    });
    return null;
  }

  return { text };
}

/**
 * Parse vision response: first line = food list; look for "Estimated total calories: N".
 */
function parseVisionResponse(text: string): { foodList: string; foods: string[]; estimatedCalories: number | null } {
  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const foodList = lines[0] ?? "";
  const foods = foodList.split(",").map((s) => s.trim()).filter(Boolean);

  let estimatedCalories: number | null = null;
  const rest = lines.slice(1).join(" ");
  const match = rest.match(/estimated\s+total\s+calories:\s*(\d+)/i) ?? rest.match(/calories:\s*(\d+)/i);
  if (match) {
    const n = parseInt(match[1], 10);
    if (!Number.isNaN(n) && n > 0 && n < 10000) estimatedCalories = n;
  }

  return { foodList, foods, estimatedCalories };
}

/**
 * Download image from URL and resize to max 1024px on longest side (keeps aspect ratio).
 * Returns the resized image buffer and metadata, or null if download/resize failed.
 */
async function downloadAndResizeImage(imageUrl: string): Promise<{ buffer: Buffer; width: number; height: number } | null> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    logger.warn("downloadAndResizeImage: fetch failed", { status: response.status, imageUrl });
    return null;
  }
  const arrayBuffer = await response.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);

  const image = sharp(inputBuffer);
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  const resized = image.resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
    fit: "inside",
    withoutEnlargement: true,
  });
  const resizedBuffer = await resized.jpeg({ quality: 85 }).toBuffer();
  const resizedMeta = await sharp(resizedBuffer).metadata();

  logger.info("Image resized", {
    original: `${width}x${height}`,
    resized: `${resizedMeta.width ?? 0}x${resizedMeta.height ?? 0}`,
    sizeBytes: resizedBuffer.length,
  });

  return {
    buffer: resizedBuffer,
    width: resizedMeta.width ?? 0,
    height: resizedMeta.height ?? 0,
  };
}

/**
 * Test HTTP function for PR 9 — Cloud Functions Setup.
 * Hit the function URL to confirm deployment; check Firebase Console > Functions > Logs for the log line.
 */
export const testFunction = functions.https.onRequest((req: unknown, res: { send: (body: string) => void }) => {
  functions.logger.info("Cal-tracking-app: testFunction invoked — Cloud Functions are working.");
  res.send("Hello from Firebase! Cloud Functions are set up.");
});

/**
 * PR 10 — Image Recognition Pipeline: trigger when a user uploads an image.
 * Download & resize → send to Gemini vision → parse foods → create assistant message with description + confidence.
 */
export const onImageMessageCreated = onDocumentCreated(
  {
    document: "conversations/{conversationId}/messages/{messageId}",
    secrets: [geminiApiKeySecret],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot?.exists) {
      logger.warn("onImageMessageCreated: no snapshot");
      return;
    }

    const data = snapshot.data();
    const type = data?.type as string | undefined;
    const imageUrl = data?.imageUrl as string | undefined;

    if (type !== "image" || !imageUrl) {
      return;
    }

    const { conversationId } = event.params;
    logger.info("Image message created", { conversationId, messageId: event.params.messageId, imageUrl });

    const messagesRef = db.collection("conversations").doc(conversationId).collection("messages");

    let resized: { buffer: Buffer; width: number; height: number } | null = null;
    try {
      resized = await downloadAndResizeImage(imageUrl);
    } catch (err) {
      logger.error("downloadAndResizeImage failed", err);
    }

    if (!resized) {
      await messagesRef.add({
        role: "assistant",
        type: "text",
        text: "I couldn’t process that image. Please try another photo.",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    const apiKey = geminiApiKeySecret.value();
    let visionResult: { text: string } | null = null;
    try {
      visionResult = await sendImageToVisionModel(resized.buffer, apiKey);
    } catch (err) {
      logger.error("sendImageToVisionModel failed", err);
    }

    if (!visionResult) {
      await messagesRef.add({
        role: "assistant",
        type: "text",
        text: "I couldn’t analyze the image right now. Please try again.",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    const description = visionResult.text;
    const { foods: foodItems, estimatedCalories } = parseVisionResponse(description);
    const confidenceScore = 0.85;

    const messageParts: string[] = [];
    if (foodItems.length > 0) {
      messageParts.push(`I see: ${foodItems.join(", ")}.`);
      if (estimatedCalories != null) {
        messageParts.push(`Estimated calories for this meal: ${estimatedCalories}`);
      }
    } else {
      messageParts.push(description);
      if (estimatedCalories != null) {
        messageParts.push(`Estimated calories for this meal: ${estimatedCalories}`);
      }
    }

    logger.info("Vision result", {
      conversationId,
      description: description.slice(0, 100),
      foodCount: foodItems.length,
      estimatedCalories: estimatedCalories ?? undefined,
    });

    const visionMsgRef = await messagesRef.add({
      role: "assistant",
      type: "text",
      text: messageParts.join(" "),
      foodDescription: description,
      foodItems,
      confidenceScore,
      ...(estimatedCalories != null && { estimatedCalories }),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    const imageMessageId = event.params.messageId;
    await messagesRef.add({
      role: "assistant",
      type: "confirmation",
      text: "Does this description match your meal?",
      linkedVisionMessageId: visionMsgRef.id,
      linkedImageMessageId: imageMessageId,
      foodItems,
      ...(estimatedCalories != null && { estimatedCalories }),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
);

/**
 * Simple macro estimate from calories (placeholder: ~30% protein, 40% carbs, 30% fat by energy).
 */
function estimateMacrosFromCalories(cal: number): { protein: number; carbs: number; fat: number } {
  const protein = Math.round((cal * 0.3) / 4);
  const carbs = Math.round((cal * 0.4) / 4);
  const fat = Math.round((cal * 0.3) / 9);
  return { protein, carbs, fat };
}

/**
 * PR 12 — Meal Logging on Confirmation: when user sends "Yes", create meal doc and reply with summary.
 */
export const onMessageCreated = onDocumentCreated(
  { document: "conversations/{conversationId}/messages/{messageId}" },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot?.exists) return;

    const data = snapshot.data();
    const role = data?.role as string | undefined;
    const text = (data?.text as string | undefined)?.trim();
    if (role !== "user" || text !== "Yes") return;

    const { conversationId } = event.params;
    const messagesRef = db.collection("conversations").doc(conversationId).collection("messages");
    const newMsgTimestamp = data.timestamp;
    if (!newMsgTimestamp) {
      logger.warn("onMessageCreated: Yes message has no timestamp");
      return;
    }

    const prevQuery = messagesRef
      .where("timestamp", "<", newMsgTimestamp)
      .orderBy("timestamp", "desc")
      .limit(1);
    const prevSnapshot = await prevQuery.get();
    const prevDoc = prevSnapshot.docs[0];
    if (!prevDoc) {
      logger.warn("onMessageCreated: no previous message");
      return;
    }

    const prevData = prevDoc.data();
    if ((prevData?.type as string) !== "confirmation") return;

    const foodItems = (prevData?.foodItems as string[]) ?? [];
    const estimatedCalories = prevData?.estimatedCalories as number | undefined;
    const linkedImageMessageId = prevData?.linkedImageMessageId as string | undefined;
    const linkedVisionMessageId = prevData?.linkedVisionMessageId as string | undefined;

    const calories = estimatedCalories ?? 0;
    const macros = calories > 0 ? estimateMacrosFromCalories(calories) : null;

    const mealRef = await db.collection("meals").add({
      userId: conversationId,
      conversationId,
      imageMessageId: linkedImageMessageId ?? null,
      visionMessageId: linkedVisionMessageId ?? null,
      foodItems,
      estimatedCalories: calories,
      macros,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const summaryParts: string[] = ["Meal logged."];
    if (calories > 0) summaryParts.push(`${calories} calories`);
    if (macros) summaryParts.push(`(P ${macros.protein}g · C ${macros.carbs}g · F ${macros.fat}g)`);

    await messagesRef.add({
      role: "assistant",
      type: "text",
      text: summaryParts.join(" "),
      mealLogged: true,
      mealId: mealRef.id,
      estimatedCalories: calories,
      macros,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info("Meal logged", { conversationId, mealId: mealRef.id, estimatedCalories: calories });
  }
);
