import { describe, expect, it, vi } from 'vitest';

import { withClient } from './withClient';

describe('withClient', () => {
  it('resolves null without calling fn when unconfigured', async () => {
    const getClient = vi.fn(async () => null);
    const fn = vi.fn(async () => 'value');
    await expect(withClient(fn, getClient)).resolves.toBeNull();
    expect(getClient).toHaveBeenCalledTimes(1);
    expect(fn).not.toHaveBeenCalled();
  });

  it('passes the client through on success', async () => {
    const client = { marker: true } as never;
    const fn = vi.fn(async (c: unknown) => c);
    await expect(withClient(fn, async () => client)).resolves.toBe(client);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('swallows query failures as null (fail-safe contract)', async () => {
    const fn = async (): Promise<string> => {
      throw new Error('network down');
    };
    await expect(withClient(fn, async () => ({}) as never)).resolves.toBeNull();
  });

  it('lets a rejecting client factory propagate (unchanged legacy behavior)', async () => {
    const getClient = async (): Promise<never> => {
      throw new Error('factory blew up');
    };
    await expect(withClient(async () => 'x', getClient)).rejects.toThrow('factory blew up');
  });
});
