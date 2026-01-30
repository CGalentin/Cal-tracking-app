import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as logger from "firebase-functions/logger";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import sharp from "sharp";

if (!admin.apps.length) {
  admin.initializeApp();
}

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
 * we download and resize the image. resized.buffer is ready for Step 2 (send to vision model).
 * No assistant message or parse/confidence until vision is implemented.
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

    // Step 1: Download and resize image. Step 2: send to vision (not yet implemented).
    // No Firestore assistant message or parse/confidence until after vision is wired.
    let resized: { buffer: Buffer; width: number; height: number } | null = null;
    try {
      resized = await downloadAndResizeImage(imageUrl);
    } catch (err) {
      logger.error("downloadAndResizeImage failed", err);
    }

    if (resized) {
      // resized.buffer is ready for Step 2: send image to vision model.
      logger.info("Resized image ready for vision", { conversationId, messageId, sizeBytes: resized.buffer.length });
    }
  }
);
