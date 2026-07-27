# Menu corpus (R&D Phase 2 input)

Drop menu **photos** here (`.jpg` / `.png` / `.webp`, any filenames), then run:

```bash
set -a; source .env.local; set +a
npx tsx scripts/eval-menu-corpus-coverage.ts
```

No ordering or eating needed — this measures dish NAMES. Shop windows,
takeaway flyers, and photos taken walking down one street all work. 15–20
menus is a real sample.

The photos and `_scanned.json` are gitignored: images may carry location EXIF
and are someone's business material, so they stay local. Only this README is
committed.

Delete `_scanned.json` to force a rescan (it caches the expensive vision calls
so re-running the analysis is free).
