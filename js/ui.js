/* ============================================================
 *  ui.js — 界面渲染与交互
 * ============================================================ */
window.UI = (function () {
  "use strict";
  const G = window.Game;
  const D = window.GameData;
  const $app = () => document.getElementById("app");

  function h(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
  function esc(s) { return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
  function rar(r) { return `<span class="rar r${r}">${D.RARITY_NAME[r]}</span>`; }
  function pct(v) { return Math.round(v * 100); }

  let toastTimer = null;
  function toast(msg, type) {
    let el = document.getElementById("toast");
    if (!el) { el = h(`<div id="toast"></div>`); document.body.appendChild(el); }
    el.textContent = msg;
    el.className = "show " + (type || "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = ""; }, 1800);
  }

  /* ============ 主渲染分发 ============ */
  function render() {
    const s = G.state;
    G.saveMeta();
    if (s.run) { s.run._screen = s.screen; G.saveRun(); }
    const app = $app();
    app.innerHTML = "";
    let view;
    switch (s.screen) {
      case "title": view = renderTitle(); break;
      case "meta": view = renderMeta(); break;
      case "create": view = renderCreate(); break;
      case "map": view = renderMap(); break;
      case "combat": view = renderCombat(); break;
      case "rest": view = renderRest(); break;
      case "event": view = renderEvent(); break;
      case "shop": view = renderShop(); break;
      case "reward": view = renderReward(); break;
      case "gameover": view = renderGameOver(); break;
      case "win": view = renderWin(); break;
      default: view = renderTitle();
    }
    app.appendChild(view);
  }

  /* ============ 标题页 ============ */
  function renderTitle() {
    const m = G.state.meta;
    const wrap = h(`<div class="screen title-screen"></div>`);
    wrap.innerHTML = `
      <div class="title-bg"></div>
      <div class="title-content">
        <h1 class="game-title">一念问道</h1>
        <p class="subtitle">— 文字修仙 · Roguelike —</p>
        <div class="title-stats">
          <span>仙缘 ${m.karma}</span>
          <span>历劫 ${m.runs} 次</span>
          <span>飞升 ${m.ascended} 次</span>
        </div>
        <div class="title-btns"></div>
        <p class="title-tip">道友，凡尘苦短，长生难求。<br>愿你斩妖除魔，逆天改命，终得飞升。</p>
      </div>`;
    const btns = wrap.querySelector(".title-btns");
    if (G.hasSave()) {
      const b = h(`<button class="btn btn-primary">▶ 继续历劫</button>`);
      b.onclick = () => { if (G.loadRun()) render(); else toast("存档损坏"); };
      btns.appendChild(b);
    }
    const nb = h(`<button class="btn ${G.hasSave() ? "" : "btn-primary"}">⚔ 开启新征程</button>`);
    nb.onclick = () => {
      if (G.hasSave()) {
        if (!confirm("开启新征程将覆盖当前存档，确定吗？")) return;
        G.clearSave();
      }
      G.state.screen = "create"; render();
    };
    btns.appendChild(nb);
    const mb = h(`<button class="btn">☯ 仙缘 · 传承</button>`);
    mb.onclick = () => { G.state.screen = "meta"; render(); };
    btns.appendChild(mb);
    return wrap;
  }

  /* ============ 元进度 ============ */
  function renderMeta() {
    const m = G.state.meta;
    const wrap = h(`<div class="screen meta-screen"></div>`);
    wrap.innerHTML = `
      <div class="topbar">
        <button class="btn btn-back">‹ 返回</button>
        <h2>☯ 仙缘 · 传承</h2>
        <span class="karma">仙缘 ${m.karma}</span>
      </div>
      <p class="meta-desc">每次陨落或飞升都会积累「仙缘」，可永久强化你的道途。传承不灭，命途渐明。</p>
      <div class="meta-grid"></div>`;
    wrap.querySelector(".btn-back").onclick = () => { G.state.screen = "title"; render(); };
    const grid = wrap.querySelector(".meta-grid");
    D.META_UPGRADES.forEach((u) => {
      const lv = m.upgrades[u.id] || 0;
      const cost = G.metaCost(u);
      const maxed = lv >= u.max;
      const card = h(`
        <div class="meta-card ${maxed ? "maxed" : ""}">
          <div class="meta-name">${u.name} <span class="meta-lv">Lv.${lv}/${u.max}</span></div>
          <div class="meta-card-desc">${u.desc}</div>
          <button class="btn btn-sm ${maxed ? "" : "btn-primary"}">${maxed ? "已圆满" : "参悟 (" + cost + " 仙缘)"}</button>
        </div>`);
      const b = card.querySelector("button");
      if (maxed) b.disabled = true;
      else b.onclick = () => {
        const r = G.buyMeta(u.id);
        if (r.ok) { toast("参悟成功！", "good"); render(); }
        else toast(r.msg || "无法参悟", "bad");
      };
      grid.appendChild(card);
    });
    return wrap;
  }

  /* ============ 角色创建 / 灵根 ============ */
  let pendingRoot = null;
  function renderCreate() {
    const meta = G.metaModSum();
    if (!pendingRoot) pendingRoot = G.rollRoot(true);
    const wrap = h(`<div class="screen create-screen"></div>`);
    wrap.innerHTML = `
      <div class="topbar">
        <button class="btn btn-back">‹ 返回</button>
        <h2>测灵根 · 定道途</h2>
        <span></span>
      </div>
      <div class="create-body">
        <p class="create-tip">天地灵气汇于一身，你的灵根决定了修行的方向……</p>
        <div class="root-card" style="--rc:${pendingRoot.color}">
          <div class="root-name" style="color:${pendingRoot.color}">${pendingRoot.name}${pendingRoot.rare ? ' <span class="rare-tag">★稀有</span>' : ""}</div>
          <div class="root-desc">${pendingRoot.desc}</div>
        </div>
        <div class="create-btns"></div>
        <div class="all-roots">
          <p class="roots-title">— 灵根图鉴 —</p>
          <div class="roots-list"></div>
        </div>
      </div>`;
    wrap.querySelector(".btn-back").onclick = () => { pendingRoot = null; G.state.screen = "title"; render(); };
    const cb = wrap.querySelector(".create-btns");
    if (meta.reroll) {
      const rb = h(`<button class="btn">⟳ 逆天改命（重测）</button>`);
      rb.onclick = () => { pendingRoot = G.rollRoot(true); render(); };
      cb.appendChild(rb);
    }
    const sb = h(`<button class="btn btn-primary">✦ 以此根入道 ✦</button>`);
    sb.onclick = () => { G.startRun(pendingRoot); pendingRoot = null; render(); };
    cb.appendChild(sb);
    const rl = wrap.querySelector(".roots-list");
    D.SPIRIT_ROOTS.forEach((r) => {
      rl.appendChild(h(`<div class="root-mini"><b style="color:${r.color}">${r.name}</b><span>${r.desc}</span></div>`));
    });
    return wrap;
  }

  /* ============ 玩家状态条（通用） ============ */
  function playerBar(p) {
    const realm = D.REALMS[p.realmIdx];
    const realmTxt = `${realm.name}${realm.layers > 1 ? "·" + G.cn(p.layer + 1) + "层" : ""}`;
    return `
      <div class="pbar">
        <div class="pbar-row">
          <span class="root-badge" style="color:${p.root.color}">${p.root.name}</span>
          <span class="realm-badge">${realmTxt}</span>
          <span class="gold-badge">灵石 ${p.gold}</span>
        </div>
        <div class="stat-line">
          ${bar("气血", p.hp, p.maxHp, "hp")}
          ${bar("灵力", p.qi, p.maxQi, "qi")}
          ${bar("修为", p.exp, p.expMax, "exp")}
        </div>
        <div class="stat-mini">攻击 ${p.atk} · 防御 ${p.def} · 暴击 ${pct(p.crit)}%</div>
      </div>`;
  }
  function bar(label, v, max, cls) {
    const w = Math.max(0, Math.min(100, (v / max) * 100));
    return `<div class="bar ${cls}"><span class="bar-label">${label}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${w}%"></div></div>
      <span class="bar-val">${Math.round(v)}/${Math.round(max)}</span></div>`;
  }

  /* ============ 地图（分支抉择：每层 3 选 1） ============ */
  const NODE_ICON = { battle: "⚔", elite: "☠", boss: "👑", event: "❓", shop: "🪙", rest: "☯" };
  const NODE_LABEL = { battle: "历练", elite: "精英", boss: "首领", event: "奇遇", shop: "坊市", rest: "洞府" };
  const NODE_HINT = {
    battle: "寻常妖兽挡道，斩之可得灵石修为。",
    elite: "强敌盘踞，凶险但厚赏，掉落更佳。",
    boss: "镇守此界的霸主，败之方可前行。",
    event: "前路有奇遇，福祸难料，全凭机缘。",
    shop: "坊市散修摆摊，灵石可换功法法宝丹药。",
    rest: "清幽洞府，可疗伤、修炼或参悟功法。",
  };

  function renderMap() {
    const run = G.state.run, p = run.player;
    const region = D.REGIONS[run.regionIdx];
    const layer = run.layers[run.layerIdx];
    const totalLayers = run.layers.length;
    const wrap = h(`<div class="screen map-screen"></div>`);
    wrap.innerHTML = `
      <div class="region-header" style="--rcol:${region.color}">
        <div class="region-info">
          <h2>${region.name} <span class="region-no">第 ${run.regionIdx + 1}/${D.REGIONS.length} 重秘境</span></h2>
          <p>${region.desc}</p>
        </div>
        <button class="btn btn-sm btn-menu">☰</button>
      </div>
      ${playerBar(p)}
      <div class="path-trail"></div>
      <div class="choice-title">${layer.nodes.length > 1 ? "前路三歧，择一而行" : "前方再无退路"}</div>
      <div class="choice-area"></div>
      <div class="map-inv"></div>`;
    wrap.querySelector(".btn-menu").onclick = showMenu;

    // 进度足迹：已走（显示所选图标）/ 当前（发光）/ 未知（❓）/ 首领
    const trail = wrap.querySelector(".path-trail");
    run.layers.forEach((ly, i) => {
      let cell;
      if (i < run.layerIdx) {
        const chosen = ly.nodes[ly.chosen] || ly.nodes[0];
        cell = h(`<div class="trail-cell done" title="已历经">${NODE_ICON[chosen.type]}</div>`);
      } else if (i === run.layerIdx) {
        cell = h(`<div class="trail-cell current" title="当前">◈</div>`);
      } else if (i === totalLayers - 1) {
        cell = h(`<div class="trail-cell boss-cell" title="首领">👑</div>`);
      } else {
        cell = h(`<div class="trail-cell future" title="未知">？</div>`);
      }
      trail.appendChild(cell);
      if (i < totalLayers - 1) trail.appendChild(h(`<div class="trail-conn ${i < run.layerIdx ? "lit" : ""}"></div>`));
    });

    // 当前层的可选节点（3 个 或 boss 1 个）
    const area = wrap.querySelector(".choice-area");
    if (layer.nodes.length === 1 && layer.nodes[0].type === "boss") {
      const boss = D.BOSSES.find((b) => b.id === region.boss);
      const card = h(`
        <div class="choice-card boss-choice t-boss">
          <div class="cc-icon">👑</div>
          <div class="cc-body">
            <div class="cc-label">首领 · ${boss ? boss.name : ""}</div>
            <div class="cc-hint">${NODE_HINT.boss}</div>
          </div>
        </div>`);
      card.onclick = () => { G.chooseNode(0); render(); };
      area.appendChild(card);
    } else {
      layer.nodes.forEach((node, i) => {
        const card = h(`
          <div class="choice-card t-${node.type}">
            <div class="cc-icon">${NODE_ICON[node.type]}</div>
            <div class="cc-body">
              <div class="cc-label">${NODE_LABEL[node.type]}</div>
              <div class="cc-hint">${NODE_HINT[node.type]}</div>
            </div>
            <div class="cc-go">›</div>
          </div>`);
        card.onclick = () => { G.chooseNode(i); render(); };
        area.appendChild(card);
      });
    }

    // 背包速览
    const inv = wrap.querySelector(".map-inv");
    inv.appendChild(invPanel(p, false, null));
    return wrap;
  }

  /* ============ 背包面板 ============ */
  function invPanel(p, inCombat, combat) {
    const panel = h(`<div class="inv-panel"></div>`);
    // 功法
    const techSec = h(`<div class="inv-sec"><h4>功法 (${p.techniques.length})</h4><div class="inv-items tech"></div></div>`);
    const tc = techSec.querySelector(".inv-items");
    p.techniques.forEach((t) => {
      tc.appendChild(h(`<div class="chip tech-chip" title="${esc(t.desc)}">${rar(t.rarity)} ${t.name}${t._refined ? "+" + t._refined : ""} <i>${t.cost}灵</i></div>`));
    });
    panel.appendChild(techSec);
    // 法宝
    const artSec = h(`<div class="inv-sec"><h4>法宝 (${p.artifacts.length})</h4><div class="inv-items"></div></div>`);
    const ac = artSec.querySelector(".inv-items");
    if (!p.artifacts.length) ac.appendChild(h(`<span class="empty">尚无法宝</span>`));
    p.artifacts.forEach((a) => ac.appendChild(h(`<div class="chip art-chip" title="${esc(a.desc)}">${rar(a.rarity)} ${a.name}</div>`)));
    panel.appendChild(artSec);
    // 丹药
    const pillSec = h(`<div class="inv-sec"><h4>丹药 (${p.pills.length})</h4><div class="inv-items pills"></div></div>`);
    const pc = pillSec.querySelector(".inv-items");
    if (!p.pills.length) pc.appendChild(h(`<span class="empty">尚无丹药</span>`));
    p.pills.forEach((pill) => {
      const chip = h(`<div class="chip pill-chip clickable" title="${esc(pill.desc)}">${pill.name}</div>`);
      chip.onclick = () => {
        if (inCombat) {
          const r = window.Combat.usePill(combat, pill.uid);
          if (r.ok) renderCombatInPlace();
        } else {
          const r = G.usePillOutOfCombat(pill.uid);
          if (r.ok) { toast(r.msg, "good"); render(); }
          else toast(r.msg || "无法使用", "bad");
        }
      };
      pc.appendChild(chip);
    });
    panel.appendChild(pillSec);
    return panel;
  }

  /* ============ 战斗 ============ */
  function renderCombat() {
    const run = G.state.run;
    const c = run.combat;
    const p = c.player, e = c.enemy;
    const wrap = h(`<div class="screen combat-screen"></div>`);
    wrap.innerHTML = `
      <div class="enemy-zone ${e.isBoss ? "boss" : ""}">
        <div class="enemy-art">${enemyGlyph(e)}</div>
        <div class="enemy-info">
          <div class="enemy-name">${e.name} ${e.isBoss ? "👑" : ""}</div>
          ${bar("气血", e.hp, e.maxHp, "ehp")}
          <div class="enemy-status">${enemyStatusText(e)}${e.shield > 0 ? ` 🛡${e.shield}` : ""}</div>
        </div>
      </div>
      <div class="combat-log" id="combatLog"></div>
      ${playerCombatBar(c)}
      <div class="combat-actions"></div>
      <div class="combat-inv"></div>`;

    renderCombatLog(wrap.querySelector("#combatLog"), c);

    const actions = wrap.querySelector(".combat-actions");
    if (c.over) {
      const cont = h(`<button class="btn btn-primary btn-wide">${c.victory ? "✦ 继续 ✦" : "查看结局"}</button>`);
      cont.onclick = () => {
        if (c.victory) { G.onCombatEnd(true); render(); }
        else { G.onCombatEnd(false); render(); }
      };
      actions.appendChild(cont);
    } else if (c.phase === "player") {
      // 普攻 / 防御
      const ba = h(`<button class="btn act-basic">普攻 <i>+10%灵</i></button>`);
      ba.onclick = () => { window.Combat.basicAttack(c); renderCombatInPlace(); };
      const df = h(`<button class="btn act-def">凝气戒备</button>`);
      df.onclick = () => { window.Combat.defend(c); renderCombatInPlace(); };
      actions.appendChild(ba); actions.appendChild(df);
      // 功法
      p.techniques.forEach((t) => {
        const cost = Math.round((t.cost || 0) * (p.costMul || 1));
        const can = p.qi >= cost;
        const btn = h(`<button class="btn act-tech t-${t.type} ${can ? "" : "disabled"}" title="${esc(t.desc)}">
          <b>${t.name}</b><i>${cost}灵</i></button>`);
        if (can) btn.onclick = () => { window.Combat.useTechnique(c, t.uid); renderCombatInPlace(); };
        actions.appendChild(btn);
      });
    } else {
      actions.appendChild(h(`<div class="enemy-turn-hint">⏳ ${e.name}行动中……</div>`));
    }

    // 战斗中丹药栏
    if (!c.over && c.phase === "player" && p.pills.length) {
      const ci = wrap.querySelector(".combat-inv");
      const lbl = h(`<span class="ci-label">丹药：</span>`);
      ci.appendChild(lbl);
      p.pills.forEach((pill) => {
        const chip = h(`<div class="chip pill-chip clickable" title="${esc(pill.desc)}">${pill.name}</div>`);
        chip.onclick = () => { const r = window.Combat.usePill(c, pill.uid); if (r.ok) renderCombatInPlace(); };
        ci.appendChild(chip);
      });
    }
    return wrap;
  }

  function playerCombatBar(c) {
    const p = c.player;
    let statusTags = "";
    if (c.pShield > 0) statusTags += `<span class="tag tag-shield">🛡护盾 ${c.pShield}</span>`;
    if (c.pStatus.defUp) statusTags += `<span class="tag tag-buff">防御↑</span>`;
    if (c.pStatus.weaken) statusTags += `<span class="tag tag-debuff">攻击↓</span>`;
    if (c.buffs.atk) statusTags += `<span class="tag tag-buff">攻击+${pct(c.buffs.atk)}%</span>`;
    if (c.buffs.reduce) statusTags += `<span class="tag tag-buff">减伤+${pct(c.buffs.reduce)}%</span>`;
    if (c.buffs.crit) statusTags += `<span class="tag tag-buff">暴击+${pct(c.buffs.crit)}%</span>`;
    if (p.root && p.root.mods.swordIntent && p.swordIntentStack) statusTags += `<span class="tag tag-buff">剑意×${p.swordIntentStack}</span>`;
    return `
      <div class="pcombat-bar">
        <div class="pcb-top"><span class="realm-badge">${D.REALMS[p.realmIdx].name}</span> <span class="turn-badge">第 ${c.turn} 回合</span> ${statusTags}</div>
        ${bar("气血", p.hp, p.maxHp, "hp")}
        ${bar("灵力", p.qi, p.maxQi, "qi")}
      </div>`;
  }

  function renderCombatLog(el, c) {
    el.innerHTML = c.log.slice(-40).map((l) => `<div class="log-line lc-${l.cls || "info"}">${esc(l.text)}</div>`).join("");
    el.scrollTop = el.scrollHeight;
  }

  // 战斗内局部刷新（保留滚动 + 处理敌人异步回合）
  function renderCombatInPlace() {
    render();
    const el = document.getElementById("combatLog");
    if (el) el.scrollTop = el.scrollHeight;
  }

  function enemyGlyph(e) {
    const map = { yelang: "🐺", dushe: "🐍", shanzei: "🗡", lijing: "👻", shipo: "🧟", huyao: "🦊",
      jiaolong: "🐉", yaoxiu: "🧙", shiyao: "🗿", moxiu: "😈", xianbing: "⚔",
      langwang: "🐺", guiwang: "💀", yaohuang: "🐲", mozun: "👿", tiandao: "⚡" };
    return map[e.id] || "❖";
  }
  function enemyStatusText(e) {
    const t = [];
    if (e.status.burn) t.push("🔥灼烧");
    if (e.status.poison) t.push("☠中毒");
    if (e.status.frozen) t.push("❄冻结");
    if (e.status.stun) t.push("💫麻痹");
    return t.map((x) => `<span class="tag tag-debuff">${x}</span>`).join("");
  }

  /* ============ 休整（洞府） ============ */
  function renderRest() {
    const p = G.state.run.player;
    const wrap = h(`<div class="screen rest-screen"></div>`);
    wrap.innerHTML = `
      <div class="event-card">
        <div class="event-icon">☯</div>
        <h2>洞天福地</h2>
        <p class="event-text">你寻得一处清幽洞府，灵气氤氲。可在此稍作休整，再启征程。</p>
        <div class="event-options"></div>
      </div>`;
    const opts = wrap.querySelector(".event-options");
    const choices = [
      { id: "heal", label: "打坐疗伤（回复 60% 气血，灵力全满）" },
      { id: "cultivate", label: "潜心修炼（获得大量修为）" },
      { id: "refine", label: "参悟功法（随机强化一门功法 +25%）" },
    ];
    choices.forEach((ch) => {
      const b = h(`<button class="btn btn-option">${ch.label}</button>`);
      b.onclick = () => { G.applyRest(ch.id); render(); };
      opts.appendChild(b);
    });
    return wrap;
  }

  /* ============ 事件 ============ */
  function renderEvent() {
    const run = G.state.run;
    const ev = run.curEvent;
    const wrap = h(`<div class="screen event-screen"></div>`);
    if (run.eventResult) {
      wrap.innerHTML = `
        <div class="event-card">
          <div class="event-icon">✦</div>
          <h2>${ev.title}</h2>
          <p class="event-text event-result">${esc(run.eventResult)}</p>
          <div class="event-options"></div>
        </div>`;
      const b = h(`<button class="btn btn-primary btn-wide">继续前行</button>`);
      b.onclick = () => { G.finishNode(); render(); };
      wrap.querySelector(".event-options").appendChild(b);
      return wrap;
    }
    wrap.innerHTML = `
      <div class="event-card">
        <div class="event-icon">❓</div>
        <h2>${ev.title}</h2>
        <p class="event-text">${esc(ev.text)}</p>
        <div class="event-options"></div>
      </div>`;
    const opts = wrap.querySelector(".event-options");
    ev.options.forEach((o, i) => {
      const b = h(`<button class="btn btn-option">${esc(o.label)}</button>`);
      b.onclick = () => {
        G.resolveEvent(i);
        // resolveEvent 可能切换到 shop/combat
        render();
      };
      opts.appendChild(b);
    });
    return wrap;
  }

  /* ============ 商店 ============ */
  function renderShop() {
    const run = G.state.run, p = run.player;
    const shop = run.shop;
    const wrap = h(`<div class="screen shop-screen"></div>`);
    wrap.innerHTML = `
      <div class="topbar">
        <h2>🪙 坊市</h2>
        <span class="gold-badge">灵石 ${p.gold}</span>
      </div>
      <p class="shop-tip">「童叟无欺，缘来则聚。道友看上什么尽管开口。」</p>
      <div class="shop-goods"></div>
      <div class="shop-services"></div>
      <button class="btn btn-primary btn-wide shop-leave">离开坊市</button>`;
    const goods = wrap.querySelector(".shop-goods");
    shop.goods.forEach((g) => {
      const it = g.item;
      const kindTxt = { technique: "功法", artifact: "法宝", pill: "丹药" }[g.kind];
      const card = h(`
        <div class="shop-card ${g.sold ? "sold" : ""}">
          <div class="shop-card-head">${rar(it.rarity)} <span class="shop-kind">${kindTxt}</span></div>
          <div class="shop-card-name">${it.name}${it.cost !== undefined ? ` <i>${it.cost}灵</i>` : ""}</div>
          <div class="shop-card-desc">${it.desc}</div>
          <button class="btn btn-sm ${g.sold ? "" : "btn-primary"}">${g.sold ? "已售出" : "购买 " + g.price + " 灵石"}</button>
        </div>`);
      const b = card.querySelector("button");
      if (g.sold) b.disabled = true;
      else b.onclick = () => {
        const r = G.buy(g.gid);
        toast(r.msg, r.ok ? "good" : "bad");
        G.recalcStats(p);
        render();
      };
      goods.appendChild(card);
    });
    const svc = wrap.querySelector(".shop-services");
    const heal = h(`<button class="btn">疗伤复灵（${shop.healPrice} 灵石）</button>`);
    heal.onclick = () => { const r = G.buyHeal(); toast(r.msg, r.ok ? "good" : "bad"); render(); };
    svc.appendChild(heal);

    wrap.querySelector(".shop-leave").onclick = () => { G.finishNode(); render(); };
    return wrap;
  }

  /* ============ 战斗奖励 ============ */
  function renderReward() {
    const run = G.state.run, p = run.player;
    const v = run.combatVictory || {};
    const wrap = h(`<div class="screen reward-screen"></div>`);
    const dropTxt = { technique: "习得一门功法", artifact: "获得一件法宝", pill: "获得一枚丹药" };
    let drops = (v.drops || []).map((d) => `<li>${dropTxt[d]}</li>`).join("");
    if (v.boss) drops += `<li class="boss-drop">首领宝藏：法宝 + 丹药</li>`;
    wrap.innerHTML = `
      <div class="reward-card">
        <div class="reward-icon">${v.boss ? "👑" : "★"}</div>
        <h2>${v.boss ? "首领伏诛！" : "战斗胜利"}</h2>
        <ul class="reward-list">
          <li>灵石 +${v.gold}</li>
          <li>修为 +${v.exp}</li>
          ${v.broke ? '<li class="bt">✦ 修为突破！境界精进！✦</li>' : ""}
          ${drops}
        </ul>
        ${run.bossCleared ? `<p class="region-clear">秘境已平定，前路豁然开朗……</p>` : ""}
        <button class="btn btn-primary btn-wide">${run.bossCleared ? "踏入下一重秘境 ▶" : "继续 ▶"}</button>
      </div>`;
    wrap.querySelector("button").onclick = () => { G.continueAfterReward(); render(); };
    return wrap;
  }

  /* ============ 结局 ============ */
  function renderGameOver() {
    const run = G.state.run, p = run.player;
    const region = D.REGIONS[run.regionIdx];
    const wrap = h(`<div class="screen end-screen gameover"></div>`);
    wrap.innerHTML = `
      <div class="end-card">
        <div class="end-icon">☠</div>
        <h1>道陨</h1>
        <p class="end-text">你的修行止步于【${region.name}】，境界停留在<br>
          <b>${D.REALMS[p.realmIdx].name}${D.REALMS[p.realmIdx].layers > 1 ? "·" + G.cn(p.layer + 1) + "层" : ""}</b>。</p>
        <p class="end-karma">魂归大道，化作仙缘 <b>+${run.gainedKarma}</b></p>
        <p class="end-quote">"千般算计，万般神通，终究难逃一个死字。<br>所幸大道无情，轮回有续……"</p>
        <div class="end-btns"></div>
      </div>`;
    addEndButtons(wrap.querySelector(".end-btns"));
    G.clearSave();
    return wrap;
  }
  function renderWin() {
    const run = G.state.run;
    const wrap = h(`<div class="screen end-screen win"></div>`);
    wrap.innerHTML = `
      <div class="end-card">
        <div class="end-icon">✦</div>
        <h1>飞升成仙</h1>
        <p class="end-text">你渡过九重天劫，肉身成圣，神魂登仙！<br>万千凡尘黯然失色，唯你一念，照彻长空。</p>
        <p class="end-karma">功德圆满，获得仙缘 <b>+${run.gainedKarma}</b></p>
        <p class="end-quote">"我命由我不由天，<br>这方天地，再困不住我！"</p>
        <div class="end-btns"></div>
      </div>`;
    addEndButtons(wrap.querySelector(".end-btns"));
    G.clearSave();
    return wrap;
  }
  function addEndButtons(box) {
    const b1 = h(`<button class="btn btn-primary">⚔ 再次入道</button>`);
    b1.onclick = () => { G.state.run = null; G.clearSave(); G.state.screen = "create"; render(); };
    const b2 = h(`<button class="btn">☯ 仙缘传承</button>`);
    b2.onclick = () => { G.state.run = null; G.clearSave(); G.state.screen = "meta"; render(); };
    const b3 = h(`<button class="btn">回到主界</button>`);
    b3.onclick = () => { G.state.run = null; G.clearSave(); G.state.screen = "title"; render(); };
    box.appendChild(b1); box.appendChild(b2); box.appendChild(b3);
  }

  /* ============ 暂停菜单 ============ */
  function showMenu() {
    const ov = h(`<div class="overlay"></div>`);
    ov.innerHTML = `
      <div class="menu-box">
        <h3>菜单</h3>
        <button class="btn btn-wide mb-resume">继续游戏</button>
        <button class="btn btn-wide mb-save">保存并退出到主界</button>
        <button class="btn btn-wide btn-danger mb-abandon">放弃此次历劫</button>
      </div>`;
    ov.onclick = (e) => { if (e.target === ov) document.body.removeChild(ov); };
    ov.querySelector(".mb-resume").onclick = () => document.body.removeChild(ov);
    ov.querySelector(".mb-save").onclick = () => { G.saveRun(); document.body.removeChild(ov); G.state.screen = "title"; render(); };
    ov.querySelector(".mb-abandon").onclick = () => {
      if (confirm("放弃后将结算当前进度的仙缘并清除存档，确定？")) {
        // 结算少量仙缘
        const run = G.state.run, p = run.player;
        const karma = (p.realmIdx * 9 + p.layer) + run.regionIdx * 8;
        G.state.meta.karma += karma;
        G.saveMeta();
        document.body.removeChild(ov);
        G.abandonRun();
        render();
      }
    };
    document.body.appendChild(ov);
  }

  return { render, toast };
})();
