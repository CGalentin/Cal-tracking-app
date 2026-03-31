## Chat History – Firebase Auth & Login Setup

### Session Overview

- Set up and verified Node.js and Expo dev server.
- Confirmed project is an Expo Router app (`"main": "expo-router/entry"`), not a classic `App.js` app.
- Clarified that `app/_layout.tsx` is the effective root component instead of `App.js`.

### Firebase Configuration

- Created `components/firebaseConfig.js` and fixed multiple syntax issues:
  - Added missing quotes and commas around Firebase config values.
  - Ensured `firebaseConfig` matches the Firebase Console web config structure.
- Initialized Firebase app and exported `auth` via:
  - `initializeApp(firebaseConfig)`
  - `getAuth(app)`

### Auth Service & Login Screen

- Implemented `components/authService.js` with:
  - `signUp(email, password)` using `createUserWithEmailAndPassword`.
  - `signIn(email, password)` using `signInWithEmailAndPassword`.
  - `logOut()` using `signOut`.
  - `subscribeToAuthChanges(callback)` using `onAuthStateChanged(auth, callback)`.
- Implemented `components/LoginScreen.js`:
  - Local state for `email`, `password`, and `isSignUp`.
  - `handleAuth` that:
    - Validates required fields.
    - Calls `signUp` or `signIn` based on `isSignUp`.
    - Shows success/error alerts via `Alert.alert`.

### Routing & Screens

- Added `app/login.tsx` to expose `LoginScreen` as a route:
  - Default export renders `<LoginScreen />`.
- Updated `app/_layout.tsx` multiple times; final behavior:
  - Uses `subscribeToAuthChanges` to track `user` and `loading` state.
  - While `loading`, shows a centered “Loading…” view.
  - Declares a `Stack` with screens:
    - `login` (no header) for unauthenticated state.
    - `(tabs)` (no header) as the main app when logged in.
    - `modal` with modal presentation.
  - Reacts to auth state via `useEffect`:
    - When logged out and not on `login`, redirects to `/login`.
    - When logged in and on `login`, redirects to `/(tabs)`.
- Created `app/index.tsx` to redirect `/` → `/login` using `<Redirect href="/login" />` so the web entry path lands on the login screen.

### Tabs Home & Logout

- Updated `app/(tabs)/index.tsx`:
  - Added a `Logout` button that calls `logOut()` from `authService`.
  - After logout, `onAuthStateChanged` fires and routing logic returns the user to the login screen.

### Key Behaviors to Remember

- **First load**:
  - App starts at `/` → `index.tsx` redirects to `/login`.
  - `RootLayout` listens to auth; while loading, shows a spinner.
  - If there is no user, the `login` screen is visible.
- **Sign up / Sign in**:
  - `LoginScreen` uses `authService` to create or sign in users.
  - On success, Firebase creates the user (visible under Authentication → Users in the console).
  - `onAuthStateChanged` fires; `RootLayout` sees a user and redirects to `/(tabs)`.
- **Logout**:
  - Pressing the `Logout` button calls `logOut()`.
  - `onAuthStateChanged` emits `null` for `user`, and `RootLayout` redirects back to `/login`.

### Login Screen Enhancements

- Added **Display Name field** to sign-up flow:
  - `LoginScreen.js` now includes `displayName` state and input field (shown only when `isSignUp` is true).
  - `authService.js` updated: `signUp(email, password, displayName)` accepts display name and calls `updateProfile(user, { displayName })` after account creation.
  - UI updated to match MyFitnessPal-style design: "Create Account" title, subtitle, labeled input fields with placeholders.
- Updated styling to match reference design with cleaner layout and better spacing.

### Tailwind / NativeWind Setup (PR 2)

