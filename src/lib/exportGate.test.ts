import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { exportSessionsToCSV, printReportHTML } from './export';
import type { Session } from './store';
import type { Project } from './projects';
import type { FocusArea } from './focusAreas';

const HISTORY: Session[] = [{ id: 's1', at: Date.now(), min: 25 }];
const PROJECTS: Project[] = [];
const AREAS: FocusArea[] = [];

describe('Pro gating on exports', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('blocks CSV export for Free: no file, onBlocked fired, returns false', () => {
    const onBlocked = vi.fn();
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const ok = exportSessionsToCSV(HISTORY, PROJECTS, AREAS, [], undefined, {
      isPro: false,
      onBlocked,
    });

    expect(ok).toBe(false);
    expect(onBlocked).toHaveBeenCalledTimes(1);
    expect(createUrl).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    expect(document.body.querySelector('a')).toBeNull();
    revokeUrl.mockRestore();
  });

  it('blocks CSV export when the gate is missing entirely (fail-closed)', () => {
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const ok = exportSessionsToCSV(HISTORY, PROJECTS, AREAS);
    expect(ok).toBe(false);
    expect(createUrl).not.toHaveBeenCalled();
  });

  it('allows CSV export for Pro: file triggered, returns true', () => {
    const onBlocked = vi.fn();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const ok = exportSessionsToCSV(HISTORY, PROJECTS, AREAS, [], undefined, {
      isPro: true,
      onBlocked,
    });

    expect(ok).toBe(true);
    expect(onBlocked).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('blocks printable PDF for Free without opening a window', () => {
    const onBlocked = vi.fn();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    const ok = printReportHTML('<html></html>', { isPro: false, onBlocked });

    expect(ok).toBe(false);
    expect(onBlocked).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
  });

  it('allows printable PDF for Pro', () => {
    const onBlocked = vi.fn();
    const fakeDoc = { write: vi.fn(), close: vi.fn() };
    const fakeWin = { document: fakeDoc, focus: vi.fn(), print: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(fakeWin as unknown as Window);

    const ok = printReportHTML('<html></html>', { isPro: true, onBlocked });

    expect(ok).toBe(true);
    expect(onBlocked).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(1);
    expect(fakeWin.print).toHaveBeenCalledTimes(1);
  });
});
