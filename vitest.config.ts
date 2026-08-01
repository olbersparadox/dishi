import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Existing tests import via relative paths and need nothing here. The one
// exception is tests/tableComponentIdentity.test.tsx (2026-07-21, Table Mode
// item 1 correction), which renders real components — those import each
// other via the '@/...' alias (tsconfig `paths`), which vitest doesn't
// resolve on its own. Environment stays 'node' by default; that one test
// file opts into jsdom itself via a `// @vitest-environment jsdom` pragma.
export default defineConfig({
  test: {
    // Claude Code's worktrees are full checkouts of this repo living INSIDE it,
    // so vitest collects their tests/ too and runs the suite two or three times
    // over — once per stale worktree, at whatever commit it was abandoned on.
    // Measured 2026-08-01: `npm test` reported 87 failures, every one of them
    // from a worktree and none from the working tree. That is worse than noise;
    // it makes the "all tests must pass" gate unreadable and would bury a real
    // regression in phantom red.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/worktrees/**'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  // src/**/*.tsx never imports React (tsconfig targets Next's own SWC compiler,
  // which defaults to the automatic runtime) — esbuild needs telling explicitly
  // for the same files to work under vitest's own transform.
  esbuild: { jsx: 'automatic' },
});
