// system/l5r5e/site.js — what Legend of the Five Rings puts on the site: the books, and the
// game's own lists across them — schools by clan, techniques by category and rank, NPCs,
// the pregenerated characters, the adventures, the lore graph — the dice, and search. Every
// word shown comes from titterpig-dsl-l5r5e/0.5 through data/; this file decides only what is
// listed where. A list reads data/records.js; opening anything loads its book on demand.
window.VttSiteTabs = (function () {
  const { el, debounce, button } = window.VttRender;
  const D = window.L5RData;
  const E = window.L5REntity;
  const Dice = window.L5RDice;
  const Site = () => window.VttSite;

  // a link inside any rendered entity opens it in the reader, loading its book first
  window.L5ROpenEntity = (id) => {
    const e = D.entity(id);
    const r = e || D.records().find((x) => x.id === id);
    if (r) Site().go('book', [r.book, id]);
  };

  const page = (container) => {
    const p = el('div', { class: 'page' });
    container.appendChild(p);
    return p;
  };
  const loading = (p, what) => p.appendChild(el('div', { class: 'muted loading' }, ['Opening ' + what + '…']));
  function after(p, ids, fn) {
    const note = loading(p, Array.isArray(ids) ? ids.map(D.label).join(', ') : D.label(ids));
    D.ensure(ids).then(() => { note.remove(); fn(); }).catch((e) => {
      console.error(e);
      p.appendChild(el('div', { class: 'empty' }, ['Could not show this: ' + e.message]));
    });
  }
  // `campaign` is an instance's own layer (build/build_layer.py) — its homebrew, shelved first.
  const KIND_ORDER = { campaign: -1, book: 0, errata: 1, adventure: 2, codex: 3 };
  const KIND_LABEL = { campaign: 'This campaign', book: 'Rules and setting', errata: 'Errata', adventure: 'Adventures', codex: 'The lore graph' };
  const mon = (clan) => {
    const c = String(clan || '').toLowerCase().replace(/ clan$/, '');
    return ['crab', 'crane', 'dragon', 'lion', 'phoenix', 'scorpion', 'unicorn', 'imperial'].indexOf(c) !== -1
      ? el('img', { class: 'mon', src: 'assets/art/mon/' + c + '.svg', alt: '' }) : el('span', { class: 'mon blank' });
  };

  // ── the books ──────────────────────────────────────────────────────
  function renderShelf(container, ctx) {
    const p = page(container);
    const idx = D.index();
    p.appendChild(el('div', { class: 'masthead' }, [
      el('h1', {}, ['The books']),
      el('p', { class: 'muted' }, [String(idx.counts.books) + ' books, generated from their corpus: ' + idx.counts.entities.toLocaleString() + ' entries out of ' + idx.counts.files + ' files. Open one.']),
    ]));
    const groups = {};
    D.books().forEach((b) => (groups[b.kind] = groups[b.kind] || []).push(b));
    Object.keys(groups).sort((a, b) => KIND_ORDER[a] - KIND_ORDER[b]).forEach((k) => {
      p.appendChild(el('h2', { class: 'shelf-h' }, [KIND_LABEL[k] || k]));
      p.appendChild(el('div', { class: 'shelf' }, groups[k].map((b) => el('a', { class: 'shelf-book', href: ctx.href('book', [b.id]) }, [
        el('div', { class: 'shelf-title' }, [b.label]),
        el('div', { class: 'muted small' }, [b.counts.chapters + ' chapters · ' + b.counts.entities.toLocaleString() + ' entries · ' + Math.round(b.bytes / 1024) + ' KB']),
      ]))));
    });
  }

  function chapterLink(bid, c, ctx, active) {
    return el('a', { class: 'ref' + (active ? ' active' : ''), href: ctx.href('book', [bid, 'ch:' + c.file]) }, [D.shortTitle(c), el('span', { class: 'kindtag' }, [c.kind])]);
  }
  function tree(bid, list, ctx, openId) {
    return el('ul', { class: 'toc' }, list.map((e) => {
      const kids = D.children(e.id);
      const a = el('a', { class: 'ref' + (e.id === openId ? ' active' : ''), href: ctx.href('book', [bid, e.id]) }, [e.name]);
      if (!kids.length) return el('li', {}, [a]);
      const open = openId && (e.id === openId || D.ancestors(openId).some((x) => x.id === e.id));
      return el('li', {}, [el('details', { open: open || null }, [el('summary', {}, [a]), tree(bid, kids, ctx, openId)])]);
    }));
  }

  function renderBook(container, path, ctx) {
    const bid = path[0] && D.indexBook(path[0]) ? path[0] : null;
    if (!bid) return renderShelf(container, ctx);
    const p = page(container);
    const meta = D.indexBook(bid);
    // an actor's sheet needs the core (the skill groups, the derived formulas)
    after(p, bid === 'core' ? bid : [bid, 'core'], () => {
      const target = path[1] || null;
      const chFile = target && target.indexOf('ch:') === 0 ? target.slice(3) : null;
      const e = target && !chFile ? D.entity(target) : null;
      const openCh = chFile || (e ? e.file : null);
      p.appendChild(el('div', { class: 'crumbs' }, [el('a', { href: ctx.href('book', []) }, ['The books']), ' › ', el('a', { href: ctx.href('book', [bid]) }, [meta.label]),
        e ? D.ancestors(e.id).map((a) => [' › ', el('a', { href: ctx.href('book', [bid, a.id]) }, [a.name])]) : null]));
      // the outline: chapters in order, each opening on its entities
      const q = el('input', { type: 'search', class: 'search', placeholder: 'Search ' + meta.label + '…' });
      const results = el('div', { class: 'results' });
      q.addEventListener('input', debounce(() => showHits(results, q.value.trim(), [bid], ctx), 250));
      const toc = el('div', { class: 'site-toc' }, [q, results, el('ul', { class: 'toc chapters' }, D.chapters(bid).map((c) => {
        const roots = (c.roots || []).map(D.entity).filter(Boolean);
        const here = c.file === openCh;
        return el('li', {}, [roots.length
          ? el('details', { open: here || null }, [el('summary', {}, [chapterLink(bid, c, ctx, chFile === c.file)]), tree(bid, roots, ctx, e ? e.id : null)])
          : chapterLink(bid, c, ctx, chFile === c.file)]);
      }))]);
      let body;
      if (e) body = A() && A().isActor(e) ? actorPage(e) : E.render(e);
      else if (chFile) body = chapterPage(bid, D.chapter(bid, chFile), ctx);
      else body = bookFront(bid, meta, ctx);
      p.appendChild(el('div', { class: 'reader' }, [toc, el('div', { class: 'site-reader' }, [body])]));
    });
  }

  function bookFront(bid, meta, ctx) {
    const mods = D.moduleList().filter((m) => m.book === bid);
    return el('div', {}, [
      el('h2', {}, [meta.label]),
      mods.length ? el('p', {}, ['The adventure: ', mods.map((m, i) => [i ? ', ' : null, el('a', { class: 'ref', href: ctx.href('adventures', [m.id]) }, [m.name])])]) : null,
      el('h4', {}, ['Chapters']),
      el('ul', { class: 'items' }, D.chapters(bid).map((c) => el('li', {}, [chapterLink(bid, c, ctx), c.page ? el('span', { class: 'muted small' }, [' · from page ' + c.page]) : null]))),
    ]);
  }

  // A chapter: a lore file as its Markdown; a DSL file as its own top-level blocks (an arc's
  // parts, a frame's seeds, the errata) and its entities in order.
  function chapterPage(bid, c, ctx) {
    if (!c) return el('div', { class: 'empty' }, ['No such chapter.']);
    if (c.kind === 'lore') return el('div', {}, [E.markdown(c.text, bid)]);
    const loose = D.guidanceLoose(c.file);
    const top = (c.blocks || []).filter((b) => !('ent' in b));
    return el('div', {}, [
      el('h2', {}, [D.chapterTitle(c)]),
      el('div', { class: 'muted small' }, [c.file + (c.page ? ' · from page ' + c.page : '')]),
      c.kind === 'arc' ? el('p', {}, [el('a', { class: 'btn ghost', href: ctx.href('adventures', [D.moduleId(c.file)]) }, ['Open it as an adventure →'])]) : null,
      top.length ? E.nodes(top, bid) : null,
      E.guidance(loose, bid),
      (c.roots || []).map(D.entity).filter(Boolean).length ? el('div', { class: 'contents' }, [
        el('h4', {}, ['In this chapter']),
        el('ul', { class: 'items' }, (c.roots || []).map(D.entity).filter(Boolean).map((x) => el('li', {}, [el('a', { class: 'ref', href: ctx.href('book', [bid, x.id]) }, [x.name]), x.type ? el('span', { class: 'etype' }, [x.type]) : null]))),
      ]) : null,
    ]);
  }

  function showHits(results, term, bookIds, ctx) {
    results.innerHTML = '';
    if (term.length < 2) return;
    const hits = D.search(term, bookIds, 2000);
    const shown = hits.slice(0, 80);
    results.appendChild(el('div', { class: 'muted small' }, [hits.length + ' hits' + (hits.length > shown.length ? ' — the first ' + shown.length : '')]));
    shown.forEach((h) => {
      const ex = D.excerpt(h, term, 60);
      results.appendChild(el('div', { class: 'hit' }, [
        el('a', { class: 'ref', href: ctx.href('book', [h.book, h.id]) }, [h.name]),
        h.type ? el('span', { class: 'etype' }, [h.type]) : null,
        el('span', { class: 'muted small' }, [' · ' + D.label(h.book)]),
        ex ? el('div', { class: 'muted small' }, [ex]) : null,
      ]));
    });
  }

  // ── a filterable list over records ─────────────────────────────────
  function recordList(p, rows, opts) {
    const state = opts.state;
    const q = el('input', { type: 'search', class: 'search', placeholder: opts.placeholder, value: state.q || '' });
    const filters = (opts.filters || []).map((f) => {
      const sel = el('select', { class: 'scope' });
      sel.appendChild(el('option', { value: '' }, [f.all]));
      f.values(rows).forEach((v) => sel.appendChild(el('option', { value: v, selected: state[f.key] === v || null }, [f.label ? f.label(v) : String(v)])));
      sel.addEventListener('change', () => { state[f.key] = sel.value; draw(); });
      return sel;
    });
    const count = el('span', { class: 'muted small' });
    const out = el('div', {});
    function draw() {
      const t = (state.q || '').toLowerCase();
      const hit = rows.filter((r) => (!t || opts.text(r).toLowerCase().indexOf(t) !== -1) && (opts.filters || []).every((f) => !state[f.key] || String(f.get(r)) === state[f.key]));
      count.textContent = hit.length + ' of ' + rows.length;
      out.innerHTML = '';
      out.appendChild(opts.draw(hit));
    }
    q.addEventListener('input', debounce(() => { state.q = q.value.trim(); draw(); }, 150));
    p.appendChild(el('div', { class: 'chiprow filters' }, [q].concat(filters, [count])));
    p.appendChild(out);
    draw();
  }
  const uniq = (xs) => Array.from(new Set(xs.filter((x) => x != null && x !== ''))).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  const openRow = (r) => el('a', { class: 'ref', href: '#book/' + encodeURIComponent(r.book) + '/' + encodeURIComponent(r.id) }, [r.name]);

  // ── schools ────────────────────────────────────────────────────────
  const schoolState = { q: '' };
  function renderSchools(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['Schools']));
    // a school with no Clan is grouped by who the corpus says it is for (APPLIES TO), when
    // that is not simply Samurai — Path of Waves' rōnin, peasant and gaijin schools
    const who = (r) => ((r.applies || []).filter((a) => a !== 'Samurai').join(', ') || 'No clan');
    const rows = D.schools().map((r) => Object.assign({ clan: (r.fields || {}).Clan || who(r), roles: [].concat((r.fields || {}).Roles || []) }, r));
    recordList(p, rows, {
      state: schoolState, placeholder: 'Find a school…',
      text: (r) => r.name + ' ' + r.clan + ' ' + r.roles.join(' '),
      filters: [
        { key: 'clan', all: 'Every clan', values: (rs) => uniq(rs.map((r) => r.clan)), get: (r) => r.clan },
        { key: 'role', all: 'Every role', values: (rs) => uniq([].concat.apply([], rs.map((r) => r.roles))), get: (r) => r.roles.indexOf(schoolState.role) !== -1 ? schoolState.role : '' },
        { key: 'book', all: 'Every book', values: (rs) => uniq(rs.map((r) => r.book)), label: D.label, get: (r) => r.book },
      ],
      draw: (hit) => {
        const byClan = {};
        hit.forEach((r) => (byClan[r.clan] = byClan[r.clan] || []).push(r));
        return el('div', { class: 'clan-groups' }, Object.keys(byClan).sort().map((c) => el('section', { class: 'clan-group' }, [
          el('h3', {}, [mon(c), c]),
          el('ul', { class: 'items' }, byClan[c].map((r) => el('li', {}, [openRow(r), el('span', { class: 'muted small' }, [' · ' + r.roles.join(', ') + ' · ' + D.label(r.book)])]))),
        ])));
      },
    });
  }

  // ── techniques ─────────────────────────────────────────────────────
  const techState = { q: '' };
  function renderTechniques(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['Techniques']));
    const rows = D.techniques();
    recordList(p, rows, {
      state: techState, placeholder: 'Find a technique…',
      text: (r) => r.name + ' ' + (r.category || ''),
      filters: [
        { key: 'category', all: 'Every category', values: (rs) => uniq(rs.map((r) => r.category)), get: (r) => r.category },
        { key: 'rank', all: 'Every rank', values: (rs) => uniq(rs.map((r) => r.rank)), label: (v) => 'Rank ' + v, get: (r) => r.rank },
        { key: 'book', all: 'Every book', values: (rs) => uniq(rs.map((r) => r.book)), label: D.label, get: (r) => r.book },
      ],
      draw: (hit) => el('table', { class: 'printed list' }, [
        el('thead', {}, [el('tr', {}, [el('th', {}, ['Technique']), el('th', {}, ['Category']), el('th', {}, ['Rank']), el('th', {}, ['Book'])])]),
        el('tbody', {}, hit.sort((a, b) => (a.rank || 0) - (b.rank || 0) || a.name.localeCompare(b.name)).map((r) => el('tr', {}, [
          el('td', {}, [openRow(r)]), el('td', {}, [r.category || '']), el('td', {}, [r.rank == null ? '' : String(r.rank)]), el('td', { class: 'muted small' }, [D.label(r.book)]),
        ]))),
      ]),
    });
  }

  // ── actors: the sheet (system/l5r5e/actor.js), and below it the record as the book prints it ──
  const A = () => window.L5RActor;
  function actorPage(e, actions) {
    return el('div', {}, [
      A().sheet(e, { actions: actions || [] }),
      el('details', { class: 'ac-record' }, [el('summary', { class: 'muted small' }, ['The record as the book prints it']), E.render(e)]),
    ]);
  }
  // a card from a record's indexed fields: the roster draws without loading every book
  function recordCard(r, href) {
    const f = r.fields || {};
    const n = A().splitName(r.name);
    return A().card({ ident: [], name: n.name, epithet: n.epithet, kind: f.Type || (r.type === 'Samurai' ? 'Samurai' : r.type || 'NPC'), book: r.book,
      ranks: { combat: f['Combat Conflict Rank'], intrigue: f['Intrigue Conflict Rank'] }, bio: [], description: null, portrait: typeof window.L5RActorPortrait === 'function' ? window.L5RActorPortrait(r.id, r.name) : null,
      cardLine: [f.School, f.Clan].filter(Boolean).join(' · ') || f.Category || null }, href);
  }

  // ── NPCs ───────────────────────────────────────────────────────────
  const npcState = { q: '' };
  function renderNpcs(container, path, ctx) {
    const p = page(container);
    const one = path[0] && D.npcs().find((r) => r.id === path[0]);
    if (one) {
      p.appendChild(el('div', { class: 'crumbs' }, [el('a', { href: ctx.href('npcs', []) }, ['Non-player characters']), ' › ', one.name]));
      after(p, one.book === 'core' ? one.book : [one.book, 'core'], () => p.appendChild(actorPage(D.entity(one.id), [el('a', { class: 'btn ghost tiny', href: '#book/' + encodeURIComponent(one.book) + '/' + encodeURIComponent(one.id) }, ['In the book'])])));
      return;
    }
    p.appendChild(el('h1', {}, ['Non-player characters']));
    const rows = D.npcs().map((r) => Object.assign({ t: (r.fields || {}).Type || '', cat: (r.fields || {}).Category || '' }, r));
    recordList(p, rows, {
      state: npcState, placeholder: 'Find an NPC…',
      text: (r) => r.name + ' ' + r.cat + ' ' + r.t,
      filters: [
        { key: 't', all: 'Adversaries and minions', values: (rs) => uniq(rs.map((r) => r.t)), get: (r) => r.t },
        { key: 'book', all: 'Every book', values: (rs) => uniq(rs.map((r) => r.book)), label: D.label, get: (r) => r.book },
      ],
      draw: (hit) => el('div', { class: 'ac-cards' }, hit.map((r) => recordCard(r, ctx.href('npcs', [r.id])))),
    });
  }

  // ── pregenerated characters ────────────────────────────────────────
  function renderPregens(container, path, ctx) {
    const p = page(container);
    const rows = D.pregens();
    const id = path[0] && rows.find((r) => r.id === path[0]) ? path[0] : null;
    if (id) {
      const r = rows.find((x) => x.id === id);
      p.appendChild(el('div', { class: 'crumbs' }, [el('a', { href: ctx.href('characters', []) }, ['Pregenerated characters']), ' › ', r.name]));
      // the core first: the Samurai declaration, the skill groups and the formulas live there
      after(p, r.book === 'core' ? r.book : [r.book, 'core'], () => {
        const e = D.entity(id);
        const S = window.L5RSheet;
        p.appendChild(actorPage(e, S ? [button('Download the character file', () => S.download(S.fromEntity(e)), 'ghost tiny')] : []));
      });
      return;
    }
    p.appendChild(el('h1', {}, ['Pregenerated characters']));
    p.appendChild(el('p', { class: 'muted' }, [rows.length + ' characters from the adventures that print them, each an instance of the corpus’s ', el('code', {}, ['Samurai']), ' type.']));
    const byBook = {};
    rows.forEach((r) => (byBook[r.book] = byBook[r.book] || []).push(r));
    const personas = D.records().filter((r) => r.type === 'Historical Persona');
    Object.keys(byBook).forEach((b) => {
      p.appendChild(el('h3', {}, [D.label(b)]));
      p.appendChild(el('div', { class: 'ac-cards' }, byBook[b].map((r) => recordCard(r, ctx.href('characters', [r.id])))));
    });
    // Blood of the Lioness prints its Advisors as personas a player's own samurai takes on
    // for the vision of Part Two — an overlay, not a character (its .actor file says so)
    if (personas.length) {
      p.appendChild(el('h3', {}, ['Historical personas', el('span', { class: 'muted small' }, [' · ' + D.label(personas[0].book) + ' — worn over a player’s own character'])]));
      p.appendChild(el('div', { class: 'shelf' }, personas.map((r) => el('a', { class: 'shelf-book', href: ctx.href('book', [r.book, r.id]) }, [el('div', { class: 'shelf-title' }, [r.name])]))));
    }
  }

  // ── the adventures ─────────────────────────────────────────────────
  function renderAdventures(container, path, ctx) {
    const p = page(container);
    const mods = D.moduleList();
    const ref = path[0] && mods.find((m) => m.id === path[0]);
    if (!ref) {
      p.appendChild(el('h1', {}, ['Adventures']));
      p.appendChild(el('p', { class: 'muted' }, [mods.length + ' adventures, each the corpus’s .arc over its lore and cast. The GM’s table runs them scene by scene.']));
      p.appendChild(el('div', { class: 'shelf' }, mods.map((m) => el('a', { class: 'shelf-book', href: ctx.href('adventures', [m.id]) }, [el('div', { class: 'shelf-title' }, [m.name]), el('div', { class: 'muted small' }, [D.label(m.book)])]))));
      return;
    }
    after(p, ['core', ref.book], () => {
      const m = D.module(ref.id);
      const sid = path[1] || null;
      p.appendChild(el('div', { class: 'crumbs' }, [el('a', { href: ctx.href('adventures', []) }, ['Adventures']), ' › ', el('a', { href: ctx.href('adventures', [m.id]) }, [m.name])]));
      const toc = el('div', { class: 'site-toc' }, [el('ul', { class: 'toc' }, m.phases.map((ph) => el('li', {}, [
        el('div', { class: 'toc-phase' }, [ph.name || 'Other scenes']),
        el('ul', { class: 'toc' }, ph.scenes.map((id) => {
          const s = m.scenes.find((x) => x.id === id);
          return el('li', {}, [el('a', { class: 'ref' + (sid === id ? ' active' : ''), href: ctx.href('adventures', [m.id, id]) }, [s.name])]);
        })),
      ])))]);
      const s = sid && m.scenes.find((x) => x.id === sid);
      p.appendChild(el('div', { class: 'reader' }, [toc, el('div', { class: 'site-reader' }, [s ? scenePage(m, s) : moduleFront(m, ctx)])]));
    });
  }
  // the adventure's overview: its own fields, the arc's other blocks, the lore in full
  function moduleFront(m, ctx) {
    const skip = new Set(['PARTS', 'FLOW', 'SCENE', 'DESCRIPTION', 'SUMMARY', 'THEMES', 'TONE', 'SETTING', 'PLAYER_COUNT', 'DEPENDS_ON', 'USES_EXTENSION', 'SYSTEM', 'SOURCE', 'LEAD_WRITER']);
    return el('div', {}, [
      el('h2', {}, [m.name]),
      E.prose(m.desc, 'prose', m.book),
      m.summary ? el('div', { class: 'kwpara' }, [el('div', { class: 'prop-k' }, ['Summary']), E.prose(m.summary, 'prose', m.book)]) : null,
      m.themes.length ? el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, ['Themes']), el('ul', { class: 'items' }, m.themes.map((t) => el('li', {}, [t])))]) : null,
      m.tone ? el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, ['Tone']), E.span(m.tone, m.book)]) : null,
      m.setting ? el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, ['Setting']), E.span(m.setting, m.book)]) : null,
      m.players ? el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, ['Players']), E.span(m.players, m.book)]) : null,
      E.nodes(m.blocks.filter((b) => !skip.has(b.kw)), m.book),
      m.lore ? el('details', { class: 'lore-full' }, [el('summary', {}, ['The adventure’s text — ', D.chapterTitle(m.lore)]), E.markdown(m.lore.text, m.book)]) : null,
    ]);
  }
  // a scene: its own block (SCENE) or its part's; and the lore section that tells it
  function sceneLore(m, s) {
    if (!m.lore) return null;
    const secs = D.loreSections(m.lore);
    const want = [s.name, s.part && s.part.name].filter(Boolean).map(D.slug);
    const hit = secs.find((x) => x.anchor && want.indexOf(x.anchor) !== -1)
      || secs.find((x) => x.anchor && want.some((w) => w && (x.anchor.indexOf(w) === 0 || w.indexOf(x.anchor) === 0)));
    if (!hit) return null;
    // the section and the sub-sections under it
    const i = secs.indexOf(hit);
    const out = [hit];
    for (let j = i + 1; j < secs.length && secs[j].level > hit.level; j++) out.push(secs[j]);
    return out.map((x) => (x.title ? '#'.repeat(x.level) + ' ' + x.title + '\n' : '') + x.lines.join('\n')).join('\n');
  }
  function scenePage(m, s) {
    const part = s.part;
    const lore = sceneLore(m, s);
    return el('div', {}, [
      el('h2', {}, [s.name]),
      part && !s.whole ? el('div', { class: 'muted small' }, [part.name]) : null,
      s.block ? E.nodes(s.block.body, m.book) : null,
      !s.block && part ? el('div', {}, [E.prose(part.desc, 'prose', m.book), E.nodes((part.block.body || []).filter((b) => b.kw !== 'DESCRIPTION' && b.kw !== 'SCENES'), m.book)]) : null,
      lore ? el('div', { class: 'scene-lore' }, [el('div', { class: 'prop-k' }, ['In the adventure’s text']), E.markdown(lore, m.book)]) : null,
    ]);
  }

  // ── the lore graph ─────────────────────────────────────────────────
  const loreState = { q: '' };
  function renderLore(container, path, ctx) {
    const p = page(container);
    if (path[0] && /\.lore$/.test(path[0])) {
      const bid = (D.books().find((b) => (b.chapters || []).some((c) => c.file === path[0])) || {}).id;
      if (!bid) return p.appendChild(el('div', { class: 'empty' }, ['No such lore file.']));
      after(p, bid, () => {
        const c = D.chapter(bid, path[0]);
        p.appendChild(el('div', { class: 'crumbs' }, [el('a', { href: ctx.href('lore', []) }, ['The lore']), ' › ', D.label(bid), ' › ', D.chapterTitle(c)]));
        p.appendChild(E.markdown(c.text, bid));
        if (path[1]) setTimeout(() => { const h = document.getElementById('lore-' + path[1]); if (h) h.scrollIntoView(); }, 0);
      });
      return;
    }
    p.appendChild(el('h1', {}, ['The lore']));
    p.appendChild(el('p', { class: 'muted' }, ['The lore graph: every person, place, faction and thing the books’ prose names, with the lore’s own words for how they are bound together.']));
    const rows = D.codexRecords().map((r) => Object.assign({ cat: (r.is || [])[0] || '' }, r));
    recordList(p, rows, {
      state: loreState, placeholder: 'Find a person, a place, a faction…',
      text: (r) => r.name + ' ' + r.cat,
      filters: [
        { key: 'cat', all: 'Every kind', values: (rs) => uniq(rs.map((r) => r.cat)), get: (r) => r.cat },
        { key: 'book', all: 'Every book', values: (rs) => uniq(rs.map((r) => r.book)), label: D.label, get: (r) => r.book },
      ],
      draw: (hit) => {
        const shown = hit.slice().sort((a, b) => a.name.localeCompare(b.name)).slice(0, 400);
        return el('div', {}, [
          el('ul', { class: 'items columns' }, shown.map((r) => el('li', {}, [openRow(r), el('span', { class: 'muted small' }, [' · ' + r.cat])]))),
          hit.length > shown.length ? el('div', { class: 'muted small' }, ['… and ' + (hit.length - shown.length) + ' more; narrow the search']) : null,
        ]);
      },
    });
    p.appendChild(el('h2', {}, ['The lore, as the books tell it']));
    D.books().forEach((b) => {
      const lores = (b.chapters || []).filter((c) => c.kind === 'lore');
      if (!lores.length) return;
      p.appendChild(el('div', { class: 'lore-shelf' }, [el('b', {}, [b.label]), ' ', lores.map((c, i) => [i ? ' · ' : null, el('a', { class: 'ref', href: ctx.href('lore', [c.file]) }, [D.chapterTitle(c)])])]));
    });
  }

  // ── the dice ───────────────────────────────────────────────────────
  function renderDice(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['Roll and keep']));
    after(p, 'core', () => {
      const log = el('div', { class: 'roll-log' });
      p.appendChild(Dice.roller({ onResolve: (r) => log.prepend(Dice.logLine(Dice.logEntry(r, 'You'))) }));
      p.appendChild(log);
      p.appendChild(el('p', { class: 'muted small' }, ['Click a die to keep it; a kept ❉ may roll its bonus die. The faces are the corpus’s own:']));
      const faces = Dice.faces();
      p.appendChild(el('div', { class: 'face-table' }, ['ring', 'skill'].map((t) => el('div', {}, [
        el('div', { class: 'prop-k' }, [t === 'ring' ? 'Ring die' : 'Skill die']),
        el('div', { class: 'faces' }, faces[t].map((f) => el('div', { class: 'face-cell' }, [Dice.faceImg(f), el('div', { class: 'small', html: Dice.symbolsHtml(E.inline(f.text)) })]))),
      ]))));
      const check = D.named('Check', 'core');
      const syms = D.named('Dice Symbols', 'core');
      const tn = D.named('Target Number', 'core');
      [check, syms, tn].filter(Boolean).forEach((e) => p.appendChild(E.render(e)));
    });
  }

  // ── search everywhere ──────────────────────────────────────────────
  const searchState = { q: '' };
  function renderSearch(container, path, ctx) {
    const p = page(container);
    p.appendChild(el('h1', {}, ['Search the books']));
    const results = el('div', { class: 'results' });
    const q = el('input', { type: 'search', class: 'search wide', placeholder: 'A rule, a technique, a name…', value: searchState.q });
    const scope = el('select', { class: 'scope' }, [el('option', { value: '' }, ['Every book'])].concat(D.books().map((b) => el('option', { value: b.id }, [b.label]))));
    const run = () => {
      const ids = scope.value ? [scope.value] : D.books().map((b) => b.id);
      results.innerHTML = '';
      if (searchState.q.length < 2) return;
      const note = el('div', { class: 'muted loading' }, [ids.length > 1 ? 'Opening every book (' + Math.round(D.books().reduce((a, b) => a + b.bytes, 0) / 1048576) + ' MB) to search them…' : '']);
      results.appendChild(note);
      D.ensure(ids).then(() => showHits(results, searchState.q, ids, ctx));
    };
    q.addEventListener('input', debounce(() => { searchState.q = q.value.trim(); run(); }, 300));
    scope.addEventListener('change', run);
    p.appendChild(el('div', { class: 'chiprow' }, [q, scope]));
    p.appendChild(results);
    if (searchState.q) run();
    setTimeout(() => q.focus(), 0);
  }

  const tabs = [
    { id: 'book', label: 'The books', render: renderBook, books: true },
    { id: 'schools', label: 'Schools', render: renderSchools },
    { id: 'techniques', label: 'Techniques', render: renderTechniques },
    { id: 'npcs', label: 'NPCs', render: renderNpcs },
    { id: 'characters', label: 'Characters', render: renderPregens },
    { id: 'adventures', label: 'Adventures', render: renderAdventures, books: true },
    { id: 'lore', label: 'Lore', render: renderLore, books: true },
    { id: 'dice', label: 'Dice', render: renderDice },
    { id: 'search', label: 'Search', render: renderSearch, books: true },
  ];
  // the creator adds its tab when it is loaded (system/l5r5e/creator.js)
  if (window.L5RCreator) tabs.splice(5, 0, { id: 'create', label: 'Make a character', render: window.L5RCreator.render });
  return tabs;
})();
