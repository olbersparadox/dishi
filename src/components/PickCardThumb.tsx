'use client';
import { useLang } from '@/lib/i18n';

/**
 * Photo slot for a 待評 pick-card (field-session fix 2026-07-23; matched to
 * the journal's own empty-photo tile 2026-07-30 — owner call: "follow the no
 * photo case from Journey"). Same treatment as MyDishes' journal-photo-add:
 * the whole tile is the tap target (a `<label>` wrapping a hidden file
 * input), showing a plain `+`. Rendered ONLY while `photoUrl` is null; a
 * photo-bearing pick shows the photo with no overlay.
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
        <label className="pick-card-thumb-add" title={t('home.addphoto')} aria-label={t('home.addphoto')}>
          <input type="file" accept="image/*" hidden disabled={uploading}
            onChange={e => onPick(e.target.files?.[0] ?? null)} />
          <span aria-hidden>{uploading ? '…' : '+'}</span>
        </label>
      )}
    </div>
  );
}
