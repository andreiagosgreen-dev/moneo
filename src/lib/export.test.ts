import { describe, expect, it } from 'vitest';
import { buildPrintableReportHTML, generateSessionsCSV } from './export';
import type { Session } from './store';
import type { Project } from './projects';
import type { FocusArea } from './focusAreas';

describe('generateSessionsCSV', () => {
  it('formats headers and rows with escaped strings and project/area mapping', () => {
    const fixedTime = new Date('2026-09-14T10:30:00Z').getTime();
    const projects: Project[] = [
      {
        id: 'p1',
        name: 'Client Alpha',
        color: '#22c55e',
        category: 'clients',
        tags: [],
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];
    const areas: FocusArea[] = [
      {
        id: 'a1',
        name: 'Backend API',
        createdAt: 1000,
      },
    ];
    const history: Session[] = [
      {
        id: 's1',
        at: fixedTime,
        min: 50,
        projectId: 'p1',
        areaId: 'a1',
        intention: 'Implement "OAuth" flow',
      },
      {
        id: 's2',
        at: fixedTime - 3600000,
        min: 25,
      },
    ];

    const csv = generateSessionsCSV(history, projects, areas);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('Date,Time,Duration (min),Project,Category,Focus Area,Task,Intention');
    expect(lines[1]).toContain(
      '50,"Client Alpha","clients","Backend API","","Implement ""OAuth"" flow"',
    );
    expect(lines[2]).toContain('25,"Unassigned","","","",""');
  });

  it('neutralizes CSV formula injection (OWASP)', () => {
    const at = new Date('2026-09-14T10:30:00Z').getTime();
    const projects: Project[] = [
      {
        id: 'p1',
        name: '+cmd|/c calc',
        color: '#22c55e',
        category: 'clients',
        tags: [],
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];
    const areas: FocusArea[] = [{ id: 'a1', name: '@mal', createdAt: 1000 }];
    const history: Session[] = [
      {
        id: 's1',
        at,
        min: 25,
        projectId: 'p1',
        areaId: 'a1',
        intention: '=HYPERLINK("http://evil","x")',
      },
    ];
    const csv = generateSessionsCSV(history, projects, areas);
    expect(csv).toContain('"\'+cmd|/c calc"');
    expect(csv).toContain('"\'@mal"');
    expect(csv).toContain('"\'=HYPERLINK');
  });
});

describe('buildPrintableReportHTML', () => {
  it('renders a self-contained document with stats, projects and days', () => {
    const html = buildPrintableReportHTML({
      title: 'Moneo Report',
      rangeLabel: '7 days',
      generatedAt: 'Sep 16, 2026',
      totalMin: 300,
      sessionCount: 12,
      avgMinPerDay: 43,
      totalBillable: 250,
      projects: [{ name: 'Client Alpha', color: '#22c55e', min: 200, amount: 250 }],
      days: [{ label: 'Sep 15', min: 100 }],
    });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Moneo Report');
    expect(html).toContain('Client Alpha');
    expect(html).toContain('$250.00');
    expect(html).toContain('Sep 15');
    expect(html).toContain('@media print');
  });

  it('escapes hostile project names', () => {
    const html = buildPrintableReportHTML({
      title: 'R',
      rangeLabel: '7 days',
      generatedAt: 'now',
      totalMin: 0,
      sessionCount: 0,
      avgMinPerDay: 0,
      totalBillable: 0,
      projects: [{ name: '<script>alert(1)</script>', color: '#fff', min: 10, amount: 0 }],
      days: [],
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('shows a dash for non-billable rows', () => {
    const html = buildPrintableReportHTML({
      title: 'R',
      rangeLabel: '7 days',
      generatedAt: 'now',
      totalMin: 10,
      sessionCount: 1,
      avgMinPerDay: 10,
      totalBillable: 0,
      projects: [{ name: 'Hobby', color: '#000', min: 10, amount: 0 }],
      days: [],
    });
    expect(html).toContain('$0.00');
    expect(html).toContain('>—<');
  });
});
