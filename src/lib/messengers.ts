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
// ── THE MARKS ────────────────────────────────────────────────────────────
// public/msg-logos/*.svg are the OFFICIAL brand glyphs, extracted from the
// simple-icons collection (CC0 icon data; the marks themselves remain each
// owner's trademark, used here nominatively to name a share destination —
// the same use every OS share sheet makes). They are committed as plain
// files, so there is no runtime dependency; simple-icons was installed to
// extract them and removed again.
//
// Do NOT hand-draw replacements: an approximated brand mark looks wrong and
// is an infringement. To refresh or add one, re-extract from simple-icons
// rather than editing the path data by hand.
export type MessengerMark = {
  id: string;
  /** Accessible name; also the alt text if the mark ever needs one. */
  label: string;
  /** Public path to the committed brand glyph. */
  logo: string;
};

export const MESSENGER_MARKS: MessengerMark[] = [
  { id: 'whatsapp', label: 'WhatsApp', logo: '/msg-logos/logo-whatsapp.svg' },
  { id: 'telegram', label: 'Telegram', logo: '/msg-logos/logo-telegram.svg' },
  { id: 'wechat', label: 'WeChat', logo: '/msg-logos/logo-wechat.svg' },
  { id: 'line', label: 'LINE', logo: '/msg-logos/logo-line.svg' },
];
