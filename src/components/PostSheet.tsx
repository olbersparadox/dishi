'use client';
// 貼文 — the publish sheet. One dish, one deliberate act: this is the consent
// event that puts a dish on dishi.<name>, and unpublishing here deletes it.
//
// Mounts inside the shared ExplainModal (same scrim, same paper card, same
// dismissal as UsernameSheet and every other explainer) and styles with
// existing classes only — .field, .label, and (owner call) the EXACT
// Cancel/Save icon-circle pair every dish/restaurant name-edit site uses
// (.icon-btn.cancel + .icon-btn.save/.dirty). No new CSS.
//
// The VERDICT is shown before you publish, never derived silently: a post may
// carry any verdict (owner call 2026-07-28), so a person publishing 唔啱我 must
// see that word here — the public page will print it.
import { useState } from 'react';
import { useLang } from '@/lib/i18n';
import ExplainModal from './ExplainModal';
import DishName from './DishName';
import { GlobeIcon, CloseIcon } from './icons';
import { wordKeyFor } from '@/lib/flickWords';
import { POST_REASON_MAX, normalizeReason } from '@/lib/posts';

export default function PostSheet({ dish, mode = 'publish', onClose, onSaved }: {
  dish: { id: string; name: string; name_zh: string | null; score: number; posted: boolean; reason: string | null };
  /** 'publish' — the globe: goes on the dossier, the feed and the persona pool.
   *  'share'   — the Share item: creates a LINK-ONLY post, reachable at its
   *              permalink and nowhere else (sharing batch item 2).
   *
   *  Same sheet either way, deliberately. Sharing to one friend is still a
   *  publication carrying a verdict about a real restaurant, so the person
   *  must see that verdict word before consenting — the rule that made this
   *  sheet exist does not weaken because the audience is smaller. Only the
   *  framing and the tier differ. */
  mode?: 'publish' | 'share';
  onClose: () => void;
  /** posted=false means the dish was unpublished. */
  onSaved: (dishId: string, posted: boolean, reason: string | null, visibility?: 'public' | 'link') => void;
}) {
  const { t } = useLang();
  const [reason, setReason] = useState(dish.reason ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verdict = t(wordKeyFor(dish.score));
  const cleaned = normalizeReason(reason);
  const dirty = cleaned !== (dish.reason ?? null);

  const visibility = mode === 'share' ? 'link' : 'public';

  const publish = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dish_id: dish.id, reason: cleaned, visibility }),
      });
      if (!res.ok) { setError(t('post.failed')); return; }
      // The server's answer, not the request: visibility only ever upgrades
      // (mergeVisibility), so sharing an already-public dish comes back
      // 'public' and the row must not redraw itself as link-only.
      const saved = await res.json().catch(() => null);
      onSaved(dish.id, true, cleaned, saved?.post?.visibility ?? visibility);
      onClose();
    } catch {
      setError(t('post.failed'));
    } finally {
      setSaving(false);
    }
  };

  const unpublish = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts?dish_id=${encodeURIComponent(dish.id)}`, { method: 'DELETE' });
      if (!res.ok) { setError(t('post.failed')); return; }
      onSaved(dish.id, false, null);
      onClose();
    } catch {
      setError(t('post.failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ExplainModal
      title={t(mode === 'share' ? 'post.share.title' : 'post.title')}
      body={t(mode === 'share' ? 'post.share.body' : 'post.body')}
      extra={
        <>
          {/* Same dish-name treatment 食自己 uses — .card-title + DishName,
              not a hand-rolled bold <p> — so what's about to publish reads
              exactly like the row it came from. The verdict word itself
              isn't shown here (owner call) — it still drives the reason
              placeholder below. */}
          <div className="card-title" style={{ marginTop: 12 }}>
            <DishName name={dish.name} name_zh={dish.name_zh} />
          </div>
          {dish.score < 0 && (
            // Said out loud rather than left to be discovered on the page: the
            // person is publishing a bad verdict about a real restaurant.
            <p className="label" style={{ margin: '6px 0 0' }}>{t('post.negative.note')}</p>
          )}
          <textarea
            className="field"
            style={{ marginTop: 12, width: '100%', minHeight: 64, resize: 'none' }}
            maxLength={POST_REASON_MAX}
            placeholder={t('post.reason.placeholder', { verdict })}
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
          {error && <p style={{ color: 'var(--lacquer)', fontSize: 12.5, margin: '6px 0 0' }}>{error}</p>}
        </>
      }
      footer={
        // The EXACT same Cancel(✕)/Save(✓) circle pair every dish/restaurant
        // name-edit site uses (.icon-btn.cancel left, .icon-btn.save right,
        // save turning vermillion via .dirty the moment the reason actually
        // changes) — not a new button shape. 收回/unpublish only exists once
        // there's something posted to take back.
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
          {dish.posted && (
            <button type="button" className="icon-btn cancel" disabled={saving}
              onClick={unpublish} aria-label={t('post.unpublish')} title={t('post.unpublish')}>
              <CloseIcon size={16} />
            </button>
          )}
          <button type="button"
            className={`icon-btn save${dish.posted && dirty ? ' dirty' : ''}`}
            disabled={saving}
            onClick={publish}
            aria-label={dish.posted ? t('post.update') : t(mode === 'share' ? 'post.share.cta' : 'post.publish')}
            title={dish.posted ? t('post.update') : t(mode === 'share' ? 'post.share.cta' : 'post.publish')}>
            {saving ? <span className="icon-btn-spinner" aria-hidden /> : <GlobeIcon size={16} />}
          </button>
        </div>
      }
      onClose={onClose}
    />
  );
}
