// Design-system entry for /design-sync — NOT imported by the app.
//
// Dishi is a Next.js app, not a published component package, so there is no
// dist/ entry for the converter to bundle. This barrel is that entry: it
// re-exports the real components verbatim (no wrappers, no reimplementation)
// so window.Dishi.* carries exactly what the app itself renders.
//
// Scope: the presentational components — the ones that render without Supabase,
// a router, or a fetch. The 18 data-coupled ones (AuthGate, FeedList, MyDishes,
// RatingStack, DuelOverlay, …) are deliberately absent; they need mocked data to
// render at all, and a card that renders blank teaches the design agent nothing.
//
// Default exports are re-exported under their declared names because the design
// agent addresses components as window.Dishi.<Name>.

// MUST be first: it defines `process` before any imported module evaluates.
// ES module evaluation follows import order, so moving or removing this line
// puts every card back to blank. See process-shim.ts for why.
import './process-shim';

// ── Providers ───────────────────────────────────────────────────────────────
// The same chain Shell.tsx mounts at the app root, in the same order, wired as
// the nested cfg.provider in .design-sync/config.json. Nearly every component
// reads i18n context and renders blank without it; DishName additionally reads
// the translation cache, and LanguagePicker the scan preset.
export { LanguageProvider } from '@/lib/i18n';
export { TranslationProvider } from '@/lib/translation';
export { ScanPresetProvider } from '@/lib/scanPreset';

// ── Seal (the sealed-bet mechanic) ──────────────────────────────────────────
export { default as SealStamp } from '@/components/SealStamp';
export { default as SealRevealBadge } from '@/components/SealRevealBadge';

// ── Table session: chops and the shared cart bar ────────────────────────────
export { default as Chop } from '@/components/Chop';
export { default as ChopStampRow } from '@/components/ChopStampRow';
export { default as PickedCartBar } from '@/components/PickedCartBar';
export { default as TableBar } from '@/components/TableBar';
export { default as TableQR } from '@/components/TableQR';
export { default as TableRestaurantLine } from '@/components/TableRestaurantLine';
// The settle phase (2026-07-30). Both take everything as props — no Supabase, no
// fetch — so they belong here rather than with the 18 data-coupled exclusions.
export { default as TableWaitLayer } from '@/components/TableWaitLayer';
export { default as TableSettle } from '@/components/TableSettle';

// ── Comparison chassis (DuelOverlay is data-coupled; the side anatomy is not) ─
export { default as DuelSide } from '@/components/DuelSide';

// ── Dish identity and listing ───────────────────────────────────────────────
export { default as DishName } from '@/components/DishName';
export { default as DishInfoDisplay } from '@/components/DishInfoDisplay';
export { default as DishListRow } from '@/components/DishListRow';
export { default as RatedDishRow } from '@/components/RatedDishRow';
export { default as PickCardThumb } from '@/components/PickCardThumb';
export { default as PublicDish } from '@/components/PublicDish';

// ── Rating surfaces ─────────────────────────────────────────────────────────
export { default as FlickRating } from '@/components/FlickRating';
export { default as SnapRating } from '@/components/SnapRating';

// ── Taste profile ───────────────────────────────────────────────────────────
export { default as TasteRadar } from '@/components/TasteRadar';
export { TasteFormSnapshot, TasteFormLive, TasteFormReveal } from '@/components/TasteForm';

// ── Journal / activity ──────────────────────────────────────────────────────
export { default as DailyInteractions } from '@/components/DailyInteractions';
export { default as InteractionRow } from '@/components/InteractionRow';

// ── Shell-level pieces ──────────────────────────────────────────────────────
export { default as LanguagePicker } from '@/components/LanguagePicker';
export { default as PhotoPicker } from '@/components/PhotoPicker';
export { default as ExplainModal } from '@/components/ExplainModal';
export { default as ScanBenefitDemo } from '@/components/ScanBenefitDemo';

// ── Icon set ────────────────────────────────────────────────────────────────
// Enumerated so the design agent knows which icons exist and stops inventing
// its own — the same reason the components above are named individually.
export {
  ArrowRightIcon, ArrowLeftIcon, MoreIcon, EditIcon, TrashIcon, CloseIcon,
  LockIcon, RateIcon, CopyIcon, CheckIcon, ScanMenuIcon, PotIcon, MenuBookIcon,
  CameraIcon, UtensilsIcon, HomeIcon, PhotoIcon, SpeechIcon, GlobeIcon,
  GlobeOffIcon, BellIcon, LinkIcon, ShareIcon, BookmarkIcon, LeaveIcon,
} from '@/components/icons';
