import { describe, expect, it } from 'vitest';

/**
 * Policy-as-code guard for Supabase migrations (Faza 5A).
 *
 * Live RLS behavior can only be proven against a real database, but these
 * structural invariants must hold for every migration file or the change
 * is rejected here first: RLS on every user table, owner-only policies,
 * backend CHECK validation, and no anonymous write path into billing.
 */
const MIGRATIONS = import.meta.glob('../../../supabase/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function sqlFiles(): Array<{ name: string; sql: string }> {
  return Object.entries(MIGRATIONS)
    .map(([filePath, sql]) => ({
      name: filePath.split('/').pop() ?? filePath,
      sql: stripComments(sql),
    }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));
}

/** Remove -- line comments and block comments so prose can't trip the guards. */
function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => {
      const cut = line.indexOf('--');
      return cut >= 0 ? line.slice(0, cut) : line;
    })
    .join('\n');
}

describe('RLS migration invariants', () => {
  it('never grants anonymous/broad access', () => {
    for (const { name, sql } of sqlFiles()) {
      expect(sql, `${name}: using (true)`).not.toMatch(/using\s*\(\s*true\s*\)/i);
      expect(sql, `${name}: with check (true)`).not.toMatch(/with\s+check\s*\(\s*true\s*\)/i);
      expect(sql, `${name}: to anon`).not.toMatch(/to\s+anon\b/i);
      expect(sql, `${name}: to public without policy`).not.toMatch(/grant\s+all\s+on\s+all/i);
    }
  });

  it('enables RLS on every created user table', () => {
    for (const { name, sql } of sqlFiles()) {
      const created = new Set(
        [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/gi)].map((m) =>
          m[1].toLowerCase(),
        ),
      );
      const guarded = new Set(
        [...sql.matchAll(/alter\s+table\s+public\.(\w+)\s+enable\s+row\s+level\s+security/gi)].map(
          (m) => m[1].toLowerCase(),
        ),
      );
      for (const table of created) {
        expect(guarded.has(table), `${name}: RLS not enabled on ${table}`).toBe(true);
      }
    }
  });

  it('scopes every policy to the row owner via auth.uid()', () => {
    let policyFiles = 0;
    for (const { name, sql } of sqlFiles()) {
      const chunks = sql.split(/create\s+policy/gi).slice(1);
      if (chunks.length === 0) continue;
      policyFiles += 1;
      for (const chunk of chunks) {
        expect(chunk, `${name}: policy without auth.uid()`).toContain('auth.uid()');
      }
    }
    expect(policyFiles).toBeGreaterThan(0);
  });

  it('gives clients read-only access to subscriptions (writes are server-side)', () => {
    const subs = sqlFiles().find((f) => f.name.includes('subscriptions'));
    expect(subs).toBeDefined();
    const policies = subs!.sql.split(/create\s+policy/gi).slice(1);
    expect(policies.length).toBeGreaterThan(0);
    for (const chunk of policies) {
      expect(chunk).toMatch(/for\s+select/i);
      expect(chunk).not.toMatch(/for\s+(insert|update|delete)/i);
    }
  });

  it('validates billing status/plan server-side with CHECK constraints', () => {
    const subs = sqlFiles()
      .filter((f) => f.name.includes('subscriptions'))
      .map((f) => f.sql)
      .join('\n');
    expect(subs).toMatch(/subscriptions_status_check/);
    expect(subs).toMatch(/subscriptions_plan_check/);
  });
});
