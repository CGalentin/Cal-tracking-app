import speech from "@google-cloud/speech";
import ffmpegStatic from "ffmpeg-static";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import sharp from "sharp";

if (!admin.apps.length) {
  admin.initializeApp();
}

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic as string);
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

const GEMINI_TEXT_MEAL_PROMPT = `The user described a meal they ate. Parse it into:
1. A comma-separated list of foods. Only list food items, nothing else. Example: chicken salad, apple
2. On the next line, estimate the total calories for the whole meal and write exactly: Estimated total calories: N
where N is a single number (e.g. 350 or 550). Base the estimate on typical portion sizes.`;

const GEMINI_CORRECTION_PROMPT = `The user saw this meal description: {foods}. Estimated calories: {calories}.
They said it didn't match and gave this correction: {correction}
Apply the correction and output:
1. An updated comma-separated list of foods. Only list food items, nothing else.
2. On the next line, estimate the total calories for the corrected meal and write exactly: Estimated total calories: N
where N is a single number.`;

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
 * Send text meal description to Gemini and get parsed foods + calories.
 */
async function sendTextToGemini(userText: string, apiKey: string): Promise<{ text: string } | null> {
  if (!apiKey) {
    logger.warn("sendTextToGemini: apiKey is empty");
    return null;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: `${GEMINI_TEXT_MEAL_PROMPT}\n\nUser's meal: ${userText}` }] }],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    logger.warn("sendTextToGemini: Gemini API failed", { status: response.status, body: errText });
    return null;
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    promptFeedback?: { blockReason?: string };
  };
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text?.trim();
  if (!text) return null;

  return { text };
}

/**
 * PR 14 — Send correction text + original meal context to LLM; get updated meal description.
 */
async function sendCorrectionToGemini(
  correctionText: string,
  originalFoodItems: string[],
  originalCalories: number,
  apiKey: string
): Promise<{ text: string } | null> {
  if (!apiKey) {
    logger.warn("sendCorrectionToGemini: apiKey is empty");
    return null;
  }

  const foods = originalFoodItems.length > 0 ? originalFoodItems.join(", ") : "unknown";
  const prompt = GEMINI_CORRECTION_PROMPT.replace("{foods}", foods)
    .replace("{calories}", String(originalCalories))
    .replace("{correction}", correctionText);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const body = { contents: [{ parts: [{ text: prompt }] }] };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    logger.warn("sendCorrectionToGemini: Gemini API failed", { status: response.status, body: errText });
    return null;
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) return null;

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
 * PR 13 — Voice input (Expo Go): transcribe audio from URL using Google Cloud Speech-to-Text.
 * Expects POST body: { audioUrl: string }
 * Returns: { transcript: string }
 */
