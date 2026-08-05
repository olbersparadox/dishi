/* 墨靈 lab v7 — the vocabulary and face code, RESCUED verbatim from the
 * external Claude artifact "墨靈 · Taste-Form R&D Lab"
 * (https://claude.ai/code/artifact/5827b314-b057-44de-bd1b-85443dcf0363).
 *
 * WHY THIS FILE EXISTS: this drawing code existed ONLY inside that artifact —
 * not in this repo, not even in docs/rnd/mokling-lab-v1.html (which is v1).
 * One lost artifact would have meant every LAB-ONLY row in the framework
 * Ledger (docs/rnd/mokling-framework.md) became a rebuild from a spec table
 * with no reference implementation. This file closes that risk. Extracted by
 * exact line range from the artifact's saved HTML (`sed -n 'START,ENDp'`),
 * never retyped from a model's memory of the content, and diffed against the
 * source after extraction — see the verification note at the end of this file.
 *
 * STATUS, exactly as the framework Ledger states it: every gesture below is
 * LAB-ONLY. It has NEVER been ported into src/lib/creatureForm.ts. Reading
 * this file does not make a feature shipped — rendering it in production is
 * the evidence, per the sea_crustacean lesson creatureForm.ts itself carries.
 *
 * TWO DIFFERENT KINDS OF CODE ARE PRESERVED HERE, DO NOT CONFLATE THEM:
 *
 * 1. VOCAB (below) — the real gesture library. Each entry is a clean,
 *    parametric closure `fn:(g,S) => {...}` taking a canvas context and a
 *    scale, drawn against a neutral `stub()` reference circle rather than
 *    the real creature body. This is genuinely portable: the geometry is
 *    sound, but every fn needs re-basing from `stub()`'s fixed anchor onto
 *    creatureForm.ts's actual silhouette attachment points (`flank`/`bottom`
 *    in that file) before it can render on a real body. Each item's `d:`
 *    field names its detector in the same vocabulary the Ledger uses.
 *
 * 2. TRACES (near the end) — seven bespoke, ONE-OFF fidelity sketches,
 *    each hardcoded to reproduce one specific reference drawing the owner
 *    sketched by hand (2026-08-02, "trace them if you need to. I need to
 *    know if you can do it."). These are NOT a parametric API — there is no
 *    (mix) argument, no species selection, nothing to call twice and get a
 *    different result. Treat TRACES as calibration reference for exact
 *    proportions and style the owner already approved, never as drop-in
 *    production code. The lab's own comment says as much: "If these pass,
 *    the gesture library is refactored to THESE shapes and re-wired to
 *    data" — i.e. TRACES was the approval gate for VOCAB's style, not itself
 *    the deliverable.
 *
 * SHARED HELPERS NOT DUPLICATED HERE: `TAU`, `taperQuad`, and `seededRandom`
 * are byte-identical to their counterparts already in production
 * (src/lib/blobForm.ts / src/lib/creatureForm.ts) — confirmed by direct
 * comparison during rescue. Do not re-derive them; import the real ones when
 * porting. `INK = 'rgba(33,29,24,.93)'` and `HILITE = '250,247,241'` are the
 * lab's local color constants — creatureForm.ts uses its own token names for
 * the same values; reconcile against `SKIN_*`/`INK` there, don't copy these
 * literals in.
 *
 * PORTING CHECKLIST (do not skip any step — this is exactly how the original
 * v6 port silently dropped 烤 sear marks and invented the sea_crustacean bug):
 *   1. Re-base each fn's anchor from stub() onto the real body's flank/bottom
 *      points (creatureForm.ts already does this correctly for legs/claws —
 *      follow that pattern, not VOCAB's stub() pattern).
 *   2. Wire the detector named in `d:` to an actual field. Check the Ledger's
 *      "Detector layer" table first — several are READY (data exists, only
 *      the aggregation is missing), not NEEDS-DETECTOR (nothing exists yet).
 *   3. Add a gate: share threshold + absolute evidence floor, same shape as
 *      creatureForm.ts's `GATE`/`absF` — never ship a feature with only one
 *      of the two gates (see the framework doc's documented failure modes).
 *   4. Route the appendage's outward direction through creatureForm.ts's
 *      pattern of building from the drawn silhouette, not a hand-rolled
 *      direction — the framework doc records a real bug class here: wings
 *      and tails coded, gated, and firing correctly, but drawn INTO the body
 *      where the fill buried them, because direction was hand-rolled with an
 *      inverted sign on one side.
 *   5. Update the Ledger's status for that row in the SAME commit.
 *
 * Rescued 2026-08-05. Comments marked ⚠ were added AFTER rescue (dated);
 * everything else is the verbatim extraction the diff verified.
 */

/* ═══════════════════════════════════════════════════════════════════
 * PART 1 — VOCAB: the portable gesture library (see checklist above)
 * ═══════════════════════════════════════════════════════════════════ */

/* ═══════════ 筆語 · the stroke vocabulary ═══════════
   Every gesture the being can grow, with the data that EARNS it. This is the
   admission list: a shape enters the product only with a detector beside it.
   Drawn as specimen studies — the pale disc is the body it attaches to. */
