// The link-only tier (sharing batch item 2, owner call).
//
// Two things are pinned here, and the second is the one that will actually
// save someone:
//
//  1. mergeVisibility's upgrade-only rule. The write path is an upsert, so
//     without it a Share tap on an already-PUBLIC dish writes 'link' over
//     'public' and silently pulls that dish off its owner's dossier and out
//     of the feed. Sharing is never a request to publish something less.
//
//  2. That every read path which serves an audience OTHER than the owner
//     filters to 'public'. This is asserted at the source level because the
//     failure is invisible in any normal test: a link-only post leaking into
//     the feed still renders perfectly, it is simply in front of people it
//     was never offered to. A test that checked "public posts appear" would
//     pass against a missing filter — so these assert the filter's PRESENCE
//     per file, and the file list itself is the thing under test.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  mergeVisibility, asPostVisibility, POST_VISIBILITIES,
} from '../src/lib/posts';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

describe('mergeVisibility — the tier only ever goes up', () => {
  it('a share of an already-public dish leaves it public', () => {
    // THE regression this exists for.
    expect(mergeVisibility('public', 'link')).toBe('public');
  });

  it('publishing a link-only dish upgrades it', () => {
    expect(mergeVisibility('link', 'public')).toBe('public');
  });

  it('a first post takes the tier it asks for', () => {
    expect(mergeVisibility(null, 'link')).toBe('link');
    expect(mergeVisibility(undefined, 'public')).toBe('public');
  });

  it('re-sharing a link-only dish keeps it link-only — no accidental promotion', () => {
    expect(mergeVisibility('link', 'link')).toBe('link');
  });
});

describe('asPostVisibility — an old client cannot downgrade by omission', () => {
  it('anything unrecognised means public, the pre-tier behaviour', () => {
    for (const v of [undefined, null, '', 'private', 'unlisted', 7, {}]) {
      expect(asPostVisibility(v)).toBe('public');
    }
  });

  it('accepts exactly the two real tiers', () => {
    expect(POST_VISIBILITIES).toEqual(['public', 'link']);
    expect(asPostVisibility('link')).toBe('link');
    expect(asPostVisibility('public')).toBe('public');
  });
});

describe('every not-the-owner read path filters to the public tier', () => {
  // Each entry: the file, and what audience it serves. If a new public read
  // path is added without a filter, add it here — and if one of these ever
  // legitimately stops reading dish_posts, delete its entry rather than
  // loosening the assertion.
  const mustFilter = [
    ['../src/app/api/feed/route.ts', 'the 大家 feed — everyone'],
    ['../src/app/api/cron/persona-daily/route.ts', 'the persona sourcing pool — everyone'],
    ['../src/app/[username]/page.tsx', 'the public dossier — everyone'],
  ] as const;

  for (const [file, audience] of mustFilter) {
    it(`${file.split('/').slice(-2).join('/')} (${audience})`, () => {
      const src = read(file);
      expect(src).toMatch(/from\('dish_posts'\)/);
      expect(src).toMatch(/\.eq\('visibility',\s*'public'\)/);
    });
  }

  it('/api/bookmarks requires the dish to be published at all', () => {
    // Not a visibility filter — an EXISTENCE check. Before the share batch
    // this was absent and safe only by accident (every dish id a client could
    // obtain came from the feed). The permalink puts dish ids in URLs, so
    // without this, knowing an id would be enough to copy a stranger's
    // unpublished dish into your own queue. A link-only post DOES pass: its
    // intended audience is whoever holds the link, and bookmarking is what
    // the link exists to invite.
    const src = read('../src/app/api/bookmarks/route.ts');
    expect(src).toMatch(/from\('dish_posts'\)/);
    expect(src).not.toMatch(/\.eq\('visibility'/);
  });

  it("/api/my/dishes does NOT filter — the owner's own view of their own posts", () => {
    // The inverse assertion, and it matters: hiding a link-only post from the
    // person who made it is how someone loses track of what they shared.
    const src = read('../src/app/api/my/dishes/route.ts');
    expect(src).toMatch(/from\('dish_posts'\)/);
    expect(src).not.toMatch(/\.eq\('visibility'/);
    // It must still REPORT the tier, so the row can draw the right glyph.
    expect(src).toMatch(/dish_id, reason, visibility/);
    expect(src).toMatch(/post_visibility/);
  });
});
