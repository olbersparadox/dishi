'use client';
// 貼文 — the publish sheet. One dish, one deliberate act: this is the consent
// event that puts a dish on dishi.<name>, and unpublishing here deletes it.
//
// PUBLISH ONLY (owner call — simplified sharing): this used to also serve
// Share in a 'share' mode (same card, framed as a link-only post). Share no
// longer opens any sheet at all — MyDishes.tsx's shareDish() silently
// upgrades an unposted dish to link-only and hands the permalink straight to
// the OS share sheet, no comment prompt. This sheet is now the ONE deliberate
// act left: going public (and everything that implies — see post.body).
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
import { GlobeIcon, GlobeOffIcon } from './icons';
import { wordKeyFor } from '@/lib/flickWords';
import { POST_REASON_MAX, normalizeReason } from '@/lib/posts';

export default function PostSheet({ dish, onClose, onSaved }: {
  dish: {
    id: string; name: string; name_zh: string | null; score: number; posted: boolean; reason: string | null;
    photo_url?: string | null;
  };
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

  const publish = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dish_id: dish.id, reason: cleaned, visibility: 'public' }),
      });
      if (!res.ok) { setError(t('post.failed')); return; }
      // The server's answer, not the request: a dish shared as link-only
      // first (Share, simplified — no sheet) still comes back correctly once
      // this same act upgrades it to public (mergeVisibility never
      // downgrades, only the response says which tier actually landed).
      const saved = await res.json().catch(() => null);
      onSaved(dish.id, true, cleaned, saved?.post?.visibility ?? 'public');
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
      title={t('post.title')}
      body={t('post.body')}
      extra={
        <>
          {/* Same dish-name treatment 食自己 uses — .card-title + DishName,
              not a hand-rolled bold <p> — so what's about to publish reads
              exactly like the row it came from, now with the SAME photo
              thumbnail (.journal-photo) beside it (owner call). The verdict
              word itself isn't shown here — it still drives the reason
              placeholder below. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            {dish.photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={dish.photo_url} alt="" className="journal-photo" style={{ width: 48, height: 48, flexShrink: 0 }} />
            )}
            <div className="card-title">
              <DishName name={dish.name} name_zh={dish.name_zh} />
            </div>
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
            // GlobeOffIcon, not a generic ✕ (owner call) — the action is
            // specifically "take this off the public page", not a plain
            // cancel, so the icon says so.
            <button type="button" className="icon-btn cancel" disabled={saving}
              onClick={unpublish} aria-label={t('post.unpublish')} title={t('post.unpublish')}>
              <GlobeOffIcon size={16} />
            </button>
          )}
          <button type="button"
            className={`icon-btn save${dish.posted && dirty ? ' dirty' : ''}`}
            disabled={saving}
            onClick={publish}
            aria-label={dish.posted ? t('post.update') : t('post.publish')}
            title={dish.posted ? t('post.update') : t('post.publish')}>
            {saving ? <span className="icon-btn-spinner" aria-hidden /> : <GlobeIcon size={16} />}
          </button>
        </div>
      }
      onClose={onClose}
    />
  );
}
