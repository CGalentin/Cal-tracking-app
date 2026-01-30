import * as functions from "firebase-functions";

/**
 * Test HTTP function for PR 9 — Cloud Functions Setup.
 * Hit the function URL to confirm deployment; check Firebase Console > Functions > Logs for the log line.
 */
export const testFunction = functions.https.onRequest((req: unknown, res: { send: (body: string) => void }) => {
  functions.logger.info("Cal-tracking-app: testFunction invoked — Cloud Functions are working.");
  res.send("Hello from Firebase! Cloud Functions are set up.");
});
