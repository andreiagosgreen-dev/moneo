import type { Session } from './store';
import type { Project } from './projects';
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
    return `"${val.replace(/"/g, '""')}"`;
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
