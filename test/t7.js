/* 囤货决策器 · 回归测试 v3：多批旧货草稿/接管 + 输入交互（滑块、滚轮、问号提示） */
const fs = require('fs');
const HTML = require('path').join(__dirname, '..', 'index.html');
const src = fs.readFileSync(HTML, 'utf8');
const script = src.match(/<script>([\s\S]*?)<\/script>/)[1];

/* ---------------- DOM 桩 ---------------- */
function mkEl(id) {
  return {
    id, value: '', innerHTML: '', textContent: '', checked: false, open: false,
    dataset: {}, style: {}, max: '', min: '', step: '', type: '',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    appendChild() {},
  };
}
const els = {};
const doc = {
  getElementById(id) {
    if (!els[id]) {
      els[id] = mkEl(id);
      if (id === 'modeBar') {
        const btns = ['count', 'volume', 'pack'].map(m => { const b = mkEl('btn-' + m); b.dataset.mode = m; return b; });
        els[id].querySelectorAll = () => btns;
        els[id].querySelector = sel => btns.find(b => sel.indexOf(b.dataset.mode) >= 0) || null;
        els[id]._btns = btns;
      }
    }
    return els[id];
  },
  querySelectorAll() { return []; },
};
global.document = doc;
doc.addEventListener = () => {};
doc.removeEventListener = () => {};
doc.activeElement = null;
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
global.window = global;
global.IntersectionObserver = class { constructor(){} observe(){} unobserve(){} disconnect(){} };
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.innerWidth = 390; global.innerHeight = 800;

const patched = script + `
;globalThis.__A = {
  get state(){return state}, get mode(){return mode}, setMode(m){mode=m;},
  calcCore, derive, simulate, renderInputs, syncStateFromInputs, renderVolRows, renderPresets, PRESETS,
  get LAST(){return LAST},
  dayDiff, dateStr, dateToStr, nextSale, bottleLabel, fmt, amt, sceneUnit,
  resetAll, persist, restore, DEFAULT_STATE, clone,
  stockFieldHtml, oldBatchUI, FS, T, bindRanges,
  setOffers(o){ offers = o; }, get offers(){ return offers; }, renderOffers, resetCompare,
  getEl(id){ return document.getElementById(id); },
};`;
eval(patched);
const A = global.__A;

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  ✗ ' + msg); } };
const near = (a, b, eps) => Math.abs(a - b) <= (eps === undefined ? 1e-6 : eps);
const strip = h => String(h).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const inputsHtml = () => A.getEl('k-inputs').innerHTML;
const out = () => strip(A.getEl('k-out').innerHTML);
const TODAY = () => A.dateToStr(new Date());

function setup(mode, patch) {
  A.setMode(mode);
  Object.assign(A.state[mode], patch);
  A.renderInputs();
  A.calcCore();
  return A.LAST;
}
const BASE_COUNT = { gap: 3, perUse: 1, stock: 6, oldExp: A.dateStr(150), oldBatches: [], useBatches: false,
  expKnown: true, setSize: 20, setPrice: 99, planSets: 2, vsNormal: 'unknown',
  newExp: A.dateStr(540), arrive: TODAY(), sale: A.dateStr(30) };

