'use client';
// Which restaurant this table is at — one quiet line under the table bar, on both
// screens that mount TableBar.
//
// Why it exists: the session's restaurant is resolved automatically at create
// (POST /api/table), but only when the answer was genuinely unambiguous — the gate
// in tableRestaurant.ts refuses to guess between neighbours it can't separate,
// because a confidently WRONG restaurant silently poisons the dish-level demand
// data while a blank is a gap someone can still fill. This line is where that
// blank gets filled, in one tap, and where a wrong guess gets corrected.
//
// It is deliberately NOT a required step. Picking dishes works with no restaurant
// attached; this never blocks anything, which is the whole reason attribution
// stopped being a confirm sheet in front of the menu.
import { useState } from 'react';
import RestaurantPicker, { type RestaurantChoice } from '@/components/RestaurantPicker';
import { LocationIcon } from '@/components/icons';
import { useLang } from '@/lib/i18n';

export default function TableRestaurantLine({ restaurant, onChange, editable = true, suggestion = null }: {
  restaurant: { id: string; name: string; name_zh: string | null } | null;
  /** Awaited, so the line can show its saving state and close only once the
   * session actually carries the new value. */
  onChange: (choice: RestaurantChoice) => Promise<void>;
  /** False for a QR/registered table: its restaurant belongs to the restaurant
   * itself and isn't a diner's to reassign (the API refuses it too). */
  editable?: boolean;
  /** The scanned menu's printed name, resolved to a real place the gate
   * couldn't auto-adopt (scan page's search-on-guess). Rendered as ONE confirm
   * chip beside the 餐廳未定 line — confirming is a tap, typing never required.
   * Only ever shown while the restaurant is unset; ignoring it costs nothing. */
  suggestion?: { name: string; choice: RestaurantChoice } | null;
}) {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const label = restaurant
    ? (lang === 'zh' ? (restaurant.name_zh ?? restaurant.name) : restaurant.name)
    : null;

  // A bare null is NOT an answer. The picker sends one whenever nothing is selected
  // any more, and opening "+ 加間舖" is one of those moments — acting on it meant the
  // tap that opens the typed-name form also unmounted the card the form renders in,
  // so the button looked dead. Real answers arrive as a choice, or as onNone.
  async function choose(choice: RestaurantChoice) {
    if (choice === null) return;
    await commit(choice);
  }
  // 略過 = "none of the suggested places, and I'm not typing one either" (owner,
  // 2026-08-01). That is an answer about the table, so it CLEARS whatever restaurant
  // was on it — including a wrong auto-guess, which is the case that needs it. The
  // server treats null as the clear and re-attributes the picks already made, so the
  // dishes don't keep pointing at a shop the table just said it isn't at.
  //
  // It replaces 住家菜 as this sheet's clear: a scanned MENU belongs to a business by
  // definition, so home cooking was never a coherent answer to "which restaurant is
  // this table at" — it was only there because something had to do the clearing.
  //
  // Backing out without changing anything is still available, and is now the ONLY
  // non-destructive exit: tap the 餐廳未定 line again to collapse the sheet.
  async function none() { await commit(null); }

  async function commit(choice: RestaurantChoice) {
    setSaving(true);
    try {
      await onChange(choice);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="table-restaurant-line">
      {/* Named or not, the line reads the same shape — a quiet meta line, the same
          .card-meta voice the table bar's own status text uses, never a banner. */}
      {!editable ? (
        <span className="card-meta table-restaurant-static">
          <LocationIcon size={14} />
          {label}
        </span>
      ) : (
        <button
          className="table-restaurant-btn card-meta"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
        >
          <LocationIcon size={14} />
          {label ?? t('table.restaurant.unset')}
        </button>
      )}

      {!restaurant && editable && !open && suggestion && (
        <button
          className="chip table-restaurant-suggest"
          disabled={saving}
          onClick={() => commit(suggestion.choice)}
        >
          {t('table.restaurant.confirm', { name: suggestion.name })}
        </button>
      )}

      {open && (
        <div className="card" style={{ marginTop: 8 }}>
          <div className="card-body">
            <p style={{ fontWeight: 700, marginBottom: 8 }}>{t('table.restaurant.which')}</p>
            {/* The SAME picker every other restaurant-input path mounts (食記 edit,
                打字 quick-add) — GPS chips first, typing as the fallback. Not a
                table-specific reimplementation of a chip row. */}
            <RestaurantPicker onChange={choose} onNone={none} homeOption={false} />
            {saving && <p className="card-meta" style={{ marginTop: 8 }}>{t('log.saving')}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
