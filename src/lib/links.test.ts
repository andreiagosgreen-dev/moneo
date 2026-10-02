import { describe, expect, it, vi } from 'vitest';
import { openPaymentPage, safeExternalUrl } from './links';

const CHECKOUT = 'https://moneo.lemonsqueezy.com/checkout/buy/abc?checkout[custom][user_id]=u1';

function fakeWindow(opened: { opener: unknown } | null | 'throws') {
  const assign = vi.fn();
  const open = vi.fn(() => {
    if (opened === 'throws') throw new Error('blocked');
    return opened as unknown as Window;
  });
  return { win: { open, location: { assign } } as unknown as Window, open, assign };
}

describe('openPaymentPage', () => {
  it('opens a new tab and cuts the opener link', () => {
    const tab = { opener: {} as unknown };
    const { win, open, assign } = fakeWindow(tab);
    expect(openPaymentPage(CHECKOUT, win)).toBe('new-tab');
    expect(open).toHaveBeenCalledWith(CHECKOUT, '_blank');
    expect(tab.opener).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });

  it('goes to the page in this tab when the pop-up is blocked', () => {
    const blocked = fakeWindow(null);
    expect(openPaymentPage(CHECKOUT, blocked.win)).toBe('same-tab');
    expect(blocked.assign).toHaveBeenCalledWith(CHECKOUT);

    const throwing = fakeWindow('throws');
    expect(openPaymentPage(CHECKOUT, throwing.win)).toBe('same-tab');
    expect(throwing.assign).toHaveBeenCalledWith(CHECKOUT);
  });
});

describe('safeExternalUrl', () => {
  it('only lets http(s) through', () => {
    expect(safeExternalUrl('example.com/x')).toBe('https://example.com/x');
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('data:text/html,hi')).toBeNull();
  });
});
