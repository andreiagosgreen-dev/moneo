/* Vacation mode: consecutive time-off days grouped into ranges. */
import { addDays, compareDayKeys } from './dayKeys';

export interface VacationRange {
  from: string;
  to: string;
}

export function isTimeOff(timeOff: string[], key: string): boolean {
  return timeOff.includes(key);
}

/** Groups consecutive days into inclusive ranges, oldest first. */
export function vacationRanges(timeOff: string[]): VacationRange[] {
  const days = [...new Set(timeOff)].sort(compareDayKeys);
  const out: VacationRange[] = [];
  for (const d of days) {
    const last = out[out.length - 1];
    if (last && addDays(last.to, 1) === d) last.to = d;
    else out.push({ from: d, to: d });
  }
  return out;
}

/** The range containing today, if any. */
export function currentVacation(timeOff: string[], todayKey: string): VacationRange | null {
  return (
    vacationRanges(timeOff).find(
      (r) => compareDayKeys(r.from, todayKey) <= 0 && compareDayKeys(todayKey, r.to) <= 0,
    ) ?? null
  );
}

/** Ranges that end today or later. */
export function upcomingVacations(timeOff: string[], todayKey: string): VacationRange[] {
  return vacationRanges(timeOff).filter((r) => compareDayKeys(r.to, todayKey) >= 0);
}

/** "YYYY-MM-DD" (date input) → "YYYY-M-D"; null when invalid. */
export function dayKeyFromInput(v: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${y}-${mo}-${d}`;
}

/** "YYYY-M-D" → "YYYY-MM-DD" for date inputs. */
export function inputFromDayKey(key: string): string {
  const [y, m, d] = key.split('-');
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}
