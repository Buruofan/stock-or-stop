# 囤货算盘 Stock or Stop —— 产品需求文档（PRD）

> **版本**：v1.0（对应成品 `index.html`，2026-10-11 定稿）
> **文档目的**：本文档是该产品的**唯一权威规格**。任何人（或 AI agent）只读本文档 + 参考成品 `index.html`，就应当能独立复刻出一个行为一致的产品。因此本文档刻意写得「过度详细」——包含数据模型、算法公式、边界容差、文案模板、验收清单。
> **配套文件**：
> - `index.html` —— 成品（纯前端单文件，可直接双击打开）
> - `docs/需求演变史.md` —— 逐轮需求演变（用户反馈 → 需求 → 实现），理解「为什么这么设计」
> - `docs/worklog-*.md` —— 每轮工程日志
> - `test/t5.js` `test/t6.js` `test/t7.js` —— Node + DOM 桩回归测试
> - `test/probe8.html` `test/probe9.html` `test/probe10.html` —— 无头 Chrome 真机交互探针

---

## 0. 阅读指南

- 想**快速理解产品**：读 §1、§2、§3。
- 想**照着实现**：§4～§11 是完整规格，§12 是验收清单。
- 想**理解设计取舍**：读 §2.4 设计原则 + `docs/需求演变史.md`。
- 所有「必须」= 硬性要求；所有「建议」= 可自由发挥但需说明理由。

---

## 1. 产品概述

### 1.1 一句话定位

**下单前 30 秒，回答「这次买几套合适、会不会囤过头」的纯前端本地计算器。**

它不是比价工具，不是记账工具，也不是优惠券聚合器。它只回答一个问题：**面对一个大促套装，我该买 0 套、1 套、还是 3 套？多买的部分会不会砸在手里？**

### 1.2 产品中文名 / 英文名

| 项目 | 值 |
|---|---|
| 中文名 | **囤货算盘** |
| 英文名 | **Stock or Stop** |
| 页面 `<title>` | `囤货算盘 Stock or Stop · 这次买多少合适` |
| Logo | 32×32 圆角方形，橙色渐变（`#ff8a3d → #e8590c`）底 + 白色购物袋轮廓 + 袋中一个「√」勾选标记（表示「算清了再买」）。见 `index.html` 顶部 `<svg class="logo">`。 |

### 1.3 背景与问题

消费者在大促（618 / 双 11）面对「买 2 送 1」「囤 3 件 5 折」时，实际面对的是一道**多变量算术题**：

- 家里还有多少没用完？
- 我多久用一次 / 每天用多少？
- 这批货的效期够不够我用完？
- 预售便宜但要等，等货期间会断档吗？
- 多买的那部分到底算「提前囤」还是「要扔掉」？

消费者凭直觉往往只在**单价**这一个维度上决策，结果出现两类典型误判：

1. **买少了**：大促前断档，只能用日常价补货，亏了。
2. **买多了**：低价买回来的货在效期内用不完，过期扔掉——**便宜的单价被浪费反噬成更高的实际成本**。

市面上几乎没有工具把「消耗速度 × 效期 × 到货时间 × 价格优势」放进同一次计算里，因为**「用不完」这件事没有可视化的落地表达**。

### 1.4 目标用户与典型场景

| 用户画像 | 典型商品 | 场景 |
|---|---|---|
| 囤货型消费者 | 面膜、一次性用品（按次用） | 「618 面膜 20 片装比平时便宜 30%，我该买几盒？」 |
| 护肤/日化用户 | 护肤套装、洗发水、洗衣液（按体积/按件用） | 「这套 500ml 正装 +60ml 赠品，我一天用 4ml，买 2 套会不会用过期？」 |
| 预售决策者 | 任何有预售/海淘等待期的商品 | 「预售便宜 40 块但要等 20 天，我家里只够用 10 天，划算吗？」 |
| 拼单发起人 | 整箱/大包装囤货 | 「3 瓶 500ml 正装 +5 份小样，我和两个朋友一起买，各该摊多少钱？」 |

**共同特征**：都不缺「比价工具」，缺的是「**买多少**这个量的判断」。

### 1.5 产品边界

**做（In Scope）**：

- 三场景消耗建模（按次 / 按体积 / 按件）
- 多批旧货 + 先到期先用的连续消耗模拟
- 到货时间感知（未到货不能提前消耗）
- 三层购买推荐（撑到大促 / 提前囤货 / 效期上限）
- 套装比价、预售 vs 现货、囤货拼单分摊三个辅助工具
- 本机持久化 + 数据保鲜
- 响应式（手机可用）

**不做（Out of Scope，且是刻意不做）**：

- ❌ **不联网、不调用任何 API、不接大模型**——所有计算在本机完成，不采集任何数据。
- ❌ **不做商品库/扫码/导入订单**——用户自己填，保证零依赖。
- ❌ **不做「值得买 / 不值得买」的绝对断语**——只给区间与取舍条件（见 §2.4）。
- ❌ **不做电商购物车的满减凑单**——「拼单」专指「囤货大单买回来后按需分摊」（见 §7.4）。
- ❌ **不做临期商品单独面板**——临期本质就是「新货效期很短」，是主流程的输入特例。
- ❌ **不做资金机会成本的主指标**——只作为结论里的极小补充，因为通常远小于过期浪费。

### 1.6 核心设计原则（重要，复刻时优先遵守）

> 这六条原则是所有实现细节的「上位法」。细节可以变通，原则不能违背。

1. **只回答一个主问题**：首屏唯一主流程是「这次买几套合适」。比价/预售/拼单三个工具是**辅助**，不得抢占首屏主位。
2. **两个「剩余」必须分开**：
   - 「下次大促时还剩」= **提前占用**（占钱、占地方，但货还活着，不算亏）
   - 「到期时剩」= **硬损失**（过期 = 一文不值，才是真浪费）
   判断「囤过头」只看后者。二者绝不可混为一谈。
3. **不给断语，给区间和条件**：永远不说「建议买 3 套」。说「撑到大促至少 3 套；4~6 套属于提前囤货，**需要价格优势支持**；超过 6 套会用过期」。
4. **同口径贯彻到底**：「套装比价」和「预售 vs 现货」必须与主流程**共用同一个模拟器、同一批旧货数据、同一套先到期先用规则**。绝不允许出现「主流程说能用、比价区说浪费」的口径矛盾。
5. **数字必须能扫读**：结论先用一句大标题 + 一行关键词，细节沉到可展开的明细里。长解释收进「?」图标。
6. **配色守纪律**：橙色**只**给主要操作和当前选择；红色**只**给风险；普通解释用中性色。同一页面里橙色标题、橙色滑块、橙色边框、彩色结论框**不允许同时出现抢注意力**。

---

## 2. 名词与口径定义（实现前必须先统一）

> 这一节是整个产品的「字典」。**所有数字的定义以本节为准。**

### 2.1 场景与单位

| 场景 key | 名称 | 单位 U | 适用商品 | 典型输入 |
|---|---|---|---|---|
| `count` | 按次用 | 份 | 面膜、一次性 | 多久用一次（天/周）× 每次几份 |
| `volume` | 按体积用 | ml | 护肤/洗发水 | 一瓶多少 ml 够用多少天（或每天 ml） |
| `pack` | 按件用 | 件 | 洗衣液、纸巾、猫粮 | 一件能用几天 |

**全部归一化为三个量**（由 `derive()` 产出）：

- `rate`（r）：**每天消耗量**（单位/天）
- `stockAmount`：**当前库存量**（单位）
- `setAmount`：**每套量**（单位）
- `U`：单位字符串（份 / ml / 件）

### 2.2 关键输入定义

