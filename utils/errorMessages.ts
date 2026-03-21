// errorMessages.ts — PR 18: User-friendly error messages
// Maps Firebase, auth, network, and generic errors to readable messages.

const FIREBASE_AUTH_CODES: Record<string, string> = {
  'auth/email-already-in-use': 'This email is already registered. Try logging in instead.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/operation-not-allowed': 'Email sign-in is not enabled. Please contact support.',
  'auth/weak-password': 'Please choose a stronger password (at least 6 characters).',
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
  'auth/user-not-found': 'No account found with this email. Try signing up.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/invalid-credential': 'Invalid email or password. Please try again.',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
};

const FIREBASE_FIRESTORE_CODES: Record<string, string> = {
  'permission-denied': 'You don\'t have permission to do that. Try logging in again.',
  'unavailable': 'Service temporarily unavailable. Please try again.',
  'unauthenticated': 'Please log in to continue.',
};

const FIREBASE_STORAGE_CODES: Record<string, string> = {
  'storage/unauthorized': 'Permission denied. Please try again.',
  'storage/canceled': 'Upload was canceled.',
  'storage/unknown': 'Upload failed. Please try again.',
};

/** Check if error message or code indicates a network issue. */
function isNetworkError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /network|fetch|connection|offline|timeout/i.test(msg) ||
    msg.includes('Network request failed')
  );
}

/** Get a user-friendly message for any error. */
export function getUserFriendlyMessage(
  error: unknown,
  context: 'auth' | 'upload' | 'transcription' | 'message' | 'generic' = 'generic'
): string {
  if (error == null) return 'Something went wrong. Please try again.';

  const err = error as { code?: string; message?: string };
  const code = err?.code as string | undefined;
  const message = err?.message ?? String(error);

  if (context === 'auth' && code && FIREBASE_AUTH_CODES[code]) {
    return FIREBASE_AUTH_CODES[code];
  }
  if ((context === 'upload' || context === 'message') && code && FIREBASE_STORAGE_CODES[code]) {
    return FIREBASE_STORAGE_CODES[code];
  }
  if ((context === 'message' || context === 'upload') && code && FIREBASE_FIRESTORE_CODES[code]) {
    return FIREBASE_FIRESTORE_CODES[code];
  }

  if (isNetworkError(error)) {
    return 'Check your internet connection and try again.';
  }

  // Firebase/Firestore errors often include the code in the message
  for (const [authCode, msg] of Object.entries(FIREBASE_AUTH_CODES)) {
    if (message.includes(authCode)) return msg;
  }
  for (const [fsCode, msg] of Object.entries(FIREBASE_FIRESTORE_CODES)) {
    if (message.includes(fsCode)) return msg;
  }

  switch (context) {
    case 'upload':
      return 'Image upload failed. Please try again.';
    case 'transcription':
      return 'Voice transcription failed. You can type your message instead.';
    case 'message':
      return 'Could not send. Please try again.';
    case 'auth':
      return 'Authentication failed. Please try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
