# Email, auth, and meal-edit work (trimmed to current tree)

This file lists behavior and files that **exist in the repository now** (verified by search/read). It replaces earlier narrative about features that were reverted or never merged.

---

## Email verification and auth flow

| What | Where |
|------|--------|
| Unverified users (after sign-up flag) go to **verify-email**; onboarding / tabs / feature tour redirects do not run until verified | `app/_layout.tsx` (`needsVerification`, `router.replace('verify-email')`, early return before profile routing) |
| Live `auth.currentUser` used for `emailVerified` so UI does not stay stuck after `reload()` | `app/_layout.tsx` |
| **Trim + format check** on email before sign-in / sign-up | `components/LoginScreen.js` (`emailTrimmed`, `isValidEmail`) |
| **Verify-email:** `reloadCurrentUser()`, **Continue** handler, **30s polling** on focus | `app/verify-email.tsx` |
| **`reloadCurrentUser`** export | `components/authService.js` |

---

## Meals and chat (editing logged meals)

| What | Where |
|------|--------|
| **`[meal-edit:{mealId}]`** prefix on user messages → `applyLoggedMealCorrection` updates `meals/{mealId}` via Admin | `functions/src/index.ts` (`onTextMealMessageCreated`, `applyLoggedMealCorrection`) |
| **Implicit correction** after a logged meal: `IMPLICIT_LOGGED_MEAL_CORRECTION` regex on follow-up text | `functions/src/index.ts` |
| **Correction after “No”** to confirmation (image flow) | `functions/src/index.ts` |
| **Meals UI:** **Edit** → `/(tabs)/chat?mealEdit=…` | `app/(tabs)/meals.tsx` |
| **Chat:** `mealEdit` query param, banner, prefix messages with `[meal-edit:id]` | `app/(tabs)/chat.tsx` |
| **No Delete** on Meals screen | `app/(tabs)/meals.tsx` (no delete UI) |

---

## Cloud Functions: Gemini (as implemented today)

| What | Where |
|------|--------|
| Model **`gemini-2.5-flash`** for vision, text meals, corrections | `functions/src/index.ts` (`GEMINI_MODEL`) |
| Responses read from **`candidates[0].content.parts[0].text`** (single part) | `sendImageToVisionModel`, `sendTextToGemini`, `sendCorrectionToGemini` |
| **Not** in tree: multi-part concatenation, `thought` skipping, `thinkingConfig` / `thinkingBudget`, `gemini-2.0` fallback, or user-text sanitization / `createTime` timestamp fallback on text messages |

Text handler **returns early** if `data.timestamp` is missing (`onTextMealMessageCreated`).

---

## Home dashboard UI

| What | Where |
|------|--------|
| **Goal** and **Eaten** row **below** the ring (`goalEatenBlock`), **bold** (`fontWeight` 800 / 700) | `app/(tabs)/index.tsx` (`CalorieRing`) |

---

## Chat: burn reminder

| What | Where |
|------|--------|
| After a meal is logged, optional **“Log calories burned?”** bubble with **Open Home** | `app/(tabs)/chat.tsx` |
| **Open Home** uses **`navigation.dispatch(TabActions.jumpTo('index'))`** (switch Home tab without `router.replace` hrefs) | `goToHomeForBurnedCalories` in `app/(tabs)/chat.tsx` |

On **static web** (`expo export`), paths like **`/(tabs)`** are not real browser routes (route groups are stripped), so **`router.replace('/(tabs)')`** triggers Expo’s **Unmatched Route** screen. **`TabActions.jumpTo`** updates state and the URL correctly.

---

## Profile subscription (web auth race)

| What | Where |
|------|--------|
| **`subscribeToProfile`** waits on **`onAuthStateChanged`**, then **`onSnapshot`** on `userProfiles/{uid}` | `components/userProfileService.ts` |

---

## Feature tour (current behavior)

| What | Where |
|------|--------|
| Second `useEffect` only triggers feature tour replace when the user is on the **Home tab** (`(tabs)` + `index` or default), so other tabs are not replaced on load | `app/_layout.tsx` (comment + `isHomeTab` check) |

---

## Goals tab (present in tree)

| What | Where |
|------|--------|
| **`profileReady`** + **`subscribeToProfile`** before treating profile as loaded | `app/(tabs)/goals.tsx` |

---

## Deploy

Cloud Functions changes need **`firebase deploy --only functions`** and the **`GEMINI_API_KEY`** secret for Gemini-backed flows.
