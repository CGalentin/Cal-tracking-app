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

### Remaining / Future Tasks

- Follow `to-dos.md` and `PRD.md` to build out:
  - Image recognition pipeline (PR 10).
  - LLM description confirmation flow (PR 11).
  - Meal logging on confirmation (PR 12).
  - Voice input setup (PR 13).
  - Voice-based corrections flow (PR 14).
  - Update meal after corrections (PR 15).
  - Manual text corrections (PR 16).
  - Meal history & daily summary (PR 17).
  - Error handling (PR 18).
  - Onboarding & help (PR 19).