export const transcribeAudio = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }
  const audioUrl = (req.body as { audioUrl?: string })?.audioUrl;
  if (!audioUrl || typeof audioUrl !== "string") {
    res.status(400).send("Missing audioUrl in request body");
    return;
  }
  try {
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) throw new Error("Failed to fetch audio");
    const arrayBuffer = await audioResponse.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `input-${Date.now()}.m4a`);
    const outputPath = path.join(tmpDir, `output-${Date.now()}.flac`);
    fs.writeFileSync(inputPath, audioBuffer);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat("flac")
        .audioChannels(1)
        .audioFrequency(16000)
        .on("end", () => resolve())
        .on("error", (err: unknown) => reject(err))
        .save(outputPath);
    });
    const flacBuffer = fs.readFileSync(outputPath);
    try {
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    } catch {
      /* ignore cleanup errors */
    }
    const client = new speech.SpeechClient();
    const [response] = await client.recognize({
      audio: { content: flacBuffer.toString("base64") },
      config: {
        encoding: "FLAC",
        sampleRateHertz: 16000,
        languageCode: "en-US",
      },
    });
    const transcript =
      response.results
        ?.map((r) => r.alternatives?.[0]?.transcript)
        .filter(Boolean)
        .join(" ") ?? "";
    res.json({ transcript });
  } catch (err) {
    logger.error("transcribeAudio failed", err);
    const msg = err instanceof Error ? err.message : "Transcription failed";
    res.status(500).send(msg);
  }
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
    const messagesRef = db.collection("conversations").doc(conversationId).collection("messages");

    const writeErrorReply = async (msg: string) => {
      try {
        await messagesRef.add({
          role: "assistant",
          type: "text",
          text: msg,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (writeErr) {
        logger.error("onImageMessageCreated: failed to write error reply", writeErr);
      }
    };

    try {
      logger.info("Image message created", { conversationId, messageId: event.params.messageId, imageUrl });

      let resized: { buffer: Buffer; width: number; height: number } | null = null;
      try {
        resized = await downloadAndResizeImage(imageUrl);
      } catch (err) {
        logger.error("downloadAndResizeImage failed", err);
      }

      if (!resized) {
        await writeErrorReply("I couldn't process that image. Please try another photo.");
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
        await writeErrorReply("I couldn't analyze the image right now. Please try again.");
        return;
      }

      const description = visionResult.text;
      const { foods: foodItems, estimatedCalories } = parseVisionResponse(description);
      const confidenceScore = 0.85;

      const messageParts: string[] = [];
      if (foodItems.length > 0) {
        messageParts.push(`I see: ${foodItems.join(", ")}.`);
        if (estimatedCalories != null) {
          messageParts.push(`Estimated: ${formatNutritionSummary(estimatedCalories)}`);
        }
      } else {
        messageParts.push(description);
        if (estimatedCalories != null) {
          messageParts.push(`Estimated: ${formatNutritionSummary(estimatedCalories)}`);
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
    } catch (err) {
      logger.error("onImageMessageCreated failed", err);
      await writeErrorReply("Something went wrong while analyzing your photo. Please try again.");
    }
  }
);

/**
 * PR 13 — Text/voice meal input: when user sends a meal description (not "Yes"), parse with Gemini and ask for confirmation.
 * PR 14 — When user said "No" and then sends a correction, use correction flow: send to LLM with context, parse updated meal, recalculate.
 */
export const onTextMealMessageCreated = onDocumentCreated(
  {
    document: "conversations/{conversationId}/messages/{messageId}",
    secrets: [geminiApiKeySecret],
  },
  async (event) => {
    try {
    const snapshot = event.data;
    if (!snapshot?.exists) return;

    const data = snapshot.data();
    const role = data?.role as string | undefined;
    const type = data?.type as string | undefined;
    const text = (data?.text as string | undefined)?.trim();

    if (role !== "user" || type !== "text" || !text || text === "Yes") return;
    if (text === "No") return; // "No" is handled by confirmation flow; no AI processing needed

    const { conversationId } = event.params;
    const messagesRef = db.collection("conversations").doc(conversationId).collection("messages");
    const newMsgTimestamp = data.timestamp;
    if (!newMsgTimestamp) {
      logger.warn("onTextMealMessageCreated: message has no timestamp");
      return;
    }

    // PR 14 — Detect correction context: previous message was user "No", message before that was confirmation
    const prevQuery = messagesRef
      .where("timestamp", "<", newMsgTimestamp)
      .orderBy("timestamp", "desc")
      .limit(5);
    const prevSnapshot = await prevQuery.get();
    const prevDocs = prevSnapshot.docs;
    if (prevDocs.length >= 2) {
      const immediatelyPrev = prevDocs[0].data();
      const twoBack = prevDocs[1].data();
      const immediatelyPrevRole = immediatelyPrev?.role as string | undefined;
      const immediatelyPrevText = (immediatelyPrev?.text as string | undefined)?.trim();
      const twoBackType = twoBack?.type as string | undefined;

      if (
        immediatelyPrevRole === "user" &&
        immediatelyPrevText === "No" &&
        twoBackType === "confirmation"
      ) {
        // Correction flow: user rejected confirmation and is now correcting
        const foodItems = (twoBack?.foodItems as string[]) ?? [];
        const estimatedCalories = (twoBack?.estimatedCalories as number | undefined) ?? 0;
        const linkedImageMessageId = twoBack?.linkedImageMessageId as string | undefined;

        logger.info("Correction flow detected", {
          conversationId,
          correction: text.slice(0, 80),
          originalFoods: foodItems,
        });

        const apiKey = geminiApiKeySecret.value();
        let result: { text: string } | null = null;
        try {
          result = await sendCorrectionToGemini(text, foodItems, estimatedCalories, apiKey);
        } catch (err) {
          logger.error("sendCorrectionToGemini failed", err);
        }

        if (!result) {
          await messagesRef.add({
            role: "assistant",
            type: "text",
            text: "I couldn't apply that correction. Please try again or describe the full meal.",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });
          return;
        }

        const { foods: updatedFoodItems, estimatedCalories: updatedCalories } =
          parseVisionResponse(result.text);
        const updatedMacros =
          updatedCalories != null && updatedCalories > 0
            ? estimateMacrosFromCalories(updatedCalories)
            : null;

        const messageParts: string[] = [];
        if (updatedFoodItems.length > 0) {
          messageParts.push(`Updated: ${updatedFoodItems.join(", ")}.`);
          if (updatedCalories != null) {
            messageParts.push(`Estimated: ${formatNutritionSummary(updatedCalories)}`);
          }
        } else {
          messageParts.push(result.text);
          if (updatedCalories != null) {
            messageParts.push(`Estimated: ${formatNutritionSummary(updatedCalories)}`);
          }
        }

        const visionMsgRef = await messagesRef.add({
          role: "assistant",
          type: "text",
          text: messageParts.join(" "),
          foodDescription: result.text,
          foodItems: updatedFoodItems,
          confidenceScore: 0.85,
          isCorrectionUpdate: true,
          ...(updatedCalories != null && { estimatedCalories: updatedCalories }),
          ...(updatedMacros != null && { macros: updatedMacros }),
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        await messagesRef.add({
          role: "assistant",
          type: "confirmation",
          text: "Does this description match your meal?",
          linkedVisionMessageId: visionMsgRef.id,
          linkedImageMessageId: linkedImageMessageId ?? null,
          foodItems: updatedFoodItems,
          ...(updatedCalories != null && { estimatedCalories: updatedCalories }),
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        logger.info("Correction processed", {
          conversationId,
          updatedFoods: updatedFoodItems,
          updatedCalories: updatedCalories ?? undefined,
        });
        return;
      }
    }

    // New meal flow (PR 13)
    logger.info("Text meal message created", { conversationId, text: text.slice(0, 80) });

    const apiKey = geminiApiKeySecret.value();
    let result: { text: string } | null = null;
    try {
      result = await sendTextToGemini(text, apiKey);
    } catch (err) {
      logger.error("sendTextToGemini failed", err);
    }

    if (!result) {
      await messagesRef.add({
        role: "assistant",
        type: "text",
        text: "I couldn't parse that meal. Please try describing it again or add a photo.",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    const { foods: foodItems, estimatedCalories } = parseVisionResponse(result.text);
    const confidenceScore = 0.85;

    const messageParts: string[] = [];
    if (foodItems.length > 0) {
      messageParts.push(`I see: ${foodItems.join(", ")}.`);
      if (estimatedCalories != null) {
        messageParts.push(`Estimated: ${formatNutritionSummary(estimatedCalories)}`);
      }
    } else {
      messageParts.push(result.text);
      if (estimatedCalories != null) {
        messageParts.push(`Estimated: ${formatNutritionSummary(estimatedCalories)}`);
      }
    }

    const visionMsgRef = await messagesRef.add({
      role: "assistant",
      type: "text",
      text: messageParts.join(" "),
      foodDescription: result.text,
      foodItems,
      confidenceScore,
      ...(estimatedCalories != null && { estimatedCalories }),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    await messagesRef.add({
      role: "assistant",
      type: "confirmation",
      text: "Does this description match your meal?",
      linkedVisionMessageId: visionMsgRef.id,
      linkedImageMessageId: null,
      foodItems,
      ...(estimatedCalories != null && { estimatedCalories }),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    } catch (err) {
      logger.error("onTextMealMessageCreated failed", err);
    }
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

/** Format calories and macros for display (e.g. "450 cal (P 34g · C 45g · F 15g)"). */
function formatNutritionSummary(calories: number): string {
  const macros = estimateMacrosFromCalories(calories);
  return `${calories} cal (P ${macros.protein}g · C ${macros.carbs}g · F ${macros.fat}g)`;
}

/**
 * PR 12 — Meal Logging on Confirmation: when user sends "Yes", create meal doc and reply with summary.
 * PR 14 — When user sends "No", ask for clarification so they can type or speak their correction.
 */
export const onMessageCreated = onDocumentCreated(
  { document: "conversations/{conversationId}/messages/{messageId}" },
  async (event) => {
    try {
    const snapshot = event.data;
    if (!snapshot?.exists) return;

    const data = snapshot.data();
    const role = data?.role as string | undefined;
    const text = (data?.text as string | undefined)?.trim();
    if (role !== "user" || !text) return;
    if (text !== "Yes" && text !== "No") return;

    const { conversationId } = event.params;
    const messagesRef = db.collection("conversations").doc(conversationId).collection("messages");
    const newMsgTimestamp = data.timestamp;
    if (!newMsgTimestamp) {
      logger.warn("onMessageCreated: message has no timestamp");
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

    if (text === "No") {
      // PR 14: Ask for clarification so user can type or speak their correction
      await messagesRef.add({
        role: "assistant",
        type: "text",
        text: "What would you like to correct? Type or speak your changes (e.g. \"that's turkey, not chicken\" or \"add two tablespoons of hummus\").",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.info("Asked for correction", { conversationId });
      return;
    }

    // text === "Yes" — log meal (PR 15: prevent duplicates, store original if correction)
    const confirmationMessageId = prevDoc.id;
    const foodItems = (prevData?.foodItems as string[]) ?? [];
    const estimatedCalories = prevData?.estimatedCalories as number | undefined;
    const linkedImageMessageId = prevData?.linkedImageMessageId as string | undefined;
    const linkedVisionMessageId = prevData?.linkedVisionMessageId as string | undefined;

    // PR 15: Prevent duplicate logs — skip if meal already created for this confirmation
    const existingMealSnap = await db
      .collection("meals")
      .where("userId", "==", conversationId)
      .where("confirmationMessageId", "==", confirmationMessageId)
      .limit(1)
      .get();
    if (!existingMealSnap.empty) {
      logger.info("Meal already logged for this confirmation, skipping duplicate", {
        conversationId,
        confirmationMessageId,
      });
      return;
    }

    // PR 15: Store original values if this was a correction flow
    let originalFoodItems: string[] | undefined;
    let originalEstimatedCalories: number | undefined;
    const prevTimestamp = prevData?.timestamp;
    if (prevTimestamp) {
      const historyQuery = messagesRef
        .where("timestamp", "<", prevTimestamp)
        .orderBy("timestamp", "desc")
        .limit(15);
      const historySnap = await historyQuery.get();
      let foundNo = false;
      for (const doc of historySnap.docs) {
        const d = doc.data();
        if (foundNo && (d?.type as string) === "confirmation") {
          originalFoodItems = (d?.foodItems as string[]) ?? [];
          originalEstimatedCalories = d?.estimatedCalories as number | undefined;
          break;
        }
        if ((d?.role as string) === "user" && (d?.text as string)?.trim() === "No") {
          foundNo = true;
        }
      }
    }

    const calories = estimatedCalories ?? 0;
    const macros = calories > 0 ? estimateMacrosFromCalories(calories) : null;

    const mealData: Record<string, unknown> = {
      userId: conversationId,
      conversationId,
      confirmationMessageId,
      imageMessageId: linkedImageMessageId ?? null,
      visionMessageId: linkedVisionMessageId ?? null,
      foodItems,
      estimatedCalories: calories,
      macros,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (originalFoodItems != null) {
      mealData.originalFoodItems = originalFoodItems;
    }
    if (originalEstimatedCalories != null) {
      mealData.originalEstimatedCalories = originalEstimatedCalories;
    }

    const mealRef = await db.collection("meals").add(mealData);

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
    } catch (err) {
      logger.error("onMessageCreated failed", err);
    }
  }
);
