/* ============ Караван: правила игры ============ */
(function (root) {
  'use strict';
  const C = root.Caravan;
  const D = C.data;
  const E = C.economy;
  const G = D.GOODS;
  const fmt = C.util.fmt;
  const Game = (C.game = {});

  const UPGRADES = {
    capacity: {
      icon: '📦', name: 'Расширить караван', desc: '+15 мест в грузе',
      max: 4, cost: lvl => 320 + 260 * lvl,
    },
    guards: {
      icon: '🛡️', name: 'Нанять охрану', desc: '+20% к шансу отбиться в засаде',
      max: 3, cost: lvl => 380 + 240 * lvl,
    },
    speed: {
      icon: '🐎', name: 'Быстрые верблюды', desc: '−1 день в пути',
      max: 2, cost: lvl => 650 + 350 * lvl,
    },
  };
  Game.UPGRADES = UPGRADES;

  const ok = (msg) => ({ ok: true, msg: msg || '' });
  const fail = (msg) => ({ ok: false, msg });

  /* ---------- Служебное ---------- */
  Game.log = function (s, text, kind) {
    s.log.push({ d: s.day, t: text, k: kind || '' });
    if (s.log.length > 80) s.log.splice(0, s.log.length - 80);
  };

  Game.cargoCount = function (s) {
    let n = 0;
    G.forEach(g => { n += s.cargo[g.id] || 0; });
    return n;
  };

  Game.cargoValue = function (s) {
    let v = 0;
    G.forEach(g => { v += (s.cargo[g.id] || 0) * g.base; });
    return v;
  };

  Game.capital = function (s) { return s.gold + Game.cargoValue(s); };

  Game.upkeep = function (s) {
    return 6 + s.upgrades.guards * 2 + s.upgrades.capacity;
  };

  Game.neighbors = function (s) {
    return D.ADJ[s.cityId].map(edge => {
      const c = D.CITY_BY_ID[edge.to];
      return { id: edge.to, name: c.name, days: Math.max(1, edge.days - s.upgrades.speed), risk: edge.risk };
    });
  };

  /* ---------- Новая игра ---------- */
  Game.newGame = function (seed) {
    const s = {
      version: 1,
      seed: (seed == null ? Math.floor(Math.random() * 1e9) : seed) | 0,
      day: 1,
      maxDays: 140,
      target: 15000,
      gold: 500,
      reputation: 0,
      cargo: {},
      capacity: 60,
      upgrades: { capacity: 0, guards: 0, speed: 0 },
      cityId: 'mirra',
      travel: null,
      cities: {},
      contracts: [],
      offers: [],
      log: [],
      pending: null,
      gameOver: null,
      stats: { trips: 0, trades: 0, contracts: 0 },
    };
    G.forEach(g => { s.cargo[g.id] = 0; });
    D.CITIES.forEach(c => { s.cities[c.id] = E.initCity(s, c); });
    for (let i = 0; i < 26; i++) E.stepMarket(s);
    s.offers = E.makeOffers(s);
    Game.log(s, `Караван выходит из Мирры. В кошеле ${s.gold} золота, в горбу — надежда.`);
    return s;
  };

  /* ---------- Торговля ---------- */
  Game.maxBuy = function (s, goodId) {
    if (s.travel) return 0;
    const cs = s.cities[s.cityId];
    const unit = E.buyPrice(cs.price[goodId]);
    const free = s.capacity - Game.cargoCount(s);
    const stock = Math.floor(cs.stock[goodId]);
    return Math.max(0, Math.min(Math.floor(s.gold / unit), free, stock));
  };

  Game.buy = function (s, goodId, qty) {
    if (s.gameOver) return fail('Сезон окончен');
    if (s.travel) return fail('В пути торговать не с кем');
    if (s.pending) return fail('Сначала разберись с событием');
    const g = D.GOOD_BY_ID[goodId];
    if (!g) return fail('Нет такого товара');

    const cs = s.cities[s.cityId];
    const unit = E.buyPrice(cs.price[goodId]);
    let n = qty === 'max' ? Game.maxBuy(s, goodId) : Math.floor(Number(qty) || 0);
    n = Math.min(n, Game.maxBuy(s, goodId));
    if (n <= 0) return fail('Нечем платить или некуда грузить');

    s.gold -= unit * n;
    s.cargo[goodId] += n;
    cs.stock[goodId] = Math.max(2, cs.stock[goodId] - n);
    E.reprice(s, s.cityId, goodId);
    s.stats.trades++;
    Game.log(s, `Купили ${n} × ${g.name} по ${unit} — итого ${unit * n}.`);
    return ok();
  };

  Game.sell = function (s, goodId, qty) {
    if (s.gameOver) return fail('Сезон окончен');
    if (s.travel) return fail('В пути торговать не с кем');
    if (s.pending) return fail('Сначала разберись с событием');
    const g = D.GOOD_BY_ID[goodId];
    if (!g) return fail('Нет такого товара');

    const have = s.cargo[goodId] || 0;
    const n = qty === 'all' ? have : Math.min(have, Math.floor(Number(qty) || 0));
    if (n <= 0) return fail('Этого товара у тебя нет');

    const cs = s.cities[s.cityId];
    const unit = E.sellPrice(cs.price[goodId]);
    s.gold += unit * n;
    s.cargo[goodId] = have - n;
    cs.stock[goodId] = Math.min(120, cs.stock[goodId] + n);
    E.reprice(s, s.cityId, goodId);
    s.stats.trades++;
    Game.log(s, `Продали ${n} × ${g.name} по ${unit} — выручка ${unit * n}.`, 'good');
    return ok();
  };

  /* ---------- Дорога ---------- */
  Game.travelTo = function (s, toId) {
    if (s.gameOver) return fail('Сезон окончен');
    if (s.pending) return fail('Сначала разберись с событием');
    if (s.travel) return fail('Караван уже в пути');
    const route = D.routeBetween(s.cityId, toId);
    if (!route) return fail('Прямого тракта нет — иди через соседний город');
    const days = Math.max(1, route.days - s.upgrades.speed);
    s.travel = { from: s.cityId, to: toId, total: days, elapsed: 0, baseDays: route.days, risk: route.risk };
    Game.log(s, `Караван выдвинулся в ${D.CITY_BY_ID[toId].name} — ${days} ${C.util.plural(days, 'день', 'дня', 'дней')}.`);
    return ok();
  };

  function arrive(s) {
    const dest = s.travel.to;
    s.travel = null;
    s.cityId = dest;
    s.stats.trips++;
    const city = D.CITY_BY_ID[dest];
    Game.log(s, `Караван прибыл в ${city.name}.`);
    s.offers = E.makeOffers(s);
    if (E.chance(s, 0.28)) cityEvent(s, city);
  }

  function cityEvent(s, city) {
    const cs = s.cities[city.id];
    const roll = E.rand01(s);

    if (roll < 0.4) {
      const pool = G.filter(g => (city.cons[g.id] || 0) > 0);
      if (!pool.length) return;
      const g = E.pick(s, pool);
      cs.mods.push({ good: g.id, consMult: 2.2, days: 4 + E.rng.int(s, 0, 2) });
      Game.log(s, `🎉 В ${city.name} праздник: ${g.name.toLowerCase()} сметают с прилавков.`, 'good');
    } else if (roll < 0.7) {
      const pool = G.filter(g => (city.prod[g.id] || 0) > 0);
      if (!pool.length) return;
      const g = E.pick(s, pool);
      cs.mods.push({ good: g.id, prodMult: 0.35, days: 5 + E.rng.int(s, 0, 2) });
      Game.log(s, `🌵 Засуха в ${city.name}: ${g.name.toLowerCase()} почти не поступает на рынок.`, 'bad');
    } else {
      cs.mods.push({ consMult: 1.35, days: 4 });
      Game.log(s, `🐫 В ${city.name} пришёл большой караван покупателей — цены пошли вверх.`, 'good');
    }
  }

  /* ---------- Дорожные события ---------- */
  function eventCandidates(s) {
    const ids = ['storm', 'loot', 'rumor', 'wheel'];
    if (Game.cargoCount(s) > 0) ids.push('merchant');
    if (s.gold >= 40 || Game.cargoCount(s) > 0) ids.push('ambush');
    return ids;
  }

  function buildEventData(s, id) {
    switch (id) {
      case 'ambush': {
        return {
          toll: Math.max(25, Math.round(s.gold * 0.14)),
          fightChance: 0.35 + 0.2 * s.upgrades.guards,
        };
      }
      case 'storm': return {};
      case 'wheel': return { cost: Math.round(E.rng.range(s, 40, 100)) };
      case 'loot': return { gold: Math.round(E.rng.range(s, 45, 120)) };
      case 'rumor': {
        const others = D.CITIES.filter(c => c.id !== s.cityId && (!s.travel || c.id !== s.travel.to));
        const city = E.pick(s, others);
        const pool = G.filter(g => (city.cons[g.id] || 0) > 0);
        const g = E.pick(s, pool.length ? pool : G);
        s.cities[city.id].mods.push({ good: g.id, consMult: 1.9, days: 6 });
        return { cityName: city.name, goodName: g.name.toLowerCase() };
      }
      case 'merchant': {
        const withCargo = G.filter(g => (s.cargo[g.id] || 0) > 0);
        const g1 = withCargo.length ? E.pick(s, withCargo) : E.pick(s, G);
        const g2 = E.pick(s, G);
        const origin = s.cities[s.cityId];
        return {
          goodId: g1.id, goodName: g1.name,
          goodId2: g2.id, goodName2: g2.name,
          sellUnit: Math.round(E.sellPrice(origin.price[g1.id]) * 1.22),
          sellQty: Math.max(1, Math.min(s.cargo[g1.id] || 0, 8)),
          buyUnit: Math.round(E.buyPrice(origin.price[g2.id]) * 0.75),
          buyQty: 8,
        };
      }
      default: return {};
    }
  }

  function maybeTravelEvent(s) {
    if (!E.chance(s, 0.22)) return;
    const id = E.pick(s, eventCandidates(s));
    s.pending = { id, data: buildEventData(s, id) };
  }

  Game.resolveEvent = function (s, choiceId) {
    if (!s.pending) return fail('Нет события');
    const ev = D.EVENTS[s.pending.id];
    if (!ev) { s.pending = null; return ok(); }
    const choice = ev.choices.find(c => c.id === choiceId);
    if (!choice) return fail('Нет такого выбора');
    const data = s.pending.data;
    s.pending = null;
    choice.apply(s, data);
    if (s.gold < 0) Game.settleDebt(s);
    Game.checkEnd(s);
    return ok();
  };

  /* ---------- Долг: распродажа за бесценок ---------- */
  Game.settleDebt = function (s) {
    const cs = s.cities[s.cityId];
    let sold = 0;
    let guard = 0;
    while (s.gold < 0 && Game.cargoCount(s) > 0 && guard++ < 200) {
      let best = null;
      G.forEach(g => {
        const have = s.cargo[g.id] || 0;
        if (have > 0 && (!best || have * g.base > s.cargo[best] * D.GOOD_BY_ID[best].base)) best = g.id;
      });
      if (!best) break;
      const unit = Math.max(1, Math.round(E.sellPrice(cs.price[best]) * 0.6));
      const need = Math.ceil(-s.gold / unit);
      const n = Math.min(need, s.cargo[best]);
      s.cargo[best] -= n;
      s.gold += unit * n;
      cs.stock[best] = Math.min(120, cs.stock[best] + n);
      E.reprice(s, s.cityId, best);
      sold += n;
    }
    if (sold > 0) {
      Game.log(s, `Нечем платить за содержание — распродали ${sold} ед. груза за бесценок.`, 'bad');
    }
    return sold;
  };

  /* ---------- Груз ---------- */
  Game.dropCargoPercent = function (s, pct, goodId) {
    let lost = 0;
    G.forEach(g => {
      if (goodId && g.id !== goodId) return;
      const n = Math.floor((s.cargo[g.id] || 0) * pct);
      if (n > 0) { s.cargo[g.id] -= n; lost += n; }
    });
    if (lost === 0) {
      let best = null;
      G.forEach(g => { if ((s.cargo[g.id] || 0) > 0 && (!best || s.cargo[g.id] > s.cargo[best])) best = g.id; });
      if (best) { s.cargo[best] -= 1; lost = 1; }
    }
    return lost;
  };

  /* ---------- Контракты ---------- */
  Game.acceptOffer = function (s, id) {
    if (s.travel) return fail('Сначала нужно прибыть в город');
    const idx = s.offers.findIndex(o => o.id === id);
    if (idx < 0) return fail('Предложение уже неактуально');
    const o = s.offers[idx];
    s.offers.splice(idx, 1);
    s.contracts.push(o);
    Game.log(s, `Взяли контракт: ${o.qty} × ${D.GOOD_BY_ID[o.good].name} → ${D.CITY_BY_ID[o.to].name}, срок ${Math.max(0, o.deadline - s.day)} дн.`);
    return ok();
  };

  Game.deliverContract = function (s, id) {
    if (s.travel) return fail('Нужно быть в городе');
    const idx = s.contracts.findIndex(c => c.id === id);
    if (idx < 0) return fail('Контракта нет');
    const c = s.contracts[idx];
    if (c.to !== s.cityId) return fail('Этот контракт сдают в другом городе');
    if ((s.cargo[c.good] || 0) < c.qty) return fail('Не хватает товара для сдачи');
    s.cargo[c.good] -= c.qty;
    s.gold += c.reward;
    s.reputation += 3;
    s.stats.contracts++;
    s.contracts.splice(idx, 1);
    Game.log(s, `Контракт выполнен: +${c.reward} золота, +3 репутации.`, 'good');
    Game.checkEnd(s);
    return ok();
  };

  function checkContracts(s) {
    for (let i = s.contracts.length - 1; i >= 0; i--) {
      const c = s.contracts[i];
      if (s.day > c.deadline) {
        s.contracts.splice(i, 1);
        s.reputation = Math.max(0, s.reputation - 8);
        Game.log(s, `Срок контракта на ${D.GOOD_BY_ID[c.good].name} в ${D.CITY_BY_ID[c.to].name} истёк. −8 репутации.`, 'bad');
      }
    }
  }

  /* ---------- Улучшения ---------- */
  Game.upgradeCost = function (s, kind) {
    const u = UPGRADES[kind];
    if (!u) return 0;
    const lvl = s.upgrades[kind];
    if (lvl >= u.max) return null;
    return u.cost(lvl);
  };

  Game.upgrade = function (s, kind) {
    if (s.travel) return fail('Улучшения — только в городе');
    const u = UPGRADES[kind];
    if (!u) return fail('Нет такого улучшения');
    if (s.upgrades[kind] >= u.max) return fail('Уже максимум');
    const cost = Game.upgradeCost(s, kind);
    if (s.gold < cost) return fail(`Нужно ${fmt(cost)} золота`);
    s.gold -= cost;
    s.upgrades[kind]++;
    if (kind === 'capacity') s.capacity = 60 + 15 * s.upgrades.capacity;
    Game.log(s, `${u.name} — уровень ${s.upgrades[kind]}. −${fmt(cost)} золота.`, 'good');
    return ok();
  };

  /* ---------- Ход ---------- */
  Game.advanceDay = function (s) {
    if (s.gameOver || s.pending) return;
    s.day++;
    E.stepMarket(s);
    s.gold -= Game.upkeep(s);
    if (s.gold < 0) Game.settleDebt(s);
    if (s.travel) {
      s.travel.elapsed++;
      if (s.travel.elapsed >= s.travel.total) arrive(s);
      else maybeTravelEvent(s);
    }
    checkContracts(s);
    Game.checkEnd(s);
  };

  Game.waitDay = function (s) {
    if (s.travel) return fail('Караван в пути');
    if (s.pending) return fail('Сначала разберись с событием');
    Game.advanceDay(s);
    return ok();
  };

  /* ---------- Финал ---------- */
  function end(s, win, reason) {
    s.gameOver = { win: !!win, reason, day: s.day, capital: Game.capital(s) };
    s.pending = null;
    Game.log(s, win ? '🏁 Цель достигнута.' : '💀 Караван закончил путь.', win ? 'good' : 'bad');
  }
  Game.end = end;

  Game.checkEnd = function (s) {
    if (s.gameOver) return;
    const cap = Game.capital(s);
    if (cap >= s.target) {
      end(s, true, `Капитал ${fmt(cap)} золота. Тебя знают от Мирры до Таршиса — и боятся давать в долг.`);
      return;
    }
    if (s.gold < 0 && Game.cargoCount(s) === 0) {
      end(s, false, `Долг ${fmt(-s.gold)} золота — продавать больше нечего. Караванщики разошлись, верблюды ушли с молотка.`);
      return;
    }
    if (s.day > s.maxDays) {
      end(s, false, `Сезон кончился. Капитал ${fmt(cap)} против цели ${fmt(s.target)} — рынок тебя не запомнил.`);
    }
  };

  /* ---------- Совместимость с сохранением ---------- */
  Game.sanitize = function (s) {
    if (!s || typeof s !== 'object') return null;
    if (s.version !== 1) return null;
    if (!s.cities || !s.cityId || !D.CITY_BY_ID[s.cityId]) return null;
    G.forEach(g => { if (typeof s.cargo[g.id] !== 'number') s.cargo[g.id] = 0; });
    if (!Array.isArray(s.contracts)) s.contracts = [];
    if (!Array.isArray(s.offers)) s.offers = [];
    if (!Array.isArray(s.log)) s.log = [];
    if (!s.upgrades) s.upgrades = { capacity: 0, guards: 0, speed: 0 };
    if (!s.stats) s.stats = { trips: 0, trades: 0, contracts: 0 };
    return s;
  };
})(typeof window !== 'undefined' ? window : globalThis);
