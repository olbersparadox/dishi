/**
 * Dumps the owner's REAL palate export doc to a paste-ready file, for the
 * owner-manual protocol cells (docs/rnd/manual-cell-protocol.md).
 *
 * Why not just tap Export in the app: that button POSTs /api/taste/export,
 * which is the real export event and ADVANCES THE DELTA BASELINE
 * (TasteFormCard.copyDoc). A measurement run must not move the version the
 * user sees, so this reads profile_version instead of minting a new export.
 * The doc text itself is identical — same extractTasteSections +
 * buildTastePrompt the card calls.
 *
 * Output goes to docs/rnd/probe-runs/, which is gitignored: the doc carries
 * real ratings, restaurant names and companion display names, and this repo is
 * public.
 *
 * RUN:
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/dump-export-doc.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { buildExportDoc } from './exportDoc';

const OWNER = process.env.PROBE_USER_ID ?? '4d1c3ae0-47d9-4cba-b35e-179c134271bf';

(async () => {
  const { doc, ratingCount, username, version } = await buildExportDoc(OWNER);

  const dir = 'docs/rnd/probe-runs';
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  // The file is ONLY the doc — no header, no fences, nothing to strip. It gets
  // select-all-copied into a Project instructions field, and any commentary
  // above it would silently become part of the document under test.
  const path = `${dir}/manual-cell-instructions-v${version ?? '?'}-${stamp}.txt`;
  writeFileSync(path, doc);

  const container = username ? `dishi.${username}` : 'dishi (UNCLAIMED — see below)';
  console.log(`\nPaste-ready doc written to:\n  ${path}\n`);
  console.log(`  container name : ${container}`);
  console.log(`  doc version    : v${version ?? '?'}`);
  console.log(`  rated dishes   : ${ratingCount}`);
  console.log(`  doc size       : ${doc.length} chars`);
  if (!username) {
    console.log(`\n  WARNING: the profile has no CLAIMED username (username_set_at is null), so the`);
    console.log(`  doc is anonymous. That is a DIFFERENT document from the one a claimed user`);
    console.log(`  installs — claim a username first, or record that this cell tested the`);
    console.log(`  anonymous variant.`);
  }
  console.log(`\nNext: docs/rnd/manual-cell-protocol.md`);
})();
