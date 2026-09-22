# Instrucțiuni pentru agenți (Cursor, Claude Code, etc.)

Citește **`HANDOFF.md` §0** înainte de orice modificare: acolo e starea curentă a repo-ului, a deploy-ului și a serviciilor externe (Supabase, Cloudflare, Turnstile, Sentry, Lemon Squeezy).

## Reguli scurte

- Lucrezi din `origin/main`, pe un branch nou, apoi PR. Nu face merge la `feat/mono-launch` (e deja în `main`). Nu face `git pull` pe un `main` local vechi — vezi `HANDOFF.md` §0.1.
- Deploy-ul e **manual** (Actions → CI → Run workflow pe `main`). Un merge nu publică nimic.
- UI nou = limbaj **Mono** (`src/mono/`). Nu reintroduce `TopNav` sau stilurile vechi `.card` pe ecrane noi.
- i18n: orice text UI nou → cheie în `src/lib/i18n/locales/en.ts` **și** în celelalte 7 limbi (altfel pică `tsc`). Convenție chei Mono: `goal.*`, `proj.*`, `task.*`, `rep.*`, `cal.*`, `mono.*`.
- Fără secrete în cod sau în `VITE_*`. Secretele worker-ului se pun doar cu `wrangler secret put`. `.env.local` nu se comite.
- Erori frontend: `src/lib/errorReporting.ts` (nu adăuga `@sentry/react`).
- Teste noi: `*.test.ts` (nu `.tsx`). Teste E2E în `e2e/` pentru interfața Mono.
- Înainte de PR: prettier, `npm run lint`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`, `npm run secret-scan`.
- Pe Windows/PowerShell 5.1: fără `&&`; înlănțuiește cu `cmd1; if ($?) { cmd2 }`.