| 名称 | 字段 | 定义 |
|---|---|---|
| 消耗速度 | `rate` | 每天消耗多少个单位 |
| 库存 | `stockAmount` / `stock` | 家里现有多少（含快到期的），**不是**「还剩几天」 |
| 旧货批次 | `oldBatches` | `[{amount, expiry}]`，旧货分多批时分别填；为空则退化为「单一库存 + 最早到期日」 |
| 每套量 | `setAmount` | 一个「套」包含多少单位 |
| 到手价 | `setPrice` | **实际付款**（含定金，不减赠品估值） |
| 实际付款 | `listPrice` | 恒等于用户输入的到手价；**只有它代表真实花的钱**，UI 上单独展示，绝不因赠品估值而变化 |
| 新货到期日 | `newExp` | 本单新货的到期日；`expKnown=false` 时用「到货日 + 180 天」假设值 |
| 到货日 | `arrive` | 预计到货日（距今天数）；预售/海淘常 > 0 |
| 大促日 | `sale` | 下次大促日期；默认取**下一个 618 / 双 11**，距今天数记作 `sale` |
| 效期是否已知 | `expKnown` | true=填实际到期日；false=按假设效期估算，所有结论加「估算」标注 |

### 2.3 两个「剩余」（核心口径）

- **`leftAtSale`（下次大促时还剩）**：把「旧货 + 计划新货」跑一遍消耗模拟，截到**大促日**还剩多少。
  - 语义：提前占用。占资金、占收纳空间，但货仍然有效，留到大促之后继续用完全没问题。**折扣足够好时这笔占用甚至划算。**
- **`leftAtEnd`（到期时剩）**：同一次模拟跑到底，**因过期而未被消耗掉**的总量。
  - 语义：硬损失。过了效期一文不值，会把便宜单价反转成高成本。**判断「囤过头」只看这个数。**

> ⚠️ 曾经出现过的 bug：用不同规则分别算「大促剩」和「到期剩」，导致出现「到期剩 13 > 大促剩 10」的矛盾。**必须用同一个模拟器、同一套 FIFO 规则**（`remainingAt(D)` 内部同样是「把时间轴截到 D 重算」，而不是各批独立缩放）。

### 2.4 三层推荐结构（替代「合理购买区间」）

> 早期版本把「不过期上限」直接叫做「合理购买区间」，这是错的。**「不过期就能用」不代表「就应该买」。**

| 层 | 名称 | 含义 | 颜色 |
|---|---|---|---|
| ① | 撑到下次大促的最少 | 只满足「够用到大促」这个**保守购买基准** | 绿 |
| ② | 提前囤货段 | 这一段**不是「不够用」，而是「提前买」**——**必须靠这次价格更低才划算**，不是默认合理 | 橙（斜纹，表示「有条件」） |
| ③ | 效期上限 | 超过这个量，多买的部分会在效期内用不完 = **直接浪费** | 红 |

### 2.5 五种结论类型 `kind`

`calcCore()` 根据输入判定 `kind`，是文案与 UI 分支的总开关：

| kind | 触发条件 | 含义 |
|---|---|---|
| `none` | `shortBySale ≤ EPS` | 现有库存已够撑到大促，**可以不买** |
| `late` | `tooLate`（`shortBySale > EPS` 且 `maxNewBySale ≤ EPS`） | 到货太晚/效期太短，**本单赶不上大促前的缺口** |
| `unfit` | `maxSetsNoWaste ≤ 0` | **规格不适合**——连 1 套都在效期内吃不下 |
| `limited` | `setsBySale > maxSetsNoWaste` | 受效期限制，**最多买 N 套不浪费**，撑不满整个周期 |
| `fit` | 其它 | 正常可推荐区间（再由 `planBand` 细分） |

### 2.6 计划档位 `planBand`

`planBand` 描述「用户计划买的数量」落在三层区间条的哪一段，用于 UI 高亮与文案分支：

| planBand | 含义 |
|---|---|
| `empty` | 用户还没填「打算买几套」（`planSets≤0` 且 `kind≠none`） |
| `none` | `kind=none` 且计划为 0 |
| `short` | 计划 < ① 层（买少了，会断档） |
| `just` | 计划 = ① 层（正好撑到大促） |
| `ahead` | ① < 计划 ≤ ③（落在提前囤货段，需价格优势支持） |
| `over` | 计划 > ③（会囤过头） |

> 特例：`kind='unfit'` 且 `planSets>0` 时强制 `planBand='over'`——因为「规格不合适」本质上就是「计划必然超过效期上限」，高亮应落在第 ③ 层。

### 2.7 赠品口径（分子 / 分母互斥）

赠品有两个完全不同的量，**必须分开**，否则同一份赠品会被重复算两次优惠：

| 口径 | 进「分母」（可用量） | 进「分子」（成本抵扣） |
|---|---|---|
| **同款 / 通用**赠品 | ✅ 只并入「你预计会用掉的部分」 | ❌ 不抵扣价格 |
| **不同产品**赠品 | ❌ 不并入（不能和正装合并计算用量） | ✅ 只按用户主观估值抵扣成本 |

- 「实际付款」（`listPrice`）**始终单独显示**，不因估值而变。
- 拼单分摊时赠品按**实收实物量**分（不按估值折算）。

---

## 3. 信息架构与页面结构

### 3.1 整体布局

**单页 + 顶栏锚点导航 + 首屏 Hero**。所有内容常驻同一长页，导航点击是**滚动定位**（不是页面切换）。

```
┌─────────────────────────────────────────────┐
│ [Logo] 囤货算盘 STOCK OR STOP               │ ← .topbar (sticky)
│        主流程 套装比价 预售vs现货 拼单 计算方法  [清空重填] │
├─────────────────────────────────────────────┤
│  免费·无需注册·数据仅在本机计算                │ ← .hero（全幅浅蓝渐变）
│  先算清会不会囤过头，再决定这次买几件            │
│  [立即计算] [载入示例]                        │
│  ✓自动保存 ✓手机可用 ✓不联网不上传 ✓比价预售同口径 │
├─────────────────────────────────────────────┤
│ #sec-main  主流程（桌面左右分屏）              │
│  左：输入卡片      右：结论面板（sticky）       │
├─────────────────────────────────────────────┤
│ #sec-cmp   套装比价                           │
├─────────────────────────────────────────────┤
│ #sec-vs    预售 vs 现货（两张平级卡）           │
├─────────────────────────────────────────────┤
│ #sec-group 囤货拼单分摊                        │
├─────────────────────────────────────────────┤
│ #sec-about 计算方法与口径（所有解释集中于此）     │
├─────────────────────────────────────────────┤
│ footer：数据本机保存 · 清空重新填                │
└─────────────────────────────────────────────┘
```

### 3.2 导航与高亮

- 导航项（`<a href="#sec-xxx" data-sec="sec-xxx">`）：主流程 / 套装比价 / 预售 vs 现货 / 拼单分摊 / 计算方法。
- 点击 → `scrollIntoView({behavior:'smooth'})`，并 `preventDefault()`（不改变 URL hash，避免与锚点滚动双跳）。
- 高亮跟随滚动：`IntersectionObserver`，`rootMargin: '0px 0px -75% 0px'`，`isIntersecting` 时把对应导航项设为 `.active`。
  - ⚠️ 参数要点：`-75%` 底部边距让「进入视口上部 25%」的 section 才算激活；用 `-30% 0px -60% 0px` 会在 hash 直达（section 顶部在视口约 6% 处）时检测不到。
- `section.sec { scroll-margin-top: 66px; }` 抵消 sticky 顶栏高度。

### 3.3 首屏 Hero

- 全幅 `linear-gradient(180deg,#e3e9f4,#eef1f6)` 背景**拉通**（不含白卡）。
- 元素顺序：pill 徽章 → 渐变橙大标题（`clamp(30px,4.6vw,44px)`）→ 副标题 → 双按钮 → ✓ 特性行。

---

## 4. 数据模型

### 4.1 全局状态

```js
SCENES = { count:{name:'按次用',unit:'份'}, volume:{name:'按体积用',unit:'ml'}, pack:{name:'按件用',unit:'件'} }
ASSUMED_SHELF = 180          // 效期未知时的保守假设：到货后约 6 个月
state = { count:{...}, volume:{...}, pack:{...} }   // 三场景各存一份，切换不丢数据
mode = 'count'               // 当前场景，默认 count
lastStockUnit = 'ml'         // 记录上次渲染时库存单位，用于「瓶/ml」切换时换算
LAST = {}                    // 主流程 → 辅助工具的联动快照（见 4.3）
```