/* ============================================================
   1. 「加一批旧货」不能瞬间把库存清零（草稿 vs 接管）
============================================================ */
console.log('======== 1. 多批旧货：草稿不接管库存 ========');
{
  const before = setup('count', BASE_COUNT);
  const kind0 = before.rec.kind, stock0 = before.stockAmount;
  console.log('  初始：kind=' + kind0 + ' 库存=' + stock0);
  ok(near(stock0, 6), '初始库存应为 6，实际 ' + stock0);

  // 模拟点「加一批旧货」：新批次数量是 0（旧实现会让库存瞬间变 0）
  const s = A.state.count;
  s.oldBatches = [{ amount: 0, expiry: A.dateStr(150) }];
  A.renderInputs(); A.calcCore();
  let L = A.LAST;
  console.log('  加了 1 行空批次（数量 0）：库存=' + L.stockAmount + ' kind=' + L.rec.kind);
  ok(near(L.stockAmount, 6), '草稿批次不得改变库存，应为 6，实际 ' + L.stockAmount);
  ok(L.rec.kind === kind0, '草稿批次不得改变结论，期望 ' + kind0 + ' 实际 ' + L.rec.kind);

  // 再模拟点一次（实现里第一次会把当前库存预填进第 1 批），依然是草稿
  s.oldBatches = [{ amount: 6, expiry: A.dateStr(150) }, { amount: 0, expiry: A.dateStr(150) }];
  A.renderInputs(); A.calcCore();
  L = A.LAST;
  ok(near(L.stockAmount, 6), '草稿里预填了库存，也不该改变口径（仍是 6），实际 ' + L.stockAmount);

  // 用户填完各批但还没接管
  s.oldBatches = [{ amount: 5, expiry: A.dateStr(3) }, { amount: 15, expiry: A.dateStr(400) }];
  A.renderInputs(); A.calcCore();
  ok(near(A.LAST.stockAmount, 6), '填好但未确认时，仍沿用单一库存 6，实际 ' + A.LAST.stockAmount);

  const h = inputsHtml();
  ok(h.indexOf('草稿 · 还没生效') >= 0, '未接管时应标出「草稿 · 还没生效」');
  ok(h.indexOf('id="applyOldBatch"') >= 0, '未接管时应提供确认按钮');
  ok(h.indexOf('id="k-stock"') >= 0, '未接管时上面的库存框应仍可编辑');
  ok(h.indexOf('id="k-stockRO"') < 0, '未接管时不该出现只读库存框');

  // 点「就按这 2 批算」→ 接管（换成「1 天 1 片」，便于核对过期片数）
  s.gap = 1; s.perUse = 1;
  s.useBatches = true;
  A.renderInputs(); A.calcCore();
  L = A.LAST;
  console.log('  接管后：库存=' + L.stockAmount + '（5 + 15）');
  ok(near(L.stockAmount, 20), '接管后库存应等于各批合计 20，实际 ' + L.stockAmount);
  ok(near(L.rec.oldStandaloneWaste, 2), '3 天后到期的 5 片只吃掉 3 片 → 浪费 2，实际 ' + L.rec.oldStandaloneWaste.toFixed(2));

  const h2 = inputsHtml();
  ok(h2.indexOf('id="k-stockRO"') >= 0, '接管后应换成只读的「各批合计」');
  ok(h2.indexOf('id="k-stock"') < 0, '接管后不该再单独编辑上面的库存');
  ok(h2.indexOf('已接管库存') >= 0, '接管后应标出「已接管库存」');
  ok(strip(h2).indexOf('20 份') >= 0, '只读框里应显示各批合计 20 份');

  // 接管状态下 syncStateFromInputs 不能把库存清零（k-stock 已不存在）
  A.syncStateFromInputs();
  ok(near(A.state.count.stock, 6), '接管后不该被空输入框覆盖成 0，实际 ' + A.state.count.stock);
  A.calcCore();
  ok(near(A.LAST.stockAmount, 20), '接管后重算仍应为 20，实际 ' + A.LAST.stockAmount);

  // 改回单一库存
  s.oldBatches = []; s.useBatches = false;
  A.renderInputs(); A.calcCore();
  ok(near(A.LAST.stockAmount, 6), '改回单一库存后应恢复为 6，实际 ' + A.LAST.stockAmount);
}

/* ============================================================
   2. 接管后数量为空 / 为 0 的行为要一致，不偷偷回退
============================================================ */
console.log('\n======== 2. 接管后合计为 0 的行为 ========');
{
  const s = A.state.count;
  Object.assign(s, BASE_COUNT);
  s.useBatches = true;
  s.oldBatches = [{ amount: 0, expiry: A.dateStr(150) }];
  A.renderInputs(); A.calcCore();
  ok(near(A.LAST.stockAmount, 0), '接管后合计 0 → 库存就是 0（不偷偷回退到 6），实际 ' + A.LAST.stockAmount);
  ok(strip(inputsHtml()).indexOf('各批合计为 0') >= 0, '合计为 0 时应给出提示');
  ok(inputsHtml().indexOf('id="k-stock"') < 0, '接管后仍不应出现可编辑库存框');
  Object.assign(s, BASE_COUNT);
}

