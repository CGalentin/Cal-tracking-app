/** Lightweight format check before Firebase; Firebase still validates on the server. */
const EMAIL_RE =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  const t = email.trim();
  if (!t) return false;
  return EMAIL_RE.test(t);
}
