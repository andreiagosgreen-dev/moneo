/**
 * Email notification service for Moneo.
 * Uses Supabase Edge Functions or a third-party email service.
 */

export type NotificationType = "daily_summary" | "focus_reminder" | "streak_milestone";

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
 */
export async function sendEmailNotification(
  notification: EmailNotification,
): Promise<{ success: boolean; error?: string }> {
  // TODO: Implement actual email sending
  // For now, this is a placeholder that logs the notification
  console.log("Email notification:", notification);

  // In production, you would:
  // 1. Call a Supabase Edge Function
  // 2. Or call a third-party email API directly
  // 3. Use webhooks for subscription management

  return { success: true };
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
    subject: "Your Moneo Daily Summary",
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
    subject: "Time to focus! 🎯",
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
export function generateStreakMilestoneEmail(data: {
  streak: number;
}): {
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
