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

export default function TableRestaurantLine({ restaurant, onChange, editable = true }: {
  restaurant: { id: string; name: string; name_zh: string | null } | null;
  /** Awaited, so the line can show its saving state and close only once the
   * session actually carries the new value. */
  onChange: (choice: RestaurantChoice) => Promise<void>;
  /** False for a QR/registered table: its restaurant belongs to the restaurant
   * itself and isn't a diner's to reassign (the API refuses it too). */
  editable?: boolean;
}) {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const label = restaurant
    ? (lang === 'zh' ? (restaurant.name_zh ?? restaurant.name) : restaurant.name)
    : null;

  async function choose(choice: RestaurantChoice) {
    // A null is NOT an answer here. The picker sends one whenever nothing is
    // selected any more, and opening "+ 加間舖" is one of those moments — closing on
    // it meant the tap that opens the typed-name form also unmounted the card the
    // form renders in, so the button looked dead. The deliberate "leave it as it is"
    // arrives as onDismiss instead. 住家菜 still clears the restaurant, and says so
    // by being its own answer.
    if (choice === null) return;
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

      {open && (
        <div className="card" style={{ marginTop: 8 }}>
          <div className="card-body">
            <p style={{ fontWeight: 700, marginBottom: 8 }}>{t('table.restaurant.which')}</p>
            {/* The SAME picker every other restaurant-input path mounts (食記 edit,
                打字 quick-add) — GPS chips first, typing as the fallback. Not a
                table-specific reimplementation of a chip row. */}
            <RestaurantPicker onChange={choose} onDismiss={() => setOpen(false)} />
            {saving && <p className="card-meta" style={{ marginTop: 8 }}>{t('log.saving')}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
