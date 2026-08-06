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
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TasteFormReveal } from './TasteForm';
import FeedCard from './FeedCard';
import ExplainModal from './ExplainModal';
import { ArrowLeftIcon } from './icons';
import { useLang, cuisineLabel } from '@/lib/i18n';
import { useShrinkToFitWidth } from '@/lib/shrinkToFit';
import { type PublicDossier as Dossier } from '@/lib/dossier';

export default function PublicDossier({ dossier, isOwner }: { dossier: Dossier; isOwner: boolean }) {
  const { t, lang } = useLang();
  const router = useRouter();
  const identityRef = useRef<HTMLSpanElement>(null);
  useShrinkToFitWidth(identityRef, dossier.usernameDisplay);
  // Local-only: which anchors THIS visitor has bookmarked this load, mirroring
  // FeedList.tsx's own pattern (FeedCard reports back via onBookmarked).
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  // Which stat box's explainer is open — same tap-a-glyph-to-learn-more
  // pattern TasteFormCard's own stat-row uses.
  const [openStat, setOpenStat] = useState<null | 'strength' | 'flicks' | 'cuisines' | 'senses'>(null);

  const d = dossier;
  const label = (k: string) => t(`dim.${k}`);
  // Top cuisine affinities for the cuisines stat's explainer — the SAME
  // derivation TasteFormCard's own openStat==='cuisines' extra uses.
  const topCuisines = Object.entries(d.affinity).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div>
      {/* Entry from the feed's author chop/name, but ALSO from a bare shared
          link (messenger, sharing batch) with no in-app history to go back
          to — router.back() there just no-ops or strands the visitor on a
          host page outside the app. Always the same destination instead:
          大家食, the one place every visitor (owner browsing their own
          dossier included) actually wants to land. Sized/set to literally
          match the page-title font (h1's own family/weight/letter-spacing/
          size — --fs-title-b) rather than a small icon-btn, since it's the
          page's only chrome. */}
      <button type="button" className="dossier-back" onClick={() => router.push('/?tab=feed')} aria-label={t('dossier.back')}>
        <ArrowLeftIcon size={30} />
      </button>
      {/* The blob's OWN card shell (.taste-form-card + .taste-blob-anchor) —
          the exact container Taste AI's TasteFormCard uses, not .card/.card-body
          restyled to look similar. EXACTLY Taste AI's card now, stat grid and
          version bar included (owner call: these are food-engine numbers, no
          more privacy weight than the vector/evidence already public for the
          blob) — only the rename pencil and the install/export section are
          skipped: renaming is an owner-authenticated action irrelevant to a
          visitor, and decision 3's hard rule 2 amendment forbids a copy-for-AI
          path on this page regardless of who's viewing. */}
      {/* -10px: pulls the card up closer to the back arrow (own call — the
          gap the arrow's own marginBottom left read as too loose here). */}
      <div className="taste-form-card card-reveal" style={{ marginTop: -10 }}
        onAnimationEnd={e => { e.currentTarget.style.animation = 'none'; }}>
        <div className="taste-blob-anchor">
          <TasteFormReveal
            inputs={{ vector: d.vector, evidence: d.evidence, ratingCount: d.ratingCount, seed: `${d.username}:v${d.version}` }}
            size={190}
            labelFor={label}
            domains={d.domain_evidence}
            growthMode="metabolism"
          />
        </div>
        <div className="version-line" style={{ marginTop: 10 }}>
          <span className="username-identity" ref={identityRef}>dishi.{d.usernameDisplay}</span>
        </div>
        <div className="version-line" style={{ marginTop: 6 }}>
          <span className="version-now">V{d.version}</span>
          <div className="taste-form-legend" style={{ marginTop: 0 }}>
            <span><span className="dot dot-knows" />{t('buddy.knows.count', { n: d.knowsCount })}</span>
            <span><span className="dot dot-learning" />{t('buddy.learning.count', { n: d.learningCount })}</span>
          </div>
        </div>

        <div className="version-bar-row">
          <div className="xp-bar" role="progressbar" aria-valuenow={Math.round(d.versionProgress * 100)}
            aria-valuemin={0} aria-valuemax={100}
            aria-label={`dishi v${d.version} → v${d.version + 1}`}
            style={{ flex: 1 }}>
            <div className="xp-fill" style={{ width: `${d.versionProgress * 100}%` }} />
          </div>
          <span className="version-next">V{d.version + 1}</span>
        </div>

        <div className="stat-row stat-row-tappable" style={{ marginTop: 20, marginBottom: 0 }}>
          {([
            { key: 'strength' as const, num: `${d.strength}%`, label: t('buddy.strength') },
            { key: 'flicks' as const, num: `${d.ratingCount}`, label: t('buddy.flicks') },
            { key: 'cuisines' as const, num: `${d.cuisineCount}`, label: t('buddy.cuisines') },
            { key: 'senses' as const, num: `${d.dimsExplored}/${d.dimsTotal}`, label: t('buddy.senses') },
          ]).map(s => (
            <button key={s.key} type="button" className="stat taste-stat stat-tap"
              onClick={() => setOpenStat(v => (v === s.key ? null : s.key))}
              aria-expanded={openStat === s.key} aria-label={`${s.label}: ${t(`buddy.explain.${s.key}`, { total: d.dimsTotal })}`}>
              <div className="stat-num">{s.num}</div>
              <div className="stat-label">{s.label}</div>
            </button>
          ))}
          {openStat && (
            <ExplainModal
              title={t(`buddy.${openStat}`)}
              body={t(`buddy.explain.${openStat}`, { total: d.dimsTotal })}
              onClose={() => setOpenStat(null)}
              extra={openStat === 'cuisines' && topCuisines.length > 0 ? (
                <div className="explain-modal-chips">
                  {topCuisines.map(([c, v]) => (
                    <span className={`chip ${v > 0 ? 'on' : ''}`} key={c}>
                      {cuisineLabel(c, lang) || c} {v > 0 ? '↑' : '↓'}
                    </span>
                  ))}
                </div>
              ) : undefined}
            />
          )}
        </div>
      </div>

      {/* The posted dishes — every one is something this person chose to
          publish (lib/dossier.ts). PHOTO-FORWARD FORMAT (owner, 2026-07-28):
          FeedCard, the EXACT 大家食 card — mounted directly (own correction:
          no card/card-body wrapper around it either, since 大家食 itself has
          none; a card-in-a-card double-border is not "the same card"). */}
      {d.anchors.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {/* .label's own weight/color, sized up one step (--fs-caption →
              --fs-body) and centered — this is the section's own headline,
              not a quiet meta caption anymore now that it names the person. */}
          <p className="label" style={{ margin: '0 0 8px', textAlign: 'center', fontSize: 'var(--fs-body)' }}>
            {t('dossier.anchors', { name: d.usernameDisplay })}
          </p>
          {d.anchors.map(a => (
            <FeedCard
              key={a.id}
              item={{
                id: a.id,
                author: { kind: 'user', username: d.username, usernameDisplay: d.usernameDisplay },
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
