'use client';
// The public dossier's render half (decision 3). Server page resolves + projects;
// this renders — REUSING the taste card's own pieces (TasteFormReveal blob in
// its OWN .taste-form-card shell, .persona-name identity type, .version-line,
// .chip rows, FeedCard for every posted dish), never lookalikes: a visitor
// should see the same objects the owner sees on their own Taste AI / 大家食
// tabs, because they ARE the same taste and the same posts.
//
// There is NO copy-for-AI action here (owner call 2026-07-28, amending
// decision 3's "one artifact, two readers"): the guardrail on that text was a
// standing behavioural instruction, the category Phase 0.5 measured hosts
// refusing — see lib/dossier.ts. A friend who trusts this palate should reach
// its posts. Do not add a copy/share-to-AI button to this page.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TasteFormReveal } from './TasteForm';
import FeedCard from './FeedCard';
import { ArrowLeftIcon } from './icons';
import { useLang, cuisineLabel } from '@/lib/i18n';
import { type PublicDossier as Dossier } from '@/lib/dossier';

export default function PublicDossier({ dossier, isOwner }: { dossier: Dossier; isOwner: boolean }) {
  const { t, lang } = useLang();
  const router = useRouter();
  // Local-only: which anchors THIS visitor has bookmarked this load, mirroring
  // FeedList.tsx's own pattern (FeedCard reports back via onBookmarked).
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());

  const d = dossier;
  const label = (k: string) => t(`dim.${k}`);
  const cuisine = (k: string) => cuisineLabel(k, lang) || k;

  return (
    <div>
      {/* Entry from the feed's author chop/name (own decision) — router.back()
          rather than a hardcoded link to "/" so it returns to whichever tab
          (大家食) the visitor actually came from, not always the default
          Private tab a plain "/" would land on. Sized/set to literally match
          the page-title font (h1's own family/weight/letter-spacing/size —
          --fs-title-b) rather than a small icon-btn, since it's the page's
          only chrome. */}
      <button type="button" className="dossier-back" onClick={() => router.back()} aria-label={t('dossier.back')}>
        <ArrowLeftIcon size={30} />
      </button>
      {/* The blob's OWN card shell (.taste-form-card + .taste-blob-anchor) —
          the exact container Taste AI's TasteFormCard uses, not .card/.card-body
          restyled to look similar (owner correction). The interactive
          strength/flicks/cuisines/senses stat grid stays on Taste AI only:
          those numbers aren't in the public projection (lib/dossier.ts) and
          decision 3's exposed-field list doesn't include them — this keeps
          the loves/avoids/cuisines summary that IS in the public contract. */}
      <div className="taste-form-card">
        <div className="taste-blob-anchor">
          <TasteFormReveal
            inputs={{ vector: d.vector, evidence: d.evidence, ratingCount: d.ratingCount, seed: `${d.username}:v${d.version}` }}
            size={190}
            vector={d.vector}
            labelFor={label}
          />
        </div>
        <div className="version-line" style={{ marginTop: 10, justifyContent: 'center' }}>
          <span className="username-claim-prefix">dishi.{d.username}</span>
        </div>
        <div className="version-line" style={{ marginTop: 6, justifyContent: 'center' }}>
          <span className="version-now">V{d.version}</span>
          <span className="card-meta">{t('buddy.knows.count', { n: d.knowsCount })}</span>
          <span className="card-meta">{t('dossier.fed', { n: d.ratingCount })}</span>
        </div>

        {(d.strongLoves.length > 0 || d.loves.length > 0) && (
          <div style={{ marginTop: 16 }}>
            <p className="label">{t('dossier.loves')}</p>
            <div className="explain-modal-chips" style={{ justifyContent: 'center' }}>
              {d.loves.slice(0, 6).map(k => (
                <span className={`chip ${d.strongLoves.includes(k) ? 'on' : ''}`} key={k}>{label(k)}</span>
              ))}
            </div>
          </div>
        )}
        {d.avoids.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p className="label">{t('dossier.avoids')}</p>
            <div className="explain-modal-chips" style={{ justifyContent: 'center' }}>
              {d.avoids.slice(0, 4).map(k => <span className="chip" key={k}>{label(k)}</span>)}
            </div>
          </div>
        )}
        {d.cuisines.length > 0 && (
          <p className="card-meta" style={{ marginTop: 12 }}>
            {t('dossier.cuisines', { list: d.cuisines.map(cuisine).join('、') })}
          </p>
        )}
      </div>

      {/* The posted dishes — every one is something this person chose to
          publish (lib/dossier.ts). PHOTO-FORWARD FORMAT (owner, 2026-07-28):
          FeedCard, the EXACT 大家食 card — mounted directly (own correction:
          no card/card-body wrapper around it either, since 大家食 itself has
          none; a card-in-a-card double-border is not "the same card"). */}
      {d.anchors.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p className="label" style={{ margin: '0 0 8px' }}>{t('dossier.anchors')}</p>
          {d.anchors.map(a => (
            <FeedCard
              key={a.id}
              item={{
                id: a.id,
                author: { kind: 'user', username: d.username },
                dish: {
                  id: a.id, name: a.name, name_zh: a.name_zh, restaurant: a.restaurant,
                  cuisine: null, photo_url: a.photo_url, attributes: {},
                  diet: a.diet, heaviness: a.heaviness, ingredients: a.ingredients,
                },
                verdict: a.verdict, reason: a.reason, own: isOwner,
                bookmarked: bookmarked.has(a.id),
              }}
              onBookmarked={id => setBookmarked(s => new Set(s).add(id))}
            />
          ))}
        </div>
      )}

      {/* The acquisition line the page exists to serve — quiet, not a wall. */}
      {!isOwner && (
        <p className="card-meta" style={{ textAlign: 'center', margin: '18px 0' }}>
          <a href="/" style={{ color: 'var(--ink)' }}>{t('dossier.cta')}</a>
        </p>
      )}
    </div>
  );
}