### 4.2 三场景默认值 `DEFAULT_STATE`

```js
count:  { gap:3, perUse:1, stock:6, oldExp:'', oldBatches:[], useBatches:false, expKnown:true,
          setSize:20, setPrice:99, planSets:2, vsNormal:'unknown', newExp:'', arrive:'', sale:'' }

volume: { rateMode:'bottle', bottleMl:500, bottleDays:125, daily:4,
          stock:120, stockUnit:'ml', oldExp:'', oldBatches:[], useBatches:false, expKnown:true,
          post:[{ml:500,qty:1}], giftMl:60, giftUse:100, giftMerge:true, giftValue:30,
          setPrice:399, planSets:1, vsNormal:'unknown', newExp:'', arrive:'', sale:'' }

pack:   { perPack:30, stock:1, oldExp:'', oldBatches:[], useBatches:false, expKnown:true,
          setSize:3, setPrice:69, planSets:2, vsNormal:'unknown', newExp:'', arrive:'', sale:'' }
```

字段说明补充：

- `gap`（count）：使用间隔天数（UI 里可 ×1 天 / ×7 周）
- `rateMode`（volume）：`'bottle'`=按「一瓶能用多久」倒推；`'daily'`=直接填每天 ml
- `post`（volume）：套装规格组合 `[{ml, qty}]`，支持多行（正装 + 小样）
- `giftMl` / `giftUse` / `giftMerge` / `giftValue`（volume）：赠品实收 ml / 预计用掉 % / 能否并入用量 / 主观估值
- `vsNormal`：这次单价 vs 平时，`unknown | lower | same | higher`
- `oldBatches` + `useBatches`：多批旧货草稿与「已确认接管」标志（见 §8.4）

### 4.3 联动快照 `LAST`

每次 `calcCore()` 结束后写入，供比价/预售/拼单复用**同一口径**：

```js
LAST = {
  U, rate, stockAmount, oldBs, oldEnd, setAmount, setPrice, listPrice, planSets,
  newExp, sale, unitPrice, rateDesc, refMl,
  rec: { kind, planBand, recSets, recQty, hiSets, hiQty, minNeeded, minSetsNeeded,
         maxNoWaste, maxSetsNoWaste, maxNewBySale, plan, planSets, oldUsed,
         oldStandaloneWaste, newUsed, newWaste, leftAtSale, leftAtEnd,
         gapDays, shortQty, arrive, extraSets, extraDays, vsNormal }
}
```

> **关键**：`oldBs` 是**真实旧货批次数组**（多批时逐批带上数量与到期日），不是「一个总量 + 一个最早到期日」。比价/预售直接 `oldBs.concat([新货])` 进同一个 `simulate()`。

### 4.4 辅助工具状态

```js
offers = []          // 比价候选 [{name, price, amount, shelf}]
cmpDirty = false     // 比价是否被手动改过（改过后不随场景重置）
vsDirty = {a:false,b:false}   // 预售/现货两栏是否被手动改过
gPack = null         // 拼单大单 {items:[{amount,qty}], price, sets}
gMembers = []        // 拼单成员 [{name, need}]
gPackDirty / gMemberDirty     // 拼单是否被手动改过
```

### 4.5 持久化 Schema（localStorage）

- key：`stockpile-demo-v1`
- 写入时机：每次 `calcCore()` 结尾调用 `persist()`
- 内容：

```json
{ "v": 2, "mode": "count", "state": { ...三场景... }, "offers": [...], "cmpDirty": false, "savedAt": 1739... }
```

- **降级**：`try/catch` 包裹，隐私模式 / 存储已满时静默降级为「刷新即清空」，不得报错中断。
- `restore()` 读取时：先恢复 `mode`，再逐场景 `Object.assign(state[k], o.state[k])`（**合并而非替换**，兼容旧版本缺字段）。

---

## 5. 核心算法规格

### 5.1 `simulate(batches, r, cap)` —— FIFO 连续消耗模拟引擎

> 这是整个产品的**心脏**。所有结论、所有工具都跑在它上面。

**输入**：

- `batches`：`[{id, units, expiry, start}]`，`start`=到货日（距今天数，默认 0），`expiry`=到期日（距今天数）
- `r`：每天消耗量
- `cap`（可选）：观察窗口截断天数（算「某天还剩多少」时用）

**规则**：

1. 任何时刻，**只从「已经到货（`start ≤ t`）且还没过期（`expiry > t`）且还有余量」的批次里消耗**。
2. 可选池里，**优先消耗最早到期的**（`expiry` 升序，同 `expiry` 再按 `start` 升序）。
3. 时间推进到**下一个状态变化点**，取四者最小值：
   - 当前批次用完的时刻：`t + (units − used)/r`
   - 当前批次到期的时刻：`b.expiry`
   - 下一批到货的时刻：`nextArr`
   - 观察窗口结束：`cap`
4. **若是到货导致的用完**（可选池为空但还有未到货的货）：跳到下一批到货时间（这段时间就是**断档**）。
5. `cap` 之内的消耗计入 `used`；窗口结束后，**未消耗的部分计入 `waste`**（= `max(0, units − used)`）。

**输出**：

```js
{ bs, byId(id), used, waste, remainingAt(D) }
```

- `remainingAt(D)`：**用同一套 FIFO 规则把时间轴截到 D 重算**后，各批剩余量之和（`sum(max(0, units − used@D))`）。
  - ⚠️ 绝不能用「各批独立缩放」的近似算法，否则会与 `waste` 口径打架。

**容差**：所有比较用 `1e-9`（`EPS` 用 `1e-6`）；循环加 `guard < 100000` 防死循环。

### 5.2 `derive()` —— 三场景归一化

把任一场景的输入，归一成 `{U, rate, stockAmount, setAmount, setPrice, listPrice, oldBatches, multiOld, rateDesc, setDesc, ...}`。

**count**：
```
rate = perUse / gap
setAmount = setSize
rateDesc = "每 {gap} 天用 {perUse} 份（≈ {r} 份/天）"
```

**pack**：
```
rate = 1 / perPack
setAmount = setSize
rateDesc = "一件用 {perPack} 天（≈ {r} 件/天）"
```

**volume**：
```
pos        = Σ(post[i].ml × post[i].qty)                 // 正装合计
giftUsed   = giftMerge ? giftMl × giftUse/100 : 0         // 同款才并入
total      = pos + giftUsed                               // 每套可用量
deduct     = giftMerge ? 0 : giftValue                    // 非同类才抵扣成本
netPrice   = max(0, setPrice − deduct)                    // 用于算单位成本
listPrice  = setPrice                                     // 实际付款，恒定
rate       = rateMode=='daily' ? daily : bottleMl / bottleDays
refMl      = 套装里最大的正装 ml（无则 100）              // 用于「≈几瓶」表达
```

**多批旧货（三场景共用）**：
```
validBatches = oldBatches.map((b,i)=>({id:'old'+i, units:max(0,+b.amount||0), expiry:dayDiff(b.expiry)})).filter(b=>b.units>0)
batchMode    = !!useBatches                      // 只有「已确认接管」才生效
multiOld     = batchMode && validBatches.length > 1
oldBatches   = batchMode ? validBatches : [{id:'old0', units:max(0,stock||0), expiry:dayDiff(oldExp)}]
stockAmount  = batchMode ? Σ validBatches.units : max(0, stock||0)
```

> ⚠️ **`useBatches` 守卫是关键**：`derive()` 只有在用户**填完并确认接管**后才用批次列表替代单一库存。否则用户刚点「＋加一批旧货」（新行数量还是 0）时，库存会瞬间变 0，结论乱跳。见 §8.4。

### 5.3 `calcCore()` —— 主计算

