import { afterEach, describe, expect, it, vi } from 'vitest';

import { isEmailConfigured, sendEmailNotification } from './emailService';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('emailService (unconfigured stub)', () => {
  it('reports not configured when VITE_EMAIL_API_URL is missing', () => {
    vi.stubEnv('VITE_EMAIL_API_URL', '');
    expect(isEmailConfigured()).toBe(false);
  });

  it('rejects invalid endpoint URLs', () => {
    vi.stubEnv('VITE_EMAIL_API_URL', 'not-a-url');
    expect(isEmailConfigured()).toBe(false);
  });

  it('fails closed instead of pretending the email was sent', async () => {
    vi.stubEnv('VITE_EMAIL_API_URL', '');
    const result = await sendEmailNotification({
      userId: 'u1',
      email: 'user@example.com',
      type: 'daily_summary',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not configured/i);
  });

  it('accepts a valid https endpoint as configured', () => {
    vi.stubEnv('VITE_EMAIL_API_URL', 'https://example.com/api/email');
    expect(isEmailConfigured()).toBe(true);
  });
});
