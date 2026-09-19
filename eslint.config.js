import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'cloudflare/workers/index.ts',
      // Compiled worker artifact (from `tsc` build in cloudflare/workers).
      'cloudflare/workers/**/*.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        Buffer: 'readonly',
      },
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // Classic Rules-of-Hooks (valuable, stable). The experimental
      // React-Compiler style rules (refs/purity/immutability/
      // set-state-in-effect/preserve-manual-memoization) are intentionally
      // not enabled — they would demand a full effect refactor.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/refs': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
  {
    rules: {
      // Deliberate defensive-init pattern (e.g. `let x = null; try { x = await f() }`)
      'no-useless-assignment': 'off',
      // TS strict mode already guarantees type safety; keep the lint discover-fast.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
]);