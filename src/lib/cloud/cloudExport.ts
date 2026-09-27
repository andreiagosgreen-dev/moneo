import type { CloudExport } from '../dataExport';
import { pullAreasAll } from './areaRepository';
import { pullAllSessions } from './sessionRepository';
import { getSettings } from './settingsRepository';
import { fetchSubscription } from './subscriptionRepository';

/**
 * The signed-in user's synced rows, read through the normal RLS-scoped
 * client. A section the cloud could not return is `null`, never guessed.
 * Billing provider ids are not read (fetchSubscription selects none).
 */
export async function collectCloudExport(
  userId: string,
  email: string | null,
): Promise<CloudExport> {
  const [sessions, areas, settings, subscription] = await Promise.all([
    pullAllSessions(userId),
    pullAreasAll(userId),
    getSettings(userId),
    fetchSubscription(userId),
  ]);
  let settingsOut: Record<string, unknown> | null = null;
  if (settings) {
    settingsOut = { ...(settings as unknown as Record<string, unknown>) };
    delete settingsOut.user_id;
  }
  return {
    email,
    sessions,
    areas,
    settings: settingsOut,
    subscription: {
      status: subscription.status,
      planId: subscription.planId,
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
  };
}
