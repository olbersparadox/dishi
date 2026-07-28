'use client';
// The shared-dish permalink's render half (sharing batch item 3).
//
// Deliberately thin. The dish itself is a FeedCard — the SAME component the
// 大家 feed and the public dossier already mount for a posted dish — which
// means the author line, the photo, the verdict word, the reason, the chips
// and the bookmark all arrive identical to everywhere else, including the
// author link back to the full dossier. Nothing here re-implements a card.
//
// What differs from PublicDossier is EMPHASIS, not parts: the shared thing is
// one dish, so it leads, and the palate behind it is a link rather than a
// blob. Burying the dish someone was actually sent under a stats card would
// be the wrong page.
import { useState } from 'react';
import Link from 'next/link';
import FeedCard from './FeedCard';
import { useLang } from '@/lib/i18n';
import { type DossierAnchor } from '@/lib/dossier';

export default function PublicDish({ anchor, username, isOwner }: {
  anchor: DossierAnchor;
  username: string;
  isOwner: boolean;
}) {
  const { t } = useLang();
  // Mirrors PublicDossier/FeedList: FeedCard reports a successful bookmark
  // back, and this load remembers it so the button settles.
  const [bookmarked, setBookmarked] = useState(false);

  return (
    <div>
      {/* No back button, unlike the dossier: a visitor arriving from a
          messenger has no in-app history to go back TO, so router.back()
          would leave the app. The way onward is the author line inside the
          card (FeedCard links it to /[username]) plus the CTA below. */}
      <FeedCard
        item={{
          id: anchor.id,
          author: { kind: 'user', username },
          dish: {
            id: anchor.id,
            name: anchor.name,
            name_zh: anchor.name_zh,
            restaurant: anchor.restaurant,
            cuisine: null,
            photo_url: anchor.photo_url,
            attributes: {},
            diet: anchor.diet,
            heaviness: anchor.heaviness,
            ingredients: anchor.ingredients,
          },
          verdict: anchor.verdict,
          reason: anchor.reason,
          own: isOwner,
          bookmarked,
        }}
        onBookmarked={() => setBookmarked(true)}
      />

      {/* The palate behind the dish. A visitor who liked this take is one tap
          from the whole thing — the dossier is the deeper artifact and this
          page is the doorway to it. */}
      <p className="card-meta" style={{ textAlign: 'center', margin: '14px 0 0' }}>
        <Link href={`/${username}`} style={{ color: 'var(--ink)' }}>
          {t('dossier.dish.more', { name: username })}
        </Link>
      </p>

      {/* The same acquisition line the dossier carries, and for the same
          reason — quiet, not a wall. Not shown to the owner, who has one. */}
      {!isOwner && (
        <p className="card-meta" style={{ textAlign: 'center', margin: '18px 0' }}>
          <a href="/" style={{ color: 'var(--ink)' }}>{t('dossier.cta')}</a>
        </p>
      )}
    </div>
  );
}
