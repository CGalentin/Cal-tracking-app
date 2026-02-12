# Verification Checklist — App Working Up to PR 10

Use this to confirm everything is working after returning to the project. PR 10 scope: **trigger on image upload** + **resize image** (no assistant message or vision yet).

---

## 1. Environment

- [ ] **Node / npm:** From project root, run `node -v` (expect v18+ or v22) and `npm -v`.
- [ ] **Dependencies:** Run `npm install` (root). Run `cd functions && npm install && cd ..` (functions).
- [ ] **React version:** In `package.json`, `react` and `react-dom` should be **19.1.0** (matches react-native-renderer).

---

## 2. App Starts (Expo)

- [ ] From project root: `npx expo start` (or `npm start`).
- [ ] No "Incompatible React versions" or "react-dom/client could not be found" errors.
- [ ] If you see react-dom/client error: ensure `metro.config.js` exists and has the custom `resolveRequest` for `react-dom/client`. Then run `npx expo start --clear`.
- [ ] Press `a` (Android), `i` (iOS), or `w` (web), or scan QR with Expo Go. App loads.

---

## 3. Auth & Navigation (PRs 1–4)

- [ ] App opens to **Login** screen (or redirects there).
- [ ] **Sign up:** Enter email, password, display name (if shown). Submit → redirects to home (tabs).
- [ ] **Log out:** Use Log out in header or home → returns to Login.
- [ ] **Sign in:** Log in again with same credentials → returns to home.

---

## 4. Chat — Text Messages (PRs 5–7)

- [ ] From home, tap **Open Chat** (or navigate to Chat).
- [ ] Chat screen loads; message list is empty or shows only messages from this session.
- [ ] Type a message (e.g. "Hello"). **Send** is enabled when there is text.
- [ ] Tap **Send** → message appears in the list (user bubble, right). Input clears.
- [ ] Refresh or re-open chat → message still there (stored in Firestore).
- [ ] **Send** is disabled when the input is empty.

---

## 5. Chat — Image Upload (PR 8)

- [ ] In Chat, tap the **camera/image** button next to the input.
- [ ] Grant photo library permission if prompted.
- [ ] Pick a photo from the library → preview appears with "Send photo" (and Cancel).
- [ ] Tap **Send photo** → "Uploading..." then the image appears in the message list (user message with image).
- [ ] Image is visible (loaded from Firebase Storage URL). No crash or red box.

---

## 6. Cloud Functions — PR 9 (testFunction)

- [ ] Deploy: from project root, `npx firebase deploy --only functions` (with a space: `npx firebase`).
- [ ] In Firebase Console → **Functions**, you see **testFunction** and **onImageMessageCreated**.
- [ ] Open the **testFunction** URL (from Console or CLI) in a browser → page shows "Hello from Firebase! Cloud Functions are set up."
- [ ] In **Functions → Logs**, you see a log line for that request.

---

## 7. PR 10 — Trigger + Resize (No Assistant Message)

- [ ] **Trigger:** Send a **new** image from the app (Chat → pick photo → Send photo).
- [ ] In **Firebase Console → Functions → Logs** (filter by `onImageMessageCreated`):
  - [ ] Log: **"Image message created"** with `conversationId`, `messageId`, `imageUrl`.
  - [ ] Log: **"Image resized"** with `original`, `resized`, `sizeBytes`.
  - [ ] Log: **"Resized image ready for vision"** with `conversationId`, `messageId`, `sizeBytes`.
- [ ] **Expected behavior:** No new assistant message appears in the chat (we reverted that). Only your user image message is visible. Pipeline stops at resize and logging.

---

## 8. Quick Code Checks (Optional)

- [ ] **functions build:** `cd functions && npm run build` → completes with no TypeScript errors.
- [ ] **Expo lint:** From root, `npm run lint` (or `npx expo lint`) → no errors.
- [ ] **firebaseConfig:** `components/firebaseConfig.js` has correct `projectId` (`calorie-app-chat`) and your Firebase config (no placeholder API keys).

---

## If Something Fails

| Issue | What to check |
|-------|----------------|
| React version error on Expo start | `package.json`: `react` and `react-dom` = 19.1.0; run `npm install` and `npx expo start --clear`. |
| react-dom/client not found | `metro.config.js` in project root with `resolveRequest` for `react-dom/client`. |
| Firebase deploy fails (IAM) | Run the `gcloud projects add-iam-policy-binding ...` commands as project owner, then deploy again. |
| testFunction 404 or not found | Redeploy: `npx firebase deploy --only functions`. |
| No "Image resized" logs when sending photo | Ensure the new message has `type: 'image'` and `imageUrl` in Firestore; check Storage rules allow read; check Functions → Logs for errors. |
| Functions build error (sharp) | In `functions/tsconfig.json`, `esModuleInterop: true` must be set. |

---

## Summary — What’s Implemented Up to PR 10

| Item | Status |
|------|--------|
| Auth (login, sign up, log out) | ✓ |
| Chat screen, conversation per user | ✓ |
| Send text message → Firestore | ✓ |
| Upload image → Storage + image message in Firestore | ✓ |
| Cloud Functions: testFunction (HTTP) | ✓ |
| Cloud Functions: onImageMessageCreated (Firestore trigger) | ✓ |
| PR 10: Trigger on image message | ✓ |
| PR 10: Resize image (sharp, max 1024px) | ✓ |
| PR 10: Send to vision model | Not yet |
| PR 10: Parse foods / assistant message / confidence | Not yet (reverted) |
