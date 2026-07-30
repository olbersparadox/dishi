import { GlobeIcon, GlobeOffIcon } from 'dishi';

// Globe, struck through — unpublish (take a dish off 大家食, back to private).
// Same globe/size/stroke as GlobeIcon; only the slash overflows the icon's own
// box to cross the whole .icon-btn.cancel circle around it. Lives in
// PostSheet's footer, left of the publish button.

/** The icon alone at a spread of sizes, ink on paper. */
export function Sizes() {
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: 24, color: 'var(--ink)' }}>
      <GlobeOffIcon size={16} />
      <GlobeOffIcon size={20} />
      <GlobeOffIcon size={26} />
      <GlobeOffIcon size={40} />
    </div>
  );
}

/** PostSheet's real footer pair — unpublish (this icon, left) and
 *  publish/update (GlobeIcon, right). */
export function PublishFooter() {
  return (
    <div style={{ padding: 24, display: 'flex', gap: 8 }}>
      <button type="button" className="icon-btn cancel" aria-label="收回公開">
        <GlobeOffIcon size={16} />
      </button>
      <button type="button" className="icon-btn save" aria-label="公開">
        <GlobeIcon size={16} />
      </button>
    </div>
  );
}
