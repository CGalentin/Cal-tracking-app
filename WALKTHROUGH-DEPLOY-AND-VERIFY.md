# Walkthrough: Deploy Functions & Verify Up to PR 10

Follow these steps in order. Each section tells you what to do, what to type, and what you should see.

---

## Part A: Deploy and Confirm Both Functions Succeed

### Step A1: Open a terminal

- Open a terminal in your project (e.g. VS Code / Cursor terminal, or PowerShell/Command Prompt).
- Make sure you're in the **project root** (the folder that contains `package.json`, `firebase.json`, and the `functions` folder).
  - If not: `cd` to that folder, e.g. `cd "C:\Users\Chris's Home\bloomtech_projects\GauntletAI\Cal-tracking-app"`.

### Step A2: Deploy only functions

Run (note the **space** between `npx` and `firebase`):

```bash
npx firebase deploy --only functions
```

### Step A3: What you should see

- The command runs `cd functions && npm install && npm run build`, then uploads and updates functions.
- At the end you should see something like:
  - `✔  functions: testFunction(us-central1) updated successfully`
  - `✔  functions: onImageMessageCreated(us-central1) updated successfully`
  - `✔  Deploy complete!`
- If you see **errors** (e.g. IAM, or "Secret overlaps non secret: GEMINI_API_KEY"):
  - Fix the error (e.g. remove GEMINI_API_KEY from `functions/.env.calorie-app-chat` if it’s the secret conflict), then run the same deploy command again.

### Step A4: Confirm in Firebase Console

1. Open **[Firebase Console](https://console.firebase.google.com/)** and select project **calorie-app-chat**.
2. In the left sidebar, click **Build → Functions**.
3. You should see two functions listed:
   - **testFunction** (1st Gen, HTTP)
   - **onImageMessageCreated** (2nd Gen, Firestore trigger)
4. Click **testFunction** → copy its **URL** (e.g. `https://us-central1-calorie-app-chat.cloudfunctions.net/testFunction`).
5. Open that URL in a browser. The page should show: **"Hello from Firebase! Cloud Functions are set up."**
6. In Firebase, go to **Functions → Logs** (or **Build → Functions → Logs**). You should see a log line for that request (e.g. "Cal-tracking-app: testFunction invoked …").

**Checkpoint:** Both functions are deployed and `testFunction` responds when you open its URL.

---

## Part B: Quick Check — App + Chat + Logs (VERIFICATION-PR10)

### Step B1: Start the app

1. In the **project root**, run:
   ```bash
   npm install
   npx expo start
   ```
2. Wait until you see the Metro menu (Press a / i / w, or scan QR).
3. Press **a** (Android), **i** (iOS), or **w** (web), or scan the QR with Expo Go on your phone.
4. The app should load. If you see "Incompatible React versions" or "react-dom/client could not be found", fix those first (see VERIFICATION-PR10.md).

**Checkpoint:** App starts with no red error screen.

### Step B2: Login

1. You should land on the **Login** screen.
2. If you have an account: enter email and password, tap **Sign in**.
3. If not: sign up (email, password, display name if shown), then you should be taken to the **home** (tabs) screen.
4. You should see the home screen (e.g. "Open Chat" button, maybe "Log out" in the header).

**Checkpoint:** You are logged in and on the home screen.

### Step B3: Send a text message

1. Tap **Open Chat** (or go to the Chat tab).
2. Chat screen loads (empty or with messages from this session).
3. Type a message, e.g. **Hello**.
4. Tap **Send**. The message should appear on the right (user bubble) and the input should clear.
5. Optionally leave chat and come back — the message should still be there.

**Checkpoint:** Text messages send and persist.

### Step B4: Send an image (this triggers the function)

1. Stay on the Chat screen.
2. Tap the **camera/image** button next to the text input.
3. If prompted, allow **photo library** access.
4. Pick **any photo** from your library.
5. You should see a preview with **Send photo** and **Cancel**.
6. Tap **Send photo**. You may see "Uploading..." briefly.
7. The image should appear in the chat as a **user message** (your photo on the right).
8. **Expected:** No new **assistant** message appears (we reverted that). Only your image message is visible.

**Checkpoint:** Image uploads and appears in chat; no assistant reply.

### Step B5: Check Firebase Functions logs (PR 10 trigger + resize)

1. Open **[Firebase Console](https://console.firebase.google.com/)** → project **calorie-app-chat**.
2. Go to **Build → Functions → Logs** (or the **Logs** tab in Functions).
3. In the log filter/query box, restrict to your function. You can use:
   - Filter by **Resource**: function name **onImageMessageCreated**, or
   - In **Logs Explorer** (Google Cloud):  
     `resource.labels.function_name="onImageMessageCreated"`
4. Look at the **most recent** entries (from when you sent the photo).
5. You should see these three log messages (order may vary, timestamps near when you sent the image):
   - **"Image message created"** — with `conversationId`, `messageId`, `imageUrl`.
   - **"Image resized"** — with `original`, `resized`, `sizeBytes`.
   - **"Resized image ready for vision"** — with `conversationId`, `messageId`, `sizeBytes`.

**Checkpoint:** All three log lines appear for the image you just sent.

---

## Summary

| Step | What you did | What confirms success |
|------|----------------|------------------------|
| A   | Deploy functions | Terminal shows both `testFunction` and `onImageMessageCreated` updated; Deploy complete. |
| A4  | Confirm in Console | Both functions listed; testFunction URL returns "Hello from Firebase! Cloud Functions are set up." |
| B1  | Start app         | App loads (Expo), no React/Metro errors. |
| B2  | Login             | Home screen visible. |
| B3  | Send text         | Message appears and persists in chat. |
| B4  | Send image        | Image appears in chat; no assistant message. |
| B5  | Check logs        | "Image message created", "Image resized", "Resized image ready for vision" in Functions logs. |

If all checkpoints pass, **everything up to PR 10 is working**: trigger on image upload and resize are in place; next step is PR 10 — send image to vision model.
