'use client';
// 大家 — the feed tab's list. Fetches the pool once per mount and renders one
// FeedCard per item, whatever the author type. Newest first (owner, 2026-07-28
// — see lib/feed.ts): no ranking, so no state that explains a ranking.
//
// Three states, all of them said out loud (binding amendment: an unattended
// feed needs a visible failure path and a legitimate "nothing yet"):
//  - loading
//  - empty: nobody has published anything the pool can show. A real answer,
//    never padded with filler.
//  - failed: the fetch broke. Silence would read exactly like "nothing yet".
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n';
import FeedCard from './FeedCard';
import type { FeedItem } from '@/lib/feed';

type Item = FeedItem & { bookmarked?: boolean };
type State =
  | { kind: 'loading' }
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
        setState({
          kind: 'ready',
          items: j.items ?? [],
          personaStatus: j.persona_status ?? 'missing',
        });
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
        <p className="card-meta">{t('feed.empty')}</p>
        {jobBroke && <p className="card-meta">{t('feed.persona.failed')}</p>}
      </>
    );
  }

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
