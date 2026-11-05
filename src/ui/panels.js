// Every panel is a plain function from game state to DOM. Hovering anything shows what it is.
(function (WW) {
  const { C } = WW;
  const E = () => WW.Engine;
  WW.tr = WW.tr || ((s) => s);

  // DOM helpers

  const urlCache = new WeakMap();
  const urlOf = (canvas) => {
    if (!urlCache.has(canvas)) urlCache.set(canvas, canvas.toDataURL());
    return urlCache.get(canvas);
  };
  // tip: what the details box shows for this element when hovered or held.
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') n.className = v;
        else if (k === 'on') for (const ev in v) n.addEventListener(ev, v[ev]);
        else if (k === 'style') n.setAttribute('style', v);
        else if (k === 'disabled') {
          // Still hoverable, so the details box can say why it is off.
          n.setAttribute('aria-disabled', 'true');
          n.addEventListener(
            'click',
            (e) => {
              e.stopImmediatePropagation();
              e.preventDefault();
            },
            true
          );
        }
        else if (k === 'tip') {
          n._tip = v;
          n.setAttribute('data-tip', '');
        } else n.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid === null || kid === undefined || kid === false) continue;
      n.append(kid.nodeType ? kid : document.createTextNode(WW.tr(String(kid))));
    }
    return n;
  }
  const img = (canvas, cls, alt) => el('img', { src: urlOf(canvas), class: 'px ' + (cls || ''), alt: alt || '' });
  const icon = (name, alt) => img(WW.iconCanvas(name), '', alt || '');
  const btn = (label, onClick, cls, disabled, tip) => el('button', { class: 'btn ' + (cls || ''), type: 'button', disabled, tip, on: { click: onClick } }, label);
  const fmt = (n) => Math.floor(n).toLocaleString('en-US');
  const money = (n) => `${fmt(n)} cash`;
  const flChip = (f) => el('span', { class: 'fl', style: `background:${WW.FLAVOURS[f].c}` }, WW.FLAVOURS[f].n);
  const dishImg = (def) => img(WW.dishIcon(def, def.gold), '', def.n);
  WW.TIER_NAMES = { 1: 'L1: greens, carrots, peas and oats', 2: 'L2: vegetables and millet', 3: 'L3: fruit', 4: 'L4: seeds, egg, tofu and chicken' };
  // The small level mark on an ingredient, used wherever trades matter.
  const tierTag = (id) => {
    const t = WW.INGREDIENT[id].tier;
    return el('span', { class: 'tier t' + t, tip: { title: `Level ${t} ingredient`, lines: [WW.TIER_NAMES[t], 'Trades need the same level or better.'] } }, 'L' + t);
  };
  const ingList = (s, ing, mult = 1) =>
    el(
      'span',
      { class: 'ings' },
      Object.keys(ing).map((id) => {
        const need = ing[id] * mult;
        const have = s.pantry[id] || 0;
        return el('span', { class: 'ing' + (have < need ? ' short' : ''), tip: () => tips.ingredient(id) }, img(WW.ingredientIcon(id), '', WW.INGREDIENT[id].n), `${have}/${need}`);
      })
    );
  const needLabel = (def, need = def.need) => (def.st === 'stove' ? (need >= 60 ? (need / 60).toFixed(need % 60 ? 1 : 0) + ' h' : need + ' min') : def.st === 'wok' ? `${fmt(need)} wheel passes` : `${need} rounds of sleep`);
  const staffWord = (role, n) => (role === 'sous' ? 'sous chef' : role) + (n === 1 ? '' : 's');
  const placeOf = (def) => (def.st === 'pot' ? 'In the pot' : 'On the ' + def.st);
  // Why a purchase is off, for the details box on its button.
  const whyNot = (s, price, lvl) => (lvl && s.level < lvl ? `Reach level ${lvl} first.` : s.cash < price ? `You have ${money(s.cash)}.` : null);
  const KIND_TIPS = {
    table: 'Seats only count when they touch a table.',
    seat: () => `Each seat feeds ${WW.CFG.TURNS_PER_ROUND} guests a round. It must touch a table.`,
    rug: 'Guests walk right over them. They add to your rating.',
    plant: 'Green things for your rating.',
    light: 'They glow while he sleeps, and add to your rating.',
    appliance: 'Real effects in the kitchen. Only your first of each kind works.',
    clean: 'They keep the floor tidy for you. Only your first of each kind works.',
    fun: 'For the guests and for your rating. A few do more.',
    attract: 'Shy guests only come once they see what they\'re looking for.',
    prestige: 'Big pieces for a big rating.',
    yard: 'They stand outside and add charm, which draws more guests in. Only the first of each kind counts.',
  };
  const STATION_INFO = {
    stove: { n: 'Tea Tin Stove', clock: 'Cooks in real time, whatever he\'s doing.' },
    wok: { n: 'Bottle Cap Wok', clock: 'Fires only on real wheel passes. Waits while he sleeps.' },
    pot: { n: 'Thimble Pot', clock: 'Simmers only while he isn\'t running, so it finishes while he sleeps.' },
  };
  WW.STATION_INFO = STATION_INFO;

  function silhouette(canvas) {
    const c = WW.makeCanvas(canvas.width, canvas.height);
    const x = c.getContext('2d');
    x.drawImage(canvas, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#5b3a5e';
    x.fillRect(0, 0, c.width, c.height);
    return c;
  }
  const silCache = new Map();
  const silOf = (sp) => {
    if (!silCache.has(sp.id)) silCache.set(sp.id, silhouette(WW.animalFrames(sp)[0]));
    return silCache.get(sp.id);
  };

  // What the details box says about things. Used by panels and by the world.
  const tips = {
    dish(def, s) {
      const lvl = s && s.known && s.known[def.id] ? s.known[def.id].lvl : 1;
      const stock = s && s.stock ? s.stock[def.id] || 0 : 0;
      const batch = s ? E().batchInfo(s, def.id) : { y: def.y, need: def.need, chef: null };
      const who = batch.chef ? (batch.chef.role === 'head' ? s.chef.name : batch.chef.n) : null;
      return {
        icon: WW.dishIcon(def, def.gold),
        title: def.n + (lvl > 1 ? ` +${lvl - 1}` : ''),
        lines: [`${placeOf(def)}, ${needLabel(def, batch.need)}`, `A batch makes ${fmt(batch.y)} portions, ${Math.round(s ? E().dishPrice(s, def) : def.p)} cash each before tips`, who ? `${who} would cook it` : null, stock ? `${fmt(stock)} on the counter` : null, { flavours: def.fl }, 'Takes: ' + Object.keys(def.ing).map((i) => `${WW.INGREDIENT[i].n} x${def.ing[i]}`).join(', ')],
      };
    },
    ingredient(id) {
      const i = WW.INGREDIENT[id];
      const uses = WW.DISHES.filter((d) => d.ing[id] && WW.game && WW.game.s && WW.game.s.known[d.id]).map((d) => d.n);
      const g = WW.game;
      const item = g && g.s ? E().ensureMarket(g.s, g.feed, g.now()).items.find((x) => x.id === id) : null;
      const who = g && g.s ? E().whoHas(g.s, id, g.now()).map((n) => n.n) : [];
      return { icon: WW.ingredientIcon(id), title: `${i.n} (L${i.tier})`, lines: [{ flavours: i.fl }, i.note, item ? `${item.price} cash today at the market, ${item.left} left` : `Not at the market today. Usually about ${i.price} cash.`, who.length ? `Neighbours with it today: ${who.join(', ')}` : 'No neighbour has any out today.', uses.length ? 'You use it in: ' + uses.slice(0, 4).join(', ') : null] };
    },
    decor(def) {
      const s = WW.game && WW.game.s;
      const lines = [def.find === 'treasure' ? 'A rare find. No shop sells it.' : def.find === 'junk' ? 'A bit of junk you found.' : def.festival ? 'Cannot be bought' : `${money(def.price)}${s && s.level < def.lvl ? ', from level ' + def.lvl : ''}`, `Rating +${def.rating}. Size ${def.w} by ${def.h} tiles.`, 'Each extra one adds only a quarter of that.'];
      if (E().sellValue(def.id) !== null && s && (def.find || s.bag[def.id] > 0)) lines.push(`Sells for ${money(E().sellValue(def.id))}.`);
      if (def.kind === 'seat') lines.push(`${def.seats || 1} seat${def.seats > 1 ? 's' : ''}, must touch a table.`);
      if (def.kind === 'table') lines.push('Seats next to it count.');
      if (def.kind === 'rug') lines.push('Guests can walk on it.');
      if (def.charm) lines.push(`Charm +${def.charm}. Only the first one of its kind counts.`);
      const fx = WW.fxText(def.fx);
      if (fx) lines.push(fx);
      if (def.fx) lines.push('Only your first one of each kind works.');
      if (def.tag) {
        const fans = WW.ANIMALS.filter((a) => a.needs.decor === def.tag);
        lines.push(`${fans.length === 1 ? '1 kind of guest looks' : fans.length + ' kinds of guest look'} for this: ${fans.slice(0, 3).map((a) => a.n).join(', ')}${fans.length > 3 ? ' and more' : ''}.`);
      }
      if (def.note) lines.push(def.note);
      return { icon: WW.decorCanvas(def.id), title: def.n, lines };
    },
    species(a, s) {
      const seen = s && s.book[a.id];
      const n = a.needs;
      const lines = [{ color: WW.RARITY[a.rar].color, text: WW.RARITY[a.rar].n + (seen ? `, served ${seen} time${seen === 1 ? '' : 's'}` : ', not met yet') }];
      if (seen) lines.push(a.note);
      lines.push({ flavours: [a.likes], prefix: 'Likes ' });
      if (n.lvl) lines.push(`Needs restaurant level ${n.lvl}`);
      if (n.decor) {
        const item = WW.DECOR.find((d) => d.tag === n.decor);
        lines.push(`Looks for: ${item ? item.n : n.decor}`);
      }
      if (n.flavor) lines.push(`Needs a ${WW.FLAVOURS[n.flavor].n.toLowerCase()} dish on the counter`);
      if (n.dream) lines.push('Only comes for a Dream Dish');
      if (n.gold) lines.push('Only comes for a Golden Dream Dish');
      return { icon: seen ? WW.animalFrames(a)[0] : silOf(a), title: seen ? a.n : '???', lines };
    },
    staff(w, st) {
      const fur = w.role === 'head' ? st.chef.fur : w.fur;
      const look = w.role === 'head' ? { fur, hat: st.chef.hat, job: 'chef' } : { fur, job: w.role === 'sous' ? 'sous' : w.role };
      const role = { head: 'Head chef', sous: 'Sous chef', waiter: 'Waiter', cleaner: 'Cleaner' }[w.role];
      const spec = { stove: '+20% portions on the stove', wok: '+20% portions on the wok', fast: 'Cooks 15% faster' }[w.spec];
      return { icon: WW.hamsterPose(look, 0), title: w.role === 'head' ? st.chef.name : w.n, lines: [role, spec, w.role === 'head' ? 'Runs one stove or wok at no energy cost, with 10% more portions.' : `Energy ${Math.round(w.energy)}%. Comes back while he sleeps.`] };
    },
  };
  WW.tips = tips;

  // Panels

  class Panels {
    constructor(game) {
      this.game = game;
      this.tab = 'kitchen';
      this.sub = {};
      this.root = document.getElementById('panelinner');
      this.root.addEventListener('pointerdown', () => (this.pressing = true));
      for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, () => (this.pressing = false));
    }
    get s() {
      return this.game.s;
    }
    open(tab, sub) {
      this.tab = tab;
      this.sub = sub || {};
      this.game.setPanelOpen(true);
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
      this.render(true);
    }
    render(resetScroll) {
      if (!this.s) return;
      const keep = this.root.scrollTop;
      const fn = this[this.tab];
      if (!fn) return;
      const body = fn.call(this);
      this.root.replaceChildren(...[].concat(body).flat(Infinity).filter(Boolean));
      this.root.scrollTop = resetScroll ? 0 : keep;
      this.game.refreshTip();
    }
    // Numbers move all the time. The panel is only rebuilt when its shape changes, so a button is never swapped out from under a click.
    refresh() {
      if (this.pressing || !this.s) return;
      if (this.tab === 'wheel') return this.render();
      if (this.tab !== 'kitchen' || this.sub.station !== undefined) return;
      if (this.kitchenKey() !== this.kitchenShape) return this.render();
      const s = this.s;
      const g = this.game;
      s.stations.forEach((st, i) => {
        if (!st.job) return;
        const text = this.root.querySelector(`[data-job="${i}"]`);
        const bar = this.root.querySelector(`[data-bar="${i}"]`);
        if (text) text.textContent = WW.tr(g.jobText(st)) + (st.job.chef ? ` · ${g.staffName(st.job.chef)}` : '');
        if (bar) bar.style.width = Math.round(E().stationProgress(s, st, g.feed, g.now()) * 100) + '%';
      });
      for (const n of this.root.querySelectorAll('[data-stock]')) n.textContent = fmt(s.stock[n.dataset.stock] || 0);
    }
    kitchenKey() {
      const s = this.s;
      const next = E().nextStation(s);
      const nextPrep = WW.PREP.find((p) => !s.prep[p.id]);
      return JSON.stringify([
        s.stations.map((st, i) => {
          if (st.job) return [st.job.dish, st.job.chef];
          const last = st.last && !st.last.startsWith('d:') ? E().dishDef(st.last) : null;
          if (!last) return 0;
          const cost = E().missingCost(s, last);
          return [last.id, !E().canCook(s, last.id, i), cost, cost !== null && s.cash >= cost];
        }),
        next ? [next.type, s.level >= next.lvl, s.cash >= next.price, s.stations.length >= next.slots] : 0,
        s.dreamDish && s.dreamDish.key,
        s.trend && s.trend.fl,
        E().inStock(s),
        s.lunch,
        nextPrep && nextPrep.id,
        s.pantry,
        s.bag,
      ]);
    }
    head(title, extra) {
      return el('div', { class: 'panelhead' }, el('h2', null, title), extra || null, el('button', { class: 'btn small plain', id: 'closepanel', type: 'button', on: { click: () => this.game.setPanelOpen(false) } }, 'Close'));
    }
    act(result) {
      if (typeof result === 'string') this.game.toast(result, 'bad');
      this.game.afterAction();
      return result;
    }

    // Kitchen

    kitchen() {
      const s = this.s;
      const g = this.game;
      if (this.sub.station !== undefined) return this.dishPicker(this.sub.station);
      E().ensureMarket(s, g.feed, g.now());
      this.kitchenShape = this.kitchenKey();
      const again = s.stations.filter((st) => !st.job && st.last && !st.last.startsWith('d:'));
      const stations = s.stations.map((st, i) => {
        const info = STATION_INFO[st.type];
        if (st.job) {
          const def = E().dishDef(st.job.dish);
          const pr = E().stationProgress(s, st, g.feed, g.now());
          return el('div', { class: 'row', tip: () => (st.job ? { icon: WW.dishIcon(def, def.gold), title: def.n, lines: [info.n, g.jobText(st), `${fmt(st.job.y)} portions when it is done`, st.job.chef ? `${g.staffName(st.job.chef)} is cooking it` : null] } : tips.dish(def, s)) }, el('div', { class: 'spr' }, dishImg(def)), el('div', { class: 'grow' }, el('div', { class: 'title' }, def.n), el('div', { class: 'sub', 'data-job': i }, g.jobText(st), st.job.chef ? ` · ${g.staffName(st.job.chef)}` : ''), el('div', { class: 'bar ' + st.type }, el('i', { 'data-bar': i, style: `width:${Math.round(pr * 100)}%` }))));
        }
        const last = st.last && !st.last.startsWith('d:') ? E().dishDef(st.last) : null;
        const lastCost = last ? E().missingCost(s, last) : null;
        const canAgain = last && !E().canCook(s, last.id, i);
        const canBuyAgain = last && !canAgain && lastCost !== null && lastCost > 0 && s.cash >= lastCost;
        const lastBatch = last ? E().batchInfo(s, last.id) : null;
        return el(
          'div',
          { class: 'row', tip: { icon: WW.stationCanvas(st.type, false, 0), title: info.n, lines: [info.clock, 'Free. Pick a dish to start.'] } },
          el('div', { class: 'spr' }, img(WW.stationCanvas(st.type, false, 0), '', info.n)),
          el('div', { class: 'grow' }, el('div', { class: 'title' }, info.n), el('div', { class: 'sub' }, info.clock)),
          el('div', { style: 'display:grid;gap:4px;justify-items:end' }, btn('Cook', () => this.open('kitchen', { station: i }), 'small', false, { title: 'Pick a dish', lines: [`Choose what the ${info.n} cooks next.`] }), canAgain ? btn('Again', () => this.doCook(last.id, i), 'small plain', false, { title: 'Cook again', lines: [last.n, `${fmt(lastBatch.y)} portions, ${needLabel(last, lastBatch.need)}`] }) : canBuyAgain ? btn(`Again ${fmt(lastCost)}`, () => this.buyAndCook(last, i), 'small plain', false, { title: 'Buy what is missing and cook again', lines: [last.n, `Costs ${money(lastCost)}.`, `${fmt(lastBatch.y)} portions, ${needLabel(last, lastBatch.need)}`] }) : null)
        );
      });
      const next = E().nextStation(s);
      const stock = E().inStock(s);
      const dream = s.dreamDish ? E().dishDef(s.dreamDish.key) : null;
      const nextPrep = WW.PREP.find((p) => !s.prep[p.id]);
      return [
        this.head('Kitchen'),
        nextPrep ? el('p', { class: 'note', style: 'margin-bottom:6px' }, el('b', null, 'Next: '), nextPrep.n, ` (+${nextPrep.reward} cash)`) : null,
        again.length > 1 ? el('div', { style: 'margin-bottom:6px' }, btn('Cook everything again', () => this.cookAllAgain(), 'small teal')) : null,
        stations,
        next ? el('div', { class: 'row', tip: { icon: WW.stationCanvas(next.type, false, 0), title: `Add a ${STATION_INFO[next.type].n}`, lines: [STATION_INFO[next.type].clock, `${money(next.price)}, from level ${next.lvl}.`, `This room has space for ${next.slots} stations. You have ${s.stations.length}.`] } }, el('div', { class: 'grow' }, el('div', { class: 'sub' }, s.stations.length >= next.slots ? 'The kitchen wall is full. A wider room makes space.' : `Next station: ${STATION_INFO[next.type].n}, level ${next.lvl}, ${money(next.price)}.`)), btn('Add', () => this.act(E().buyStation(s)) || this.render(), 'small plain', s.level < next.lvl || s.cash < next.price || s.stations.length >= next.slots, { title: `Add a ${STATION_INFO[next.type].n}`, lines: [`Costs ${money(next.price)}.`, s.stations.length >= next.slots ? 'The kitchen wall is full. A wider room makes space.' : whyNot(s, next.price, next.lvl)] })) : null,
        dream ? el('div', { class: 'sec' }, el('h3', null, "Last night's dream"), el('div', { class: 'row', tip: () => tips.dish(dream, s) }, el('div', { class: 'spr' }, dishImg(dream)), el('div', { class: 'grow' }, el('div', { class: 'title' }, dream.n), el('div', { class: 'sub' }, `Costs ${WW.CFG.DREAM_DISH_COST} Winks. ${placeOf(dream)}, ${needLabel(dream, E().batchInfo(s, dream.id).need)}. Legendary guests follow it.`), ingList(s, dream.ing)), btn('Cook', () => this.cookDreamNow(), 'lilac small', false, { title: `Cook ${dream.n}`, lines: [`Costs ${WW.CFG.DREAM_DISH_COST} Winks.`, s.winks < WW.CFG.DREAM_DISH_COST ? `You have ${s.winks} Winks.` : null] }))) : null,
        s.trend ? el('div', { class: 'sec' }, el('h3', null, 'Next shift wants'), el('div', null, s.trend.fl.map(flChip), el('span', { class: 'note' }, ' 25% more for matching dishes'))) : null,
        el('div', { class: 'sec' }, el('h3', null, `On the counter${stock.length ? '' : ': nothing'}`), stock.length ? el('div', { class: 'grid' }, stock.map((k) => el('div', { class: 'cell food', tip: () => tips.dish(E().dishDef(k), s) }, dishImg(E().dishDef(k)), el('span', { class: 'cap tabnum', 'data-stock': k }, fmt(s.stock[k]))))) : el('p', { class: 'note' }, 'Guests can only eat what is here. Food never spoils, so cook ahead.')),
        this.bagSection(),
        el('div', { class: 'sec' }, el('h3', null, 'Lunchboxes'), el('div', { class: 'row', tip: { icon: WW.iconCanvas('lunch'), title: 'Lunchbox', lines: ['Tired waiters eat one on their own during service.', `Gives +${WW.CFG.LUNCH_ENERGY + E().fxOf(s).lunch} energy. Costs 15 cash and 1 scoop of Rolled Oats.`] } }, el('div', { class: 'spr' }, icon('lunch')), el('div', { class: 'grow' }, el('div', { class: 'title' }, `${s.lunch} packed`), el('div', { class: 'sub' }, 'Tired waiters eat one on their own during service.')), btn('Pack', () => this.act(E().packLunch(s)) || this.render(), 'small plain', false, { title: 'Pack a lunchbox', lines: ['Costs 15 cash and 1 scoop of Rolled Oats.', `Holds up to 12. You have ${s.lunch}.`] }))),
      ];
    }
    // Everything you own, in one place.
    bagSection() {
      const s = this.s;
      const view = this.sub.bag || 'food';
      const food = Object.keys(s.pantry).filter((k) => s.pantry[k] > 0).sort((a, b) => WW.INGREDIENT[a].tier - WW.INGREDIENT[b].tier);
      const owned = Object.keys(s.bag).filter((k) => s.bag[k] > 0);
      const here = this.game.scene.view === 'in' ? 'in' : 'out';
      // What can stand where you are now comes first.
      const place = (k) => (WW.DECOR_BY_ID[k].kind === 'yard' ? 'out' : 'in');
      const furniture = owned.filter((k) => !WW.DECOR_BY_ID[k].find).sort((a, b) => (place(a) === here ? 0 : 1) - (place(b) === here ? 0 : 1));
      const finds = owned.filter((k) => WW.DECOR_BY_ID[k].find);
      const total = (list, map) => list.reduce((a, k) => a + map[k], 0);
      const pick = (patch) => {
        this.sub = Object.assign({}, this.sub, patch);
        this.game.sound('tap');
        this.render();
      };
      const chip = (id, label, n) => el('button', { class: 'chip' + (view === id ? ' on' : ''), type: 'button', on: { click: () => pick({ bag: id, sel: null }) } }, `${label} (${fmt(n)})`);
      const sel = this.sub.sel && s.bag[this.sub.sel] > 0 ? this.sub.sel : null;
      const list = view === 'finds' ? finds : furniture;
      const ed = this.game.scene.editing;
      return el(
        'div',
        { class: 'sec', 'data-bag': '' },
        el('h3', null, 'Your bag'),
        ed ? el('div', { class: 'row' }, el('div', { class: 'grow sub' }, ed.ghost && ed.ghost.fromBag ? 'Tap a tile to place it.' : ed.selected ? 'Drag it, or tap a tile to move it.' : 'Drag anything here to move it, or pick something below to place it.'), ed.selected ? btn('Store in bag', () => this.game.storeSelected(), 'small plain', false, { title: 'Store in bag', lines: ['It goes back in your bag.'] }) : null, this.cancelBtn(ed), btn('Done', () => this.game.toggleArrange(), 'small teal', false, { title: 'Finish arranging', lines: [] })) : null,
        el('div', { class: 'chips' }, chip('food', 'Ingredients', total(food, s.pantry)), chip('furniture', 'Furniture', total(furniture, s.bag)), chip('finds', 'Finds', total(finds, s.bag))),
        view === 'food'
          ? food.length
            ? el('div', { class: 'grid' }, food.map((id) => el('div', { class: 'cell food', tip: () => tips.ingredient(id) }, tierTag(id), img(WW.ingredientIcon(id), '', WW.INGREDIENT[id].n), el('span', { class: 'cap tabnum' }, fmt(s.pantry[id])))))
            : el('p', { class: 'note' }, 'Empty. The market has plenty.')
          : list.length
            ? [el('div', { class: 'grid' }, list.map((id) => el('button', { class: 'cell food' + (sel === id || (ed && ed.ghost && ed.ghost.fromBag && ed.ghost.id === id) ? ' on' : ''), type: 'button', tip: () => tips.decor(WW.DECOR_BY_ID[id]), on: { click: () => (ed ? this.placeFromBag(id) : pick({ sel: id })) } }, img(WW.decorCanvas(id), '', WW.DECOR_BY_ID[id].n), el('span', { class: 'cap tabnum' }, s.bag[id])))), sel && !ed ? this.bagRow(sel) : ed ? null : el('p', { class: 'note', style: 'margin-top:6px' }, 'Pick something to place it or sell it.')]
            : view === 'finds'
              ? el('p', { class: 'note' }, 'Nothing yet. Shake trees and sweep floors. Things turn up.')
              : el('div', null, el('p', { class: 'note', style: 'margin-bottom:6px' }, 'Nothing here. The Decor Shop has plenty.'), btn('Open the Decor Shop', () => this.open('decor', here === 'out' ? { kind: 'yard' } : undefined), 'small plain', false, { title: 'Decor Shop', lines: ['Furniture, yard pieces and new looks for your building.'] }))
      );
    }
    cancelBtn(ed) {
      if (!ed || !ed.ghost) return null;
      return btn('Cancel', () => this.game.cancelHeld(), 'small plain', false, { title: 'Cancel', lines: [ed.ghost.fromBag ? 'It stays in your bag, and you can move something else.' : 'It stays where it was, and you can move something else.'] });
    }
    // Brings the bag into view, it sits low down in the Kitchen.
    showBag() {
      const n = this.root.querySelector('[data-bag]');
      if (n) this.root.scrollTop += n.getBoundingClientRect().top - this.root.getBoundingClientRect().top - 6;
    }
    bagRow(id) {
      const def = WW.DECOR_BY_ID[id];
      const worth = E().sellValue(id);
      return el(
        'div',
        { class: 'row', tip: () => tips.decor(def) },
        el('div', { class: 'spr' }, img(WW.decorCanvas(id), 'contain', def.n)),
        el('div', { class: 'grow' }, el('div', { class: 'title' }, def.n), def.note ? el('div', { class: 'sub' }, def.note) : null),
        el('div', { style: 'display:grid;gap:4px;justify-items:end' }, btn('Place', () => this.placeFromBag(id), 'small', false, { title: 'Place it', lines: [def.kind === 'yard' ? 'It goes in your yard. Pick a tile.' : 'It goes into your room. Pick a tile.'] }), worth !== null ? btn(`Sell ${fmt(worth)}`, () => this.sellFromBag(id), 'small plain', false, { title: 'Sell it', lines: [`You get ${money(worth)}.`] }) : null)
      );
    }
    placeFromBag(id) {
      this.game.pickFromBag(id);
    }
    sellFromBag(id) {
      const err = E().sellDecor(this.s, id);
      if (err) return this.act(err);
      this.game.sound('coin');
      this.game.afterAction();
      this.render();
    }
    cookAllAgain() {
      const s = this.s;
      let n = 0;
      s.stations.forEach((st, i) => {
        if (st.job || !st.last || st.last.startsWith('d:')) return;
        const def = E().dishDef(st.last);
        if (!def) return;
        const cost = E().missingCost(s, def);
        if (cost && s.cash >= cost && (st.type === 'pot' || E().batchInfo(s, def.id).chef)) E().buyMissing(s, def);
        if (!E().startCook(s, def.id, i, this.game.feed, this.game.now())) n++;
      });
      if (n) this.game.sound('cook');
      this.game.toast(n ? `${n} station${n > 1 ? 's' : ''} cooking again.` : 'Nothing could start. Check your ingredients.', n ? 'good' : 'bad');
      this.game.afterAction();
      this.render();
    }
    cookDreamNow() {
      const s = this.s;
      const def = E().dishDef(s.dreamDish.key);
      const idx = s.stations.findIndex((st) => !st.job && st.type === def.st);
      if (idx < 0) return this.game.toast(`Free up a ${STATION_INFO[def.st].n} first.`, 'bad');
      this.open('kitchen', { station: idx, only: def.id });
    }
    dishPicker(i) {
      const s = this.s;
      const st = s.stations[i];
      if (!st || st.job) {
        this.sub = {};
        return this.kitchen();
      }
      const info = STATION_INFO[st.type];
      E().ensureMarket(s, this.game.feed, this.game.now());
      let dishes = Object.keys(s.known).map((k) => WW.DISH[k]).filter((d) => d && d.st === st.type).sort((a, b) => a.need - b.need);
      if (s.dreamDish) {
        const d = E().dishDef(s.dreamDish.key);
        if (d.st === st.type) dishes = [d].concat(dishes);
      }
      if (this.sub.only) dishes = dishes.filter((d) => d.id === this.sub.only);
      const rows = dishes.map((def) => {
        const err = E().canCook(s, def.id, i);
        const cost = E().missingCost(s, def);
        const lvl = s.known[def.id] ? s.known[def.id].lvl : 1;
        const batch = E().batchInfo(s, def.id);
        const profit = Math.round(batch.y * E().dishPrice(s, def) - Object.keys(def.ing).reduce((a, id) => a + E().ingredientPrice(s, id) * def.ing[id], 0));
        const batchLine = `${fmt(batch.y)} portions, ${needLabel(def, batch.need)}`;
        const short = Object.keys(def.ing).filter((id) => (s.pantry[id] || 0) < def.ing[id]);
        const canBuy = err && short.length && (st.type === 'pot' || batch.chef) && !(def.dream && s.winks < WW.CFG.DREAM_DISH_COST) && cost !== null && cost > 0 && s.cash >= cost;
        const lacking = short.find((id) => !s.market.items.some((x) => x.id === id && x.left >= def.ing[id] - (s.pantry[id] || 0)));
        const askers = lacking ? E().whoHas(s, lacking, this.game.now()).map((n) => n.n) : [];
        return el(
          'div',
          { class: 'row', tip: () => tips.dish(def, s) },
          el('div', { class: 'spr' }, dishImg(def)),
          el('div', { class: 'grow' }, el('div', { class: 'title' }, def.n, lvl > 1 ? ` +${lvl - 1}` : ''), el('div', { class: 'sub' }, `${needLabel(def, batch.need)} · ${fmt(batch.y)} portions · ${Math.round(E().dishPrice(s, def))} each · profit about ${fmt(profit)}`), el('div', null, def.fl.map(flChip)), ingList(s, def.ing), lacking ? el('div', { class: 'sub', style: 'font-size:15px' }, askers.length ? `Your stall is short of ${WW.INGREDIENT[lacking].n}. Trade for it: ${askers.join(', ')}.` : `Your stall is short of ${WW.INGREDIENT[lacking].n} today.`) : null),
          el('div', { style: 'display:grid;gap:4px;justify-items:end' }, !err ? btn('Cook', () => this.doCook(def.id, i), 'small', false, { title: `Cook ${def.n}`, lines: [batchLine, def.dream ? `Costs ${WW.CFG.DREAM_DISH_COST} Winks.` : null] }) : null, canBuy ? btn(`Buy ${fmt(cost)} + cook`, () => this.buyAndCook(def, i), 'small plain', false, { title: 'Buy what is missing and cook', lines: [`Costs ${money(cost)}.`, batchLine] }) : null, err && !canBuy ? el('span', { class: 'note', style: 'font-size:15px;text-align:right;max-width:90px' }, err) : null)
        );
      });
      return [this.head(info.n, btn('Back', () => this.open('kitchen'), 'small plain')), el('p', { class: 'note' }, info.clock), rows.length ? rows : el('p', { class: 'note' }, 'No recipes for this yet. Try the Test Kitchen.')];
    }
    buyAndCook(def, i) {
      const err = E().buyMissing(this.s, def);
      if (err) return this.act(err);
      this.doCook(def.id, i);
    }
    doCook(key, i) {
      const err = E().startCook(this.s, key, i, this.game.feed, this.game.now());
      if (err) return this.act(err);
      this.game.sound('cook');
      this.game.afterAction();
      this.open('kitchen');
    }

    // Market

    market() {
      const s = this.s;
      const g = this.game;
      const m = E().ensureMarket(s, g.feed, g.now());
      const pantryIds = Object.keys(s.pantry).filter((k) => s.pantry[k] > 0).sort((a, b) => WW.INGREDIENT[a].tier - WW.INGREDIENT[b].tier);
      return [
        this.head('Market'),
        el('p', { class: 'note' }, 'Every restaurant has its own stall, so nobody has everything. Goods and prices change at midnight UTC, and better ingredients are always scarce. What your stall lacks, a neighbour may have: trade for it on the street. Each food here is named safe for hamsters by at least one care guide, in small plain amounts. This is a game, not care advice.'),
        el(
          'div',
          { class: 'sec' },
          m.items.map((it) => {
            const ing = WW.INGREDIENT[it.id];
            const buyTip = (qty) => ({ title: `Buy ${ing.n} x${qty}`, lines: [`Costs ${money(it.price * qty)}.`, it.left < qty ? `Only ${it.left} left today.` : whyNot(s, it.price * qty)] });
            return el(
              'div',
              { class: 'row', tip: () => tips.ingredient(it.id) },
              el('div', { class: 'spr' }, img(WW.ingredientIcon(it.id), '', ing.n)),
              el('div', { class: 'grow' }, el('div', { class: 'title' }, ing.n, ' ', tierTag(it.id)), el('div', { class: 'sub' }, `${it.price} cash each · ${it.left} left · you have ${s.pantry[it.id] || 0}`), el('div', null, ing.fl.map(flChip))),
              btn('+1', () => this.buy(it.id, 1), 'small plain', it.left < 1 || s.cash < it.price, buyTip(1)),
              btn('+5', () => this.buy(it.id, 5), 'small', it.left < 5 || s.cash < it.price * 5, buyTip(5))
            );
          })
        ),
        el('div', { class: 'sec' }, el('h3', null, 'Your pantry'), pantryIds.length ? el('div', { class: 'grid' }, pantryIds.map((id) => el('div', { class: 'cell food', tip: () => tips.ingredient(id) }, tierTag(id), img(WW.ingredientIcon(id), '', WW.INGREDIENT[id].n), el('span', { class: 'cap tabnum' }, s.pantry[id])))) : el('p', { class: 'note' }, 'Empty.')),
      ];
    }
    buy(id, n) {
      E().ensureMarket(this.s, this.game.feed, this.game.now());
      const err = E().buyIngredient(this.s, id, n);
      if (err) return this.act(err);
      this.game.sound('coin');
      this.game.afterAction();
      this.render();
    }

    // Orders and the notice board

    orders() {
      const s = this.s;
      const g = this.game;
      const o = E().ensureOrders(s, g.feed, g.now());
      const quiz = E().quizFor(s, g.feed, g.now());
      return [
        this.head('Notice Board'),
        el('p', { class: 'note' }, 'Three parties book in each day. They pay above the menu price and can bring guests you haven\'t met. New ones arrive at midnight UTC.'),
        o.items.map((it) => {
          const sp = WW.ANIMAL[it.species];
          const have = E().orderStock(s, it);
          const met = s.book[sp.id];
          return el(
            'div',
            { class: 'row', tip: () => tips.species(sp, s) },
            el('div', { class: 'spr tall' }, img(met ? WW.animalFrames(sp)[0] : silOf(sp), '', met ? sp.n : 'A new guest')),
            el('div', { class: 'grow' }, el('div', { class: 'title' }, it.done ? `${sp.n} went home happy` : `${met ? sp.n : 'A new guest'}'s party`), it.done ? null : el('div', { class: 'sub' }, `Wants ${it.n} `, flChip(it.fl), ` portions. You have ${fmt(have)}.`), it.done ? null : el('div', { class: 'sub' }, `Pays ${money(it.cash)}${it.winks ? ` and ${it.winks} Winks` : ''}${met ? '' : ', and you meet them'}.`), it.done || !it.gift ? null : el('div', { class: 'sub' }, `They also bring ${WW.INGREDIENT[it.gift.id].n} x${it.gift.n} `, tierTag(it.gift.id)), it.done ? null : el('div', { class: 'bar' }, el('i', { style: `width:${Math.min(100, Math.round((have / it.n) * 100))}%` }))),
            it.done ? null : btn('Deliver', () => this.deliver(it.id), 'small', have < it.n, { title: 'Deliver', lines: [`Hands over ${it.n} portions from the counter.`, have < it.n ? `You have ${fmt(have)} of ${it.n}.` : null] })
          );
        }),
        el('div', { class: 'sec' }, el('h3', null, 'Daily question'), quiz ? btn('Answer for free ingredients', () => g.showQuiz(), 'teal') : el('p', { class: 'note' }, 'Answered. A new question comes tomorrow.')),
        el('p', { class: 'note', style: 'margin-top:10px' }, `Parties delivered so far: ${s.stats.ordersDone}.`),
      ];
    }
    deliver(id) {
      const r = E().deliverOrder(this.s, id);
      if (r.error) return this.act(r.error);
      const sp = WW.ANIMAL[r.species];
      this.game.sound('bank');
      this.game.toast(`${sp.n}'s party paid ${money(r.cash)}${r.winks ? ` and ${r.winks} Winks` : ''}.`, 'good', WW.animalFrames(sp)[0]);
      if (r.gift) this.game.toast(`They also brought ${WW.INGREDIENT[r.gift.id].n} x${r.gift.n}.`, 'good', WW.ingredientIcon(r.gift.id));
      if (r.isNew) this.game.onNewSpecies(sp);
      this.game.afterAction();
      this.render();
    }

    // Recipes and the Test Kitchen

    recipes() {
      const s = this.s;
      if (this.sub.test) return this.testKitchen();
      const filter = this.sub.filter || 'all';
      const list = WW.DISHES.filter((d) => filter === 'all' || d.st === filter);
      const known = Object.keys(s.known).length;
      const rows = list.map((d) => {
        const k = s.known[d.id];
        if (k) {
          const cost = E().upgradeCost(s, d.id);
          const hasAll = Object.keys(cost.ing).every((id) => (s.pantry[id] || 0) >= cost.ing[id]);
          const batch = E().batchInfo(s, d.id);
          return el(
            'div',
            { class: 'row', tip: () => tips.dish(d, s) },
            el('div', { class: 'spr' }, dishImg(d)),
            el('div', { class: 'grow' }, el('div', { class: 'title' }, d.n, ' ', el('span', { class: 'stars' }, '*'.repeat(k.lvl))), el('div', { class: 'sub' }, `${d.st} · ${needLabel(d, batch.need)} · ${fmt(batch.y)} portions · ${Math.round(E().dishPrice(s, d))} each · made ${k.made}x`), el('div', null, d.fl.map(flChip)), k.lvl < 5 ? el('div', { class: 'sub', style: 'font-size:15px' }, `Upgrade: ${money(cost.cash)} and `, ingList(s, cost.ing)) : null),
            k.lvl < 5 ? btn('Upgrade', () => this.upgrade(d.id), 'small plain', !hasAll || s.cash < cost.cash, { title: 'Upgrade this recipe', lines: ['+15% price, +10% portions, more XP per guest.', `Costs ${money(cost.cash)}.`, whyNot(s, cost.cash), hasAll ? null : 'You need more ingredients, shown in red.'] }) : null
          );
        }
        const hints = s.hints[d.id] || [];
        return el(
          'div',
          { class: 'row', tip: { title: 'A recipe you have not found', lines: [`Made ${d.st === 'pot' ? 'in the pot' : 'on the ' + d.st}. Try combinations in the Test Kitchen.`, 'Hints come from tasting at neighbours, or Winks.'] } },
          el('div', { class: 'spr' }, img(silhouette(WW.dishIcon(d)), '', 'Unknown dish')),
          el('div', { class: 'grow' }, el('div', { class: 'title' }, '???'), el('div', { class: 'sub' }, `${d.st} · tastes `, d.fl.map(flChip), d.lvl > s.level ? ` · from level ${d.lvl}` : ''), hints.length ? el('div', { class: 'sub' }, 'Contains: ', hints.map((h) => WW.INGREDIENT[h].n).join(', ')) : null),
          btn(`Hint ${WW.CFG.HINT_COST}`, () => this.hint(d.id), 'small lilac', s.winks < WW.CFG.HINT_COST || hints.length >= Object.keys(d.ing).length, { title: 'Buy a hint', lines: [`${WW.CFG.HINT_COST} Winks shows one thing that goes in.`, hints.length >= Object.keys(d.ing).length ? 'You already know everything that goes in.' : s.winks < WW.CFG.HINT_COST ? `You have ${s.winks} Winks.` : null] })
        );
      });
      const chip = (id, label) => el('button', { class: 'chip' + (filter === id ? ' on' : ''), type: 'button', on: { click: () => this.open('recipes', { filter: id }) } }, label);
      return [this.head('Recipes', el('span', { class: 'note tabnum' }, `${known} of ${WW.DISHES.length}`)), el('div', { style: 'margin-bottom:8px' }, btn('Open the Test Kitchen', () => this.open('recipes', { test: true }), 'lilac')), el('div', { class: 'chips' }, chip('all', 'All'), chip('stove', 'Stove'), chip('wok', 'Wok'), chip('pot', 'Pot')), rows];
    }
    upgrade(id) {
      const err = E().upgradeDish(this.s, id);
      if (err) return this.act(err);
      this.game.sound('level');
      this.game.afterAction();
      this.render();
    }
    hint(id) {
      const r = E().buyHint(this.s, id);
      if (r.error) return this.act(r.error);
      this.game.toast(`That dish has ${WW.INGREDIENT[r.hint.ingredient].n} in it.`, 'good');
      this.game.afterAction();
      this.render();
    }
    testKitchen() {
      const s = this.s;
      const picks = this.sub.picks || [];
      const ids = Object.keys(s.pantry).filter((k) => s.pantry[k] > 0).sort((a, b) => WW.INGREDIENT[a].tier - WW.INGREDIENT[b].tier);
      const toggle = (id) => {
        const p = picks.includes(id) ? picks.filter((x) => x !== id) : picks.length < 3 ? picks.concat(id) : picks;
        this.sub = { test: true, picks: p, result: null };
        this.game.sound('tap');
        if (p.length) this.game.sfx.chord(p.map((x) => WW.INGREDIENT[x].fl[0]));
        this.render();
      };
      const score = {};
      for (const id of picks) {
        const f = WW.INGREDIENT[id].fl;
        score[f[0]] = (score[f[0]] || 0) + 3;
        score[f[1]] = (score[f[1]] || 0) + 1;
      }
      const max = Math.max(1, ...Object.values(score));
      const bars = Object.keys(WW.FLAVOURS).map((f) => el('div', { style: 'display:flex;align-items:center;gap:6px' }, el('span', { style: 'width:52px;font-size:16px' }, WW.FLAVOURS[f].n), el('div', { class: 'bar', style: 'flex:1;margin:2px 0' }, el('i', { style: `width:${((score[f] || 0) / max) * 100}%;background:${WW.FLAVOURS[f].c}` }))));
      const r = this.sub.result;
      let resultEl = null;
      if (r) {
        if (r.found) {
          const def = WW.DISH[r.found];
          resultEl = el('div', { class: 'row' }, el('div', { class: 'spr' }, dishImg(def)), el('div', { class: 'grow' }, el('div', { class: 'title' }, `New recipe: ${def.n}`), el('div', { class: 'sub' }, 'It is in your book now.')));
        } else if (r.again) resultEl = el('p', { class: 'note' }, `You already know this one: ${WW.DISH[r.again].n}.`);
        else if (r.levelLock) resultEl = el('p', { class: 'note' }, `Your hamster senses something here, but can't make it until level ${r.levelLock}.`);
        else if (r.close) resultEl = el('p', { class: 'note' }, `Close. ${r.close} of these go together in a dish you have not found yet.`);
        else resultEl = el('p', { class: 'note' }, 'Nothing there. At least the flavours were interesting.');
      }
      return [
        this.head('Test Kitchen', btn('Back', () => this.open('recipes'), 'small plain')),
        el('p', { class: 'note' }, `Pick up to three ingredients and taste them. Each try costs ${WW.CFG.EXPERIMENT_COST} Winks and uses one of each. Winks fill up only while he sleeps. You have ${s.winks}.`),
        el('div', { class: 'sec' }, bars),
        el(
          'div',
          { class: 'sec', style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center' },
          btn('Taste', () => {
            const res = E().experiment(s, picks);
            if (res.error) return this.act(res.error);
            this.game.sfx.chord(Object.keys(res.flavours));
            if (res.found) this.game.sound('new');
            this.sub = { test: true, picks: picks.filter((id) => (s.pantry[id] || 0) > 0), result: res };
            this.game.afterAction();
            this.render();
          }, 'lilac', !picks.length || s.winks < WW.CFG.EXPERIMENT_COST, { title: 'Taste', lines: [`Costs ${WW.CFG.EXPERIMENT_COST} Winks and uses one of each.`, !picks.length ? 'Nothing picked.' : s.winks < WW.CFG.EXPERIMENT_COST ? `You have ${s.winks} Winks.` : null] }),
          el('span', { class: 'note' }, picks.length ? picks.map((p) => WW.INGREDIENT[p].n).join(' + ') : 'Nothing picked.')
        ),
        resultEl,
        el('div', { class: 'sec' }, el('h3', null, 'Pantry'), ids.length ? el('div', { class: 'grid' }, ids.map((id) => el('button', { class: 'cell food' + (picks.includes(id) ? ' on' : ''), type: 'button', tip: () => tips.ingredient(id), on: { click: () => toggle(id) } }, tierTag(id), img(WW.ingredientIcon(id), '', WW.INGREDIENT[id].n), el('span', { class: 'cap tabnum' }, s.pantry[id])))) : el('p', { class: 'note' }, 'Empty. The market has plenty.')),
      ];
    }

    // Staff

    staff() {
      const s = this.s;
      const limits = E().staffLimits(s.level);
      const count = (r) => s.staff.filter((w) => w.role === r).length;
      const look = (w) => (w.role === 'head' ? { fur: s.chef.fur, hat: s.chef.hat, job: 'chef' } : { fur: w.fur, job: w.role === 'sous' ? 'sous' : w.role });
      const specText = { stove: '+20% portions on the stove', wok: '+20% portions on the wok', fast: 'Cooks 15% faster' };
      const hired = s.staff.filter((w) => w.role !== 'head').map((w) =>
        el(
          'div',
          { class: 'row', tip: () => tips.staff(w, s) },
          el('div', { class: 'spr tall' }, img(WW.hamsterPose(look(w), 0), '', w.n)),
          el('div', { class: 'grow' }, el('div', { class: 'title' }, w.n), el('div', { class: 'sub' }, w.role === 'sous' ? `Sous chef${w.spec ? ' · ' + specText[w.spec] : ''}` : w.role === 'waiter' ? 'Waiter' : 'Cleaner'), el('div', { class: 'bar energy' }, el('i', { style: `width:${Math.round(w.energy)}%` }))),
          el('div', { style: 'display:grid;gap:4px' }, btn('Feed', () => this.act(E().feedStaff(s, w.id)) || this.render(), 'small plain', !s.lunch || w.energy >= 100, { title: 'Give a lunchbox', lines: [`+${WW.CFG.LUNCH_ENERGY + E().fxOf(s).lunch} energy`, !s.lunch ? 'No lunchboxes packed.' : w.energy >= 100 ? 'Already full of energy.' : null] }), btn('Fire', () => this.act(E().fire(s, w.id)) || this.render(), 'small plain', false, { title: 'Fire', lines: ['Costs 200 cash. They go back to the street.'] }))
        )
      );
      const free = WW.NEIGHBOURS.filter((n) => !s.staff.some((w) => w.id === n.id));
      return [
        this.head('Staff'),
        el('div', { class: 'row', tip: () => tips.staff(s.staff[0], s) }, el('div', { class: 'spr tall' }, img(WW.hamsterPose(look({ role: 'head' }), 0), '', s.chef.name)), el('div', { class: 'grow' }, el('div', { class: 'title' }, `${s.chef.name}, head chef`), el('div', { class: 'sub' }, 'Your hamster. Runs one stove or wok at no energy cost, with 10% more portions.')), btn('Change', () => this.game.showChefEditor(), 'small plain', false, { title: 'Change', lines: ['Name, fur, hat and the name of your restaurant.'] })),
        el('p', { class: 'note', style: 'margin-top:6px' }, `Every hamster's energy comes back ${WW.CFG.QUIET_ENERGY}% per round the real hamster sleeps. A batch takes ${+(WW.CFG.SOUS_ENERGY * (1 - E().fxOf(s).sous)).toFixed(2)}% from a sous chef, a guest takes ${+(WW.CFG.WAITER_ENERGY * (1 - E().fxOf(s).waiter)).toFixed(2)}% from a waiter. ${s.lunch} lunchboxes packed.`),
        el('div', { class: 'sec' }, el('h3', null, `Your team: ${count('sous')}/${limits.sous} sous chefs, ${count('waiter')}/${limits.waiter} waiters, ${count('cleaner')}/${limits.cleaner} cleaners`), hired),
        el(
          'div',
          { class: 'sec' },
          el('h3', null, 'Hire from the street'),
          el('p', { class: 'note' }, 'Your neighbours will come and work for you. Put someone on cleaning duty if you are annoyed with them.'),
          free.map((n) =>
            el(
              'div',
              { class: 'row', tip: { icon: WW.hamsterPose({ fur: n.fur, job: n.role === 'sous' ? 'sous' : n.role }, 0), title: n.n, lines: [n.spec ? specText[n.spec] : `Good at ${n.role} work`, 'The fee grows with your team size.'] } },
              el('div', { class: 'spr tall' }, img(WW.hamsterPose({ fur: n.fur, job: n.role === 'sous' ? 'sous' : n.role }, 0), '', n.n)),
              el('div', { class: 'grow' }, el('div', { class: 'title' }, n.n), el('div', { class: 'sub' }, n.spec ? specText[n.spec] : `Good at ${n.role} work`)),
              el('div', { style: 'display:grid;gap:4px' }, ['sous', 'waiter', 'cleaner'].map((r) => btn(`${r === 'sous' ? 'Sous' : r === 'waiter' ? 'Waiter' : 'Cleaner'} ${fmt(E().hireFee(s, r))}`, () => this.doHire(n.id, r), 'small plain', count(r) >= limits[r] || s.cash < E().hireFee(s, r), { title: `Hire ${n.n} as ${r === 'sous' ? 'a sous chef' : 'a ' + r}`, lines: [`Costs ${money(E().hireFee(s, r))}.`, count(r) >= limits[r] ? `Level ${s.level} allows ${limits[r]} ${staffWord(r, limits[r])}.` : whyNot(s, E().hireFee(s, r))] })))
            )
          )
        ),
      ];
    }
    doHire(id, role) {
      const err = E().hire(this.s, id, role);
      if (err) return this.act(err);
      this.game.sound('new');
      this.game.afterAction();
      this.render();
    }

    // Decor

    decor() {
      const s = this.s;
      const g = this.game;
      const ed = g.scene.editing;
      const kind = this.sub.kind || (g.scene.view === 'in' ? 'table' : 'yard');
      const outside = kind === 'yard' || kind === 'exterior';
      const charm = E().charmOf(s);
      const bagIds = Object.keys(s.bag).filter((k) => s.bag[k] > 0);
      const seats = E().seatsOf(s).length;
      const nextRoom = E().nextExpansion(s);
      const styleRow = (k, label) =>
        el(
          'div',
          { class: 'sec' },
          el('h3', null, label),
          el(
            'div',
            { class: 'stylegrid' },
            Object.keys(WW.ROOM_STYLES[k]).map((id) => {
              const st = WW.ROOM_STYLES[k][id];
              const owned = !st.price || s.styles[k + ':' + id];
              const on = s.style[k] === id;
              const locked = !owned && s.level < st.lvl;
              return el('button', { class: 'stylecell' + (on ? ' on' : ''), type: 'button', disabled: locked, tip: { title: st.n, lines: [owned ? (on ? 'In use' : 'Yours. Tap to use.') : `${money(st.price)}${locked ? ', from level ' + st.lvl : ''}`, st.rating ? `Rating +${st.rating} while in use` : null] }, on: { click: () => this.style(k, id) } }, img(WW.stylePreview(k, id), '', st.n), el('span', { class: 'cap' }, owned ? st.n : fmt(st.price)));
            })
          )
        );
      const slot = this.sub.slot || 'wall';
      // Each choice is shown on your own building as it stands, so you can see how it will go with the rest.
      const partRow = (slotId) =>
        el(
          'div',
          { class: 'sec' },
          el(
            'div',
            { class: 'stylegrid big' },
            Object.keys(WW.EXTERIOR[slotId]).map((id) => {
              const part = WW.EXTERIOR[slotId][id];
              const owned = !part.price || s.exteriors[slotId + ':' + id];
              const on = s.exterior[slotId] === id;
              const locked = !owned && s.level < part.lvl;
              const preview = WW.exteriorCanvas(Object.assign({}, s.exterior, { [slotId]: id }), { cols: 12, rows: 5 }, 'summer');
              return el('button', { class: 'stylecell' + (on ? ' on' : ''), type: 'button', disabled: locked, tip: { title: part.n, lines: [owned ? (on ? 'In use' : 'Yours. Tap to use.') : `${money(part.price)}${locked ? ', from level ' + part.lvl : ''}`, part.price ? `Rating +${part.rating}, charm +${part.charm} while in use` : null, !owned && !locked ? whyNot(s, part.price) : null] }, on: { click: () => this.exterior(slotId, id) } }, img(preview, '', part.n), el('span', { class: 'cap' }, part.n), owned ? null : el('span', { class: 'cap tabnum' }, locked ? `${fmt(part.price)} · L${part.lvl}` : fmt(part.price)));
            })
          )
        );
      const sorted = (kindId) => WW.DECOR.filter((d) => d.kind === kindId && !d.festival).sort((a, b) => a.price - b.price);
      const chipOf = (id, label, line) => el('button', { class: 'chip' + (kind === id ? ' on' : ''), type: 'button', tip: { title: label, lines: [line] }, on: { click: () => this.open('decor', { kind: id }) } }, label);
      return [
        this.head('Decor Shop'),
        el('div', { class: 'row', tip: () => g.houseTip(s) }, el('div', { class: 'grow' }, el('div', { class: 'title' }, `${seats} seat${seats === 1 ? '' : 's'} · up to ${E().capacity(s)} guests a round`), el('div', { class: 'sub' }, `House level ${E().roomLevel(s.room).level} of ${E().roomLevel(s.room).top} · Room ${s.room.cols} by ${s.room.rows} · rating ${E().ratingStars(s).toFixed(1)} of 5 · tips +${Math.round(E().tipFactor(s) * 100)}% · tidiness ${Math.round(s.hygiene)}%`)), btn(ed ? 'Done' : 'Arrange', () => g.toggleArrange(outside ? 'out' : 'in'), ed ? 'teal small' : 'small', false, { title: ed ? 'Finish arranging' : outside ? 'Arrange the yard' : 'Arrange the room', lines: [outside ? 'Drag yard pieces around, or place what is in your bag.' : 'Drag furniture around the room, or place what is in your bag.'] })),
        el('div', { class: 'row', tip: { icon: WW.iconCanvas('star'), title: `Charm ${charm}`, lines: ['Yard pieces and the look of your building add charm.', 'Only the first of each yard piece counts.', 'More charm brings more guests, up to 50% more.'] } }, el('div', { class: 'grow sub' }, `Charm ${charm}: about ${Math.round(E().attractOf(s) * 100)}% more guests walk in.`)),
        ed ? el('p', { class: 'note' }, ed.ghost && ed.ghost.fromBag ? 'Tap a tile to place it.' : ed.selected ? 'Drag it, or tap a tile to move it.' : g.scene.view === 'out' ? 'Drag anything in the yard to move it, or pick something from your bag.' : 'Drag anything in the room to move it, or pick something from your bag.') : null,
        ed && ed.selected ? btn('Store in bag', () => g.storeSelected(), 'small plain', false, { title: 'Store in bag', lines: ['It goes back in your bag.'] }) : null,
        this.cancelBtn(ed),
        nextRoom
          ? el('div', { class: 'row', tip: { icon: WW.iconCanvas('expand'), title: 'Make the room bigger', lines: [`Grows to ${nextRoom.cols} by ${nextRoom.rows} tiles.`, 'More room for seats, shy guest decor and kitchen stations.', 'A wider room also moves the door along the wall.'] } }, el('div', { class: 'spr' }, icon('expand')), el('div', { class: 'grow' }, el('div', { class: 'title' }, `Expand to ${nextRoom.cols} by ${nextRoom.rows}`), el('div', { class: 'sub' }, `${money(nextRoom.price)}${s.level < nextRoom.lvl ? ` · from level ${nextRoom.lvl}` : ''}`)), btn('Expand', () => this.expand(), 'small tomato', s.level < nextRoom.lvl || s.cash < nextRoom.price, { title: `Expand to ${nextRoom.cols} by ${nextRoom.rows}`, lines: [`Costs ${money(nextRoom.price)}.`, whyNot(s, nextRoom.price, nextRoom.lvl)] }))
          : el('p', { class: 'note' }, 'Your room is as big as it gets.'),
        bagIds.length ? el('div', { class: 'sec' }, el('h3', null, 'Your bag'), el('div', { class: 'grid' }, bagIds.map((id) => el('button', { class: 'cell food' + (ed && ed.ghost && ed.ghost.fromBag && ed.ghost.id === id ? ' on' : ''), type: 'button', tip: () => tips.decor(WW.DECOR_BY_ID[id]), on: { click: () => g.pickFromBag(id) } }, img(WW.decorCanvas(id), '', WW.DECOR_BY_ID[id].n), el('span', { class: 'cap tabnum' }, s.bag[id]))))) : null,
        el(
          'div',
          { class: 'sec' },
          el('h3', null, 'Shop'),
          el('div', { class: 'chips' }, WW.DECOR_KINDS.filter(([id]) => id === 'yard').map(([id, label]) => chipOf(id, label, KIND_TIPS[id])), chipOf('exterior', 'Building', 'How your building looks from outside, part by part. What you buy stays yours.'), WW.DECOR_KINDS.filter(([id]) => id !== 'yard').map(([id, label]) => chipOf(id, label, typeof KIND_TIPS[id] === 'function' ? KIND_TIPS[id]() : KIND_TIPS[id])), chipOf('style', 'Walls and floors', 'Change the whole look of your restaurant. What you buy stays yours.')),
          kind === 'style'
            ? [styleRow('wall', 'Walls'), styleRow('floor', 'Dining floor'), styleRow('kitchen', 'Kitchen floor')]
            : kind === 'exterior'
              ? [el('h3', { style: 'margin-top:10px' }, 'Building parts'), el('div', { class: 'chips' }, WW.EXTERIOR_SLOTS.map(([id, label]) => el('button', { class: 'chip' + (slot === id ? ' on' : ''), type: 'button', on: { click: () => this.open('decor', { kind: 'exterior', slot: id }) } }, label))), partRow(slot)]
              : sorted(kind).map((d) => {
                  const fx = WW.fxText(d.fx);
                  const n = (d.kind === 'yard' ? s.yard : s.furniture).filter((f) => f.id === d.id).length;
                  return el(
                    'div',
                    { class: 'row', tip: () => tips.decor(d) },
                    el('div', { class: 'spr' }, img(WW.decorCanvas(d.id), 'contain', d.n)),
                    el('div', { class: 'grow' }, el('div', { class: 'title' }, d.n), el('div', { class: 'sub' }, `${money(d.price)} · ${d.charm ? `charm +${d.charm} · ` : ''}rating +${d.rating}${d.lvl > s.level ? ` · level ${d.lvl}` : ''}${n ? ` · ${n} placed` : ''}`), fx ? el('div', { class: 'sub fxline', style: 'font-size:15px' }, fx) : null, !fx && d.note ? el('div', { class: 'sub', style: 'font-size:15px' }, d.note) : null),
                    btn('Buy', () => this.buyDecor(d.id), 'small', s.level < d.lvl || s.cash < d.price, { title: `Buy ${d.n}`, lines: [`Costs ${money(d.price)}. It goes into your bag.`, whyNot(s, d.price, d.lvl)] })
                  );
                })
        ),
      ];
    }
    style(kind, id) {
      const err = E().buyStyle(this.s, kind, id);
      if (err) return this.act(err);
      this.game.sound('plate');
      this.game.afterAction();
      this.render();
    }
    exterior(slot, id) {
      const err = E().buyExterior(this.s, slot, id);
      if (err) return this.act(err);
      this.game.sound('plate');
      this.game.afterAction();
      this.render();
    }
    expand() {
      const err = E().expandRoom(this.s);
      if (err) return this.act(err);
      this.game.sound('level');
      this.game.toast(`The room grew to ${this.s.room.cols} by ${this.s.room.rows} tiles. Drag the map to look around.`, 'good');
      this.game.seatsChanged();
      this.game.afterAction();
      this.render();
    }
    buyDecor(id) {
      const err = E().buyDecor(this.s, id);
      if (err) return this.act(err);
      this.game.sound('coin');
      this.game.toast(`${WW.DECOR_BY_ID[id].n} is in your bag. Tap Arrange to place it.`, 'good');
      this.game.afterAction();
      this.render();
    }

    // The guest book

    guests() {
      const s = this.s;
      const rar = this.sub.rar || 'all';
      const met = Object.keys(s.book).length;
      const list = WW.ANIMALS.filter((a) => rar === 'all' || a.rar === rar);
      const chip = (id, label) => {
        const pool = id === 'all' ? WW.ANIMALS : WW.ANIMALS.filter((a) => a.rar === id);
        return el('button', { class: 'chip' + (rar === id ? ' on' : ''), type: 'button', tip: { title: label, lines: [`${pool.filter((a) => s.book[a.id]).length} of ${pool.length} met`] }, on: { click: () => this.open('guests', { rar: id }) } }, label);
      };
      return [
        this.head('Guest Book', el('span', { class: 'note tabnum' }, `${met} of ${WW.ANIMALS.length} met`)),
        el('p', { class: 'note' }, 'Hover a guest to see what brings them in. On a phone, hold your finger on it.'),
        el('div', { class: 'chips', style: 'margin-top:8px' }, chip('all', 'All'), ['c', 'u', 'r', 'e', 'l'].map((k) => chip(k, WW.RARITY[k].n))),
        el(
          'div',
          { class: 'grid' },
          list.map((a) => {
            const seen = s.book[a.id];
            return el('div', { class: 'cell ' + a.rar, tip: () => tips.species(a, s) }, img(seen ? WW.animalFrames(a)[0] : silOf(a), '', seen ? a.n : 'Not met yet'), el('span', { class: 'cap' }, seen ? a.n : '???'));
          })
        ),
      ];
    }

    // Street

    streetView() {
      const view = this.sub.view;
      if (view === 'here' && !this.game.visit) return 'board';
      return view || (this.game.visit ? 'here' : 'board');
    }
    streetChips() {
      const g = this.game;
      const view = this.streetView();
      const mail = E().mailCount(this.s);
      const chip = (id, label, line) => el('button', { class: 'chip' + (view === id ? ' on' : ''), type: 'button', tip: { title: label, lines: [line] }, on: { click: () => this.open('street', { view: id }) } }, label);
      return el('div', { class: 'chips' }, g.visit ? chip('here', 'This house', 'Clean, taste and trade here.') : null, chip('board', 'Leaderboard', 'The highest level restaurants with a connected wallet.'), chip('shelf', 'Your shelf', 'Hang up ingredients for neighbours to trade.'), chip('mail', mail ? `Mailbox (${mail})` : 'Mailbox', 'Trade offers and answers.'));
    }
    street() {
      const g = this.game;
      const view = this.streetView();
      if (view === 'here' && g.visit) return this.neighbour(g.visit.nid);
      if (view === 'shelf') return this.myShelf();
      if (view === 'mail') return this.mailbox();
      return this.leaderboard();
    }
    leaderboard() {
      const g = this.game;
      const w = g.wallet;
      w.refreshBoard();
      const rows = w.rows();
      const standing = w.standing();
      const board = w.board;
      const top = E().roomLevel(this.s.room).top;
      let state = null;
      if (!w.usable) state = 'The leaderboard is on the real site, www.squeekerant.online.';
      else if (!board) state = w.boardFailed ? 'The leaderboard cannot be reached right now.' : 'Reading the board...';
      else if (!board.open) state = 'The leaderboard is not open yet.';
      else if (!rows.length) state = w.connected() ? 'Nobody is on the board yet. Your restaurant joins it as soon as it is on the real wheel.' : 'Nobody is on the board yet. Connect your wallet to be the first.';
      return [
        this.head('Leaderboard', standing ? el('span', { class: 'note tabnum' }, `You are #${fmt(standing.place)} of ${fmt(standing.total)}`) : null),
        this.streetChips(),
        el('p', { class: 'note' }, 'Only restaurants with a connected wallet are listed. Ranked by restaurant level, then progress toward the next one.'),
        board && board.open && !w.connected() ? el('div', { class: 'boardjoin' }, el('p', { class: 'note' }, 'Put your restaurant on the board. You only sign a message. It costs nothing and sends no transaction.'), btn('Connect wallet', () => g.showWallet(), 'small tomato')) : null,
        state ? el('p', { class: 'note', style: 'margin-top:6px' }, state) : null,
        rows.map((r) => {
          const look = { fur: WW.FURS[r.fur] ? r.fur : 'golden', hat: WW.HATS[r.hat] ? r.hat : 'toque', job: 'chef' };
          return el(
            'div',
            { class: 'row rank' + (r.me ? ' me' : ''), tip: { title: r.shop, lines: [`Run by ${r.chef}.`, `Restaurant level ${r.level}`, `House level ${r.house} of ${top}`] } },
            el('b', { class: 'rankno tabnum r' + r.place }, r.place),
            el('div', { class: 'spr tall' }, img(WW.hamsterPose(look, 0), '', r.chef)),
            el(
              'div',
              { class: 'grow' },
              el('div', { class: 'title' }, r.shop),
              el('div', { class: 'sub' }, `${r.chef} · Level ${r.level} · House ${r.house}`),
              el('button', { class: 'addr tabnum', type: 'button', 'aria-label': 'Copy address', on: { click: () => g.copyText(r.wallet, 'Address copied.') } }, r.wallet)
            )
          );
        }),
      ];
    }
    myShelf() {
      const s = this.s;
      const slots = E().shelfSlots(s);
      const ids = Object.keys(s.pantry).filter((k) => s.pantry[k] > 0).sort((a, b) => WW.INGREDIENT[a].tier - WW.INGREDIENT[b].tier);
      const put = (id, n) => {
        const err = E().shelfPut(s, id, n);
        if (err) return this.act(err);
        this.game.sound('tap');
        this.game.afterAction();
        this.render();
      };
      return [
        this.head('Your shelf', el('span', { class: 'note tabnum' }, `${s.shelf.length} of ${slots} spots`)),
        this.streetChips(),
        el('p', { class: 'note' }, 'Hang up ingredients for neighbours to trade for. They always give the same level or better. Unlocked: they swap on their own. Locked: they ask first, and the offer waits in your mailbox.'),
        s.shelf.length
          ? s.shelf.map((st) => {
              const ing = WW.INGREDIENT[st.id];
              const have = s.pantry[st.id] || 0;
              return el(
                'div',
                { class: 'row', tip: () => tips.ingredient(st.id) },
                el('div', { class: 'spr' }, img(WW.ingredientIcon(st.id), '', ing.n)),
                el('div', { class: 'grow' }, el('div', { class: 'title' }, ing.n, ' ', tierTag(st.id)), el('div', { class: 'sub' }, `${fmt(st.n)} hanging · ${st.locked ? 'Locked: asks you first' : 'Unlocked: swaps on its own'}`)),
                el(
                  'div',
                  { style: 'display:grid;grid-template-columns:auto auto;gap:4px;justify-items:end' },
                  el('button', { class: 'iconbtn lockbtn' + (st.locked ? ' on' : ''), type: 'button', 'aria-label': st.locked ? 'Unlock' : 'Lock', tip: { title: st.locked ? 'Locked' : 'Unlocked', lines: [st.locked ? 'Offers wait for your answer. Click to unlock.' : 'Neighbours swap on their own. Click to lock.'] }, on: { click: () => { E().shelfLock(s, st.id, !st.locked); this.game.sound('tap'); this.game.afterAction(); this.render(); } } }, img(WW.iconCanvas(st.locked ? 'lock' : 'unlock'), '', '')),
                  btn('+1', () => put(st.id, 1), 'small plain', have < 1, { title: 'Hang one more', lines: [`You have ${fmt(have)} more in your pantry.`] }),
                  btn('Take', () => { E().shelfTake(s, st.id, st.n); this.game.sound('tap'); this.game.afterAction(); this.render(); }, 'small plain', false, { title: 'Take it all back', lines: [`${fmt(st.n)} goes back to your pantry. Offers for it are dropped.`] }),
                  btn('-1', () => { E().shelfTake(s, st.id, 1); this.game.sound('tap'); this.game.afterAction(); this.render(); }, 'small plain', false, { title: 'Take one back', lines: ['It goes back to your pantry.'] })
                )
              );
            })
          : el('p', { class: 'note', style: 'margin-top:6px' }, 'Nothing hanging yet. Pick something from your pantry below.'),
        el('div', { class: 'sec' }, el('h3', null, 'From your pantry'), ids.length ? el('div', { class: 'grid' }, ids.map((id) => el('button', { class: 'cell food', type: 'button', tip: () => tips.ingredient(id), on: { click: () => put(id, 1) } }, tierTag(id), img(WW.ingredientIcon(id), '', WW.INGREDIENT[id].n), el('span', { class: 'cap tabnum' }, fmt(s.pantry[id]))))) : el('p', { class: 'note' }, 'Empty. The market has plenty.')),
      ];
    }
    mailbox() {
      const s = this.s;
      const g = this.game;
      E().mailRead(s);
      g.updateHud();
      const offers = s.mail.filter((m) => m.kind === 'offer');
      const notes = s.mail.filter((m) => m.kind === 'note').reverse();
      return [
        this.head('Mailbox'),
        this.streetChips(),
        el('p', { class: 'note' }, 'Offers for what you locked on your shelf wait here for two days. Answers to what you asked for come here too.'),
        offers.length ? null : el('p', { class: 'note', style: 'margin-top:6px' }, 'No offers waiting.'),
        offers.map((m) => {
          const n = WW.NEIGHBOUR[m.from];
          const want = WW.INGREDIENT[m.want];
          const give = WW.INGREDIENT[m.give];
          return el(
            'div',
            { class: 'row' },
            el('div', { class: 'spr tall' }, img(WW.hamsterPose({ fur: n.fur, hat: E().neighbourHome(n.id).chef.hat, job: 'chef' }, 0), '', n.n)),
            el('div', { class: 'grow' }, el('div', { class: 'title' }, n.shop), el('div', { class: 'sub' }, `Wants your ${want.n} `, tierTag(m.want)), el('div', { class: 'sub' }, `Offers 1 ${give.n} `, tierTag(m.give))),
            el(
              'div',
              { style: 'display:grid;gap:4px' },
              btn('Accept', () => {
                const err = E().mailAccept(s, m.id);
                if (err) this.act(err);
                else {
                  g.toast(`Swapped for ${give.n}.`, 'good', WW.ingredientIcon(m.give));
                  g.sound('coin');
                  g.afterAction();
                }
                this.render();
              }, 'small', false, { title: 'Accept', lines: [`Give 1 ${want.n}, get 1 ${give.n}.`] }),
              btn('Decline', () => {
                E().mailDecline(s, m.id);
                g.sound('tap');
                g.afterAction();
                this.render();
              }, 'small plain', false, { title: 'Decline', lines: ['Your ingredient stays on the shelf.'] })
            )
          );
        }),
        notes.length ? el('div', { class: 'sec' }, el('div', { class: 'panelhead' }, el('h3', null, 'Answers'), btn('Clear', () => { E().mailClear(s); g.afterAction(); this.render(); }, 'small plain', false, { title: 'Clear', lines: ['Throw away these notes.'] })), notes.map((m) => el('div', { class: 'sub', style: 'padding:2px 0' }, m.text))) : null,
      ];
    }
    neighbour(id) {
      const s = this.s;
      const g = this.game;
      const n = WW.NEIGHBOUR[id];
      const home = g.visit.home;
      const lv = E().roomLevel(home.room);
      const v = E().neighbourDay(s, id, g.now());
      const shelf = E().neighbourShelf(s, id, g.now());
      const gives = Object.keys(s.pantry).filter((k) => s.pantry[k] > 0).sort((a, b) => WW.INGREDIENT[a].tier - WW.INGREDIENT[b].tier);
      const give = this.sub.give;
      const left = 6 - v.cleaned.length;
      const look = { fur: n.fur, job: 'chef', hat: home.chef.hat };
      const limits = E().staffLimits(s.level);
      const hired = s.staff.some((w) => w.id === id);
      const role = n.role;
      const canHire = !hired && s.staff.filter((w) => w.role === role).length < limits[role] && s.cash >= E().hireFee(s, role);
      return [
        this.head(n.shop, btn('Back to the street', () => g.walkTo('street'), 'small tomato')),
        this.streetChips(),
        el('div', { class: 'row' }, el('div', { class: 'spr tall' }, img(WW.hamsterPose(look, 0), '', n.n)), el('div', { class: 'grow' }, el('div', { class: 'title' }, n.n), el('div', { class: 'sub' }, `${left ? `Tap the dirt on their floor to clean it: ${left} spot${left > 1 ? 's' : ''} left today.` : 'Their floor is spotless now.'} ${v.shook ? 'You shook their tree today.' : 'Their tree is out on the street.'} ${v.tasted ? 'You tasted a dish today.' : 'Tap a dish on their counter to taste it.'}`))),
        el('div', { class: 'row' }, el('div', { class: 'spr' }, icon('expand')), el('div', { class: 'grow' }, el('div', { class: 'title' }, `House level ${lv.level} of ${lv.top}`), el('div', { class: 'sub' }, `Room ${home.room.cols} by ${home.room.rows} · ${E().seatsOf(home).length} seats · rating ${E().ratingStars(home).toFixed(1)} of 5`))),
        hired ? el('p', { class: 'note' }, `${n.n} also works in your kitchen.`) : el('div', { class: 'row' }, el('div', { class: 'grow sub' }, `Hire ${n.n} as ${role === 'sous' ? 'a sous chef' : 'a ' + role}.`), btn(`Hire ${fmt(E().hireFee(s, role))}`, () => this.doHire(id, role), 'small plain', !canHire, { title: `Hire ${n.n} as ${role === 'sous' ? 'a sous chef' : 'a ' + role}`, lines: [`Costs ${money(E().hireFee(s, role))}.`, s.staff.filter((w) => w.role === role).length >= limits[role] ? `Level ${s.level} allows ${limits[role]} ${staffWord(role, limits[role])}.` : whyNot(s, E().hireFee(s, role))] })),
        el(
          'div',
          { class: 'sec' },
          el('h3', null, 'Trade ingredients'),
          el('p', { class: 'note' }, 'Every ingredient has a level, shown as L1 to L4. Give something of the same level or better. Unlocked goods swap right away. For locked ones, they answer next round and may say no.'),
          el('div', { class: 'sub', style: 'margin-top:6px' }, give ? ['You give: ', WW.INGREDIENT[give].n, ' ', tierTag(give)] : 'First pick what you give:'),
          el('div', { class: 'grid', style: 'margin:6px 0' }, gives.map((k) => el('button', { class: 'cell food' + (give === k ? ' on' : ''), type: 'button', tip: () => tips.ingredient(k), on: { click: () => this.openTrade(k) } }, tierTag(k), img(WW.ingredientIcon(k), '', WW.INGREDIENT[k].n), el('span', { class: 'cap tabnum' }, s.pantry[k])))),
          el('div', { class: 'sub' }, 'Their shelf today:'),
          shelf.map((it) => {
            const problem = give ? E().tradeProblem(give, it.id) : null;
            return el(
              'div',
              { class: 'row' + (problem ? ' dim' : ''), tip: () => tips.ingredient(it.id) },
              el('div', { class: 'spr' }, img(WW.ingredientIcon(it.id), '', WW.INGREDIENT[it.id].n)),
              el('div', { class: 'grow' }, el('div', { class: 'title' }, WW.INGREDIENT[it.id].n, ' ', tierTag(it.id)), el('div', { class: 'sub' }, problem ? `Needs L${WW.INGREDIENT[it.id].tier} or better from you` : it.locked ? 'Locked: they have to agree' : 'Unlocked', ` · ${it.left} left`)),
              btn('Swap', () => this.trade(id, give, it.id), 'small plain', !give || !!problem || it.left < 1, { title: 'Swap', lines: it.left < 1 ? ['They have run out of that today.'] : !give ? ['First pick what you give.'] : problem ? [problem] : [`Give 1 ${WW.INGREDIENT[give].n}, get 1 ${WW.INGREDIENT[it.id].n}.`, it.locked ? 'They will answer next round.' : 'It swaps right away.'] })
            );
          })
        ),
      ];
    }
    openTrade(give) {
      this.sub = { give };
      this.game.sound('tap');
      this.render();
    }
    trade(nid, give, get) {
      const r = E().tradeWith(this.s, nid, give, get, this.game.now());
      if (r.error) return this.act(r.error);
      this.game.toast(r.pending ? 'Asked. They will answer next round.' : `Swapped for ${WW.INGREDIENT[get].n}.`, 'good');
      this.game.afterAction();
      this.sub = (this.s.pantry[give] || 0) > 0 ? { give } : {};
      this.render();
    }

    // The wheel, in plain numbers

    wheel() {
      const s = this.s;
      const g = this.game;
      const t = g.now();
      const live = g.live;
      const now = g.feed.roundAt(t);
      const settled = g.feed.settled(t);
      const start = settled - 143;
      let workDay = 0;
      let active = 0;
      const bars = [];
      for (let r = start; r <= settled; r++) {
        const info = g.feed.round(r);
        workDay += info.work;
        if (info.work > 0) active++;
        bars.push(info);
      }
      const maxW = Math.max(1, ...bars.map((b) => b.work));
      const last = g.feed.round(settled);
      const chart = WW.makeCanvas(144, 30);
      const cx = chart.getContext('2d');
      bars.forEach((b, i) => {
        if (b.unknown) {
          cx.fillStyle = '#d8cfc0';
          cx.fillRect(i, 0, 1, 30);
        } else if (b.work > 0) {
          const h = Math.max(1, Math.round((b.work / maxW) * 28));
          cx.fillStyle = C.gold;
          cx.fillRect(i, 30 - h, 1, h);
        } else {
          cx.fillStyle = C.lilac;
          cx.fillRect(i, 28, 1, 2);
        }
      });
      const stateText = { running: 'Running', breather: 'Catching his breath', quiet: 'Not on the wheel', unknown: 'No signal' }[live.state];
      const line = (a, b) => el('div', { class: 'line' }, a, el('b', { class: 'tabnum', style: 'overflow-wrap:anywhere;text-align:right' }, b));
      const words = (a, b) => el('div', { class: 'line' }, a, el('span', { style: 'text-align:right' }, b));
      return [
        this.head('The Wheel'),
        el('div', { class: 'row' }, el('div', { class: 'grow' }, el('div', { class: 'title' }, `Squeektoshi: ${stateText}`), el('div', { class: 'sub' }, live.state === 'running' ? `${live.rpm} turns a minute` : g.quietText()))),
        el('p', { class: 'note' }, g.feed.describe()),
        el('div', { class: 'sec' }, el('h3', null, 'Last 24 hours'), el('img', { class: 'px', style: 'width:100%;height:60px', src: chart.toDataURL(), alt: 'Passes per round over 24 hours' }), line('Wheel passes', fmt(workDay)), line('Distance', ((workDay * (g.feed.mmPerPass || 878)) / 1e6).toFixed(1) + ' km'), line('Rounds with running', `${active} of 144`), line('Guests the wheel brought', fmt(workDay / WW.CFG.WORK_PER_GUEST))),
        el('div', { class: 'sec' }, el('h3', null, 'How he runs your kitchen'), words('When he runs', 'Guests walk in, woks fire, staff tire'), words('When he sleeps', 'Pots simmer, Winks fill, staff rest'), words('When he wakes', 'His dream becomes a dish'), words('No signal', 'Nothing counts, nothing is lost')),
        el('p', { class: 'note', style: 'margin-top:8px' }, 'Nothing here can wake him or ask him to run. His care policy puts rest first, and so does this kitchen: food never spoils, and a quiet day just means more Winks.'),
        el('div', { class: 'sec' }, el('h3', null, 'Latest settled round'), line('Round', fmt(settled)), line('Passes', last.unknown ? 'unknown' : fmt(last.work)), line('Current round', fmt(now)), line('Last data hash', s.clock.hash || 'none'), g.feed.rec ? line('Contract', g.feed.rec.core) : g.feed.core ? line('Contract', g.feed.core) : null),
        el('p', { class: 'note', style: 'margin-top:8px' }, 'A round with no passes shows no accepted work. It doesn\'t prove he was asleep. The sensor only counts passes.'),
      ];
    }

    // Diary: to do list, the critic, dreams

    diary() {
      const s = this.s;
      const undone = WW.PREP.filter((p) => !s.prep[p.id]).slice(0, 5);
      const doneN = WW.PREP.filter((p) => s.prep[p.id]).length;
      const c = s.critic;
      const known = Object.keys(s.known);
      const togglePick = (k) => {
        E().criticPick(s, k);
        this.game.afterAction();
        this.render();
      };
      const journal = Object.keys(s.journal);
      return [
        this.head('Diary'),
        el('div', { class: 'sec', style: 'margin-top:0' }, el('h3', null, `Prep list, ${doneN} of ${WW.PREP.length} done`), undone.map((p) => el('div', { class: 'row' }, el('div', { class: 'grow sub' }, p.n), el('b', { class: 'tabnum' }, `+${p.reward} cash`)))),
        el(
          'div',
          { class: 'sec' },
          el('h3', null, 'Sir Slowbite, the tortoise critic'),
          el('div', { class: 'row' }, img(WW.animalFrames(WW.ANIMAL.tortoise)[0], 'critter', 'Sir Slowbite'), el('div', { class: 'grow' }, el('div', { class: 'sub' }, c.due ? 'He arrives when the wheel next starts after a long sleep. Name three dishes. A portion of each is set aside if you have one. If not, it must be on the counter when he comes.' : `He visits after every seventh long sleep. ${Math.max(0, 7 - (s.wakes - c.wakesAt))} to go.`), el('div', { class: 'title', style: 'margin-top:4px' }, `${c.stars} star${c.stars === 1 ? '' : 's'} earned`, c.last ? `, last visit ${c.last.stars}` : ''))),
          c.hints.length ? el('div', null, el('div', { class: 'sub', style: 'color:var(--brick)' }, 'Overheard in dreams:'), c.hints.map((h) => el('div', { class: 'sub' }, h))) : null,
          c.due ? el('div', { style: 'margin-top:8px' }, el('div', { class: 'sub' }, `Your picks: ${c.picks.length ? c.picks.map((k) => E().dishDef(k).n + (c.reserved && c.reserved[k] ? ' (set aside)' : ' (not ready)')).join(', ') : 'none yet'}`), el('div', { class: 'grid', style: 'margin-top:6px' }, known.map((k) => el('button', { class: 'cell food' + (c.picks.includes(k) ? ' on' : ''), type: 'button', tip: () => tips.dish(WW.DISH[k], s), on: { click: () => togglePick(k) } }, dishImg(WW.DISH[k]), el('span', { class: 'cap' }, WW.DISH[k].n))))) : null
        ),
        el('div', { class: 'sec' }, el('h3', null, 'Guest book trophies'), el('div', { class: 'grid' }, WW.CFG.BOOK_TROPHIES.map((n) => el('div', { class: 'cell food', tip: () => tips.decor(WW.DECOR_BY_ID['trophy_' + n]) }, img(s.trophies[n] ? WW.decorCanvas('trophy_' + n) : silhouette(WW.decorCanvas('trophy_' + n)), '', `${n} guests`), el('span', { class: 'cap' }, String(n)))))),
        el('div', { class: 'sec' }, el('h3', null, `Dream journal, ${journal.length} of ${WW.DREAMS.length * 2}`), journal.length ? el('div', { class: 'grid' }, journal.map((k) => el('div', { class: 'cell food', tip: () => tips.dish(E().dishDef(k), s) }, dishImg(E().dishDef(k)), el('span', { class: 'cap' }, E().dishDef(k).n)))) : el('p', { class: 'note' }, 'His first long sleep will write the first page.')),
        el('div', { class: 'sec' }, el('h3', null, 'Lately'), s.log.slice(0, 8).map((l) => el('div', { class: 'sub', style: 'padding:2px 0' }, l)), !s.log.length ? el('p', { class: 'note' }, 'Nothing yet.') : null),
        el('div', { class: 'sec' }, btn('Start a new restaurant', () => this.game.confirmReset(), 'small plain', false, { title: 'Start a new restaurant', lines: ['This deletes your restaurant, guest book and recipes on this device.'] })),
      ];
    }
  }

  WW.Panels = Panels;
  WW.el = el;
  WW.img = img;
  WW.icon = icon;
  WW.btn = btn;
  WW.fmt = fmt;
  WW.money = money;
  WW.flChip = flChip;
  WW.dishImg = dishImg;
  WW.ingList = ingList;
  WW.needLabel = needLabel;
})((globalThis.WW = globalThis.WW || {}));