/* ============================================================
   3. 三种场景都能接管，且过期判断按批算
============================================================ */
console.log('\n======== 3. 三场景接管 ========');
{
  // volume：旧货两批（100ml 10 天后到期 + 300ml 400 天后到期）
  const v = { rateMode: 'bottle', bottleMl: 500, bottleDays: 125, daily: 4, stock: 120, stockUnit: 'ml',
    oldExp: '', oldBatches: [], useBatches: false, expKnown: true,
    post: [{ ml: 500, qty: 1 }], giftMl: 60, giftUse: 100, giftMerge: true, giftValue: 30,
    setPrice: 399, planSets: 1, vsNormal: 'unknown', newExp: A.dateStr(540), arrive: TODAY(), sale: A.dateStr(30) };
  setup('volume', v);
  ok(near(A.LAST.stockAmount, 120), 'volume 草稿态应沿用单一库存 120，实际 ' + A.LAST.stockAmount);
  A.state.volume.oldBatches = [{ amount: 100, expiry: A.dateStr(10) }, { amount: 300, expiry: A.dateStr(400) }];
  A.renderInputs(); A.calcCore();
  ok(near(A.LAST.stockAmount, 120), 'volume 草稿态仍为 120，实际 ' + A.LAST.stockAmount);
  A.state.volume.useBatches = true;
  A.renderInputs(); A.calcCore();
  ok(near(A.LAST.stockAmount, 400), 'volume 接管后应为 400ml，实际 ' + A.LAST.stockAmount);
  const hv = inputsHtml() + A.getEl('vol-rows').innerHTML;
  ok(hv.indexOf('id="k-stockRO"') >= 0, 'volume 接管后应显示只读合计');
  ok(!/undefined|NaN/.test(hv), 'volume 输入区不该出现 undefined/NaN');
  ok(!/undefined|NaN/.test(out()), 'volume 结果区不该出现 undefined/NaN');

  // pack
  const p = { perPack: 30, stock: 2, oldExp: A.dateStr(200), oldBatches: [], useBatches: true,
    expKnown: true, setSize: 3, setPrice: 69, planSets: 2, vsNormal: 'unknown',
    newExp: A.dateStr(240), arrive: TODAY(), sale: A.dateStr(30) };
  const Lp = setup('pack', p);
  ok(near(Lp.stockAmount, 0), 'pack 接管但批次为空 → 0，实际 ' + Lp.stockAmount);
  A.state.pack.oldBatches = [{ amount: 1, expiry: A.dateStr(60) }, { amount: 2, expiry: A.dateStr(500) }];
  A.renderInputs(); A.calcCore();
  ok(near(A.LAST.stockAmount, 3), 'pack 接管后应为 3 件，实际 ' + A.LAST.stockAmount);
  ok(A.LAST.rec.kind && A.LAST.rec.kind.length > 0, 'pack 应给出结论分支');
}

/* ============================================================
   4. 输入交互：滑块（新布局：上=指标名+数字框，中=全宽滑块，下=min/max 刻度；
      滑块上限固定，超出上限走手动输入，滑块钉在最右、右刻度显示「20+套」）
============================================================ */
console.log('\n======== 4. 滑块 ========');
{
  setup('count', BASE_COUNT);
  const h = inputsHtml();
  ok(h.indexOf('fslide') >= 0, '滑块字段应使用新布局 fslide');
  ok(/data-num="k-planSets"/.test(h), '「打算买几套」应该是滑块');
  ok(/type="range"[^>]*data-num="k-planSets"[^>]*min="0"[^>]*max="20"[^>]*step="1"[^>]*value="2"/.test(h),
    'k-planSets 滑块上限应为 20（而非 8/grow），实际：' + (h.match(/<input type="range" data-num="k-planSets"[^>]*>/) || [''])[0]);
  ok(/id="k-planSets" type="number"[^>]*max="20"/.test(h), 'k-planSets 数字框应带 max=20（钳住滚轮/上下键，手动输入不受限）');
  ok(/data-num="k-perUse"/.test(h) && /id="k-perUse" type="number"[^>]*max="6"/.test(h), 'k-perUse 应带 max=6');
  ok(/data-num="k-setSize"/.test(h) && /type="range"[^>]*data-num="k-setSize"[^>]*max="30"/.test(h),
    '「每套份数」滑块上限应为 30');
  // 刻度行：min/max 标签 + 单位（每个滑块字段各有一行，找 k-planSets 那一行）
  const scales = h.match(/<div class="fs-scale">[\s\S]*?<\/div>/g) || [];
  ok(scales.some(s => { const t = strip(s); return t.indexOf('0套') >= 0 && t.indexOf('20套') >= 0; }),
    'k-planSets 刻度应显示「0套 / 20套」，实际：' + scales.map(strip).join(' | '));
  ok(/<div class="fs-top"><label>/.test(h), '指标名与数字框应在同一行（fs-top）');

  // 预填值超出滑块上限：滑块钉在最右，右刻度显示「30+份」（如「规格不合适」预设的 100 份/套）
  setup('count', Object.assign({}, BASE_COUNT, { setSize: 100, gap: 1, stock: 2 }));
  const hm = inputsHtml().match(/<input type="range" data-num="k-setSize"[^>]*>/);
  ok(hm && /max="30"/.test(hm[0]) && /value="30"/.test(hm[0]),
    '每套 100 份时滑块应固定 max=30 且钉在最右，实际 ' + (hm ? hm[0] : 'none'));
  const hs = inputsHtml().match(/<span class="fs-max"[^>]*>[^<]*<\/span>/g) || [];
  ok(hs.some(s => s.indexOf('data-cap="30"') >= 0 && s.indexOf('30+份') >= 0),
    '超上限时右刻度应显示「30+份」，实际：' + hs.join(' | '));

  // 体积场景：赠品「会用掉 %」也是滑块
  setup('volume', { rateMode: 'daily', daily: 4, stock: 120, stockUnit: 'ml', post: [{ ml: 250, qty: 1 }],
    giftMl: 60, giftUse: 100, giftMerge: true, giftValue: 30, setPrice: 199, planSets: 2,
    oldBatches: [], useBatches: false, expKnown: true, vsNormal: 'unknown',
    newExp: A.dateStr(60), arrive: TODAY(), sale: A.dateStr(30) });
  const hv = A.getEl('vol-rows').innerHTML;
  ok(/data-num="spec-use"/.test(hv), '赠品「会用掉 %」应该是滑块');
  ok(/id="spec-use" type="number"[^>]*max="100"/.test(hv), '「会用掉 %」数字框应有 max=100');
  ok(/data-num="k-daily"[^>]*max="30"/.test(inputsHtml()), '「每天用多少 ml」滑块上限应为 30');
}

