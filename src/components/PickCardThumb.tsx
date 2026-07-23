'use client';
import { CameraIcon } from './icons';
import { useLang } from '@/lib/i18n';

/**
 * Photo slot for a 待評 pick-card (field-session fix 2026-07-23) — the card
 * previously showed no photo at all. Quiet and passive, same paper-inset fill
 * as the journal's own empty slot: the tap target is the camera BADGE pinned
 * to the corner, not the whole tile, since this row already carries its own
 * rate/delete actions. Rendered ONLY while `photoUrl` is null; a photo-bearing
 * pick shows the photo with no badge.
 */
export default function PickCardThumb({ photoUrl, uploading, onPick }: {
  photoUrl: string | null;
  uploading: boolean;
  /** Fires with the picked file (or null if the picker was dismissed empty). */
  onPick: (file: File | null) => void;
}) {
  const { t } = useLang();
  return (
    <div className="pick-card-thumb">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="pick-card-thumb-img" />
      ) : (
        <div className="pick-card-thumb-empty" />
      )}
      {!photoUrl && (
        <label className="pick-card-cam" title={t('home.addphoto')} aria-label={t('home.addphoto')}>
          <input type="file" accept="image/*" hidden disabled={uploading}
            onChange={e => onPick(e.target.files?.[0] ?? null)} />
          {uploading ? <span aria-hidden>…</span> : <CameraIcon size={12} strokeWidth={2} />}
        </label>
      )}
    </div>
  );
}