- Installed `nativewind` and `tailwindcss` packages.
- Created `babel.config.js` with standard Expo preset (NativeWind v4 doesn't require Babel plugin).
- Updated `tailwind.config.js`:
  - Added content paths: `./app/**/*.{js,jsx,ts,tsx}` and `./components/**/*.{js,jsx,ts,tsx}`.
  - Added `nativewind/preset`.
- Created `global.css` with Tailwind directives (`@tailwind base/components/utilities`).
- Updated `app/_layout.tsx` to import `../global.css`.
- Created `app/test-tailwind.tsx` test screen to verify Tailwind classes work.
- Verified styles update on save and work correctly.

### Firebase Project Setup (PR 3)

- **Firestore Database:**
  - Added `getFirestore` import and `db` export to `components/firebaseConfig.js`.
  - Firestore collections created automatically on first write:
    - `conversations/{userId}` - one conversation per user.
    - `conversations/{userId}/messages/{messageId}` - messages subcollection.
  - Message fields: `role` ('user' | 'assistant'), `text`, `type` ('text' | 'image'), `imageUrl` (optional), `timestamp`.
- **Firebase Storage:**
  - Added `getStorage` import and `storage` export to `components/firebaseConfig.js`.
  - Storage structure: `images/{conversationId}/{timestamp}.jpg`.
- **Security Rules:**
  - Firestore rules: Users can only read/write their own conversations and messages.
  - Storage rules: Users can only upload/read images in their own conversation folder.

### Chat Screen Foundation (PR 5)

- Created `app/chat.tsx`:
  - Scrollable message list using `FlatList` (better performance than ScrollView).
  - Text input field with placeholder "Type a message...".
  - Send button (disabled when input is empty).
  - Styled user messages: blue background (`bg-blue-500`), white text, right-aligned.
  - Styled assistant messages: gray background (`bg-gray-200`), dark text, left-aligned.
  - Proper spacing and padding using Tailwind classes.
  - Empty state message when no messages exist.
  - `KeyboardAvoidingView` to prevent keyboard from covering input.
- Added chat route to `app/_layout.tsx` Stack with header title "Chat".
- Added "Open Chat" button to home screen (`app/(tabs)/index.tsx`) that navigates to `/chat`.

### Firestore Chat Data Model (PR 6)

- Created `components/chatService.js`:
  - `getOrCreateConversation()`: Gets or creates a conversation document per user (using `user.uid` as conversation ID).
  - `subscribeToMessages(conversationId, callback)`: Real-time listener for messages, ordered by timestamp ascending.
  - `sendMessage(conversationId, role, text)`: Writes text messages to Firestore with `type: 'text'`.
- Updated `app/chat.tsx`:
  - Replaced local state with Firestore data via `subscribeToMessages`.
  - Auto-scrolls to bottom when new messages arrive (`flatListRef.current?.scrollToEnd()`).
  - Shows loading state while initializing conversation.
  - Handles errors gracefully.

### Sending Text Messages (PR 7)

- **Client-side:**
  - Text input captured via `inputText` state and `TextInput` with `onChangeText={setInputText}`.
  - Send button disabled when input is empty (`disabled={!inputText.trim()}`).
  - Input cleared immediately after sending (`setInputText('')` at start of `handleSend`).
- **Firestore:**
  - `handleSend` calls `sendMessage(conversationId, 'user', textToSend)`.
  - Messages written with `role`, `text`, `type: 'text'`, and `timestamp: serverTimestamp()`.
  - Messages update automatically via Firestore listener (no manual state update needed).

### Image Capture & Upload (PR 8)

- **Dependencies:**
  - Added `expo-image-picker: ~17.0.10` to `package.json`.
  - Added `expo-image-picker` plugin to `app.json` with `photosPermission` message.
- **Firebase Storage:**
  - Added `getStorage` and `storage` export to `components/firebaseConfig.js`.
  - Created `uploadImageAndSendMessage(conversationId, role, uri)` in `chatService.js`:
    - Uploads image blob to Storage at `images/{conversationId}/{timestamp}.jpg`.
    - Gets download URL via `getDownloadURL`.
    - Creates Firestore message with `type: 'image'`, `imageUrl`, `text: ''`, `timestamp`.
- **Client Implementation (`app/chat.tsx`):**
  - `requestMediaPermission()`: Requests media library permissions via `ImagePicker.requestMediaLibraryPermissionsAsync()`.
  - `handlePickImage()`: Opens photo library via `ImagePicker.launchImageLibraryAsync()` (allows editing, quality 0.8).
  - Image button (camera icon 📷) added next to text input.
  - Preview flow: After picking image, shows thumbnail preview with "Cancel" and "Send photo" buttons.
  - `handleSendImage()`: Uploads image and creates message, shows "Uploading..." state.
  - `renderMessage()`: Renders image messages using `expo-image` `<Image>` component (200x200, rounded corners) when `message.type === 'image'` and `message.imageUrl` exists.

### UI Updates

- **Home Screen Restyling:**
  - Removed `ParallaxScrollView` and background image (React logo).
  - Removed all three "Step" sections (Step 1, Step 2, Step 3).
  - New clean design matching MyFitnessPal-style:
    - White background with centered card.
    - "Welcome" title and subtitle.
    - Single "Open Chat" button (blue, full-width).
    - Subtle shadow and border on card.
- **Tab Header:**
  - Updated `app/(tabs)/_layout.tsx`:
    - Blue header background (`#007AFF`).
    - White header text and "Log out" button.
    - Removed duplicate logout button from home screen (now only in header).

### Git Repository Setup

- Initialized Git repository (`git init`).
- Created GitHub repository and connected via `git remote add origin`.
- Pushed initial commit with Firebase auth and Tailwind setup.
- Created helper scripts:
  - `scripts/kill-ports.ps1` - PowerShell script to kill Node processes.
  - `scripts/kill-ports.cmd` - Batch file to kill Node processes.

### Session: Resuming Project & PR 9 (Cloud Functions)

- **Getting started (returning to project):**
  - Commands: `npm install` then `npx expo start` (or `npm start`).
  - Press `a` / `i` / `w` in the **same terminal** where Expo is running (no `$`); scan QR with Expo Go on phone.

- **Chat: messages from yesterday still visible:**
  - Messages persist in **Firebase Firestore** (one conversation per user). We kept that for chronological history/reporting.
  - Chat UI now shows only **this session**: messages with `timestamp >= sessionStart` when you open the Chat tab. Old messages stay in Firestore but don’t appear in the list. Removed the “Clear chat” button that deleted messages.

- **PR 9 — Cloud Functions setup:**
  - Added `firebase.json` (functions source + predeploy) and `.firebaserc` (project `calorie-app-chat`).
  - Created `functions/` with TypeScript: `package.json` (Node 20, firebase-admin, firebase-functions), `tsconfig.json` (moduleResolution: node), `src/index.ts` with HTTP `testFunction` (v1 API: `functions.https.onRequest`).
  - Predeploy: `cd functions && npm install && npm run build` so the build runs inside `functions/` and finds `firebase-functions`. Node runtime set to **20** (Node 18 decommissioned).
  - **CLI:** Don’t type `$` from docs (it’s the prompt). Use `npx firebase` if `firebase` isn’t in PATH. Login: `npx firebase login --no-localhost` → open URL in browser, sign in, then paste the **authorization code from the webpage** (not the session ID) into the terminal.
  - Deploy: `npx firebase deploy --only functions` from project root. When asked how many days to keep container images, Enter = 1 day.
  - Added `functions/lib/` to `.gitignore`.

- **Security (CVE-2025-55182):**
  - Console recommended updating React/Next.js. Project uses **React 19.1.2** (patched). Run `npm install` so dependencies match. Redeploy only if you deploy the app somewhere (e.g. Hosting); for local Expo, just run the app after `npm install`.

- **Redeploy / Hosting:**
  - Redeploy steps: `npm install`; for Expo locally, run `npx expo start` (no server deploy). For Firebase Hosting you’d add a `hosting` section to `firebase.json` and run `npx expo export --platform web` then `npx firebase deploy --only hosting` — not set up yet, so `npx firebase deploy --only hosting` correctly errors with “No targets match '--only hosting'”.

### Session: PR 10 — Image Recognition Pipeline (Trigger + Resize)

- **React version mismatch (Expo start):**
  - Error: "react and react-native-renderer must have the exact same version" (react 19.1.2 vs renderer 19.1.0).
  - Fix: Pinned `react` and `react-dom` to **19.1.0** in `package.json`. Run `npm install` then `npx expo start --clear`.

- **Metro: react-dom/client not found:**
  - Error: "react-dom/client could not be found within the project or in node_modules."
  - Fix: Added `metro.config.js` with a custom `resolveRequest` that resolves `'react-dom/client'` to `node_modules/react-dom/client.js` (so Metro finds the subpath export).

- **PR 10 — Trigger on image upload:**
  - Cloud Function **`onImageMessageCreated`** (Firestore v2): triggers on `conversations/{conversationId}/messages/{messageId}` when a new document is created.
  - Only runs when the message has `type === 'image'` and `imageUrl`. Logs "Image message created" with conversationId, messageId, imageUrl.
  - Uses `firebase-admin` and `onDocumentCreated` from `firebase-functions/v2/firestore`.

- **PR 10 — Step 1: Resize image:**
  - Added **`sharp`** to `functions/package.json`.
  - **`downloadAndResizeImage(imageUrl)`** in `functions/src/index.ts`:
    - Fetches image from `imageUrl` (Storage download URL).
    - Resizes with sharp: max 1024px on longest side, `fit: "inside"`, no upscale, JPEG quality 85.
    - Returns `{ buffer, width, height }` or `null` on failure. Logs "Image resized" with original/resized dimensions and sizeBytes.
  - Function calls this after detecting an image message; on success logs "Resized image ready for vision" (resized buffer is ready for Step 2 — send to vision model).
  - **`functions/tsconfig.json`:** Added `esModuleInterop: true` so `import sharp from "sharp"` works with sharp’s `export =` declaration.

- **Intentional scope (no code after “send image to vision model”):**
  - No assistant message is written to Firestore (no "Image received and resized…" or "Could not process image…" in chat).
  - No parse, description, or confidence score. Pipeline stops at: trigger → download → resize → log. Next step is to implement **Step 2: Send image to vision model**, then parse and Firestore message/confidence.

- **Firebase deploy / IAM:**
  - If deploy fails with "We failed to modify the IAM policy", run the three `gcloud projects add-iam-policy-binding calorie-app-chat …` commands (as project owner) from the error output, then `npx firebase deploy --only functions` again.
  - Deploy: from project root, `npx firebase deploy --only functions` (use a space: `npx firebase`, not `npxfirebase`).

- **Stopping point (earlier):**
  - PR 10 backend: trigger on image upload ✓; resize image ✓; send to vision model (not yet); parse detected foods (not yet). Firestore: no assistant message or confidence until vision is implemented.

### Session: PR 10 Completed — Vision + Calorie Estimate

- **Gemini 404 fix:**
  - Error: `models/gemini-1.5-flash is not found for API version v1beta`. Model was deprecated/renamed.
  - Updated `functions/src/index.ts`: `GEMINI_MODEL` changed from `gemini-1.5-flash` to **`gemini-2.5-flash`** (current supported model for generateContent + images). Redeploy: `npx firebase deploy --only functions`.

- **Vision prompt and parsing:**
  - **Prompt:** Asks Gemini to (1) list foods in a comma-separated list and (2) on the next line write `Estimated total calories: N` for the whole meal.
  - **Parsing:** `parseVisionResponse(description)` returns `{ foodList, foods, estimatedCalories }`. First line = food list; regex extracts calorie number from "Estimated total calories: N" or "calories: N" (valid range 1–9999).

- **Assistant message and Firestore:**
  - Message text: `I see: {foods}. Estimated calories for this meal: {N}` when both are present; otherwise food list only or description + calories.
  - Firestore assistant message fields: `role`, `type: 'text'`, `text`, `foodDescription`, `foodItems`, `confidenceScore`, `estimatedCalories` (when parsed), `timestamp`.

- **Where we left off:**
  - **PR 10 is complete:** Trigger on image upload ✓, resize ✓, send to Gemini vision ✓, parse foods + calories ✓, create assistant message with description and confidence ✓, save estimatedCalories ✓.
  - **Next:** PR 11 — LLM description confirmation flow (“Does this match your meal?” + Yes/No).

### Session: PR 11 & PR 12 — Confirmation Flow, Meal Logging, Meals Tab

- **PR 11 — Option B (two messages + Yes/No):** Backend adds a second assistant message with `type: 'confirmation'`, "Does this description match your meal?", plus `linkedVisionMessageId`, `linkedImageMessageId`, `foodItems`, `estimatedCalories`. Client shows Yes/No buttons for confirmation messages; they hide after the user replies. PR 11 checked off in to-dos.md.
- **PR 12 — Meal logging on "Yes":** New trigger `onMessageCreated` creates a `meals` document and an assistant "Meal logged. X calories (P …g · C …g · F …g)" message. Macros from `estimateMacrosFromCalories`. Duplicate green card removed; only bubble text shown. PR 12 checked off.
- **Meals tab:** New tab and screen `app/(tabs)/meals.tsx`; `subscribeToMeals(callback, onError)` in chatService.js (query by userId only, sort by createdAt in memory; error callback so tab does not load forever). Meals collection is top-level `meals` in Firestore.
- **Deploy:** PowerShell: `npx firebase deploy --only "functions,firestore:indexes"` (quoted). "Operation already in progress" → wait 2–3 min and retry. Messages index removed (not necessary); meals query avoids composite index.

### Session: PR 13 — Voice Input & UI Updates

- **Expo Go (no paid Apple Developer):** Staying on Expo Go for development. Use `npx expo start` (or `npx expo start --clear`). Scan QR code with Expo Go on phone. For EAS: use `npx eas` (not `eas`) if CLI not in PATH.

- **PR 13 — Voice input completed:**
  - Microphone button in chat (next to camera); expo-av for recording; Cloud Function `transcribeAudio` (M4A→FLAC via ffmpeg, Google Speech-to-Text).
  - Storage rules for `audio/` path; deploy: `npx firebase deploy --only storage` from **project root**.
  - `onTextMealMessageCreated` Cloud Function: when user sends a meal description (text or voice transcript), Gemini parses it and adds confirmation flow (same as image upload).

- **Chat UI — StyleSheet instead of Tailwind:**
  - NativeWind/Tailwind classes were not applying (elements stacked vertically instead of horizontal row). Replaced input bar with React Native **StyleSheet** so layout works reliably: `flexDirection: 'row'`, `gap: 16`, camera | mic | text input | Send in one row.

- **Light blue color theme:**
  - Added `AppColors` in `constants/theme.ts` (`#E6F4FE` background, matching Android icon).
  - Updated: Login, Home, Chat, Meals, tab bar, Chat header, splash screen.
  - `app.json`: `userInterfaceStyle: "light"` (avoids black on iPhone in dark mode).

### Commands to Get Started (Returning to Project)

From the **project root** (`Cal-tracking-app`):

```bash
# 1. Install app dependencies (if needed)
npm install

# 2. Start Expo dev server
npx expo start
# Or with cache clear if things look stale:
npx expo start --clear
```

Then press `r` in the terminal to reload, or scan the QR code with Expo Go.

**If you changed Cloud Functions:**

```bash
cd functions
npm install
npm run build
cd ..
npx firebase deploy --only functions
```

**If you changed Storage rules:**

```bash
npx firebase deploy --only storage
```

**If you changed Firestore rules:**

```bash
npx firebase deploy --only firestore
```

### Session: Firestore Permissions, Chat UI & Mobile Layout (Today)

- **Firestore "Missing or insufficient permissions" fix:**
  - Chat failed to load with `FirebaseError: Missing or insufficient permissions`.
  - Created `firestore.rules` with rules for `conversations`, `messages`, and `meals`.
  - Updated `firebase.json` to include `"rules": "firestore.rules"`.
  - Deploy: `npx firebase deploy --only firestore`.

- **Yes/No confirmation buttons:**
  - Styled as distinct buttons with spacing (`gap: 16`), larger padding, `minWidth: 80`.
  - No button color: `#ebe46a` (user-selected yellow).
  - Added `activeOpacity` for press feedback.

- **Navigation — Chat in tabs:**
  - Moved Chat from root Stack into `(tabs)` so the tab bar (Home | Chat | Meals) stays visible below chat.
  - Created `app/(tabs)/chat.tsx`, removed `app/chat.tsx`.
  - Added Chat tab with chat icon; hid Explore tab.
  - "Open Chat" now switches to Chat tab via `router.replace('/(tabs)/chat')`.

- **Centered layout (desktop & mobile):**
  - Messages, images, and photo preview centered.
  - Switched to StyleSheet (no NativeWind) for consistent centering.
  - `useWindowDimensions()` for responsive widths; `messageRow` with explicit `width: screenWidth` and `alignItems: 'center'`.
  - Image wrapper with centering; photo preview section centered.

- **Yes/No button horizontal fix:**
  - Message bubble `minWidth: 72` and `numberOfLines={1}` to prevent "Yes"/"No" text wrapping vertically.
  - Confirmation buttons use fixed width, `flexShrink: 0`.

- **Mobile UI improvements:**
  - **User vs assistant:** Labels "You" and "Assistant" above bubbles; user = blue (`#007AFF`), assistant = white with gray border.
  - **Spacing:** Increased `marginBottom` to 24, more padding, `lineHeight: 24`.
  - **Yes/No buttons:** Larger touch targets (`minHeight: 48`), shadows/elevation, `hitSlop`, `flexShrink: 0`.
  - **Image centering:** `imageWrapper` with `alignItems: 'center'`.
  - **Fallback for confirmation:** Buttons show when text includes "Does this description match your meal?" even if `type` is missing.

- **Key files changed:**
  - `firestore.rules`, `firebase.json`, `app/(tabs)/chat.tsx`, `app/(tabs)/_layout.tsx`, `app/_layout.tsx`, `app/(tabs)/index.tsx`, `components/ui/icon-symbol.tsx`.

### Session: PR 14 — Voice-Based Corrections Flow

- **Backend (functions/src/index.ts):**
  - Added `GEMINI_CORRECTION_PROMPT` and `sendCorrectionToGemini()` to send correction text + original meal context (foodItems, estimatedCalories) to LLM.
  - Updated `onTextMealMessageCreated`: returns early for "No"; detects correction context when previous message is user "No" and message before that is confirmation.
  - Correction flow: queries recent messages, gets original meal data, calls `sendCorrectionToGemini`, parses updated meal with `parseVisionResponse`, recalculates calories/macros, adds updated description + new confirmation message.
- **Client (app/(tabs)/chat.tsx):**
  - Added `processingCorrection` state. Set when user sends a message and last message was "No"; cleared when assistant replies.
  - Placeholder shows "Processing correction…" during correction processing; input/buttons disabled.
- **Transcribed text as message:** Already implemented (voice transcript sent via `sendMessage` in handleStopRecording).

### Session: PR 15 — Update Meal After Corrections (Backend)

- **Update meal document:** Meal now includes `confirmationMessageId` to link to the confirmation message.
- **Store original + updated values:** When meal was created after a correction flow, we query message history to find the original confirmation (before user said No) and store `originalFoodItems` and `originalEstimatedCalories` on the meal document.
- **Prevent duplicate logs:** Before creating a meal, we query for an existing meal with the same `userId` and `confirmationMessageId`. If found, we skip and return (idempotent for double-tap or retries).
- Added composite Firestore index on `meals` (userId, confirmationMessageId) for the duplicate check.

### Session: PR 15 — Update Meal After Corrections (Client)

- **Update displayed nutrition values:** Chat now renders meal-logged messages with a styled card showing "Meal logged", calories, and macros (P, C, F) in a clear layout. Meals tab shows nutrition (cal, P, C, F) with improved typography and spacing.
- **Show confirmation message:** Meal-logged messages in chat display a green success card with structured nutrition instead of plain text.

### Session: PR 16 — Manual Text Corrections (Fallback)

- **Allow typed corrections:** User can type corrections in the text input after saying No; same backend path as voice. Placeholder shows "Type or speak your correction..." when waiting for a correction.
- **Reuse voice correction logic:** Typed and voice corrections both use sendMessage → onTextMealMessageCreated; no separate flow needed.
- **Display updated macros inline:** Backend adds macros and isCorrectionUpdate to correction response. Client renders "Updated" messages as a structured card with food items and nutrition (cal, P, C, F) inline.

### Session: PR 17 — Meal History & Daily Summary

- **Backend (chatService.js):**
  - Added `getMealDateKey(timestamp)` — converts Firestore timestamp to YYYY-MM-DD.
  - Added `getTodayDateKey()` — returns today's date as YYYY-MM-DD.
  - Added `calculateDailyTotals(meals)` — sums calories and macros from an array of meals.
  - Added `groupMealsByDate(meals)` — groups meals by date, returns Map sorted descending.
  - Added `formatDateKeyForDisplay(dateKey)` — returns "Today", "Yesterday", or formatted date.
- **Client (app/(tabs)/meals.tsx):**
  - Replaced FlatList with SectionList for grouped-by-date display.
  - Added "Today" summary card at top showing total calories and macros (P, C, F).
  - Section headers show date ("Today", "Yesterday", etc.) with daily totals.
  - Meals within each section show time instead of full date.
  - Shows "No meals logged today" when today has no meals.

### Session: Calorie Target, Onboarding, Goals, Home UI & Calories Burned (Today)

- **to-dos.md:** Moved the "To-Do List: Calorie Target Calculation" block so it appears before PR 18 (not before PR 19). Phase 1–3 items checked off where implemented.

- **Phase 1 — UserProfile & activity levels:**
  - Created `types/userProfile.ts`: `UserProfile`, `Gender`, `UserProfileInput`.
  - Created `constants/activityLevels.ts`: `ACTIVITY_LEVEL_MULTIPLIERS`, `ACTIVITY_LEVEL_LABELS`, `ActivityLevelId`.

- **Phase 2 — BMR & daily target:**
  - Created `utils/calorieTarget.ts`: `calculateBMR()` (Mifflin–St Jeor), `calculateTDEE()`, `calculateDailyTarget()`, `getWeightProgress()`, `isCalorieTargetBelowSafe()`, `MIN_DAILY_CALORIES_FEMALE`/`MALE`.

- **Phase 3 — Onboarding, safety, dashboard:**
  - **Profile service:** `components/userProfileService.ts` — `getProfile`, `subscribeToProfile`, `setProfile`, `profileNeedsGoals`; Firestore `userProfiles/{userId}`; payloads sanitized with `withoutUndefined`.
  - **Firestore:** `firestore.rules` — read/write for `userProfiles/{userId}` (user can only access own profile).
  - **Onboarding:** `app/(tabs)/onboarding.tsx` (hidden from tab bar via `href: null`). Three steps: metrics, activity level, goal; safety alert if target &lt; 1200/1500; Finish saves profile and navigates to home. Root layout sends new users (no profile) to `(tabs)/onboarding`.
  - **Goals screen:** `app/(tabs)/goals.tsx`; added Goals tab (flag icon). For users with profile but no goals (`dailyCalorieDelta === undefined`), root layout sends to Goals; "Skip for now" sets `dailyCalorieDelta: 0` and navigates to home.
  - **Root layout:** `app/_layout.tsx` — after login, redirect by profile state (no profile → onboarding; profile but no goals → goals; else home). **Native (Expo Go):** paths without leading slash (`login`, `(tabs)`, `(tabs)/onboarding`, `(tabs)/goals`). **Web:** leading slash where needed (`/(tabs)` etc.).

- **Navigation & routing fixes:**
  - Finish button: save worked but screen didn’t change — fixed by moving onboarding into `(tabs)` and improving redirect logic; web "Unmatched route" fixed with `/(tabs)` instead of `/(tabs)/index`.
  - Expo Go "Unmatched route" on login and after login — fixed by using paths **without leading slash** on native: `login`, `(tabs)`, `(tabs)/onboarding`, `(tabs)/goals`.
  - `app/index.tsx`: redirect to `login` (no leading slash). All `router.replace`/`router.navigate` to tabs use native-friendly paths on mobile.

- **Login screen:** `components/LoginScreen.js` — ImageBackground with `landing-screen-background.jpg`, overlay, title "Welcome to the CalApp", Login and Sign up buttons; tapping one shows the form; Back returns to welcome.

- **Home screen:** `app/(tabs)/index.tsx`:
  - **Web:** `CalorieRing` (View-based circular progress) for remaining, goal, eaten.
  - **Mobile:** `CalorieBar` (horizontal bar) — ring was unreliable on native.
  - **Calories Remaining** card: Target − Eaten + Burned. Safety banner if target below min.
  - **Calories Burned:** Editable number input; value kept in **in-memory state only** (no persistence across restarts). Used in remaining calculation.

- **AsyncStorage error fix:** "Unable to resolve module @react-native-async-storage/async-storage" — package was not installed. Removed AsyncStorage usage; calories burned is in-memory only so the app runs without the package. Optional later: install `@react-native-async-storage/async-storage` and persist by date (e.g. `caloriesBurned_YYYY-MM-DD`) if desired.

- **Key files:** `to-dos.md`, `types/userProfile.ts`, `constants/activityLevels.ts`, `constants/theme.ts`, `firestore.rules`, `utils/calorieTarget.ts`, `components/userProfileService.ts`, `app/_layout.tsx`, `app/index.tsx`, `app/login.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/onboarding.tsx`, `app/(tabs)/goals.tsx`, `components/LoginScreen.js`, `components/ui/icon-symbol.tsx` (added `flag.fill` for Goals).

### Session: PR 18 — Error Handling & onImageMessageCreated Fix (In Progress)

- **Context:** Project path had apostrophe (`Chris's Home`), causing PowerShell/terminal failures when running scripts. User is moving project to a new location without the apostrophe.
- **PR 18 — Client-side:** Error boundaries, user-facing error messages, image/voice failure handling, retries, loading spinners, double-tap prevention — done.
- **PR 18 — Backend:** try/catch added to `transcribeAudio`, `onTextMealMessageCreated`, `onMessageCreated`. `onImageMessageCreated` still has a bug.
- **onImageMessageCreated bug (functions/src/index.ts, ~lines 413–470):**
  - **Partially fixed:** visionMsgRef content was changed from wrong error text to correct fields (`messageParts.join(" ")`, `foodDescription`, `foodItems`, etc.).
  - **Line 420 syntax error:** Malformed line — `}),'timestamp:` is merged with the previous line. Needs to be split so `timestamp:` starts on the next line.
  - **Duplicate block:** Wrong `await messagesRef.add` (error message) + `return;` + orphan `}` + duplicate `description`, `messageParts`, `logger.info`, `visionMsgRef`, `imageMessageId` — needs removal. Correct flow: visionMsgRef → imageMessageId → confirmation add.
- **Fix script ready:** `fix-onImageMessageCreated.js` (run via `npm run fix-functions`) fixes both the malformed line and removes the duplicate block. Script uses regex to handle curly apostrophe (U+2019).
- **Next steps after project move:**
  1. Run `npm run fix-functions` from project root.
  2. Run `cd functions && npm run build` to verify.
  3. Deploy: `npx firebase deploy --only functions`.
  4. Check off PR 18 backend in `to-dos.md`.
- **Reference:** `FUNCTIONS_FIX.md` has manual fix instructions if the script fails.

### Remaining / Future Tasks

- Follow `to-dos.md` and `PRD.md` to build out:
  - ~~PR 10: Send image to vision model, parse foods, assistant message with description, confidence score.~~ **Done.**
  - ~~LLM description confirmation flow (PR 11).~~ **Done.**
  - ~~Meal logging on confirmation (PR 12).~~ **Done.**
  - ~~Voice input setup (PR 13).~~ **Done.**
  - ~~Voice-based corrections flow (PR 14).~~ **Done.**
  - ~~Update meal after corrections (PR 15).~~ **Done.**
  - ~~Manual text corrections (PR 16).~~ **Done.**
  - ~~Meal history & daily summary (PR 17).~~ **Done.**
  - Calorie target calculation (Phase 1–3): UserProfile, BMR, onboarding, Goals, home dashboard — **Done.**
  - ~~Error handling (PR 18).~~ **Done** (client + backend; `onImageMessageCreated` fixed).
  - ~~Onboarding & help (PR 19).~~ **Done:** feature tour (`app/feature-tour.tsx` + AsyncStorage), Chat help modal + example chips, Settings tab (user info, logout, reset/show tour).

### Session: PR 19 — Onboarding & Help

- **Feature tour (first launch):** `app/feature-tour.tsx` — 4 slides (chat, photo/voice, confirm, home/meals). `Skip` and `Next` / `Get started`. Persists with AsyncStorage (`@calapp_has_seen_feature_tour_v1`). Shown after login when profile + goals are complete, and on cold start if flag not set. Stack route `feature-tour` in `app/_layout.tsx`.
- **Storage:** `components/featureTourStorage.ts`, `constants/storageKeys.ts`. Dependency: `@react-native-async-storage/async-storage` (run `npm install`).
- **Settings tab:** `app/(tabs)/settings.tsx` — email, display name; reset welcome tour (next launch); show tour now; **Log out**. Global header “Log out” removed from tabs.
- **Chat:** Header `?` → `components/ChatHelpModal.tsx`. Empty chat shows “Try an example” horizontal chips (`constants/examplePrompts.ts`).
- **Icons:** `gearshape.fill` → settings, `questionmark.circle` → help-outline in `icon-symbol.tsx`.

### Session: Post-PR 19 — Polish, Deployment & Features

- **PR 18 backend fix:** Fixed `onImageMessageCreated` in `functions/src/index.ts` — malformed line (curly apostrophe before `timestamp`), removed duplicate block with wrong `visionMsgRef` and orphan logic. `messageParts.join(" ")` now used correctly.

- **Settings — Editable display name:** Added `updateDisplayName()` in `components/authService.js` (Firebase `updateProfile`). Settings tab shows inline edit: "Change" link → TextInput with Cancel/Save. UI refreshes via `onAuthStateChanged`.

- **Goals — Manual calorie entry:** Custom TextInput "Or enter manually (kcal)" with placeholder "-500 to lose, +500 to gain". Parsed value overrides preset when valid. `buildInput()` uses custom value when present.

- **Chat — Icon colors:** Mic and camera buttons use `AppColors.primary` (teal) to match send button. Send button disabled state uses teal with 50% opacity (no gray). User message bubbles and "You" label changed from blue (`#007AFF`) to teal.

- **Home — Circular calorie graph:** Added `react-native-svg` (v15.11.2). `CalorieRing` with `Svg` and `Circle` — track `#ca8a04` (warm amber), progress teal (`AppColors.primary`), over-goal amber (`AppColors.fat`). 160px ring, 12px stroke, progress from 12 o'clock. Used on both web and mobile; `CalorieBar` removed.

- **Deployment:** Created `DEPLOYMENT.md` (step-by-step Vercel + Firebase guide) and `vercel.json` (build command, output dir). Firebase: add Vercel domain to Auth authorized domains. Functions: `firebase functions:secrets:set GEMINI_API_KEY`, `firebase deploy --only functions`.

- **Email verification:** `signUp` calls `sendEmailVerification()` after account creation. `app/verify-email.tsx` — link-based verification (Firebase), **Resend**, **I've verified my email** (`reloadCurrentUser`: `reload` + `getIdToken(true)`), background poll every 30s while screen focused, sign-out. `subscribeToAuthChanges` uses `onAuthStateChanged` and `onIdTokenChanged` so the app picks up `emailVerified` after reload. Root layout: unverified users are sent to `verify-email` from any route, and onboarding/goals/feature-tour/(tabs) redirects **do not run** until `emailVerified` (fixes premature onboarding). LoginScreen: client `isValidEmail` + trimmed email; no success alert on sign up (verify screen explains next step); sign-in still shows "Logged in!".

- **Metric / Standard units:** Added `useUnits` to `UserProfile` ('metric' | 'standard', default 'standard'). `utils/unitConversions.ts` — kg↔lb, cm↔ft+in. Goals and onboarding: toggle for Standard (lbs, ft/in) or Metric (kg, cm). Weight, height, target weight inputs and DEFICIT_OPTIONS labels update by unit. Daily calorie change presets: "Lose ~1 lb/week" vs "Lose ~0.5 kg/week". Preference saved to profile.

- **Chat — Text visibility:** Assistant message bubble uses `AppColors.card` (dark) with `AppColors.text` (white). Text input field: `color: AppColors.text` so typed text is readable on dark background.

- **Chat — Try an example dropdown:** "Try an example" is a collapsible header. Tapping toggles expanded/collapsed. Chevron rotates 90° when expanded. Default expanded. State: `examplesExpanded`.

- **Chat — Assistant name:** Renamed label from "Assistant" to "Cally" above assistant message bubbles.

- **Chat — Yes/No confirmation colors:** Yes button uses `AppColors.primary` (teal). No button uses `rgb(227, 0, 0)`.
