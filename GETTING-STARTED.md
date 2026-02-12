# Getting Started — Return to the App (Up to PR 10)

Use this guide when you come back to the project. It starts with **running your local environment**, then points you to verification and next steps.

---

## What the other docs are for

| Document | Purpose |
|----------|---------|
| **to-dos.md** | Full roadmap (PRs 1–19). You’re at **PR 10** (image recognition). Some PR 10 boxes are still unchecked even though the code includes vision + assistant message. |
| **VERIFICATION-PR10.md** | Checklist to confirm the app and Cloud Functions work (auth, chat, text, image, logs). Use it after the app is running. |
| **WALKTHROUGH-DEPLOY-AND-VERIFY.md** | Step-by-step deploy of Cloud Functions and a quick app + logs check. Use after your local app runs. |
| **components/chat-history.md** | History of what was built in past sessions (auth, Firestore, Functions, PR 10 trigger + resize, etc.). |

---

## Step 1: Open your project in Cursor

1. Open **Cursor** (or VS Code).
2. **File → Open Folder** and choose your project folder:  
   `Cal-tracking-app` (the folder that contains `package.json`, `firebase.json`, and an `app` folder).
3. You’re in the **project root** when you see those files in the sidebar.

---

## Step 2: Open a terminal

1. In Cursor: **Terminal → New Terminal** (or press `` Ctrl+` ``).
2. The terminal opens at the bottom. You’ll see a **prompt** (e.g. `PS C:\...\Cal-tracking-app>`).
3. **Don’t type the `$` or `>`** you sometimes see in docs — that’s just the prompt. Type only the command.

---

## Step 3: Install dependencies (first time or after pull)

In the terminal, run these **one at a time**. Wait for each to finish before running the next.

```bash
npm install
```

- This installs the app’s dependencies (React Native, Expo, Firebase, etc.).
- You should see a lot of output and end with something like “added XXX packages” and no red errors.

Then install the Cloud Functions dependencies (needed for deploy later; optional for “run app only”):

```bash
cd functions
npm install
cd ..
```

- `cd functions` goes into the `functions` folder.
- `cd ..` goes back to the project root.

---

## Step 4: Start the app (Expo)

Still in the **project root** in the terminal, run:

```bash
npx expo start
```

**What you should see:**

- A Metro bundler window with a **QR code** and text like:
  - **Press a** for Android emulator  
  - **Press i** for iOS simulator (Mac only)  
  - **Press w** for web  
  - Or scan the QR code with **Expo Go** on your phone
- **Leave this terminal open.** The app runs here. Closing it stops the app.

**How to open the app:**

- **Phone:** Install **Expo Go** from the app store, scan the QR code with your camera. The app opens in Expo Go.
- **Computer (web):** In the **same terminal** where Expo is running, press **w**. A browser tab opens with the app.
- **Android emulator:** Press **a** in that terminal (requires Android Studio / emulator set up).
- **iOS simulator (Mac only):** Press **i** in that terminal.

**If you see errors:**

- **“Incompatible React versions”**  
  In `package.json`, `react` and `react-dom` should be **19.1.0**. Run `npm install` again, then `npx expo start --clear`.
- **“react-dom/client could not be found”**  
  The project should have a `metro.config.js` in the root that fixes this. Run `npx expo start --clear`.
- **“Cannot find module …”**  
  Run `npm install` again from the project root.

---

## Step 5: Use the app (quick check)

1. The app should show the **Login** screen.
2. **Sign in** with your email and password (or **Sign up** if you don’t have an account).
3. After login you should see the **home** screen (e.g. “Open Chat” button).
4. Tap **Open Chat** → type a message and tap **Send** → the message should appear.
5. Tap the **camera/image** button → pick a photo → **Send photo** → the image should appear in the chat.

If all of that works, your **local environment is running** and the app is talking to Firebase.

---

## What to do next (in order)

1. **You’re here:** Local app runs (Steps 1–5 above). ✓  
2. **Optional — verify everything:**  
   Use **VERIFICATION-PR10.md** (full checklist) or **WALKTHROUGH-DEPLOY-AND-VERIFY.md** (deploy functions + quick test).  
3. **Deploy Cloud Functions (so image → AI reply works):**  
   In a **new** terminal (or stop Expo with Ctrl+C first), from the **project root** run:  
   `npx firebase deploy --only functions`  
   (There must be a **space** between `npx` and `firebase`.)  
   Then send a **new** food photo in the app; you should get an assistant reply like “I see: …” (if the function code and Gemini secret are set up).  
4. **Next feature work:**  
   After PR 10 is verified, the roadmap continues with **PR 11** (LLM description confirmation: “Does this match your meal?” + Yes/No) in **to-dos.md**.

---

## Cheat sheet — commands from project root

| What you want | Command |
|---------------|---------|
| Install app dependencies | `npm install` |
| Start the app (Expo) | `npx expo start` |
| Start with cache cleared | `npx expo start --clear` |
| Deploy Cloud Functions | `npx firebase deploy --only functions` |
| Deploy functions + Firestore indexes | `npx firebase deploy --only "functions,firestore:indexes"` (use quotes in PowerShell) |
| Install functions deps | `cd functions` then `npm install` then `cd ..` |

---

## Troubleshooting: Image sent but no assistant reply (resize works, no “I see: …”)

If the image uploads and the function runs (resize step works) but you never get an assistant message in the chat:

1. **Redeploy the functions** (the code now declares the Gemini secret so the key is injected):
   ```bash
   npx firebase deploy --only functions
   ```
2. **Ensure the Gemini API key is set as a secret:**  
   Run `npx firebase functions:secrets:set GEMINI_API_KEY` and paste your key when prompted. Get a key from [Google AI Studio](https://aistudio.google.com/apikey) if needed.
3. **Check Firebase Functions logs:**  
   Firebase Console → **Build → Functions → Logs**, filter by **onImageMessageCreated**. After sending an image, look for:
   - **“Vision result”** → vision succeeded; the assistant message should appear in chat (if it doesn’t, the app may be filtering it).
   - **“GEMINI_API_KEY not set”** or **“Gemini API failed”** → the key wasn’t available or the API call failed; you should still see the fallback message “I couldn’t analyze the image right now.” in chat once the function is deployed with the secret.
4. **Send a new image** after deploying; the chat only shows messages from the current session (since you opened the Chat tab).

---

## Troubleshooting: "I couldn't analyze the image right now. Please try again."

You see this when the **vision step fails** (resize worked, but the Gemini call didn't return text). To find the cause:

1. **Open Firebase Console → Build → Functions → Logs.** Filter by **onImageMessageCreated** and look at the **most recent** run (right after you sent the image).

2. **Match the log message:**
   - **"sendImageToVisionModel: apiKey is empty"** — The secret isn't reaching the function. Run `npx firebase functions:secrets:set GEMINI_API_KEY`, paste your key, then redeploy: `npx firebase deploy --only functions`.
   - **"sendImageToVisionModel: Gemini API failed"** (with `status` and `body`) — **403:** API key invalid or **Generative Language API** not enabled. In [Google Cloud Console](https://console.cloud.google.com/apis/library) enable **Generative Language API** for project **calorie-app-chat**. Use a key from [Google AI Studio](https://aistudio.google.com/apikey). **400:** Check the logged `body`. **429:** Rate limit; try again later.
   - **"sendImageToVisionModel: no text in response"** (with `finishReason` / `blockReason`) — Gemini returned no text (e.g. safety block). Try a different photo (clear meal/food image).

3. **Redeploy after fixing:** `npx firebase deploy --only functions`, then send a **new** image.

---

## Summary

- **First goal:** Run the app locally (Steps 1–5).  
- **Then:** Optionally run through VERIFICATION-PR10.md or WALKTHROUGH-DEPLOY-AND-VERIFY.md.  
- **Then:** Deploy functions if you want the image → AI reply in the app, and continue with PR 11 from to-dos.md.
