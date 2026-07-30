import { ExplainModal } from 'dishi';

// The one shared "tap-to-learn-more" card: dead-centre fixed modal, centred
// title, left-aligned body, dismissed by the circle-check. Every explainer in
// the app IS this component, so the cells are ported verbatim from real
// callers (copy included — it's the app's own zh-first copy, not invented).
// Each cell wraps the fixed-position modal in a phone-sized frame whose
// transform re-anchors it, so the card centres in a phone footprint instead
// of the whole capture viewport.
const FRAME: React.CSSProperties = {
  position: 'relative', width: 390, height: 600, margin: '0 auto',
  overflow: 'hidden', transform: 'translateZ(0)', outline: '1px solid var(--line)',
};

/** The scan page's ⓘ: what scanning a menu does for you. */
export function ScanHelp() {
  return (
    <div style={FRAME}>
      <ExplainModal
        title="有時真係唔知食乜好"
        body="拍下餐牌，dishi 會根據你的口味，告訴你整張餐牌上哪幾道最適合你，同時標出食材與致敏原。去到日本、韓國、泰國，外語菜名也一樣翻譯成你看得懂的文字，走到哪裡都點得稱心。"
        onClose={() => {}}
      />
    </div>
  );
}

/** What the 印 stamp opens, anywhere it appears: the sealed-bet honesty
 *  contract in the person's own words. */
export function SealExplainer() {
  return (
    <div style={FRAME}>
      <ExplainModal
        title="「印」是什麼？"
        body="Dishi 在你選擇之前就秘密寫下對你會選哪樣的預測，封存的內容無人能看見，連你自己也不例外。選擇之後才揭開，看預測是否準確。"
        onClose={() => {}}
      />
    </div>
  );
}

/** The reveal balloon SealRevealBadge opens on tap (ported from its exact
 *  composition, since that open state is internal): the verdict face leads,
 *  then the call and the actual at title size, then — set off by a rule —
 *  the reason sealed in advance, what this rating taught, and the streak. */
export function SealRevealBalloon() {
  return (
    <div style={FRAME}>
      <ExplainModal
        ariaLabel="揭開封印 — 預測命中"
        title={<span className="seal-modal-face" aria-hidden>😁</span>}
        extra={
          <>
            <p className="seal-modal-line">Dishi 預計：「好鍾意」</p>
            <p className="seal-modal-line">你的評價：「好鍾意」</p>
            <div className="seal-modal-detail">
              <p className="seal-modal-reason">封存時寫下的理由：你一向偏好鑊氣足、乾身唔油嘅炒粉麵，呢碟乾炒牛河應該啱你。</p>
              <p className="seal-modal-learnt">你剛剛教會了我：鮮味 ↑ · 脆 ↑</p>
              <p className="seal-modal-streak">連續命中 3 次 — 引擎越來越了解你。</p>
            </div>
          </>
        }
        onClose={() => {}}
      />
    </div>
  );
}