```js
// 基础量
planSets = max(0, s.planSets)
plan     = planSets × setAmount
sale     = dayDiff(s.sale)                        // 距大促天数
arrive   = dayDiff(s.arrive)
newExp   = expKnown ? dayDiff(s.newExp) : arrive + ASSUMED_SHELF
oldExp   = min(oldBs[].expiry)
unitPrice = setAmount>0 ? setPrice/setAmount : 0

// 旧货两条窗口
oldBySale = simulate(oldBs, r, sale).used         // 旧货到大促为止能消耗多少
oldFull   = simulate(oldBs, r)                    // 旧货全程
oldUsed   = oldFull.used
oldEnd    = max(oldFull.bs[].end)

// 新货两条窗口（用 1e12 的虚拟量探到上限）
maxNewBySale = simulate(oldBs.concat([newBatch(1e12)]), r, sale).byId('new').used
maxNoWaste   = simulate(oldBs.concat([newBatch(1e12)]), r).byId('new').used

// 三层
EPS           = 1e-6
needToSale    = sale × r
shortBySale   = max(0, needToSale − oldBySale)
maxSetsNoWaste= floor(maxNoWaste / setAmount + 1e-9)
setsBySale    = shortBySale > EPS ? ceil(shortBySale / setAmount − 1e-9) : 0
tooLate       = shortBySale > EPS && maxNewBySale <= EPS
lateByArrival = arrive > sale + EPS

// kind 判定
if (shortBySale <= EPS)                                   kind='none'
else if (tooLate)                                         kind='late'
else if (maxSetsNoWaste <= 0)                             kind='unfit'
else if (setsBySale > maxSetsNoWaste)                     kind='limited'
else                                                      kind='fit'

// 计划模拟（真实按 plan 买）
planSim      = simulate(oldBs.concat([newBatch(plan)]), r)
leftAtSale   = planSim.remainingAt(sale)
leftAtEnd    = planSim.waste
newUsed/newWaste = planSim.byId('new').used / .waste
oldWaste     = Σ planSim.bs[非new].waste
expiredBySale= Σ planSim.bs[expiry<=sale].waste
planCost     = plan × unitPrice
effUnit      = plan>0 && newUsed>0 ? planCost/newUsed : unitPrice   // 含浪费的实际单位成本
usedBySale   = simulate(oldBs.concat([newBatch(plan)]), r, sale).used
shortQty     = max(0, needToSale − usedBySale)
gapDays      = (r>EPS && sale>EPS) ? max(0, ceil(sale − usedBySale/r − 1e-9)) : 0

// 提前囤货代价
daysPerSet   = setAmount / r
extraSets    = max(0, planSets − setsBySale)
extraDays    = extraSets × daysPerSet
extraCost    = extraSets × setPrice
extraCapCost = extraCost × 0.03 × (extraDays/2) / 365      // 年化 3%，取半周期
extraCapPct  = extraCost>0 ? extraCapCost/extraCost : 0
```

### 5.4 阈值与容差的来由（都是踩过的坑）

| 阈值 | 值 | 为什么 |
|---|---|---|
| `EPS`（判定「有没有缺口」） | `1e-6` | 早期用 `0.05`，对「件」这种离散单位太松——「1 件用 30 天 vs 大促在 31 天后」被误判成「不用买」。收紧到 `1e-6`。 |
| `floor(x + 1e-9)` / `ceil(x − 1e-9)` | ±1e-9 | 抵消浮点误差（`20/20` 算出 `0.9999999` → 误 floor 成 0）。 |
| `gapDays` 的 `−1e-9` | — | 无缺口时避免算出「1 天」。 |
| 展示层 `minNeededShow = ceil(minNeeded)` | — | 离散单位（份/件）必须向上取整才可执行。 |
| `amt()` 的 `0.05` 取整阈值 | — | 数量展示：小数部分 < 0.05 视为整数。 |
| `bottleLabel()` 的 `0.035` 匹配 | — | 「几分之一瓶」的分数近似匹配容差。 |

### 5.5 套数对齐（`ceil`/`floor` 必须同层）

> 曾经的 bug：`minNeeded` 用 `ceil`、上限用 `floor`，但一个对齐到「量」、一个对齐到「套」，默认值下给出「1 件 vs 0 件」的矛盾。

**统一规则**：推荐量一律在**「套」这一层**对齐。
```
maxSetsNoWaste = floor(maxNoWaste / setAmount)     // 最多买几套不浪费
setsBySale     = ceil(shortBySale / setAmount)     // 至少买几套撑到大促
```

---

## 6. 主流程功能规格（#sec-main）

### 6.1 输入区（左栏）

按三组呈现，每组一个 `.grp-head`：

**① 你的使用情况**

- `count`：
  - `多久用一次`（数字 + 天/周下拉，必填）
  - `每次用几份`（滑块 0.5~6，步长 0.5，单位「份」）
  - `现在家里还有（份）`
  - 动态提示：`≈ 每 X 天用 1 份`
- `volume`：
  - `消耗速度怎么估`下拉（`我知道「一瓶能用多久」` / `我知道「每天用多少」`）
  - 前者：`一瓶大概多少 ml` + `这样一瓶够用多少天`（滑块 3~365）
  - 后者：`每天用多少（ml）`（滑块 0.5~30，步长 0.5）
  - 动态提示：`换算：≈ X ml/天，一瓶能用约 Y 天。`
  - `现在家里还剩`（数字 + ml/瓶 单位下拉）+ 提示 `约等于 X 瓶`
  - **套装规格组合**（`.sub-grid`）：多行 `容量(ml) × 数量`，可增删
  - **赠品**（`.sub-grid`）：`赠品实收合计(ml)` / `其中你预计会用掉(%)`（滑块 0~100 步长 5）/ `能否与正装合并计算用量`（能=同款 / 不能=不同产品）/ `你认为这些赠品值多少钱(¥)`
  - 实时汇总行 `#volTotal`：`每套可用于消耗的量 = 正装 A ml + 同款赠品可用 B ml = C ml` + 「?」解释
- `pack`：
  - `一件能用几天`（滑块 1~180，单位「天」）
  - `现在家里还有（件）`

**② 这次想买的套装**

- （非 volume）`每套份数` / `每套件数`：滑块 1~30（cap=30）
- `套装到手价（¥）`
- `你打算买几套`（**必填**）：滑块 0~20，步长 1（cap=20）
- `这次单价 vs 平时`下拉：不知道/还没比 · 明显更低 · 差不多 · 反而更高

**③ 关键日期**

- `下次大促日期`（date，默认下一个 618/双 11）+ 提示「距今天 X 天（默认取下一个 618/双11）」
- `<details>` 折叠（默认折叠，「已按典型值预填，通常不用动」）：
  - `这批新货的到期日`（知道实际到期日 / 不知道按假设效期估算）
    - 选「不知道」→ 显示「按到货后约 180 天估算」，不给日期输入
  - `预计到货日`（date，默认今天）+ 提示「立即到货 / 还要等 X 天」
  - `家里旧货最早到期日`（date）
  - **旧货分批录入区**（见 §8.4）

**输入监听**：变更即 `syncStateFromInputs(); calcCore();`（实时重算，无「计算」按钮）。

### 6.2 结论面板（右栏，sticky）

**结构（自上而下）**：

1. **深色重点结论卡 `.dhero`**（深蓝渐变 `#1b2a4d → #141f3a`，白字，大圆角 + 阴影）
   - 顶部：`这一单的结论` + 「?」问号（内容是「两个数字区别」的解释）
   - **大标题 `.rh`**（26px 800）：一句扫读结论（见 §10.3 决策树）
   - **副行 `.rs`**（13px）：一行关键词（见 §10.4）
   - **两块指标瓦片 `.dtiles`**：`下次大促时还剩` / `到期时剩（浪费）`（后者有浪费时数值变红 `#ff97a8`）
   - **进度条 `.dbar`**：`这批新货到期前能用掉 = XX%`；有浪费时变橙红警示色
