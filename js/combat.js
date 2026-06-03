/* ============================================================
 *  combat.js — 回合制战斗引擎
 * ============================================================ */
window.Combat = (function () {
  "use strict";
  const D = window.GameData;
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function chance(p) { return Math.random() < p; }

  /* 创建一场战斗 */
  function create(player, enemy, intro) {
    const c = {
      player, enemy,
      turn: 1,
      phase: "player",     // player / enemy / over
      over: false, victory: false,
      log: [],
      pShield: 0,
      // 本场战斗临时增益（丹药）
      buffs: { atk: 0, reduce: 0, crit: 0 },
      pStatus: {},         // 玩家状态（被敌人施加）
      firstTurn: true,
      ended: false,
    };
    enemy.status = {};
    enemy.shield = 0;
    enemy.aiIdx = 0;
    player.swordIntentStack = 0;
    if (intro) clog(c, intro, "intro");
    clog(c, `遭遇【${enemy.name}】！（气血 ${enemy.hp}）`, "warn");
    return c;
  }

  function clog(c, text, cls) {
    c.log.push({ text, cls });
    if (c.log.length > 120) c.log.shift();
  }

  /* ---------------- 伤害计算 ---------------- */
  function calcDamage(atk, def, opts, srcStatus) {
    opts = opts || {};
    let dmg = atk * (opts.power || 1);
    // 破防
    const pierce = clamp((opts.pierce || 0), 0, 0.95);
    const effDef = def * (1 - pierce);
    dmg = dmg * (atk / (atk + effDef * 1.0)); // 防御按比例减伤
    dmg = Math.max(dmg, atk * (opts.power || 1) * 0.12);
    return dmg;
  }

  /* ---------------- 玩家使用功法 ---------------- */
  function useTechnique(c, tuid) {
    if (c.phase !== "player" || c.over) return;
    const p = c.player, e = c.enemy;
    const t = p.techniques.find((x) => x.uid === tuid);
    if (!t) return;
    let cost = Math.round((t.cost || 0) * (p.costMul || 1));
    const free = (c.firstTurn && p._mods.firstFree) || t.cost === 0;
    if (free) cost = 0;
    if (p.qi < cost) { clog(c, "灵力不足，无法施展！", "warn"); return; }
    p.qi -= cost;

    executeTech(c, t);
    afterPlayerAction(c);
  }

  function executeTech(c, t) {
    const p = c.player, e = c.enemy;
    const baseAtk = effectiveAtk(c);
    clog(c, `你施展【${t.name}】！`, "player");

    if (t.type === "attack" || t.type === "debuff") {
      const hits = t.hits || 1;
      let totalDmg = 0;
      for (let h = 0; h < hits; h++) {
        let critRate = p.crit + (c.buffs.crit || 0) + (t.crit || 0);
        const isCrit = chance(critRate);
        let opts = { power: t.power || 1, pierce: (p.pierce || 0) + (t.pierce || 0) };
        let dmg = calcDamage(baseAtk, e.def, opts);
        dmg *= (1 + (p.dmgUp || 0));
        if (isCrit) dmg *= p.critDmg;
        // 剑灵根剑意叠加
        if (p.root && p.root.mods.swordIntent) {
          dmg *= (1 + p.swordIntentStack * 0.05);
        }
        dmg = Math.round(dmg);
        // 处决
        if (t.executeBelow && e.hp / e.maxHp <= t.executeBelow) {
          dmg = e.hp;
          clog(c, `轮回加身，一击斩杀！`, "crit");
        }
        applyDamageToEnemy(c, dmg, isCrit);
        totalDmg += dmg;
        // 吸血
        if (t.lifesteal) {
          const heal = Math.round(dmg * t.lifesteal);
          p.hp = clamp(p.hp + heal, 0, p.maxHp);
          clog(c, `血海噬魂，吸取 ${heal} 气血。`, "good");
        }
        if (e.hp <= 0) break;
      }
      // 状态附加
      if (e.hp > 0) {
        if (t.burn) { e.status.burn = { dmg: Math.round(baseAtk * 0.4), turns: t.burnTurns }; clog(c, `${e.name}陷入灼烧！`, "info"); }
        if (t.poison) { e.status.poison = { pct: 0.06, turns: t.poisonTurns }; clog(c, `${e.name}中剧毒！`, "info"); }
        if (t.freeze && chance(0.6)) { e.status.frozen = { turns: t.freeze }; clog(c, `${e.name}被冻结！`, "info"); }
        if (t.stun && chance(t.stun)) { e.status.stun = { turns: 1 }; clog(c, `${e.name}被麻痹！`, "info"); }
      }
      // 剑意增长
      if (p.root && p.root.mods.swordIntent) p.swordIntentStack++;
    } else if (t.type === "buff") {
      if (t.shield) { const s = Math.round(baseAtk * t.shield); c.pShield += s; clog(c, `凝聚护盾 ${s} 点。`, "good"); }
      if (t.heal) { const h = Math.round(p.maxHp * t.heal); p.hp = clamp(p.hp + h, 0, p.maxHp); clog(c, `回复 ${h} 气血。`, "good"); }
      if (t.defUp) { c.pStatus.defUp = { val: t.defUp, turns: t.defTurns }; clog(c, `防御提升！`, "good"); }
      if (t.restoreQi) { const q = Math.round(p.maxQi * t.restoreQi); p.qi = clamp(p.qi + q, 0, p.maxQi); clog(c, `回复 ${q} 灵力。`, "good"); }
    } else if (t.type === "heal") {
      const h = Math.round(p.maxHp * t.heal);
      p.hp = clamp(p.hp + h, 0, p.maxHp);
      clog(c, `回复 ${h} 气血。`, "good");
    }
  }

  function effectiveAtk(c) {
    const p = c.player;
    let mul = 1 + (c.buffs.atk || 0);
    if (c.pStatus.weaken) mul *= (1 - c.pStatus.weaken.val);
    return p.atk * mul;
  }

  function applyDamageToEnemy(c, dmg, isCrit) {
    const e = c.enemy;
    if (e.shield > 0) {
      const absorb = Math.min(e.shield, dmg);
      e.shield -= absorb; dmg -= absorb;
    }
    e.hp = clamp(e.hp - dmg, 0, e.maxHp);
    clog(c, `对${e.name}造成 ${dmg} 伤害${isCrit ? "（暴击！）" : ""}。`, isCrit ? "crit" : "dmg");
    if (e.hp <= 0) endCombat(c, true);
  }

  /* 普通攻击 */
  function basicAttack(c) {
    if (c.phase !== "player" || c.over) return;
    const p = c.player, e = c.enemy;
    const baseAtk = effectiveAtk(c);
    const isCrit = chance(p.crit + (c.buffs.crit || 0));
    let dmg = calcDamage(baseAtk, e.def, { power: 1, pierce: p.pierce });
    dmg *= (1 + (p.dmgUp || 0));
    if (isCrit) dmg *= p.critDmg;
    if (p.root && p.root.mods.swordIntent) { dmg *= (1 + p.swordIntentStack * 0.05); p.swordIntentStack++; }
    clog(c, "你挥出一击！", "player");
    applyDamageToEnemy(c, Math.round(dmg), isCrit);
    // 普攻回点灵力
    p.qi = clamp(p.qi + Math.round(p.maxQi * 0.10), 0, p.maxQi);
    afterPlayerAction(c);
  }

  /* 防御 */
  function defend(c) {
    if (c.phase !== "player" || c.over) return;
    const p = c.player;
    c.pShield += Math.round(p.atk * 0.6 + p.def);
    p.qi = clamp(p.qi + Math.round(p.maxQi * 0.15), 0, p.maxQi);
    clog(c, "你凝气戒备，凝聚护盾并恢复少量灵力。", "good");
    afterPlayerAction(c);
  }

  /* 战斗中使用丹药 */
  function usePill(c, puid) {
    if (c.phase !== "player" || c.over) return { ok: false };
    const p = c.player;
    const idx = p.pills.findIndex((x) => x.uid === puid);
    if (idx < 0) return { ok: false };
    const pill = p.pills[idx];
    const u = pill.use, mul = p.pillMul || 1;
    clog(c, `你服下【${pill.name}】。`, "good");
    if (u.heal) p.hp = clamp(p.hp + p.maxHp * Math.min(1, u.heal * mul), 0, p.maxHp);
    if (u.restoreQi) p.qi = clamp(p.qi + p.maxQi * Math.min(1, u.restoreQi * mul), 0, p.maxQi);
    if (u.exp) window.Game.gainExp(D.REALMS[p.realmIdx].expBase * u.exp * mul);
    if (u.battleAtk) c.buffs.atk += u.battleAtk;
    if (u.battleReduce) c.buffs.reduce += u.battleReduce;
    if (u.battleCrit) c.buffs.crit += u.battleCrit;
    p.pills.splice(idx, 1);
    // 用丹药不结束回合
    window.Game.recalcStats(p);
    return { ok: true };
  }

  /* ---------------- 玩家行动后 → 敌人回合 ---------------- */
  function afterPlayerAction(c) {
    c.firstTurn = false;
    if (c.over) return;
    // 雷灵根额外行动
    if (c.player._mods.extraTurn && chance(c.player._mods.extraTurn)) {
      clog(c, "雷灵根爆发，你获得额外行动！", "crit");
      return; // 仍是玩家回合
    }
    c.phase = "enemy";
    // 处理玩家施加给敌人的 dot
    tickEnemyStatus(c);
    if (c.over) return;
    setTimeout ? null : null;
    enemyTurn(c);
  }

  function tickEnemyStatus(c) {
    const e = c.enemy;
    if (e.status.burn) {
      e.hp = clamp(e.hp - e.status.burn.dmg, 0, e.maxHp);
      clog(c, `${e.name}受灼烧损失 ${e.status.burn.dmg} 气血。`, "dmg");
      if (--e.status.burn.turns <= 0) delete e.status.burn;
    }
    if (e.status.poison) {
      const d = Math.round(e.maxHp * e.status.poison.pct);
      e.hp = clamp(e.hp - d, 0, e.maxHp);
      clog(c, `${e.name}中毒损失 ${d} 气血。`, "dmg");
      if (--e.status.poison.turns <= 0) delete e.status.poison;
    }
    if (e.hp <= 0) { endCombat(c, true); }
  }

  /* ---------------- 敌人回合 ---------------- */
  function enemyTurn(c) {
    const p = c.player, e = c.enemy;
    if (c.over) return;

    // 冻结/麻痹
    if (e.status.frozen) {
      clog(c, `${e.name}被冰封，无法行动！`, "info");
      if (--e.status.frozen.turns <= 0) delete e.status.frozen;
      endEnemyTurn(c); return;
    }
    if (e.status.stun) {
      clog(c, `${e.name}陷入麻痹，无法行动！`, "info");
      if (--e.status.stun.turns <= 0) delete e.status.stun;
      endEnemyTurn(c); return;
    }

    // 选择技能（循环 AI）
    const skillId = e.ai[e.aiIdx % e.ai.length];
    e.aiIdx++;
    const sk = D.ENEMY_SKILLS[skillId] || { name: "攻击", power: 1 };

    if (sk.guard) {
      e.shield += Math.round(e.atk * sk.guard + e.def);
      clog(c, `${e.name}使用【${sk.name}】，凝聚护盾。`, "warn");
      endEnemyTurn(c); return;
    }

    clog(c, `${e.name}使用【${sk.name}】！`, "enemy");
    const repeat = sk.repeat || 1;
    const hits = sk.hits || 1;
    let totalHits = repeat * hits;
    let dealt = 0;
    for (let i = 0; i < totalHits; i++) {
      let opts = { power: sk.power || 1, pierce: sk.pierce || 0 };
      let dmg = calcDamage(e.atk, p.def, opts);
      // 玩家防御加成
      if (c.pStatus.defUp) dmg *= (1 - c.pStatus.defUp.val);
      dmg *= (1 - (p.dmgReduce || 0));
      dmg *= (1 - (c.buffs.reduce || 0));
      // weaken (敌人自己之前削弱了玩家攻击，不影响受伤；这里 weaken 作用于玩家攻击在 effectiveAtk 处理)
      dmg = Math.round(Math.max(1, dmg));
      // 处决
      if (sk.executeBelow && p.hp / p.maxHp <= sk.executeBelow) {
        dmg = p.hp;
      }
      dealtDamageToPlayer(c, dmg);
      dealt += dmg;
      if (sk.lifesteal) { e.hp = clamp(e.hp + Math.round(dmg * sk.lifesteal), 0, e.maxHp); }
      if (c.over) return;
    }
    if (sk.selfBuff) { e.atk = Math.round(e.atk * (1 + sk.selfBuff)); clog(c, `${e.name}变得更强了！`, "warn"); }
    if (sk.weaken) { c.pStatus.weaken = { val: sk.weaken, turns: sk.weakenTurns }; clog(c, `你被削弱，攻击下降！`, "warn"); }
    if (sk.stun && chance(sk.stun)) { c.pStatus.pstun = { turns: 1 }; clog(c, `你被定身！`, "warn"); }

    endEnemyTurn(c);
  }

  function dealtDamageToPlayer(c, dmg) {
    const p = c.player;
    if (c.pShield > 0) {
      const ab = Math.min(c.pShield, dmg);
      c.pShield -= ab; dmg -= ab;
    }
    p.hp = clamp(p.hp - dmg, 0, p.maxHp);
    if (dmg > 0) clog(c, `你受到 ${dmg} 伤害。`, "dmg");
    if (p.hp <= 0) endCombat(c, false);
  }

  function endEnemyTurn(c) {
    if (c.over) return;
    const p = c.player;
    // 回合结束：玩家回复（灵根/法宝）
    if (p.regen) { const h = Math.round(p.maxHp * p.regen); p.hp = clamp(p.hp + h, 0, p.maxHp); }
    if (p.qiRegen) { const q = Math.round(p.maxQi * p.qiRegen); p.qi = clamp(p.qi + q, 0, p.maxQi); }
    // 状态衰减
    if (c.pStatus.defUp && --c.pStatus.defUp.turns <= 0) delete c.pStatus.defUp;
    if (c.pStatus.weaken && --c.pStatus.weaken.turns <= 0) delete c.pStatus.weaken;
    // 护盾每回合衰减一半（避免无限叠）
    c.pShield = Math.round(c.pShield * 0.5);
    c.turn++;
    c.phase = "player";

    // 玩家被定身则跳过
    if (c.pStatus.pstun) {
      clog(c, "你被定身，无法行动！", "warn");
      delete c.pStatus.pstun;
      // 直接进入敌人回合
      c.phase = "enemy";
      tickEnemyStatus(c);
      if (!c.over) enemyTurn(c);
    }
  }

  function endCombat(c, victory) {
    if (c.over) return;
    c.over = true; c.victory = victory; c.phase = "over";
    if (victory) clog(c, `★ 你击败了${c.enemy.name}！★`, "win");
    else clog(c, `✖ 你被${c.enemy.name}击倒，神魂俱灭…… ✖`, "lose");
  }

  return {
    create, useTechnique, basicAttack, defend, usePill,
    effectiveAtk,
  };
})();