const INK='rgba(33,29,24,.93)';
function stub(g,S,cx=.34,cy=.60,r=.19){
  g.fillStyle='rgba(33,29,24,.13)';
  g.beginPath();g.arc(S*cx,S*cy,S*r,0,TAU);g.fill();
  return {x:S*cx,y:S*cy,r:S*r};
}
function tq(g,x0,y0,x1,y1,w0,w1){g.fillStyle=INK;taperQuad(g,x0,y0,x1,y1,w0,w1);}
function blade(g,x,y,L,w,ang,curve=0){        // one leaf/fin blade
  const c=Math.cos(ang),s=Math.sin(ang);
  g.fillStyle=INK;g.beginPath();g.moveTo(x,y);
  g.quadraticCurveTo(x+c*L*.5-s*w+curve,y+s*L*.5+c*w,x+c*L,y+s*L);
  g.quadraticCurveTo(x+c*L*.5+s*w+curve,y+s*L*.5-c*w,x,y);
  g.fill();
}
const VOCAB=[
 {g:'尾 · tails', why:'the dominant sub-node of the biggest animal domain', items:[
  {nm:'魚尾',en:'fish · forked',d:'魚 share of 海',fn:(g,S)=>{const b=stub(g,S);
    tq(g,b.x+b.r*.7,b.y,S*.62,b.y-S*.02,S*.05,S*.03);
    blade(g,S*.62,b.y-S*.02,S*.24,S*.055,-.75);blade(g,S*.62,b.y-S*.02,S*.24,S*.055,.62);}},
  {nm:'蝦尾',en:'crustacean · fan',d:'甲殼 share',fn:(g,S)=>{const b=stub(g,S);
    let x=b.x+b.r*.6,y=b.y;
    for(let i=0;i<4;i++){const w=S*(.075-i*.010);tq(g,x,y,x+S*.075,y-S*.012,w,w*.85);x+=S*.075;y-=S*.012;}
    for(const a of[-.55,-.18,.18,.55])blade(g,x,y,S*.17,S*.035,a);}},
  {nm:'牛尾',en:'beef · tufted whip',d:'牛 share of 陸',fn:(g,S)=>{const b=stub(g,S);
    g.strokeStyle=INK;g.lineWidth=S*.028;g.lineCap='round';g.beginPath();
    g.moveTo(b.x+b.r*.7,b.y-S*.06);g.bezierCurveTo(S*.58,b.y-S*.16,S*.66,b.y+S*.06,S*.62,b.y+S*.20);g.stroke();
    for(const a of[-.5,0,.5])blade(g,S*.62,b.y+S*.20,S*.11,S*.028,1.57+a);}},
  {nm:'豬尾',en:'pork · curl',d:'豬 share of 陸',fn:(g,S)=>{const b=stub(g,S);
    g.strokeStyle=INK;g.lineWidth=S*.038;g.lineCap='round';g.beginPath();
    g.moveTo(b.x+b.r*.8,b.y-S*.02);
    const cx2=S*.66,cy2=b.y-S*.07;                 // clear of the body, then coil
    g.quadraticCurveTo(S*.57,b.y-S*.05,cx2+S*.11,cy2);
    for(let i=0;i<=44;i++){const t2=i/44,th=t2*TAU*1.55,rr=S*.11*(1-t2*.42);
      g.lineTo(cx2+Math.cos(th)*rr,cy2+Math.sin(th)*rr*.92);}g.stroke();}},
  {nm:'禽尾',en:'poultry · fan',d:'羽 share',fn:(g,S)=>{const b=stub(g,S);
    const ax=b.x+b.r*.95, ay=b.y-S*.03;            // hinge clear of the body
    for(let i=0;i<5;i++){const a=-.70+i*.35;
      blade(g,ax,ay,S*(.30-Math.abs(i-2)*.025),S*.030,a);}}},
 ]},
 {g:'鰭 · fins', why:'fish sub-node, and how the fish is cooked', items:[
  {nm:'尖鰭',en:'swift · pointed',d:'魚 + 生 raw share',fn:(g,S)=>{const b=stub(g,S);
    blade(g,b.x+b.r*.5,b.y-b.r*.55,S*.30,S*.045,-1.05);
    blade(g,b.x+b.r*.85,b.y+b.r*.1,S*.20,S*.04,-.15);}},
  {nm:'圓鰭',en:'whole steamed · round',d:'魚 + 蒸 share',fn:(g,S)=>{const b=stub(g,S);
    for(const sgn of[-1,1])blade(g,b.x+b.r*.7,b.y+sgn*b.r*.35,S*.19,S*.075,sgn>0?.35:-.35);}},
  {nm:'帶鰭',en:'eel · ribbon',d:'長身魚 + 烤 share',fn:(g,S)=>{const b=stub(g,S);
    g.fillStyle=INK;g.beginPath();
    for(const e of[1,-1]){for(let i=0;i<=14;i++){const u=e>0?i/14:1-i/14;
      const x=b.x+b.r*.6+u*S*.34,y=b.y+Math.sin(u*5)*S*.045+e*S*.030*(1-u*.4);
      (e>0&&i===0)?g.moveTo(x,y):g.lineTo(x,y);}}g.closePath();g.fill();}},
 ]},
 {g:'翼 · wings', why:'poultry sub-node — the bird you actually eat', items:[
  {nm:'雞翼',en:'chicken · short round',d:'雞 share of 羽',fn:(g,S)=>{const b=stub(g,S,.44,.62);
    for(const sd of[-1,1])for(let i=0;i<4;i++)
      blade(g,b.x+sd*b.r*.6,b.y-b.r*.3,S*(.16-i*.012),S*.038,sd>0?-.95+i*.22:-2.19-i*.22);}},
  {nm:'鴨翼',en:'duck · pointed swift',d:'鴨 share of 羽',fn:(g,S)=>{const b=stub(g,S,.44,.62);
    for(const sd of[-1,1])for(let i=0;i<4;i++)
      blade(g,b.x+sd*b.r*.6,b.y-b.r*.3,S*(.30-i*.028),S*.026,sd>0?-.72+i*.13:-2.42-i*.13);}},
  {nm:'鵝翼',en:'goose · long broad',d:'鵝 share of 羽',fn:(g,S)=>{const b=stub(g,S,.44,.62);
    for(const sd of[-1,1])for(let i=0;i<5;i++)
      blade(g,b.x+sd*b.r*.6,b.y-b.r*.25,S*(.36-i*.022),S*.042,sd>0?-.50+i*.10:-2.64-i*.10);}},
 ]},
 {g:'角 · horns', why:'NOT only cattle — horns are the indulgence register', items:[
  {nm:'牛角',en:'cattle · curved pair',d:'牛 at deep evidence',fn:(g,S)=>{const b=stub(g,S,.5,.66);
    g.strokeStyle=INK;g.lineCap='round';g.lineWidth=S*.055;
    for(const sd of[-1,1]){g.beginPath();g.moveTo(b.x+sd*b.r*.55,b.y-b.r*.62);
      g.quadraticCurveTo(b.x+sd*S*.24,b.y-S*.24,b.x+sd*S*.13,b.y-S*.34);g.stroke();}}},
  {nm:'脂角',en:'richness · thick blunt',d:'heaviness + 濃 rich',fn:(g,S)=>{const b=stub(g,S,.5,.66);
    for(const sd of[-1,1])tq(g,b.x+sd*b.r*.5,b.y-b.r*.6,b.x+sd*S*.14,b.y-S*.30,S*.085,S*.055);}},
  {nm:'罪角',en:'late-night fried · jagged',d:'炸 + heaviness, after 23:00',fn:(g,S)=>{const b=stub(g,S,.5,.66);
    g.fillStyle=INK;
    for(const sd of[-1,1]){g.beginPath();
      g.moveTo(b.x+sd*b.r*.42,b.y-b.r*.6);g.lineTo(b.x+sd*S*.10,b.y-S*.20);
      g.lineTo(b.x+sd*S*.055,b.y-S*.21);g.lineTo(b.x+sd*S*.155,b.y-S*.37);
      g.lineTo(b.x+sd*S*.085,b.y-S*.33);g.lineTo(b.x+sd*b.r*.66,b.y-b.r*.55);
      g.closePath();g.fill();}}},
 ]},
 {g:'耳 · ears', why:'land sub-node — each animal hears differently', items:[
  {nm:'豬耳',en:'pork · floppy triangle',d:'豬 share of 陸',fn:(g,S)=>{const b=stub(g,S,.5,.62);
    g.fillStyle=INK;for(const sd of[-1,1]){g.beginPath();
      g.moveTo(b.x+sd*b.r*.5,b.y-b.r*.62);g.quadraticCurveTo(b.x+sd*S*.20,b.y-S*.24,b.x+sd*S*.13,b.y-S*.02);
      g.quadraticCurveTo(b.x+sd*S*.075,b.y-S*.15,b.x+sd*b.r*.3,b.y-b.r*.6);g.closePath();g.fill();}}},
  // clear of the body and drooping, with an inner fold: a pair of dark ovals
  // sitting ON the face reads unmistakably as EYES, which this must never do
  {nm:'牛耳',en:'beef · side flap',d:'牛 share of 陸',fn:(g,S)=>{const b=stub(g,S,.5,.62);
    for(const sd of[-1,1]){
      g.fillStyle=INK;g.beginPath();
      g.ellipse(b.x+sd*b.r*1.32,b.y-b.r*.12,S*.10,S*.045,sd>0?.30:-.30,0,TAU);g.fill();
      g.strokeStyle=`rgba(${HILITE},.28)`;g.lineWidth=S*.012;g.beginPath();
      g.moveTo(b.x+sd*b.r*.95,b.y-b.r*.22);g.lineTo(b.x+sd*b.r*1.62,b.y-b.r*.02);g.stroke();}}},
  {nm:'羊耳',en:'lamb · pointed up',d:'羊 share of 陸',fn:(g,S)=>{const b=stub(g,S,.5,.62);
    for(const sd of[-1,1])blade(g,b.x+sd*b.r*.5,b.y-b.r*.6,S*.20,S*.045,sd>0?-1.15:-1.99);}},
 ]},
 {g:'足 · feet', why:'land + water-bird sub-nodes; how the being meets ground', items:[
  {nm:'牛蹄',en:'beef · cleft hoof',d:'牛 share',fn:(g,S)=>{const b=stub(g,S,.5,.42);
    for(const sd of[-1,1]){const x=b.x+sd*S*.075;tq(g,x,b.y+b.r*.7,x,S*.76,S*.055,S*.05);
      g.fillStyle=INK;g.beginPath();g.rect(x-S*.045,S*.76,S*.036,S*.055);
      g.rect(x+S*.009,S*.76,S*.036,S*.055);g.fill();}}},
  {nm:'豬蹄',en:'pork · trotter',d:'豬 share',fn:(g,S)=>{const b=stub(g,S,.5,.42);
    for(const sd of[-1,1]){const x=b.x+sd*S*.075;tq(g,x,b.y+b.r*.7,x,S*.74,S*.05,S*.042);
      g.fillStyle=INK;g.beginPath();g.ellipse(x,S*.77,S*.045,S*.030,0,0,TAU);
      g.ellipse(x-S*.026,S*.795,S*.017,S*.019,0,0,TAU);g.ellipse(x+S*.026,S*.795,S*.017,S*.019,0,0,TAU);g.fill();}}},
  {nm:'雞爪',en:'chicken · splayed toes',d:'雞 share',fn:(g,S)=>{const b=stub(g,S,.5,.42);
    for(const sd of[-1,1]){const x=b.x+sd*S*.07;tq(g,x,b.y+b.r*.7,x-sd*S*.02,S*.72,S*.022,S*.018);
      for(const a of[-.6,0,.6])tq(g,x-sd*S*.02,S*.72,x-sd*S*.02+Math.sin(a)*S*.075,S*.72+Math.cos(a)*S*.055,S*.014,S*.006);}}},
  {nm:'鴨掌',en:'duck · webbed',d:'鴨 share of 羽',fn:(g,S)=>{const b=stub(g,S,.5,.42);
    for(const sd of[-1,1]){const x=b.x+sd*S*.075;tq(g,x,b.y+b.r*.7,x,S*.72,S*.026,S*.022);
      g.fillStyle=INK;g.beginPath();g.moveTo(x,S*.72);
      g.quadraticCurveTo(x-S*.085,S*.78,x-S*.062,S*.82);
      g.quadraticCurveTo(x,S*.795,x+S*.062,S*.82);
      g.quadraticCurveTo(x+S*.085,S*.78,x,S*.72);g.fill();}}},
 ]},
 {g:'膚 · skins', why:'cooking method + shell/fur domains — the surface itself', items:[
  {nm:'毛',en:'hairy',d:'羊/fur mammals at depth',fn:(g,S)=>{const b=stub(g,S,.5,.5,.24);
    g.fillStyle=INK;g.beginPath();g.arc(b.x,b.y,b.r,0,TAU);g.fill();
    g.strokeStyle=INK;g.lineWidth=S*.012;const rr=seededRandom('hair');
    for(let i=0;i<54;i++){const a=rr()*TAU,l=S*(.035+rr()*.045);
      g.beginPath();g.moveTo(b.x+Math.cos(a)*b.r*.94,b.y+Math.sin(a)*b.r*.94);
      g.lineTo(b.x+Math.cos(a+.25)*(b.r+l),b.y+Math.sin(a+.25)*(b.r+l));g.stroke();}}},
  {nm:'滑',en:'smooth · wet',d:'蒸 / 生 share',fn:(g,S)=>{const b=stub(g,S,.5,.5,.24);
    g.fillStyle=INK;g.beginPath();g.arc(b.x,b.y,b.r,0,TAU);g.fill();
    g.fillStyle=`rgba(${HILITE},.30)`;g.beginPath();
    g.ellipse(b.x-b.r*.32,b.y-b.r*.42,b.r*.46,b.r*.20,-.4,0,TAU);g.fill();
    g.fillStyle=`rgba(${HILITE},.18)`;g.beginPath();
    g.ellipse(b.x+b.r*.35,b.y+b.r*.15,b.r*.18,b.r*.09,.5,0,TAU);g.fill();}},
  /* ⚠ SUPERSEDED (2026-08-05, added after rescue — everything else in this
     file is verbatim): this 糙 card draws scattered pale specks and is NOT
     the confirmed treatment. Production's two-cluster two-tone dot-pairs
     (creatureForm.ts `isRough`, 3 upper-right / 3 lower-left) are
     owner-confirmed; a port of the scattered style was tried and reverted the
     same day. Also do not port from the 其七 TRACE's rough craters for the
     same reason. Kept for the record only. */
  {nm:'糙',en:'rough · seared',d:'烤 / 炸 share',fn:(g,S)=>{const b=stub(g,S,.5,.5,.24);
    g.fillStyle=INK;g.beginPath();g.arc(b.x,b.y,b.r,0,TAU);g.fill();
    const rr=seededRandom('rough');g.save();
    g.beginPath();g.arc(b.x,b.y,b.r,0,TAU);g.clip();
    for(let i=0;i<40;i++){const a=rr()*TAU,d=rr()*b.r;
      g.fillStyle=`rgba(${HILITE},${.06+rr()*.16})`;g.beginPath();
      g.arc(b.x+Math.cos(a)*d,b.y+Math.sin(a)*d,S*(.008+rr()*.016),0,TAU);g.fill();}
    g.restore();}},
  {nm:'甲',en:'shell · plated',d:'甲殼 share',fn:(g,S)=>{const b=stub(g,S,.5,.5,.24);
    g.fillStyle=INK;g.beginPath();g.arc(b.x,b.y,b.r,0,TAU);g.fill();
    g.strokeStyle=`rgba(${HILITE},.22)`;g.lineWidth=S*.018;g.save();
    g.beginPath();g.arc(b.x,b.y,b.r,0,TAU);g.clip();
    for(let i=1;i<5;i++){g.beginPath();
      g.arc(b.x,b.y+b.r*.55,b.r*(.30*i),Math.PI*1.12,Math.PI*1.88);g.stroke();}
    g.restore();}},
  {nm:'軟',en:'soft · sagging',d:'燜 braised share',fn:(g,S)=>{const b=stub(g,S,.5,.46,.24);
    g.fillStyle=INK;g.beginPath();
    g.ellipse(b.x,b.y+b.r*.18,b.r*1.06,b.r*.86,0,0,TAU);g.fill();
    g.fillStyle=`rgba(${HILITE},.10)`;g.beginPath();
    g.ellipse(b.x-b.r*.3,b.y-b.r*.3,b.r*.42,b.r*.17,-.35,0,TAU);g.fill();}},
 ]},
 {g:'葉 · plant parts', why:'田 sub-nodes — a vegetarian is not one shape', items:[
  {nm:'闊葉',en:'leafy green · broad',d:'葉 share of 田',fn:(g,S)=>{const b=stub(g,S,.5,.74,.14);
    for(const sd of[-1,0,1]){const a=-1.57+sd*.42;
      g.strokeStyle=INK;g.lineWidth=S*.022;g.beginPath();
      g.moveTo(b.x,b.y-b.r*.4);g.lineTo(b.x+Math.cos(a)*S*.22,b.y+Math.sin(a)*S*.22);g.stroke();
      blade(g,b.x+Math.cos(a)*S*.20,b.y+Math.sin(a)*S*.20,S*.20,S*.085,a);}}},
  {nm:'針葉',en:'herb sprig · fine',d:'花/香草 share of 田',fn:(g,S)=>{const b=stub(g,S,.5,.74,.14);
    g.strokeStyle=INK;g.lineCap='round';
    for(const sd of[-1,0,1]){const a=-1.57+sd*.36;
      g.lineWidth=S*.018;g.beginPath();g.moveTo(b.x,b.y-b.r*.4);
      const ex=b.x+Math.cos(a)*S*.30,ey=b.y+Math.sin(a)*S*.30;g.lineTo(ex,ey);g.stroke();
      g.lineWidth=S*.010;
      for(let i=1;i<=4;i++){const u=i/5,mx=b.x+(ex-b.x)*u,my=b.y-b.r*.4+(ey-b.y+b.r*.4)*u;
        for(const s2 of[-1,1]){g.beginPath();g.moveTo(mx,my);
          g.lineTo(mx+s2*S*.05,my-S*.028);g.stroke();}}}}},
  {nm:'根',en:'root · tuber',d:'根 share of 田',fn:(g,S)=>{const b=stub(g,S,.5,.42,.16);
    g.fillStyle=INK;g.beginPath();
    g.moveTo(b.x-S*.075,b.y+b.r*.4);g.quadraticCurveTo(b.x-S*.055,S*.74,b.x,S*.84);
    g.quadraticCurveTo(b.x+S*.055,S*.74,b.x+S*.075,b.y+b.r*.4);g.closePath();g.fill();
    g.strokeStyle=INK;g.lineWidth=S*.010;
    for(const sd of[-1,1])for(let i=0;i<3;i++){const y=S*.60+i*S*.07;
      g.beginPath();g.moveTo(b.x+sd*S*.045,y);g.lineTo(b.x+sd*S*.11,y+S*.035);g.stroke();}}},
  {nm:'藻帶',en:'seaweed · ribbon',d:'藻 share',fn:(g,S)=>{const b=stub(g,S,.5,.26,.13);
    g.fillStyle=INK;
    for(const sd of[-1,1]){g.beginPath();
      for(const e of[1,-1]){for(let i=0;i<=14;i++){const u=e>0?i/14:1-i/14;
        const x=b.x+sd*S*.055+Math.sin(u*4.2+sd)*S*.055+e*S*.026*(1-u*.3);
        const y=b.y+b.r*.5+u*S*.46;(e>0&&i===0)?g.moveTo(x,y):g.lineTo(x,y);}}
      g.closePath();g.fill();}}},
 ]},
 {g:'觸 · tentacles', why:'軟體 sub-nodes — the arms of the boneless', items:[
  {nm:'八爪',en:'octopus · suckered curl',d:'八爪魚 share of 軟體',fn:(g,S)=>{const b=stub(g,S,.5,.30,.15);
    for(let k=0;k<3;k++){const sd=k-1;
      g.strokeStyle=INK;g.lineCap='round';g.lineWidth=S*.042;g.beginPath();
      const x0=b.x+sd*b.r*.7,y0=b.y+b.r*.6;
      g.moveTo(x0,y0);g.bezierCurveTo(x0+sd*S*.10,S*.62,x0-sd*S*.10,S*.72,x0+sd*S*.12,S*.84);g.stroke();
      g.fillStyle=`rgba(${HILITE},.30)`;
      for(let i=1;i<=4;i++){const u=i/5,yy=y0+(S*.84-y0)*u;
        g.beginPath();g.arc(x0+sd*S*.055*Math.sin(u*3.2),yy,S*.011,0,TAU);g.fill();}}}},
  {nm:'魷',en:'squid · long straight pair',d:'魷魚 share of 軟體',fn:(g,S)=>{const b=stub(g,S,.5,.28,.14);
    for(const sd of[-1,1]){tq(g,b.x+sd*b.r*.5,b.y+b.r*.7,b.x+sd*S*.085,S*.80,S*.030,S*.016);
      blade(g,b.x+sd*S*.085,S*.80,S*.075,S*.024,1.4+sd*.2);}
    for(const sd of[-.5,.5]){g.strokeStyle=INK;g.lineWidth=S*.014;g.beginPath();
      g.moveTo(b.x+sd*b.r*.5,b.y+b.r*.7);g.quadraticCurveTo(b.x+sd*S*.09,S*.62,b.x+sd*S*.05,S*.72);g.stroke();}}},
  {nm:'水母',en:'jellyfish · fine strands',d:'海蜇 share of 軟體',fn:(g,S)=>{const b=stub(g,S,.5,.30,.16);
    g.strokeStyle='rgba(33,29,24,.6)';g.lineCap='round';
    for(let i=0;i<7;i++){const fr=(i-3)/3;g.lineWidth=S*(.014-Math.abs(fr)*.005);
      g.beginPath();const x0=b.x+fr*b.r*.85;g.moveTo(x0,b.y+b.r*.55);
      g.bezierCurveTo(x0+fr*S*.03,S*.60,x0-fr*S*.04,S*.70,x0+fr*S*.06,S*.82);g.stroke();}}},
 ]},
];