2. **「买几套合适」卡**：**三层区间条可视化**（见 §6.4）
3. **计算明细卡**：`<details open>`（**默认展开**）、`.detail` 浅色小字
   - 消耗速度 / 本次套装 / 实际付款 / 到货时间 / 旧货能用掉与浪费 / 新货能用掉与浪费 / 全部货用完的时间 / 每单位实际成本（含浪费）
   - 末尾 `结论说明：` + 完整长解释（`vTxt`）+ `note`
4. （移动端被删的）资金机会成本折叠 —— **产品已移除，不要再加回来**

> **右侧面板在桌面端 `position:sticky; top:66px`**，随页面滚动吸附。

### 6.3 指标瓦片的文案

```js
saleNote = leftAtSale <= 0.05 ? '届时已用完'
         : expiredBySale >= leftAtSale-0.05 ? '届时已过期'
         : expiredBySale > 0.05 ? '含 ' + show(expiredBySale) + ' 已过期'
         : '提前占用 · 不算亏'
endNote  = leftAtEnd > 0.05 ? '浪费 ' + fmt(leftAtEnd × unitPrice)
         : expKnown ? '无过期浪费' : '按假设效期估算'
```

### 6.4 三层区间条可视化 `.rangebar`

- 一条横向条，按比例分成三段：
  - 绿 `.rz.g`（`#37c08e→#0f9d6e`）：0 → `z1 = min(setsBySale, maxSetsNoWaste)`
  - 橙斜纹 `.rz.o`（`repeating-linear-gradient(135deg,#ffb26b,#ff9a4d)`）：`z2 = maxSetsNoWaste − z1`
  - 红 `.rz.r`（`#e0566e→#c93b54`）：`z3 = capSets − maxSetsNoWaste`
- `capSets = max(planSets, maxSetsNoWaste, min(setsBySale,60), 1)`
- **当 `z3 === 0`（计划落在安全区）时，强制 `capSets += 1` 且 `z3 = 1`**——留一截红色提示「再往后就是浪费」，否则用户看不到风险区。
- **游标 `.pin`**：黑色竖线 + 三角 + 标签 `你：N 套`，位置 `planSets/capSets`。（`planSets=0` 时不显示）
- 下方刻度 `0 套 ——— capSets 套`
- **图例 `.rblegend`** 三行：
  - ① 撑到下次大促的最少：**N 套**
  - ② 提前囤货段：**（N+1 ~ M 套）**（每多 1 套 ≈ 提前囤 X 天，要价格优势）/ 或「无——效期内只有第 ① 段安全」
  - ③ 效期上限：**M 套**，超过＝过期浪费 / 或「这批效期内连 1 套都吃不下」
    - 效期未知时追加「（效期按假设 180 天估算，以收到货的包装为准）」
  - 当前 `planBand` 对应的那行加 `.cur`（橙色加粗高亮）
- 底部：`🎯` + `recLine`（保守结论一行）
- `kind==='late'` 时不画区间条，改为一句话说明。

---

## 7. 辅助工具规格

### 7.1 套装比价（#sec-cmp）

- **口径**：与主流程**完全同口径**——`simulate(oldBs.concat([{id:'new', units:amount, expiry:shelf, start:0}]), r)`（候选视为现货，今天可开始消耗）。
- 输入行：方案名称 / 到手价 / 等效总量（标签随场景显示 `等效总量（份|ml|件）`）/ 新货效期（天，**从今天算起的天数**）/ ＋添加 / ↺恢复示例。
- 输出表（按「实际每 U 成本」升序）：
  - 列：方案 / 到手价 / 等效总量 / 能用掉（有浪费则红字「浪费 X」）/ 实际每 U 成本（+ 小字「标称 ¥Y」）/ 删除
  - 最优行 `.best` 绿底 + 「最优」pill
  - 用不掉的方案：成本列显示红字「用不上」
- 总结：`按实际能用掉的量算，X 每 U ¥a；但只看标价它排第 N（¥b）——（标价也最低，双重占优 / 标价并不最低，真正便宜的是它）`
- 警示：所有 `usable ≤ 0.05` 的方案 → 红色 verdict「…按你的消耗速度在效期内几乎用不掉（先到期先用，与主流程同口径），买回来就是浪费，先排除。」
- 联动提示 `#cmp-sync`：`已沿用主流程：消耗速度 X；家里的旧货（含多批）与候选方案的新货排同一条队伍，先到期先用。效期填「从今天算起的天数」。`
- `CMP_DEFAULTS` 每个场景一套示例（见代码）。

### 7.2 预售 vs 现货（#sec-vs）

- **两栏平级卡片**（不再外套大框）：`🛍️ 现货` / `⏳ 预售`。
- 每栏字段：到手价 / 每套可用量 / 赠品折算价值(¥) / 到货等待(天) / 新货效期(天)。
- **默认自动联动主流程**：
  - 现货 = 主流程套装（price/amount/shelf 跟随，wait=0，gift=0）
  - 预售 = 主流程 9 折 + 等 15 天 + 赠品 ¥20
  - **任一栏被手动改动** → 该栏置 `vsDirty`，打「已手动调整」红色 pill，停止跟随；「↺ 恢复与主流程联动」可复位。
- **口径**（关键修复）：旧货用**真实到期日**参与先到期先用（早期 bug 是把旧货的「用完日」当「到期日」）：
  ```js
  simulate(oldBs.concat([{id:'new', units:amount, expiry:wait+shelf, start:wait}]), r)
  gap = max(0, round(wait − oldEndMax))
  net = max(0, price − gift)
  perUnit = usable>0 ? net/usable : Infinity
  ```
- 输出：两行「实际每 U 成本（+断档 X 天 + 浪费 X）」→ verdict：
  - 都 `!isFinite` → 红「两边都用不上——到货时间或效期对不上你的消耗速度，先别买。」
  - `|差| < 0.02` → 中性「两者实际成本几乎一样。这时优先选现货：不用等，也不用承担发货与降价风险。」
  - 否则 → 绿「X 更划算：每 U 实际成本 ¥a，比 Y 便宜 ¥b。」（预售更便宜时补「已把预售的等待与赠品差异算进去」；现货更便宜时若预售有断档/浪费，点出「省下的钱抵不上没得用 / 多出的量把单价优势吃掉了」）

### 7.3 囤货拼单分摊（#sec-group）

- **模型**：一大单买回来 → 几个人**按各自真正需要的量**分摊。忽略邮费，**不是**购物车满减。
- 大单默认 = `主流程套装规格 × 打算买套数`（volume 场景把赠品按**实收 ml** 也加进去）。
- 成员默认：按 40% / 35% / 15% 分（故意留 10% 无人认领以演示「剩余」提示）。
- 输出表：成员 / 需要 / 占总量 / 应摊货款（`need × 平均单价`）。
- 汇总：整单总量与整单价 / 已被认领（含金额）/ 平均单价。
- 三种结局：
  - 超额认领 → 红「各人需要加起来已超过这一单总量——要么有人少拿，要么这一单得再加量。」
  - 有剩余 → 红「还有 X 没人认领（约 ¥Y）。这部分默认由发起人自留；用不完就再找人分，或换小规格。」
  - 刚好分完 → 绿「刚好分完：每个人只为自己真正需要的量付钱，没有人为囤过头买单。」
- 单位随主场景联动（份 / ml / 件）；volume 下成员需要量可填 ml 或瓶。

### 7.4 计算方法与口径（#sec-about）

> 首页只给结论，**所有解释性内容集中在这一节**（这是「首屏减负」的落地方式）。

内容分块：

1. **推荐为什么是三层**（三层 `.tier` 卡片，绿/蓝/红圆点）
2. **「大促时还剩」和「到期时剩」是两回事**
3. **消耗模拟的规则**：先到期先用 / 未到货不能提前用 / 多批旧货 / 比价预售同口径
4. **赠品怎么算**：同款进分母 / 不同产品进分子
5. **数据存在哪**

---

## 8. 交互规格

