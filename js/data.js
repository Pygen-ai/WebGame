/* ============================================================
 *  《一念问道》  文字修仙 Roguelike
 *  data.js — 全部静态游戏数据
 * ============================================================ */
window.GameData = (function () {
  "use strict";

  /* ---------- 境界（大境界 / 每境若干层） ---------- */
  const REALMS = [
    { name: "练气", layers: 9, hp: 60, atk: 8, def: 2, qi: 30, expBase: 60 },
    { name: "筑基", layers: 9, hp: 140, atk: 18, def: 6, qi: 60, expBase: 160 },
    { name: "金丹", layers: 9, hp: 320, atk: 38, def: 14, qi: 110, expBase: 420 },
    { name: "元婴", layers: 9, hp: 680, atk: 78, def: 30, qi: 200, expBase: 1000 },
    { name: "化神", layers: 9, hp: 1400, atk: 150, def: 60, qi: 360, expBase: 2400 },
    { name: "炼虚", layers: 9, hp: 2800, atk: 290, def: 120, qi: 620, expBase: 5600 },
    { name: "合体", layers: 9, hp: 5600, atk: 560, def: 240, qi: 1080, expBase: 13000 },
    { name: "大乘", layers: 9, hp: 11000, atk: 1080, def: 460, qi: 1800, expBase: 30000 },
    { name: "渡劫", layers: 9, hp: 22000, atk: 2100, def: 900, qi: 3000, expBase: 70000 },
    { name: "飞升", layers: 1, hp: 99999, atk: 9999, def: 9999, qi: 9999, expBase: 999999 },
  ];

  /* ---------- 灵根（开局随机，决定流派加成） ---------- */
  const SPIRIT_ROOTS = [
    { id: "metal", name: "金灵根", color: "#e8d8a0", desc: "攻伐凌厉，攻击 +20%，破甲。", mods: { atkMul: 1.20, pierce: 0.15 } },
    { id: "wood", name: "木灵根", color: "#7fce8c", desc: "生生不息，每回合回复 4% 气血。", mods: { regen: 0.04 } },
    { id: "water", name: "水灵根", color: "#7fc4e8", desc: "灵力深厚，灵力上限 +40%，技能耗灵 -15%。", mods: { qiMul: 1.40, costMul: 0.85 } },
    { id: "fire", name: "火灵根", color: "#e88a6a", desc: "暴烈无双，暴击率 +18%，暴击伤害 +30%。", mods: { critAdd: 0.18, critDmg: 0.30 } },
    { id: "earth", name: "土灵根", color: "#d2b48c", desc: "厚德载物，气血上限 +35%，防御 +25%。", mods: { hpMul: 1.35, defMul: 1.25 } },
    { id: "thunder", name: "雷灵根", color: "#c9a0ff", desc: "天生异象，速度极快，先手且每回合额外行动概率 15%。", mods: { speed: 1, extraTurn: 0.15 } },
    { id: "chaos", name: "混沌灵根", color: "#ffd86b", desc: "万法归一，全属性 +12%，悟性极高（功法掉率提升）。", mods: { allMul: 1.12, dropLuck: 0.25 }, rare: true },
    { id: "sword", name: "剑灵根", color: "#bfefff", desc: "剑心通明，攻击 +15%，每次普攻叠加剑意（伤害递增）。", mods: { atkMul: 1.15, swordIntent: true }, rare: true },
  ];

  /* ---------- 功法（战斗技能卡） ----------
     type: attack / buff / debuff / heal
     效果在 combat.js 中解析。 */
  const TECHNIQUES = [
    // —— 凡品 / 黄阶 ——
    { id: "jianjue", name: "基础剑诀", rarity: 1, cost: 8, type: "attack", power: 1.4, desc: "造成 140% 攻击的剑气伤害。" },
    { id: "lieyan", name: "烈焰掌", rarity: 1, cost: 12, type: "attack", power: 1.1, burn: 3, burnTurns: 3, desc: "造成 110% 伤害，并使敌人灼烧（每回合掉血）3 回合。" },
    { id: "huti", name: "护体罡气", rarity: 1, cost: 10, type: "buff", shield: 0.8, desc: "凝聚护盾，吸收相当于 80% 攻击的伤害。" },
    { id: "huixue", name: "归元术", rarity: 1, cost: 14, type: "heal", heal: 0.25, desc: "回复 25% 最大气血。" },
    // —— 玄阶 ——
    { id: "wanjian", name: "万剑归宗", rarity: 2, cost: 22, type: "attack", power: 0.6, hits: 4, desc: "御使飞剑攻击 4 次，每次 60% 伤害。" },
    { id: "bingfeng", name: "玄冰诀", rarity: 2, cost: 18, type: "attack", power: 1.2, freeze: 1, desc: "120% 冰伤，有几率冻结敌人 1 回合（跳过其行动）。" },
    { id: "duwu", name: "化骨毒雾", rarity: 2, cost: 16, type: "debuff", power: 0.5, poison: 6, poisonTurns: 4, desc: "50% 伤害并施加剧毒，每回合按比例掉血 4 回合。" },
    { id: "jinzhong", name: "金钟罩", rarity: 2, cost: 20, type: "buff", shield: 1.4, defUp: 0.3, defTurns: 3, desc: "护盾 140% 攻击，并提升防御 30% 持续 3 回合。" },
    { id: "leifa", name: "五雷正法", rarity: 2, cost: 24, type: "attack", power: 1.8, stun: 0.35, desc: "180% 雷伤，35% 几率麻痹敌人 1 回合。" },
    // —— 地阶 ——
    { id: "zhoutian", name: "周天搬运", rarity: 3, cost: 0, type: "buff", restoreQi: 0.5, desc: "调息：本回合不耗灵，回复 50% 灵力上限。" },
    { id: "xueji", name: "血海噬魂", rarity: 3, cost: 26, type: "attack", power: 2.2, lifesteal: 0.5, desc: "220% 伤害，并吸取造成伤害的 50% 回复自身。" },
    { id: "tianlei", name: "九天神雷", rarity: 3, cost: 34, type: "attack", power: 3.2, stun: 0.5, desc: "降下神雷造成 320% 巨伤，50% 麻痹。" },
    { id: "wuxiang", name: "无相劫指", rarity: 3, cost: 30, type: "attack", power: 2.6, pierce: 0.6, desc: "260% 伤害，无视目标 60% 防御。" },
    // —— 天阶 ——
    { id: "taixu", name: "太虚剑意", rarity: 4, cost: 40, type: "attack", power: 1.2, hits: 6, crit: 0.25, desc: "剑意纵横攻击 6 次，每次 120% 且额外 +25% 暴击率。" },
    { id: "lunhui", name: "轮回劫", rarity: 4, cost: 50, type: "attack", power: 4.5, executeBelow: 0.25, desc: "450% 大伤；若目标生命低于 25%，直接斩杀。" },
    { id: "bumie", name: "不灭金身", rarity: 4, cost: 36, type: "buff", shield: 2.5, heal: 0.3, defUp: 0.4, defTurns: 3, desc: "护盾 250%，回血 30%，防御 +40% 3 回合。" },
  ];

  /* ---------- 法宝（被动装备，可叠加） ---------- */
  const ARTIFACTS = [
    { id: "feijian", name: "青锋飞剑", rarity: 1, desc: "攻击 +12%。", mods: { atkMul: 1.12 } },
    { id: "yujue", name: "玉清护符", rarity: 1, desc: "气血上限 +15%。", mods: { hpMul: 1.15 } },
    { id: "lingdai", name: "聚灵腰带", rarity: 1, desc: "灵力上限 +20%。", mods: { qiMul: 1.20 } },
    { id: "huxin", name: "护心明镜", rarity: 1, desc: "防御 +20%。", mods: { defMul: 1.20 } },
    { id: "huoling", name: "赤焰火铃", rarity: 2, desc: "暴击率 +12%。", mods: { critAdd: 0.12 } },
    { id: "xuanbing", name: "玄冰珠", rarity: 2, desc: "受到伤害 -10%。", mods: { dmgReduce: 0.10 } },
    { id: "qiankun", name: "乾坤袋", rarity: 2, desc: "战斗胜利灵石 +40%。", mods: { goldMul: 1.40 } },
    { id: "shennong", name: "神农鼎", rarity: 2, desc: "丹药效果 +50%。", mods: { pillMul: 1.50 } },
    { id: "panlong", name: "蟠龙戒", rarity: 3, desc: "攻击 +20%，暴击伤害 +25%。", mods: { atkMul: 1.20, critDmg: 0.25 } },
    { id: "wuji", name: "太极无极图", rarity: 3, desc: "每回合回复 5% 气血与 8% 灵力。", mods: { regen: 0.05, qiRegen: 0.08 } },
    { id: "zhenmo", name: "镇魔塔", rarity: 3, desc: "造成伤害 +18%，无视 15% 防御。", mods: { dmgUp: 0.18, pierce: 0.15 } },
    { id: "hetu", name: "河图洛书", rarity: 4, desc: "全属性 +15%，每场战斗首回合不耗灵。", mods: { allMul: 1.15, firstFree: true } },
    { id: "zhuxian", name: "诛仙剑匣", rarity: 4, desc: "攻击 +35%，暴击率 +15%。", mods: { atkMul: 1.35, critAdd: 0.15 } },
  ];

  /* ---------- 丹药（消耗品，run 内使用） ---------- */
  const PILLS = [
    { id: "huixue", name: "回血丹", rarity: 1, desc: "立即回复 40% 气血。", use: { heal: 0.40 } },
    { id: "huiqi", name: "回灵丹", rarity: 1, desc: "立即回复 50% 灵力。", use: { restoreQi: 0.50 } },
    { id: "liqi", name: "聚气散", rarity: 1, desc: "本场战斗攻击 +25%。", use: { battleAtk: 0.25 } },
    { id: "jingang", name: "金刚丹", rarity: 2, desc: "本场战斗减伤 +25%。", use: { battleReduce: 0.25 } },
    { id: "kuangzhan", name: "狂战丹", rarity: 2, desc: "本场战斗暴击率 +30%。", use: { battleCrit: 0.30 } },
    { id: "zhuji", name: "筑基丹", rarity: 2, desc: "立即获得大量修为。", use: { exp: 0.5 } },
    { id: "jiuzhuan", name: "九转还魂丹", rarity: 3, desc: "完全回复气血与灵力。", use: { heal: 1.0, restoreQi: 1.0 } },
    { id: "poujing", name: "破境丹", rarity: 3, desc: "获得海量修为，助力突破。", use: { exp: 1.2 } },
  ];

  /* ---------- 敌人（按区域 tier 分布） ---------- */
  const ENEMIES = [
    // tier 0 — 山野
    { id: "yelang", name: "山野妖狼", tier: 0, hpMul: 0.8, atkMul: 0.8, defMul: 0.6, ai: ["bite"], gold: 12, exp: 0.18 },
    { id: "dushe", name: "赤睛毒蛇", tier: 0, hpMul: 0.7, atkMul: 0.7, defMul: 0.5, ai: ["poison", "bite"], gold: 14, exp: 0.20 },
    { id: "shanzei", name: "拦路山贼", tier: 0, hpMul: 1.0, atkMul: 0.9, defMul: 0.8, ai: ["slash", "guard"], gold: 20, exp: 0.22 },
    // tier 1 — 鬼林 / 古洞
    { id: "lijing", name: "千年厉鬼", tier: 1, hpMul: 1.0, atkMul: 1.1, defMul: 0.7, ai: ["curse", "drain"], gold: 26, exp: 0.30 },
    { id: "shipo", name: "尸魃", tier: 1, hpMul: 1.4, atkMul: 1.0, defMul: 1.1, ai: ["slam", "guard"], gold: 30, exp: 0.32 },
    { id: "huyao", name: "魅惑狐妖", tier: 1, hpMul: 0.9, atkMul: 1.2, defMul: 0.8, ai: ["charm", "claw"], gold: 34, exp: 0.34 },
    // tier 2 — 妖域
    { id: "jiaolong", name: "深渊蛟龙", tier: 2, hpMul: 1.6, atkMul: 1.3, defMul: 1.2, ai: ["waterbeam", "tail", "guard"], gold: 48, exp: 0.46 },
    { id: "yaoxiu", name: "邪修散人", tier: 2, hpMul: 1.2, atkMul: 1.4, defMul: 1.0, ai: ["bloodart", "drain", "slash"], gold: 52, exp: 0.48 },
    { id: "shiyao", name: "上古石妖", tier: 2, hpMul: 2.0, atkMul: 1.1, defMul: 1.6, ai: ["slam", "guard", "quake"], gold: 50, exp: 0.50 },
    // tier 3 — 仙魔战场
    { id: "moxiu", name: "魔道真君", tier: 3, hpMul: 1.8, atkMul: 1.7, defMul: 1.3, ai: ["bloodart", "curse", "slash"], gold: 80, exp: 0.7 },
    { id: "xianbing", name: "堕落仙兵", tier: 3, hpMul: 1.6, atkMul: 1.9, defMul: 1.5, ai: ["holyslash", "guard", "smite"], gold: 84, exp: 0.72 },
  ];

  /* ---------- 精英 / Boss（每区域终结战） ---------- */
  const BOSSES = [
    { id: "langwang", name: "血月狼王", tier: 0, hpMul: 1.9, atkMul: 1.1, defMul: 0.85, ai: ["frenzy", "bite", "howl"], gold: 80, exp: 1.2,
      intro: "血月当空，一头通体赤红的巨狼挡住去路，獠牙滴落涎水。" },
    { id: "guiwang", name: "幽冥鬼王", tier: 1, hpMul: 2.8, atkMul: 1.3, defMul: 1.1, ai: ["soulreap", "curse", "summon"], gold: 140, exp: 1.6,
      intro: "阴风骤起，鬼王自尸山血海中升起，万千冤魂哀嚎环绕。" },
    { id: "yaohuang", name: "万妖之皇", tier: 2, hpMul: 3.4, atkMul: 1.55, defMul: 1.3, ai: ["yaobreath", "tail", "frenzy", "guard"], gold: 240, exp: 2.2,
      intro: "群山震颤，万妖朝拜。妖皇睁开竖瞳，整片天地都在它的威压下颤抖。" },
    { id: "mozun", name: "噬天魔尊", tier: 3, hpMul: 4.0, atkMul: 1.8, defMul: 1.5, ai: ["devour", "bloodart", "soulreap", "smite"], gold: 400, exp: 3.0,
      intro: "魔尊横压一界，他曾是与你同道的仙人，如今却已堕入魔道，要将你一同拖入深渊。" },
    { id: "tiandao", name: "天道雷劫", tier: 4, hpMul: 5.0, atkMul: 2.2, defMul: 1.7, ai: ["heavenbolt", "tribulation", "smite", "judgement"], gold: 0, exp: 0,
      intro: "九重天上，紫色雷云汇聚成一只巨眼俯瞰众生。渡劫飞升，成败在此一举！" },
  ];

  /* ---------- 敌人技能定义 ---------- */
  const ENEMY_SKILLS = {
    bite:   { name: "撕咬", power: 1.0 },
    slash:  { name: "劈砍", power: 1.1 },
    claw:   { name: "利爪", power: 1.15 },
    slam:   { name: "重击", power: 1.3 },
    tail:   { name: "横扫尾击", power: 1.25 },
    guard:  { name: "戒备", guard: 0.5 },
    poison: { name: "毒牙", power: 0.6, poison: 5, poisonTurns: 3 },
    curse:  { name: "诅咒", power: 0.8, weaken: 0.2, weakenTurns: 2 },
    drain:  { name: "汲魂", power: 1.0, lifesteal: 0.6 },
    charm:  { name: "魅惑", power: 0.5, stun: 0.5 },
    waterbeam:{ name: "水龙吐息", power: 1.4 },
    bloodart:{ name: "血煞术", power: 1.5, lifesteal: 0.4 },
    quake:  { name: "震地", power: 1.0, stun: 0.3 },
    holyslash:{ name: "圣剑斩", power: 1.6 },
    smite:  { name: "天谴", power: 1.8 },
    // boss
    frenzy: { name: "狂暴", power: 1.0, selfBuff: 0.25 },
    howl:   { name: "血月长嚎", power: 0.8, weaken: 0.25, weakenTurns: 2 },
    soulreap:{ name: "万魂噬", power: 1.7, lifesteal: 0.3 },
    summon: { name: "召唤冤魂", power: 0.9, repeat: 2 },
    yaobreath:{ name: "妖皇威压", power: 2.0 },
    devour: { name: "吞天", power: 2.2, lifesteal: 0.5 },
    heavenbolt:{ name: "天罚神雷", power: 2.4, pierce: 0.5 },
    tribulation:{ name: "九重雷劫", power: 1.2, hits: 3 },
    judgement:{ name: "天道审判", power: 3.0, executeBelow: 0.2 },
  };

  /* ---------- 区域（每个 run 经过的秘境） ---------- */
  const REGIONS = [
    { name: "青云山脉", tier: 0, boss: "langwang", desc: "凡人修士初入的灵脉，妖兽出没。", color: "#3a5a40" },
    { name: "幽冥鬼林", tier: 1, boss: "guiwang", desc: "终年不见天日，怨气冲天的鬼蜮。", color: "#3d3a5c" },
    { name: "万妖荒域", tier: 2, boss: "yaohuang", desc: "上古妖兽盘踞的禁地，凶险万分。", color: "#5c3a3a" },
    { name: "仙魔战场", tier: 3, boss: "mozun", desc: "万年前仙魔大战的遗址，魔气未散。", color: "#4a2a4a" },
    { name: "九霄渡劫", tier: 4, boss: "tiandao", desc: "登天之路，唯有渡过天劫方能飞升。", color: "#2a3a5c" },
  ];

  /* ---------- 随机事件（带选择分支） ---------- */
  const EVENTS = [
    {
      id: "oldman", title: "白发老者",
      text: "一位白发苍苍的老者拦住去路，浑浊的双眼似能看透你的根骨：「小友，可愿以一缕精血，换老夫一桩机缘？」",
      options: [
        { label: "以精血换机缘（失去15%气血）", effect: { hpPct: -0.15, reward: "artifact" }, result: "老者大笑，赠你一件法宝后化作清风而去。" },
        { label: "婉言谢绝", effect: { exp: 0.1 }, result: "你拱手告辞，老者微微点头，似有赞许。你心境通明，修为微涨。" },
      ],
    },
    {
      id: "spring", title: "灵泉",
      text: "山涧深处，一汪泛着灵光的清泉静静流淌，泉水中似有大道至理流转。",
      options: [
        { label: "畅饮灵泉（回复气血灵力）", effect: { heal: 0.5, restoreQi: 0.5 }, result: "灵泉入腹，暖流遍体，伤势灵力尽复。" },
        { label: "以泉水淬炼（永久+气血上限）", effect: { maxHpUp: 0.08 }, result: "你盘坐泉中，以泉水洗练肉身，气血上限永久提升！" },
        { label: "汲取泉眼灵气（有风险）", effect: { gamble: "spring" }, result: "" },
      ],
    },
    {
      id: "merchant", title: "游方散修",
      text: "一名背着巨大行囊的散修朝你招手：「道友留步！我这有些好东西，便宜卖了！」",
      options: [
        { label: "查看货物", effect: { shop: true }, result: "" },
        { label: "无视离开", effect: {}, result: "你摇摇头，继续赶路。" },
      ],
    },
    {
      id: "demon", title: "心魔",
      text: "夜深人静，一个与你一模一样的身影自识海浮现，冷笑道：「你我本是一体，何不放下道义，随心所欲？」",
      options: [
        { label: "斩断心魔（消耗灵力，得功法）", effect: { qiPct: -0.4, reward: "technique" }, result: "你一念清明，心魔崩散，于顿悟中参悟一门功法！" },
        { label: "妥协沉沦（获得力量，留下道伤）", effect: { atkBuffPerm: 0.15, maxHpDown: 0.1 }, result: "你接纳了心魔，力量暴涨，但道基受损，气血上限下降。" },
      ],
    },
    {
      id: "ruins", title: "上古遗府",
      text: "断壁残垣间，一座上古修士的洞府若隐若现，禁制早已破败，但仍有危险气息。",
      options: [
        { label: "强闯夺宝", effect: { gamble: "ruins" }, result: "" },
        { label: "小心搜寻（得灵石）", effect: { gold: 40 }, result: "你避开残存禁制，搜得一些散落的灵石。" },
      ],
    },
    {
      id: "monk", title: "枯坐老僧",
      text: "一名枯瘦老僧于古树下入定，见你前来，缓缓睁眼:「施主杀业过重，可愿听老衲讲一段经?」",
      options: [
        { label: "静心聆听（清除负面，回血）", effect: { cleanse: true, heal: 0.3 }, result: "梵音入耳，杂念尽消，伤势渐愈。" },
        { label: "我自有道（+修为）", effect: { exp: 0.15 }, result: "「道不同。」你转身离去，反而于争辩中印证己道。" },
      ],
    },
    {
      id: "treasure", title: "遗落丹炉",
      text: "路旁一座古朴丹炉静静伫立，炉中似乎还残留着丹药的余香。",
      options: [
        { label: "开炉取丹", effect: { reward: "pill", count: 2 }, result: "炉盖开启，竟有数枚保存完好的丹药！" },
        { label: "炼化丹炉（得灵石）", effect: { gold: 30 }, result: "你将丹炉炼化为灵石收入囊中。" },
      ],
    },
    {
      id: "boss_mini", title: "拦路强敌",
      text: "一股强大的气息锁定了你，看来是场无法避免的恶战。",
      options: [
        { label: "迎战（精英战）", effect: { elite: true }, result: "" },
      ],
    },
  ];

  /* ---------- 商店随机生成池 ---------- */
  const SHOP_TIERS = {
    technique: { 1: 60, 2: 120, 3: 240, 4: 400 },
    artifact: { 1: 80, 2: 160, 3: 320, 4: 520 },
    pill: { 1: 30, 2: 70, 3: 140 },
  };

  /* ---------- 元进度：仙缘解锁 ---------- */
  const META_UPGRADES = [
    { id: "hp1", name: "淬体·一", cost: 30, max: 5, desc: "开局气血上限 +6%/级。", mod: { hpMul: 0.06 } },
    { id: "atk1", name: "凝力·一", cost: 30, max: 5, desc: "开局攻击 +5%/级。", mod: { atkMul: 0.05 } },
    { id: "qi1", name: "蕴灵·一", cost: 25, max: 5, desc: "开局灵力上限 +8%/级。", mod: { qiMul: 0.08 } },
    { id: "gold1", name: "聚财", cost: 40, max: 3, desc: "开局额外灵石 +50/级。", mod: { startGold: 50 } },
    { id: "pill1", name: "丹缘", cost: 50, max: 1, desc: "开局额外携带 1 枚九转还魂丹。", mod: { startPill: "jiuzhuan" } },
    { id: "luck1", name: "天命", cost: 80, max: 3, desc: "稀有掉落概率 +8%/级。", mod: { luck: 0.08 } },
    { id: "reroll", name: "逆天改命", cost: 60, max: 1, desc: "解锁开局重roll灵根的能力。", mod: { reroll: true } },
    { id: "extraTech", name: "夙慧", cost: 70, max: 1, desc: "解锁后开局额外获得 1 门随机功法。", mod: { startTech: true } },
  ];

  const RARITY_NAME = ["", "黄阶", "玄阶", "地阶", "天阶"];
  const RARITY_COLOR = ["", "#9fb0c0", "#6fb7ff", "#c08bff", "#ffcb5b"];

  return {
    REALMS, SPIRIT_ROOTS, TECHNIQUES, ARTIFACTS, PILLS, ENEMIES, BOSSES,
    ENEMY_SKILLS, REGIONS, EVENTS, SHOP_TIERS, META_UPGRADES,
    RARITY_NAME, RARITY_COLOR,
  };
})();
