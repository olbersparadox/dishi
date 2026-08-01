// What to CALL somebody, on every surface that shows a person's name.
//
// Three columns, in order of how much the person chose them:
//
//   display_name     — free-form, anything they want to be called. Nothing writes
//                      it yet, but it outranks the rest the day something does.
//   username_display — the casing they actually TYPED when claiming: "Jerry".
//                      Cosmetic by construction; profiles_username_display_casing.sql
//                      constrains it to differ from handle by case alone.
//   handle           — the canonical form. Lowercased on purpose, because it is a
//                      URL (dishi.me/[username]) and the uniqueness key, so "Jerry"
//                      and "jerry" can never be two people.
//
// Reading `handle` for display is therefore always a small bug, and it is the reason
// names came out lowercase at a table while the same person read "Jerry" in the feed
// and their dossier, which had been going through username_display all along. This
// exists so the ladder is written once rather than re-derived per surface.
export type NamedProfile = {
  display_name?: string | null;
  username_display?: string | null;
  handle?: string | null;
};

/** `||` rather than `??`: an empty string is not a name, and these columns are text
 *  fields a person can leave blank. */
export function memberName(p: NamedProfile | null | undefined, fallback = 'someone'): string {
  return p?.display_name || p?.username_display || p?.handle || fallback;
}