/* ═══════════════════════════════════════════════════════════════════
 * PART 2 — 眼/口 face logic: faceOf() decides which, drawFace() draws it
 * ═══════════════════════════════════════════════════════════════════ */

/* ═══════════ 眼 · 口 — the late, rare features ═══════════
   Earned by what the ENGINE has achieved, not by tenure. Eyes come from
   BREADTH (fog retreating: the being can finally see your whole taste);
   a mouth comes from CONVICTION (strong, decided opinions — it has bitten).
   Whichever is stronger wins; both together is the genuinely rare case. */
function faceOf(knownDims,conviction){
  const breadth=knownDims/N_DIMS;
  const eyes=breadth>=.78, mouth=conviction>=.62;
  if(eyes&&mouth&&breadth>=.9&&conviction>=.8)return 'both';
  if(eyes&&mouth)return breadth-.78>conviction-.62?'eyes':'mouth';
  return eyes?'eyes':mouth?'mouth':'none';
}
function drawFace(g,S,kind){
  const b={x:S*.5,y:S*.5,r:S*.27};
  g.fillStyle=INK;g.beginPath();g.arc(b.x,b.y,b.r,0,TAU);g.fill();
  g.fillStyle=`rgba(${HILITE},.13)`;g.beginPath();
  g.ellipse(b.x-b.r*.34,b.y-b.r*.5,b.r*.46,b.r*.19,-.35,0,TAU);g.fill();
  const eye=(x,y,r)=>{g.fillStyle='rgba(250,247,241,.93)';g.beginPath();
    g.ellipse(x,y,r,r*.82,0,0,TAU);g.fill();
    g.fillStyle='rgba(20,17,14,.95)';g.beginPath();
    g.arc(x+r*.13,y+r*.06,r*.42,0,TAU);g.fill();};
  if(kind==='eyes'||kind==='both'){eye(b.x-b.r*.34,b.y-b.r*.06,b.r*.20);eye(b.x+b.r*.34,b.y-b.r*.06,b.r*.20);}
  if(kind==='mouth'||kind==='both'){
    const my=kind==='both'?b.y+b.r*.48:b.y+b.r*.12;
    g.fillStyle='rgba(250,247,241,.92)';g.beginPath();
    g.moveTo(b.x-b.r*.42,my);g.quadraticCurveTo(b.x,my+b.r*.40,b.x+b.r*.42,my);
    g.quadraticCurveTo(b.x,my+b.r*.13,b.x-b.r*.42,my);g.fill();
    g.fillStyle='rgba(20,17,14,.9)';                       // a few teeth, never a grin
    for(const u of[-.5,-.16,.18,.52]){const tx=b.x+u*b.r*.62;
      g.beginPath();g.moveTo(tx-b.r*.05,my+b.r*.02);g.lineTo(tx+b.r*.05,my+b.r*.02);
      g.lineTo(tx,my+b.r*.14);g.closePath();g.fill();}}
}
const FACES=[
  {nm:'未開眼',en:'11/18 known · mild opinions',k:'none',
   d:'the ordinary being — most palates live here'},
  {nm:'開眼',en:'15/18 known · fog retreated',k:'eyes',
   d:'BREADTH: the engine can see your whole taste'},
  {nm:'開口',en:'11/18 known · decided paлate',k:'mouth',
   d:'CONVICTION: strong loves and real dislikes'},
  {nm:'眼口俱開',en:'17/18 known · fierce opinions',k:'both',
   d:'RARE: breadth AND conviction both extreme'},
];

