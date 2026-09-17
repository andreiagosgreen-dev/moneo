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

/**
 * Generate daily summary email content
 */
export function generateDailySummaryEmail(data: {
  totalMinutes: number;
  sessions: number;
  streak: number;
}): {
  subject: string;
  body: string;
} {
  return {
    subject: 'Your Moneo Daily Summary',
    body: `
Hi! Here's your Moneo summary for today:

🎯 Total focus time: ${data.totalMinutes} minutes
⏱️ Sessions completed: ${data.sessions}
🔥 Current streak: ${data.streak} days

Keep building your focus!

- The Moneo Team
    `.trim(),
  };
}

/**
 * Generate focus reminder email content
 */
export function generateFocusReminderEmail(): {
  subject: string;
  body: string;
} {
  return {
    subject: 'Time to focus! 🎯',
    body: `
Hi! It's time for your next focus session.

Open Moneo and start your timer now. Every session counts!

- The Moneo Team
    `.trim(),
  };
}

/**
 * Generate streak milestone email content
 */
export function generateStreakMilestoneEmail(data: { streak: number }): {
  subject: string;
  body: string;
} {
  return {
    subject: `🔥 ${data.streak} day streak!`,
    body: `
Congratulations! You've reached a ${data.streak} day streak on Moneo!

Your consistency is paying off. Keep up the great work!

- The Moneo Team
    `.trim(),
  };
}
