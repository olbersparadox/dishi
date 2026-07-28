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
  | { kind: 'training'; needed: number }
  | { kind: 'ready'; items: Item[] }
  | { kind: 'failed' };

export default function FeedList() {
  const { t } = useLang();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let live = true;
    fetch('/api/feed')
      .then(r => r.json())
      .then(j => {
        if (!live) return;
        if (j.stage === 'training') {
          setState({ kind: 'training', needed: Math.max(0, (j.needed ?? 0) - (j.rating_count ?? 0)) });
        } else {
          setState({ kind: 'ready', items: j.items ?? [] });
        }
      })
      .catch(() => { if (live) setState({ kind: 'failed' }); });
    return () => { live = false; };
  }, []);

  if (state.kind === 'loading') return <p className="card-meta">{t('feed.loading')}</p>;
  if (state.kind === 'failed') return <p className="card-meta">{t('feed.failed')}</p>;
  if (state.kind === 'training') return <p className="card-meta">{t('feed.training', { n: state.needed })}</p>;
  if (state.items.length === 0) return <p className="card-meta">{t('feed.empty')}</p>;

  return (
    <>
      {state.items.map(item => (
        <FeedCard
          key={item.id}
          item={item}
          onBookmarked={id => setState(s => s.kind === 'ready'
            ? { ...s, items: s.items.map(i => i.id === id ? { ...i, bookmarked: true } : i) }
            : s)}
        />
      ))}
    </>
  );
}
