/**
 * Email notification service for Moneo.
 * Uses Supabase Edge Functions or a third-party email service.
 */

import { readEnv } from '../env';

export type NotificationType = 'daily_summary' | 'focus_reminder' | 'streak_milestone';

export interface EmailNotification {
  userId: string;
  email: string;
  type: NotificationType;
  data?: Record<string, unknown>;
}

/**
 * Placeholder for email notification service.
 * In production, this would integrate with:
 * - Supabase Edge Functions with Resend/SendGrid
 * - Or a dedicated email service like Mailgun
 *
 * Fail-safe contract: when no provider endpoint is configured
 * (VITE_EMAIL_API_URL), the call resolves `{ success: false }` instead
 * of pretending the email was sent.
 */

/** Never throws. Pure environment inspection. */
export function isEmailConfigured(): boolean {
  try {
    const endpoint = readEnv().VITE_EMAIL_API_URL;
    return typeof endpoint === 'string' && /^https?:\/\/.+/i.test(endpoint.trim());
  } catch {
    return false;
  }
}

/**
 * Email delivery entry point.
 *
 * Roadmap Faza 0.4: there is no email backend yet (no Edge Function, no
 * provider), and only a backend may ever talk to a provider. Until one
 * exists this function ALWAYS fails closed — it never reports success
 * without performing a request. `isEmailConfigured` below only gates UI
 * copy; it does not promise delivery.
 */
export async function sendEmailNotification(
  notification: EmailNotification,
): Promise<{ success: boolean; error?: string }> {
  void notification;
  return { success: false, error: 'Email delivery is not connected yet' };
}
