'use client';
// 大家 — the feed tab's list. Fetches the ranked pool once per mount and
// renders one FeedCard per item, whatever the author type.
//
// Three states, all of them said out loud (binding amendment: an unattended
// feed needs a visible failure path and a legitimate "nothing good today"):
//  - training: the engine hasn't earned the right to claim a match yet, and
//    says how far off it is instead of ranking anyway.
//  - empty: honestly empty. Weak matches are dropped, not padded, so an empty
//    feed is a real answer — never filler.
//  - failed: the fetch broke. Silence would read exactly like "nothing today".
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n';
import FeedCard from './FeedCard';
import type { RankedFeedItem } from '@/lib/feed';

type Item = RankedFeedItem & { bookmarked?: boolean };
type State =
  | { kind: 'loading' }
  | { kind: 'training'; needed: number; items: Item[]; personaStatus: string }
  | { kind: 'ready'; items: Item[]; personaStatus: string }
  | { kind: 'failed' };

export default function FeedList() {
  const { t, lang } = useLang();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let live = true;
    fetch(`/api/feed?lang=${lang}`)
      .then(r => r.json())
      .then(j => {
        if (!live) return;
        const items = j.items ?? [];
        const personaStatus = j.persona_status ?? 'missing';
        if (j.stage === 'training') {
          setState({
            kind: 'training', items, personaStatus,
            needed: Math.max(0, (j.needed ?? 0) - (j.rating_count ?? 0)),
          });
        } else {
          setState({ kind: 'ready', items, personaStatus });
        }
      })
      .catch(() => { if (live) setState({ kind: 'failed' }); });
    return () => { live = false; };
  }, [lang]);

  if (state.kind === 'loading') return <p className="card-meta">{t('feed.loading')}</p>;
  if (state.kind === 'failed') return <p className="card-meta">{t('feed.failed')}</p>;

  // The daily job breaking must not look like a quiet day. 'empty' is honest
  // silence and says nothing extra; 'failed' and a missing run both say so.
  const jobBroke = state.personaStatus === 'failed' || state.personaStatus === 'missing';

  if (state.items.length === 0) {
    return (
      <>
        {state.kind === 'training'
          ? <p className="card-meta">{t('feed.training', { n: state.needed })}</p>
          : <p className="card-meta">{t('feed.empty')}</p>}
        {jobBroke && <p className="card-meta">{t('feed.persona.failed')}</p>}
      </>
    );
  }

  return (
    <>
      {state.kind === 'training' && (
        // Persona cards claim no match, so they show under the bar — but the
        // reason the rest is missing is stated rather than left as a short list.
        <p className="card-meta" style={{ marginBottom: 10 }}>{t('feed.training', { n: state.needed })}</p>
      )}
      {state.items.map(item => (
        <FeedCard
          key={item.id}
          item={item}
          onBookmarked={id => setState(s => (s.kind === 'ready' || s.kind === 'training')
            ? { ...s, items: s.items.map(i => i.id === id ? { ...i, bookmarked: true } : i) }
            : s)}
        />
      ))}
    </>
  );
}
