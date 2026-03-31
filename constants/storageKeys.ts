/** AsyncStorage keys — PR 19 feature tour, email verification gate */
export const STORAGE_KEYS = {
  HAS_SEEN_FEATURE_TOUR: '@calapp_has_seen_feature_tour_v1',
  /** When set, unverified users are sent to verify-email (set after sign-up only; cleared on sign-in). */
  ENFORCE_EMAIL_VERIFY_AFTER_SIGNUP: '@calapp_enforce_email_verify_v1',
} as const;
