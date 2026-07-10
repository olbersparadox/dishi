'use client';
import { useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';

/**
 * Replaces the raw <input type="file"> ("Choose file / No file chosen") with a
 * proper upload affordance. Key detail: the hidden input deliberately has NO
 * `capture` attribute — with it, mobile browsers jump straight to the camera;
 * without it, iOS and Android natively present "Take Photo / Photo Library /
 * Browse", which is exactly the camera-or-roll choice wanted, with zero custom
 * action-sheet code to maintain.
 */
export default function PhotoPicker({
  onPick,
  disabled = false,
}: {
  onPick: (file: File) => void;
  disabled?: boolean;
}) {
  const { t } = useLang();
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`photo-picker ${picked ? 'picked' : ''}`}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="photo-picker-icon">
          {picked ? (
            <path d="M9 16.2l-3.5-3.5L4 14.2 9 19.2 20 8.2l-1.5-1.5z" fill="currentColor" />
          ) : (
            <>
              <path d="M12 16V5m0 0l-4 4m4-4l4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </>
          )}
        </svg>
        <span>{picked ? t('upload.change') : t('upload.tap')}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) { setPicked(true); onPick(f); }
          // allow re-picking the same file
          e.target.value = '';
        }}
      />
    </>
  );
}
