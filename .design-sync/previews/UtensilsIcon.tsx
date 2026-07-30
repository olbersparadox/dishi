import { UtensilsIcon, HomeIcon, PhotoIcon } from 'dishi';

// Fork + knife — dining out (餐廳菜). One of the three equal-weight segments
// in the merged log-entry pill (.log-src-merged): restaurant / home cooking /
// old photos all count the same, so all three sit together, white on ink.

/** The icon alone at a spread of sizes, ink on paper. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: 24, color: 'var(--ink)' }}>
      <UtensilsIcon size={16} />
      <UtensilsIcon size={22} />
      <UtensilsIcon size={30} />
      <UtensilsIcon size={42} />
    </div>
  );
}

/** The real merged log-entry pill — three equal segments, white on ink,
 *  exactly as profile/page.tsx composes it. */
export function LogSourcePill() {
  return (
    <div style={{ padding: 24 }}>
      <div className="log-src-merged" style={{ width: 320 }}>
        <div className="log-src-seg">
          <UtensilsIcon size={42} /><span>+餐廳菜</span>
        </div>
        <div className="log-src-seg">
          <HomeIcon size={42} /><span>+住家菜</span>
        </div>
        <div className="log-src-seg">
          <PhotoIcon size={42} /><span>+相簿舊菜</span>
        </div>
      </div>
    </div>
  );
}
