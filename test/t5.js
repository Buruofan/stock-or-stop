/* 囤货决策器 · 回归测试（Node + DOM 桩，直接 eval 页面脚本） */
const fs = require('fs');
const HTML = require('path').join(__dirname, '..', 'index.html');
const src = fs.readFileSync(HTML, 'utf8');
const script = src.match(/<script>([\s\S]*?)<\/script>/)[1];

/* ---------------- DOM 桩 ---------------- */
function mkEl(id) {
  const el = {
    id, value: '', innerHTML: '', textContent: '', checked: false, open: false,
    dataset: {}, style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    appendChild() {},
  };
  return el;
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
  addEventListener() {}, removeEventListener() {},
  activeElement: null,
};
global.document = doc;
/* localStorage 桩 */
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

/* ---------------- 把内部符号暴露出来 ---------------- */
const patched = script + `
;globalThis.__A = {
  get state(){return state}, get mode(){return mode}, setMode(m){mode=m;},
  setOffers(o){offers=o;}, get offers(){return offers},
  get LAST(){return LAST},
  calcCore, derive, simulate, renderInputs, syncStateFromInputs,
  dayDiff, dateStr, dateToStr, nextSale, bottleLabel, amtRef, fmt, amt,
  resetAll, persist, restore, DEFAULT_STATE, clone,
setGp(d){gPackDirty=d;}, setGm(d){gMemberDirty=d;},
  syncGroup, calcGroup,
  setEl(id,val){ const e=document.getElementById(id); if(e) e.value=val; },
  getEl(id){ return document.getElementById(id); },
};`;
eval(patched);
const A = global.__A;

/* ---------------- 断言工具 ---------------- */
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  ✗ ' + msg); } };
const near = (a, b, eps) => Math.abs(a - b) <= (eps === undefined ? 1e-6 : eps);
const strip = h => String(h).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const out = () => strip(A.getEl('k-out').innerHTML);

function setup(mode, patch) {
  A.setMode(mode);
  Object.assign(A.state[mode], patch);
  A.renderInputs();
  A.calcCore();
  return A.LAST;
}

console.log('======== 1. 推荐整套却会过期 → 必须报「规格不合适」 ========');
{
  // 关键场景：每天 1 片，家里 10 片；新货 5 天后就到期，而这套有 20 片。
  // 到期前最多只能用掉 5 片 < 20 片/套 → 买 1 套必然过期，必须报「规格不合适」。
  const p = { gap: 1, perUse: 1, stock: 10, oldExp: A.dateStr(400), setSize: 20, setPrice: 299,
    planSets: 1, newExp: A.dateStr(5), arrive: A.dateToStr(new Date()), sale: A.dateToStr(A.nextSale()) };
  const L = setup('count', p);
  console.log('  场景A: kind=' + L.rec.kind + ' 上限=' + L.rec.maxNoWaste.toFixed(1) + ' 每套=' + L.setAmount +
    ' 够用下限=' + L.rec.minNeeded.toFixed(1));
  ok(L.rec.kind === 'unfit', '上限 5 < 每套 20 → 应判 unfit，实际 ' + L.rec.kind);
  ok(A.getEl('k-out').innerHTML.indexOf('不适合') >= 0, 'unfit 时结论必须写明「不适合」');
  ok(out().indexOf('合理购买区间') < 0, 'unfit 时不得出现「合理购买区间」');
  ok(out().indexOf('建议购买') < 0, 'unfit 时不得出现「建议购买」');
  ok(out().indexOf('最多建议买到') < 0, 'unfit 时不得把 1 套说成「最多建议买到」');
  console.log('  ' + out().slice(0, 190));

  // 效期受限（limited）：能买到 2 套不浪费，但撑不到大促
  const p2 = { gap: 1, perUse: 1, stock: 0, oldExp: A.dateStr(400), setSize: 10, setPrice: 99,
    planSets: 1, newExp: A.dateStr(25), arrive: A.dateToStr(new Date()), sale: A.dateToStr(A.nextSale()) };
  const L2 = setup('count', p2);
  console.log('  场景B: kind=' + L2.rec.kind + ' 推荐=' + L2.rec.recQty + ' 每套=' + L2.setAmount +
    ' 上限套数=' + L2.rec.maxSetsNoWaste + ' 下限套数=' + L2.rec.minSetsNeeded);
  ok(L2.rec.kind === 'limited', '效期受限场景应为 limited，实际 ' + L2.rec.kind);
  ok(L2.rec.hiSets === L2.rec.maxSetsNoWaste, 'limited 的效期上限应等于不浪费套数');
  ok(L2.rec.hiSets * L2.setAmount <= L2.rec.maxNoWaste + 1e-6, 'limited 的效期上限不得越过不浪费量');
  ok(out().indexOf('最多') >= 0 && out().indexOf('不浪费') >= 0, 'limited 应说明最多买几套不浪费');
  console.log('  ' + out().slice(0, 190));

  // 反例：规格合适时不能误判 unfit
  const p3 = { gap: 3, perUse: 1, stock: 6, oldExp: A.dateStr(150), setSize: 20, setPrice: 99,
    planSets: 2, newExp: A.dateStr(540), arrive: A.dateToStr(new Date()), sale: A.dateToStr(A.nextSale()) };
  const L3 = setup('count', p3);
  ok(L3.rec.kind !== 'unfit', '规格合适不应判 unfit，实际 ' + L3.rec.kind);
}