### 8.1 问号提示 `T(tip)` + 全局 `#tip`

- `T(text)` 生成 `<span class="q" data-tip="...">?</span>`；`class="q"` 是内联圆形问号（15×15，`#eef0f3` 底）。
- 全局 `#tip` 是 `position:fixed` 的 tooltip，深色底白字，`max-width:min(300px,92vw)`。
- **触发方式**（四选一均可）：
  - `mouseover` 悬停显示、`mouseout` 隐藏
  - `focusin` / `focusout` 键盘可达（`tabindex="0" role="button"`）
  - `click` 切换
- **触屏时序坑**：tap 会先触发 `mouseover` 再触发 `click`。用 `hoverShown` 标记——若这次点击紧跟在「悬停显示」之后，则视为「固定显示」而非关闭。
- 点空白处 / 页面滚动时收起。
- 定位：`left` 夹在 `[8, innerWidth − bw − 8]`；默认在元素上方，上方放不下则放下方；都在视口内。
- **在 `<summary>` 里点问号，不得触发 details 折叠**（`e.stopPropagation()` + `preventDefault()`）。

### 8.2 滑块字段 `FS(...)` + `bindRanges()`

- 结构三层：
  ```
  .field.fslide
    .fs-top   → <label>指标名 + ?</label> <input type=number>   ← 上行：名在左，数字框在右
    <input type=range>                                          ← 中行：全宽滑块
    .fs-scale → <span>min+单位</span>  <span class="fs-max">cap+单位</span>  ← 下行：刻度
  ```
- **固定上限（cap）机制**（解决「拖到头再拉回会 1↔2000 跳变」）：
  - 滑块 `max` = `cap`（`planSets`=20、`setSize`=30，其余=max）。**已彻底移除「拖到头自动翻倍」的 grow 机制。**
  - 数字框 `max` 也 = `cap`（钳住滚轮/上下键），但**直接键入不受限**——想买 25 套，手动输入 25 可通过。
  - 值 > cap 时：滑块自动钉在最右（`r.value = n.value` 会被浏览器钳到 max），右刻度变橙色 `20+套` 并加 `.over`。
  - `bindRanges()` 双向同步：range→number 触发 `input`（带动重算）；number→range 同步值 + 刷新刻度文案。
- 字段清单：`k-perUse`(0.5~6,step.5) `k-daily`(0.5~30,step.5) `k-bottleDays`(3~365,step1) `k-perPack`(1~180,step1) `k-setSize`(1~30,step1,cap30) `k-planSets`(0~20,step1,cap20) `spec-use`(0~100,step5)。

### 8.3 数字框滚轮

- 全局 `wheel`（`passive:false`）监听：
  - 仅对 `input[type=number]` 生效；`disabled` / `readOnly` 跳过。
  - **聚焦时**可直接滚；**未聚焦时**需指针落在**右侧上下箭头区**（`clientX ≥ right − 22`）才生效。
  - 其余情况**不拦截**，交给页面正常滚动（避免抢滚动）。
- 步长取 `step`，钳在 `[min,max]`；值未变化则不 `preventDefault`。

### 8.4 多批旧货：草稿 / 确认两段式

> 曾经的 bug：点「＋加一批旧货」，新行数量还是 0，但 `derive()` 一看到批次列表非空就替代库存 → **库存瞬间变 0**。

**两段式状态机**：

1. **草稿态**（`useBatches = false`）：
   - 点「＋加一批旧货」只添加草稿行。**第一次**添加会把当前单一库存预填进第 1 批（便于用户在此基础上拆分）；后续添加数量为 0。
   - 上方库存框**仍是生效数字**（单一库存口径），并显示「草稿 · 还没生效」警示 pill。
   - 明确提示：「填完再点按钮接管——在接管之前，上面『现在家里还有』仍然是当前生效的数字。」
   - 按钮文字实时刷新：`✓ 就按这 N 批算（合计 X）`。
2. **接管态**（`useBatches = true`）：
   - 上方库存框变为**只读的「各批合计」**（`#k-stockRO`，`.ro` 样式）+ 副行「= 下方『旧货分批』各批合计 · 要改请在下面改」。
   - `syncStateFromInputs()` 有 `!s.useBatches` 守卫，**绝不覆盖只读合计**。
   - 接管后合计为 0 时**显式警告**（「各批合计为 0：如果家里确实没货，这是对的；否则请填上数量。」），**不偷偷回退**。
3. **退出**：删完所有批次 → 自动 `useBatches=false`，退回单一库存；或点「改回单一库存」/「清空」。

**性能细节**：改各批数量时只刷新「合计」显示（`refreshBatchHints()`），**不重画整个输入区**（否则正在编辑的框会失焦）。

### 8.5 数据保鲜

- `persist()` 记录 `savedAt`。
- 重开页面 → `auditStale()` + `renderStaleBar()`：
  - 显示「🕓 上次更新：X月X日 HH:MM（X 天/小时/分钟前）」；≥60 天显示「约 N 个月前」。
  - **≥ 1 天**：变红条 + 提示「这段时间家里的货可能已经消耗了一部分，请确认现有库存后再下判断。」按钮：[库存没变，继续] [我要改库存]。
  - **< 1 天**：中性灰条 + [知道了]。
- `auditStale()` 自动修正：
  - 已过去的「大促日期」→ 改成下一个 618/双 11，提示「已自动改为下一个 618 / 双 11」。
  - 已过去的「到期日 / 到货日」→ **不自动改**，明确列出请用户重选（`⚠️ 这些日期已经是过去时，请重新选择：…`）。
- 「我要改库存」：打开折叠区；多批模式下滚到只读合计框；否则聚焦库存输入框并选中。

### 8.6 场景切换与示例

- 三个场景按钮（`.modes`），切换时：
  - 保存当前场景输入（`state[mode]` 天然独立）；
  - 若比价未被手动改过（`!cmpDirty`）→ 换一套贴合该场景的示例；
  - 预售/现货、拼单重新跟随主流程（清 `*Dirty`）。
- `renderPresets()`：每个场景 2~4 个示例按钮（含「容易囤货 / 买多了浪费 / 规格不合适」等典型状态），点击直接套用并重画。
- Hero 的「载入示例」= 套用当前场景第一个示例 + 滚到主流程；同时复位 `vsNormal='unknown'`、`oldBatches=[]`、`useBatches=false`、`expKnown=true`。

### 8.7 空状态与默认

- 日期字段为空时自动预填：`oldExp = +150 天`、`newExp = +240 天（volume +540）`、`arrive = 今天`、`sale = 下一个 618/双11`。
- `count` 场景默认值预填即可直接看到结论（首屏 30 秒可用）。

---

## 9. UI 设计规范

### 9.1 配色（CSS 变量）

```css
--bg:#eef1f6;          /* 页面底色，拉通 */
--card:#ffffff; --border:#e4e8ef;
--text:#1c2330; --muted:#6b7280; --faint:#9aa1ac;
--accent:#e8590c; --accent-soft:#fff1e6;   /* 橙：只给主要操作 + 当前选择 */
--blue:#2563eb; --blue-soft:#eef4ff;
--bad:#d6465c;  --bad-soft:#ffeef1;        /* 红：只给风险 */
--ok:#0f9d6e;   --ok-soft:#e7f7f0;
--neutral-soft:#f4f5f7;                     /* 中性：普通解释 */
--dark:#1b2a4d; --dark2:#141f3a;            /* 深色结论卡 */
--radius:14px;
```

**配色纪律**（硬性）：

- 橙色**只**用于：主按钮、滑块 thumb、当前选中的场景/导航项、必填星号、区间条的「提前囤货段」（斜纹橙）。
- 红色**只**用于：过期浪费、规格不合适、断档、超额认领、「已手动调整」等**风险**。
- 普通解释、提示类 verdict（原来用 `--warn` 橙色）**统一降为中性色** `--neutral-soft`/`--text`，不再抢注意力。
- 深色结论卡上用半透明白（`rgba(255,255,255,.09/.55/.72)`）；浪费数值用 `#ff97a8`。

