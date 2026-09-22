# Instrucțiuni pentru agenți (Cursor, Claude Code, etc.)

Citește **`HANDOFF.md` §0** (inclusiv §0.8) înainte de orice modificare: acolo e starea curentă a repo-ului, a deploy-ului, a serviciilor externe și deciziile de produs din lansarea Mono.

## Reguli scurte

- Lucrezi din `origin/main`, pe un branch nou, apoi PR. Nu face merge la `feat/mono-launch` (e deja în `main`). Nu face `git pull` pe un `main` local vechi — vezi `HANDOFF.md` §0.1.
- Deploy-ul e **manual** (Actions → CI → Run workflow pe `main`). Un merge nu publică nimic pe moneo.bond.
- UI nou = limbaj **Mono** (`src/mono/`). Nu reintroduce `TopNav` sau stilurile vechi `.card` pe ecrane noi.
- **Atmosfere:** doar culori/tokeni; același layout Focus pe toate temele. Default: `ritual`.
- i18n: orice text UI nou → cheie în `src/lib/i18n/locales/en.ts` **și** în celelalte 7 limbi (altfel pică `tsc`). Convenție chei Mono: `goal.*`, `proj.*`, `task.*`, `rep.*`, `cal.*`, `mono.*`.
- Fără secrete în cod sau în `VITE_*`. Secretele worker-ului se pun doar cu `wrangler secret put`. `.env.local` nu se comite.
- Erori frontend: `src/lib/errorReporting.ts` (nu adăuga `@sentry/react`).
- Teste noi: `*.test.ts` (nu `.tsx`). Teste E2E în `e2e/` pentru interfața Mono.
- Dev: `npm run dev` → **http://localhost:3000**. După edit `.env.local`, restart complet Vite.
- Ops: `OPS-LAUNCH.md` + `LAUNCH-9.md`.
- Înainte de PR: prettier, `npm run lint`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`, `npm run secret-scan`.
- Pe Windows/PowerShell 5.1: fără `&&`; înlănțuiește cu `cmd1; if ($?) { cmd2 }`.