/* ============================================================
   5. 输入交互：滚轮 + 提示图标
============================================================ */
console.log('\n======== 5. 滚轮与问号提示 ========');
{
  ok(script.indexOf("addEventListener('wheel'") > 0, '应注册滚轮监听');
  ok(script.indexOf('overSpin') > 0 && script.indexOf('r.right - 22') > 0,
    '滚轮应只在聚焦、或指针停在右侧上下箭头上时生效（其余交给页面滚动）');
  ok(script.indexOf("{ passive: false }") > 0, '滚轮监听需 passive:false 才能阻止页面滚动');
  ok(typeof A.FS === 'function' && typeof A.bindRanges === 'function' && typeof A.T === 'function',
    'FS / bindRanges / T 都应可用');

  const tipHtml = A.T('这是一段说明');
  ok(tipHtml.indexOf('class="q"') >= 0 && tipHtml.indexOf('data-tip="这是一段说明"') >= 0, 'T() 应生成带 data-tip 的问号');
  ok(A.T('a"b').indexOf('&quot;') >= 0, 'T() 里的引号需要转义，避免破坏属性');
  ok(A.T('') === '', 'T() 传空值时不渲染');

  setup('count', BASE_COUNT);
  const h = inputsHtml();
  ok(h.indexOf('class="q"') >= 0, '主流程输入区应出现问号图标');
  const tips = [...h.matchAll(/data-tip="([^"]*)"/g)].map(m => m[1]);
  ok(tips.length >= 6, '主流程应把长说明收进问号里，实际 ' + tips.length + ' 个');
  // 这些解释性长句不该再直接铺在版面上（strip 掉标签后不可见）
  const visible = strip(h);
  ['直播间 / 整箱货常常看不到批次', '多买（提前囤货）划不划算，取决于这一项', '只填一个最早到期日，会把整批库存当成同一天到期']
    .forEach(t => ok(visible.indexOf(t) < 0, '不该继续平铺长说明：「' + t + '」'));
  // 但它们应该还找得到（收进 tooltip）
  ok(tips.some(t => t.indexOf('不确定到期日') >= 0), '到期日估算说明应保留在问号里');
  ok(tips.some(t => t.indexOf('价格优势') >= 0), '价格对比说明应保留在问号里');
  ok(tips.some(t => t.indexOf('同一天到期') >= 0), '「多批旧货」的说明应保留在问号里');

  // 静态 HTML 里的问号（三个辅助页的说明；其余解释性内容移到了「计算方法」独立页）
  ok((src.match(/class="q" data-tip=/g) || []).length >= 3, '静态辅助页也应有问号提示');

  // 体积场景：赠品口径说明收进问号
  setup('volume', { rateMode: 'daily', daily: 4, stock: 120, stockUnit: 'ml', post: [{ ml: 250, qty: 1 }],
    giftMl: 60, giftUse: 100, giftMerge: true, giftValue: 30, setPrice: 199, planSets: 2,
    oldBatches: [], useBatches: false, expKnown: true, vsNormal: 'unknown',
    newExp: A.dateStr(60), arrive: TODAY(), sale: A.dateStr(30) });
  const hv = A.getEl('vol-rows').innerHTML;
  ok(hv.indexOf('class="q"') >= 0, '赠品口径说明应收进问号');
  ok(strip(hv).indexOf('先看是不是同款') < 0, '赠品长说明不该继续平铺');
  const vt = A.getEl('volTotal').innerHTML;
  ok(vt.indexOf('data-tip=') >= 0, '合计行的解释应挂在问号上');
}

