/* ============================================================
 *  game.js — 核心状态机 / 玩家 / 地图 / 存档 / 元进度
 * ============================================================ */
window.Game = (function () {
  "use strict";
  const D = window.GameData;

  /* ---------------- 工具函数 ---------------- */
  function rand(n) { return Math.floor(Math.random() * n); }
  function pick(arr) { return arr[rand(arr.length)]; }
  function chance(p) { return Math.random() < p; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* 按权重(稀有度)随机抽取，受幸运加成 */
  function pickByRarity(pool, luck) {
    luck = luck || 0;
    // 稀有度越高权重越低；luck 提升高稀有度权重
    const weighted = [];
    pool.forEach((it) => {
      const r = it.rarity || 1;
      let w = [0, 100, 45, 18, 6][r] || 5;
      w += w * luck * (r - 1); // luck 放大高阶
      weighted.push({ it, w });
    });
    const total = weighted.reduce((s, x) => s + x.w, 0);
    let roll = Math.random() * total;
    for (const x of weighted) { roll -= x.w; if (roll <= 0) return x.it; }
    return pool[0].it;
  }

  /* ---------------- 元进度（持久化） ---------------- */
  const META_KEY = "ynwd_meta_v1";
  const SAVE_KEY = "ynwd_save_v1";

  function loadMeta() {
    try {
      const m = JSON.parse(localStorage.getItem(META_KEY));
      if (m) return Object.assign({ karma: 0, upgrades: {}, runs: 0, bestRegion: 0, ascended: 0 }, m);
    } catch (e) {}
    return { karma: 0, upgrades: {}, runs: 0, bestRegion: 0, ascended: 0 };
  }
  function saveMeta() { localStorage.setItem(META_KEY, JSON.stringify(state.meta)); }

  function metaModSum() {
    // 汇总所有已购元进度的加成
    const sum = { hpMul: 0, atkMul: 0, qiMul: 0, startGold: 0, luck: 0,
                  startPills: [], reroll: false, startTech: false };
    D.META_UPGRADES.forEach((u) => {
      const lv = state.meta.upgrades[u.id] || 0;
      if (!lv) return;
      const m = u.mod;
      if (m.hpMul) sum.hpMul += m.hpMul * lv;
      if (m.atkMul) sum.atkMul += m.atkMul * lv;
      if (m.qiMul) sum.qiMul += m.qiMul * lv;
      if (m.startGold) sum.startGold += m.startGold * lv;
      if (m.luck) sum.luck += m.luck * lv;
      if (m.startPill) for (let i = 0; i < lv; i++) sum.startPills.push(m.startPill);
      if (m.reroll) sum.reroll = true;
      if (m.startTech) sum.startTech = true;
    });
    return sum;
  }

  /* ---------------- 全局状态 ---------------- */
  const state = {
    meta: loadMeta(),
    run: null,      // 当前 run（局内进度）
    screen: "title",// title / meta / create / map / combat / event / shop / reward / gameover / win
  };

  /* ---------------- 玩家属性计算 ---------------- */
  function recalcStats(p) {
    const realm = D.REALMS[p.realmIdx];
    const layerMul = 1 + p.layer * 0.08; // 每层 +8%
    let hp = realm.hp * layerMul;
    let atk = realm.atk * layerMul;
    let def = realm.def * layerMul;
    let qi = realm.qi * layerMul;

    const mods = collectMods(p);
    hp *= mods.hpMul; atk *= mods.atkMul; def *= mods.defMul; qi *= mods.qiMul;
    hp *= mods.allMul; atk *= mods.allMul; def *= mods.allMul; qi *= mods.allMul;

    p.maxHp = Math.round(hp * (1 + (p.permHpUp || 0)));
    p.maxQi = Math.round(qi);
    p.atk = Math.round(atk * (1 + (p.permAtkUp || 0)));
    p.def = Math.round(def);
    p.crit = clamp(0.05 + mods.critAdd, 0, 0.95);
    p.critDmg = 1.5 + mods.critDmg;
    p.pierce = clamp(mods.pierce, 0, 0.9);
    p.dmgReduce = clamp(mods.dmgReduce, 0, 0.8);
    p.dmgUp = mods.dmgUp;
    p.regen = mods.regen;
    p.qiRegen = mods.qiRegen;
    p.costMul = mods.costMul;
    p.goldMul = mods.goldMul;
    p.pillMul = mods.pillMul;
    p.lifestealBase = 0;
    p._mods = mods;

    if (p.hp === undefined) p.hp = p.maxHp;
    if (p.qi === undefined) p.qi = p.maxQi;
    p.hp = clamp(p.hp, 0, p.maxHp);
    p.qi = clamp(p.qi, 0, p.maxQi);
  }

  function collectMods(p) {
    const m = { hpMul: 1, atkMul: 1, defMul: 1, qiMul: 1, allMul: 1,
      critAdd: 0, critDmg: 0, pierce: 0, dmgReduce: 0, dmgUp: 0,
      regen: 0, qiRegen: 0, costMul: 1, goldMul: 1, pillMul: 1,
      dropLuck: 0, speed: 0, extraTurn: 0, firstFree: false, swordIntent: false };

    // 灵根
    const root = p.root;
    if (root) applyMods(m, root.mods);
    // 法宝
    p.artifacts.forEach((a) => applyMods(m, a.mods));
    // 永久心魔类加成（事件）
    if (p.permMods) applyMods(m, p.permMods);
    // 元进度
    const meta = metaModSum();
    m.hpMul += meta.hpMul; m.atkMul += meta.atkMul; m.qiMul += meta.qiMul;
    m.dropLuck += meta.luck;
    return m;
  }
  function applyMods(target, src) {
    if (!src) return;
    for (const k in src) {
      if (k === "swordIntent" || k === "firstFree") { target[k] = target[k] || src[k]; continue; }
      if (k === "speed" || k === "extraTurn") { target[k] = (target[k] || 0) + src[k]; continue; }
      if (typeof src[k] === "number") {
        if (k.endsWith("Mul")) target[k] = (target[k] || 1) * src[k];
        else target[k] = (target[k] || 0) + src[k];
      }
    }
  }

  /* ---------------- 新 Run ---------------- */
  function rollRoot(allowRare) {
    const pool = D.SPIRIT_ROOTS.filter((r) => allowRare || !r.rare);
    // 普通灵根权重高，稀有灵根低
    const weighted = pool.map((r) => ({ r, w: r.rare ? 8 : 30 }));
    const total = weighted.reduce((s, x) => s + x.w, 0);
    let roll = Math.random() * total;
    for (const x of weighted) { roll -= x.w; if (roll <= 0) return x.r; }
    return pool[0];
  }

  function startRun(root) {
    _checkpoint = null; // 新局清除上一局快照
    const meta = metaModSum();
    const p = {
      root: root,
      realmIdx: 0, layer: 0,
      exp: 0, expMax: D.REALMS[0].expBase,
      hp: undefined, qi: undefined,
      permHpUp: 0, permAtkUp: 0, permMods: null,
      techniques: [], artifacts: [], pills: [],
      gold: 50 + meta.startGold,
      swordIntentStack: 0,
    };
    // 起始功法
    p.techniques.push(cloneTech(D.TECHNIQUES.find((t) => t.id === "jianjue")));
    p.techniques.push(cloneTech(D.TECHNIQUES.find((t) => t.id === "huti")));
    if (meta.startTech) {
      const owned = new Set(p.techniques.map((t) => t.id));
      const pool = D.TECHNIQUES.filter((t) => !owned.has(t.id));
      if (pool.length) p.techniques.push(cloneTech(pickByRarity(pool, 0)));
    }
    // 起始丹药
    meta.startPills.forEach((id) => {
      const base = D.PILLS.find((x) => x.id === id);
      if (base) p.pills.push(Object.assign({ uid: uid() }, base));
    });
    p.pills.push(Object.assign({ uid: uid() }, D.PILLS.find((x) => x.id === "huixue")));

    recalcStats(p);
    p.hp = p.maxHp; p.qi = p.maxQi;

    state.run = {
      player: p,
      regionIdx: 0,
      map: null,
      node: -1,        // 当前节点索引
      log: [],
      seedShop: null,
      pendingReward: null,
      combat: null,
      curEvent: null,
    };
    genRegionMap();
    state.meta.runs++;
    saveMeta();
    state.screen = "map";
  }

  function cloneTech(t) { return Object.assign({ uid: uid() }, t); }

  /* ---------------- 地图生成（分支路线：每层 3 选 1） ---------------- */
  const CHOICE_LAYERS = 9; // 每个秘境的抉择层数（之后接 boss 层）

  function randNodeType() {
    const r = Math.random();
    if (r < 0.34) return "battle";
    if (r < 0.58) return "event";
    if (r < 0.70) return "elite";
    if (r < 0.85) return "shop";
    return "rest";
  }
  function genLayerNodes() {
    // 始终保底一个「历练」，让玩家可主动刷战斗提升修为；另两个尽量不同
    const types = ["battle"];
    let tries = 0;
    while (types.length < 3 && tries < 40) {
      tries++;
      const t = randNodeType();
      if (!types.includes(t)) types.push(t);
    }
    while (types.length < 3) types.push("event");
    // 洗牌
    for (let i = types.length - 1; i > 0; i--) { const j = rand(i + 1); [types[i], types[j]] = [types[j], types[i]]; }
    return types.map((t) => ({ type: t }));
  }

  function genRegionMap() {
    const run = state.run;
    const region = D.REGIONS[run.regionIdx];
    const layers = [];
    for (let l = 0; l < CHOICE_LAYERS; l++) {
      layers.push({ nodes: genLayerNodes(), chosen: -1 });
    }
    layers.push({ nodes: [{ type: "boss" }], chosen: -1 }); // 终焉：首领层
    run.layers = layers;
    run.layerIdx = 0;
    run.curNode = null;
    // 兼容旧字段
    run.map = null; run.node = -1;
    pushLog(`【${region.name}】${region.desc}`, "region");
  }

  /* ---------------- 选择路线 / 进入节点 ---------------- */
  function chooseNode(choiceIdx) {
    const run = state.run;
    const layer = run.layers[run.layerIdx];
    if (!layer || layer.chosen >= 0) return;
    const node = layer.nodes[choiceIdx];
    if (!node) return;
    layer.chosen = choiceIdx;
    run.curNode = node;
    const region = D.REGIONS[run.regionIdx];

    if (node.type === "battle") {
      startCombat(spawnEnemy(region.tier, false));
    } else if (node.type === "elite") {
      startCombat(spawnEnemy(region.tier, true));
    } else if (node.type === "boss") {
      const boss = D.BOSSES.find((b) => b.id === region.boss);
      startCombat(buildEnemy(boss, true), boss.intro);
    } else if (node.type === "rest") {
      doRest();
    } else if (node.type === "event") {
      startEvent();
    } else if (node.type === "shop") {
      openShop();
    }
  }

  function advanceLayer() {
    const run = state.run;
    run.layerIdx++;
    run.curNode = null;
    state.screen = "map";
  }

  /* ---------------- 敌人生成 ---------------- */
  function spawnEnemy(tier, elite) {
    const pool = D.ENEMIES.filter((e) => e.tier <= tier && e.tier >= Math.max(0, tier - 1));
    const base = pick(pool.length ? pool : D.ENEMIES);
    return buildEnemy(base, false, elite);
  }
  function buildEnemy(base, isBoss, elite) {
    const run = state.run;
    const region = D.REGIONS[run.regionIdx];
    // 关键：敌人强度由【区域】固定，而非随玩家境界水涨船高，
    // 这样玩家通过升境、攒功法法宝才能真正变强、打过更高区域。
    const refRealmIdx = Math.min(region.tier, D.REALMS.length - 1);
    const realm = D.REALMS[refRealmIdx];
    const depthScale = 1 + (run.layerIdx || 0) * 0.02; // 区域内越深略强
    // 玩家境界领先本区域越多，敌人略增强（应对极端越级）
    const progressScale = 1 + Math.max(0, run.player.realmIdx - region.tier) * 0.20;
    // 按区域 tier 递增的绝对难度（区域0为1.0，越深越强），抵消玩家装备/功法的滚雪球
    const tierPower = 1 + region.tier * 0.17;
    const eliteMul = elite ? 1.7 : 1;
    const bossAtkTone = isBoss ? 0.85 : 1; // Boss 攻击轻度收敛，避免秒杀
    const e = {
      id: base.id, name: (elite ? "精英·" : "") + base.name, isBoss: !!isBoss,
      maxHp: Math.round(realm.hp * base.hpMul * depthScale * eliteMul * progressScale * tierPower * (isBoss ? 1 : 0.85)),
      atk: Math.round(realm.atk * base.atkMul * depthScale * (elite ? 1.2 : 1) * bossAtkTone * progressScale * tierPower),
      def: Math.round(realm.def * base.defMul * depthScale * tierPower),
      ai: base.ai.slice(),
      gold: Math.round(base.gold * (1 + region.tier * 0.3) * (elite ? 2 : 1) * (isBoss ? 2 : 1)),
      exp: base.exp * (elite ? 2 : 1) * (isBoss ? 2.5 : 1),
      status: {},
      aiIdx: 0,
      intro: base.intro,
    };
    e.hp = e.maxHp;
    return e;
  }

  /* ---------------- 战斗启动（交由 combat.js） ---------------- */
  function startCombat(enemy, intro) {
    state.run.combat = window.Combat.create(state.run.player, enemy, intro);
    state.screen = "combat";
  }

  /* ---------------- 休整 ---------------- */
  function doRest() {
    const p = state.run.player;
    state.run.restChoice = true;
    state.screen = "rest";
  }
  function applyRest(choice) {
    const p = state.run.player;
    if (choice === "heal") {
      p.hp = clamp(p.hp + p.maxHp * 0.6, 0, p.maxHp);
      p.qi = p.maxQi;
      pushLog("你寻一处洞天打坐疗伤，恢复了大量气血与灵力。", "good");
    } else if (choice === "cultivate") {
      gainExp(D.REALMS[p.realmIdx].expBase * 0.35);
      pushLog("你潜心修炼，修为大涨。", "good");
    } else if (choice === "refine") {
      // 强化随机功法
      if (p.techniques.length) {
        const t = pick(p.techniques);
        t.power = (t.power || 0) * 1.25;
        t._refined = (t._refined || 0) + 1;
        pushLog(`你参悟功法，【${t.name}】威力提升！`, "good");
      } else {
        p.hp = p.maxHp;
        pushLog("你无功法可炼，遂调息恢复。", "info");
      }
    }
    finishNode();
  }

  /* ---------------- 事件 ---------------- */
  function startEvent() {
    state.run.curEvent = pick(D.EVENTS);
    state.screen = "event";
  }
  function resolveEvent(optIdx) {
    const run = state.run;
    const ev = run.curEvent;
    const opt = ev.options[optIdx];
    const p = run.player;
    const eff = opt.effect;
    let resultText = opt.result;

    if (eff.heal) p.hp = clamp(p.hp + p.maxHp * eff.heal, 0, p.maxHp);
    if (eff.restoreQi) p.qi = clamp(p.qi + p.maxQi * eff.restoreQi, 0, p.maxQi);
    if (eff.hpPct) p.hp = clamp(p.hp + p.maxHp * eff.hpPct, 1, p.maxHp);
    if (eff.qiPct) p.qi = clamp(p.qi + p.maxQi * eff.qiPct, 0, p.maxQi);
    if (eff.gold) { p.gold += eff.gold; }
    if (eff.exp) gainExp(D.REALMS[p.realmIdx].expBase * eff.exp);
    if (eff.maxHpUp) { p.permHpUp = (p.permHpUp || 0) + eff.maxHpUp; recalcStats(p); }
    if (eff.maxHpDown) { p.permHpUp = (p.permHpUp || 0) - eff.maxHpDown; recalcStats(p); }
    if (eff.atkBuffPerm) { p.permAtkUp = (p.permAtkUp || 0) + eff.atkBuffPerm; recalcStats(p); }
    if (eff.cleanse) { /* 战斗外无负面，给点修为 */ gainExp(D.REALMS[p.realmIdx].expBase * 0.05); }

    if (eff.reward === "artifact") grantArtifact();
    if (eff.reward === "technique") grantTechnique();
    if (eff.reward === "pill") for (let i = 0; i < (eff.count || 1); i++) grantPill();

    if (eff.gamble) {
      const res = doGamble(eff.gamble);
      resultText = res;
    }

    if (eff.shop) { openShop(); return; }
    if (eff.elite) { startCombat(spawnEnemy(D.REGIONS[run.regionIdx].tier, true)); return; }

    run.eventResult = resultText;
    recalcStats(p);
    // 不立即 finishNode，让 UI 显示结果后点击继续
  }
  function doGamble(kind) {
    const p = state.run.player;
    if (kind === "spring") {
      if (chance(0.55)) { p.permHpUp = (p.permHpUp || 0) + 0.12; recalcStats(p); return "灵气暴涌，你成功炼化，气血上限大幅提升！"; }
      else { p.hp = clamp(p.hp - p.maxHp * 0.3, 1, p.maxHp); return "灵气过于狂暴，你受到反噬，损失气血。"; }
    }
    if (kind === "ruins") {
      const r = Math.random();
      if (r < 0.4) { grantArtifact(); return "你避开禁制，于密室中得到一件法宝！"; }
      else if (r < 0.7) { grantTechnique(); return "你寻得一卷功法秘籍！"; }
      else { p.hp = clamp(p.hp - p.maxHp * 0.35, 1, p.maxHp); p.gold += 30; return "禁制突然爆发，你身受重伤，仅抢出一些灵石。"; }
    }
    return "";
  }

  /* ---------------- 奖励发放 ---------------- */
  function grantArtifact() {
    const luck = state.run.player._mods.dropLuck;
    const a = pickByRarity(D.ARTIFACTS, luck);
    state.run.player.artifacts.push(Object.assign({ uid: uid() }, a));
    recalcStats(state.run.player);
    pushLog(`获得法宝【${a.name}】（${D.RARITY_NAME[a.rarity]}）`, "loot");
  }
  // 从「玩家尚未习得」的功法中按稀有度抽取；全部习得则返回 null
  function pickNewTechnique(luck) {
    const owned = new Set(state.run.player.techniques.map((t) => t.id));
    const pool = D.TECHNIQUES.filter((t) => !owned.has(t.id));
    if (!pool.length) return null;
    return pickByRarity(pool, luck || 0);
  }
  // 抽取 n 门互不相同、且玩家未习得的功法（用于坊市）
  function pickDistinctNewTechniques(n, luck) {
    const owned = new Set(state.run.player.techniques.map((t) => t.id));
    const pool = D.TECHNIQUES.filter((t) => !owned.has(t.id));
    const result = [];
    while (result.length < n && pool.length) {
      const t = pickByRarity(pool, luck || 0);
      result.push(t);
      pool.splice(pool.indexOf(t), 1);
    }
    return result;
  }

  function grantTechnique() {
    const p = state.run.player;
    const t = pickNewTechnique(p._mods.dropLuck);
    if (!t) {
      // 已习得全部功法：此卷机缘转化为一枚丹药，不再重复
      grantPill();
      pushLog("功法已臻大成，此卷机缘化作一枚丹药。", "loot");
      return;
    }
    p.techniques.push(cloneTech(t));
    pushLog(`习得功法【${t.name}】（${D.RARITY_NAME[t.rarity]}）`, "loot");
  }
  function grantPill() {
    const luck = state.run.player._mods.dropLuck;
    const base = pickByRarity(D.PILLS, luck);
    state.run.player.pills.push(Object.assign({ uid: uid() }, base));
    pushLog(`获得丹药【${base.name}】`, "loot");
  }

  /* ---------------- 商店 ---------------- */
  function openShop() {
    const run = state.run;
    const luck = run.player._mods.dropLuck;
    const goods = [];
    // 功法：互不相同且玩家未习得；不足 3 门则用丹药补足摊位
    const techs = pickDistinctNewTechniques(3, luck);
    techs.forEach((t) => goods.push({ kind: "technique", item: t, price: priceOf("technique", t.rarity), gid: uid() }));
    for (let i = 0; i < 2; i++) {
      const a = pickByRarity(D.ARTIFACTS, luck);
      goods.push({ kind: "artifact", item: a, price: priceOf("artifact", a.rarity), gid: uid() });
    }
    const pillCount = 3 + (3 - techs.length); // 功法摊位空缺由丹药顶上
    for (let i = 0; i < pillCount; i++) {
      const pl = pickByRarity(D.PILLS, luck);
      goods.push({ kind: "pill", item: pl, price: priceOf("pill", pl.rarity), gid: uid() });
    }
    run.shop = { goods, healPrice: 40 };
    state.screen = "shop";
  }
  function priceOf(kind, rarity) {
    const base = D.SHOP_TIERS[kind][rarity] || 50;
    return Math.round(base * (0.85 + Math.random() * 0.3));
  }
  function buy(gid) {
    const run = state.run, p = run.player;
    const g = run.shop.goods.find((x) => x.gid === gid);
    if (!g || g.sold) return { ok: false, msg: "已售出" };
    if (p.gold < g.price) return { ok: false, msg: "灵石不足" };
    p.gold -= g.price;
    g.sold = true;
    if (g.kind === "technique") p.techniques.push(cloneTech(g.item));
    else if (g.kind === "artifact") { p.artifacts.push(Object.assign({ uid: uid() }, g.item)); recalcStats(p); }
    else if (g.kind === "pill") p.pills.push(Object.assign({ uid: uid() }, g.item));
    return { ok: true, msg: `购得【${g.item.name}】` };
  }
  function buyHeal() {
    const run = state.run, p = run.player;
    if (p.gold < run.shop.healPrice) return { ok: false, msg: "灵石不足" };
    p.gold -= run.shop.healPrice;
    p.hp = p.maxHp; p.qi = p.maxQi;
    run.shop.healPrice = Math.round(run.shop.healPrice * 1.6);
    return { ok: true, msg: "气血灵力已完全恢复" };
  }

  /* ---------------- 修为 / 突破 ---------------- */
  const EXP_RATE = 5.5; // 全局修为倍率：使认真历练者每区域约提升一个大境界，与区域难度同步
  function gainExp(amount) {
    const p = state.run.player;
    p.exp += Math.round(amount * EXP_RATE);
    let broke = false;
    while (p.exp >= p.expMax && !(p.realmIdx >= D.REALMS.length - 1 && p.layer >= D.REALMS[p.realmIdx].layers - 1)) {
      p.exp -= p.expMax;
      breakthrough();
      broke = true;
    }
    if (p.realmIdx >= D.REALMS.length - 1) p.exp = Math.min(p.exp, p.expMax);
    return broke;
  }
  function breakthrough() {
    const p = state.run.player;
    const realm = D.REALMS[p.realmIdx];
    if (p.layer < realm.layers - 1) {
      p.layer++;
      pushLog(`突破！修为精进，${realm.name}第${cn(p.layer + 1)}层！`, "breakthrough");
    } else if (p.realmIdx < D.REALMS.length - 1) {
      p.realmIdx++;
      p.layer = 0;
      pushLog(`✦ 境界突破！踏入【${D.REALMS[p.realmIdx].name}】之境！✦`, "breakthrough");
    }
    p.expMax = D.REALMS[p.realmIdx].expBase + Math.round(D.REALMS[p.realmIdx].expBase * p.layer * 0.15);
    const hpRatio = p.hp / p.maxHp;
    recalcStats(p);
    p.hp = Math.round(p.maxHp * Math.max(hpRatio, 0.5)); // 突破回点血
    p.qi = p.maxQi;
  }
  function cn(n) { return "一二三四五六七八九十".charAt(n - 1) || n; }

  /* ---------------- 战斗结算回调 ---------------- */
  function onCombatEnd(victory) {
    const run = state.run;
    const p = run.player;
    const c = run.combat;
    if (!victory) { gameOver(); return; }

    const enemy = c.enemy;
    const goldGain = Math.round(enemy.gold * (p.goldMul || 1));
    p.gold += goldGain;
    const expGain = D.REALMS[p.realmIdx].expBase * enemy.exp;
    const broke = gainExp(expGain);
    pushLog(`击败【${enemy.name}】！获得 ${goldGain} 灵石、修为 +${Math.round(expGain)}。`, "good");

    // 战后调息：回满灵力；非首领战额外回复部分气血，使连续历练可持续
    p.qi = p.maxQi;
    if (!enemy.isBoss) p.hp = clamp(p.hp + Math.round(p.maxHp * 0.20), 0, p.maxHp);

    // 掉落
    const drops = [];
    const node = run.curNode;
    const isBossNode = node && node.type === "boss";
    const isElite = node && node.type === "elite";
    const dropChance = enemy.isBoss ? 1 : isElite ? 0.85 : 0.4;
    if (chance(dropChance + (p._mods.dropLuck || 0))) {
      const roll = Math.random();
      if (roll < 0.45) { grantTechnique(); drops.push("technique"); }
      else if (roll < 0.8) { grantArtifact(); drops.push("artifact"); }
      else { grantPill(); drops.push("pill"); }
    }
    if (enemy.isBoss) { grantArtifact(); grantPill(); }

    run.combat = null;
    run.combatVictory = { gold: goldGain, exp: Math.round(expGain), broke, drops, boss: enemy.isBoss };

    if (isBossNode) {
      // 区域通关
      run.bossCleared = true;
    }
    state.screen = "reward";
  }

  function continueAfterReward() {
    const run = state.run;
    if (run.bossCleared) {
      run.bossCleared = false;
      run.combatVictory = null;
      advanceRegion();
    } else {
      run.combatVictory = null;
      finishNode();
    }
  }

  function advanceRegion() {
    const run = state.run;
    if (run.regionIdx >= D.REGIONS.length - 1) {
      // 通关飞升！
      winGame();
      return;
    }
    run.regionIdx++;
    state.meta.bestRegion = Math.max(state.meta.bestRegion, run.regionIdx);
    saveMeta();
    // 平定一界，气血灵力全复，再启新程
    const p = run.player;
    p.hp = p.maxHp; p.qi = p.maxQi;
    genRegionMap();
    state.screen = "map";
  }

  function finishNode() {
    const run = state.run;
    run.eventResult = null;
    run.curEvent = null;
    advanceLayer();
  }

  /* ---------------- 使用丹药（战斗外） ---------------- */
  function usePillOutOfCombat(puid) {
    const p = state.run.player;
    const idx = p.pills.findIndex((x) => x.uid === puid);
    if (idx < 0) return { ok: false };
    const pill = p.pills[idx];
    const u = pill.use;
    let msg = `服下【${pill.name}】`;
    const mul = p.pillMul || 1;
    if (u.heal) p.hp = clamp(p.hp + p.maxHp * Math.min(1, u.heal * mul), 0, p.maxHp);
    if (u.restoreQi) p.qi = clamp(p.qi + p.maxQi * Math.min(1, u.restoreQi * mul), 0, p.maxQi);
    if (u.exp) gainExp(D.REALMS[p.realmIdx].expBase * u.exp * mul);
    if (u.battleAtk || u.battleReduce || u.battleCrit) {
      return { ok: false, msg: "此丹药只能在战斗中使用。" };
    }
    p.pills.splice(idx, 1);
    return { ok: true, msg };
  }

  /* ---------------- 结束 ---------------- */
  function gameOver() {
    const run = state.run;
    const p = run.player;
    // 仙缘结算
    const realmKarma = (p.realmIdx * 9 + p.layer) * 2;
    const regionKarma = run.regionIdx * 15;
    const karma = realmKarma + regionKarma + 5;
    state.meta.karma += karma;
    run.gainedKarma = karma;
    saveMeta();
    state.screen = "gameover";
  }
  function winGame() {
    const run = state.run;
    const p = run.player;
    const karma = 200 + (p.realmIdx * 9 + p.layer) * 3;
    state.meta.karma += karma;
    state.meta.ascended++;
    run.gainedKarma = karma;
    saveMeta();
    state.screen = "win";
  }

  /* ---------------- 元进度购买 ---------------- */
  function buyMeta(id) {
    const u = D.META_UPGRADES.find((x) => x.id === id);
    if (!u) return { ok: false };
    const lv = state.meta.upgrades[id] || 0;
    if (lv >= u.max) return { ok: false, msg: "已满级" };
    const cost = Math.round(u.cost * (1 + lv * 0.5));
    if (state.meta.karma < cost) return { ok: false, msg: "仙缘不足" };
    state.meta.karma -= cost;
    state.meta.upgrades[id] = lv + 1;
    saveMeta();
    return { ok: true };
  }
  function metaCost(u) {
    const lv = state.meta.upgrades[u.id] || 0;
    return Math.round(u.cost * (1 + lv * 0.5));
  }

  /* ---------------- 日志 ---------------- */
  function pushLog(text, cls) {
    state.run.log.push({ text, cls });
    if (state.run.log.length > 200) state.run.log.shift();
  }

  /* ---------------- 存档（局内） ----------------
     只在「地图」稳定决策点生成快照，避免战斗/事件中途存档导致：
     重开节点时残血、丢失丹药、层选择卡死等问题。
     节点进行中不更新快照；中断后从该节点之前的干净地图状态恢复。 */
  let _checkpoint = null;
  function checkpointRun() {
    if (!state.run) { _checkpoint = null; return; }
    try {
      const slim = Object.assign({}, state.run, { combat: null });
      slim._screen = "map";
      _checkpoint = JSON.stringify({ run: slim });
    } catch (e) { _checkpoint = null; }
  }
  function saveRun() {
    if (!state.run) { localStorage.removeItem(SAVE_KEY); return; }
    // 持久化最近的地图快照；若尚未产生快照（极早期），退化为当前精简态
    if (_checkpoint) { localStorage.setItem(SAVE_KEY, _checkpoint); return; }
    try {
      const slim = Object.assign({}, state.run, { combat: null });
      localStorage.setItem(SAVE_KEY, JSON.stringify({ run: slim }));
    } catch (e) {}
  }
  function hasSave() { return !!localStorage.getItem(SAVE_KEY); }
  function loadRun() {
    try {
      const data = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (data && data.run) {
        state.run = data.run;
        recalcStats(state.run.player);
        // 兼容旧版线性地图存档：重建为分支地图
        if (!state.run.layers) genRegionMap();
        state.run.combat = null;
        // 若存档发生在战斗中：当前层中断，重置为可重选，回到地图
        if (state.run._screen === "combat") {
          const ly = state.run.layers[state.run.layerIdx];
          if (ly && ly.nodes.length > 1) ly.chosen = -1;
          state.run.curNode = null;
          state.screen = "map";
        } else {
          state.screen = state.run._screen || "map";
        }
        return true;
      }
    } catch (e) {}
    return false;
  }
  function clearSave() { localStorage.removeItem(SAVE_KEY); _checkpoint = null; }
  function abandonRun() { state.run = null; clearSave(); state.screen = "title"; }

  /* ---------------- 导出 ---------------- */
  return {
    state, D,
    rand, pick, chance, clamp, uid, pickByRarity, cn,
    rollRoot, startRun, metaModSum, recalcStats,
    chooseNode, advanceLayer, applyRest, resolveEvent, openShop, buy, buyHeal,
    grantArtifact, grantTechnique, grantPill,
    gainExp, onCombatEnd, continueAfterReward, finishNode,
    usePillOutOfCombat, buyMeta, metaCost, pushLog,
    saveRun, checkpointRun, hasSave, loadRun, clearSave, abandonRun,
    saveMeta,
  };
})();
