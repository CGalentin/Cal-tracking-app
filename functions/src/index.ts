import { GoogleGenerativeAI } from "@google/generative-ai";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { defineString } from "firebase-functions/params";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import sharp from "sharp";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/** Gemini API key — set in Firebase/Cloud Console or: firebase functions:config:set gemini.apikey="YOUR_KEY" */
const geminiApiKey = defineString("GEMINI_API_KEY", { description: "API key for Google Gemini (get one at https://aistudio.google.com/app/apikey)" });

/** Max dimension (width or height) for resized image before sending to vision API. */
const MAX_IMAGE_DIMENSION = 1024;

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

const VISION_PROMPT = `Look at this image of a meal or food. In one or two short sentences, describe what food or meal is visible (e.g. "Grilled chicken breast with rice and broccoli" or "Caesar salad with bread"). List the main items. Be concise.`;

/**
 * Step 2: Send image buffer to Gemini vision and get a short food description.
 * Returns the description text, or null if the API key is missing or the call fails.
 */
async function sendImageToVision(imageBuffer: Buffer): Promise<{ description: string } | null> {
  const apiKey = geminiApiKey.value();
  if (!apiKey) {
    logger.warn("GEMINI_API_KEY is not set. Set it in Cloud Console > Cloud Run > your function > Edit > Variables.");
    return null;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const imagePart = {
    inlineData: {
      data: imageBuffer.toString("base64"),
      mimeType: "image/jpeg",
    },
  };

  try {
    const result = await model.generateContent([VISION_PROMPT, imagePart]);
    const text = result.response.text()?.trim();
    if (!text) {
      logger.warn("Gemini returned empty text");
      return null;
    }
    logger.info("Vision description received", { descriptionLength: text.length });
    return { description: text };
  } catch (err) {
    logger.error("sendImageToVision failed", err);
    return null;
  }
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
 * Fires when a new message is created under a conversation. If the message is type "image",
 * we run the image pipeline (resize → vision → parse → Firestore). Placeholder implementation
 * logs and writes an assistant "processing" message; vision/parse come in follow-up tasks.
 */
export const onImageMessageCreated = onDocumentCreated(
  "conversations/{conversationId}/messages/{messageId}",
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

    const { conversationId, messageId } = event.params;
    logger.info("Image message created", { conversationId, messageId, imageUrl });

    // Step 1: Download and resize image (ready for vision step).
    let resized: { buffer: Buffer; width: number; height: number } | null = null;
    try {
      resized = await downloadAndResizeImage(imageUrl);
    } catch (err) {
      logger.error("downloadAndResizeImage failed", err);
    }

    const messagesRef = db.collection("conversations").doc(conversationId).collection("messages");

    if (!resized) {
      await messagesRef.add({
        role: "assistant",
        type: "text",
        text: "Could not process image (download or resize failed).",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    // Step 2: Send resized image to Gemini vision and get food description.
    let visionResult: { description: string } | null = null;
    try {
      visionResult = await sendImageToVision(resized.buffer);
    } catch (err) {
      logger.error("Vision step failed", err);
    }

    if (visionResult) {
      // Steps 4 & 5: Write assistant message with description (confidence can be added when API supports it).
      await messagesRef.add({
        role: "assistant",
        type: "text",
        text: visionResult.description,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await messagesRef.add({
        role: "assistant",
        type: "text",
        text: "Image received and resized, but vision description could not be generated (check GEMINI_API_KEY and logs).",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
);
