/** Client-side floor; Supabase enforces its own server-side policy too. */
export const MIN_PASSWORD_LENGTH = 8;

export type NewPasswordProblem = 'short' | 'mismatch';

export function validateNewPassword(password: string, confirm: string): NewPasswordProblem | null {
  if (password.length < MIN_PASSWORD_LENGTH) return 'short';
  if (password !== confirm) return 'mismatch';
  return null;
}