/* ═══════════════════════════════════════════════════════════════════
 * PART 3 — TRACES: seven one-off fidelity sketches. REFERENCE ONLY —
 * see the file header. Not a parametric API; do not call these fn()s
 * expecting a (mix) or species argument to change the output.
 * ═══════════════════════════════════════════════════════════════════ */

/* 描稿 · TRACES of the owner's seven sketches (2026-08-02).
   Fidelity test, owner's words: "trace them if you need to. I need to know if
   you can do it." So: no data, no generator — seven bespoke drawings that
   reproduce the sheet's elements as closely as canvas strokes allow. If these
   pass, the gesture library is refactored to THESE shapes and re-wired to
   data; if they miss, we fall back to another rendering approach. */
const TR_INK='rgba(33,29,24,.92)';
function trLeaf(g,x,y,ang,L,w,fill){
  g.fillStyle=fill||TR_INK;
  const ca=Math.cos(ang),sa=Math.sin(ang),px=-sa,py=ca;
  g.beginPath();g.moveTo(x,y);
  g.quadraticCurveTo(x+ca*L*.5+px*w,y+sa*L*.5+py*w,x+ca*L,y+sa*L);
  g.quadraticCurveTo(x+ca*L*.5-px*w,y+sa*L*.5-py*w,x,y);
  g.fill();
}
/* a MITTEN claw: one fat lobe with a wedge bitten out of the tip, on a short
   arm. The owner's claws have mass; a thin leaf reads as a feather. */