### 9.2 排版

- 字体：`-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif`
- 深色卡大标题 26px/800；卡片 h2 16px/700；正文 13px；小字 12px；明细 `.detail` 12px 浅色 `--faint`
- 数字统一 `font-variant-numeric: tabular-nums`

### 9.3 布局与响应式

- 容器 `.wrap{max-width:1200px}`、`.page-lean{max-width:900px}`（单栏区块居中收窄）
- 主流程 `.split{display:grid; gap:20px}`；**≥1020px**：`grid-template-columns: minmax(0,1fr) 420px`，右栏 `position:sticky; top:66px; max-height:calc(100vh − 82px); overflow-y:auto`
- 顶栏 `.topbar{position:sticky; top:0; backdrop-filter:blur(8px)}`
- 断点：`≤620px` 指标瓦片堆叠、预售双栏堆叠、顶栏操作按钮隐藏、Hero 按钮纵排；`≤520px` 场景按钮纵排
- **禁止框嵌框**：`.box / .hint / .sub-grid / .presetbar` 全部**扁平化**（去底色、去边框），只用分隔线或留白分组。整个页面只保留一层白色 `.card`。

### 9.4 关键组件样式

- `.dhero`：深蓝渐变、圆角 16、`box-shadow:0 10px 30px rgba(20,31,58,.28)`、白字
- `.dtile`：`rgba(255,255,255,.09)` 底、圆角 11；`.dtile.hard .v{color:#ff97a8}`
- `.dbar .track`：`rgba(255,255,255,.16)`；`.fill` 蓝绿渐变，`.warn` 时橙红渐变
- `.rangebar`：高 16、圆角 8、底色 `#eef0f4`；`.pin` 黑色竖线 + 三角 + 标签
- `.verdict`：`good` 绿 / `bad` 红 / `warn`·`info` 中性
- `.tier`：白底 + 边框；`.t1/.t2/.t3` 的 `.idx` 分别是绿/蓝/红底
- `.q`：15px 圆形问号；深色卡上覆写为半透明白
- `.ro`：只读值框（灰底、加粗、tabular-nums）

---

## 10. 文案规范

### 10.1 语气原则

1. **不给断语**：不说「建议买 N 套」「刚好合适」，说「撑到大促至少 N 套」「落在这段需要价格优势支持」。
2. **区分「提前占用」与「浪费」**：前者永远是「占钱占地方，但不算亏」，后者才是「硬损失」。
3. **承认不确定性**：效期未知时所有结论加「（效期按假设 180 天估算）」，绝不断言「不会过期」。
4. **解释下沉**：首屏只留关键词（`vSub`），完整长解释（`vTxt` + `note`）沉到明细区。
5. **数字带单位与参照**：volume 场景一律「1200 ml（≈2.4 瓶）」，小数量用分数（1/2 瓶）。

### 10.2 推荐行 `recLine`

| 情况 | 文案 |
|---|---|
| none | **保守结论：这次可以先不买**（现有量够用到下次大促） |
| late | **本单撑不到大促：它赶不上大促前的缺口** |
| unfit | **不建议按这套买**（1 套就超出到期前能吃下的 X） |
| limited | **效期内最多买到 X（N 套）**（撑不到大促的部分，之后再补） |
| fit | **撑到大促 N 套 · 提前囤货 N+1 ~ M 套 · 效期上限 M 套** |

### 10.3 大标题 `vHead` 决策树

```
kind==='none'      → 这次可以不买
kind==='late'      → 本单赶不上大促
kind==='unfit'     → 规格不适合，别按这套买
kind==='limited'   → 效期内最多买 {maxSetsNoWaste} 套
planBand==='empty' → 先填「打算买几套」
planBand==='over'  → 会囤过头
planBand==='short' → 买少了，会断档
planBand==='just'  → 正好撑到大促
planBand==='ahead' → vsNormal==='lower' ? 可以提前囤
                     : vsNormal==='unknown' ? 想提前囤？先比价
                     : 别提前囤
```

### 10.4 副行 `vSub`（一行关键词）

| 分支 | 文案 |
|---|---|
| none（有计划） | 家里存货已够用，买的 N 套要压到大促之后 |
| none（无计划） | 家里存货能撑到下次大促（约 X 天） |
| late | 到货太晚，大促前断档约 N 天 |
| unfit | 连 1 套（X）都吃不完，建议换小包装或拼单 |
| limited | 最多 N 套不浪费 · 缺口大促后再补 |
| empty | 填上「打算买几套」，立刻出结论 |
| over | X（¥Y）在效期内用不完 |
| short | 至少 N 套才撑到大促，否则断档约 X 天 |
| just | 最保守的一档：不多占钱、不多占地方 |
| ahead/lower | 比下限多 N 套 · 提前囤约 X · 上限 M 套 |
| ahead/unknown | 多囤需要价格优势支持：先确认比平时便宜多少 |
| ahead/higher | 这次不比平时便宜，建议只买 N 套 |

### 10.5 长解释 `vTxt` 模板（关键分支）

- **ahead / lower**：`属于提前囤货，但有价格优势支持：这次买 N 套，比「撑到大促」的下限多 X 套，相当于提前囤约 T 的量，多占用 ¥A（按年化 3% 的机会成本约 ¥B ≈ 货价的 P%）。既然这次单价确实更低，多囤这一段是划算的——只要别超过效期上限 M 套。`
- **ahead / unknown**：`这一段属于提前囤货，需要价格优势来支持：…建议先确认这次到手单价比平时低多少——只要低过约 P%，多囤才划算；否则应停在下限 N 套。`
- **ahead / higher**：`属于提前囤货，但这次价格并不更低：…既然不比平时便宜，这段多买的货只是提前占用了资金和空间，并不会更省——建议按「撑到大促」的下限买 N 套。`
- **over**：`会囤过头：计划买 X 里有 Y（¥Z）在效期内用不完。每单位实际成本从 ¥a 升到 ¥b。效期上限是 M 套（量）。`
- **short**：`买少了：现有 + 本次大约只够用 X 天，到下次大促前会断档约 N 天（约缺 Y）。撑到大促至少要 M 套。`
- **unfit**：`这个套装规格不适合你：在旧货让位前你最多只能用掉 X，连 1 套（量）都吃不完，买回来必然有一部分要用过期。建议换小包装，或者和朋友拼单分掉——别把它当成「买 1 套」的建议量。`
- **late**：`这一单赶不上大促：…而大促前会断档约 N 天（约缺 X）。也就是说，本单解决不了大促前的缺口——它只能为下一轮补货做准备。想在大促前不断档，得先用少量现货补一次。`
- **limited**：`受效期与到货时间限制，这批新货在大促前最多只能补上 X，还不够缺口的 Y；最多买 M 套不会用过期。缺口建议大促后再补一次，或换更耐放的渠道。`

每个分支都配一句 `note`（一句取舍提示）。

---

## 11. 技术约束

| 约束 | 要求 |
|---|---|
| 技术栈 | **纯 vanilla JS + HTML + CSS，零依赖、零构建**。单个 `.html` 文件即可运行。 |
| 网络 | **零网络请求**。不 fetch、不引 CDN、不接大模型。 |
| 数据 | 全部本机计算；仅用 `localStorage` 保存（可被隐私模式禁用，需 try/catch 降级）。 |
| 存储 key | `stockpile-demo-v1` |
| 运行环境 | 现代浏览器（Chrome/Safari/Edge）；必须支持手机浏览器。 |
| 无障碍 | 问号可键盘聚焦（`tabindex`+`role`+`aria-label`）；滑块带 `aria-label`。 |
| 性能 | 输入变更即时重算（无按钮）；`simulate()` 有 `guard` 上限防死循环；改批次不重画整区以避免失焦。 |
| 兼容 | 用 `-webkit-` / `-moz-` 双写滑块样式；`details/summary` 原生折叠。 |

---

## 12. 验收标准（可逐条勾选）

