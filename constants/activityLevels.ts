/**
 * Activity level multipliers for TDEE (Total Daily Energy Expenditure).
 * TDEE = BMR × multiplier.
 * Values follow common guidelines (e.g. Harris–Benedict / Mifflin–St Jeor usage).
 */

export const ACTIVITY_LEVEL_MULTIPLIERS = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
} as const;

export type ActivityLevelId = keyof typeof ACTIVITY_LEVEL_MULTIPLIERS;

/** Human-readable labels for UI (onboarding, settings). */
export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevelId, string> = {
  sedentary: 'Sedentary (little or no exercise)',
  lightly_active: 'Lightly active (exercise 1–3 days/week)',
  moderately_active: 'Moderately active (exercise 3–5 days/week)',
  very_active: 'Very active (exercise 6–7 days/week)',
  extra_active: 'Extra active (physical job + exercise)',
};
