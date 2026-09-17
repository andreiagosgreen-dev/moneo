import type { Session } from './store';
import { fmtMinutes } from './store';
import type { Project } from './projects';
import { formatBillable } from './projects';
import type { FocusArea } from './focusAreas';
import type { Task } from './tasks';

/**
 * Generates CSV string from focus session history for client invoicing and productivity reporting.
 */
export function generateSessionsCSV(
  history: Session[],
  projects: Project[],
  areas: FocusArea[],
  tasks: Task[] = [],
): string {
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const areaMap = new Map(areas.map((a) => [a.id, a]));
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  const headers = [
    'Date',
    'Time',
    'Duration (min)',
    'Project',
    'Category',
    'Focus Area',
    'Task',
    'Intention',
  ];

  const escapeCsv = (val: string | null | undefined): string => {
    if (!val) return '""';
    // OWASP CSV formula injection: a leading = + - @ (or tab/CR) makes
    // spreadsheet apps evaluate the cell. Prefix with ' to force text.
    const safe = /^[=+\-@\t\r]/.test(val) ? `'${val}` : val;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const rows = history
    .slice()
    .sort((a, b) => b.at - a.at)
    .map((s) => {
      const d = new Date(s.at);
      const dateStr = d.toISOString().slice(0, 10);
      const timeStr = d.toTimeString().slice(0, 5);
      const proj = s.projectId ? projectMap.get(s.projectId) : null;
      const area = s.areaId ? areaMap.get(s.areaId) : null;
      const task = s.taskId ? taskMap.get(s.taskId) : null;

      return [
        dateStr,
        timeStr,
        s.min.toString(),
        escapeCsv(proj ? proj.name : 'Unassigned'),
        escapeCsv(proj ? proj.category : ''),
        escapeCsv(area ? area.name : ''),
        escapeCsv(task ? task.title : ''),
        escapeCsv(s.intention || ''),
      ].join(',');
    });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Triggers a browser download of the CSV timesheet.
 */
export function exportSessionsToCSV(
  history: Session[],
  projects: Project[],
  areas: FocusArea[],
  tasks: Task[] = [],
): void {
  const csvContent = generateSessionsCSV(history, projects, areas, tasks);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `moneo-timesheet-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* ---------------- printable PDF report (Roadmap 2.4) ----------------
 * No PDF dependency: the report renders as a self-contained print
 * stylesheet page; the browser's Print → Save as PDF produces the file.
 */

export interface PrintableProjectRow {
  name: string;
  color: string;
  min: number;
  /** Billable USD for this row (0 when the project is not billable). */
  amount: number;
}

export interface PrintableDayRow {
  label: string;
  min: number;
}

export interface PrintableReport {
  title: string;
  rangeLabel: string;
  generatedAt: string;
  totalMin: number;
  sessionCount: number;
  avgMinPerDay: number;
  totalBillable: number;
  projects: PrintableProjectRow[];
  days: PrintableDayRow[];
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Pure: builds a self-contained printable HTML document. Never throws. */
export function buildPrintableReportHTML(r: PrintableReport): string {
  const projectRows = r.projects
    .map(
      (p) =>
        `<tr><td><span class="dot" style="background:${escHtml(p.color)}"></span>${escHtml(
          p.name,
        )}</td><td class="num">${fmtMinutes(p.min)}</td><td class="num">${
          p.amount > 0 ? escHtml(formatBillable(p.amount)) : '—'
        }</td></tr>`,
    )
    .join('');
  const dayRows = r.days
    .map((d) => `<tr><td>${escHtml(d.label)}</td><td class="num">${fmtMinutes(d.min)}</td></tr>`)
    .join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escHtml(r.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; margin: 32px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
  .stats { display: flex; gap: 28px; margin-bottom: 20px; }
  .stat b { display: block; font-size: 20px; }
  .stat span { font-size: 12px; color: #666; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: #555; margin: 24px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; }
  th { color: #555; font-weight: 600; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 7px; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
<h1>${escHtml(r.title)}</h1>
<p class="meta">${escHtml(r.rangeLabel)} · generated ${escHtml(r.generatedAt)}</p>
<div class="stats">
  <div class="stat"><b>${escHtml(fmtMinutes(r.totalMin))}</b><span>total focused</span></div>
  <div class="stat"><b>${r.sessionCount}</b><span>sessions</span></div>
  <div class="stat"><b>${escHtml(fmtMinutes(r.avgMinPerDay))}</b><span>avg / day</span></div>
  <div class="stat"><b>${escHtml(formatBillable(r.totalBillable))}</b><span>billable</span></div>
</div>
<h2>By project</h2>
<table><thead><tr><th>Project</th><th class="num">Time</th><th class="num">Billable</th></tr></thead><tbody>${projectRows}</tbody></table>
<h2>By day</h2>
<table><thead><tr><th>Day</th><th class="num">Time</th></tr></thead><tbody>${dayRows}</tbody></table>
</body>
</html>`;
}

/**
 * Opens the printable report and triggers the browser print dialog
 * (Print → Save as PDF). Returns false outside a browser popup context.
 */
export function printReportHTML(html: string): boolean {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w || !w.document) return false;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    return true;
  } catch {
    return false;
  }
}
