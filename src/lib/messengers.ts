// The messenger marks on the share swipe (sharing batch item 4b).
//
// ILLUSTRATIVE, NOT FUNCTIONAL — this is the whole reason the design is
// honest. The row is ONE button: every tap opens the OS share sheet, and
// these marks say "this goes to someone on a messenger", they do not claim
// four per-app integrations. Per-app deep-linking was proposed in review and
// REJECTED by the owner, correctly: WhatsApp/Telegram/Line have web share
// targets but WeChat has none, so a per-app row would have had one button
// that quietly behaved differently from the other three. Do not "improve"
// this into four separate buttons — see BACKLOG, "Settled inputs".
//
// ── ASSET CONTRACT ────────────────────────────────────────────────────────
// These files are deliberately NOT in the repo. They are registered
// trademarks and must come from each brand's own official brand-resource
// page — do NOT draw approximations, which would be both wrong-looking and
// an infringement. The same rule produced public/ai-logos/, which the owner
// supplied the same way.
//
// Dropping the files in is the ONLY step: each <img> hides itself on error
// (see TasteFormCard), so today the row renders label-only and fully works,
// a partial set degrades cleanly, and a complete set appears with no code
// change. If a file you have is a different format, edit its `logo` line
// here — the path is the contract, not the extension.
export type MessengerMark = {
  id: string;
  /** Accessible name; also the alt text if the mark ever needs one. */
  label: string;
  /** Public path. Missing file = the mark silently doesn't render. */
  logo: string;
};

export const MESSENGER_MARKS: MessengerMark[] = [
  { id: 'whatsapp', label: 'WhatsApp', logo: '/msg-logos/logo-whatsapp.webp' },
  { id: 'telegram', label: 'Telegram', logo: '/msg-logos/logo-telegram.webp' },
  { id: 'wechat', label: 'WeChat', logo: '/msg-logos/logo-wechat.webp' },
  { id: 'line', label: 'LINE', logo: '/msg-logos/logo-line.webp' },
];
