// system/l5r5e/panels.js — the GM's panels: Adventure, Party, Inspector, Cast, Dice, Rules &
// Book, Log, Campaign. Registered into the engine's registry; the shell (engine/app.js) decides
// where they show. Every word of rules text shown comes from the corpus.
(function () {
  const { el, button, debounce } = window.VttRender;
  const D = window.L5RData;
  const E = window.L5REntity;
  const Dice = window.L5RDice;
  const Sheet = window.L5RSheet;
  const State = window.VttState;
  const Bus = window.VttBus;
  const Panels = window.VttPanels;
  const Sys = () => window.VttSystem;
  const S = () => State.state;

  // a link inside any rendered entity opens it in the Inspector here, loading its book first
  window.L5ROpenEntity = (id) => {
    const r = D.entity(id) || D.records().find((x) => x.id === id);
    if (!r) return;
    D.ensure(r.book).then(() => Panels.select({ kind: 'entity', id }));
  };
  const editing = (c) => document.activeElement && /TEXTAREA|INPUT|SELECT/.test(document.activeElement.tagName) && c.contains(document.activeElement);
  const mid = () => Sys().moduleId();
  const progress = (sceneId) => ((S().progress || {})[mid()] || {})[sceneId] || { done: false, notes: '' };
  function goTo(sceneId) {
    State.commit('setCurrentScene', [mid(), sceneId]);
    Bus.emit('scene:changed', { moduleId: mid(), sceneId });
  }

  // ── Adventure: pick one of the sixteen, then its parts and scenes ──
  function renderAdventure(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const pick = el('select', { class: 'scope' }, [el('option', { value: '' }, ['— pick the adventure in play —'])].concat(
        D.moduleList().map((m) => el('option', { value: m.id, selected: m.id === mid() || null }, [m.name + (D.label(m.book) !== m.name ? ' · ' + D.label(m.book) : '')]))));
      pick.addEventListener('change', () => {
        State.commit('setCampaign', [{ modules: pick.value ? [pick.value] : [] }]);
        draw();
      });
      container.appendChild(pick);
      if (!mid()) return container.appendChild(el('div', { class: 'empty' }, ['No adventure in play. Pick one of the sixteen above — or run the table without one.']));
      const m = Sys().module();
      if (!m) return container.appendChild(el('div', { class: 'muted loading' }, ['Opening ' + (D.moduleList().find((x) => x.id === mid()) || {}).name + '…']));
      const all = Sys().scenes();
      const cur = Sys().currentSceneId();
      const done = all.filter((s) => progress(s.id).done).length;
      container.appendChild(el('h4', {}, [m.name, el('span', { class: 'muted small' }, [' · ' + done + ' of ' + all.length + ' scenes done'])]));
      const list = el('div', { class: 'scene-list' });
      m.phases.forEach((ph) => {
        list.appendChild(el('div', { class: 'phase-h' }, [ph.name || 'Other scenes']));
        ph.scenes.forEach((sid) => {
          const s = m.scenes.find((x) => x.id === sid);
          const st = progress(sid);
          const n = Sys().castIds(sid).length;
          list.appendChild(el('div', { class: 'scene-row' + (cur === sid ? ' current' : '') + (st.done ? ' done' : '') }, [
            el('input', { type: 'checkbox', checked: st.done || null, title: 'Done', onchange: (ev) => State.commit('setSceneDone', [m.id, sid, ev.target.checked]) }),
            el('button', { class: 'scene-link', type: 'button', onclick: () => goTo(sid) }, [s.name]),
            n ? el('span', { class: 'muted small' }, [n + ' in it']) : null,
          ]));
        });
      });
      container.appendChild(list);
      const s = Sys().scene(cur);
      if (s) container.appendChild(sceneSection(m, s));
    };
    ctx.on('state:changed', () => { if (!editing(container)) draw(); });
    ctx.on('state:remote', draw);
    ctx.on('scene:changed', draw);
    draw();
  }
  function sceneSection(m, s) {
    const st = progress(s.id);
    const here = Sys().cast(s.id);
    const part = s.part;
    return el('section', { class: 'scene' }, [
      el('h4', {}, ['This scene', el('span', { class: 'muted small' }, [part && !s.whole ? ' · ' + part.name : ''])]),
      el('div', { class: 'paper' }, [
        el('h3', {}, [s.name]),
        s.block ? E.nodes(s.block.body, m.book) : part ? E.prose(part.desc, 'prose', m.book) : null,
      ]),
      el('div', { class: 'chiprow tight' }, [
        button('Open on the table', () => window.open(window.VttConfig.pages.table + '?scene=' + encodeURIComponent(s.id), (window.VttConfig.channel || 'vtt') + '-table'), 'tiny'),
        el('a', { class: 'btn ghost tiny', href: './#adventures/' + encodeURIComponent(m.id) + '/' + encodeURIComponent(s.id), target: '_blank' }, ['Its text in the reader']),
      ]),
      el('div', { class: 'prop-k' }, ['In it']),
      here.length ? el('div', { class: 'chiprow tight' }, here.map((e) => el('span', { class: 'chip' }, [
        el('button', { class: 'ref', type: 'button', onclick: () => window.L5ROpenEntity(e.id) }, [e.name]),
        el('button', { class: 'ref tiny', type: 'button', title: 'take out', onclick: () => State.commit('setSceneCast', [s.id, Sys().castIds(s.id).filter((x) => x !== e.id)]) }, ['×']),
      ]))) : el('div', { class: 'muted small' }, ['No one yet — the Cast panel puts NPCs here.']),
      el('div', { class: 'prop-k' }, ['GM notes', el('span', { class: 'muted' }, [' · never sent to players'])]),
      el('textarea', { class: 'text', rows: 5, placeholder: 'What happens here…', oninput: debounce((ev) => State.commit('setSceneNotes', [m.id, s.id, ev.target.value]), 400) }, [st.notes || '']),
    ]);
  }

  // ── Party ──────────────────────────────────────────────────────────
  function characterLoader(label, cls) {
    const file = el('input', { type: 'file', accept: '.json,application/json', hidden: true, multiple: true });
    file.addEventListener('change', () => {
      const files = Array.from(file.files || []);
      Promise.all(files.map((f) => f.text().then((text) => Sys().readCharacter(JSON.parse(text), f.name))))
        .then((members) => {
          members.forEach((m) => State.commit('addPartyMember', [m]));
          if (members.length) Panels.select({ kind: 'party', id: members[members.length - 1].id });
        })
        .catch((e) => alert(e.message))
        .finally(() => (file.value = ''));
    });
    return el('span', {}, [button(label, () => file.click(), cls), file]);
  }
  // a published character joins the party as a member built from its corpus entity
  function pregenPicker() {
    const sel = el('select', { class: 'scope' }, [el('option', { value: '' }, ['add a pregenerated character…'])].concat(
      D.pregens().map((r) => el('option', { value: r.id }, [r.name + ' · ' + D.label(r.book)]))));
    sel.addEventListener('change', () => {
      const r = D.pregens().find((x) => x.id === sel.value);
      sel.value = '';
      if (!r) return;
      D.ensure(['core', r.book]).then(() => {
        const m = Sheet.memberFromEntity(D.entity(r.id));
        State.commit('addPartyMember', [m]);
        Panels.select({ kind: 'party', id: m.id });
      });
    });
    return sel;
  }
  // The GM ends a scene or a session for the whole party (system/l5r5e/sheet.js endScene /
  // endSession). Where the instance's house rule makes a session's end remove strife, the GM
  // chooses first whose full total is carried instead.
  let sessionAsk = false;
  function boundaries(party) {
    const row = el('div', { class: 'chiprow boundaries' }, [
      button('End scene', () => { if (confirm('End the scene for the party? Strife and fatigue come down to half, rounded up; once-per-scene uses return.')) Sheet.endScene(party.map((m) => m.id)); }, 'tiny'),
      button('End session…', () => { sessionAsk = !sessionAsk; Bus.emit('state:remote', { view: true }, { local: true }); }, 'ghost tiny'),
    ]);
    if (!sessionAsk) return row;
    const clears = Sheet.sessionClearsStrife();
    const boxes = party.map((m) => ({ id: m.id, box: el('input', { type: 'checkbox' }), name: m.name }));
    return el('div', {}, [row, el('div', { class: 'session-ask' }, [
      el('div', { class: 'muted small' }, [clears ? 'This campaign’s house rule: a session’s end removes strife as a scene’s end does. Tick anyone who carries their full total instead.' : 'Once-per-session uses return. The book sets no strife rule for a session’s end.']),
      clears ? boxes.map((b) => el('label', { class: 'small' }, [b.box, ' carry ' + b.name + '’s strife'])) : null,
      button('End the session', () => { Sheet.endSession(party.map((m) => m.id), boxes.filter((b) => b.box.checked).map((b) => b.id)); sessionAsk = false; Bus.emit('state:remote', { view: true }, { local: true }); }, 'tiny'),
    ])]);
  }
  function renderParty(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const party = S().party || [];
      container.appendChild(el('div', { class: 'chiprow' }, [characterLoader('Load character file(s)…', ''), pregenPicker()]));
      if (!party.length) container.appendChild(el('div', { class: 'empty' }, ['No one in the party yet.']));
      else {
        container.appendChild(boundaries(party));
        // a conflict is the GM's to start and end, for the whole party: each player's sheet opens its Conflict tab
        const inIt = party.filter((m) => Sheet.conflictOf(m));
        const start = el('select', { class: 'scope tiny', 'aria-label': 'Start a conflict for the party' }, [el('option', { value: '' }, [inIt.length ? 'Change the conflict…' : 'Start a conflict…'])].concat(Sheet.conflictTypes().map((e) => el('option', { value: e.name }, [e.name]))));
        start.addEventListener('change', () => { if (start.value) party.forEach((m) => Sheet.setConflict(m, { type: start.value, initiative: null, engaged: [] }, 'Enters a conflict: ' + start.value)); });
        container.appendChild(el('div', { class: 'chiprow tight party-conflict' }, [el('span', { class: 'prop-k' }, ['Conflict']), inIt.length ? el('b', {}, [Sheet.conflictOf(inIt[0]).type]) : null, start,
          inIt.length ? button('End the conflict', () => inIt.forEach((m) => Sheet.setConflict(m, null, 'The ' + Sheet.conflictOf(m).type.toLowerCase() + ' ends')), 'ghost tiny') : null]));
      }
      party.forEach((m) => container.appendChild(el('div', { class: 'member' }, [
        el('button', { class: 'card', type: 'button', onclick: () => Panels.select({ kind: 'party', id: m.id }) }, [
          el('div', { class: 'card-name' }, [m.name]),
          el('div', { class: 'card-meta muted small' }, [Sys().memberSubtitle(m)]),
          el('div', { class: 'card-text' }, [Sheet.tokenText(m)]),
        ]),
        el('div', { class: 'member-ops' }, [
          button('file', () => Sys().downloadCharacter(m), 'ghost tiny'),
          button('remove', () => { if (confirm('Remove ' + m.name + ' from the party?')) State.commit('removePartyMember', [m.id]); }, 'ghost tiny'),
        ]),
      ])));
      // the GM's own notes on the characters (system/l5r5e/gm-text.js), about them by name
      const G = window.L5RGmText;
      if (G) {
        container.appendChild(el('h4', { 'data-gm-id': 'pc' }, ['Behind the characters', el('span', { class: 'muted small' }, [' · never sent to players'])]));
        G.sections(container, G.list('pc'), { redraw: draw, save: (l) => G.setList('pc', l), addLabel: 'Add a note on a character…' });
        G.reveal(container);
      }
    };
    ctx.on('state:changed', () => { if (!editing(container)) draw(); });
    ctx.on('state:remote', () => { if (!editing(container)) draw(); });
    ctx.on('gm:reveal', draw);
    draw();
  }

  // ── Inspector ──────────────────────────────────────────────────────
  // an NPC or a pregen gets a roller preset from its own Rings, and its skill ranks as buttons
  const npcRollers = {};
  function npcRoller(e) {
    if (npcRollers[e.id]) return npcRollers[e.id];
    const rings = D.defFields(D.prop(e, 'Rings')).fields;
    const r = Dice.roller({
      preset: { ring: 'Air', ringValue: rings.Air || 1, skillRank: 0 },
      ringsOf: (ring) => rings[ring] || 1,
      onResolve: (roll) => State.commit('appendLog', [Dice.logEntry(roll, 'GM · ' + e.name)]),
    });
    npcRollers[e.id] = r;
    return r;
  }
  function renderInspector(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const sel = Panels.selection();
      if (!sel) return container.appendChild(el('div', { class: 'empty' }, ['Nothing selected. Click a name anywhere — a scene’s cast, a technique, a rule.']));
      if (sel.kind === 'entity') {
        const e = D.entity(sel.id);
        if (!e) return container.appendChild(el('div', { class: 'empty' }, ['Not loaded: ' + sel.id]));
        const cur = Sys().currentSceneId();
        const sc = Sys().scene(cur);
        const rings = D.prop(e, 'Rings');
        container.appendChild(el('div', { class: 'chiprow tight' }, [
          sc && (e.type === 'NPC' || e.type === 'Samurai') ? button('Put in ' + sc.name, () => State.commit('setSceneCast', [cur, Sys().castIds(cur).filter((x) => x !== e.id).concat([e.id])]), 'tiny') : null,
          el('a', { class: 'btn ghost tiny', href: './#book/' + encodeURIComponent(e.book) + '/' + encodeURIComponent(e.id), target: '_blank' }, ['In the reader']),
          // the wiki, for inspiration (system/l5r5e/lore.js), when the GM has a lore server
          window.L5RLore && window.L5RLore.configured() ? button('Find in lore', () => window.L5RLore.find(e.name), 'ghost tiny') : null,
        ]));
        // an actor's skills roll from its sheet below; the bare roller is for anything else with rings
        if (rings && rings.vk === 'def' && (rings.fields || []).some((f) => f.value !== undefined) && !(window.L5RActor && window.L5RActor.isActor(e))) {
          const r = npcRoller(e);
          const skills = [].concat(D.val(e, 'Skills') || []);
          container.appendChild(el('div', { class: 'inspector-roll' }, [
            el('div', { class: 'chiprow tight' }, skills.map((s) => {
              const m = /^(.*\S)\s+(\d+)$/.exec(String(s));
              return m ? button(s, () => r.set({ skill: m[1], skillRank: parseInt(m[2], 10) }), 'ghost tiny') : null;
            })),
            r,
          ]));
        }
        if (e.type === 'NPC' || D.applies(e, 'NPC') || rings) container.appendChild(Sheet.npcConditionsBlock(e));
        const mine = window.L5RGmText && window.L5RGmText.aboutSections('people', e.id, draw);
        if (mine) container.appendChild(mine);
        // an actor reads as its sheet (system/l5r5e/actor.js), its skills rolling through the
        // roller that logs to the table; anything else as the book prints it
        const A = window.L5RActor;
        if (A && A.isActor(e) && rings) container.appendChild(A.sheet(e, { roller: npcRoller(e) }));
        else container.appendChild(el('div', { class: 'paper' }, [E.render(e)]));
      } else if (sel.kind === 'party') {
        const m = (S().party || []).find((x) => x.id === sel.id);
        if (!m) return container.appendChild(el('div', { class: 'empty' }, ['That character is no longer in the party.']));
        container.appendChild(Sys().liveSheet(m));
        container.appendChild(el('div', { class: 'prop-k' }, ['GM notes', el('span', { class: 'muted' }, [' · never sent to players'])]));
        container.appendChild(el('textarea', { class: 'text', rows: 3, oninput: debounce((ev) => State.commit('setPartyNotes', [m.id, ev.target.value]), 400) }, [m.notes || '']));
        const mine = window.L5RGmText && window.L5RGmText.aboutSections('pc', m.name, draw);
        if (mine) container.appendChild(mine);
      } else container.appendChild(el('div', { class: 'empty' }, ['Nothing to show for ' + sel.kind + '.']));
    };
    ctx.on('select', draw);
    ctx.on('state:changed', () => { const sel = Panels.selection(); if (sel && sel.kind === 'party' && !editing(container)) draw(); });
    ctx.on('state:remote', draw);
    draw();
  }

  // ── Cast: the adventure's named NPCs, and every NPC in the books ───
  function renderCast(container, ctx) {
    let q = '';
    const G = window.L5RGmText;
    const draw = () => {
      container.innerHTML = '';
      // the GM's own notes on the people of the campaign (system/l5r5e/gm-text.js)
      if (G && (G.list('people').length || (window.VttConfig || {}).ownAdventure)) {
        container.appendChild(el('h4', { 'data-gm-id': 'people' }, ['The campaign’s people', el('span', { class: 'muted small' }, [' · the GM’s notes'])]));
        G.sections(container, G.list('people'), { redraw: draw, save: (l) => G.setList('people', l), addLabel: 'Add a note on someone…' });
      }
      const cur = Sys().currentSceneId();
      const sc = Sys().scene(cur);
      const put = (id) => State.commit('setSceneCast', [cur, Sys().castIds(cur).filter((x) => x !== id).concat([id])]);
      const row = (r) => el('li', {}, [
        el('button', { class: 'ref', type: 'button', onclick: () => window.L5ROpenEntity(r.id) }, [r.name]),
        el('span', { class: 'muted small' }, [' · ' + [((r.fields || {}).Type) || D.text(r, 'Type'), D.label(r.book)].filter(Boolean).join(' · ')]),
        sc ? el('button', { class: 'ref tiny', type: 'button', title: 'put in ' + sc.name, onclick: () => put(r.id) }, ['+']) : null,
      ]);
      const named = Sys().namedCast();
      if (named.length) {
        container.appendChild(el('h4', {}, [Sys().module() && Sys().module().own ? 'The campaign’s cast' : 'The adventure’s cast']));
        container.appendChild(el('ul', { class: 'items toc' }, named.map(row)));
      }
      const search = el('input', { type: 'search', class: 'search', placeholder: 'Find an NPC in any book…', value: q });
      search.addEventListener('input', debounce(() => { q = search.value.trim().toLowerCase(); drawList(); }, 150));
      const list = el('div');
      const drawList = () => {
        list.innerHTML = '';
        const all = D.npcs().filter((r) => !q || (r.name + ' ' + ((r.fields || {}).Category || '')).toLowerCase().indexOf(q) !== -1);
        list.appendChild(el('div', { class: 'muted small' }, [all.length + ' NPCs' + (sc ? ' · + puts one in ' + sc.name : '')]));
        list.appendChild(el('ul', { class: 'items toc' }, all.slice(0, 150).map(row)));
      };
      container.appendChild(el('h4', {}, ['Every NPC']));
      container.appendChild(search);
      container.appendChild(list);
      drawList();
    };
    ctx.on('scene:changed', draw);
    ctx.on('state:remote', () => { if (!editing(container)) draw(); });
    ctx.on('state:changed', () => { if (!editing(container)) draw(); });
    ctx.on('gm:reveal', () => { draw(); G && G.reveal(container); });
    draw();
  }

  // ── Dice ───────────────────────────────────────────────────────────
  let gmRoller = null;
  function renderDice(container, ctx) {
    container.innerHTML = '';
    if (!gmRoller) gmRoller = Dice.roller({ onResolve: (r) => State.commit('appendLog', [Dice.logEntry(r, 'GM')]) });
    container.appendChild(gmRoller);
    container.appendChild(el('div', { class: 'muted small' }, ['The GM’s own check; a character’s is on their sheet, an NPC’s in the Inspector.']));
    const d = Dice.difficulty();
    container.appendChild(el('h4', {}, ['Target numbers']));
    container.appendChild(el('div', {}, d.map((x) => el('div', { class: 'numrow' }, [el('span', { class: 'n' }, [String(x.tn)]), E.span(x.text, 'core')]))));
  }

  // ── Rules & Book ───────────────────────────────────────────────────
  function renderRules(container, ctx) {
    container.innerHTML = '';
    // the campaign's own rulings (system/l5r5e/gm-text.js), and its house-rules book when it has one
    const G = window.L5RGmText;
    const mine = el('div', { class: 'rules-mine' });
    const drawMine = () => {
      mine.innerHTML = '';
      const houseBooks = D.books().filter((b) => b.kind === 'campaign');
      const items = G ? G.list('rules') : [];
      if (!items.length && !houseBooks.length && !(window.VttConfig || {}).ownAdventure) return;
      mine.appendChild(el('h4', { 'data-gm-id': 'rules' }, ['This campaign', el('span', { class: 'muted small' }, [' · rulings and practice at this table'])]));
      // the layer's rules chapters (its house rules: MODIFY blocks and their GUIDANCE), drawn here as
      // the reader draws a chapter — the site's book tabs may be off
      // each MODIFY's GUIDANCE entries, verbatim, under the rule it changes
      // (one ruling attached to several rules is listed once, under all their names)
      const rulings = (bid, blocks) => {
        const byText = new Map();
        blocks.filter((x) => x.kw === 'MODIFY').forEach((m) => {
          const target = ((m.args || []).find((a) => a.c) || {}).c || '';
          const walk = (list) => (list || []).forEach((x) => {
            if (x.kw === 'TEXT') (x.args || []).forEach((a) => { if (a.s) byText.set(a.s, (byText.get(a.s) || []).concat([target])); });
            walk(x.body);
          });
          walk((m.body || []).filter((x) => x.kw === 'GUIDANCE'));
        });
        return Array.from(byText).map(([t, targets]) => el('div', { class: 'house-rule' }, [el('b', {}, [targets.join(' · ')]), ' — ', E.span(t, bid)]));
      };
      houseBooks.forEach((b) => D.chapters(b.id).filter((c) => c.kind !== 'lore' && (c.blocks || []).some((x) => x.kw === 'MODIFY')).forEach((c) => {
        const items = rulings(b.id, c.blocks);
        if (!items.length) return;
        mine.appendChild(el('details', { class: 'gm-sub house-rules', 'data-gm-id': 'house-' + c.file }, [
          el('summary', {}, [D.chapterTitle(c).replace(/^.*? — /, '').replace(/^./, (x) => x.toUpperCase())]),
          el('div', { class: 'gm-text' }, items),
        ]));
      }));
      if (G) G.sections(mine, items, { redraw: drawMine, save: (l) => G.setList('rules', l), addLabel: 'Add a ruling…' });
      if (G) G.reveal(mine);
    };
    drawMine();
    container.appendChild(mine);
    ctx.on('state:changed', () => { if (!editing(mine)) drawMine(); });
    ctx.on('gm:reveal', drawMine);
    const input = el('input', { type: 'search', class: 'search', placeholder: 'Search the books… ( / )', autocomplete: 'off' });
    const scope = el('select', { class: 'scope' }, [el('option', { value: 'core' }, ['Core Rulebook'])].concat(D.books().filter((b) => b.id !== 'core').map((b) => el('option', { value: b.id }, [b.label]))).concat([el('option', { value: '*' }, ['Every book'])]));
    const results = el('div', { class: 'results' });
    const run = debounce(() => {
      results.innerHTML = '';
      const q = input.value.trim();
      if (q.length < 2) return;
      const ids = scope.value === '*' ? D.books().map((b) => b.id) : [scope.value];
      results.appendChild(el('div', { class: 'muted loading' }, ['Searching…']));
      D.ensure(ids).then(() => {
        results.innerHTML = '';
        const hits = D.search(q, ids, 120);
        if (!hits.length) return results.appendChild(el('div', { class: 'empty' }, ['Nothing matches.']));
        results.appendChild(el('div', { class: 'muted small' }, [hits.length + (hits.length === 1 ? ' result' : ' results')]));
        hits.forEach((e) => results.appendChild(el('div', { class: 'hit' }, [
          el('button', { class: 'ref', type: 'button', onclick: () => Panels.select({ kind: 'entity', id: e.id }) }, [e.name]),
          e.type ? el('span', { class: 'etype' }, [e.type]) : null,
          el('span', { class: 'muted small' }, [' · ' + D.label(e.book)]),
          (() => { const ex = D.excerpt(e, q, 60); return ex ? el('div', { class: 'muted small' }, [ex]) : null; })(),
        ])));
      });
    }, 200);
    input.addEventListener('input', run);
    scope.addEventListener('change', run);
    container.appendChild(el('div', { class: 'search-row' }, [input, scope]));
    container.appendChild(results);
    container.focusSearch = () => input.focus();
  }

  // ── Log ────────────────────────────────────────────────────────────
  function renderLog(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const log = (S().log || []).slice().reverse();
      if (!log.length) return container.appendChild(el('div', { class: 'empty' }, ['Nothing logged yet.']));
      log.forEach((x) => container.appendChild(Dice.logLine(x)));
    };
    ctx.on('state:changed', draw);
    ctx.on('state:remote', draw);
    draw();
  }

  // ── Campaign ───────────────────────────────────────────────────────
  function renderCampaign(container, ctx) {
    const draw = () => {
      container.innerHTML = '';
      const c = S().campaign;
      container.appendChild(el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, ['Campaign']), el('div', { class: 'prop-v' }, [el('input', { type: 'text', value: c.name || '', class: 'text', onchange: (ev) => State.commit('setCampaign', [{ name: ev.target.value }]) })])]));
      const m = mid() && D.moduleList().find((x) => x.id === mid());
      container.appendChild(el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, ['Adventure']), el('div', { class: 'prop-v' }, [m ? m.name : '—'])]));
      const party = S().party || [];
      container.appendChild(el('h4', {}, ['The party', el('span', { class: 'muted small' }, [' · saved in the pack'])]));
      container.appendChild(party.length ? el('ul', { class: 'items' }, party.map((p) => el('li', {}, [
        el('button', { class: 'ref', type: 'button', onclick: () => Panels.select({ kind: 'party', id: p.id }) }, [p.name]),
        el('span', { class: 'muted small' }, [' · ' + Sys().memberSubtitle(p)]),
      ]))) : el('div', { class: 'empty' }, ['No one yet.']));
      const list = State.listCampaigns();
      container.appendChild(el('h4', {}, ['Campaigns in this browser']));
      container.appendChild(el('ul', { class: 'items' }, list.map((row) => el('li', {}, [
        row.id === State.id ? el('b', {}, [row.name || row.id]) : el('button', { class: 'ref', type: 'button', onclick: () => { State.switchTo(row.id); location.reload(); } }, [row.name || row.id]),
        row.id !== State.id ? button('remove', () => { if (confirm('Remove "' + row.name + '" from this browser? Save its pack first if you want it back.')) { State.remove(row.id); draw(); } }, 'ghost tiny') : null,
      ]))));
      const file = el('input', { type: 'file', accept: 'application/json', hidden: true, onchange: (ev) => {
        const f = ev.target.files[0];
        if (!f) return;
        f.text().then((txt) => { try { State.importPack(JSON.parse(txt)); location.reload(); } catch (e) { alert(e.message); } });
      } });
      container.appendChild(el('div', { class: 'chiprow' }, [
        button('New campaign', () => { const n = prompt('Campaign name'); if (n) { State.create(n, { campaign: { modules: [], books: [] } }); location.reload(); } }),
        button('Save pack (download)', () => State.downloadPack()),
        button('Restore pack…', () => file.click(), 'ghost'),
        file,
      ]));
      container.appendChild(el('p', { class: 'muted small' }, ['A pack is the campaign as an instance: the party, the scenes, every note and roll, as JSON. Keep packs with the campaign; this browser is a cache.']));
    };
    ctx.on('state:changed', () => { if (!editing(container)) draw(); });
    draw();
  }

  Panels.register('adventure', { label: 'Adventure', render: renderAdventure });
  Panels.register('party', { label: 'Party', render: renderParty });
  Panels.register('inspector', { label: 'Inspector', render: renderInspector });
  Panels.register('cast', { label: 'Cast', render: renderCast });
  Panels.register('dice', { label: 'Dice', render: renderDice });
  Panels.register('rules', { label: 'Rules & Book', render: renderRules });
  Panels.register('log', { label: 'Log', render: renderLog });
  Panels.register('campaign', { label: 'Campaign', render: renderCampaign });

  // the core (the Samurai type, the dice) and the adventure in play load with the page
  D.ensure(['core'].concat(((S().campaign || {}).modules || []).map((m) => (D.moduleList().find((x) => x.id === m) || {}).book))).then(() => Bus.emit('state:remote', { loaded: true }, { local: true }));
  window.L5RPanels = { goTo, characterLoader };
})();