> 复刻完成后，以下每条都应能通过。★ = 曾经的 bug，必须重点验证。

### 12.1 算法与口径

- [ ] ★ 大促剩量与到期剩量**自洽**：`leftAtEnd ≤ leftAtSale` 恒成立（不会出现「到期剩更多」）。
- [ ] ★ 推荐量在「套」层对齐，`ceil`/`floor` 不矛盾。
- [ ] ★ 「1 件用 30 天 vs 大促 31 天后」→ 不误判「不用买」（容差 `1e-6`）。
- [ ] ★ 断档天数 = 缺口量 ÷ 日消耗量（不是件数当天数）。
- [ ] ★ 未到货的货**不参与**到货前的消耗（到货感知）。
- [ ] ★ 赠品同款**只进分母**、非同类**只进分子**，且「实际付款」恒定单独显示。
- [ ] `unfit` 分支：连 1 套都吃不下时，绝不输出「建议买 1 套」。
- [ ] `late` 分支：到货晚于大促时，直说「本单解决不了大促前的缺口」。
- [ ] `limited` 分支：受效期限制时给出「最多 N 套」并说明需二次补货。
- [ ] 效期未知：所有结论带「估算」标注，不出现「保证不会过期」。
- [ ] 多批旧货：FIFO 按批处理，`remainingAt(D)` 与 `waste` 同规则。

### 12.2 口径统一（跨模块）

- [ ] ★ 「套装比价」与主流程结论一致：同一候选在主流程「可用」时，比价区**不得**判为「浪费」。
- [ ] ★ 「预售 vs 现货」用旧货**真实到期日**（不是「用完日」）。
- [ ] 三个辅助工具都从 `LAST` 取数，切换场景/改主流程输入后同步更新。

### 12.3 交互

- [ ] ★ 点「＋加一批旧货」未填数量时，**库存不变 0**（草稿态）；确认后库存 = 各批合计。
- [ ] 接管后库存框只读；删完批次自动退回单一库存。
- [ ] 滑块拖到最右再拖回，**不会** 1↔2000 跳变（已移除 grow）。
- [ ] 滑块超 cap 时钉最右、右刻度变橙 `20+套`；数字框键入 25 可突破 cap。
- [ ] 滚轮：聚焦时可调；未聚焦时仅在右侧箭头区生效；否则不抢页面滚动。
- [ ] 问号：悬停/点击/键盘均可展开；触屏 tap 不闪开即关；点空白/滚动收起；summary 内点击不折叠。
- [ ] 数据保鲜：≥1 天提示确认库存；过去的大促日期自动顺延；过去的到期/到货日列出请重选。
- [ ] 刷新页面数据仍在（localStorage）；清空重填可用。

### 12.4 UI

- [ ] 单页锚点导航，点击平滑滚动，高亮跟随（含 hash 直达场景）。
- [ ] 首屏 Hero 全幅拉通，无白色大框。
- [ ] 桌面左右分屏**顶对齐**，右栏 sticky 吸附，两栏不下沉错位。
- [ ] 结论卡为**深色白字**，大标题 26px，关键词副行，两块指标瓦片 + 进度条。
- [ ] 三层推荐以**区间条**呈现（绿/橙斜纹/红 + 黑色游标 + 图例）。
- [ ] 计算明细**默认展开**、浅色小字。
- [ ] 页面**无框嵌框**；橙色不滥用；风险才用红。
- [ ] 390px 宽度下无横向溢出，布局正常。
- [ ] 「资金机会成本」折叠**已移除**。

### 12.5 测试

- [ ] 三个 Node 测试套件全部通过（见 §13）。
- [ ] 无头 Chrome 探针 `probe10.html` 20/20 通过。

---

## 13. 测试与验证策略

### 13.1 单元/回归测试（Node + DOM 桩）

**做法**：Node 里用轻量 DOM 桩（`mkEl` 造元素、`document.getElementById` 惰性返回、`localStorage` 内存实现、`IntersectionObserver` 空实现），把页面 `<script>` 内容 `eval` 进来，再通过 `global.__A` 暴露内部函数做不变量断言。**不引入 jsdom，零依赖。**

```
node test/t6.js     # 787 条 —— 三层结构/价格优势/赠品口径/到货晚/效期未知/多批旧货/参数网格不变量
node test/t7.js     #  82 条 —— 多批草稿接管/滑块/滚轮问号/比价预售同口径/三场景烟雾
node test/t5.js     # 历史用例（部分断言已被 t6 取代，保留作参考）
```

**关键不变量**：

- `leftAtEnd ≤ leftAtSale`
- 用量守恒：`used + waste = 总投入量`
- `recQty == recSets × setAmount`
- 拼单：各人应付之和 = 认领量 × 均价；应付合计 ≤ 整单价
- 加批次后（草稿态）结论与库存不变
- 滑块 `min/max/step/value` 与 cap 一致；预填超 cap 时滑块让位

### 13.2 真机交互探针（无头 Chrome）

`test/probe8/9/10.html`：外层页面用 `<iframe>` 加载成品，等渲染完成后在 iframe 内模拟点击/输入，断言 DOM 变化。

- `probe10.html` 覆盖：锚点导航滚动、深色结论卡存在、区间条渲染、「加批次→草稿→确认」流程，**20/20 通过**。

> **无头 Chrome 注意**：
> - `--window-size` 有 **500px 最小宽度**限制，测 390px 移动端要用 `<iframe width=390>` 包一层再截图。
> - 新版无头 Chrome 退出时可能挂起（文件仍会写出），用 `background + kill` 模式更稳。

### 13.3 视觉验证

桌面（1240/1280px）与移动（390/430px）各截一张，核对：Hero、分屏对齐、深色卡、区间条、「会囤过头」红态、预售双栏。

---

## 14. 已知取舍与后续可扩展

**取舍**：

- 单文件零依赖 → 牺牲了组件复用与工程化，换来「双击即用、可离线、易分发」。
- 不做商品库 → 用户需自己填，但换来了零维护成本与隐私。
- 不给断语 → 学习曲线略高，但避免误导。

**可扩展方向**（未实现，供参考）：

- 多商品清单（同时算多个 SKU）
- 导出/分享结论图（纯前端 canvas）
- 历史决策记录与复购提醒
- 更细的效期模型（开封后效期、温度敏感）

---

## 15. 附录：给复刻 agent 的实施顺序建议

> 建议按此顺序实现，每步都能独立验证，避免一次性堆完再调试。

1. **基础工具 + 数据模型**（`$ / num / fmt / esc / dayDiff / nextSale / DEFAULT_STATE`）
2. **`simulate()` 引擎** —— 先写它，并用「旧货 6 份 + 新货 20 份」手算验证 `used/waste/end/remainingAt`。
3. **`derive()`** —— 三场景归一化，先跑通 count。
4. **`renderInputs()` + `syncStateFromInputs()`** —— 先做 count 场景全链路（能填能算）。
5. **`calcCore()` 的指标与 `kind` 判定** —— 先把 `leftAtSale/leftAtEnd/maxSetsNoWaste/setsBySale` 算对。
6. **结论面板**（深色卡 + 区间条 + 明细）—— 对照 §6.2、§6.4、§10 实现五种 `kind` × 六种 `planBand` 的文案。
7. **volume / pack 场景** —— 补 `rateMode`、`post` 多行、赠品口径、`bottleLabel` 分数表达。
8. **辅助三工具** —— 从 `LAST` 取数，保证同口径（★重点回归）。
9. **交互规格** —— 问号 tooltip、滑块 + cap、滚轮、多批旧货两段式、数据保鲜。
10. **UI 打磨** —— 配色纪律、去框嵌框、响应式、Hero、sticky 分屏。
11. **测试** —— 按 §12 验收清单逐条验证，重点复现 §13.1 的全部 ★ 不变量。

---

*本文档为 v1.0 定稿，对应成品 `index.html`（约 1818 行单文件）。需求演变过程见 `docs/需求演变史.md`。*
