import type { ActivityLevelId } from '../constants/activityLevels';

/**
 * Unit preference for display: standard (lbs, ft/in) or metric (kg, cm).
 * Default is 'standard'.
 */
export type UnitSystem = 'metric' | 'standard';

/**
 * UserProfile — physical metrics and preferences for calorie target calculation.
 * Stored in Firestore at userProfiles/{userId}.
 * All units are metric for consistent BMR/TDEE math (Mifflin–St Jeor).
 * useUnits controls display preference only; stored values remain in kg/cm.
 */

export type Gender = 'male' | 'female';

export interface UserProfile {
  /** Weight in kilograms (kg). */
  weightKg: number;
  /** Height in centimeters (cm). */
  heightCm: number;
  /** Age in years. */
  age: number;
  /** Biological sex for BMR formula (Mifflin–St Jeor). */
  gender: Gender;
  /**
   * Activity level key; use ACTIVITY_LEVEL_MULTIPLIERS to get the numeric multiplier for TDEE.
   * @see constants/activityLevels
   */
  activityLevelId: ActivityLevelId;
  /** Optional: target weight in kg for progress display (Phase 2). */
  targetWeightKg?: number;
  /** Optional: daily calorie deficit/surplus in kcal. Negative = deficit (lose), 0 = maintain, positive = surplus (gain). */
  dailyCalorieDelta?: number;
  /** Display units: 'standard' (lbs, ft/in) or 'metric' (kg, cm). Default 'standard'. */
  useUnits?: UnitSystem;
  /** Client-only: when the profile was last updated (Firestore updatedAt). */
  updatedAt?: unknown;
}

/**
 * Minimal shape required to create or update a profile (e.g. onboarding).
 * All fields optional for partial updates.
 */
export type UserProfileInput = Partial<
  Pick<UserProfile, 'weightKg' | 'heightCm' | 'age' | 'gender' | 'activityLevelId' | 'targetWeightKg' | 'dailyCalorieDelta' | 'useUnits'>
>;
