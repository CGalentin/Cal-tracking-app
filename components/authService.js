// authService.js
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
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

// Sign in existing user
export const signIn = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
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
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
};
  
  // Listen to auth state changes
  export const subscribeToAuthChanges = (callback) => {
    return onAuthStateChanged(auth, callback);
  };