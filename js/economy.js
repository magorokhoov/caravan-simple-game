/* ============ Караван: экономика и рынок ============ */
(function (root) {
  'use strict';
  const C = root.Caravan;
  const D = C.data;
  const G = D.GOODS;
  const clamp = C.util.clamp;
  const REF = D.REF_STOCK;

  /* ---------- Детерминированный ГПСЧ (mulberry32) ---------- */
  const rng = {
    next(s) {
      s.seed = (s.seed + 0x6D2B79F5) | 0;
      let t = Math.imul(s.seed ^ (s.seed >>> 15), 1 | s.seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    rand01(s) { return rng.next(s); },
    range(s, a, b) { return a + rng.next(s) * (b - a); },
    int(s, a, b) { return Math.floor(rng.range(s, a, b + 1)); },
    pick(s, arr) { return arr[Math.floor(rng.next(s) * arr.length)]; },
    chance(s, p) { return rng.next(s) < p; },
  };

  /* ---------- Инициализация города ---------- */
  function initCity(state, city) {
    const stock = {}, price = {}, prev = {};
    G.forEach(g => {
      const prod = city.prod[g.id] || 0;
      const cons = city.cons[g.id] || 0;
      const baseStock = clamp(REF + 18 * (prod - cons) + (rng.next(state) - 0.5) * 8, 8, 115);
      stock[g.id] = baseStock;
      price[g.id] = g.base;
      prev[g.id] = g.base;
    });
    return { stock, price, prev, mods: [] };
  }

  /* ---------- Цена на основе запаса ---------- */
  function fairFactor(stock) {
    return clamp(Math.pow(REF / Math.max(stock, 2), 0.55), 0.35, 2.6);
  }

  function reprice(state, cityId, goodId) {
    const cs = state.cities[cityId];
    const g = D.GOOD_BY_ID[goodId];
    const target = g.base * fairFactor(cs.stock[goodId]);
    cs.price[goodId] = clamp(cs.price[goodId] + (target - cs.price[goodId]) * 0.55, g.base * 0.3, g.base * 3);
  }

  /* ---------- Один шаг рынка ---------- */
  function stepMarket(state) {
    D.CITIES.forEach(city => {
      const cs = state.cities[city.id];
      G.forEach(g => {
        let prod = city.prod[g.id] || 0;
        let cons = city.cons[g.id] || 0;

        for (let i = 0; i < cs.mods.length; i++) {
          const m = cs.mods[i];
          if (m.good && m.good !== g.id) continue;
          if (m.prodMult) prod *= m.prodMult;
          if (m.consMult) cons *= m.consMult;
        }

        let st = cs.stock[g.id];
        st += prod - cons;
        st += (rng.next(state) - 0.5) * 0.9;      // мелкий шум
        st += (REF - st) * 0.05;                   // встречная торговля
        st = clamp(st, 2, 120);
        cs.stock[g.id] = st;

        const target = g.base * fairFactor(st);
        cs.prev[g.id] = cs.price[g.id];
        let p = cs.price[g.id] + (target - cs.price[g.id]) * 0.42;
        p += (rng.next(state) - 0.5) * g.vol * 0.22 * p;
        cs.price[g.id] = clamp(p, g.base * 0.3, g.base * 3);
      });

      for (let i = 0; i < cs.mods.length; i++) cs.mods[i].days--;
      cs.mods = cs.mods.filter(m => m.days > 0);
    });
  }

  /* ---------- Цены сделки ---------- */
  const buyPrice = p => Math.max(1, Math.round(p * 1.03));
  const sellPrice = p => Math.max(1, Math.round(p * 0.97));

  /* ---------- Кратчайшее расстояние по трактам (в днях) ---------- */
  function distanceDays(from, to) {
    if (from === to) return 0;
    const dist = {}, seen = {};
    D.CITIES.forEach(c => { dist[c.id] = Infinity; });
    dist[from] = 0;
    for (;;) {
      let best = null, bestD = Infinity;
      D.CITIES.forEach(c => {
        if (!seen[c.id] && dist[c.id] < bestD) { bestD = dist[c.id]; best = c.id; }
      });
      if (best === null) break;
      if (best === to) return dist[to];
      seen[best] = true;
      D.ADJ[best].forEach(edge => {
        const nd = dist[best] + edge.days;
        if (nd < dist[edge.to]) dist[edge.to] = nd;
      });
    }
    return dist[to] === Infinity ? 4 : dist[to];
  }

  /* ---------- Контракты ---------- */
  function makeOffers(state) {
    const from = state.cityId;
    const pool = D.CITIES.filter(c => c.id !== from);
    const offers = [];
    const used = new Set();
    const count = rng.chance(state, 0.55) ? 2 : 1;

    for (let i = 0; i < count; i++) {
      let dest = null;
      for (let k = 0; k < 12; k++) {
        const cand = rng.pick(state, pool);
        if (!used.has(cand.id)) { dest = cand; break; }
      }
      if (!dest) continue;
      used.add(dest.id);

      const wanted = G.filter(g => (dest.cons[g.id] || 0) > 0);
      const good = rng.pick(state, wanted.length ? wanted : G);
      const dist = Math.max(1, distanceDays(from, dest.id));
      const qty = rng.int(state, 6, 17);
      const deadline = state.day + Math.ceil(dist * 1.7) + 6;
      const reward = Math.round(qty * good.base * (1.5 + dist * 0.07) + dist * 35);

      offers.push({
        id: 'o' + Math.floor(rng.next(state) * 1e9).toString(36),
        good: good.id, qty, to: dest.id, reward, deadline, made: state.day,
      });
    }
    return offers;
  }

  C.economy = {
    rng, rand01: rng.rand01, chance: rng.chance, pick: rng.pick,
    initCity, stepMarket, fairFactor, reprice, buyPrice, sellPrice,
    distanceDays, makeOffers,
  };
})(typeof window !== 'undefined' ? window : globalThis);
