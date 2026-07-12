import { useEffect, useState } from 'react';
import { groupIndicesByColumn, type NormalizedBox } from './bbox';
import { detectRowBands, envelopeFilter, partitionByLargestGaps, matchBandsToBoxes, applySnap } from './rowSnap';

/**
 * Row-snap a set of grounded boxes against the ACTUAL photo, client-side.
 *
 * Single source of truth for the pipeline validated in /dev/bbox: raw pixel row
 * detection -> per-column envelope filter -> parameter-free largest-gap grouping
 * -> ordinal/monotonic matching -> position correction. Used by both the dev
 * harness and the real menu-scan overlay so the two can never drift apart — a fix
 * proven in the harness is automatically live in production the moment this hook
 * is used, with no separate port-and-hope step.
 *
 * Purely a rendering-time correction: never changes which dishes exist or their
 * text/scores, only WHERE their box is drawn. Degrades silently to "no
 * correction" (returns {}) on any failure — a canvas error should never crash the
 * scan the person is trying to use.
 */
export function useRowSnap(
  boxes: (NormalizedBox | null)[],
  imgEl: HTMLImageElement | null,
  ready: boolean,
): Record<number, NormalizedBox> {
  const [snapped, setSnapped] = useState<Record<number, NormalizedBox>>({});

  useEffect(() => {
    if (!imgEl || !ready) { setSnapped({}); return; }
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = imgEl.naturalWidth; canvas.height = imgEl.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx || canvas.width === 0 || canvas.height === 0) return;
        ctx.drawImage(imgEl, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const boxed = boxes
          .map((box, i) => ({ i, box }))
          .filter((x): x is { i: number; box: NormalizedBox } => x.box !== null);
        if (boxed.length === 0) return;

        const avgBoxHeightPx = (boxed.reduce((s, x) => s + x.box.h, 0) / boxed.length) * canvas.height;
        const rawBandsPx = detectRowBands(imageData, avgBoxHeightPx);

        const normBoxes = boxed.map(x => x.box);
        const columns = groupIndicesByColumn(normBoxes);
        const next: Record<number, NormalizedBox> = {};
        for (const col of columns) {
          const sorted = [...col].sort((a, b) => normBoxes[a].y - normBoxes[b].y);
          const modelYsPx = sorted.map(idx => (normBoxes[idx].y + normBoxes[idx].h / 2) * canvas.height);
          const envLo = Math.min(...modelYsPx) - avgBoxHeightPx;
          const envHi = Math.max(...modelYsPx) + avgBoxHeightPx;
          const groupedPx = partitionByLargestGaps(envelopeFilter(rawBandsPx, envLo, envHi), sorted.length);
          const matchedPx = matchBandsToBoxes(modelYsPx, groupedPx, avgBoxHeightPx * 0.7);
          sorted.forEach((idx, k) => {
            const itemIndex = boxed[idx].i;
            const boxPx = {
              x: normBoxes[idx].x * canvas.width, y: normBoxes[idx].y * canvas.height,
              w: normBoxes[idx].w * canvas.width, h: normBoxes[idx].h * canvas.height,
            };
            const snappedPx = applySnap(boxPx, matchedPx[k]);
            next[itemIndex] = {
              x: snappedPx.x / canvas.width, y: snappedPx.y / canvas.height,
              w: snappedPx.w / canvas.width, h: snappedPx.h / canvas.height,
            };
          });
        }
        if (!cancelled) setSnapped(next);
      } catch {
        // CORS-tainted canvas, decode failure, etc. — degrade to unsnapped rather
        // than crash whatever screen invoked this.
        if (!cancelled) setSnapped({});
      }
    };

    if (imgEl.complete) run(); else imgEl.onload = run;
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgEl, ready, JSON.stringify(boxes)]);

  return snapped;
}
