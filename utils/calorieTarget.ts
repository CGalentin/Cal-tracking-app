/**
 * Calorie target calculation (Phase 2).
 * Uses Mifflin–St Jeor BMR and activity-level multipliers for TDEE.
 */

import { ACTIVITY_LEVEL_MULTIPLIERS } from '../constants/activityLevels';
import type { ActivityLevelId } from '../constants/activityLevels';
import type { Gender, UserProfile } from '../types/userProfile';

/** Minimum recommended daily calories (Phase 3 safety warning). */
export const MIN_DAILY_CALORIES_FEMALE = 1200;
export const MIN_DAILY_CALORIES_MALE = 1500;

/** True if the daily target is below the recommended minimum for the given gender. */
export function isCalorieTargetBelowSafe(dailyTarget: number, gender: Gender): boolean {
  const min = gender === 'female' ? MIN_DAILY_CALORIES_FEMALE : MIN_DAILY_CALORIES_MALE;
  return dailyTarget < min;
}

/**
 * Basal Metabolic Rate (kcal/day) via Mifflin–St Jeor.
 * @param weightKg - Weight in kilograms
 * @param heightCm - Height in centimeters
 * @param age - Age in years
 * @param gender - Biological sex for formula
 */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: Gender
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const bmr = gender === 'male' ? base + 5 : base - 161;
  return Math.round(Math.max(0, bmr));
}

/**
 * Total Daily Energy Expenditure (kcal/day).
 * TDEE = BMR × activity multiplier.
 */
export function calculateTDEE(bmr: number, activityLevelId: ActivityLevelId): number {
  const multiplier = ACTIVITY_LEVEL_MULTIPLIERS[activityLevelId];
  return Math.round(bmr * multiplier);
}

/**
 * Daily calorie target (kcal/day).
 * Target = TDEE + dailyCalorieDelta (delta is negative for deficit, positive for surplus).
 * Uses 0 for delta if not set (maintain).
 */
export function calculateDailyTarget(profile: UserProfile): number {
  const bmr = calculateBMR(
    profile.weightKg,
    profile.heightCm,
    profile.age,
    profile.gender
  );
  const tdee = calculateTDEE(bmr, profile.activityLevelId);
  const delta = profile.dailyCalorieDelta ?? 0;
  return Math.round(Math.max(0, tdee + delta));
}

/** Result of target vs current weight for progress bar / display. */
export interface WeightProgress {
  /** Progress toward target: 0 = at start, 1 = at target. */
  progress: number;
  /** Whether user is losing, gaining, or maintaining. */
  direction: 'lose' | 'gain' | 'maintain';
  /** Weight to lose or gain to reach target (positive number). */
  deltaKg: number;
  /** Human-readable short label, e.g. "2.5 kg to go". */
  label: string;
}

/**
 * Progress from current weight toward target weight for a progress bar.
 * If target equals current, direction is 'maintain' and progress is 1.
 * Optional startWeightKg = weight when goal was set; if omitted, progress is 0 until we have history.
 */
export function getWeightProgress(
  currentWeightKg: number,
  targetWeightKg: number,
  startWeightKg?: number
): WeightProgress {
  const deltaKg = Math.abs(currentWeightKg - targetWeightKg);

  if (deltaKg < 0.1) {
    return {
      progress: 1,
      direction: 'maintain',
      deltaKg: 0,
      label: 'At goal',
    };
  }

  const losing = targetWeightKg < currentWeightKg;

  if (losing) {
    const start = startWeightKg ?? currentWeightKg;
    const totalToLose = start - targetWeightKg;
    const lostSoFar = start - currentWeightKg;
    const progress = totalToLose > 0 ? Math.min(1, Math.max(0, lostSoFar / totalToLose)) : 0;
    return {
      progress,
      direction: 'lose',
      deltaKg: currentWeightKg - targetWeightKg,
      label: `${(currentWeightKg - targetWeightKg).toFixed(1)} kg to go`,
    };
  } else {
    const start = startWeightKg ?? currentWeightKg;
    const totalToGain = targetWeightKg - start;
    const gainedSoFar = currentWeightKg - start;
    const progress = totalToGain > 0 ? Math.min(1, Math.max(0, gainedSoFar / totalToGain)) : 0;
    return {
      progress,
      direction: 'gain',
      deltaKg: targetWeightKg - currentWeightKg,
      label: `${(targetWeightKg - currentWeightKg).toFixed(1)} kg to go`,
    };
  }
}
