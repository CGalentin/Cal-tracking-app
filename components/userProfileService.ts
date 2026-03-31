/**
 * Firestore read/write for userProfiles/{userId}.
 * Used by onboarding and home dashboard.
 */

import { onAuthStateChanged } from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import type { UnitSystem, UserProfile, UserProfileInput } from '../types/userProfile';

const COLLECTION = 'userProfiles';

function profileFromDoc(data: Record<string, unknown> | undefined): UserProfile | null {
  if (!data) return null;
  const weightKg = data.weightKg as number | undefined;
  const heightCm = data.heightCm as number | undefined;
  const age = data.age as number | undefined;
  const gender = data.gender as UserProfile['gender'] | undefined;
  const activityLevelId = data.activityLevelId as UserProfile['activityLevelId'] | undefined;
  if (
    typeof weightKg !== 'number' ||
    typeof heightCm !== 'number' ||
    typeof age !== 'number' ||
    (gender !== 'male' && gender !== 'female') ||
    !activityLevelId
  ) {
    return null;
  }
  const useUnits = data.useUnits as UnitSystem | undefined;
  return {
    weightKg,
    heightCm,
    age,
    gender,
    activityLevelId,
    targetWeightKg: data.targetWeightKg as number | undefined,
    dailyCalorieDelta: data.dailyCalorieDelta as number | undefined,
    useUnits: useUnits === 'metric' ? 'metric' : 'standard',
    updatedAt: data.updatedAt,
  };
}

/** True if profile has metrics but daily calorie goal was never set (existing user without goals). */
export function profileNeedsGoals(profile: UserProfile | null): profile is UserProfile {
  return profile != null && profile.dailyCalorieDelta === undefined;
}

/** Get the current user's profile once. Returns null if not found or not logged in. */
export async function getProfile(): Promise<UserProfile | null> {
  const user = auth.currentUser;
  if (!user) return null;
  const ref = doc(db, COLLECTION, user.uid);
  const snap = await getDoc(ref);
  return profileFromDoc(snap.exists() ? (snap.data() as Record<string, unknown>) : undefined);
}

/**
 * Subscribe to the current user's profile. Returns unsubscribe.
 * Uses `onAuthStateChanged` so listeners attach after auth restores on web (avoids a stuck "Loading" when
 * `auth.currentUser` was still null on first paint).
 */
export function subscribeToProfile(callback: (profile: UserProfile | null) => void): () => void {
  let unsubProfile: (() => void) | undefined;

  const unsubAuth = onAuthStateChanged(auth, (user) => {
    if (unsubProfile) {
      unsubProfile();
      unsubProfile = undefined;
    }
    if (!user) {
      callback(null);
      return;
    }
    const ref = doc(db, COLLECTION, user.uid);
    unsubProfile = onSnapshot(
      ref,
      (snap) => {
        callback(profileFromDoc(snap.exists() ? (snap.data() as Record<string, unknown>) : undefined));
      },
      () => callback(null)
    );
  });

  return () => {
    unsubAuth();
    if (unsubProfile) unsubProfile();
  };
}

/** Strip undefined so Firestore doesn't reject the document. */
function withoutUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** Create or update the current user's profile. Merges with existing. */
export async function setProfile(input: UserProfileInput): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('User must be authenticated');
  const ref = doc(db, COLLECTION, user.uid);
  const existing = await getDoc(ref);
  const current = existing.exists() ? (existing.data() as Record<string, unknown>) : {};
  const payload = withoutUndefined({
    ...current,
    ...input,
    updatedAt: serverTimestamp(),
  });
  await setDoc(ref, payload);
}
