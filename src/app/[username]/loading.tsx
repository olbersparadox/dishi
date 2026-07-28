// Next.js App Router loading state: shown INSTANTLY on navigation (from a
// feed post's chop/name, per FeedCard.tsx) while the server component above
// resolves the dossier (an admin-client fetch — see page.tsx's own notes on
// why it's server-side). Without this file the tap did nothing visible for
// however long that fetch took; this fills the same wait with the page's own
// shape instead of a blank screen.
//
// Reuses the SAME skeleton pieces the real content mounts a moment later
// (TasteCardSkeleton from TasteFormCard.tsx, FeedSkeleton from FeedList.tsx)
// rather than inventing lookalikes — both cards already exist verbatim on
// this page (PublicDossier.tsx mounts .taste-form-card + FeedCard for real).
import { TasteCardSkeleton } from '@/components/TasteFormCard';
import { FeedSkeleton } from '@/components/FeedList';

export default function DossierLoading() {
  return (
    <div aria-hidden>
      <span className="skel-box" style={{ display: 'block', width: 30, height: 30, borderRadius: 8, marginBottom: 16 }} />
      <TasteCardSkeleton />
      <div style={{ marginTop: 14 }}>
        <FeedSkeleton />
      </div>
    </div>
  );
}