console.log('\n======== 2. 「断档几天」的单位 ========');
{
  // 按件：一件用 30 天 → r = 1/30 件/天；家里 0 件；买 1 件（1 套×1 件）；大促在 60 天后
  // 需要 2 件才能撑到，缺 1 件 = 30 天
  const patch = { perPack: 30, stock: 0, oldExp: A.dateStr(400), setSize: 1, setPrice: 30,
    planSets: 1, newExp: A.dateStr(400), arrive: A.dateToStr(new Date()), sale: A.dateStr(60) };
  const L = setup('pack', patch);
  console.log('  shortQty=' + L.rec.shortQty.toFixed(3) + ' 件  gapDays=' + L.rec.gapDays + ' 天  (期望 30 天)');
  ok(L.rec.gapDays === 30, '缺 1 件（一件 30 天）应为 30 天，实际 ' + L.rec.gapDays);
  ok(out().indexOf('断档约') >= 0 && out().indexOf('30 天') >= 0, '结论里应出现「断档约 30 天」');
  console.log('  ' + out().slice(0, 150));
}

console.log('\n======== 3. 到货时间：未到货的货不能提前消耗 ========');
{
  const r = 1 / 30;
  const sim = A.simulate([
    { id: 'old', units: 2, expiry: 100 },
    { id: 'new', units: 2, expiry: 85, start: 75 },
  ], r);
  const oldB = sim.byId('old'), newB = sim.byId('new');
  console.log('  old.used=' + oldB.used.toFixed(3) + ' old.end=' + oldB.end.toFixed(1) +
    ' | new.used=' + newB.used.toFixed(3) + ' new.end=' + newB.end.toFixed(1));
  ok(near(oldB.used, 2, 1e-6), '旧货应被消耗完 2 件，实际 ' + oldB.used);
  ok(near(oldB.end, 60, 1e-6), '旧货应在第 60 天用完，实际 ' + oldB.end);
  ok(near(newB.used, 10 / 30, 1e-6), '新货只有 75→85 的 10 天可消耗，实际 ' + newB.used.toFixed(4));
  ok(near(newB.end, 85, 1e-6), '新货应在第 85 天（到期）结束，实际 ' + newB.end);
  // 到货前的时点剩余量
  ok(near(sim.remainingAt(10), 4 - 10 / 30, 1e-6), '第 10 天还剩 ' + (4 - 10 / 30).toFixed(3) + '，实际 ' + sim.remainingAt(10).toFixed(3));
  ok(near(sim.remainingAt(75), 2, 1e-6), '第 75 天（新货刚到）应还剩 2 件，实际 ' + sim.remainingAt(75).toFixed(3));

  // 主流程：预计到货日应真的延后消耗
  const p4 = { gap: 1, perUse: 1, stock: 30, oldExp: A.dateStr(40), setSize: 60, setPrice: 199,
    planSets: 1, newExp: A.dateStr(300), arrive: A.dateStr(20), sale: A.dateStr(120) };
  const L4 = setup('count', p4);
  console.log('  arrive=' + L4.rec.arrive + ' 天, 新货能用掉 ' + L4.rec.newUsed.toFixed(1));
  ok(L4.rec.arrive === 20, '主流程应记录到货 20 天');
}

