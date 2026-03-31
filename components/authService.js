// authService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createUserWithEmailAndPassword,
  getIdToken,
  onAuthStateChanged,
  onIdTokenChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { auth } from './firebaseConfig';

// Sign up new user — returns { success, user? } or { success: false, error } (error is the raw Error for mapping)
// Sends a verification email so the user can confirm their address is valid.
export const signUp = async (email, password, displayName) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    if (displayName) {
      await updateProfile(userCredential.user, { displayName });
    }

    await sendEmailVerification(userCredential.user);
    await AsyncStorage.setItem(STORAGE_KEYS.ENFORCE_EMAIL_VERIFY_AFTER_SIGNUP, '1');
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error };
  }
};

// Resend verification email for the current user (for verify-email screen)
export const resendVerificationEmail = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: new Error('Not signed in') };
    if (user.emailVerified) return { success: true };
    await sendEmailVerification(user);
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
};

/** Refresh user from server (e.g. after opening verification link); forces token refresh so listeners update. */
export const reloadCurrentUser = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: new Error('Not signed in') };
    await reload(user);
    await getIdToken(user, true);
    if (auth.currentUser?.emailVerified) {
      await AsyncStorage.removeItem(STORAGE_KEYS.ENFORCE_EMAIL_VERIFY_AFTER_SIGNUP);
    }
    return { success: true, user: auth.currentUser };
  } catch (error) {
    return { success: false, error };
  }
};

/** Send Firebase password reset email (user follows link to choose a new password). */
export const sendPasswordReset = async (email) => {
  try {
    await sendPasswordResetEmail(auth, (email ?? '').trim());
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
};

// Sign in existing user — do not force verify-email (only enforced after sign-up)
export const signIn = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    await AsyncStorage.removeItem(STORAGE_KEYS.ENFORCE_EMAIL_VERIFY_AFTER_SIGNUP);
    await reload(userCredential.user);
    await getIdToken(userCredential.user, true);
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error };
  }
};

// Update display name for the current user
export const updateDisplayName = async (newName) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: new Error('Not signed in') };
    await updateProfile(user, { displayName: (newName ?? '').trim() || '' });
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
};

// Sign out
export const logOut = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.ENFORCE_EMAIL_VERIFY_AFTER_SIGNUP);
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
};

// Auth + ID token updates so UI picks up emailVerified after reload() / verification
export const subscribeToAuthChanges = (callback) => {
  const unsubAuth = onAuthStateChanged(auth, callback);
  const unsubToken = onIdTokenChanged(auth, callback);
  return () => {
    unsubAuth();
    unsubToken();
  };
};