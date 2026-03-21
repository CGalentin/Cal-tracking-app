# Step-by-Step Deployment Guide

This guide walks you through deploying the Cal-tracking app to **Vercel** (web) and configuring **Firebase** so everything works together.

> **Note:** A `vercel.json` file is already in your project with the correct build settings. Vercel will use it automatically when you deploy.

---

## Part 1: Prepare Firebase (Do This First)

Your app uses Firebase for auth, Firestore, and storage. You need to authorize your Vercel domain so users can sign in.

### Step 1.1: Get your Vercel URL (or use a placeholder for now)

- Your first deployment will give you a URL like `your-project.vercel.app`
- You'll add this to Firebase in Step 1.3

### Step 1.2: Open Firebase Console

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Select your project: **calorie-app-chat**

### Step 1.3: Add Authorized Domain for Auth

1. In the left sidebar, click **Build** → **Authentication**
2. Click the **Settings** tab (gear icon)
3. Scroll to **Authorized domains**
4. Click **Add domain**
5. Enter: `your-project.vercel.app` (replace with your actual Vercel URL after first deploy)
6. Click **Add**

> **Tip:** `localhost` is already there for local testing. You can add your Vercel domain before or right after your first deploy.

---

## Part 2: Export the Web App Locally

### Step 2.1: Open a terminal in your project folder

Make sure you're in the project root (where `package.json` lives).

### Step 2.2: Install dependencies (if you haven't recently)

```bash
npm install
```

### Step 2.3: Export the static web build

```bash
npx expo export -p web
```

This creates a `dist` folder with your built app. You should see output like:

```
✔ Bundled successfully
✔ Exported static files to dist/
```

---

## Part 3: Deploy to Vercel

### Step 3.1: Install Vercel CLI (one-time)

```bash
npm install -g vercel
```

### Step 3.2: Log in to Vercel

```bash
vercel login
```

Follow the prompts to log in (email, GitHub, etc.).

### Step 3.3: Deploy from the project folder

From your project root:

```bash
vercel
```

**First-time prompts:** Answer the questions (usually: Yes to set up, select your account, name the project, press Enter for defaults). Your `vercel.json` already specifies the build command and output directory, so Vercel will use those.

### Step 3.4: Deploy to production

For your first deploy, `vercel` may deploy to a preview URL. To promote it to production:

```bash
vercel --prod
```

**Alternative:** Push your code to GitHub, then connect the repo in the [Vercel dashboard](https://vercel.com/new) for automatic deploys on every push.

### Step 3.5: Get your live URL

After deploy, Vercel shows a URL like:

```
https://cal-tracking-app-xxxx.vercel.app
```

**Go back to Firebase** (Part 1.3) and add this exact domain to **Authorized domains** if you used a placeholder earlier.

---

## Part 4: Firebase Functions (Optional but Recommended)

Your chat AI runs on Firebase Cloud Functions. Deploy them so the app works fully in production.

### Step 4.1: Install Firebase CLI (one-time)

```bash
npm install -g firebase-tools
```

### Step 4.2: Log in to Firebase

```bash
firebase login
```

### Step 4.3: Set the Gemini API key (required for chat/vision)

Your app uses Google's Gemini API for meal descriptions. You need to add the API key as a secret:

1. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. From your project root, run:
   ```bash
   firebase functions:secrets:set GEMINI_API_KEY
   ```
3. When prompted, paste your API key and press Enter

### Step 4.4: Deploy functions

From your project root (where `firebase.json` is):

```bash
firebase deploy --only functions
```

Firebase will automatically install dependencies and build the functions. This may take a few minutes.

---

## Part 5: Verify Everything Works

1. Open your Vercel URL in a browser
2. Try signing in (email/password or your auth method)
3. Send a chat message and confirm the AI responds
4. Log a meal with a photo

If auth fails, double-check:
- Firebase → Authentication → Authorized domains includes your Vercel URL
- No typos in the domain

---

## Quick Reference

| Step | Command |
|------|---------|
| Export web build | `npx expo export -p web` |
| Deploy to Vercel | `vercel --prod` |
| Deploy Firebase Functions | `firebase deploy --only functions` (from project root) |

---

## Troubleshooting

**"Auth domain not authorized"**  
Add your Vercel URL to Firebase Authentication → Settings → Authorized domains.

**Build fails on Vercel**  
Ensure Build Command is `npx expo export -p web` and Output Directory is `dist`.

**Chat doesn't respond**  
Deploy Firebase Functions (`firebase deploy --only functions`) and check that any API keys are set in Firebase config.