function trClaw(g,S,bx,by,ang,L,w){
  const ca=Math.cos(ang),sa=Math.sin(ang),px=-sa,py=ca;
  g.fillStyle=TR_INK;
  g.beginPath();
  g.moveTo(bx+px*w*.35,by+py*w*.35);
  g.quadraticCurveTo(bx+ca*L*.55+px*w*1.15,by+sa*L*.55+py*w*1.15,
                     bx+ca*L+px*w*.30,by+sa*L+py*w*.30);
  g.lineTo(bx+ca*L*.74+px*w*.02,by+sa*L*.74+py*w*.02);   // the bite
  g.lineTo(bx+ca*L*.98-px*w*.34,by+sa*L*.98-py*w*.34);
  g.quadraticCurveTo(bx+ca*L*.5-px*w*1.05,by+sa*L*.5-py*w*1.05,
                     bx-px*w*.35,by-py*w*.35);
  g.closePath();g.fill();
}
function trFringe(g,S,cx,cy,rx,ry,seed,n,len){
  const rr=seededRandom('tf:'+seed);
  g.strokeStyle='rgba(33,29,24,.85)';g.lineWidth=Math.max(.7,S*.006);g.lineCap='round';
  for(let i=0;i<n;i++){
    const a=(i/n)*TAU;
    const x=cx+Math.cos(a)*rx,y=cy+Math.sin(a)*ry;
    let nx=Math.cos(a)/rx,ny=Math.sin(a)/ry;
    const d=Math.hypot(nx,ny)||1;nx/=d;ny/=d;
    const L=S*len*(.6+rr()*.9),t2=(rr()-.5)*.6,ca=Math.cos(t2),sa=Math.sin(t2);
    g.beginPath();g.moveTo(x,y);
    g.lineTo(x+(nx*ca-ny*sa)*L,y+(nx*sa+ny*ca)*L);g.stroke();
  }
}
const TRACES=[
 {nm:'其一',en:'horn · chicken wing · cow tail · soft skin',fn:(g,S)=>{
   // the misregistered print-shadow behind the body
   g.fillStyle='rgba(33,29,24,.14)';
   g.beginPath();g.ellipse(S*.545,S*.475,S*.265,S*.205,0,0,TAU);g.fill();
   // soft skin: ruffled cloud bumps along the crown
   g.fillStyle=TR_INK;
   for(let i=0;i<10;i++){
     const a=Math.PI+(i/9)*Math.PI;
     const x=S*.48+Math.cos(a)*S*.245,y=S*.52+Math.sin(a)*S*.185;
     g.beginPath();g.arc(x,y,S*.034,0,TAU);g.fill();
   }
   g.beginPath();g.ellipse(S*.48,S*.52,S*.26,S*.20,0,0,TAU);g.fill();
   // the DARKER belly plate (their interior is darker, not lighter)
   g.fillStyle='rgba(12,10,9,.55)';
   g.beginPath();g.ellipse(S*.48,S*.545,S*.195,S*.145,0,0,TAU);g.fill();
   g.fillStyle='rgba(250,247,241,.10)';
   g.beginPath();g.ellipse(S*.40,S*.47,S*.05,S*.02,-.4,0,TAU);g.fill();
   // horns: SHORT, FAT, round-tipped, close together, hooking inward.
   // (First pass drew them tall, thin and wide apart — that reads as antennae.)
   g.strokeStyle=TR_INK;g.lineCap='round';g.lineWidth=S*.072;
   g.beginPath();g.moveTo(S*.415,S*.335);g.quadraticCurveTo(S*.375,S*.185,S*.425,S*.145);g.stroke();
   g.beginPath();g.moveTo(S*.545,S*.335);g.quadraticCurveTo(S*.585,S*.185,S*.535,S*.145);g.stroke();
   // chicken wings: SUBSTANTIAL ruffle-fans — stubby arms, not feather slivers
   for(const sd of[-1,1]){
     const bx=S*(.48+sd*.215),by=S*.495;
     for(let i=0;i<4;i++){
       const a=sd<0?(Math.PI+(-.62+i*.38)):(.62-i*.38);
       trLeaf(g,bx,by,a,S*(.165-.014*i),S*.046);
     }
   }
   // cow tail: thin line, three-prong tuft
   g.strokeStyle=TR_INK;g.lineWidth=S*.011;
   g.beginPath();g.moveTo(S*.695,S*.615);g.quadraticCurveTo(S*.79,S*.655,S*.795,S*.735);g.stroke();
   g.lineWidth=S*.009;
   for(const a of[.9,1.35,1.8]){
     g.beginPath();g.moveTo(S*.795,S*.735);
     g.lineTo(S*.795+Math.cos(a)*S*.04,S*.735+Math.sin(a)*S*.04);g.stroke();
   }
   // legs ending in cleft hoof blocks
   g.lineWidth=S*.02;
   for(const lx of[.435,.52]){
     g.beginPath();g.moveTo(S*lx,S*.70);g.lineTo(S*lx,S*.855);g.stroke();
     g.fillStyle=TR_INK;
     g.fillRect(S*(lx-.023),S*.855,S*.019,S*.022);
     g.fillRect(S*(lx+.004),S*.855,S*.019,S*.022);
   }
 }},
 {nm:'其二',en:'hairy · fish tail (+ mushrooms)',fn:(g,S)=>{
   const cx=S*.44,cy=S*.55,rx=S*.21,ry=S*.26;
   // fish tail: one solid two-fluke shape off the lower-right rim
   trLeaf(g,S*.60,S*.70,-.10,S*.115,S*.030);
   trLeaf(g,S*.60,S*.70,.66,S*.115,S*.030);
   g.fillStyle=TR_INK;
   g.beginPath();g.ellipse(cx,cy,rx,ry,0,0,TAU);g.fill();
   trFringe(g,S,cx,cy,rx,ry,'t2',120,.020);
   // mushrooms: thick stem + a SOLID DOMED cap (first pass read as bare spikes)
   for(const m2 of[{x:.345,tip:.205},{x:.515,tip:.195}]){
     g.strokeStyle=TR_INK;g.lineWidth=S*.030;g.lineCap='butt';
     g.beginPath();g.moveTo(S*m2.x,S*.325);g.lineTo(S*(m2.x-.012),S*(m2.tip+.045));g.stroke();
     g.fillStyle=TR_INK;
     g.beginPath();
     g.ellipse(S*(m2.x-.014),S*(m2.tip+.048),S*.082,S*.055,0,Math.PI,TAU);
     g.fill();
     g.fillRect(S*(m2.x-.096),S*(m2.tip+.040),S*.164,S*.014);
     g.strokeStyle=TR_INK;g.lineWidth=S*.009;g.lineCap='round';
     for(const off of[-.036,0,.036]){                 // two small sprouts on top
       g.beginPath();g.moveTo(S*(m2.x-.014+off),S*(m2.tip+.006));
       g.lineTo(S*(m2.x-.014+off*1.5),S*(m2.tip-.030));g.stroke();
     }
   }
 }},
 {nm:'其三',en:'smooth skin · fin',fn:(g,S)=>{
   const cx=S*.5,cy=S*.42,r=S*.235;
   // fins: solid pointed leaves at the sides (behind the ball)
   trLeaf(g,S*.285,S*.40,-2.85,S*.095,S*.028);
   trLeaf(g,S*.715,S*.40,-.29,S*.095,S*.028);
   // pale jellyfish tendrils
   g.lineCap='round';g.lineWidth=S*.013;g.strokeStyle='rgba(33,29,24,.30)';
   [.415,.47,.53,.585].forEach((x,i)=>{
     g.beginPath();g.moveTo(S*x,cy+r*.92);
     g.bezierCurveTo(S*(x+(i%2?.02:-.02)),S*.72,S*(x+(i%2?-.02:.02)),S*.80,
       S*(x+(i%2?.015:-.015)),S*.88);
     g.stroke();
   });
   // smooth = a LIGHTER grey ball with a clean dark outline
   g.fillStyle='rgba(33,29,24,.58)';
   g.beginPath();g.arc(cx,cy,r,0,TAU);g.fill();
   g.strokeStyle='rgba(33,29,24,.88)';g.lineWidth=S*.012;
   g.beginPath();g.arc(cx,cy,r,0,TAU);g.stroke();
   // one crisp gloss bean + a small satellite
   g.fillStyle='rgba(250,247,241,.60)';
   g.beginPath();g.ellipse(S*.60,S*.295,S*.055,S*.026,.5,0,TAU);g.fill();
   g.fillStyle='rgba(250,247,241,.30)';
   g.beginPath();g.ellipse(S*.565,S*.35,S*.02,S*.011,.5,0,TAU);g.fill();
 }},
 {nm:'其四',en:'hairy · crab claw · wing · eyes',fn:(g,S)=>{
   const cx=S*.5,cy=S*.52,r=S*.225;
   // wings: BIG serrated blades sweeping up and out (first pass: tiny tufts)
   for(const sd of[-1,1]){
     const bx=cx+sd*r*.58,by=cy-r*.68;
     for(let i=0;i<4;i++){
       const a=sd<0?(-2.62+i*.30):(-.52-i*.30);
       const L=S*(.235-.022*i);
       trLeaf(g,bx,by,a,L,S*(.040-.005*i));
       const ca=Math.cos(a),sa2=Math.sin(a),px=-sa2,py=ca;   // barbed edge
       g.fillStyle=TR_INK;
       for(let k=1;k<=4;k++){
         const u=k/5, mx=bx+ca*L*u, my=by+sa2*L*u;
         g.beginPath();g.moveTo(mx,my);
         g.lineTo(mx+px*S*.042+ca*S*.020,my+py*S*.042+sa2*S*.020);
         g.lineTo(mx+ca*S*.045,my+sa2*S*.045);
         g.closePath();g.fill();
       }
     }
   }
   // crab claws: mittens with mass, angled down-and-out
   trClaw(g,S,cx-r*.72,cy+r*.50,Math.PI-.62,S*.155,S*.052);
   trClaw(g,S,cx+r*.72,cy+r*.50,.62,S*.155,S*.052);
   g.fillStyle=TR_INK;
   g.beginPath();g.arc(cx,cy,r,0,TAU);g.fill();
   trFringe(g,S,cx,cy,r,r,'t4',120,.018);
   // eyes: hollow white RINGS, small and close — no pupil
   g.strokeStyle='rgba(250,247,241,.92)';g.lineWidth=S*.010;
   g.beginPath();g.arc(cx-S*.055,cy-S*.01,S*.017,0,TAU);g.stroke();
   g.beginPath();g.arc(cx+S*.055,cy-S*.01,S*.017,0,TAU);g.stroke();
 }},
 {nm:'其五',en:'ears · horn · shell · lobster claw',fn:(g,S)=>{
   const cx=S*.5,cy=S*.54,rx=S*.25,ry=S*.225;
   // lobster claws: BIG left, modest right — asymmetric, and with real mass
   trClaw(g,S,S*.27,S*.60,Math.PI-.34,S*.195,S*.062);
   trClaw(g,S,S*.73,S*.60,.20,S*.135,S*.040);
   // ears: drooping oval flaps
   g.fillStyle=TR_INK;
   g.beginPath();g.ellipse(S*.355,S*.315,S*.052,S*.023,-.5,0,TAU);g.fill();
   g.beginPath();g.ellipse(S*.645,S*.315,S*.052,S*.023,.5,0,TAU);g.fill();
   // tiny horns
   trLeaf(g,S*.455,S*.30,-1.75,S*.05,S*.010);
   trLeaf(g,S*.545,S*.30,-1.39,S*.05,S*.010);
   g.beginPath();g.ellipse(cx,cy,rx,ry,0,0,TAU);g.fill();
   // shell: layered plates, chevron bottom edges, faint lit top line
   g.save();g.beginPath();g.ellipse(cx,cy,rx,ry,0,0,TAU);g.clip();
   for(let row=0;row<4;row++){
     const yT=S*(.40+row*.095);
     g.fillStyle='rgba(10,9,8,.5)';
     g.beginPath();g.moveTo(S*.18,yT);g.lineTo(S*.82,yT);
     let x=S*.82;const step=S*.107,dip=S*.085,baseH=S*.048;
     g.lineTo(x,yT+baseH);
     while(x>S*.18){
       g.lineTo(x-step*.5,yT+dip);
       g.lineTo(x-step,yT+baseH);
       x-=step;
     }
     g.closePath();g.fill();
     g.strokeStyle='rgba(250,247,241,.10)';g.lineWidth=S*.008;
     g.beginPath();g.moveTo(S*.18,yT);g.lineTo(S*.82,yT);g.stroke();
   }
   g.restore();
 }},
 {nm:'其六',en:'ears · veg · tail · legs',fn:(g,S)=>{
   const cx=S*.5,cy=S*.56,rx=S*.245,ry=S*.215;
   // tail: THICK and smooth with an upturned tip (first pass was a wire)
   g.fillStyle=TR_INK;
   taperQuad(g,S*.66,S*.675,S*.815,S*.760,S*.048,S*.030);
   taperQuad(g,S*.815,S*.760,S*.930,S*.720,S*.030,S*.012);
   // veg: one stem, and BIG leaf blades on their own short stalks
   g.strokeStyle=TR_INK;g.lineCap='round';g.lineWidth=S*.017;
   g.beginPath();g.moveTo(S*.555,S*.36);g.quadraticCurveTo(S*.545,S*.26,S*.53,S*.185);g.stroke();
   const VEG=[[-2.55,.135],[-2.05,.155],[-1.55,.185],[-1.05,.155],[-.55,.135]];
   VEG.forEach(([a,L])=>{
     g.lineWidth=S*.012;
     g.beginPath();g.moveTo(S*.53,S*.185);
     g.lineTo(S*.53+Math.cos(a)*S*L*.42,S*.185+Math.sin(a)*S*L*.42);g.stroke();
     trLeaf(g,S*.53+Math.cos(a)*S*L*.38,S*.185+Math.sin(a)*S*L*.38,a,S*L*.72,S*.036);
   });
   // small pointed ears beside the sprout
   trLeaf(g,S*.405,S*.35,-1.85,S*.05,S*.011);
   trLeaf(g,S*.455,S*.335,-1.6,S*.045,S*.010);
   g.fillStyle=TR_INK;
   g.beginPath();g.ellipse(cx,cy,rx,ry,0,0,TAU);g.fill();
   // the stalk line running INTO the body
   g.strokeStyle='rgba(10,9,8,.5)';g.lineWidth=S*.011;
   g.beginPath();g.moveTo(S*.553,S*.355);g.quadraticCurveTo(S*.565,S*.44,S*.558,S*.52);g.stroke();
   // thin bird legs, splayed toes
   g.strokeStyle=TR_INK;g.lineWidth=S*.011;
   g.beginPath();g.moveTo(S*.415,S*.755);g.lineTo(S*.395,S*.895);g.stroke();
   g.beginPath();g.moveTo(S*.475,S*.765);g.lineTo(S*.475,S*.90);g.stroke();
   g.lineWidth=S*.008;
   for(const[fx,fy]of[[.395,.895],[.475,.90]])
     for(const a of[1.15,1.57,1.99]){
       g.beginPath();g.moveTo(S*fx,S*fy);
       g.lineTo(S*fx+Math.cos(a)*S*.030,S*fy+Math.sin(a)*S*.030);g.stroke();
     }
 }},
 {nm:'其七',en:'ears · rough skin · mouth · duck feet',fn:(g,S)=>{
   const cx=S*.5,cy=S*.49,r=S*.225;
   const rr=seededRandom('t7');
   // antennae: thin, PALE, dotted tips
   g.strokeStyle='rgba(33,29,24,.45)';g.lineCap='round';g.lineWidth=S*.007;
   g.beginPath();g.moveTo(S*.462,S*.28);g.quadraticCurveTo(S*.43,S*.18,S*.435,S*.10);g.stroke();
   g.beginPath();g.moveTo(S*.538,S*.28);g.quadraticCurveTo(S*.575,S*.18,S*.568,S*.10);g.stroke();
   g.fillStyle='rgba(33,29,24,.45)';
   g.beginPath();g.arc(S*.435,S*.095,S*.008,0,TAU);g.fill();
   g.beginPath();g.arc(S*.568,S*.095,S*.008,0,TAU);g.fill();
   // ear nubs: thick, round-tipped
   g.strokeStyle=TR_INK;g.lineWidth=S*.026;
   g.beginPath();g.moveTo(S*.415,S*.30);g.lineTo(S*.375,S*.235);g.stroke();
   g.beginPath();g.moveTo(S*.585,S*.30);g.lineTo(S*.625,S*.235);g.stroke();
   // legs + solid webbed duck feet
   g.lineWidth=S*.013;g.strokeStyle='rgba(33,29,24,.85)';
   g.beginPath();g.moveTo(S*.455,S*.70);g.lineTo(S*.447,S*.855);g.stroke();
   g.beginPath();g.moveTo(S*.545,S*.70);g.lineTo(S*.553,S*.855);g.stroke();
   g.fillStyle=TR_INK;
   for(const[fx,sd]of[[.447,-1],[.553,1]]){
     g.beginPath();g.moveTo(S*fx,S*.85);
     g.lineTo(S*(fx-.040+sd*.008),S*.905);g.lineTo(S*(fx+.040+sd*.008),S*.905);
     g.closePath();g.fill();
   }
   g.beginPath();g.arc(cx,cy,r,0,TAU);g.fill();
   // rough: dark craters inside…
   g.fillStyle='rgba(9,8,7,.5)';
   for(let i=0;i<9;i++){
     const a=rr()*TAU,d=Math.sqrt(rr())*r*.78;
     g.beginPath();
     g.ellipse(cx+Math.cos(a)*d,cy+Math.sin(a)*d,S*(.012+rr()*.026),S*(.010+rr()*.020),rr()*TAU,0,TAU);
     g.fill();
   }
   // …bumps that break the outline, and spatter just past it
   g.fillStyle=TR_INK;
   for(let i=0;i<4;i++){
     const a=.4+i*1.5;
     g.beginPath();
     g.ellipse(cx+Math.cos(a)*r,cy+Math.sin(a)*r,S*(.014+rr()*.014),S*(.011+rr()*.011),a,0,TAU);
     g.fill();
   }
   for(let i=0;i<12;i++){
     const a=rr()*TAU,d=r*(1.06+rr()*.16);
     g.fillStyle=`rgba(33,29,24,${.35+rr()*.3})`;
     g.beginPath();g.arc(cx+Math.cos(a)*d,cy+Math.sin(a)*d,S*(.004+rr()*.007),0,TAU);g.fill();
   }
   // mouth: pale slot, two dark notches biting from its top edge = teeth
   const mw=S*.165,mh=S*.05,my=S*.615;
   g.fillStyle='rgba(196,192,184,.92)';
   g.beginPath();
   if(g.roundRect)g.roundRect(cx-mw/2,my-mh/2,mw,mh,S*.02);
   else g.rect(cx-mw/2,my-mh/2,mw,mh);
   g.fill();
   g.fillStyle=TR_INK;
   g.beginPath();g.arc(cx-S*.036,my-mh/2,S*.020,0,TAU);g.fill();
   g.beginPath();g.arc(cx+S*.036,my-mh/2,S*.020,0,TAU);g.fill();
 }},
];