/* ============================================================
   5.5 口径统一：比价与主流程同一模拟器（多批旧货 + 先到期先用 + 到货时间）
============================================================ */
console.log('\n======== 5.5 比价口径统一 ========');
{
  // LAST 快照应携带真实旧货批次
  setup('count', Object.assign({}, BASE_COUNT, { gap: 1, perUse: 1, stock: 200, oldExp: A.dateStr(400) }));
  ok(Array.isArray(A.LAST.oldBs) && A.LAST.oldBs.length === 1 && A.LAST.oldBs[0].units === 200,
    'LAST.oldBs 应携带主流程的旧货批次');

  // A. 旧简化窗口会把「效期短于旧货占用期」的候选判死；FIFO（先到期先用）下它其实先被消耗
  A.setOffers([{ name: '短效期 30 片', price: 30, amount: 30, shelf: 100 }]);
  A.renderOffers();
  let h = A.getEl('offers-out').innerHTML;
  ok(h.indexOf('先排除') < 0, 'FIFO 下效期 100 天的候选不应被判为完全浪费');
  ok(h.indexOf('30 份') >= 0 && h.indexOf('>¥1<') >= 0, '应按「先用短效期」算出能用掉 30 份、实际每份 ¥1');

  // B. 多批旧货进模拟器：短效期候选排到最前，只吃得到到期前的量
  const s = A.state.count;
  Object.assign(s, BASE_COUNT, { gap: 1, perUse: 1 });
  s.useBatches = true;
  s.oldBatches = [{ amount: 5, expiry: A.dateStr(10) }, { amount: 100, expiry: A.dateStr(400) }];
  A.renderInputs(); A.calcCore();
  A.setOffers([{ name: '8 天短效 20 片', price: 20, amount: 20, shelf: 8 }]);
  A.renderOffers();
  h = A.getEl('offers-out').innerHTML;
  ok(h.indexOf('浪费 12 份') >= 0, '多批旧货 + shelf=8：候选只能用掉 8 份、浪费 12 份（旧算法会判 usable=0），实际：' + (h.match(/浪费[^<]*/g) || []).join('|'));
  ok(A.getEl('cmp-sync').innerHTML.indexOf('先到期先用') >= 0, '比价说明应写明「先到期先用」口径');


}


console.log('\n======== 6. 三场景烟雾测试 ========');
{
  ['count', 'volume', 'pack'].forEach(m => {
    A.setMode(m);
    Object.assign(A.state[m], A.clone(A.DEFAULT_STATE[m]));
    A.renderInputs(); A.calcCore();
    const all = inputsHtml() + A.getEl('vol-rows').innerHTML + out();
    ok(!/undefined|NaN|Infinity/.test(all), m + ' 默认渲染不该出现 undefined/NaN/Infinity');
    ok(A.LAST.rec && typeof A.LAST.rec.kind === 'string', m + ' 应产出结论');
    ok(inputsHtml().indexOf('data-num="k-planSets"') >= 0, m + ' 应渲染出「打算买几套」滑块');
    ok(A.state[m].useBatches === false, m + ' 默认应是单一库存模式');
  });
  A.setMode('count');
  A.resetAll();
  ok(A.state.count.useBatches === false && A.state.count.oldBatches.length === 0, 'resetAll 应清掉多批状态');
}

console.log('\n========================================');
console.log(pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
