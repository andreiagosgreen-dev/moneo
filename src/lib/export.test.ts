import { describe, expect, it } from 'vitest';
import { generateSessionsCSV } from './export';
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
});
