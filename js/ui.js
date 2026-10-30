/* ============ Караван: интерфейс ============ */
(function (root) {
  'use strict';
  const C = root.Caravan;
  const D = C.data;
  const G = D.GOODS;
  const U = C.util;
  const fmt = U.fmt;
  const Game = C.game;
  const Save = C.save;
  const UI = (C.ui = {});

  let state = null;
  let tab = 'market';
  let timer = null;
  let toastTimer = null;
  let els = {};
  let locked = false;

  const $ = sel => document.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  /* ---------- Запуск ---------- */
  UI.boot = function () {
    els = {
      day: $('#stat-day'), days: $('#stat-days'), gold: $('#stat-gold'),
      cargo: $('#stat-cargo'), capital: $('#stat-capital'), target: $('#stat-target'),
      progress: $('#stat-progress'), rep: $('#stat-rep'),
      city: $('#city-card'), market: $('#market-card'), contracts: $('#contracts-card'),
      log: $('#log'), modal: $('#modal-root'), toast: $('#toast'),
      map: $('#map'), hint: $('#map-hint'), importFile: $('#import-file'),
      badge: $('#contract-badge'),
    };

    buildMap();
    wire();

    const saved = Save.readLocal();
    state = saved || Game.newGame();
    UI.render();

    if (!saved) showIntro();
    else if (state.travel && !state.pending) startLoop();
    else if (state.gameOver) showEnd();
  };

  /* ---------- Карта ---------- */
  function buildMap() {
    let html = '<g id="routes">';
    D.ROUTES.forEach(r => {
      const a = D.CITY_BY_ID[r.a], b = D.CITY_BY_ID[r.b];
      html += `<line class="route" data-a="${r.a}" data-b="${r.b}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}">` +
        `<title>${a.name} — ${b.name} · ${r.days} дн · риск ${Math.round(r.risk * 100)}%</title></line>`;
    });
    html += '</g><g id="cities">';
    D.CITIES.forEach(c => {
      const tags = Object.keys(c.prod).map(k => D.GOOD_BY_ID[k].icon).join(' ');
      html += `<g class="city" data-city="${c.id}" data-action="travel" data-value="${c.id}" transform="translate(${c.x},${c.y})">
        <circle class="halo" r="28"></circle>
        <circle class="dot" r="8"></circle>
        <text class="name" y="-27">${c.name}</text>
        <text class="tag" y="29">${tags}</text>
      </g>`;
    });
    html += '</g><g id="caravan-mark" class="caravan-mark"><text>🐫</text></g>';
    els.map.innerHTML = html;
  }

  function renderMapState() {
    const cur = state.cityId;
    const nb = new Set(Game.neighbors(state).map(n => n.id));

    els.map.querySelectorAll('.city').forEach(el => {
      const id = el.dataset.city;
      el.classList.toggle('current', id === cur);
      el.classList.toggle('reachable', nb.has(id) && !state.travel && id !== cur);
      el.classList.toggle('destination', !!state.travel && id === state.travel.to);
    });

    els.map.querySelectorAll('.route').forEach(el => {
      const touch = el.dataset.a === cur || el.dataset.b === cur;
      el.classList.toggle('reachable', touch && !state.travel);
    });

    const mark = els.map.querySelector('#caravan-mark');
    let x, y;
    if (state.travel) {
      const A = D.CITY_BY_ID[state.travel.from];
      const B = D.CITY_BY_ID[state.travel.to];
      const p = Math.min(1, state.travel.elapsed / state.travel.total);
      x = A.x + (B.x - A.x) * p;
      y = A.y + (B.y - A.y) * p;
    } else {
      const c = D.CITY_BY_ID[cur];
      x = c.x; y = c.y;
    }
    mark.style.transform = `translate(${x + 22}px, ${y - 2}px)`;

    if (state.travel) {
      const to = D.CITY_BY_ID[state.travel.to];
      els.hint.textContent = `В пути в ${to.name} — ${state.travel.elapsed} из ${state.travel.total} дн.`;
    } else {
      els.hint.textContent = 'Соседние города подсвечены — нажми, чтобы отправиться';
    }
  }

  /* ---------- Верхняя панель ---------- */
  function renderTop() {
    els.day.textContent = state.day;
    els.days.textContent = '/ ' + state.maxDays;
    els.gold.textContent = fmt(state.gold);
    els.gold.classList.toggle('neg', state.gold < 0);
    els.cargo.textContent = Game.cargoCount(state) + '/' + state.capacity;
    const cap = Game.capital(state);
    els.capital.textContent = fmt(cap);
    els.target.textContent = '/ ' + fmt(state.target);
    els.progress.style.width = Math.min(100, (cap / state.target) * 100) + '%';
    els.rep.textContent = state.reputation;
  }

  /* ---------- Город ---------- */
  function renderCity() {
    const city = D.CITY_BY_ID[state.cityId];
    const icons = Object.keys(city.prod).map(k => D.GOOD_BY_ID[k].icon).join(' ');
    let html = `<div class="card-head"><h2>${esc(city.name)}</h2><span class="tag">${icons}</span></div>
      <p class="city-desc">${esc(city.desc)}</p>`;

    if (state.travel) {
      const to = D.CITY_BY_ID[state.travel.to];
      const t = state.travel;
      const dots = '●'.repeat(Math.max(0, t.elapsed)) + '○'.repeat(Math.max(0, t.total - t.elapsed));
      html += `<div class="travel-state">
        <span>🐫 В пути в <b>${esc(to.name)}</b></span>
        <span class="dots" style="margin-left:auto">${dots}</span>
        <span class="muted">${t.elapsed}/${t.total}</span>
      </div>`;
    } else {
      html += `<p class="card-title">Тракты</p><div class="travel-list">`;
      Game.neighbors(state).forEach(n => {
        html += `<button class="btn travel-btn" data-action="travel" data-value="${n.id}">
          <span>→ ${esc(n.name)}</span>
          <small>${n.days} ${U.plural(n.days, 'день', 'дня', 'дней')} · <span class="risk">риск ${Math.round(n.risk * 100)}%</span></small>
        </button>`;
      });
      html += `</div>
        <button class="btn btn-ghost btn-sm" style="margin-top:8px;width:100%" data-action="wait">
          ⏳ Переждать день · содержание ${Game.upkeep(state)} 💰
        </button>`;
    }
    els.city.innerHTML = html;
  }

  /* ---------- Рынок ---------- */
  function renderMarket() {
    if (state.travel) {
      els.market.innerHTML = `<p class="card-title">Рынок</p>
        <div class="empty-note">Караван в пути. Торговля — по прибытии.</div>`;
      return;
    }
    const city = D.CITY_BY_ID[state.cityId];
    const cs = state.cities[state.cityId];
    let html = `<div class="market-head">
        <span class="card-title">Рынок · ${esc(city.name)}</span>
        <span class="wallet">💰 <b>${fmt(state.gold)}</b> · груз ${Game.cargoCount(state)}/${state.capacity}</span>
      </div>`;

    G.forEach(g => {
      const price = cs.price[g.id];
      const prev = cs.prev[g.id] || price;
      const pct = prev > 0 ? ((price - prev) / prev) * 100 : 0;
      const trend = Math.abs(pct) < 0.6 ? '' :
        `<span class="trend ${pct > 0 ? 'up' : 'down'}">${pct > 0 ? '▲' : '▼'}${Math.abs(Math.round(pct))}%</span>`;
      const own = state.cargo[g.id] || 0;
      const buy = C.economy.buyPrice(price);
      const sell = C.economy.sellPrice(price);
      html += `<div class="market-row">
        <div class="m-name">
          <span class="icon">${g.icon}</span>
          <span class="nm">${g.name}</span>
          ${own ? `<span class="own">×${own}</span>` : ''}
        </div>
        <div class="m-price">
          <b>${buy}</b>${trend}
          <span class="sub">прод ${sell} · ${Math.round(cs.stock[g.id])} шт</span>
        </div>
        <div class="m-actions">
          <button class="btn btn-buy" data-action="buy" data-good="${g.id}" data-qty="1">+1</button>
          <button class="btn btn-buy" data-action="buy" data-good="${g.id}" data-qty="5">+5</button>
          <button class="btn btn-buy" data-action="buy" data-good="${g.id}" data-qty="max">макс</button>
          <button class="btn btn-sell" data-action="sell" data-good="${g.id}" data-qty="1">−1</button>
          <button class="btn btn-sell" data-action="sell" data-good="${g.id}" data-qty="all">всё</button>
        </div>
      </div>`;
    });
    els.market.innerHTML = html;
  }

  /* ---------- Контракты ---------- */
  function renderContracts() {
    let html = `<p class="card-title">Контракты на доставку</p>`;
    const offers = state.offers || [];

    if (state.travel) {
      html += `<div class="empty-note">Новые предложения появятся в городе.</div>`;
    } else if (!offers.length) {
      html += `<div class="empty-note">Никто ничего не заказывает. Пережди день или зайди позже.</div>`;
    } else {
      offers.forEach(o => {
        const g = D.GOOD_BY_ID[o.good], c = D.CITY_BY_ID[o.to];
        const left = Math.max(0, o.deadline - state.day);
        html += `<div class="contract ${left <= 3 ? 'urgent' : ''}">
          <div class="info">
            <div class="line1">${g.icon} ${o.qty} × ${g.name} → ${esc(c.name)}</div>
            <div class="line2">срок ${left} ${U.plural(left, 'день', 'дня', 'дней')}</div>
          </div>
          <div class="c-side">
            <span class="reward">${fmt(o.reward)} 💰</span>
            <button class="btn btn-sm" data-action="accept" data-value="${o.id}">Взять</button>
          </div>
        </div>`;
      });
    }

    html += `<p class="card-title" style="margin-top:12px">Мои обязательства</p>`;
    if (!state.contracts.length) {
      html += `<div class="empty-note">Пока пусто.</div>`;
    } else {
      state.contracts.forEach(c => {
        const g = D.GOOD_BY_ID[c.good], city = D.CITY_BY_ID[c.to];
        const left = Math.max(0, c.deadline - state.day);
        const here = c.to === state.cityId && !state.travel;
        const enough = (state.cargo[c.good] || 0) >= c.qty;
        html += `<div class="contract ${left <= 3 ? 'urgent' : ''}">
          <div class="info">
            <div class="line1">${g.icon} ${c.qty} × ${g.name} → ${esc(city.name)}${here ? ' <span class="chip">здесь</span>' : ''}</div>
            <div class="line2">осталось ${left} ${U.plural(left, 'день', 'дня', 'дней')} · ${fmt(c.reward)} 💰</div>
          </div>
          ${here ? `<button class="btn btn-sm ${enough ? 'btn-primary' : ''}" data-action="deliver" data-value="${c.id}" ${enough ? '' : 'disabled'}>Сдать</button>` : ''}
        </div>`;
      });
    }
    els.contracts.innerHTML = html;
  }

  /* ---------- Хроника ---------- */
  function renderLog() {
    const items = state.log.slice(-5).reverse()
      .map(e => `<div class="entry ${e.k === 'bad' ? 'bad' : e.k === 'good' ? 'good' : ''}"><span class="d">д.${e.d}</span>${esc(e.t)}</div>`)
      .join('');
    els.log.innerHTML = items;
  }

  /* ---------- Табы ---------- */
  function renderTabs() {
    els.market.classList.toggle('hidden', tab !== 'market');
    els.contracts.classList.toggle('hidden', tab !== 'contracts');
    document.querySelectorAll('.tab').forEach(t => {
      const on = t.dataset.value === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    const deliverable = state.contracts.some(c =>
      !state.travel && c.to === state.cityId && (state.cargo[c.good] || 0) >= c.qty);
    const offers = state.travel ? 0 : state.offers.length;

    if (deliverable) {
      els.badge.textContent = '!';
      els.badge.className = 'badge hot';
    } else if (offers > 0) {
      els.badge.textContent = offers;
      els.badge.className = 'badge';
    } else {
      els.badge.className = 'badge hidden';
    }
  }

  /* ---------- Полный рендер ---------- */
  UI.render = function () {
    if (!state) return;
    renderTop();
    renderMapState();
    renderCity();
    renderMarket();
    renderContracts();
    renderLog();
    renderTabs();
  };

  /* ---------- Модалки ---------- */
  function openModal(opts) {
    const actions = opts.actions || [];
    const actionsHtml = actions.map(a =>
      `<button class="btn ${a.primary ? 'btn-primary' : ''}" data-action="${a.action}" data-value="${a.value || ''}">
        <span>${a.label}</span>${a.hint ? `<small>${a.hint}</small>` : ''}
      </button>`).join('');

    els.modal.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
      <h3>${opts.icon ? `<span>${opts.icon}</span>` : ''}${opts.title}</h3>
      ${opts.sub ? `<div class="modal-sub">${opts.sub}</div>` : ''}
      ${opts.body || ''}
      <div class="modal-actions">${actionsHtml}</div>
    </div>`;
    els.modal.classList.remove('hidden');
    locked = !!opts.locked;
  }

  function closeModal() {
    els.modal.classList.add('hidden');
    els.modal.innerHTML = '';
    locked = false;
  }

  function toast(msg, err) {
    if (!msg) return;
    els.toast.textContent = msg;
    els.toast.classList.toggle('err', !!err);
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2300);
  }
  UI.toast = toast;

  /* ---------- События ---------- */
  function showEvent() {
    const p = state.pending;
    if (!p) return;
    const ev = D.EVENTS[p.id];
    openModal({
      icon: ev.icon,
      title: ev.title,
      locked: true,
      body: `<p>${ev.text(p.data)}</p>`,
      actions: ev.choices.map(c => ({
        label: c.label,
        hint: c.hint ? c.hint(p.data) : '',
        action: 'event',
        value: c.id,
      })),
    });
  }

  function showCaravan() {
    if (locked) return;
    const s = state;
    let rows = '';
    Object.keys(Game.UPGRADES).forEach(k => {
      const u = Game.UPGRADES[k];
      const lvl = s.upgrades[k];
      const cost = Game.upgradeCost(s, k);
      const bars = Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
      rows += `<div class="upgrade">
        <div>
          <div class="u-name">${u.icon} ${u.name}</div>
          <div class="u-desc">${u.desc}</div>
          <div class="u-lvl">${bars}</div>
        </div>
        ${cost === null
          ? `<span class="chip">максимум</span>`
          : `<button class="btn btn-sm" data-action="upgrade" data-value="${k}" ${s.gold < cost ? 'disabled' : ''}>${fmt(cost)} 💰</button>`}
      </div>`;
    });

    openModal({
      icon: '🐪',
      title: 'Караван',
      sub: `Содержание ${Game.upkeep(state)} золота в день · в пути ${state.travel ? 'да' : 'нет'}`,
      body: `<p>Вместимость <b>${s.capacity}</b> · охрана <b>${s.upgrades.guards}</b> · скорость <b>+${s.upgrades.speed}</b></p>${rows}`,
      actions: [{ label: 'Закрыть', action: 'close', value: '' }],
    });
  }

  function showMenu() {
    if (locked) return;
    openModal({
      icon: '☰',
      title: 'Меню',
      sub: 'Автосохранение в браузере включено',
      body: `<p>Прогресс сохраняется в браузере после каждого дня. Файл на диске — отдельная история: его можно перенести на другой компьютер.</p>`,
      actions: [
        { label: '💾 Сохранить в файл', action: 'export', value: '' },
        { label: '📂 Загрузить из файла', action: 'import', value: '' },
        { label: '🖥️ Сохранить в браузере', action: 'save-local', value: '' },
        { label: '🆕 Новая игра', action: 'new-game', value: '' },
        { label: 'Закрыть', action: 'close', value: '' },
      ],
    });
  }

  function showIntro() {
    openModal({
      icon: '🐫',
      title: 'Караван',
      sub: 'Торговая империя · сезон 140 дней',
      body: `<p>Ты — хозяин каравана. Цель: собрать <b>15 000 золота капиталом</b> за 140 дней.</p>
        <p>Покупай там, где товар лежит под ногами, вези туда, где за него платят не торгуясь. Разница цен — твоя прибыль.</p>
        <p>Бери контракты на доставку: платят выше рынка, но сроки поджимают, а за просрочку бьют по репутации.</p>
        <p class="muted">Клик по соседнему городу — отправиться. Каждый день пути стоит содержания каравана.</p>`,
      actions: [{ label: 'В путь', action: 'intro-start', value: '', primary: true }],
    });
  }

  function showEnd() {
    const g = state.gameOver;
    if (!g) return;
    openModal({
      icon: g.win ? '🏆' : '💀',
      title: g.win ? 'Караван вошёл в легенду' : 'Путь окончен',
      sub: `День ${g.day} · капитал ${fmt(g.capital)} из ${fmt(state.target)}`,
      body: `<p>${g.reason}</p>
        <p class="muted">Рейсов: ${state.stats.trips} · сделок: ${state.stats.trades} · контрактов: ${state.stats.contracts}</p>`,
      actions: [
        { label: 'Начать заново', action: 'new-game', value: '', primary: true },
        { label: 'Посмотреть карту', action: 'close', value: '' },
      ],
    });
  }

  /* ---------- Цикл пути ---------- */
  function stopLoop() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  function startLoop() {
    stopLoop();
    if (!state || !state.travel || state.pending || state.gameOver) return;
    timer = setInterval(tick, 700);
  }

  function tick() {
    if (!state || !state.travel || state.pending || state.gameOver) { stopLoop(); return; }
    const wasTravelling = !!state.travel;
    Game.advanceDay(state);
    UI.render();
    Save.writeLocal(state);

    if (wasTravelling && !state.travel && !state.pending) {
      toast(`Караван в ${D.CITY_BY_ID[state.cityId].name}`);
    }
    if (state.pending) { stopLoop(); showEvent(); return; }
    if (state.gameOver) { stopLoop(); showEnd(); return; }
    if (!state.travel) stopLoop();
  }

  /* ---------- Действия ---------- */
  function afterAction(res, opts) {
    opts = opts || {};
    if (res && !res.ok) { toast(res.msg, true); return false; }
    UI.render();
    Save.writeLocal(state);
    if (state.pending) showEvent();
    if (state.gameOver) { showEnd(); return true; }
    if (state.travel && !state.pending) startLoop();
    return true;
  }

  async function doExport() {
    toast('Выбираю место для файла…');
    const res = await Save.exportFile(state);
    if (res.ok) toast(res.downloaded ? `Скачано: ${res.file}` : `Сохранено: ${res.file}`);
    else toast(res.msg || 'Не вышло', true);
  }

  async function doImport() {
    const res = await Save.importFile(els.importFile);
    if (!res) return;
    if (!res.ok) { toast(res.msg, true); return; }
    state = res.state;
    closeModal();
    UI.render();
    Save.writeLocal(state);
    toast('Сохранение загружено');
    if (state.gameOver) showEnd();
    else if (state.travel && !state.pending) startLoop();
  }

  function restart() {
    stopLoop();
    state = Game.newGame();
    closeModal();
    UI.render();
    Save.writeLocal(state);
    toast('Новый караван готов');
  }

  function wire() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      if (el.disabled) return;
      const act = el.dataset.action;
      const val = el.dataset.value;

      switch (act) {
        case 'buy':
          afterAction(Game.buy(state, el.dataset.good, el.dataset.qty));
          break;
        case 'sell':
          afterAction(Game.sell(state, el.dataset.good, el.dataset.qty));
          break;
        case 'travel':
          if (val === state.cityId) return;
          if (state.travel) { toast('Караван уже в пути', true); return; }
          afterAction(Game.travelTo(state, val));
          break;
        case 'wait':
          afterAction(Game.waitDay(state));
          break;
        case 'accept':
          afterAction(Game.acceptOffer(state, val));
          break;
        case 'deliver':
          afterAction(Game.deliverContract(state, val));
          break;
        case 'upgrade': {
          const res = Game.upgrade(state, val);
          if (!res.ok) { toast(res.msg, true); return; }
          UI.render();
          Save.writeLocal(state);
          showCaravan();
          break;
        }
        case 'event': {
          const res = Game.resolveEvent(state, val);
          closeModal();
          if (!res.ok) { toast(res.msg, true); return; }
          UI.render();
          Save.writeLocal(state);
          if (state.gameOver) showEnd();
          else if (state.travel) startLoop();
          break;
        }
        case 'close':
          closeModal();
          break;
        case 'tab':
          tab = val || 'market';
          UI.render();
          break;
        case 'caravan':
          showCaravan();
          break;
        case 'menu':
          showMenu();
          break;
        case 'export':
          doExport();
          break;
        case 'import':
          doImport();
          break;
        case 'save-local':
          Save.writeLocal(state);
          toast('Сохранено в браузере');
          break;
        case 'new-game':
          openModal({
            icon: '⚠️',
            title: 'Новая игра',
            body: '<p>Текущий прогресс будет потерян. Сначала сохранить его в файл?</p>',
            actions: [
              { label: 'Да, начать заново', action: 'restart', value: '', primary: true },
              { label: 'Сначала сохранить в файл', action: 'export', value: '' },
              { label: 'Отмена', action: 'close', value: '' },
            ],
          });
          break;
        case 'restart':
          restart();
          break;
        case 'intro-start':
          closeModal();
          break;
        default:
          break;
      }
    });

    els.modal.addEventListener('click', (e) => {
      if (e.target === els.modal && !locked) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !locked && !els.modal.classList.contains('hidden')) closeModal();
    });

    document.getElementById('btn-caravan').addEventListener('click', showCaravan);
    document.getElementById('btn-menu').addEventListener('click', showMenu);
  }

  UI.startLoop = startLoop;
  UI.stopLoop = stopLoop;
})(typeof window !== 'undefined' ? window : globalThis);
