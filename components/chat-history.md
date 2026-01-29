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

### Remaining / Future Tasks

- Optionally add a **name field** to the login/sign-up flow:
  - Extend `LoginScreen` with a `name` input when `isSignUp` is true.
  - After `createUserWithEmailAndPassword`, update the user profile with `updateProfile(user, { displayName: name })`, or store the name in Firestore.
- Follow `to-dos.md` and `PRD.md` to build out:
  - Chat interface.
  - Image upload and AI meal interpretation.
  - Meal logging, history, and summaries.