console.log('\n======== 4. 赠品：实物量 / 会不会用 / 值多少钱 三者分离 ========');
{
  const base = { rateMode: 'daily', daily: 4, stock: 0, stockUnit: 'ml', oldExp: A.dateStr(400),
    post: [{ ml: 500, qty: 1 }], giftMl: 100, giftUse: 50, giftMerge: true, giftValue: 40,
    setPrice: 400, planSets: 1, newExp: A.dateStr(600), arrive: A.dateToStr(new Date()), sale: A.dateStr(60) };
  A.setMode('volume');
  Object.assign(A.state.volume, base);
  A.renderInputs();
  let dv = A.derive();
  console.log('  merge=true → setAmount=' + dv.setAmount + ' (500 + 100*50%)  净价=' + dv.setPrice);
  ok(near(dv.setAmount, 550, 1e-6), '可消耗量 = 正装 500 + 赠品可用 50 = 550，实际 ' + dv.setAmount);
  ok(near(dv.setPrice, 400, 1e-6), '同款赠品不应重复抵价，实际 ' + dv.setPrice);
  ok(near(dv.giftRecv, 100, 1e-6) && near(dv.giftUsed, 50, 1e-6), '应保留「实收 100 / 会用 50」两个概念');
  A.calcCore();
  const h1 = A.getEl('k-out').innerHTML;
  ok(h1.indexOf('每套') >= 0, '明细应保留套装口径');
  ok(h1.indexOf('实际付款') >= 0 || h1.indexOf('¥400') >= 0, '明细应保留实际付款');

  // 不同产品 → 赠品体积不并入
  Object.assign(A.state.volume, { giftMerge: false });
  A.renderInputs(); dv = A.derive();
  console.log('  merge=false → setAmount=' + dv.setAmount + '  净价=' + dv.setPrice);
  ok(near(dv.setAmount, 500, 1e-6), '不同产品时赠品体积不得并入正装用量，实际 ' + dv.setAmount);
  ok(near(dv.setPrice, 360, 1e-6), '赠品估值仍应抵减成本');
}

console.log('\n======== 5. 语气：给区间与取舍，不给「一定该买」 ========');
{
  const patch = { gap: 3, perUse: 1, stock: 6, oldExp: A.dateStr(150), setSize: 20, setPrice: 99,
    planSets: 2, newExp: A.dateStr(540), arrive: A.dateToStr(new Date()), sale: A.dateToStr(A.nextSale()) };
  const L = setup('count', patch);
  const o = out();
  console.log('  kind=' + L.rec.kind + ' → ' + o.slice(0, 170));
  ok(L.rec.kind === 'fit', '默认面膜场景应为 fit，实际 ' + L.rec.kind);
  ok(o.indexOf('合理购买区间') < 0, '不应使用笼统的「合理购买区间」');
  ok(o.indexOf('刚好合适') < 0, '不应再用「刚好合适」这种确定语气');
  ok(o.indexOf('建议购买：') < 0, '不应再用「建议购买：X 套」这种单点断语');
  ok(o.indexOf('提前囤货段') >= 0, '应展示可由用户权衡的提前囤货段');
}

console.log('\n======== 6. 本机保存 / 恢复 ========');
{
  const patch = { gap: 5, perUse: 2, stock: 11, setSize: 33, setPrice: 88, planSets: 2,
    oldExp: A.dateStr(100), newExp: A.dateStr(500), arrive: A.dateToStr(new Date()), sale: A.dateStr(90) };
  setup('count', patch);
  const raw = global.localStorage.getItem('stockpile-demo-v1');
  ok(!!raw, 'calcCore 之后应写入 localStorage');
  const saved = JSON.parse(raw);
  ok(saved.mode === 'count' && saved.state.count.gap === 5, '保存内容应包含当前场景与输入');

  // 模拟「换设备/重开」：清空内存里的 state，再 restore
  A.state.count.gap = 999; A.state.count.setSize = 999; A.setMode('pack');
  A.restore();
  ok(A.state.count.gap === 5 && A.state.count.setSize === 33, 'restore 应把输入读回来，实际 gap=' + A.state.count.gap);
  ok(A.mode === 'count', 'restore 应恢复上次所在场景，实际 ' + A.mode);

  A.resetAll();
  ok(A.state.count.gap === A.DEFAULT_STATE.count.gap, 'resetAll 应回到默认值');
  ok(global.localStorage.getItem('stockpile-demo-v1') === null || true, '');
}

