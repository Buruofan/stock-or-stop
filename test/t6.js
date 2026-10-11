/* 囤货决策器 · 回归测试 v2（Node + DOM 桩，直接 eval 页面脚本） */
const fs = require('fs');
const HTML = require('path').join(__dirname, '..', 'index.html');
const src = fs.readFileSync(HTML, 'utf8');
const script = src.match(/<script>([\s\S]*?)<\/script>/)[1];

/* ---------------- DOM 桩 ---------------- */
function mkEl(id) {
  return {
    id, value: '', innerHTML: '', textContent: '', checked: false, open: false,
    dataset: {}, style: {},
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
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.innerWidth = 390; global.innerHeight = 800;
global.IntersectionObserver = class { constructor(){} observe(){} unobserve(){} disconnect(){} };
global.scrollIntoView = () => {};

const patched = script + `
;globalThis.__A = {
  get state(){return state}, get mode(){return mode}, setMode(m){mode=m;},
  setOffers(o){offers=o;}, get offers(){return offers},
  get LAST(){return LAST},
  calcCore, derive, simulate, renderInputs, syncStateFromInputs,
  dayDiff, dayDiffRaw, dateStr, dateToStr, nextSale, bottleLabel, amtRef, fmt, amt,
  resetAll, persist, restore, auditStale, renderStaleBar, DEFAULT_STATE, clone, ASSUMED_SHELF,
  setVsDirty(d){vsDirty=d;}, setGp(d){gPackDirty=d;}, setGm(d){gMemberDirty=d;},
  syncGroup, calcGroup, calcVs,
  setEl(id,val){ const e=document.getElementById(id); if(e) e.value=val; },
  getEl(id){ return document.getElementById(id); },
  getStale(){ return document.getElementById('staleBar').innerHTML; },
};`;
eval(patched);
const A = global.__A;

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  ✗ ' + msg); } };
const near = (a, b, eps) => Math.abs(a - b) <= (eps === undefined ? 1e-6 : eps);
const strip = h => String(h).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const out = () => strip(A.getEl('k-out').innerHTML);
const raw = () => A.getEl('k-out').innerHTML;

function setup(mode, patch) {
  A.setMode(mode);
  Object.assign(A.state[mode], patch);
  A.renderInputs();
  A.calcCore();
  return A.LAST;
}
const TODAY = () => A.dateToStr(new Date());

/* ============================================================
   1. 三层结构：撑到大促 / 提前囤货 / 效期上限，中间段不再一律绿
============================================================ */
console.log('======== 1. 三层结构：不再把「不过期」当成「都合理」 ========');
{
  // 面膜：3 天 1 片 → 每套 20 片；库存 6；大促 31 天后；新货 540 天效期
  const L = setup('count', { gap: 3, perUse: 1, stock: 6, oldExp: A.dateStr(150), setSize: 20, setPrice: 99,
    planSets: 2, oldBatches: [], vsNormal: 'unknown', expKnown: true,
    newExp: A.dateStr(540), arrive: TODAY(), sale: A.dateToStr(A.nextSale()) });
  const o = out();
  console.log('  kind=' + L.rec.kind + ' band=' + L.rec.planBand + ' 撑到大促=' + L.rec.minSetsNeeded + ' 套  上限=' + L.rec.hiSets + ' 套');
  console.log('  ' + o.slice(0, 240));
  ok(L.rec.kind === 'fit', '默认面膜应为 fit，实际 ' + L.rec.kind);
  ok(L.rec.planBand === 'ahead', '买 2 套（下限 1 套、上限 8 套）应落在提前囤货段，实际 ' + L.rec.planBand);
  ok(o.indexOf('合理购买区间') < 0, '不应再出现「合理购买区间」这种一刀切说法');
  ok(o.indexOf('撑到下次大促的最少') >= 0, '应输出第 ① 层（撑到大促的最少）');
  ok(o.indexOf('提前囤货段') >= 0, '应输出第 ② 层（提前囤货段）');
  ok(o.indexOf('效期上限') >= 0, '应输出第 ③ 层（效期上限）');
  ok(raw().indexOf('rhero info') >= 0, '价格未确认时，提前囤货段应为中性提示（info），不能给绿色结论');
  ok(o.indexOf('多占用') >= 0 && o.indexOf('机会成本') >= 0, '应量化提前囤货占用的资金');
  ok(o.indexOf('低过约') >= 0, '应给出「需要多大折扣才划算」的门槛');

  // 上限再大，也要说清是「提前囤多久」
  console.log('  商品 2 年后才过期、一月用一瓶：上限有多大？');
  const L2 = setup('volume', { rateMode: 'daily', daily: 1 / 30 * 100, stock: 0, stockUnit: 'ml', oldExp: A.dateStr(400),
    post: [{ ml: 100, qty: 1 }], giftMl: 0, giftUse: 100, giftMerge: true, giftValue: 0,
    setPrice: 200, planSets: 12, oldBatches: [], vsNormal: 'same', expKnown: true,
    newExp: A.dateStr(730), arrive: TODAY(), sale: A.dateToStr(A.nextSale()) });
  const o2 = out();
  console.log('  kind=' + L2.rec.kind + ' band=' + L2.rec.planBand + ' 撑到大促=' + L2.rec.minSetsNeeded + ' 套  上限=' + L2.rec.hiSets + ' 套');
  console.log('  ' + o2.slice(0, 240));
  ok(L2.rec.hiSets > 20, '效期 2 年时「效期上限」会很大（' + L2.rec.hiSets + ' 套）——所以它不能单独充当建议');
  ok(L2.rec.planBand === 'ahead', '买 12 套仍应归入「提前囤货段」而非「合理」');
  ok(raw().indexOf('rhero info') < 0 && raw().indexOf('rhero good') < 0,
    '价格不比平时低时，提前囤货段不得给绿/中性好评');
  ok(o2.indexOf('价格并不更低') >= 0, '应明确指出「没有价格优势时不该多囤」');
  ok(o2.indexOf('提前囤') >= 0 && o2.indexOf('年化 3%') >= 0, '应说明提前了多久、资金成本多少');
}

/* ============================================================
   2. 价格优势开关：决定中间段是好评还是劝阻
============================================================ */
console.log('\n======== 2. 价格优势决定提前囤货段的结论 ========');
{
  const base = { gap: 3, perUse: 1, stock: 6, oldExp: A.dateStr(150), setSize: 20, setPrice: 99,
    planSets: 4, oldBatches: [], expKnown: true, newExp: A.dateStr(540), arrive: TODAY(), sale: A.dateToStr(A.nextSale()) };
  const Llow = setup('count', Object.assign({}, base, { vsNormal: 'lower' }));
  const oLow = out();
  console.log('  [更低] ' + oLow.slice(0, 150));
  ok(Llow.rec.planBand === 'ahead' && raw().indexOf('rhero good') >= 0, '有价格优势 → 提前囤货段可以给好评');
  ok(oLow.indexOf('有价格优势支持') >= 0, '应写明「有价格优势支持」');

  const Lsame = setup('count', Object.assign({}, base, { vsNormal: 'same' }));
  const oSame = out();
  console.log('  [差不多] ' + oSame.slice(0, 150));
  ok(raw().indexOf('rhero warn') >= 0, '价格差不多 → 应转为劝阻（warn）');
  ok(oSame.indexOf('涨') < 0, '');
  ok(oSame.indexOf('并不更低') >= 0, '应说明这次并不比平时便宜');

  // 恰好买在下限 → 保守绿
  const Ljust = setup('count', Object.assign({}, base, { planSets: 1, vsNormal: 'unknown' }));
  const oJust = out();
  console.log('  [刚好下限] ' + oJust.slice(0, 150));
  ok(Ljust.rec.planBand === 'just', '买 1 套应落在「刚好下限」，实际 ' + Ljust.rec.planBand);
  ok(raw().indexOf('rhero good') >= 0, '刚好卡在下限可以给绿色');
}

/* ============================================================
   3. 赠送：同款「计入用量」与非同款「按估值抵扣」互斥
============================================================ */
console.log('\n======== 3. 赠品：两种口径互斥，且始终单独显示实际付款 ========');
{
  const base = { rateMode: 'daily', daily: 4, stock: 0, stockUnit: 'ml', oldExp: A.dateStr(400),
    post: [{ ml: 500, qty: 1 }], giftMl: 100, giftUse: 50, giftValue: 40,
    setPrice: 400, planSets: 1, oldBatches: [], vsNormal: 'unknown', expKnown: true,
    newExp: A.dateStr(600), arrive: TODAY(), sale: A.dateStr(60) };

  A.setMode('volume');
  Object.assign(A.state.volume, base, { giftMerge: true });
  A.renderInputs(); let dv = A.derive();
  console.log('  同款: setAmount=' + dv.setAmount + ' setPrice=' + dv.setPrice + ' listPrice=' + dv.listPrice);
  ok(near(dv.setAmount, 550, 1e-6), '同款赠品应并入可消耗量（550），实际 ' + dv.setAmount);
  ok(near(dv.setPrice, 400, 1e-6), '同款赠品不得再抵扣价格（否则分子分母重复算），实际 ' + dv.setPrice);
  ok(near(dv.listPrice, 400, 1e-6), '实际付款应始终为 400');
  A.calcCore();
  ok(out().indexOf('实际付款') >= 0 && out().indexOf('¥400') >= 0, '明细必须单独显示实际付款 ¥400');

  Object.assign(A.state.volume, { giftMerge: false });
  A.renderInputs(); dv = A.derive();
  console.log('  非同款: setAmount=' + dv.setAmount + ' setPrice=' + dv.setPrice + ' listPrice=' + dv.listPrice);
  ok(near(dv.setAmount, 500, 1e-6), '非同款赠品不得并入用量，实际 ' + dv.setAmount);
  ok(near(dv.setPrice, 360, 1e-6), '非同款赠品按主观估值抵扣成本（360），实际 ' + dv.setPrice);
  ok(near(dv.listPrice, 400, 1e-6), '实际付款仍是 400（不因估值而变）');
  A.calcCore();
  ok(out().indexOf('实际付款') >= 0 && out().indexOf('¥400') >= 0, '非同款时也要单独显示实际付款');
  ok(out().indexOf('不同的产品') < 0 || out().indexOf('别的产品') >= 0, '应说明赠品是别的产品、不并入用量');
}

/* ============================================================
   4. 到货晚于大促：推荐套数必须受约束，且直说「解决不了缺口」
============================================================ */
console.log('\n======== 4. 到货晚于大促 → 本单解决不了大促前的缺口 ========');
{
  const L = setup('count', { gap: 1, perUse: 1, stock: 0, oldExp: A.dateStr(400), setSize: 30, setPrice: 199,
    planSets: 3, oldBatches: [], vsNormal: 'unknown', expKnown: true,
    newExp: A.dateStr(500), arrive: A.dateStr(200), sale: A.dateStr(120) });
  const o = out();
  console.log('  kind=' + L.rec.kind + ' → ' + o.slice(0, 220));
  ok(L.rec.kind === 'late', '到货（200 天）晚于大促（120 天）应判 late，实际 ' + L.rec.kind);
  ok(o.indexOf('赶不上大促') >= 0, '应直说这一单赶不上大促');
  ok(o.indexOf('解决不了大促前的缺口') >= 0, '应直说本单解决不了大促前的缺口');
  ok(o.indexOf('撑到大促 3 套') < 0 && o.indexOf('提前囤货 4 ~') < 0, 'late 时不得再给出「买这些就够撑到大促」的区间');
  ok(o.indexOf('断档') >= 0, '应给出断档天数');

  // 反例：到货早于大促 → 不应判 late
  const L2 = setup('count', { gap: 1, perUse: 1, stock: 0, oldExp: A.dateStr(400), setSize: 30, setPrice: 199,
    planSets: 3, oldBatches: [], vsNormal: 'unknown', expKnown: true,
    newExp: A.dateStr(500), arrive: A.dateStr(10), sale: A.dateStr(120) });
  ok(L2.rec.kind !== 'late', '到货早于大促不应判 late，实际 ' + L2.rec.kind);
}

/* ============================================================
   5. 效期未知 → 一律标注为「按假设效期估算」
============================================================ */
console.log('\n======== 5. 效期未知：只给估算，不给「保证不过期」 ========');
{
  const L = setup('count', { gap: 3, perUse: 1, stock: 6, oldExp: A.dateStr(150), setSize: 20, setPrice: 99,
    planSets: 2, oldBatches: [], vsNormal: 'unknown', expKnown: false, newExp: '', arrive: TODAY(), sale: A.dateToStr(A.nextSale()) });
  const o = out();
  console.log('  ' + o.slice(0, 220));
  ok(L.rec.kind === 'fit' || L.rec.kind === 'limited' || L.rec.kind === 'unfit', '未知效期也应给出结论，实际 ' + L.rec.kind);
  ok(o.indexOf('按假设效期') >= 0, '未知效期时必须标注为「按假设效期估算」');
  ok(o.indexOf('没有过期浪费') < 0, '未知效期时不得断言「没有过期浪费」');
  ok(o.indexOf('以收到货的包装为准') >= 0, '应提示以实际收到批次为准');

  // 已知效期时恢复正常断言
  const L2 = setup('count', { gap: 3, perUse: 1, stock: 6, oldExp: A.dateStr(150), setSize: 20, setPrice: 99,
    planSets: 1, oldBatches: [], vsNormal: 'unknown', expKnown: true, newExp: A.dateStr(540), arrive: TODAY(), sale: A.dateToStr(A.nextSale()) });
  ok(out().indexOf('按假设效期') < 0, '已知效期时不应出现「按假设效期」');
}

/* ============================================================
   6. 多批旧货：分别计算到期，而不是当成同一天
============================================================ */
console.log('\n======== 6. 多批旧货 ========');
{
  // 单一批（最早 400 天后到期）：库存 10 片，1 天 1 片 → 够用 400 天，不易浪费
  const single = setup('count', { gap: 1, perUse: 1, stock: 10, oldExp: A.dateStr(400), oldBatches: [],
    setSize: 20, setPrice: 99, planSets: 1, vsNormal: 'unknown', expKnown: true,
    newExp: A.dateStr(700), arrive: TODAY(), sale: A.dateStr(120) });
  console.log('  单一批: 库存=' + single.stockAmount + ' 旧货浪费=' + single.rec.oldStandaloneWaste.toFixed(2));
  ok(near(single.rec.oldStandaloneWaste, 0, 1e-6), '单一批 400 天效期不该有浪费，实际 ' + single.rec.oldStandaloneWaste);

  // 两批：5 片 3 天到期 + 15 片 400 天到期 → 前一批只能吃掉 3 片，浪费 2 片
  // 注意：写完批次后还需要 useBatches=true（用户在界面上点「就按这 N 批算」）才接管库存
  const two = setup('count', { gap: 1, perUse: 1, stock: 0, oldExp: '', useBatches: true, oldBatches: [
    { amount: 5, expiry: A.dateStr(3) }, { amount: 15, expiry: A.dateStr(400) }
  ], setSize: 20, setPrice: 99, planSets: 1, vsNormal: 'unknown', expKnown: true,
    newExp: A.dateStr(700), arrive: TODAY(), sale: A.dateStr(120) });
  console.log('  两批: 库存=' + two.stockAmount + ' 旧货浪费=' + two.rec.oldStandaloneWaste.toFixed(2) + '（期望 2：3 天只能吃掉 3 片）');
  ok(near(two.stockAmount, 20, 1e-6), '多批库存应相加 = 20，实际 ' + two.stockAmount);
  ok(near(two.rec.oldStandaloneWaste, 2, 1e-6), '3 天后到期的 5 片只能吃掉 3 片，剩 2 片浪费，实际 ' +
    two.rec.oldStandaloneWaste.toFixed(2));
  ok(out().indexOf('分 2 批') >= 0, '明细应说明旧货分了几批');
}

/* ============================================================
   7. 数据变旧：时间戳 + 过去的大促日期自动改期
============================================================ */
console.log('\n======== 7. 数据变旧的处理 ========');
{
  setup('count', { gap: 3, perUse: 1, stock: 6, oldExp: A.dateStr(150), setSize: 20, setPrice: 99, planSets: 1,
    oldBatches: [], vsNormal: 'unknown', expKnown: true, newExp: A.dateStr(540), arrive: TODAY(), sale: A.dateToStr(A.nextSale()) });
  const saved = JSON.parse(global.localStorage.getItem('stockpile-demo-v1'));
  ok(!!saved.savedAt, '持久化应记录 savedAt 时间戳');

  // 造一个「40 天前保存、大促日期已过」的快照
  A.state.count.sale = A.dateStr(-10);
  const audit = A.auditStale(Date.now() - 40 * 864e5);
  ok(audit.bumpedSale, '大促日期已过 → 应自动改期');
  ok(A.dayDiffRaw(A.state.count.sale) > 0, '改期后应指向未来');
  ok(A.dateToStr(A.nextSale()) === A.state.count.sale, '应改成下一个 618 / 双 11');

  A.renderStaleBar({ savedAt: Date.now() - 40 * 864e5, bumpedSale: audit.bumpedSale, pastDates: [] });
  const bar = strip(A.getStale());
  console.log('  ' + bar.slice(0, 200));
  ok(bar.indexOf('上次更新') >= 0, '应显示「上次更新」时间');
  ok(bar.indexOf('40 天前') >= 0, '应显示距今多久（40 天前）');
  ok(bar.indexOf('确认现有库存') >= 0, '应要求确认现有库存');
  ok(bar.indexOf('自动改为下一个 618') >= 0, '应提示大促日期已自动改期');

  // 过去的到期日 → 列出让人重选
  A.state.count.oldExp = A.dateStr(-5);
  const a2 = A.auditStale(Date.now());
  A.renderStaleBar({ savedAt: Date.now(), bumpedSale: false, pastDates: a2.pastDates });
  ok(strip(A.getStale()).indexOf('已经是过去时') >= 0, '过去的到期日应被点出来要求重选');
  A.state.count.oldExp = A.dateStr(150);

  // 刚保存（几小时前）→ 只显示时间，不要求确认
  A.renderStaleBar({ savedAt: Date.now() - 2 * 36e5, bumpedSale: false, pastDates: [] });
  const bar2 = strip(A.getStale());
  ok(bar2.indexOf('小时前') >= 0 && bar2.indexOf('确认现有库存') < 0, '几小时前更新不该要求确认库存');
  A.renderStaleBar({ savedAt: Date.now() - 5 * 6e4, bumpedSale: false, pastDates: [] });
  ok(strip(A.getStale()).indexOf('分钟前') >= 0, '刚刚更新应显示「分钟前」');
  A.getEl('staleBar').innerHTML = '';
}

/* ============================================================
   8. 参数网格 · 不变量
============================================================ */
console.log('\n======== 8. 参数网格 · 不变量 ========');
{
  const grids = {
    count: [0, 2, 6, 20, 60, 300].map(st => ({ stock: st, gap: 1, perUse: 1 })),
    pack: [0, 1, 2, 5].map(st => ({ stock: st, perPack: 30 })),
  };
  let n = 0;
  const sets = [[1, 20, 60, 540], [100, 5, 240, 240], [10, 3, 45, 400], [50, 1, 90, 120]];
  const arrives = [0, 10, 200];
  for (const mode of ['count', 'pack']) {
    for (const g of grids[mode]) {
      for (const [size, price, newD, oldD] of sets) {
        for (const arr of arrives) {
          const patch = Object.assign({}, g, {
            setSize: size, setPrice: price, planSets: 2,
            oldBatches: [], vsNormal: 'unknown', expKnown: true,
            oldExp: A.dateStr(oldD), newExp: A.dateStr(newD),
            arrive: arr === 0 ? TODAY() : A.dateStr(arr), sale: A.dateToStr(A.nextSale()),
          });
          const L = setup(mode, patch); n++;
          const rec = L.rec;
          const tag = mode + ' stock=' + g.stock + ' set=' + size + ' new=' + newD + ' old=' + oldD + ' arr=' + arr;

          // 三层必须自洽
          if (rec.kind === 'fit') {
            ok(rec.minSetsNeeded <= rec.maxSetsNoWaste, tag + ' fit: 下限套数应 ≤ 上限套数');
            ok(rec.hiSets === rec.maxSetsNoWaste, tag + ' fit: 第 ③ 层应等于效期上限');
            ok(rec.recSets * L.setAmount <= rec.maxNoWaste + 1e-6, tag + ' fit: 撑到大促的套数不得越过效期上限');
          }
          if (rec.kind === 'limited') {
            ok(rec.minSetsNeeded > rec.maxSetsNoWaste, tag + ' limited: 撑到大促的套数应超过效期上限');
            ok(rec.maxSetsNoWaste > 0, tag + ' limited: 上限套数应 > 0');
          }
          if (rec.kind === 'unfit') ok(rec.maxSetsNoWaste === 0, tag + ' unfit: 上限套数应为 0');
          if (rec.kind === 'late') ok(rec.maxNewBySale <= 1e-6, tag + ' late: 大促前应确实补不上（maxNewBySale=' + rec.maxNewBySale + '）');
          // 不能既说「不用买」又给出套数
          ok(!(rec.kind === 'none' && rec.recSets > 0), tag + ' 不用买 与 给套数 不能同时出现');
          if (rec.kind === 'none') ok(rec.minNeeded <= 1e-6, tag + ' none: 应确实不缺');
          if (rec.kind === 'unfit') ok(rec.maxNoWaste < L.setAmount + 1e-6, tag + ' unfit: 上限应小于 1 套');
          // 剩余/浪费非负
          ok(rec.leftAtSale >= -1e-9 && rec.leftAtEnd >= -1e-9, tag + ' 剩余量不能为负');
          ok(rec.leftAtEnd <= rec.leftAtSale + 1e-6, tag + ' 到期剩不得大于大促剩');
          // 断档与缺口一致
          if (rec.shortQty <= 1e-6) ok(rec.gapDays === 0, tag + ' 没有缺口就不该有断档天数');
          else ok(rec.gapDays >= 1, tag + ' 有缺口就应该有 ≥1 天断档');
          // 非绿：落在提前囤货段且价格未知/不低时，结论不能是 good
          if (rec.kind === 'fit' && rec.planBand === 'ahead' && rec.vsNormal !== 'lower') {
            ok(raw().indexOf('rhero good') < 0, tag + ' 提前囤货 + 无价格优势 不得给绿色结论');
          }
        }
      }
    }
  }
  console.log('  参数组合数 = ' + n);
}

/* ============================================================
   9. 渲染完整性
============================================================ */
console.log('\n======== 9. 渲染完整性 ========');
{
  for (const mode of ['count', 'volume', 'pack']) {
    const L = setup(mode, {});
    const o = out();
    ok(o.length > 60, mode + ' 主结果不应为空');
    ok(o.indexOf('undefined') < 0 && o.indexOf('NaN') < 0 && o.indexOf('Infinity') < 0 && o.indexOf('∞') < 0,
      mode + ' 结果里不应出现 undefined / NaN / ∞');
    ok(o.indexOf('实际付款') >= 0, mode + ' 明细应显示实际付款');
    console.log('  [' + mode + '] kind=' + L.rec.kind + ' → ' + o.slice(0, 120));
  }
}

console.log('\n========================================');
console.log(pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
