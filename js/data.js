/* ============ Караван: данные мира ============ */
(function (root) {
  'use strict';
  const C = (root.Caravan = root.Caravan || {});

  /* ---------- Товары ---------- */
  const GOODS = [
    { id: 'dates',   name: 'Финики',   icon: '🌴', base: 6,  vol: 0.10, color: '#c9a227' },
    { id: 'salt',    name: 'Соль',     icon: '🧂', base: 11, vol: 0.11, color: '#d9d9d9' },
    { id: 'pottery', name: 'Керамика', icon: '🏺', base: 17, vol: 0.13, color: '#c06a3c' },
    { id: 'iron',    name: 'Железо',   icon: '⛏️', base: 26, vol: 0.15, color: '#8fa3b8' },
    { id: 'spice',   name: 'Специи',   icon: '🌶️', base: 40, vol: 0.19, color: '#d9483b' },
    { id: 'silk',    name: 'Шёлк',     icon: '🧵', base: 62, vol: 0.21, color: '#a86ad9' },
  ];
  const GOOD_BY_ID = {};
  GOODS.forEach(g => { GOOD_BY_ID[g.id] = g; });

  /* ---------- Города ---------- */
  const CITIES = [
    {
      id: 'mirra', name: 'Мирра', x: 118, y: 196, tier: 1,
      desc: 'Пыльный городишко среди финиковых рощ. Всё своё — дёшево, всё привозное — по тройной цене.',
      prod: { dates: 3.2, pottery: 1.6 },
      cons: { salt: 0.6, iron: 0.4, silk: 0.35 },
    },
    {
      id: 'kumran', name: 'Кумран', x: 332, y: 108, tier: 2,
      desc: 'Шахтёрский город у сухого русла. Железо и соль грузят круглые сутки, а финики привозят издалека.',
      prod: { iron: 1.7, salt: 1.4 },
      cons: { dates: 1.3, pottery: 0.5, spice: 0.3 },
    },
    {
      id: 'azhar', name: 'Азхар', x: 172, y: 438, tier: 3,
      desc: 'Столица караванов. Здесь торгуют все и всем, поэтому дешёвого не найти — зато продать можно что угодно.',
      prod: { spice: 0.7, silk: 0.4 },
      cons: { dates: 2.2, pottery: 1.0, salt: 0.9, iron: 0.7, silk: 0.6 },
    },
    {
      id: 'sabbat', name: 'Саббат', x: 436, y: 302, tier: 2,
      desc: 'Гончарный квартал, растянутый на три холма. Керамика здесь стоит дешевле воды, а вода — дороже керамики.',
      prod: { pottery: 2.6, silk: 0.9 },
      cons: { dates: 1.4, iron: 0.8, salt: 0.5, spice: 0.4 },
    },
    {
      id: 'khaled', name: 'Халед', x: 566, y: 92, tier: 2,
      desc: 'Город ткачей в предгорьях. Шёлк выделывают так тонко, что он просвечивает на солнце.',
      prod: { silk: 1.3, dates: 0.5 },
      cons: { salt: 0.9, iron: 0.3, pottery: 0.4 },
    },
    {
      id: 'nabat', name: 'Набат', x: 468, y: 512, tier: 1,
      desc: 'Соляные копи и финиковые плантации. Богатство лежит под ногами, но продавать его некому.',
      prod: { salt: 2.2, dates: 1.2 },
      cons: { silk: 0.5, pottery: 0.5, spice: 0.5, iron: 0.3 },
    },
    {
      id: 'zordan', name: 'Зордан', x: 648, y: 336, tier: 3,
      desc: 'Крупнейший перекрёсток востока. Сорок караван-сараев, три базара и ни одного честного менялы.',
      prod: { iron: 1.1, pottery: 0.8 },
      cons: { dates: 2.0, silk: 0.9, spice: 0.8, salt: 0.7 },
    },
    {
      id: 'kayrum', name: 'Кайрум', x: 792, y: 162, tier: 2,
      desc: 'Оазис с плантациями перца. Специи здесь мешают лопатой — но за железом приходится посылать.',
      prod: { spice: 1.5, dates: 1.6 },
      cons: { iron: 1.0, silk: 0.4, pottery: 0.6, salt: 0.4 },
    },
    {
      id: 'tarshis', name: 'Таршис', x: 892, y: 392, tier: 3,
      desc: 'Богатый торговый город за перевалом. Сюда сходятся шелка и специи, отсюда — слухи и долги.',
      prod: { silk: 1.8, spice: 0.9 },
      cons: { dates: 1.6, salt: 0.9, iron: 1.2, pottery: 1.0 },
    },
    {
      id: 'eshtari', name: 'Эш-Тари', x: 724, y: 540, tier: 1,
      desc: 'Пограничная кузница. Железа хватает на весь восток, но живут здесь скудно и покупают мало.',
      prod: { iron: 2.1, pottery: 0.6 },
      cons: { dates: 1.1, salt: 1.1, spice: 0.7, silk: 0.5 },
    },
  ];
  const CITY_BY_ID = {};
  CITIES.forEach(c => { CITY_BY_ID[c.id] = c; });

  /* ---------- Тракты ---------- */
  const ROUTES = [
    { a: 'mirra',   b: 'kumran',  days: 2, risk: 0.05 },
    { a: 'mirra',   b: 'azhar',   days: 2, risk: 0.04 },
    { a: 'mirra',   b: 'sabbat',  days: 3, risk: 0.06 },
    { a: 'kumran',  b: 'khaled',  days: 2, risk: 0.05 },
    { a: 'azhar',   b: 'sabbat',  days: 3, risk: 0.07 },
    { a: 'azhar',   b: 'nabat',   days: 3, risk: 0.08 },
    { a: 'sabbat',  b: 'khaled',  days: 3, risk: 0.06 },
    { a: 'sabbat',  b: 'zordan',  days: 2, risk: 0.05 },
    { a: 'sabbat',  b: 'nabat',   days: 2, risk: 0.07 },
    { a: 'khaled',  b: 'kayrum',  days: 3, risk: 0.09 },
    { a: 'khaled',  b: 'zordan',  days: 3, risk: 0.08 },
    { a: 'nabat',   b: 'zordan',  days: 2, risk: 0.06 },
    { a: 'nabat',   b: 'eshtari', days: 2, risk: 0.10 },
    { a: 'zordan',  b: 'kayrum',  days: 2, risk: 0.07 },
    { a: 'zordan',  b: 'tarshis', days: 2, risk: 0.06 },
    { a: 'kayrum',  b: 'tarshis', days: 3, risk: 0.09 },
    { a: 'tarshis', b: 'eshtari', days: 3, risk: 0.11 },
  ];

  const ADJ = {};
  CITIES.forEach(c => { ADJ[c.id] = []; });
  ROUTES.forEach(r => {
    ADJ[r.a].push({ to: r.b, days: r.days, risk: r.risk });
    ADJ[r.b].push({ to: r.a, days: r.days, risk: r.risk });
  });

  function routeBetween(a, b) {
    for (let i = 0; i < ROUTES.length; i++) {
      const r = ROUTES[i];
      if ((r.a === a && r.b === b) || (r.a === b && r.b === a)) return r;
    }
    return null;
  }

  /* ---------- Дорожные события ---------- */
  const EVENTS = {
    ambush: {
      icon: '🗡️', title: 'Засада на тракте', tone: 'bad',
      text: () => 'Из-за бархана поднялись всадники. Их вдвое больше, чем твоих людей, и дорога простреливается насквозь.',
      choices: [
        {
          id: 'pay', label: 'Откупиться', hint: d => `−${d.toll} золота`,
          apply(s, d) {
            s.gold -= d.toll;
            C.game.log(s, `Откупились от разбойников: −${d.toll} золота.`, 'bad');
          },
        },
        {
          id: 'fight', label: 'Отбиваться', hint: d => `шанс ${Math.round(d.fightChance * 100)}%`,
          apply(s, d) {
            if (C.economy.rand01(s) < d.fightChance) {
              s.reputation += 1;
              C.game.log(s, 'Охрана отбила нападение. Караван идёт дальше.', 'good');
            } else {
              const lost = C.game.dropCargoPercent(s, 0.25);
              C.game.log(s, `Отбиться не вышло — потеряли ${lost} ед. груза.`, 'bad');
            }
          },
        },
        {
          id: 'drop', label: 'Бросить часть груза', hint: () => '−30% груза',
          apply(s, d) {
            const lost = C.game.dropCargoPercent(s, 0.3);
            C.game.log(s, `Разбойники взяли выкуп товаром: −${lost} ед.`, 'bad');
          },
        },
      ],
    },

    storm: {
      icon: '🌪️', title: 'Песчаная буря', tone: 'bad',
      text: () => 'Стена песка идёт с запада. Верблюды ложатся, проводник ругается и показывает на горизонт.',
      choices: [
        {
          id: 'wait', label: 'Переждать в укрытии', hint: () => '+1 день в пути',
          apply(s) {
            if (s.travel) s.travel.total += 1;
            C.game.log(s, 'Бурю переждали в скалах. Потеряли день.', 'bad');
          },
        },
        {
          id: 'push', label: 'Идти напролом', hint: () => '−12% груза',
          apply(s, d) {
            const lost = C.game.dropCargoPercent(s, 0.12);
            C.game.log(s, `Пробились сквозь бурю, но потеряли ${lost} ед. груза.`, 'bad');
          },
        },
      ],
    },

    merchant: {
      icon: '🧔', title: 'Встречный купец', tone: 'good',
      text: d => `Одинокий торговец с двумя мулами. Улыбается слишком широко. Говорит, что скупает ${d.goodName} по ${d.sellUnit} и продаёт ${d.goodName2} по ${d.buyUnit}.`,
      choices: [
        {
          id: 'sell', label: 'Продать ему товар', hint: d => `+${d.sellUnit * d.sellQty} золота`,
          apply(s, d) {
            if (s.cargo[d.goodId] < d.sellQty) {
              C.game.log(s, 'Купец усмехнулся: такого количества у тебя нет.', 'bad');
              return;
            }
            s.cargo[d.goodId] -= d.sellQty;
            s.gold += d.sellUnit * d.sellQty;
            C.game.log(s, `Продали ${d.sellQty} × ${d.goodName} встречному купцу: +${d.sellUnit * d.sellQty} золота.`, 'good');
          },
        },
        {
          id: 'buy', label: 'Купить у него товар', hint: d => `−${d.buyUnit * d.buyQty} золота`,
          apply(s, d) {
            const free = s.capacity - C.game.cargoCount(s);
            const qty = Math.min(d.buyQty, free);
            const cost = d.buyUnit * qty;
            if (qty <= 0) { C.game.log(s, 'Купец развёл руками: в караване нет места.', 'bad'); return; }
            if (s.gold < cost) { C.game.log(s, 'Купец развёл руками: не хватает золота.', 'bad'); return; }
            s.gold -= cost;
            s.cargo[d.goodId2] += qty;
            C.game.log(s, `Купили ${qty} × ${d.goodName2} по ${d.buyUnit}: −${cost} золота.`, 'good');
          },
        },
        {
          id: 'skip', label: 'Пройти мимо', hint: () => 'ничего не меняется',
          apply(s) { C.game.log(s, 'Купец проводил караван долгим взглядом.'); },
        },
      ],
    },

    loot: {
      icon: '🪙', title: 'Брошенный караван', tone: 'good',
      text: d => `У обочины — опрокинутая арба и ни одного живого. В тюках ${d.gold} золота и записка: «Не останавливайся».`,
      choices: [
        {
          id: 'take', label: 'Забрать золото', hint: d => `+${d.gold}`,
          apply(s, d) {
            s.gold += d.gold;
            C.game.log(s, `Подобрали ${d.gold} золота в брошенном караване.`, 'good');
          },
        },
        {
          id: 'leave', label: 'Не трогать чужое', hint: () => '+2 репутации',
          apply(s) {
            s.reputation += 2;
            C.game.log(s, 'Прошли мимо. Дурная слава — тоже товар, и он дорогой.', 'good');
          },
        },
      ],
    },

    rumor: {
      icon: '👂', title: 'Слух на привале', tone: 'neutral',
      text: d => `У костра шепчутся погонщики: в ${d.cityName} скупают ${d.goodName} и платят не торгуясь. Слух свежий — дня три-четыре.`,
      choices: [
        {
          id: 'ok', label: 'Принять к сведению', hint: () => 'рынок уже шевельнулся',
          apply(s, d) {
            C.game.log(s, `Слух подтвердился: в ${d.cityName} растёт спрос на ${d.goodName}.`);
          },
        },
      ],
    },

    wheel: {
      icon: '🛞', title: 'Сломалось колесо', tone: 'bad',
      text: d => `Ось треснула на спуске. Плотник просит ${d.cost} золота, иначе — два дня пешком и потерь не избежать.`,
      choices: [
        {
          id: 'fix', label: 'Заплатить плотнику', hint: d => `−${d.cost} золота`,
          apply(s, d) {
            s.gold -= d.cost;
            C.game.log(s, `Починили арбу: −${d.cost} золота.`, 'bad');
          },
        },
        {
          id: 'walk', label: 'Обойтись своими силами', hint: () => '+2 дня',
          apply(s) {
            if (s.travel) s.travel.total += 2;
            C.game.log(s, 'Чинили сами два дня. Зато бесплатно.', 'bad');
          },
        },
      ],
    },
  };

  /* ---------- Утилиты ---------- */
  const util = {
    clamp: (v, a, b) => Math.min(b, Math.max(a, v)),
    fmt: n => Math.round(n).toLocaleString('ru-RU'),
    plural(n, one, few, many) {
      const a = Math.abs(n) % 100, b = a % 10;
      if (a > 10 && a < 20) return many;
      if (b > 1 && b < 5) return few;
      if (b === 1) return one;
      return many;
    },
  };

  C.data = { GOODS, GOOD_BY_ID, CITIES, CITY_BY_ID, ROUTES, ADJ, EVENTS, routeBetween, REF_STOCK: 45 };
  C.util = util;
})(typeof window !== 'undefined' ? window : globalThis);
