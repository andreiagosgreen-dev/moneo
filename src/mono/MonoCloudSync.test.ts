import { describe, expect, it } from 'vitest';
import { en } from '../lib/i18n/locales/en';
import { cloudSyncView } from './MonoCloudSync';

describe('cloudSyncView', () => {
  it('shows Pro status only to Pro accounts, split by the sync switch', () => {
    expect(cloudSyncView(true, true, false)).toBe('pro');
    expect(cloudSyncView(true, false, false)).toBe('pro-off');
    expect(cloudSyncView(true, true, true)).toBe('pro');
  });

  it('shows the free scope + upsell, or the lapsed notice after Pro sync was used', () => {
    expect(cloudSyncView(false, true, false)).toBe('free');
    expect(cloudSyncView(false, false, false)).toBe('free');
    expect(cloudSyncView(false, true, true)).toBe('lapsed');
  });
});

describe('cloud sync copy', () => {
  it('stays honest about what each plan saves to the account', () => {
    expect(en['mono.cloud.proLead'].toLowerCase()).toMatch(/all your data/);
    const free = en['mono.cloud.freeBody'].toLowerCase();
    expect(free).toMatch(/session/);
    expect(free).toMatch(/area/);
    expect(free).toMatch(/setting/);
    expect(en['mono.cloud.lapsedBody'].toLowerCase()).toMatch(/device/);
  });
});
