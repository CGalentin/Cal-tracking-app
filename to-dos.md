# Product Roadmap – PR-Sized 15-Minute Task Checklist
**Stack:** React Native · Tailwind (NativeWind) · Firebase  
**Core Flows:** Photo → AI Description → User Confirmation → Voice/Text Corrections → Log Meal

---

## PR 1 — Project & Repo Setup

### App Scaffolding
- [x] Install Node.js and Expo CLI
- [x] Create new Expo React Native app (TypeScript)
- [x] Run app on iOS simulator or Android emulator
- [x] Confirm hot reload works

### Repo Setup
- [x] Initialize Git repository
- [x] Create initial GitHub repo
- [x] Push first commit

---

## PR 2 — Tailwind / NativeWind Setup

### Styling Setup
- [x] Install NativeWind
- [x] Install Tailwind dependencies
- [x] Create `tailwind.config.js`
- [x] Add NativeWind Babel plugin

### Validation
- [x] Create a test screen (`app/test-tailwind.tsx`)
- [x] Style text using Tailwind classes
- [x] Verify styles update on save (test after restarting Expo)

---

## PR 3 — Firebase Project Setup

### Firebase Console
- [x] Create Firebase project
- [x] Enable Firebase Authentication
- [x] Enable Firestore database (verify in Firebase Console)
- [x] Enable Cloud Storage (code ready - enable in Firebase Console if not already done)

### App Integration
- [x] Install Firebase SDK packages
- [x] Add Firebase config file (`components/firebaseConfig.js`)
- [x] Initialize Firebase in app
- [x] Confirm app connects without errors

---

## PR 4 — Authentication (Required for Storage & DB)

### Backend
- [x] Enable Anonymous Authentication in Firebase (not needed - using email)
- [x] Enable Email Authentication (optional)

### Frontend
- [x] Add auth state listener (`app/_layout.tsx` with `subscribeToAuthChanges`)
- [x] Store user ID in app state (via Firebase auth)
- [x] Show loading screen while auth initializes

---

## PR 5 — Chat Screen Foundation

### UI Layout
- [x] Create Chat screen component (`app/chat.tsx`)
- [x] Add scrollable message list
- [x] Add text input field
- [x] Add send button

### Styling
- [x] Style user messages
- [x] Style assistant messages
- [x] Add spacing and padding

---

## PR 6 — Firestore Chat Data Model

### Firestore Setup
- [x] Create `conversations` collection (via `chatService.js`)
- [x] Create `messages` collection (subcollection under conversations)
- [x] Define message fields (role, text, timestamp)

### Client Logic
- [x] Subscribe to messages with Firestore listener (`subscribeToMessages`)
- [x] Render messages in order (ordered by timestamp ascending)
- [x] Auto-scroll on new messages (FlatList with `scrollToEnd`)

---

## PR 7 — Sending Text Messages

### Client
- [x] Capture text input (`inputText` state, `TextInput` in `app/chat.tsx`)
- [x] Disable send button when empty (`disabled={!inputText.trim()}`)
- [x] Clear input after sending (`setInputText('')` in `handleSend`)

### Firestore
- [x] Write user message to Firestore (`sendMessage` in `chatService.js`)
- [x] Add timestamp and role (`role`, `text`, `timestamp: serverTimestamp()`)

---

## PR 8 — Image Capture & Upload

### Client
- [x] Request camera permissions (`requestMediaLibraryPermissionsAsync` in `app/chat.tsx`)
- [x] Open camera or photo library (`launchImageLibraryAsync` via expo-image-picker)
- [x] Preview selected image (thumbnail + Cancel/Send photo in chat input area)
- [x] Upload image to Firebase Storage (`uploadImageAndSendMessage` in `chatService.js`)

### Firestore
- [x] Save image URL in a message document (`imageUrl` field)
- [x] Mark message as `type: image`

---

## PR 9 — Cloud Functions Setup

### Backend
- [ ] Install Firebase Functions CLI (`npm install -g firebase-tools` or use `npx firebase`)
- [x] Initialize Functions project (TypeScript) — `firebase.json`, `.firebaserc`, `functions/` with `src/index.ts`
- [ ] Deploy test function (see steps below)
- [ ] Confirm logs appear in Firebase console

**To finish PR 9:** From project root, run `cd functions && npm install && npm run build`, then `firebase login` (if needed), then `firebase deploy --only functions`. Invoke the `testFunction` URL from the console; check Functions > Logs for the message.

---

## PR 10 — Image Recognition Pipeline

### Backend
- [ ] Trigger function on image upload
- [ ] Resize image
- [ ] Send image to vision model
- [ ] Parse detected foods

### Firestore
- [ ] Create assistant message with description
- [ ] Save confidence score

---

## PR 11 — LLM Description Confirmation Flow

### Backend
- [ ] Send vision output to LLM
- [ ] Generate natural-language description
- [ ] Ask confirmation question:
  - “Does this description match your meal?”

### Client
- [ ] Display assistant question
- [ ] Show Yes / No buttons

---

## PR 12 — Meal Logging on Confirmation

### Backend
- [ ] Calculate calories & macros
- [ ] Create `meals` document
- [ ] Associate meal with image message

### Client
- [ ] Show “Meal logged” confirmation
- [ ] Display calorie & macro summary

---

## PR 13 — Voice Input Setup (User Corrections)

### Client
- [ ] Install speech-to-text library
- [ ] Request microphone permissions
- [ ] Add microphone button to chat
- [ ] Record voice input
- [ ] Convert speech to text

---

## PR 14 — Voice-Based Corrections Flow

### Client
- [ ] Send transcribed text as message
- [ ] Show “Processing correction…” state

### Backend
- [ ] Send correction text + meal context to LLM
- [ ] Parse updated meal description
- [ ] Recalculate calories & macros

---

## PR 15 — Update Meal After Voice/Text Corrections

### Backend
- [ ] Update meal document
- [ ] Store original + updated values
- [ ] Prevent duplicate logs

### Client
- [ ] Update displayed nutrition values
- [ ] Show confirmation message

---

## PR 16 — Manual Text Corrections (Fallback)

### Client
- [ ] Allow typed corrections
- [ ] Reuse voice correction logic
- [ ] Display updated macros inline

---

## PR 17 — Meal History & Daily Summary

### Backend
- [ ] Query meals by date
- [ ] Calculate daily totals

### Client
- [ ] Create daily summary screen
- [ ] Display calories & macros
- [ ] List meals for the day

---

## PR 18 — Error Handling & Beginner Safety

### Client
- [ ] Handle failed uploads
- [ ] Handle AI errors gracefully
- [ ] Show retry options

### Backend
- [ ] Validate all AI responses
- [ ] Add fallback messages when unsure

---

## PR 19 — Onboarding & Help

### UX
- [ ] Welcome message explaining flow
- [ ] Example image prompt
- [ ] Voice correction explanation

---

## How to Use This Roadmap

- Each checkbox ≈ **15 minutes**
- Each PR ≈ **1–2 hours**
- You can stop after any PR and still have a working app
- Every step builds confidence and understanding

---

## Beginner Tip (Important)

If something feels confusing:
- Skip it
- Stub it
- Move on

Momentum matters more than perfection.




