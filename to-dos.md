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
- [x] Install Firebase Functions CLI (`npm install -g firebase-tools` or use `npx firebase`)
- [x] Initialize Functions project (TypeScript) — `firebase.json`, `.firebaserc`, `functions/` with `src/index.ts`
- [x] Deploy test function (see steps below)
- [x] Confirm logs appear in Firebase console

**Done.** Deploy again from project root: `npx firebase deploy --only functions`. Invoke the `testFunction` URL; check Functions > Logs for the message.

---

## PR 10 — Image Recognition Pipeline

### Backend
- [x] Trigger function on image upload
- [x] Resize image
- [x] Send image to vision model
- [x] Parse detected foods

### Firestore
- [x] Create assistant message with description
- [x] Save confidence score

---

## PR 11 — LLM Description Confirmation Flow

### Backend
- [x] Send vision output to LLM
- [x] Generate natural-language description
- [x] Ask confirmation question:
  - “Does this description match your meal?”

### Client
- [x] Display assistant question
- [x] Show Yes / No buttons

---

## PR 12 — Meal Logging on Confirmation

### Backend
- [x] Calculate calories & macros
- [x] Create `meals` document
- [x] Associate meal with image message

### Client
- [x] Show “Meal logged” confirmation
- [x] Display calorie & macro summary

---

## PR 13 — Voice Input Setup (User Corrections)

### Client
- [x] Install speech-to-text library (expo-av for recording + Cloud Function for Speech-to-Text)
- [x] Request microphone permissions (app.json expo-av plugin, Android RECORD_AUDIO)
- [x] Add microphone button to chat
- [x] Record voice input
- [x] Convert speech to text

### Backend (added for PR 13)
- [x] `transcribeAudio` Cloud Function (fetch audio, convert M4A→FLAC, Google Speech-to-Text)
- [x] Storage rules for `audio/` path
- [x] `onTextMealMessageCreated` — parse voice/text meal descriptions with Gemini, confirmation flow

---

## PR 14 — Voice-Based Corrections Flow

### Client
- [x] Send transcribed text as message
- [x] Show “Processing correction…” state

### Backend
- [x] Send correction text + meal context to LLM
- [x] Parse updated meal description
- [x] Recalculate calories & macros

---

## PR 15 — Update Meal After Voice/Text Corrections

### Backend
- [x] Update meal document
- [x] Store original + updated values
- [x] Prevent duplicate logs

### Client
- [x] Update displayed nutrition values
- [x] Show confirmation message

---

## PR 16 — Manual Text Corrections (Fallback)

### Client
- [x] Allow typed corrections
- [x] Reuse voice correction logic
- [x] Display updated macros inline

---

## PR 17 — Meal History & Daily Summary

### Backend
- [x] Query meals by date
- [x] Calculate daily totals

### Client
- [x] Create daily summary screen
- [x] Display calories & macros
- [x] List meals for the day

---

## To-Do List: Calorie Target Calculation (Implementation Steps)

### Phase 1: Data Architecture
- [x] Create a UserProfile schema to store weight, height, age, and gender.
- [x] Map "Activity Levels" to numerical multipliers in a constant file.

### Phase 2: Logic & Integration
- [x] Create a utility function `calculateBMR()` using the Mifflin-St Jeor formula.
- [x] Create a function `calculateDailyTarget()` that subtracts the user's chosen deficit from their TDEE.
- [x] Implement a "Target Weight" vs "Current Weight" progress bar logic.

### Phase 3: UI/UX
- [x] Build an onboarding flow to capture user physical metrics.
- [x] Add a "Safety Warning" if the calculated daily calorie target falls below 1,200 (women) or 1,500 (men) calories.
- [x] Design the dashboard card to display "Calories Remaining" (Target - Consumed + Burned).

---

## PR 18 — Error Handling & Beginner Safety

### Client
- [x] Add error boundaries for crash recovery
- [x] Show user-friendly error messages (network, auth, Firebase)
- [x] Handle image upload failures gracefully
- [x] Handle voice recording failures gracefully
- [x] Add retry buttons for failed operations

### Backend
- [x] Add try/catch to all Cloud Functions (onImageMessageCreated duplicate/malformed line fixed in `functions/src/index.ts`)
- [x] Log errors to Firebase console
- [x] Return meaningful error messages to client

### UX
- [x] Show loading spinners during async operations
- [x] Disable buttons while processing
- [x] Prevent double-tap/duplicate submissions

---

## PR 19 — Onboarding & Help

### First-Time User Experience
- [x] Create onboarding flow (3-4 screens explaining app features) — `app/feature-tour.tsx` (separate from calorie onboarding)
- [x] Show onboarding only on first launch (AsyncStorage flag) — `@react-native-async-storage/async-storage` + `components/featureTourStorage.ts`
- [x] Add "Skip" button to onboarding

### Help & Guidance
- [x] Add help/info button to chat screen — header `?` opens modal
- [x] Create help modal with tips (how to log meals, corrections, voice input) — `components/ChatHelpModal.tsx`
- [x] Add example prompts or suggestions for new users — horizontal chips when chat is empty

### Settings
- [x] Create settings screen — `app/(tabs)/settings.tsx` tab
- [x] Add option to reset onboarding — reset tour for next launch + “Show welcome tour now”
- [x] Add logout button in settings — header “Log out” removed; use Settings tab
- [x] Display user info (email, display name)

---

## How to Use This Roadmap

- Each checkbox ≈ **15 minutes**
- Each PR ≈ **1–2 hours**
- You can stop after any PR and still have a working app
- Every step builds confidence and understanding

---