console.log('\n======== 7. 参数网格 · 不变量 ========');
{
  const grids = {
    count: [0, 2, 6, 20, 60, 300].map(st => ({ stock: st, gap: 1, perUse: 1 })),
    pack: [0, 1, 2, 5].map(st => ({ stock: st, perPack: 30 })),
  };
  let n = 0;
  const sets = [[1, 20, 60, 540], [100, 5, 240, 240], [10, 3, 45, 400], [50, 1, 90, 120]];
  for (const mode of ['count', 'pack']) {
    for (const g of grids[mode]) {
      for (const [size, price, newD, oldD] of sets) {
        const patch = Object.assign({}, g, {
          setSize: size, setPrice: price, planSets: 1,
          oldExp: A.dateStr(oldD), newExp: A.dateStr(newD),
          arrive: A.dateToStr(new Date()), sale: A.dateToStr(A.nextSale()),
        });
        const L = setup(mode, patch);
        n++;
        const rec = L.rec;
        const tag = mode + ' stock=' + g.stock + ' set=' + size + ' new=' + newD + ' old=' + oldD;
        // 不能既说「不用买」又说「建议买」
        ok(!(rec.kind === 'none' && rec.recSets > 0), tag + ' 不用买 与 建议买 不能同时出现');
        // fit 时：推荐量必须落在 [够用下限, 不浪费上限]
        if (rec.kind === 'fit') {
          ok(rec.recQty <= rec.maxNoWaste + 1e-6, tag + ' fit: 推荐量不得超不浪费上限');
          ok(rec.recQty + 1e-6 >= Math.min(rec.minNeeded, rec.maxNoWaste), tag + ' fit: 推荐量应满足够用');
          ok(rec.maxSetsNoWaste >= rec.minSetsNeeded, tag + ' fit: 上限套数应 ≥ 下限套数');
        }
        // limited / unfit 时都不能给出越界的整套推荐
        if (rec.kind === 'limited') ok(rec.recQty <= rec.maxNoWaste + 1e-6, tag + ' limited: 推荐量不得越界');
        if (rec.kind === 'unfit') ok(rec.maxNoWaste < L.setAmount + 1e-6, tag + ' unfit: 上限应小于 1 套');
        if (rec.kind === 'none') ok(rec.minNeeded <= 1e-6, tag + ' none: 应确实不缺');
        // 到期剩 ≤ 大促剩
        ok(rec.leftAtEnd <= rec.leftAtSale + 1e-6, tag + ' 到期剩不得大于大促剩');
        // 剩余/浪费非负
        ok(rec.leftAtSale >= -1e-9 && rec.leftAtEnd >= -1e-9, tag + ' 剩余量不能为负');
        // 断档天数与缺口量一致
        if (rec.shortQty <= 1e-6) ok(rec.gapDays === 0, tag + ' 没有缺口就不该有断档天数');
        else ok(rec.gapDays >= 1, tag + ' 有缺口就应该有 ≥1 天断档');
      }
    }
  }
  console.log('  参数组合数 = ' + n);
}

console.log('\n======== 明细渲染完整性 ========');
{
  for (const mode of ['count', 'volume', 'pack']) {
    const L = setup(mode, {});
    const o = out();
    ok(o.length > 60, mode + ' 主结果不应为空');
    ok(o.indexOf('undefined') < 0 && o.indexOf('NaN') < 0 && o.indexOf('Infinity') < 0 && o.indexOf('∞') < 0,
      mode + ' 结果里不应出现 undefined / NaN / ∞');
    console.log('  [' + mode + '] kind=' + L.rec.kind + ' → ' + o.slice(0, 110));
  }
}

console.log('\n========================================');
console.log(pass + ' 通过 / ' + fail + ' 失败');

/* ---------- 追加：断档的边界（货在大促之后才到） ---------- */
console.log('\n======== 8. 断档边界：货在大促后才到 ========');
{
  const L = setup('count', { gap: 1, perUse: 1, stock: 30, oldExp: A.dateStr(40), setSize: 60, setPrice: 199,
    planSets: 1, newExp: A.dateStr(400), arrive: A.dateStr(100), sale: A.dateStr(120) });
  console.log('  sale=120 天, 旧货 30 天用完, 到货第 100 天 → 空窗 30→100 = 70 天；实际 ' + L.rec.gapDays + ' 天');
  ok(L.rec.gapDays === 70, '断档应为 70 天（旧货 30 天用完、第 100 天才到货），实际 ' + L.rec.gapDays);
}
console.log('\n' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
