// system/l5r5e/actor.js — an actor's sheet, read-only: a book's NPC, a published pregen, a
// party member, a character file.
//
// The look and the behaviour are Portents & Fortunes' Dramatis Personae (the campaign's own page
// before it became an instance of this VTT; campaign/site/personae.js there carries it on):
//   a card for the roster — the emblem (or a portrait), the name, the epithet, the kind, the
//   opening line of the bio; and the sheet — a lacquered head with the name and epithet, two
//   tabs, Bio (who they are, in the book's words) and Play (the statblock: type and conflict
//   ranks, the five rings, Societal and Personal, demeanor and social TN, the skills, advantages
//   and disadvantages side by side, favored weapons and gear, the abilities with their text),
//   and a Roll & Keep section that opens on a skill's click.
// Not carried: Portents' discovery blur. A book's NPC is reference here, not a secret; an
// instance that wants discovery keeps its own page (Portents does).
//
// Every value is the record's own. A field the layout does not place is listed at the end of
// Bio as "Also printed", so nothing the book prints is dropped by a layout that did not expect it.
// An instance may give actors portraits: window.L5RActorPortrait = (id, name) => url | null.
window.L5RActor = (function () {
  const { el, button } = window.VttRender;
  const D = window.L5RData;
  const E = window.L5REntity;
  const Dice = window.L5RDice;
  const Sheet = () => window.L5RSheet;
  const RINGS = ['Air', 'Earth', 'Fire', 'Water', 'Void'];
  const GROUPS = ['Artisan', 'Martial', 'Scholar', 'Social', 'Trade'];
  const TAB = 'sortilege.l5r5e.actor.tab';
  const tabPref = () => { try { return localStorage.getItem(TAB) || 'play'; } catch (e) { return 'play'; } };
  const setTabPref = (t) => { try { localStorage.setItem(TAB, t); } catch (e) { /* private mode */ } };
  const plain = (s) => String(s == null ? '' : s).replace(/\^"([^"]*)"/g, '$1');
  const list = (x) => (Array.isArray(x) ? x : x == null || x === '' ? [] : [x]).filter((y) => y != null && y !== '');
  const isNum = (x) => typeof x === 'number' && !isNaN(x);

  // ── the record, read into one shape, whatever it came from ──
  // fields the sheet places itself; every other field goes to "Also printed"
  const PLACED = new Set(['Name', 'Type', 'Combat Conflict Rank', 'Intrigue Conflict Rank', 'Conflict Rank (Combat)', 'Conflict Rank (Intrigue)', 'Rings',
    'Skills', 'Honor', 'Glory', 'Status', 'Endurance', 'Composure', 'Focus', 'Vigilance', 'Silhouette', 'Void Points', 'Demeanor', 'Social Skill Check TN Modifiers',
    'Advantages', 'Disadvantages', 'Favored Weapons', 'Gear', 'Gear (Other)', 'Equipment', 'Weapons', 'Armor', 'Techniques', 'Description', 'Category',
    'Clan', 'Family', 'School', 'School Rank', 'Roles', 'Ninjō', 'Giri', 'Bushido', 'Past', 'Region', 'Upbringing', 'Personality', 'Pronouns', 'Relationships',
    'Titles', 'Bonds', 'Fatigue', 'Strife', 'Experience', 'Epithet', 'Biography', 'Affiliation', 'Campaign Status', 'School Ability', 'Heritage', 'Wealth', 'Stance']);
  const HEART = ['Ninjō', 'Giri', 'Past', 'Personality', 'Region', 'Upbringing', 'Pronouns', 'Heritage', 'School Ability', 'Wealth', 'Affiliation', 'Campaign Status'];

  // "Hida Kotoe, Stout Warrior" — the books print an NPC's epithet after the comma
  function splitName(name) {
    const m = /^([^,]+),\s*(.+)$/.exec(name || '');
    return m && m[1].length < 40 ? { name: m[1], epithet: m[2] } : { name: name || '', epithet: null };
  }
  function fromEntity(e) {
    const v = {};
    (e.props || []).forEach((p) => {
      if (p.vk === 'def') v[p.name] = D.defFields(p).fields;
      else v[p.name] = D.pval(p);
    });
    const kind = e.type === 'NPC' ? (v.Type || 'NPC') : e.type || 'Character';
    const n = splitName(e.name);
    // the book's prose about this one: its lore (RULES as prose) and its own description
    const bio = [].concat((e.rules || []).map((r) => E.ruleText(r.text)).filter(Boolean), e.desc ? [e.desc] : []);
    const abilities = D.children(e.id).map((k) => {
      const t = ['Effect', 'Description', 'Activation', 'Text'].map((nm) => D.text(k, nm)).filter(Boolean);
      return { id: k.id, name: k.name, text: t.join('\n\n'), entity: k, rich: !t.length };
    });
    // a samurai's Description is about them (an NPC's is about its kind, shown in Play)
    const own = kind === 'NPC' || e.type === 'NPC' ? [] : list(v.Description);
    return build(v, { id: e.id, book: e.book, kind, name: n.name, epithet: v.Epithet || n.epithet, full: e.name, bio: list(v.Biography).concat(own, bio), abilities, entity: e });
  }
  // a character's values (system/l5r5e/sheet.js: a file, a party member, the creator's sheet)
  function fromValues(vals, extra) {
    const v = Object.assign({}, vals || {});
    const src = v._source || {};
    const abilities = (v._abilities || []).map((a) => { const k = D.entity(a.id); return k ? { id: k.id, name: k.name, text: ['Effect', 'Description', 'Activation'].map((nm) => D.text(k, nm)).filter(Boolean).join('\n\n'), entity: k } : { name: a.name }; });
    return build(v, Object.assign({ id: src.id || null, book: src.book || 'core', kind: 'Samurai', name: v.Name || 'An unnamed samurai', epithet: null, full: v.Name, bio: list(v.Description), abilities }, extra || {}));
  }
  function build(v, base) {
    const num = (k) => (isNum(v[k]) ? v[k] : isNum(Number(v[k])) && v[k] !== '' && v[k] != null ? Number(v[k]) : null);
    const rings = {};
    RINGS.forEach((r) => (rings[r] = (v.Rings || {})[r] != null ? (v.Rings || {})[r] : null));
    // skills: a list "Fitness 2" or "Martial 3", or a map {Fitness: 2}
    let skillMap = {};
    if (Array.isArray(v.Skills)) v.Skills.forEach((s) => { const m = /^(.*\S)\s+(\d+)$/.exec(String(s)); if (m) skillMap[m[1]] = parseInt(m[2], 10); else skillMap[String(s)] = null; });
    else if (v.Skills && typeof v.Skills === 'object') skillMap = Object.assign({}, v.Skills);
    const names = Object.keys(skillMap);
    const grouped = names.length > 0 && names.every((k) => GROUPS.indexOf(k) !== -1);
    // derived: the printed value, else the corpus's own formula (system/l5r5e/sheet.js)
    let d = {};
    try { d = Sheet() && Object.keys(rings).some((r) => rings[r] != null) ? Sheet().derived({ Rings: rings }) : {}; } catch (e) { d = {}; }
    const dv = (k) => (num(k) != null ? { v: num(k) } : d[k] != null ? { v: d[k], computed: true } : null);
    const portrait = typeof window.L5RActorPortrait === 'function' ? window.L5RActorPortrait(base.id, base.full || base.name) : null;
    const ident = [v.Clan && String(v.Clan) + (/Clan$|Rōnin|Peasant|Gaijin/.test(v.Clan) ? '' : ' Clan'), v.Family, v.School && v.School + (v['School Rank'] ? ' ' + v['School Rank'] : ''), list(v.Roles).join(', ')].filter(Boolean);
    const extras = Object.keys(v).filter((k) => !PLACED.has(k) && k.charAt(0) !== '_' && v[k] != null && v[k] !== '' && !(Array.isArray(v[k]) && !v[k].length) && !(typeof v[k] === 'object' && !Array.isArray(v[k]) && !Object.keys(v[k]).length));
    return Object.assign({}, base, {
      portrait, ident,
      category: v.Category || null,
      ranks: { combat: num('Combat Conflict Rank') != null ? num('Combat Conflict Rank') : num('Conflict Rank (Combat)'), intrigue: num('Intrigue Conflict Rank') != null ? num('Intrigue Conflict Rank') : num('Conflict Rank (Intrigue)') },
      description: v.Description && base.kind !== 'Samurai' ? v.Description : null,
      rings, skills: skillMap, grouped,
      social: [['Honor', num('Honor')], ['Glory', num('Glory')], ['Status', num('Status')]],
      personal: [['Endurance', dv('Endurance')], ['Composure', dv('Composure')], ['Focus', dv('Focus')], ['Vigilance', dv('Vigilance')], ['Silhouette', num('Silhouette') != null ? { v: num('Silhouette') } : null], ['Void Points', num('Void Points') != null ? { v: num('Void Points') } : null]],
      demeanor: v.Demeanor || null, tnMods: v['Social Skill Check TN Modifiers'] || null,
      advantages: list(v.Advantages), disadvantages: list(v.Disadvantages),
      weapons: list(v['Favored Weapons']).concat(list(v.Weapons)),
      gear: [['Gear', list(v.Gear)], ['Gear (other)', list(v['Gear (Other)'])], ['Armor', list(v.Armor)], ['Equipment', list(v.Equipment)]].filter((g) => g[1].length),
      techniques: list(v.Techniques), titles: list(v.Titles), bonds: list(v.Bonds),
      bushido: v.Bushido && typeof v.Bushido === 'object' ? v.Bushido : null,
      heart: HEART.filter((k) => v[k] != null && v[k] !== '').map((k) => [k, v[k]]),
      relationships: list(v.Relationships),
      extras: extras.map((k) => [k, v[k]]),
      bio: (base.bio || []).filter(Boolean),
    });
  }
  // an entity (it has an id and a book, props or not) or a character's values
  const of = (src) => (src && src.id && src.book && (src.props || src.form) ? fromEntity(src) : fromValues(src));

  // ── pieces ──
  const emblem = (kind) => (kind === 'Minion' ? '▲' : kind === 'Adversary' ? '❁' : kind === 'Samurai' ? '❖' : '◈');
  function portraitOrEmblem(m, cls) {
    return m.portrait ? el('div', { class: cls + ' has-img' }, [el('img', { src: m.portrait, alt: '', loading: 'lazy' })]) : el('div', { class: cls + ' emblem' }, [emblem(m.kind)]);
  }
  const link = (name, book) => { const n = plain(name); return D.named(n, book) || D.recordNamed(n)[0] ? E.link({ name: n }, book) : el('span', {}, [n]); };
  // "Large Stature (Earth) [Martial; Physical]" → the name, its ring, its types; "Name: text"
  function trait(s, book) {
    const t = plain(s);
    const m = /^(.*?)\s*\((Air|Earth|Fire|Water|Void)\)\s*(?:\[([^\]]*)\])?\s*(.*)$/.exec(t);
    if (m) return el('div', { class: 'ac-trait' }, [el('b', {}, [link(m[1] + ' (' + m[2] + ')', book)]), ' ', Dice.ringIcon(m[2]), m[3] ? el('span', { class: 'ac-types' }, [' ' + m[3]]) : null, m[4] ? el('span', {}, [' ', E.span(m[4], book)]) : null]);
    const c = /^([^:]{1,60}):\s*(.+)$/.exec(t);
    if (c) return el('div', { class: 'ac-trait' }, [el('b', {}, [link(c[1], book), ':']), ' ', E.span(c[2], book)]);
    return el('div', { class: 'ac-trait' }, [el('b', {}, [link(t, book)])]);
  }
  function weapon(s, book) {
    const t = plain(s);
    const c = /^([^:]{1,60}):\s*(.+)$/.exec(t);
    return el('p', { class: 'ac-weap' }, c ? [el('b', {}, [link(c[1], book)]), ': ', E.span(c[2], book)] : [link(t, book)]);
  }
  const statCol = (label, rows) => el('div', { class: 'ac-statcol' }, [el('div', { class: 'ac-lab' }, [label])].concat(rows.filter((r) => r[1] != null).map(([k, x]) => {
    const val = x && typeof x === 'object' ? x : { v: x };
    return el('div', { class: 'ac-row' + (val.computed ? ' computed' : ''), title: val.computed ? k + ': from the corpus’s formula (the record does not print it)' : null }, [el('span', { class: 'ac-nm' }, [k]), el('span', { class: 'ac-v' }, [String(val.v)])]);
  })));

  function rollSection(m, roller) {
    const sec = el('div', { class: 'ac-roll collapsed' });
    const cur = el('span', { class: 'ac-roll-cur' }, ['']);
    const toggle = el('button', { type: 'button', class: 'ac-roll-toggle', onclick: () => sec.classList.toggle('collapsed') }, [el('span', { class: 'ac-roll-title' }, ['⚄ Roll & Keep']), cur, el('span', { class: 'ac-roll-chev' }, ['▸'])]);
    sec.appendChild(toggle);
    sec.appendChild(el('div', { class: 'ac-roll-body' }, [roller]));
    sec.open = (label) => { sec.classList.remove('collapsed'); cur.textContent = label || ''; };
    return sec;
  }

  const hasStat = (m) => RINGS.some((r) => m.rings[r] != null) || Object.keys(m.skills).length > 0 || m.ranks.combat != null;
  function playTab(m, o) {
    const book = m.book;
    const wrap = el('div', { class: 'ac-play' });
    if (!hasStat(m)) wrap.appendChild(el('p', { class: 'ac-meta ac-nostat' }, ['No statblock in the book — bio only.']));
    // the roll: a skill's (or a skill group's) click opens it set for that skill
    let roll = null;
    // a page with its own roller (the live party sheet) takes the skill's click instead
    if (o.onRoll) roll = { pick: (skill, rank) => o.onRoll(skill, rank || 0) };
    else if (o.roller !== false && Dice && Dice.roller && RINGS.some((r) => m.rings[r] != null)) {
      const best = RINGS.reduce((a, r) => ((m.rings[r] || 0) > (m.rings[a] || 0) ? r : a), 'Air');
      const r = (o.roller && o.roller.nodeType) ? o.roller : Dice.roller({ preset: { ring: best, ringValue: m.rings[best] || 1, skill: null, skillRank: 0 }, ringsOf: (rg) => m.rings[rg] || 1, onResolve: () => {} });
      roll = rollSection(m, r);
      roll.pick = (skill, rank) => { if (r.set) r.set({ skill, skillRank: rank || 0 }); roll.open(skill + ' ' + (rank || 0)); r.scrollIntoView && r.scrollIntoView({ block: 'nearest' }); };
      wrap.appendChild(roll);
    }
    const ranks = m.ranks.combat != null || m.ranks.intrigue != null;
    wrap.appendChild(el('div', { class: 'ac-typebar' }, [
      el('span', { class: 'ac-type' }, [m.kind + (m.category ? ' · ' + m.category : '')]),
      ranks ? el('span', { class: 'ac-ranks' }, [el('span', { class: 'ac-rk-lab' }, ['Conflict rank']),
        el('span', { class: 'ac-rk combat', title: 'Combat' }, ['⚔ ' + (m.ranks.combat == null ? '—' : m.ranks.combat)]),
        el('span', { class: 'ac-rk intrigue', title: 'Intrigue' }, ['❉ ' + (m.ranks.intrigue == null ? '—' : m.ranks.intrigue)])]) : null,
    ]));
    if (m.ident.length) wrap.appendChild(el('p', { class: 'ac-ident' }, [m.ident.join(' · ')]));
    if (m.description) wrap.appendChild(E.prose(m.description, 'ac-desc prose', book));
    if (RINGS.some((r) => m.rings[r] != null)) {
      wrap.appendChild(el('div', { class: 'ac-rings' }, RINGS.map((r) => el('div', { class: 'ac-ring ring-' + r.toLowerCase() + (o.stance === r ? ' stance' : '') }, [Dice.ringIcon(r), el('span', { class: 'ac-ring-nm' }, [r]), el('span', { class: 'ac-ring-v' }, [m.rings[r] == null ? '—' : String(m.rings[r])])]))));
    }
    const soc = m.social.filter((r) => r[1] != null);
    const per = m.personal.filter((r) => r[1] != null);
    if (soc.length || per.length) wrap.appendChild(el('div', { class: 'ac-stats' }, [soc.length ? statCol('Societal', soc) : el('div'), per.length ? statCol('Personal', per) : el('div')]));
    if (m.demeanor || m.tnMods) wrap.appendChild(el('div', { class: 'ac-demeanor' }, [
      m.demeanor ? el('span', {}, [el('span', { class: 'ac-dm-lab' }, ['Demeanor']), E.span(plain(m.demeanor), book)]) : null,
      m.tnMods ? el('span', {}, [el('span', { class: 'ac-dm-lab' }, ['Social TN']), E.span(plain(m.tnMods), book)]) : null,
    ]));
    // skills: an NPC's five groups as chips; a samurai's skills by group, the ranked ones
    const click = (name, rank) => (roll && roll.pick ? () => roll.pick(name, rank) : null);
    if (m.grouped) {
      wrap.appendChild(el('div', { class: 'ac-skills' }, GROUPS.map((g) => {
        const v = m.skills[g] || 0;
        return el('button', { type: 'button', class: 'ac-chip' + (v > 0 ? ' ranked' : ''), title: roll ? 'Roll ' + g : null, onclick: click(g, v) }, [el('span', { class: 'ac-chip-nm' }, [g]), el('span', { class: 'ac-chip-v' }, [String(v)])]);
      })));
    } else if (Object.keys(m.skills).length) {
      const groups = (Sheet() ? Sheet().skillGroups() : []).map((g) => ({ name: g.name, skills: g.skills.map((s) => s.name).filter((s) => m.skills[s] != null) })).filter((g) => g.skills.length);
      const known = new Set([].concat(...groups.map((g) => g.skills)));
      const odd = Object.keys(m.skills).filter((s) => !known.has(s));
      if (odd.length) groups.push({ name: 'As printed', skills: odd });
      wrap.appendChild(el('div', { class: 'ac-skillgroups' }, groups.map((g) => el('div', { class: 'ac-skillgroup' }, [el('div', { class: 'ac-lab' }, [g.name]),
        el('div', { class: 'ac-skills' }, g.skills.map((s) => el('button', { type: 'button', class: 'ac-chip' + (m.skills[s] ? ' ranked' : ''), title: roll ? 'Roll ' + s : null, onclick: click(s, m.skills[s]) }, [el('span', { class: 'ac-chip-nm' }, [s]), el('span', { class: 'ac-chip-v' }, [m.skills[s] == null ? '·' : String(m.skills[s])])])))]))));
    }
    if (m.advantages.length || m.disadvantages.length) {
      const col = (label, items) => el('div', { class: 'ac-adcol' }, [el('div', { class: 'ac-lab' }, [label])].concat(items.length ? items.map((x) => trait(x, book)) : [el('div', { class: 'ac-none' }, ['—'])]));
      wrap.appendChild(el('div', { class: 'ac-adv' }, [col('Advantages', m.advantages), col('Disadvantages', m.disadvantages)]));
    }
    if (m.techniques.length) wrap.appendChild(el('div', {}, [el('div', { class: 'ac-h' }, ['Techniques']), el('div', { class: 'ac-techs' }, m.techniques.map((t) => el('span', { class: 'ac-tech' }, [link(t, book)])))]));
    if (m.weapons.length || m.gear.length) {
      wrap.appendChild(el('div', { class: 'ac-gear' }, [el('div', { class: 'ac-h' }, [m.weapons.length ? 'Favored weapons & gear' : 'Gear'])]
        .concat(m.weapons.map((w) => weapon(w, book)))
        // a short list reads as one line; items that carry their own profile ("Fists: Martial Arts
        // [Unarmed], Range 0, Damage 1") take a line each, as the weapons do
        .concat(m.gear.map(([k, items]) => (items.some((x) => /:/.test(String(x)))
          ? el('div', { class: 'ac-gearlist' }, [el('span', { class: 'ac-gl-lab' }, [k])].concat(items.map((x) => weapon(x, book))))
          : el('p', { class: 'ac-gearline' }, [el('span', { class: 'ac-gl-lab' }, [k + ':']), ' '].concat(items.map((x, i) => [i ? ', ' : null, E.span(plain(x), book)]))))))));
    }
    if (m.titles.length || m.bonds.length) wrap.appendChild(el('div', {}, [m.titles.length ? el('p', { class: 'ac-gearline' }, [el('span', { class: 'ac-gl-lab' }, ['Titles:']), ' ', m.titles.join(', ')]) : null, m.bonds.length ? el('p', { class: 'ac-gearline' }, [el('span', { class: 'ac-gl-lab' }, ['Bonds:']), ' ', m.bonds.join(', ')]) : null]));
    if (m.abilities.length) {
      wrap.appendChild(el('div', { class: 'ac-abils' }, [el('div', { class: 'ac-h' }, ['Abilities'])].concat(m.abilities.map((a) => el('div', { class: 'ac-abil' }, [
        el('div', { class: 'ac-abil-nm' }, [a.id ? el('a', { class: 'ref', href: '#', onclick: (ev) => { ev.preventDefault(); if (window.L5ROpenEntity) window.L5ROpenEntity(a.id); } }, [a.name]) : a.name]),
        a.text ? E.prose(a.text, 'ac-abil-text prose', book) : a.rich && a.entity ? E.render(a.entity, { bare: true, depth: 1 }) : null,
      ])))));
    }
    return wrap;
  }

  function bioTab(m) {
    const book = m.book;
    const wrap = el('div', { class: 'ac-bio' });
    m.bio.forEach((p) => wrap.appendChild(E.prose(p, 'ac-bp prose', book)));
    if (m.bushido && (m.bushido['Paramount Tenet'] || m.bushido['Less Significant Tenet'])) wrap.appendChild(el('div', { class: 'ac-heart' }, [el('span', { class: 'ac-dm-lab' }, ['Bushidō']), 'paramount ', el('b', {}, [m.bushido['Paramount Tenet'] || '—']), ' · less significant ', el('b', {}, [m.bushido['Less Significant Tenet'] || '—'])]));
    m.heart.forEach(([k, x]) => wrap.appendChild(el('div', { class: 'ac-heart' }, [el('div', { class: 'ac-lab' }, [k]), E.prose(plain(Array.isArray(x) ? x.join('\n\n') : x), 'prose', book)])));
    if (m.relationships.length) wrap.appendChild(el('div', { class: 'ac-heart' }, [el('div', { class: 'ac-lab' }, ['Relationships']), el('ul', { class: 'items' }, m.relationships.map((r) => el('li', {}, [E.span(plain(r), book)])))]));
    if (m.extras.length) {
      wrap.appendChild(el('div', { class: 'ac-h' }, ['Also printed']));
      wrap.appendChild(el('dl', { class: 'ac-extras' }, [].concat(...m.extras.map(([k, x]) => [el('dt', {}, [k]), el('dd', {}, [Array.isArray(x) ? x.map((y, i) => [i ? ' · ' : null, E.span(plain(typeof y === 'object' ? JSON.stringify(y) : y), book)]) : typeof x === 'object' ? Object.keys(x).map((q) => q + ': ' + x[q]).join(' · ') : E.span(plain(x), book)])]))));
    }
    if (!wrap.children.length) wrap.appendChild(el('p', { class: 'ac-meta' }, ['The book prints no biography for ' + m.name + '.']));
    if (m.book && D.label) wrap.appendChild(el('p', { class: 'ac-meta' }, ['Source · ' + D.label(m.book)]));
    return wrap;
  }

  // the sheet. opts: { tab: 'play'|'bio', roller: element|false, stance, actions: [elements] }
  function sheet(src, opts) {
    const o = opts || {};
    const m = src && src.ident ? src : of(src);
    let tab = o.tab || (hasStat(m) ? tabPref() : 'bio');
    const host = el('div', { class: 'ac-sheet' });
    const body = el('div', { class: 'ac-body' });
    const seg = el('div', { class: 'ac-seg' });
    const draw = () => {
      seg.innerHTML = '';
      [['bio', 'Bio'], ['play', 'Play']].forEach(([k, label]) => seg.appendChild(el('button', { type: 'button', class: 'ac-seg-btn' + (tab === k ? ' sel' : ''), onclick: () => { tab = k; setTabPref(k); draw(); } }, [label])));
      body.innerHTML = '';
      body.appendChild(tab === 'bio' ? bioTab(m) : playTab(m, o));
    };
    host.appendChild(el('div', { class: 'ac-head' }, [
      portraitOrEmblem(m, 'ac-portrait'),
      el('div', { class: 'ac-id' }, [el('span', { class: 'ac-nm' }, [m.name]), m.epithet ? el('span', { class: 'ac-ep' }, [plain(m.epithet)]) : null]),
      el('div', { class: 'ac-head-r' }, (o.actions || []).concat([seg])),
    ]));
    host.appendChild(body);
    draw();
    return host;
  }

  // the roster's card
  function card(src, href, opts) {
    const o = opts || {};
    const m = src && src.ident ? src : of(src);
    const snip = (m.bio[0] || m.description || '').replace(/\s+/g, ' ');
    return el('a', { class: 'ac-card' + (o.active ? ' active' : '') + (m.kind === 'Samurai' ? ' pc' : ''), href }, [el('div', { class: 'ac-card-in' }, [
      portraitOrEmblem(m, 'ac-card-art'),
      el('div', { class: 'ac-card-nm' }, [m.name]),
      m.epithet ? el('div', { class: 'ac-card-ep' }, [plain(m.epithet)]) : m.cardLine || m.ident.length ? el('div', { class: 'ac-card-ep' }, [m.cardLine || m.ident.slice(0, 2).join(' · ')]) : null,
      el('div', { class: 'ac-card-kind' }, [m.kind + (m.ranks.combat != null ? ' · ⚔ ' + m.ranks.combat + ' ❉ ' + (m.ranks.intrigue == null ? '—' : m.ranks.intrigue) : '')]),
      snip ? el('p', { class: 'ac-card-snip' }, [snip.length > 240 ? snip.slice(0, snip.lastIndexOf(' ', 240)) + '…' : snip]) : null,
      el('div', { class: 'ac-card-book' }, [D.label(m.book)]),
    ])]);
  }

  // an instance with a record to show — not a type that only extends one (Path of Waves' "Ronin")
  // (a book's NPC may print no statblock — a bio-only character — and is still an actor; a rule
  // that only applies to NPCs, "Animal Checks", is one only if it carries rings or skills)
  const stat = (e) => (e.props || []).some((p) => p.name === 'Rings' || p.name === 'Skills');
  const isActor = (e) => !!e && (((e.type === 'NPC' || e.type === 'Samurai') && (e.props || []).length > 0) || (D.applies(e, 'NPC') && stat(e)));
  return { of, fromEntity, fromValues, sheet, card, isActor, splitName };
})();
