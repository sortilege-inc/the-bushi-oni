// system/l5r5e/sheet.js — the character sheet, derived from the corpus's ACTOR "Samurai" at
// runtime (PLAYBOOK §1b): the declared fields of Entity and Samurai, in declared order, each
// drawn by its declared type — Rings a DEF of five INTEGER 1–5 as the five tiles, a `LIST OF
// ^"Skill"` the core's skills by SKILL_GROUP with their ranks, a `LIST OF ^"Technique"` names
// from the books, an INTEGER MIN 0 MAX 100 a number, a STRING a line.
//
// The derived attributes are the corpus's own FORMULA strings, evaluated ("(Earth + Fire) × 2",
// "(Air + Water) / 2 (rounded down)"); the conditions are the ACTOR's own RULES
// (`WHEN [^"Strife" > ^"Composure"] THEN ^"Samurai" IS compromised`); Void points start at
// the STARTING_VALUE the corpus prints and cap at its MAXIMUM. Nothing is hand-listed.
//
// Also here: the live sheet for play — current Fatigue, Strife and Void points, the stance,
// and checks through the Roll & Keep roller (system/l5r5e/dice.js) that add the strife received
// to Strife, spend the Void point Seize the Moment costs, offer the character's distinctions and
// adversities as the rerolls their rules give, and grant the Void points the rules grant. Every
// change to a tracker is logged as an event with what caused it.
window.L5RSheet = (function () {
  const { el, button } = window.VttRender;
  const D = window.L5RData;
  const E = window.L5REntity;
  const Dice = window.L5RDice;
  const State = () => window.VttState;

  const ACTOR = 'Samurai';
  const FILE_KIND = 'sortilege-vtt-character';
  const RINGS = ['Air', 'Earth', 'Fire', 'Water', 'Void'];

  // ── the declaration, read at runtime ──
  const declared = () => D.declared(ACTOR);
  const actor = () => declared().chain.slice(-1)[0] || null;

  // One entry per declared field: { name, kind, of, min, max, fields }
  function spec() {
    return declared().props.map((p) => {
      const s = { name: p.name, required: !!p.required, min: p.min, max: p.max };
      if (p.vk === 'def') {
        s.kind = p.name === 'Rings' ? 'rings' : 'group';
        s.fields = (p.fields || []).map((f) => ({ name: f.name, min: f.min, max: f.max, def: f.default, dtype: f.dtype }));
      } else if (p.vk === 'list' && p.of && !p.ofWord) { s.kind = p.of === 'Skill' ? 'skills' : 'names'; s.of = p.of; }
      else if (p.vk === 'list') s.kind = 'lines';
      else if (p.dtype === 'INTEGER') { s.kind = 'number'; s.def = p.default; }
      else s.kind = 'text';
      return s;
    });
  }

  // ── the corpus behind the fields ──
  // skills: the core's, each with its SKILL_GROUP, in printed order
  function skills() {
    return D.all(['core']).filter((e) => e.file.endsWith('core-traits.ttrpg') && D.block(e, 'SKILL_GROUP')).map((e) => ({ name: e.name, group: D.kwArg(e, 'SKILL_GROUP'), id: e.id }));
  }
  function skillGroups() {
    const g = [];
    skills().forEach((s) => {
      let row = g.find((x) => x.name === s.group);
      if (!row) g.push((row = { name: s.group, skills: [] }));
      row.skills.push(s);
    });
    return g;
  }
  // a derived attribute's FORMULA, evaluated over the rings — the corpus's arithmetic, read
  function formula(name) {
    const e = D.all(['core']).find((x) => x.name === name && x.file.endsWith('core-traits.ttrpg'));
    return e ? D.kwArg(e, 'FORMULA') : null;
  }
  function evaluate(text, rings) {
    if (!text) return null;
    let t = String(text);
    const down = /\(rounded down\)/.test(t);
    const up = /\(rounded up\)/.test(t);
    t = t.replace(/\(rounded (down|up)\)/, '').replace(/ ring value/g, '').replace(/×/g, '*');
    t = t.replace(/\b(Air|Earth|Fire|Water|Void)\b/g, (m) => String(rings[m] || 0));
    if (!/^[\d\s+\-*/().]+$/.test(t)) return null;
    // eslint-disable-next-line no-new-func
    const v = Function('return (' + t + ')')();
    return down ? Math.floor(v) : up ? Math.ceil(v) : v;
  }
  const DERIVED = ['Endurance', 'Composure', 'Focus', 'Vigilance'];
  function derived(v) {
    const out = {};
    DERIVED.forEach((k) => (out[k] = evaluate(formula(k), v.Rings || {})));
    const vp = D.named('Void Points', 'core');
    out.voidMax = evaluate(vp && D.kwArg(vp, 'MAXIMUM'), v.Rings || {});
    out.voidStart = evaluate(vp && D.kwArg(vp, 'STARTING_VALUE'), v.Rings || {});
    return out;
  }
  // the ACTOR's RULES: `WHEN [^"A" > ^"B"] THEN ^"Samurai" IS state`
  function conditionRules() {
    const a = actor();
    return ((a && a.rules) || []).map((r) => /WHEN \[\^"([^"]+)" > \^"([^"]+)"\] THEN \^"[^"]+" IS (\w+)/.exec(r.text)).filter(Boolean).map((m) => ({ over: m[1], limit: m[2], state: m[3] }));
  }

  // ── a character's values ──
  function blank() {
    const v = {};
    spec().forEach((s) => {
      if (s.kind === 'rings') { v.Rings = {}; s.fields.forEach((f) => (v.Rings[f.name] = f.def != null ? f.def : 1)); }
      else if (s.kind === 'group') { v[s.name] = {}; s.fields.forEach((f) => (v[s.name][f.name] = '')); }
      else if (s.kind === 'skills') v[s.name] = {};
      else if (s.kind === 'names' || s.kind === 'lines') v[s.name] = [];
      else if (s.kind === 'number') v[s.name] = s.def != null ? s.def : null;
      else v[s.name] = '';
    });
    return v;
  }
  function complete(v) {
    const out = blank();
    Object.keys(v || {}).forEach((k) => {
      if (v[k] == null) return;
      if (out[k] && typeof out[k] === 'object' && !Array.isArray(out[k]) && typeof v[k] === 'object' && !Array.isArray(v[k])) out[k] = Object.assign({}, out[k], v[k]);
      else out[k] = v[k];
    });
    return out;
  }
  // the declared value, or what its FORMULA gives when the sheet leaves it empty
  function value(v, name) {
    if (v[name] != null && v[name] !== '') return v[name];
    const d = derived(v);
    return d[name] != null ? d[name] : null;
  }

  // ── a pregen: the corpus's own instance of Samurai, read into the same values ──
  // Its declared fields map by name; a skill printed "Fitness 1" is a rank; a field the ACTOR
  // does not declare (Region, Upbringing, Past, Relationships…) travels along as it is.
  function fromEntity(e) {
    const v = blank();
    const S = spec();
    (e.props || []).forEach((p) => {
      const s = S.find((x) => x.name === p.name);
      const pv = D.pval(p);
      if (s && s.kind === 'rings') v.Rings = Object.assign({}, v.Rings, D.defFields(p).fields);
      else if (s && s.kind === 'skills') {
        const m = {};
        (pv || []).forEach((x) => { const r = /^(.*\S)\s+(\d+)$/.exec(String(x)); if (r) m[r[1]] = parseInt(r[2], 10); });
        v[p.name] = m;
      } else if (s && s.kind === 'group') v[p.name] = Object.assign({}, v[p.name], D.defFields(p).fields);
      else if (p.vk === 'def') v[p.name] = D.defFields(p).fields;   // an undeclared DEF (a character's own record) as its fields
      else v[p.name] = pv;
    });
    v.Description = v.Description || e.desc || '';
    // its abilities as the book prints them (Gift of Inner Power, Sixth Sense…), by id
    const kids = D.children(e.id);
    if (kids.length) v._abilities = kids.map((k) => ({ id: k.id, name: k.name }));
    v._source = { id: e.id, book: e.book, name: e.name };
    return v;
  }

  // A one-line description of who this is, from the sheet's own fields.
  function sentence(v) {
    return [v.Name || 'An unnamed samurai', [v.Clan && v.Clan + (/Clan$/.test(v.Clan) ? '' : ' Clan'), v.Family].filter(Boolean).join(', '), v.School ? v.School + (v['School Rank'] ? ' ' + v['School Rank'] : '') : null].filter(Boolean).join(' · ');
  }

  // ── the sheet, drawn from the declaration ──
  function ringTiles(v, onChange, o) {
    const ro = !onChange;
    const def = (o && o.deficient) || [];
    return el('div', { class: 'rings-row' }, RINGS.map((r) => el('div', { class: 'ring-tile' + (o && o.stance === r ? ' stance' : '') + (def.indexOf(r) !== -1 ? ' deficient' : ''), title: r + (def.indexOf(r) !== -1 ? ' — deficient (Elemental Deficiency)' : '') }, [
      Dice.ringIcon(r),
      ro ? el('div', { class: 'v' }, [String((v.Rings || {})[r] == null ? '—' : v.Rings[r])])
        : el('input', { class: 'text num small', type: 'number', min: 1, max: 5, value: (v.Rings || {})[r] || 1, oninput: (ev) => onChange('Rings', Object.assign({}, v.Rings, { [r]: parseInt(ev.target.value || '1', 10) })) }),
      el('div', { class: 'k' }, [r]),
    ])));
  }
  function skillsBlock(s, v, onChange, onRoll) {
    const ro = !onChange;
    const have = v[s.name] || {};
    const known = new Set(skills().map((x) => x.name));
    const extra = Object.keys(have).filter((k) => !known.has(k));
    return el('div', { class: 'skill-groups' }, [
      skillGroups().map((g) => el('div', { class: 'skill-group' }, [
        el('div', { class: 'prop-k' }, [g.name]),
        g.skills.map((k) => el('div', { class: 'skill-row' }, [
          onRoll ? el('button', { type: 'button', title: 'Roll ' + k.name, onclick: () => onRoll(k.name, have[k.name] || 0) }, [k.name]) : E.link({ hash: k.id, name: k.name }, 'core'),
          ro ? el('span', { class: 'pips' }, ['●'.repeat(have[k.name] || 0) + '○'.repeat(Math.max(0, 5 - (have[k.name] || 0)))])
            : el('input', { class: 'text num small', type: 'number', min: 0, max: 5, value: have[k.name] || 0, oninput: (ev) => onChange(s.name, Object.assign({}, have, { [k.name]: parseInt(ev.target.value || '0', 10) })) }),
        ])),
      ])),
      extra.length ? el('div', { class: 'skill-group' }, [el('div', { class: 'prop-k' }, ['As printed on the sheet']), extra.map((k) => el('div', { class: 'skill-row' }, [onRoll ? el('button', { type: 'button', onclick: () => onRoll(k, have[k]) }, [k]) : el('span', {}, [k]), el('span', { class: 'pips' }, [String(have[k])])]))]) : null,
    ]);
  }
  function namesBlock(s, v, onChange) {
    const list = v[s.name] || [];
    const ro = !onChange;
    const input = ro ? null : el('input', { class: 'text small', type: 'text', placeholder: 'add a ' + s.of.toLowerCase() + '…', list: 'dl-' + s.of.replace(/\W/g, '') });
    return el('div', {}, [
      el('ul', { class: 'items' }, list.map((n, i) => el('li', {}, [E.link({ name: String(n).replace(/\s+\((?:[^()]*)\)$|\s+—.*$/, '') }, 'core'), String(n).match(/\s+\((?:[^()]*)\)$|\s+—.*$/) ? el('span', { class: 'muted small' }, [String(n).match(/\s+\((?:[^()]*)\)$|\s+—.*$/)[0]]) : null, ro ? null : button('×', () => onChange(s.name, list.filter((_, j) => j !== i)), 'ghost tiny')]))),
      ro ? null : el('div', { class: 'chiprow tight' }, [input, button('Add', () => { if (input.value.trim()) onChange(s.name, list.concat([input.value.trim()])); }, 'ghost tiny')]),
    ]);
  }
  function linesBlock(s, v, onChange) {
    const list = v[s.name] || [];
    if (!onChange) return list.length ? el('ul', { class: 'items' }, list.map((x) => el('li', {}, [E.span(String(x), 'core')]))) : el('span', { class: 'muted small' }, ['—']);
    return el('textarea', { class: 'text', rows: Math.max(2, list.length + 1), oninput: (ev) => onChange(s.name, ev.target.value.split('\n').map((x) => x.trim()).filter(Boolean)) }, [list.join('\n')]);
  }
  function scalar(s, v, onChange) {
    const val = s.kind === 'number' ? value(v, s.name) : v[s.name];
    if (!onChange) return val == null || val === '' ? el('span', { class: 'muted small' }, ['—']) : (typeof val === 'number' ? el('span', { class: 'num' }, [String(val)]) : E.span(String(val), 'core'));
    if (s.kind === 'number') return el('input', { class: 'text num', type: 'number', min: s.min != null ? s.min : null, max: s.max != null ? s.max : null, value: v[s.name] == null ? '' : v[s.name], placeholder: val != null ? String(val) : '', oninput: (ev) => onChange(s.name, ev.target.value === '' ? null : parseInt(ev.target.value, 10)) });
    const long = s.name === 'Description' || s.name === 'Ninjō' || s.name === 'Giri';
    return long ? el('textarea', { class: 'text', rows: 2, oninput: (ev) => onChange(s.name, ev.target.value) }, [v[s.name] || '']) : el('input', { class: 'text', type: 'text', value: v[s.name] || '', oninput: (ev) => onChange(s.name, ev.target.value) });
  }
  function groupBlock(s, v, onChange) {
    const g = v[s.name] || {};
    return el('div', { class: 'fields' }, s.fields.map((f) => el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, [f.name]), el('div', { class: 'prop-v' }, [
      onChange ? el('input', { class: 'text', type: 'text', value: g[f.name] || '', oninput: (ev) => onChange(s.name, Object.assign({}, g, { [f.name]: ev.target.value })) }) : (g[f.name] ? E.span(String(g[f.name]), 'core') : el('span', { class: 'muted small' }, ['—'])),
    ])])));
  }

  // The layout names where each declared field goes; anything it does not name lands in
  // "Also on the sheet" — and so does anything the character carries that is not declared.
  const LAYOUT = {
    head: ['Name', 'Clan', 'Family', 'School', 'School Rank', 'Roles'],
    social: ['Honor', 'Glory', 'Status'],
    derived: DERIVED.concat(['Void Points']),
    heart: ['Ninjō', 'Giri', 'Bushido', 'Demeanor'],
    lists: ['Techniques', 'Advantages', 'Disadvantages', 'Titles', 'Bonds', 'Equipment'],
  };
  // Read-only, a character is drawn as an actor's sheet (system/l5r5e/actor.js — Portents &
  // Fortunes' Dramatis Personae look); the field-by-field form below stays for editing and as
  // the fallback where actor.js is not loaded.
  function render(v, onChange, opts) {
    const A = window.L5RActor;
    if (A && !onChange) {
      const o = opts || {};
      return A.sheet(A.fromValues(v), { roller: false, onRoll: o.onRoll || null, stance: o.stance || null });
    }
    return renderFields(v, onChange, opts);
  }
  function renderFields(v, onChange, opts) {
    const o = opts || {};
    const bare = !!o.compact && !onChange;   // the player's copy: what is on the sheet, no working, no blanks
    const S = spec();
    const byName = {};
    S.forEach((s) => (byName[s.name] = s));
    const used = new Set(['Rings', 'Skills', 'Description', 'Fatigue', 'Strife', 'Experience']);
    const field = (name) => {
      const s = byName[name];
      if (!s) return null;
      used.add(name);
      if (bare) {
        const val = s.kind === 'number' ? value(v, s.name) : v[s.name];
        if (val == null || val === '' || (Array.isArray(val) && !val.length) || (typeof val === 'object' && !Array.isArray(val) && !Object.keys(val).some((k) => val[k]))) return null;
      }
      const c = s.kind === 'names' ? namesBlock(s, v, onChange) : s.kind === 'lines' ? linesBlock(s, v, onChange) : s.kind === 'group' ? groupBlock(s, v, onChange) : scalar(s, v, onChange);
      return el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, [s.name]), el('div', { class: 'prop-v' }, [c])]);
    };
    const d = derived(v);
    const sheet = el('div', { class: 'sheet' }, [
      el('div', { class: 'two-up' }, [el('div', {}, LAYOUT.head.map(field)), el('div', {}, [ringTiles(v, onChange, o), el('div', { class: 'fields' }, LAYOUT.social.map(field))])]),
      bare ? el('div', { class: 'sheet-sec' }, [el('h4', {}, ['Derived']), el('div', { class: 'fields' }, LAYOUT.derived.map(field))])
        : el('div', { class: 'sheet-sec' }, [el('h4', {}, ['Derived', el('span', { class: 'muted small' }, [' · from the corpus’s formulas: ' + DERIVED.map((k) => k + ' ' + (formula(k) || '?')).join('; ')])]), el('div', { class: 'fields' }, LAYOUT.derived.map(field)),
        el('div', { class: 'muted small' }, ['Void points: start ' + (d.voidStart == null ? '—' : d.voidStart) + ', at most ' + (d.voidMax == null ? '—' : d.voidMax)])]),
      byName.Skills ? el('div', { class: 'sheet-sec' }, [el('h4', {}, ['Skills']), skillsBlock(byName.Skills, v, onChange, o.onRoll)]) : null,
      el('div', { class: 'sheet-sec' }, [el('h4', {}, ['Heart']), LAYOUT.heart.map(field)]),
      el('div', { class: 'sheet-sec' }, [el('h4', {}, ['Techniques, advantages, gear']), LAYOUT.lists.map(field)]),
      byName.Experience ? el('div', { class: 'sheet-sec' }, [field('Experience'), field('Description')]) : null,
    ]);
    const rest = S.filter((s) => !used.has(s.name));
    // what the sheet already shows elsewhere (the stance, the XP record, a version's own label)
    const SHOWN = ['Stance', 'Experience Spent', 'Experience Ledger', 'Version Of', 'Version Label', 'Version Date'];
    const undeclared = Object.keys(v).filter((k) => !byName[k] && k.charAt(0) !== '_' && SHOWN.indexOf(k) === -1);
    const plainValue = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).map((q) => q + ': ' + x[q]).join(' · ') : String(x));
    if (rest.length || undeclared.length) {
      sheet.appendChild(el('div', { class: 'sheet-sec' }, [el('h4', {}, ['Also on the sheet']),
        rest.map((s) => field(s.name)),
        undeclared.map((k) => el('div', { class: 'prop' }, [el('div', { class: 'prop-k' }, [k]), el('div', { class: 'prop-v' }, [Array.isArray(v[k]) ? el('ul', { class: 'items' }, v[k].map((x) => el('li', {}, [E.span(plainValue(x), 'core')]))) : E.span(plainValue(v[k]), 'core')])])),
      ]));
    }
    if (v._abilities && v._abilities.length) sheet.appendChild(el('div', { class: 'sheet-sec' }, [el('h4', {}, ['As the book prints them']), v._abilities.map((a) => { const e = D.entity(a.id); return e ? E.render(e, { depth: 1 }) : null; })]));
    return sheet;
  }

  // the published character, read-only, with its checks — the site's Characters page
  function fromEntityView(e) {
    const v = fromEntity(e);
    const wrap = el('div', {}, [el('h2', {}, [v.Name || e.name]), el('div', { class: 'muted' }, [sentence(v) + ' · ' + D.label(e.book)])]);
    const roller = Dice.roller({ preset: { ring: 'Air', ringValue: v.Rings.Air, skill: null, skillRank: 0 }, ringsOf: (r) => v.Rings[r], onResolve: () => {} });
    wrap.appendChild(render(v, null, { onRoll: (skill, rank) => { roller.set({ skill, skillRank: rank }); roller.scrollIntoView({ block: 'center' }); } }));
    wrap.appendChild(el('h4', {}, ['A check']));
    wrap.appendChild(roller);
    wrap.appendChild(el('div', { class: 'chiprow' }, [button('Download as a character file', () => download(v)), el('span', { class: 'muted small' }, ['the GM’s table and the player’s page take it back'])]));
    return wrap;
  }

  // ── the character file ──
  function readFile(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('Not a character file.');
    if (State() && State().renameIds) State().renameIds(obj);   // a file saved before the corpus hashed its entities
    return complete(obj.kind === FILE_KIND && obj.character ? obj.character : obj);
  }
  // The file carries the character, its live values, its versions and its log (rolls and events):
  // the record travels with it, and loading it back brings them all.
  function fileOf(v, live, extra) {
    const x = extra || {};
    return { kind: FILE_KIND, version: 1, system: 'l5r5e', templateId: (actor() || {}).id || null, exported: new Date().toISOString(), name: v.Name || '', character: v, live: live || undefined,
      versions: x.versions && x.versions.length ? x.versions : undefined, log: x.log && x.log.length ? x.log : undefined, portrait: x.portrait || undefined };
  }
  function download(v, live, extra) {
    const blob = new Blob([JSON.stringify(fileOf(v, live, extra), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (v.Name || 'samurai').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.l5r5e-character.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }
  function memberFrom(v, source, live, extra) {
    const x = extra || {};
    const m = { id: State().genId('pc'), templateId: (actor() || {}).id || 'l5r5e-samurai', name: v.Name || 'Unnamed', source: source || { kind: 'file' }, character: v, live: live || {}, notes: '', playerNotes: '' };
    if (x.versions) m.versions = x.versions;
    if (x.log) m.history = x.log.map((e) => Object.assign({}, e, { memberId: undefined }));
    if (x.portrait) m.portrait = x.portrait;
    return m;
  }
  const readMember = (obj, fileName) => memberFrom(readFile(obj), { kind: 'file', name: fileName || null }, obj && obj.live, obj && obj.kind === FILE_KIND ? obj : null);
  // An archived version on screen withholds the file: it acts on the live character.
  function downloadMember(m) {
    if (isViewingArchive(m)) { window.alert('An archived version is on screen. Return to Current to download the character.'); return false; }
    return download(m.character || blank(), m.live || {}, { versions: versionsOf(m), log: logOf(m).map((e) => Object.assign({}, e, { memberId: undefined })), portrait: m.portrait });
  }
  // A character from the corpus (or an instance's layer) comes with its archived sheets: entities
  // that are ^"Version Of" it, each with its ^"Version Label" and ^"Version Date", read-only, in the
  // order printed; its printed ^"Stance" starts the live one.
  function memberFromEntity(e) {
    const v = fromEntity(e);
    const versions = D.versionsOf(e.id).map((r) => D.entity(r.id)).filter(Boolean).map((ve) => {
      const vv = fromEntity(ve);
      return { id: ve.id, label: D.text(ve, 'Version Label') || ve.name, date: D.text(ve, 'Version Date') || null, character: vv, live: vv.Stance ? { stance: vv.Stance } : {}, source: 'printed' };
    });
    return memberFrom(v, { kind: 'pregen', id: e.id, book: e.book }, v.Stance ? { stance: v.Stance } : {}, { versions: versions.length ? versions : null });
  }

  // ── play: the live values, the conditions, the checks ──
  // live = { Fatigue, Strife, voidPoints, stance, conditions: [] }
  function current(m, key) {
    const lv = m.live || {};
    const v = complete(m.character || {});
    if (key === 'Void Points') return lv.voidPoints != null ? lv.voidPoints : (v['Void Points'] != null ? v['Void Points'] : derived(v).voidStart);
    if (lv[key] != null) return lv[key];
    return v[key] != null && v[key] !== '' ? v[key] : 0;
  }
  function conditions(m) {
    const v = complete(m.character || {});
    return conditionRules().filter((r) => current(m, r.over) > value(v, r.limit)).map((r) => r.state);
  }
  const tokenText = (m) => ['Strife ' + current(m, 'Strife'), 'Fatigue ' + current(m, 'Fatigue')].concat(conditions(m), ((m.live || {}).conditions || [])).join(' · ');
  const memberNow = (id, fallback) => (State().state.party || []).find((x) => x.id === id) || fallback;

  // Every change to a tracker is logged as an event: "Strife 2 → 5", and what caused it.
  const TRACKED = { Fatigue: 'Fatigue', Strife: 'Strife', voidPoints: 'Void points', Honor: 'Honor', Glory: 'Glory', Status: 'Status', xpEarned: 'XP earned', xpSpent: 'XP spent' };
  // `always`: log the cause even when no tracker moved (a Void point the rules grant at its maximum)
  function change(m, p, why, always) {
    const mm = memberNow(m.id, m);
    const lines = Object.keys(p).filter((k) => TRACKED[k]).map((k) => {
      const from = k === 'xpEarned' || k === 'xpSpent' ? xp(mm)[k === 'xpEarned' ? 'earned' : 'spent'] : current(mm, k === 'voidPoints' ? 'Void Points' : k);
      return from === p[k] ? null : TRACKED[k] + ' ' + from + ' → ' + p[k];
    }).filter(Boolean);
    State().commit('setPartyLive', [mm.id, p]);
    if (lines.length || (why && always)) State().commit('appendLog', [{ at: new Date().toISOString(), kind: 'event', who: mm.name, memberId: mm.id, text: lines.join(' · '), why: why || null }]);
  }
  const patch = (m, p, why) => change(m, p, why);
  // a Void point the rules grant, to the MAXIMUM the corpus prints
  function gainVoid(m, why) {
    const mm = memberNow(m.id, m);
    const max = derived(complete(mm.character || {})).voidMax;
    const from = current(mm, 'Void Points');
    const to = max == null ? from + 1 : Math.min(max, from + 1);
    change(mm, { voidPoints: to }, why + (to === from ? ' — Void points already at their maximum' : ''), true);
  }

  // ── the character's advantages and disadvantages, as the rules use them ──
  // Each name on the sheet resolved to its entity: its type is the subtype it EXTENDS
  // (Distinction, Passion, Adversity, Anxiety), its Ring the one the entry prints. A sheet that
  // prints both — "Haunting (Earth) — Adversity" — is read as printed: the ring is the
  // character's own, and differs between characters who share the entry.
  const TRAIT_LISTS = ['Advantages', 'Disadvantages'];
  const PRINTED = /^(.*?)\s*\((Air|Earth|Fire|Water|Void)\)\s*—\s*(Distinction|Passion|Adversity|Anxiety)$/;
  const bare = (n) => String(n).replace(/\s+\((?:[^()]*)\)$|\s+—.*$/, '');
  const namesOf = (n) => {
    const m = PRINTED.exec(String(n));
    return [String(n)].concat(m ? [m[1]] : [], [bare(n)]);
  };
  function traits(v) {
    const out = [];
    TRAIT_LISTS.forEach((k) => (v[k] || []).forEach((n) => {
      const name = String(n);
      const m = PRINTED.exec(name);
      const e = namesOf(name).map((x) => D.named(x)).find(Boolean) || null;
      out.push({ name: m ? m[1] : name, e, type: m ? m[3] : e ? e.type : null, ring: m ? m[2] : e ? D.text(e, 'Ring') : null });
    }));
    return out;
  }
  // the books the sheet's advantages come from, loaded so their types and rings are known
  function ensureTraits(v) {
    const books = [];
    TRAIT_LISTS.forEach((k) => (v[k] || []).forEach((n) => {
      const names = namesOf(n);
      if (names.some((x) => D.named(x))) return;
      names.forEach((x) => D.recordNamed(x).forEach((r) => !D.loaded(r.book) && books.indexOf(r.book) === -1 && books.push(r.book)));
    }));
    return books.length ? D.ensure(books).then(() => true) : Promise.resolve(false);
  }
  // A house rule may give a distinction fewer dice on a check of another ring: an instance's
  // MODIFY introduces this property on the distinction, and the reroll honours it.
  const OFF_APPROACH = 'Off-Approach Reroll Dice';
  const ringMark = (t) => (t.ring && t.name.indexOf('(' + t.ring + ')') === -1 ? ' (' + t.ring.toLowerCase() + ')' : '');
  function rerollModes(v, ring) {
    const out = [];
    traits(v).forEach((t) => {
      const kind = t.type === 'Distinction' ? 'distinction' : t.type === 'Adversity' ? 'adversity' : null;
      const rr = kind && Dice.rerollRule(kind);
      if (!rr) return;
      let dice = rr.dice;
      let text = rr.text;
      const off = t.ring && ring && t.ring !== ring ? D.modified(t.e, OFF_APPROACH) : undefined;
      if (typeof off === 'number') {
        dice = off;
        text += ' — on a check of another ring than ' + t.ring + ', ' + off + (off === 1 ? ' die' : ' dice') + ' (a house rule).';
      }
      out.push({ id: t.name, label: t.name + ringMark(t), kind, dice, text, prompt: kind === 'adversity' && !!t.ring && t.ring === ring });
    });
    return out;
  }
  // Passions and anxieties at the table, by the numbers their rules print: "Passion: After
  // resolving the check, the character removes 3 strife." (passion_remove_three_strife);
  // "Anxiety: After the check, the character receives 3 strife. The first time this occurs each
  // scene, they gain 1 Void point." (anxiety_effect). The scene is live.scene, which ending a
  // scene advances; the anxieties that have given their Void point this scene are live.claims.
  function strifeRule(slug) {
    const r = Dice.rule(slug);
    const m = r && r.text && /(\d+) strife/.exec(r.text);
    return m ? { n: parseInt(m[1], 10), text: r.text } : null;
  }
  function claimedThisScene(mm, name) {
    const c = (mm.live || {}).claims;
    return !!c && c.scene === ((mm.live || {}).scene || 0) && (c.names || []).indexOf(name) !== -1;
  }
  function useTrait(m, t) {
    const mm = memberNow(m.id, m);
    const from = current(mm, 'Strife');
    if (t.type === 'Passion') {
      const r = strifeRule('passion_remove_three_strife');
      change(mm, { Strife: Math.max(0, from - r.n) }, t.name + ' (passion)');
      return;
    }
    const r = strifeRule('anxiety_effect');
    change(mm, { Strife: from + r.n }, t.name + ' (anxiety)');
    const now = memberNow(m.id, mm);
    if (claimedThisScene(now, t.name)) return;
    const lv = now.live || {};
    const scene = lv.scene || 0;
    const names = lv.claims && lv.claims.scene === scene ? lv.claims.names.slice() : [];
    names.push(t.name);
    State().commit('setPartyLive', [now.id, { claims: { scene, names } }]);
    gainVoid(now, t.name + ' (anxiety): the first time this scene');
  }
  function traitButtons(m, v) {
    const list = traits(v).filter((t) => t.type === 'Passion' || t.type === 'Anxiety');
    if (!list.length) return null;
    return el('div', { class: 'chiprow tight traits-in-play' }, [el('span', { class: 'track-name' }, ['Passions, anxieties']), list.map((t) => {
      const r = strifeRule(t.type === 'Passion' ? 'passion_remove_three_strife' : 'anxiety_effect');
      if (!r) return null;
      const claimed = t.type === 'Anxiety' && claimedThisScene(m, t.name);
      return el('button', { class: 'btn ghost tiny trait ' + t.type.toLowerCase(), type: 'button', title: r.text + (claimed ? ' (Its Void point is already gained this scene.)' : ''), onclick: () => useTrait(m, t) },
        [el('span', { html: Dice.symbolsHtml(Dice.esc(t.name + ringMark(t))) }), el('span', { class: 'muted' }, [' ' + (t.type === 'Passion' ? '−' : '+') + r.n + ' strife' + (t.type === 'Anxiety' && !claimed ? ', +1 Void' : '')])]);
    })]);
  }

  function track(label, cur, max, onSet) {
    const n = Math.max(max || 0, cur || 0);
    return el('div', { class: 'track' }, [
      el('span', { class: 'track-name' }, [label]),
      el('span', { class: 'boxes' }, Array.from({ length: n }, (_, i) => el('span', { class: 'box' + (i < cur ? (i >= max ? ' on over' : ' on') : ''), title: String(i + 1), onclick: onSet ? () => onSet(i + 1 === cur ? i : i + 1) : null }))),
      el('span', { class: 'muted small track-v' }, [cur + ' / ' + (max == null ? '—' : max)]),
      onSet ? button('−', () => onSet(Math.max(0, cur - 1)), 'ghost tiny dec') : null,
      onSet ? button('+', () => onSet(cur + 1), 'ghost tiny inc') : null,
    ]);
  }

  // one roller per member, kept across redraws: a roll's own log entry redraws the panel
  const rollers = {};
  function rollerFor(m, v, compact) {
    if (rollers[m.id]) return rollers[m.id];
    const charOf = () => complete(memberNow(m.id, m).character || {});
    const r = Dice.roller({
      compact: !!compact,
      // compact: the skill is picked in the roller, and Void offered only while there is one to spend
      skills: compact ? () => ({ groups: skillGroups().map((g) => ({ name: g.name, skills: g.skills.map((k) => k.name) })), have: charOf().Skills || {} }) : null,
      voidAvailable: compact ? () => current(memberNow(m.id, m), 'Void Points') : null,
      defaultTn: compact ? 2 : null,   // the player's page starts each check at TN 2 (owner, Portents)
      preset: { ring: (m.live || {}).stance || 'Air', ringValue: v.Rings[(m.live || {}).stance || 'Air'], skill: null, skillRank: 0 },
      ringsOf: (ring) => charOf().Rings[ring],
      rerolls: (ring) => rerollModes(charOf(), ring),
      onConceal: () => gainVoid(m, 'The GM concealed the TN'),
      onAdversityFailed: (roll, a) => gainVoid(m, a.label + ' (adversity): the check failed'),
      extra: (roll, t) => checkExtras(m, roll, t),
      notes: (roll, t) => checkNotes(m, roll, t),
      opportunities: (roll) => opportunityList(m, roll),
      // "Void: You do not receive strife from (st) symbols on your kept dice." — Stance, RULES
      // void_stance_no_strife_from_strife_results
      strifeDefault: (t, roll) => (stanceOfCheck(m, roll) === 'Void' ? 0 : t.strife),
      onResolve: (roll) => {
        const mm = memberNow(m.id, m);
        const t = roll.resolved;
        const p = {};
        // "Strife (st) … tracks toward Compromised condition" — the strife received is added
        if (roll.strife) p.Strife = current(mm, 'Strife') + roll.strife;
        // Seize the Moment: "spend 1 Void point"
        if (roll.opts.void) p.voidPoints = Math.max(0, current(mm, 'Void Points') - Dice.SEIZE_THE_MOMENT.cost);
        p.stance = roll.opts.ring;
        const entry = Object.assign(Dice.logEntry(roll, mm.name), { memberId: mm.id });
        State().commit('appendLog', [entry]);
        change(mm, p, 'the check: ' + entry.what);
        // an Initiative check sets the character's initiative for the conflict (initiative_values)
        const tag = roll.opts.tag || {};
        if (tag.kind === 'initiative' && t.success != null && conflictOf(memberNow(m.id, m))) {
          const vv = complete(memberNow(m.id, m).character || {});
          const base = tag.surprised ? value(vv, 'Vigilance') : value(vv, 'Focus');
          setConflict(m, { initiative: base + (t.success ? 1 + t.bonus : 0) }, 'Initiative ' + (base + (t.success ? 1 + t.bonus : 0)));
        }
        // "After failing a check on which one of their adversities was resolved" — Void Points, RECOVERY
        if (t.success === false) roll.applied.filter((a) => a.kind === 'adversity').forEach((a) => { a.claimed = true; gainVoid(mm, a.label + ' (adversity): the check failed'); });
      },
    });
    rollers[m.id] = r;
    return r;
  }

  // ── techniques in play ──
  // A technique's button is read from its ACTIVATION text, never typed: the action it takes
  // ("As an Attack and Support action"), the check it makes ("make a TN 1 Martial Arts [Unarmed]
  // (Fire) check") and how often ("Once per game session"). A text that names no check of a known
  // skill gets no button — its name still links to the book.
  const RINGS_IN = /\(((?:Air|Earth|Fire|Water|Void)(?:(?:,? or |, )(?:Air|Earth|Fire|Water|Void))*)\)/g;
  // "you may make a … check" is an activation; "When you make a … check, you may spend (op)" is a
  // rider on some other check (M4d's opportunities), and gets no button
  const CHECK_RE = /\bmay make an? (?:TN (\d+) )?([^.;:]{1,120}?) check\b/;
  const ACTION_RE = /\b[Aa]s (?:an? ((?:Attack|Movement|Scheme|Support|Intrigue|Initiative)(?:(?:,? and |,? or |, )(?:Attack|Movement|Scheme|Support|Intrigue|Initiative))*) action|(an action)|(a downtime activity))/;
  const LIMIT_RE = /\b[Oo]nce per (scene|game session)\b/;
  const plain = (s) => String(s || '').replace(/\^"([^"]*)"/g, '$1');
  // the skills a check names: one ("Meditation"), a choice ("Courtesy or Performance"), a bracketed
  // choice ("Martial Arts [Melee, Ranged, or Unarmed]"), Martial Arts unqualified (the three), or a
  // skill group ("a Social skill (Air) check") — every one a skill the core prints, or no reading
  function checkSkills(words) {
    const known = skills();
    const groups = skillGroups();
    const ma = known.filter((k) => /^Martial Arts \[/.test(k.name)).map((k) => k.name);
    const rest = words.replace(RINGS_IN, ' ').replace(/\bskill\b/g, ' ')
      .replace(/Martial Arts \[([^\]]+)\]/g, (x, inner) => inner.split(/,? or |, /).map((q) => 'Martial Arts [' + q.trim() + ']').join(' | '));
    const out = [];
    for (const tok of rest.split(/\s*(?:,? or |, |\|)\s*/).map((x) => x.trim()).filter(Boolean)) {
      if (known.some((k) => k.name === tok)) out.push(tok);
      else if (tok === 'Martial Arts') out.push.apply(out, ma);
      else {
        const g = groups.find((x) => x.name === tok);
        if (!g) return null;
        out.push.apply(out, g.skills.map((k) => k.name));
      }
    }
    return out.length ? out.filter((x, i) => out.indexOf(x) === i) : null;
  }
  function activation(e) {
    const text = plain(D.kwArg(e, 'ACTIVATION'));
    if (!text) return null;
    const c = CHECK_RE.exec(text);
    const sk = c && checkSkills(c[2]);
    if (!sk) return null;
    const rings = [];
    (c[2].match(RINGS_IN) || []).forEach((g) => g.slice(1, -1).split(/,? or |, /).forEach((r) => rings.indexOf(r) === -1 && rings.push(r)));
    const a = ACTION_RE.exec(text);
    const l = LIMIT_RE.exec(text);
    return { text, tn: c[1] ? parseInt(c[1], 10) : null, skills: sk, skill: sk.length === 1 ? sk[0] : null, rings,
      action: a ? (a[1] ? a[1] + ' action' : a[2] ? 'an action' : 'a downtime activity') : null, limit: l ? l[1] : null };
  }
  const techniqueCategory = (e) => { const r = D.records().find((x) => x.id === e.id); return r ? D.techniqueInfo(r).category : null; };
  // uses of a limited technique, counted against the scene and the session they fall in (live.scene
  // and live.session, which End scene and End session advance)
  function usesOf(m, name, limit) {
    const lv = m.live || {};
    const key = limit === 'scene' ? 'scene' : 'session';
    const u = (lv.uses || {})[key];
    return u && u.seq === (lv[key] || 0) ? (u.n || {})[name] || 0 : 0;
  }
  function countUse(m, name, limit) {
    const mm = memberNow(m.id, m);
    const lv = mm.live || {};
    const key = limit === 'scene' ? 'scene' : 'session';
    const seq = lv[key] || 0;
    const uses = Object.assign({}, lv.uses || {});
    const cur = uses[key] && uses[key].seq === seq ? Object.assign({}, uses[key].n) : {};
    cur[name] = (cur[name] || 0) + 1;
    uses[key] = { seq, n: cur };
    State().commit('setPartyLive', [mm.id, { uses }]);
    State().commit('appendLog', [{ at: new Date().toISOString(), kind: 'event', who: mm.name, memberId: mm.id, text: name + ' — used (' + cur[name] + ' of 1 this ' + (key === 'scene' ? 'scene' : 'session') + ')', why: 'technique' }]);
  }
  // the player's page: which technique cards are open, kept across the page's redraws
  const techOpen = {};
  function techniquesBlock(m, v, roller, compact) {
    const rows = (v.Techniques || []).map((n) => {
      const e = D.named(String(n)) || D.named(bare(n));
      const a = e && activation(e);
      if (!a) return null;
      const used = a.limit ? usesOf(m, e.name, a.limit) : 0;
      const spent = a.limit && used >= 1;
      const cat = techniqueCategory(e);
      const setUp = (skill) => {
        const ring = a.rings.length === 1 ? a.rings[0] : null;
        const patch = { skill, skillRank: skill ? (v.Skills || {})[skill] || 0 : 0, tn: a.tn, source: e.name, sourceId: e.id, sourceType: cat };
        if (ring) Object.assign(patch, { ring, ringValue: (v.Rings || {})[ring] });
        roller.set(patch);
      };
      const meta = [a.action, (a.tn != null ? 'TN ' + a.tn : 'TN as its text says') + (a.skill ? ' ' + a.skill : '') + (a.rings.length ? ' (' + a.rings.join(' or ') + ')' : ''), a.limit ? 'once per ' + a.limit + (used ? ' — used' : '') : null, cat].filter(Boolean).join(' · ');
      // compact: a card — tapped, it opens to the technique as the book prints it, with the check to roll
      if (compact) {
        const key = m.id + '|' + e.name;
        const body = el('div', { class: 'tech-body' });
        const fill = () => { if (!body.firstChild) body.appendChild(E.render(e, { bare: true })); };
        const go = (skill) => { setUp(skill); if (a.limit && skill) countUse(m, e.name, a.limit); };
        const card = el('details', { class: 'tech-row tech-card', open: techOpen[key] || null }, [
          el('summary', {}, [el('span', { class: 'tech-name' }, [e.name]), el('span', { class: 'muted small' }, [meta])]),
          body,
          el('div', { class: 'chiprow tight tech-roll' }, spent ? [el('span', { class: 'muted small' }, ['Used this ' + (a.limit === 'scene' ? 'scene' : 'session') + '.'])]
            : a.skills.length > 1 ? a.skills.map((k) => button('Roll with ' + k, () => go(k), 'btn'))
            : [button('Roll', () => go(a.skill), 'btn')]),
        ]);
        if (techOpen[key]) fill();
        card.addEventListener('toggle', () => { techOpen[key] = card.open; if (card.open) fill(); });
        return card;
      }
      return el('div', { class: 'tech-row' }, [
        // the use is counted when the check is set up with its skill: at once for one skill, or when
        // the player picks one of several
        el('button', { class: 'btn ghost tiny', type: 'button', disabled: spent || null, title: a.text + (spent ? ' — already used this ' + (a.limit === 'scene' ? 'scene' : 'session') : ''), onclick: () => {
          setUp(a.skill);
          if (a.limit && a.skill) countUse(m, e.name, a.limit);
          roller.scrollIntoView({ block: 'center' });
        } }, [e.name]),
        a.skills.length > 1 ? el('span', { class: 'chiprow tight' }, [el('span', { class: 'muted small' }, ['with']), a.skills.map((k) => el('button', { class: 'ref tiny', type: 'button', disabled: spent || null, title: 'Set up ' + e.name + ' with ' + k, onclick: () => {
          setUp(k);
          if (a.limit) countUse(m, e.name, a.limit);
        } }, [k]))]) : null,
        el('span', { class: 'muted small' }, [meta]),
      ]);
    }).filter(Boolean);
    return rows.length ? el('div', { class: 'techniques-in-play' }, [el('span', { class: 'track-name' }, ['Techniques']), rows]) : null;
  }

  // ── conflict: types, stances, initiative, actions, engagement (Portents M4d) ──
  // Everything here is the corpus's: the Conflict Type entities (Intrigue, Duel, Skirmish, Mass
  // Battle) and the actions in each one's ACTIONS; the Stance rules (Table 6–1), each "Ring: …";
  // Initiative's "Skirmish: TN 1 Tactics check." (initiative_checks) and its values
  // (initiative_values: focus if ready, vigilance if unprepared, then on a success +1 and the bonus
  // successes). A character's conflict is live.conflict = { type, surprised, initiative, engaged }.
  const conflictTypes = () => D.all(['core']).filter((e) => e.type === 'Conflict Type');
  const conflictOf = (m) => (m.live || {}).conflict || null;
  function stanceRules() {
    const s = D.named('Stance', 'core');
    const out = {};
    ((s && s.rules) || []).forEach((r) => { const x = E.ruleText(r.text); const mm = x && /^(Air|Earth|Fire|Water|Void): /.exec(x); if (mm) out[mm[1]] = x; });
    return out;
  }
  function initiativeCheck(type) {
    const r = Dice.rule('initiative_checks');
    const mm = r && r.text && new RegExp('(?:^|\\n)' + type + ': TN (\\d+) ([A-Z][A-Za-z ]+?) check').exec(r.text);
    return mm ? { tn: parseInt(mm[1], 10), skill: mm[2] } : null;
  }
  function conflictActions(type) {
    const e = D.named(type, 'core');
    const b = e && D.block(e, 'ACTIONS');
    return b ? (b.body || []).filter((x) => x.ent).map((x) => D.entity(x.ent)).filter(Boolean) : [];
  }
  const logEvent = (mm, text, why) => State().commit('appendLog', [{ at: new Date().toISOString(), kind: 'event', who: mm.name, memberId: mm.id, text, why: why || null }]);
  function setConflict(m, patch, text) {
    const mm = memberNow(m.id, m);
    const cur = conflictOf(mm);
    State().commit('setPartyLive', [mm.id, { conflict: patch === null ? null : Object.assign({}, cur || {}, patch) }]);
    if (text) logEvent(mm, text, 'conflict');
  }
  function setStance(m, ring, roller) {
    const mm = memberNow(m.id, m);
    if ((mm.live || {}).stance === ring) return;
    State().commit('setPartyLive', [mm.id, { stance: ring }]);
    logEvent(mm, 'Stance: ' + ring, 'conflict');
    // "determining which ring a character uses for the action they perform … and for any other
    //  checks they make while in that stance" — Stance, RULES set_stance
    roller.set({ ring, ringValue: complete(mm.character || {}).Rings[ring] });
  }

  // ── gear: the readied weapon, its grip, the armor worn ──
  // The corpus's weapons (the children of ^"Weapon", and its UNARMED profiles) and armor, matched
  // by name to the sheet's Equipment; the readied weapon's Skill is Strike's ("using the appropriate
  // skill for the weapon"); a grip's "Damage +2" adds to its base damage.
  const kids = (name) => { const e = D.named(name, 'core'); return e ? D.children(e.id) : []; };
  const unarmed = () => { const w = D.named('Weapon', 'core'); const b = w && D.block(w, 'UNARMED'); return b ? (b.body || []).filter((x) => x.ent).map((x) => D.entity(x.ent)).filter(Boolean) : []; };
  const norm = (s) => String(s || '').toLowerCase();
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // a corpus item the sheet's Equipment names, as a word ("daishō (katana and wakizashi)")
  function carried(v, list) {
    const eq = (v.Equipment || []).map(String);
    return list.filter((e) => { const re = new RegExp('(^|[^\\p{L}])' + esc(e.name) + '($|[^\\p{L}])', 'iu'); return eq.some((x) => re.test(x)); });
  }
  // a weapon the sheet prints with its own profile ("Talwar: Damage 4/6, Range 1, Cumbersome, …"),
  // damage / deadliness as printed; its skill is not printed, so the player chooses it
  const PRINTED_WEAPON = /^([^:]+):\s*Damage (\d+)\/(\d+),\s*Range ([^,]+)(?:,\s*(.*))?$/;
  function printedWeapons(v) {
    return (v.Equipment || []).map((x) => PRINTED_WEAPON.exec(String(x).trim())).filter(Boolean).map((mm) => ({ name: mm[1].trim(), base: parseInt(mm[2], 10), deadliness: parseInt(mm[3], 10), range: mm[4].trim(), qualities: mm[5] || '', printed: true }));
  }
  const fromEntityW = (e) => ({ name: e.name, e, skill: D.text(e, 'Skill'), base: D.num(e, 'Base Damage'), deadliness: D.num(e, 'Deadliness'), range: D.text(e, 'Range') });
  function weaponsFor(v) {
    const un = unarmed().map((e) => Object.assign(fromEntityW(e), { unarmed: true }));
    const unNames = un.map((w) => norm(w.name));
    const all = carried(v, kids('Weapon').filter((e) => D.text(e, 'Skill') && unNames.indexOf(norm(e.name)) === -1)).map(fromEntityW).concat(printedWeapons(v).filter((w) => unNames.indexOf(norm(w.name)) === -1), un);
    return all.filter((w, i) => all.findIndex((x) => norm(x.name) === norm(w.name)) === i);   // the sheet's own profile before the book's unarmed one
  }
  const armorFor = (v) => carried(v, kids('Armor'));
  function grips(e) {
    const g = e && D.text(e, 'Grips');
    return g ? g.split(/;\s*/).map((x) => { const mm = /^([^:]+):\s*(.*)$/.exec(x.trim()); return mm ? { name: mm[1].trim(), text: mm[2].trim(), damage: parseInt((/Damage \+(\d+)/.exec(mm[2]) || [0, 0])[1], 10), deadliness: parseInt((/Deadliness \+(\d+)/.exec(mm[2]) || [0, 0])[1], 10) } : null; }).filter(Boolean) : [];
  }
  const MARTIAL = () => skills().filter((k) => /^Martial Arts \[/.test(k.name)).map((k) => k.name);
  // A carried weapon is sheathed or readied — "A weapon is considered sheathed if it is on a
  // character's person, properly stowed for access but not yet readied for use" (sheathed_weapons);
  // "they may choose to ready any number of weapons … that they can hold at once. For most
  // characters, the maximum is one pair of 1-handed grip weapons (one in each hand) or a single
  // 2-handed grip weapon … When a character readies a weapon, they must choose one of its grips"
  // (readied_weapons). live.equip = { weapons: { [name]: { state, grip, skill } }, strikeWith, armor }.
  // The unarmed profiles are always readied (unarmed_profiles), and hold no weapon hand.
  const HANDS = 2;
  const handsOf = (grip) => { const mm = /^(\d)-hand/.exec(grip || ''); return mm ? parseInt(mm[1], 10) : 1; };
  // a printed profile prints no grips: the player says how it is held
  const gripsOf = (w) => (w.e ? grips(w.e) : []).concat(w.e && grips(w.e).length ? [] : [{ name: '1-hand', text: 'as held', damage: 0, deadliness: 0 }, { name: '2-hand', text: 'as held', damage: 0, deadliness: 0 }]);
  function equipOf(m) {
    const eq = Object.assign({ weapons: {} }, (m.live || {}).equip || {});
    if (eq.weapon && !eq.weapons[eq.weapon]) eq.weapons = Object.assign({}, eq.weapons, { [eq.weapon]: { state: 'readied', grip: eq.grip, skill: eq.skill } });   // M4d's single readied weapon
    return eq;
  }
  function readiedList(m) {
    const eq = equipOf(m);
    const v = complete(m.character || {});
    return weaponsFor(v).filter((w) => !w.unarmed && (eq.weapons[w.name] || {}).state === 'readied').map((w) => {
      const st = eq.weapons[w.name];
      const gs = gripsOf(w);
      const g = gs.find((x) => x.name === st.grip) || gs[0] || null;
      return Object.assign({}, w, { skill: w.skill || st.skill || null, grip: g, hands: handsOf(g && g.name) });
    });
  }
  const handsUsed = (m) => readiedList(m).reduce((a, w) => a + w.hands, 0);
  // the weapon a Strike uses: the one chosen among the readied (or an unarmed profile), else the first readied
  function readied(m) {
    const eq = equipOf(m);
    const list = readiedList(m);
    const un = unarmed().map(fromEntityW).map((w) => Object.assign(w, { unarmed: true, grip: null, hands: 0 }));
    return list.find((w) => w.name === eq.strikeWith) || un.find((w) => w.name === eq.strikeWith) || list[0] || null;
  }
  function setEquip(m, patch, text) {
    const mm = memberNow(m.id, m);
    const eq = equipOf(mm);
    delete eq.weapon; delete eq.grip; delete eq.skill;
    State().commit('setPartyLive', [mm.id, { equip: Object.assign(eq, patch) }]);
    if (text) logEvent(mm, text, 'gear');
  }
  function setWeapon(m, name, patch, text) {
    const eq = equipOf(memberNow(m.id, m));
    setEquip(m, { weapons: Object.assign({}, eq.weapons, { [name]: Object.assign({}, eq.weapons[name] || { state: 'sheathed' }, patch) }) }, text);
  }
  function gearBlock(m, v, compact) {
    const eq = equipOf(m);
    const used = handsUsed(m);
    const carriedWs = weaponsFor(v).filter((w) => !w.unarmed);
    const strike = readied(m);
    const note = el('span', { class: 'muted small gear-note' });
    const rows = carriedWs.map((w) => {
      const st = eq.weapons[w.name] || { state: 'sheathed' };
      const isReady = st.state === 'readied';
      const gs = gripsOf(w);
      const g = gs.find((x) => x.name === st.grip) || gs[0];
      const fit = (grip) => used - (isReady ? handsOf(g && g.name) : 0) + handsOf(grip) <= HANDS;
      const ready = () => {
        const first = gs.find((x) => fit(x.name));
        if (!first) { note.textContent = 'Ready ' + w.name + ': no hand is free — sheathe something first (' + used + ' of ' + HANDS + ' hands in use).'; return; }
        setWeapon(m, w.name, { state: 'readied', grip: first.name }, 'Readies the ' + w.name + ' (' + first.name + ')');
      };
      const gsel = isReady && gs.length > 1 ? el('select', { class: 'scope tiny', title: 'Grip — how many hands it is held in' }, gs.map((x) => el('option', { value: x.name, selected: (g && g.name === x.name) || null, disabled: fit(x.name) ? null : true }, [x.name + (x.text && x.text !== '–' ? ': ' + x.text : '')]))) : null;
      if (gsel) gsel.addEventListener('change', () => setWeapon(m, w.name, { grip: gsel.value }, 'Grips the ' + w.name + ' ' + gsel.value));
      const ssel = w.printed ? el('select', { class: 'scope tiny', title: 'The skill this weapon uses (the sheet does not print it)' }, [el('option', { value: '' }, ['— its skill —'])].concat(MARTIAL().map((k) => el('option', { value: k, selected: st.skill === k || null }, [k])))) : null;
      if (ssel) ssel.addEventListener('change', () => setWeapon(m, w.name, { skill: ssel.value || null }, w.name + ': ' + (ssel.value || 'no skill')));
      const dmg = w.base + (isReady && g ? g.damage : 0), dead = w.deadliness + (isReady && g ? g.deadliness : 0);
      return el('div', { class: 'weapon-row' + (isReady ? ' readied' : '') }, [
        el('b', {}, [w.name]),
        el('span', { class: 'chiprow tight' }, [
          el('button', { class: 'ref tiny' + (!isReady ? ' on' : ''), type: 'button', title: 'On the person, stowed for access but not readied', onclick: () => { if (isReady) setWeapon(m, w.name, { state: 'sheathed' }, 'Sheathes the ' + w.name); } }, ['equipped (sheathed)']),
          el('button', { class: 'ref tiny' + (isReady ? ' on' : ''), type: 'button', title: 'In hand, held with one of its grips', onclick: () => { if (!isReady) ready(); } }, ['readied']),
        ]),
        gsel, isReady && gs.length === 1 ? el('span', { class: 'small' }, [gs[0].name]) : null, ssel,
        el('span', { class: 'muted small' }, [[w.skill || (w.printed ? 'skill as chosen' : null), 'range ' + w.range, 'damage ' + dmg, 'deadliness ' + dead].filter(Boolean).join(' · ')]),
        isReady && readiedList(m).length > 1 ? (compact ? el('button', { class: 'toggle' + (strike && strike.name === w.name ? ' on' : ''), type: 'button', onclick: () => setEquip(m, { strikeWith: w.name }, 'Strikes with the ' + w.name) }, ['Strike with it'])
          : el('label', { class: 'small' }, [el('input', { type: 'radio', name: 'strike-' + m.id, checked: (strike && strike.name === w.name) || null, onchange: () => setEquip(m, { strikeWith: w.name }, 'Strikes with the ' + w.name) }), ' Strike with it'])) : null,
      ]);
    });
    const as = armorFor(v);
    const asel = el('select', { class: 'scope tiny', title: 'The armor worn' }, [el('option', { value: '' }, ['— no armor —'])].concat(as.map((e) => el('option', { value: e.name, selected: eq.armor === e.name || null }, [e.name]))));
    asel.addEventListener('change', () => setEquip(m, { armor: asel.value || null }, asel.value ? 'Wears ' + asel.value : 'Wears no armor'));
    const ae = eq.armor ? D.named(eq.armor, 'core') : null;
    const un = unarmed();
    return el('div', { class: 'gear' }, [
      el('div', { class: 'chiprow tight' }, [el('span', { class: 'track-name' }, ['Weapons']), el('span', { class: 'muted small' }, [used + ' of ' + HANDS + ' hands in use']), note]),
      rows.length ? rows : el('div', { class: 'muted small' }, ['No weapon on the sheet that the corpus names.']),
      un.length && compact ? el('div', { class: 'weapon-row unarmed' }, [el('span', { class: 'step-k' }, ['Unarmed']), un.map((e) => el('button', { class: 'toggle' + (strike && strike.name === e.name ? ' on' : ''), type: 'button', onclick: () => setEquip(m, { strikeWith: e.name }, 'Strikes with a ' + e.name.toLowerCase()) }, [e.name + ' ' + D.num(e, 'Base Damage') + '/' + D.num(e, 'Deadliness')]))])
      : un.length ? el('div', { class: 'weapon-row' }, [el('span', { class: 'muted small' }, ['Unarmed, always readied: ']), un.map((e) => el('label', { class: 'small' }, [el('input', { type: 'radio', name: 'strike-' + m.id, checked: (strike && strike.name === e.name) || null, onchange: () => setEquip(m, { strikeWith: e.name }, 'Strikes with a ' + e.name.toLowerCase()) }), ' ' + e.name + ' (' + D.num(e, 'Base Damage') + '/' + D.num(e, 'Deadliness') + ')  ']))]) : null,
      el('div', { class: 'chiprow tight' }, [el('span', { class: 'track-name' }, ['Armor']), asel,
        ae ? el('span', { class: 'muted small' }, ['resistance: physical ' + (D.num(ae, 'Physical Resistance') || 0) + (D.num(ae, 'Supernatural Resistance') != null ? ' · supernatural ' + D.num(ae, 'Supernatural Resistance') : '')]) : null]),
    ]);
  }

  // ── critical strikes ──
  // "they must make a TN 1 Fitness check to mitigate its effects (using a ring of their choice in a
  //  narrative scene, or the ring their stance dictates in a conflict scene). If the character
  //  succeeds, they reduce the severity by 1 plus their bonus successes … Then, consult Table 6–6"
  //  — Critical Strike, RULES check_to_resist_critical_strike; the table is its SEVERITY_TABLE.
  function severityRow(n) {
    const cs = D.named('Critical Strike', 'core');
    const b = cs && D.block(cs, 'SEVERITY_TABLE');
    const rows = b ? (b.body || []) : [];
    const row = rows.find((r) => { const mm = /^(\d+)\s*[-–]\s*(\d+)$/.exec(String(r.s || '')); const pl = /^(\d+)\+$/.exec(String(r.s || '')); return mm ? n >= +mm[1] && n <= +mm[2] : pl ? n >= +pl[1] : false; });
    if (!row) return null;
    const kw = (k) => { const x = (row.body || []).find((y) => y.kw === k); return x && x.args[0] ? plain(x.args[0].s) : ''; };
    return { range: row.s, description: kw('DESCRIPTION'), effect: kw('EFFECT') };
  }
  function resistCheck() {
    const r = Dice.rule('check_to_resist_critical_strike');
    const mm = r && r.text && /TN (\d+) ([A-Z][A-Za-z]+) check/.exec(r.text);
    return mm ? { tn: parseInt(mm[1], 10), skill: mm[2] } : null;
  }

  // ── what a check's (op) may buy ──
  // Opportunity (core-base): GENERAL (any ring, then the check's ring), the skill group's by ring,
  // CONFLICT in a conflict or on a Martial check, INITIATIVE on an Initiative check, DOWNTIME on a
  // downtime activity; then the (op) of the technique or action the check came from, and of the
  // character's techniques that ride on a check of this skill and ring ("When you make a Martial
  // Arts [Melee, Ranged, or Unarmed] (Earth) check, you may spend (op) …").
  // a block's strings, whether it prints them as its arguments (`NEW_OPPORTUNITIES "…"`) or in its body
  const blockLines = (b) => (b ? (b.args || []).map((a) => a.s).concat((b.body || []).map((x) => (x.s != null ? x.s : x.args && x.args[0] && x.args[0].s))).filter(Boolean).map(plain) : []);
  function opportunityList(m, roll) {
    const o = roll.opts || {};
    const RING = String(o.ring || '').toUpperCase();
    const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();
    const out = [];
    const opE = D.named('Opportunity', 'core');
    const ringGroup = (kw) => { const b = opE && D.block(opE, kw); return b ? (b.body || []).find((g) => g.kw === RING) : null; };
    const add = (label, lines) => lines.forEach((text) => out.push({ group: label, text }));
    if (opE) {
      const g = D.block(opE, 'GENERAL_OPPORTUNITIES');
      add('General', blockLines(g && (g.body || []).find((x) => x.kw === 'ANY')));
      add('General · ' + cap(RING), blockLines(ringGroup('GENERAL_OPPORTUNITIES')));
      const sk = skills().find((k) => k.name === o.skill);
      const grp = sk ? String(sk.group).replace(/\s*Skills?$/, '') : null;
      const sg = ringGroup('SKILL_OPPORTUNITIES');
      if (grp && sg) add(grp + ' · ' + cap(RING), (sg.body || []).filter((x) => x.kw === grp.toUpperCase()).map((x) => plain(x.args[0].s)));
      const tag = o.tag || {};
      if (conflictOf(memberNow(m.id, m)) || grp === 'Martial') add('Conflict · ' + cap(RING), blockLines(ringGroup('CONFLICT_OPPORTUNITIES')));
      if (tag.kind === 'initiative') add('Initiative · ' + cap(RING), blockLines(ringGroup('INITIATIVE_OPPORTUNITIES')));
      if (tag.kind === 'downtime') add('Downtime · ' + cap(RING), blockLines(ringGroup('DOWNTIME_OPPORTUNITIES')));
    }
    const src = o.sourceId && D.entity(o.sourceId);
    if (src) ['OPPORTUNITIES', 'NEW_OPPORTUNITIES'].forEach((kw) => add(src.name, blockLines(D.block(src, kw))));
    const v = complete(memberNow(m.id, m).character || {});
    (v.Techniques || []).forEach((n) => {
      const e = D.named(String(n)) || D.named(bare(n));
      if (!e || (src && e.id === src.id)) return;
      const act = plain(D.kwArg(e, 'ACTIVATION'));
      const mm = /^When (?:you make|making|you perform) an? (.+?) check/i.exec(act || '');
      if (!mm) return;
      const phrase = mm[1].replace(/\s+(?:Attack|Scheme|Support|Movement)(?: action)?$/, '');
      const sks = checkSkills(phrase);
      const rings = [];
      (phrase.match(RINGS_IN) || []).forEach((g) => g.slice(1, -1).split(/,? or |, /).forEach((r) => rings.push(r)));
      if (!sks || sks.indexOf(o.skill) === -1 || (rings.length && rings.indexOf(o.ring) === -1)) return;
      add(e.name, blockLines(D.block(e, 'OPPORTUNITIES')));
    });
    return out;
  }

  // the stance's own effect on a check in a conflict: Fire and Void (the others act on other
  // characters' checks, and are shown with the stance)
  function stanceOfCheck(m, roll) {
    const c = conflictOf(memberNow(m.id, m));
    return c && !(roll.opts.tag && roll.opts.tag.kind === 'initiative') ? roll.opts.ring : null;
  }
  // notes a check leaves: Strike's damage, the initiative value, a critical strike's severity
  function checkNotes(m, roll, t) {
    const o = roll.opts || {};
    const tag = o.tag || {};
    const mm = memberNow(m.id, m);
    const v = complete(mm.character || {});
    const out = [];
    if (stanceOfCheck(m, roll) === 'Void' && t.strife) out.push('Void stance: no strife from the (st) kept (' + t.strife + ')');
    if (tag.kind === 'strike') {
      const w = readied(mm);
      if (!w) out.push('Strike: no weapon readied — ready one under Weapons, or choose an unarmed profile');
      else if (t.success === true) {
        const g = w.grip ? w.grip.damage : 0;
        out.push('Strike with the ' + w.name + (w.grip ? ' (' + w.grip.name + ')' : '') + ': ' + (w.base + g + t.bonus) + ' physical damage (base ' + w.base + (g ? ' + ' + g + ' ' + w.grip.name : '') + ' + ' + t.bonus + ' bonus success' + (t.bonus === 1 ? '' : 'es') + '); (op) (op): a critical strike, severity ' + (w.deadliness + (w.grip ? w.grip.deadliness : 0)) + ' (deadliness)');
      } else if (t.success === false) out.push('Strike with the ' + w.name + ': no damage');
    }
    if (tag.kind === 'initiative') {
      const base = tag.surprised ? value(v, 'Vigilance') : value(v, 'Focus');
      if (t.success != null) out.push('Initiative ' + (base + (t.success ? 1 + t.bonus : 0)) + ' (' + (tag.surprised ? 'vigilance' : 'focus') + ' ' + base + (t.success ? ' + 1 + ' + t.bonus + ' bonus' : '') + ')');
    }
    if (tag.kind === 'crit' && t.success != null) {
      const n = Math.max(0, tag.severity - (t.success ? 1 + t.bonus : 0));
      const row = severityRow(n);
      out.push('Critical strike: severity ' + tag.severity + (n !== tag.severity ? ' → ' + n : '') + (row ? ' — ' + row.description + ' ' + row.effect : ''));
    }
    return out;
  }

  function conflictBlock(m, v, roller, compact) {
    const c = conflictOf(m);
    const lv = m.live || {};
    if (!c && compact) {
      const enter = el('select', { class: 'scope', 'aria-label': 'Enter a conflict' }, [el('option', { value: '' }, ['Enter a conflict…'])].concat(conflictTypes().map((e) => el('option', { value: e.name }, [e.name]))));
      enter.addEventListener('change', () => { if (enter.value) setConflict(m, { type: enter.value, initiative: null, engaged: [] }, 'Enters a conflict: ' + enter.value); });
      return el('div', { class: 'conflict chiprow tight compact' }, [enter, button('Resist a critical…', () => resistCrit(m, v, roller), 'ghost tiny')]);
    }
    if (!c) return el('div', { class: 'conflict chiprow tight' }, [el('span', { class: 'track-name' }, ['Conflict']), conflictTypes().map((e) => button(e.name, () => setConflict(m, { type: e.name, initiative: null, engaged: [] }, 'Enters a conflict: ' + e.name), 'ghost tiny')),
      button('Resist a critical strike…', () => resistCrit(m, v, roller), 'ghost tiny')]);
    const rules = stanceRules();
    const ini = initiativeCheck(c.type);
    const surprised = el('input', { type: 'checkbox', checked: c.surprised || null, onchange: (ev) => setConflict(m, { surprised: ev.target.checked }, null) });
    const w = readied(m);
    const Sys = window.VttSystem;
    const sid = Sys && Sys.currentSceneId ? Sys.currentSceneId() : null;
    const castHere = sid && Sys.cast ? Sys.cast(sid) : [];
    const engaged = (c.engaged || []).map((id) => D.entity(id) || castHere.find((e) => e.id === id)).filter(Boolean);
    const npcConds = ((State().state || {}).npcConditions) || {};
    const defs = conditionDefs();
    const pick = el('select', { class: 'scope tiny', title: 'An NPC in this scene the character is engaged with' }, [el('option', { value: '' }, [castHere.length ? 'engage an NPC in this scene…' : 'no NPC in this scene'])].concat(castHere.filter((e) => (c.engaged || []).indexOf(e.id) === -1).map((e) => el('option', { value: e.id }, [e.name]))));
    pick.addEventListener('change', () => { if (pick.value) setConflict(m, { engaged: (c.engaged || []).concat([pick.value]) }, 'Engages ' + (castHere.find((e) => e.id === pick.value) || {}).name); });
    return el('div', { class: 'conflict' }, [
      el('div', { class: 'chiprow tight' }, [el('span', { class: 'track-name' }, ['Conflict']), el('b', {}, [c.type]), c.initiative != null ? el('span', { class: 'muted small' }, ['initiative ' + c.initiative]) : null,
        button('End conflict', () => setConflict(m, null, 'The ' + c.type.toLowerCase() + ' ends'), 'ghost tiny'), button('Resist a critical strike…', () => resistCrit(m, v, roller), 'ghost tiny')]),
      el('div', { class: 'chiprow tight' }, [el('span', { class: 'track-name' }, ['Stance']), RINGS.map((r) => el('button', { class: 'ring-btn' + (lv.stance === r ? ' on' : ''), type: 'button', title: rules[r] || r, onclick: () => setStance(m, r, roller) }, [Dice.ringIcon(r), el('span', {}, [r])]))]),
      lv.stance && rules[lv.stance] ? el('div', { class: 'muted small stance-rule' }, [E.span(rules[lv.stance], 'core')]) : null,
      ini ? el('div', { class: 'chiprow tight' }, [button('Initiative: TN ' + ini.tn + ' ' + ini.skill, () => roller.set({ skill: ini.skill, skillRank: (v.Skills || {})[ini.skill] || 0, tn: ini.tn, source: 'Initiative (' + c.type + ')', tag: { kind: 'initiative', surprised: !!c.surprised } }), 'ghost tiny'), el('label', { class: 'small' }, [surprised, ' unprepared (surprised)'])]) : null,
      el('div', { class: 'chiprow tight actions' }, [el('span', { class: 'track-name' }, ['Actions']), conflictActions(c.type).map((e) => {
        const act = plain(D.kwArg(e, 'ACTIVATION'));
        const eff = blockLines(D.block(e, 'EFFECTS'));
        const b = button(e.name, () => {
          const mm = memberNow(m.id, m);
          logEvent(mm, 'Declares ' + e.name + (act ? ' — ' + act.split('. ')[0] : ''), 'action');
          const a = activation(e);
          if (!a) return;
          const skill = e.name === 'Strike' && w && w.skill ? w.skill : a.skill || a.skills[0];
          const patch = { skill, skillRank: (v.Skills || {})[skill] || 0, tn: a.tn, source: e.name, sourceId: e.id, sourceType: c.type + ' action', tag: e.name === 'Strike' ? { kind: 'strike' } : null };
          if (lv.stance) Object.assign(patch, { ring: lv.stance, ringValue: v.Rings[lv.stance] });
          roller.set(patch);
        }, 'ghost tiny');
        b.title = [act].concat(eff).filter(Boolean).join('\n\n');   // the action's rules, as the book prints them
        return b;
      })]),
      el('div', { class: 'engaged' }, [el('div', { class: 'chiprow tight' }, [el('span', { class: 'track-name' }, ['Engaged']), pick]),
        engaged.map((e) => el('div', { class: 'engaged-npc' }, [el('b', {}, [e.name]), ' ', button('×', () => setConflict(m, { engaged: (c.engaged || []).filter((x) => x !== e.id) }, 'No longer engaged with ' + e.name), 'ghost tiny'),
          // O7 (Portents): an NPC's conditions and their rules text are visible to a player engaged with it
          (npcConds[e.id] || []).length ? (npcConds[e.id] || []).map((cn) => { const d = defs.find((x) => x.name === cn); return el('div', { class: 'small' }, [el('span', { class: 'cond' }, [cn]), ' ', d ? d.effects : '']); }) : el('span', { class: 'muted small' }, [' no conditions'])]))]),
    ]);
  }
  function resistCrit(m, v, roller) {
    const n = parseInt(window.prompt('Severity of the critical strike (the deadliness of its source):', '') || '', 10);
    if (!(n >= 0)) return;
    const rc = resistCheck();
    if (!rc) return;
    const lv = memberNow(m.id, m).live || {};
    const patch = { skill: rc.skill, skillRank: (v.Skills || {})[rc.skill] || 0, tn: rc.tn, source: 'Critical strike (severity ' + n + ')', tag: { kind: 'crit', severity: n } };
    if (lv.conflict && lv.stance) Object.assign(patch, { ring: lv.stance, ringValue: v.Rings[lv.stance] });
    roller.set(patch);
  }

  // The GM's view of an NPC's conditions (the Inspector): toggled, shared, and shown to a player
  // engaged with it
  function npcConditionsBlock(e) {
    const on = (((State().state || {}).npcConditions) || {})[e.id] || [];
    return el('div', { class: 'chiprow tight conditions' }, [el('span', { class: 'track-name' }, ['Conditions']), conditionDefs().map((c) => el('button', { class: 'cond-toggle' + (on.indexOf(c.name) !== -1 ? ' on' : ''), type: 'button', title: c.effects, onclick: () => {
      const list = on.indexOf(c.name) === -1 ? on.concat([c.name]) : on.filter((x) => x !== c.name);
      State().commit('setNpcConditions', [e.id, list]);
      State().commit('appendLog', [{ at: new Date().toISOString(), kind: 'event', who: 'GM · ' + e.name, text: c.name + (on.indexOf(c.name) === -1 ? ' — gained' : ' — removed'), why: 'condition' }]);
    } }, [c.name]))]);
  }

  // ── what an instance adds to a check ──
  // window.L5RCheckHooks: functions ({ member, character, roll, tally }) → { successes, label } | null,
  // each an ability that adds bonus successes to a check — the extension point a campaign layer
  // uses for its own characters' customizations, so upstream carries none of them.
  function checkExtras(m, roll, t) {
    const mm = memberNow(m.id, m);
    // "Fire: When you succeed on a check, you count as having one additional bonus success for each
    //  (st) symbol on your kept dice." — Stance, RULES fire_stance_strife_results_become_bonus_successes
    const fire = stanceOfCheck(m, roll) === 'Fire' && t.success === true && t.strife ? [{ successes: t.strife, label: 'Fire stance: a bonus success per (st) kept' }] : [];
    return fire.concat((window.L5RCheckHooks || []).map((h) => {
      try { return h({ member: mm, character: complete(mm.character || {}), roll, tally: t, D }); } catch (err) { return null; }
    }).filter((x) => x && x.successes > 0));
  }

  // ── the end of a scene, the end of a session (the GM's) ──
  // "At the end of each scene … each character removes strife until it is equal to half their
  //  composure, rounded up (unless it is already lower)." — Scene, RULES strife_removal_between_scenes;
  // "At the end of each scene, characters catch their breath. Each character reduces their fatigue to
  //  half of their endurance (rounded up) if it is over half their endurance" — recovering_from_fatigue;
  // "An Exhausted character does not remove fatigue and strife at the end of each scene as normal"
  //  — Exhausted, EFFECTS. A condition whose REMOVED_WHEN says it "is removed at the end of the
  //  scene" (Enraged) goes. Uses once per scene and an anxiety's Void point are counted afresh.
  const halfUp = (n) => Math.ceil((n || 0) / 2);
  function catchBreath(mm, patch, lines, strifeOnly) {
    const v = complete(mm.character || {});
    if (liveConditions(mm).indexOf('Exhausted') !== -1) { lines.push('Exhausted: no strife or fatigue removed'); return; }
    const s = current(mm, 'Strife'), sh = halfUp(value(v, 'Composure'));
    if (s > sh) patch.Strife = sh;
    if (strifeOnly) return;
    const f = current(mm, 'Fatigue'), fh = halfUp(value(v, 'Endurance'));
    if (f > fh) patch.Fatigue = fh;
  }
  function endScene(ids) {
    const lapsing = conditionDefs().filter((c) => /is removed at the end of the scene/i.test(c.removed)).map((c) => c.name);
    ids.forEach((id) => {
      const mm = memberNow(id);
      if (!mm) return;
      const patch = {};
      const lines = [];
      catchBreath(mm, patch, lines, false);
      const conds = liveConditions(mm);
      const gone = conds.filter((c) => lapsing.indexOf(c) !== -1);
      if (gone.length) State().commit('setPartyLive', [mm.id, { conditions: conds.filter((c) => gone.indexOf(c) === -1) }]);
      const was = conflictOf(mm);   // read before the commit: the member is updated in place
      if (was) { State().commit('setPartyLive', [mm.id, { conflict: null }]); lines.push('the ' + String(was.type).toLowerCase() + ' ends'); }
      State().commit('setPartyLive', [mm.id, { scene: ((mm.live || {}).scene || 0) + 1 }]);
      change(mm, patch, 'end of the scene' + (gone.length ? ' — ' + gone.join(', ') + ' removed' : '') + (lines.length ? ' — ' + lines.join('; ') : ''), true);
    });
  }
  // The book sets no strife rule for a session's end; "once per game session" abilities are counted
  // afresh. An instance's house rule may make a session's end remove strife as a scene's end does:
  // a MODIFY introducing ^"Removed At Session End" BOOLEAN true on ^"Strife" — and the GM may carry a
  // character's full total instead (`carry`: the ids to leave as they are).
  const SESSION_STRIFE = 'Removed At Session End';
  const sessionClearsStrife = () => D.modified(D.named('Strife', 'core'), SESSION_STRIFE) === true;
  function endSession(ids, carry) {
    const clears = sessionClearsStrife();
    ids.forEach((id) => {
      const mm = memberNow(id);
      if (!mm) return;
      const patch = {};
      const lines = [];
      const carried = (carry || []).indexOf(id) !== -1;
      if (clears && !carried) catchBreath(mm, patch, lines, true);
      State().commit('setPartyLive', [mm.id, { session: ((mm.live || {}).session || 0) + 1 }]);
      change(mm, patch, 'end of the session' + (clears ? (carried ? ' — strife carried in full' : ' — strife as at a scene’s end (house rule)') : '') + (lines.length ? ' — ' + lines.join('; ') : ''), true);
    });
  }

  // ── the record: conditions, standing, experience, versions, the header ──
  // Conditions are the corpus's own: the children of `^"Condition"` (core-systems), each with its
  // EFFECTS and REMOVED_WHEN. The ones the Samurai ACTOR derives from its RULES (Compromised,
  // Incapacitated) stay derived; the rest are toggled, each change logged.
  function conditionDefs() {
    const c = D.named('Condition', 'core');
    return c ? D.children(c.id).map((k) => {
      const eff = D.block(k, 'EFFECTS');
      const rem = D.block(k, 'REMOVED_WHEN');
      const txt = (b) => (b ? (b.body || []).map((x) => x.s).filter(Boolean).concat((b.args || []).map((a) => a.s).filter(Boolean)).join('\n\n') : '');
      return { name: k.name, id: k.id, effects: txt(eff), removed: txt(rem) };
    }) : [];
  }
  const liveConditions = (m) => ((m.live || {}).conditions || []).slice();
  function toggleCondition(m, name) {
    const mm = memberNow(m.id, m);
    const list = liveConditions(mm);
    const i = list.indexOf(name);
    if (i === -1) list.push(name);
    else list.splice(i, 1);
    State().commit('setPartyLive', [mm.id, { conditions: list }]);
    State().commit('appendLog', [{ at: new Date().toISOString(), kind: 'event', who: mm.name, memberId: mm.id, text: name + (i === -1 ? ' — gained' : ' — removed'), why: 'condition' }]);
  }
  function conditionsBlock(m, ro, compact) {
    const derivedStates = conditionRules().map((r) => r.state.toLowerCase());
    const on = liveConditions(m);
    if (compact && !ro) {
      const defs = conditionDefs().filter((c) => derivedStates.indexOf(c.name.toLowerCase()) === -1);
      const add = el('select', { class: 'scope add-cond', 'aria-label': 'Add a condition' }, [el('option', { value: '' }, ['+ condition'])].concat(defs.filter((c) => on.indexOf(c.name) === -1).map((c) => el('option', { value: c.name }, [c.name]))));
      add.addEventListener('change', () => { if (add.value) toggleCondition(m, add.value); });
      return el('div', { class: 'chiprow tight conditions compact' }, [
        on.map((n) => el('button', { class: 'cond-toggle on', type: 'button', title: ((defs.find((c) => c.name === n) || {}).effects || '') + '\n\nTap to remove', onclick: () => toggleCondition(m, n) }, [n, el('span', { class: 'x' }, [' ×'])])),
        add,
      ]);
    }
    return el('div', { class: 'chiprow tight conditions' }, [el('span', { class: 'track-name' }, ['Conditions']), conditionDefs().filter((c) => derivedStates.indexOf(c.name.toLowerCase()) === -1).map((c) =>
      el('button', { class: 'cond-toggle' + (on.indexOf(c.name) !== -1 ? ' on' : ''), type: 'button', disabled: ro || null, title: c.effects + (c.removed ? '\n\nRemoved when: ' + c.removed : ''), onclick: ro ? null : () => toggleCondition(m, c.name) }, [c.name]))]);
  }

  // Honor, Glory and Status move in play: the live value overrides the sheet's, each change logged;
  // staking one wagers an amount and logs it (the stake is settled by adjusting afterwards).
  const SOCIAL = ['Honor', 'Glory', 'Status'];
  function socialBlock(m, ro, compact) {
    const stakeLog = (k, n) => {
      const mm = memberNow(m.id, m);
      State().commit('appendLog', [{ at: new Date().toISOString(), kind: 'event', who: mm.name, memberId: mm.id, text: 'Staked ' + n + ' ' + k + ' (holding ' + current(mm, k) + ')', why: 'stake' }]);
    };
    if (compact && !ro) return el('div', { class: 'social-row compact' }, SOCIAL.map((k) => {
      const cur = current(m, k);
      const amounts = el('div', { class: 'stake-pick', hidden: true }, [el('span', { class: 'step-k' }, ['Stake']), [1, 2, 3, 4, 5].map((n) => button(String(n), () => stakeLog(k, n), 'ghost tiny'))]);
      return el('div', { class: 'soc' }, [
        el('span', { class: 'track-name' }, [k]),
        el('span', { class: 'stepper' }, [button('−', () => change(m, { [k]: Math.max(0, cur - 1) }), 'step'), el('b', { class: 'step-v' }, [String(cur)]), button('+', () => change(m, { [k]: Math.min(100, cur + 1) }), 'step')]),
        button('Stake…', () => { amounts.hidden = !amounts.hidden; }, 'ghost tiny'),
        amounts,
      ]);
    }));
    return el('div', { class: 'social-row' }, SOCIAL.map((k) => {
      const cur = current(m, k);
      const stake = el('input', { class: 'text num small', type: 'number', min: 1, placeholder: 'stake', disabled: ro || null });
      return el('div', { class: 'soc' }, [
        el('span', { class: 'track-name' }, [k]),
        ro ? null : button('−', () => change(m, { [k]: Math.max(0, cur - 1) }), 'ghost tiny'),
        el('b', { class: 'num' }, [String(cur)]),
        ro ? null : button('+', () => change(m, { [k]: Math.min(100, cur + 1) }), 'ghost tiny'),
        ro ? null : stake,
        ro ? null : button('Stake', () => {
          const n = parseInt(stake.value || '0', 10);
          if (!(n > 0)) return;
          const mm = memberNow(m.id, m);
          State().commit('appendLog', [{ at: new Date().toISOString(), kind: 'event', who: mm.name, memberId: mm.id, text: 'Staked ' + n + ' ' + k + ' (holding ' + current(mm, k) + ')', why: 'stake' }]);
          stake.value = '';
        }, 'ghost tiny'),
      ]);
    }));
  }

  // Experience: the ACTOR's `Experience` is XP earned (as the instance conversion reads it); XP
  // spent and what it bought are the sheet's record — a spend adds its cost to spent and a line to
  // the ledger, logged. Available is earned less spent.
  function xp(m) {
    const lv = m.live || {};
    const v = complete(m.character || {});
    const earned = lv.xpEarned != null ? lv.xpEarned : (v.Experience || 0);
    const spent = lv.xpSpent != null ? lv.xpSpent : (v['Experience Spent'] || 0);
    // a printed ledger (^"Experience Ledger"): "cost · what · note · when"
    const printed = (v['Experience Ledger'] || []).map((x) => { const q = String(x).split(' · '); return { cost: parseInt(q[0], 10) || 0, what: q[1] || '', note: q[2] || null, when: q[3] || null }; });
    return { earned, spent, available: earned - spent, ledger: lv.xpLedger || v._xpLedger || printed };
  }
  function xpBlock(m, ro, compact) {
    const x = xp(m);
    if (compact && !ro) {
      const cost = el('input', { class: 'text num small', type: 'number', min: 1, value: 1 });
      const what = el('input', { class: 'text', type: 'text', placeholder: 'on what' });
      const adj = (key, d) => change(m, { [key]: Math.max(0, xp(memberNow(m.id, m))[key === 'xpEarned' ? 'earned' : 'spent'] + d) });
      const st = (label, key, n) => el('div', { class: 'soc' }, [el('span', { class: 'track-name' }, [label]),
        el('span', { class: 'stepper' }, [button('−', () => adj(key, -1), 'step'), el('b', { class: 'step-v' }, [String(n)]), button('+', () => adj(key, 1), 'step')])]);
      return el('div', { class: 'xp compact' }, [
        el('div', { class: 'social-row compact' }, [st('XP earned', 'xpEarned', x.earned), st('XP spent', 'xpSpent', x.spent),
          el('div', { class: 'soc' }, [el('span', { class: 'track-name' }, ['Available']), el('b', { class: 'num xp-avail' }, [String(x.available)])])]),
        el('details', { class: 'fold' }, [el('summary', {}, ['Spend XP']),
          el('div', { class: 'chiprow tight' }, [Dice.stepper(cost, 1, 99, 'Cost'), what, button('Spend', () => {
            const n = parseInt(cost.value || '0', 10);
            if (!(n > 0) || !what.value.trim()) return;
            const mm = memberNow(m.id, m);
            const cur = xp(mm);
            const line = { cost: n, what: what.value.trim(), note: null, when: new Date().toISOString().slice(0, 10) };
            State().commit('setPartyLive', [mm.id, { xpLedger: cur.ledger.concat([line]) }]);
            change(mm, { xpSpent: cur.spent + n }, 'spent on ' + line.what);
          }, 'btn')])]),
        x.ledger.length ? el('details', { class: 'fold' }, [el('summary', {}, ['Spent on (' + x.ledger.length + ')']),
          el('ul', { class: 'items xp-ledger' }, x.ledger.map((e) => el('li', {}, [el('b', { class: 'num' }, [String(e.cost)]), ' ', e.what, e.when ? el('span', { class: 'muted small' }, [' · ' + e.when]) : null])))]) : null,
      ]);
    }
    const cost = el('input', { class: 'text num small', type: 'number', min: 1, placeholder: 'cost' });
    const what = el('input', { class: 'text small', type: 'text', placeholder: 'on what (a technique, Water 1 → 2…)' });
    const note = el('input', { class: 'text small', type: 'text', placeholder: 'note' });
    const adj = (key, d) => change(m, { [key]: Math.max(0, xp(memberNow(m.id, m))[key === 'xpEarned' ? 'earned' : 'spent'] + d) });
    return el('div', { class: 'xp' }, [
      el('div', { class: 'social-row' }, [
        el('div', { class: 'soc' }, [el('span', { class: 'track-name' }, ['XP earned']), ro ? null : button('−', () => adj('xpEarned', -1), 'ghost tiny'), el('b', { class: 'num' }, [String(x.earned)]), ro ? null : button('+', () => adj('xpEarned', 1), 'ghost tiny')]),
        el('div', { class: 'soc' }, [el('span', { class: 'track-name' }, ['spent']), ro ? null : button('−', () => adj('xpSpent', -1), 'ghost tiny'), el('b', { class: 'num' }, [String(x.spent)]), ro ? null : button('+', () => adj('xpSpent', 1), 'ghost tiny')]),
        el('div', { class: 'soc' }, [el('span', { class: 'track-name' }, ['available']), el('b', { class: 'num' }, [String(x.available)])]),
      ]),
      x.ledger.length ? el('ul', { class: 'items xp-ledger' }, x.ledger.map((e) => el('li', {}, [el('b', { class: 'num' }, [String(e.cost)]), ' ', e.what, e.note ? el('em', { class: 'muted' }, [' ' + e.note]) : null, e.when ? el('span', { class: 'muted small' }, [' · ' + e.when]) : null]))) : null,
      ro ? null : el('div', { class: 'chiprow tight' }, [cost, what, note, button('Spend', () => {
        const n = parseInt(cost.value || '0', 10);
        if (!(n > 0) || !what.value.trim()) return;
        const mm = memberNow(m.id, m);
        const cur = xp(mm);
        const line = { cost: n, what: what.value.trim(), note: note.value.trim() || null, when: new Date().toISOString().slice(0, 10) };
        State().commit('setPartyLive', [mm.id, { xpLedger: cur.ledger.concat([line]) }]);
        change(mm, { xpSpent: cur.spent + n }, 'spent on ' + line.what + (line.note ? ' (' + line.note + ')' : ''));
      }, 'ghost tiny')]),
    ]);
  }

  // Versions: an archived copy of the character and its trackers, read-only; the picker shows one
  // in place of the live sheet (a local view — the party member does not change). Archiving is an
  // op (system/l5r5e/ops.js), so the room keeps it with the member.
  const viewing = {};
  const versionsOf = (m) => m.versions || [];
  function archive(m) {
    const mm = memberNow(m.id, m);
    const n = versionsOf(mm).length + 1;
    const label = window.prompt('Name this version (it is kept read-only):', 'Version ' + n);
    if (!label) return;
    const snap = JSON.parse(JSON.stringify({ character: mm.character || {}, live: mm.live || {} }));
    const ver = { id: State().genId('v'), label, date: new Date().toISOString().slice(0, 10), character: snap.character, live: snap.live };
    State().commit('archivePartyVersion', [mm.id, ver]);
    State().commit('appendLog', [{ at: new Date().toISOString(), kind: 'event', who: mm.name, memberId: mm.id, text: 'Archived this version as “' + label + '”', why: 'version' }]);
  }
  const isViewingArchive = (m) => !!viewing[m.id] && versionsOf(m).some((x) => x.id === viewing[m.id]);
  function versionPicker(m, redraw, compact) {
    const vs = versionsOf(m);
    const sel = el('select', { class: 'scope tiny', title: 'Versions of this character: the live sheet, or an archived one (read-only)' },
      [el('option', { value: '' }, ['Current'])].concat(vs.map((x) => el('option', { value: x.id, selected: viewing[m.id] === x.id || null }, [x.label + (x.date ? ' · ' + x.date : '')]))));
    sel.addEventListener('change', () => { viewing[m.id] = sel.value || null; redraw(); });
    if (compact) return vs.length ? el('span', { class: 'chiprow tight' }, [sel]) : null;
    return el('span', { class: 'chiprow tight' }, [sel, button('Archive this version…', () => archive(m), 'ghost tiny')]);
  }

  // The header: a portrait an instance provides (window.L5RPortraits, keyed by the character's
  // source entity id; or the member's own `portrait`), the clan mon from the art, and the deficient
  // ring marked — the ring of an Elemental Deficiency the character holds.
  const portraitOf = (m, v) => m.portrait || ((window.L5RPortraits || {})[(v._source || {}).id]) || null;
  function monOf(v) {
    const clan = String(v.Clan || '').replace(/\s+Clan$/, '').trim().toLowerCase();
    return clan ? el('img', { class: 'mon', src: 'assets/art/mon/' + clan + '.svg', alt: v.Clan + ' mon', title: v.Clan, onerror: (ev) => ev.target.remove() }) : null;
  }
  const deficientRings = (v) => traits(v).filter((t) => t.type === 'Adversity' && /^Elemental Deficiency\b/.test(t.name) && t.ring).map((t) => t.ring);
  function header(m, v, extra, compact) {
    const pic = portraitOf(m, v);
    const line = compact ? sentence(v).split(' · ').slice(1).join(' · ') : sentence(v);
    return el('div', { class: 'sheet-head' }, [
      pic ? el('img', { class: 'portrait', src: pic, alt: v.Name || m.name }) : null,
      el('div', { class: 'head-text' }, [el('h2', {}, [monOf(v), m.name]), el('div', { class: 'muted small' }, [line]), extra || null]),
    ]);
  }

  function live(m, opts) {
    const o = opts || {};
    const redraw = () => window.VttBus.emit('state:remote', { view: true }, { local: true });
    // an archived version, read-only, in place of the live sheet
    if (isViewingArchive(m)) {
      const ver = versionsOf(m).find((x) => x.id === viewing[m.id]);
      const av = complete(ver.character || {});
      const am = { id: m.id, name: m.name, character: ver.character, live: ver.live, portrait: portraitOf(m, complete(m.character || {})) };
      const ad = derived(av);
      const box = el('div', { class: 'sheet live archived' });
      box.appendChild(header(am, av, versionPicker(m, redraw)));
      box.appendChild(el('div', { class: 'archive-banner' }, ['Viewing “' + ver.label + '”' + (ver.date ? ' (' + ver.date + ')' : '') + ' — archived, read-only. Downloading its file waits until you return to Current.']));
      box.appendChild(el('div', { class: 'chiprow tight' }, [ringTiles(av, null, { stance: (ver.live || {}).stance, deficient: deficientRings(av) })]));
      box.appendChild(track('Fatigue', current(am, 'Fatigue'), value(av, 'Endurance'), null));
      box.appendChild(track('Strife', current(am, 'Strife'), value(av, 'Composure'), null));
      box.appendChild(track('Void points', current(am, 'Void Points'), ad.voidMax, null));
      box.appendChild(conditionsBlock(am, true));
      box.appendChild(socialBlock(am, true));
      box.appendChild(xpBlock(am, true));
      box.appendChild(render(Object.assign({}, av, { Honor: current(am, 'Honor'), Glory: current(am, 'Glory'), Status: current(am, 'Status') }), null, { stance: (ver.live || {}).stance }));
      return box;
    }
    const v = complete(m.character || {});
    const d = derived(v);
    const lv = m.live || {};
    const box = el('div', { class: 'sheet live' });
    const cp = !!o.player;   // the player's page: compact — taps not typed numbers, no working shown
    const roller = rollerFor(m, v, cp);
    // Each block belongs to a pane. On a phone the player's page shows one pane at a time behind a
    // bar at the bottom (assets/css/l5r5e-gm.css, ≤ 640px); everywhere else every block shows, as always.
    const add = (node, pane) => { if (node) { if (node.setAttribute) node.setAttribute('data-pane', pane); box.appendChild(node); } return node; };
    if (cp) return playerSheet(m, v, d, lv, box, roller, add, redraw);
    add(header(m, v, versionPicker(m, redraw, cp), cp), 'play');
    const conds = conditions(m);
    add(el('div', { class: 'chiprow tight' }, [ringTiles(v, null, { stance: lv.stance, deficient: deficientRings(v) }), conds.map((c) => el('span', { class: 'cond', title: 'the Samurai type’s own rule' }, [c]))]), 'play');
    add(track('Fatigue', current(m, 'Fatigue'), value(v, 'Endurance'), (n) => patch(m, { Fatigue: n })), 'play');
    add(track('Strife', current(m, 'Strife'), value(v, 'Composure'), (n) => patch(m, { Strife: n })), 'play');
    add(track('Void points', current(m, 'Void Points'), d.voidMax, (n) => patch(m, { voidPoints: Math.min(n, d.voidMax || n) })), 'play');
    add(conditionsBlock(m, false, cp), 'play');
    add(traitButtons(m, v), 'play');   // none for a character with no passion or anxiety
    add(techniquesBlock(m, v, roller, cp), 'play');
    add(gearBlock(m, v, cp), 'gear');
    add(conflictBlock(m, v, roller, cp), 'play');
    add(el('div', { class: 'muted small' }, ['Focus ' + value(v, 'Focus') + ' · Vigilance ' + value(v, 'Vigilance')]), 'play');
    add(socialBlock(m, false, cp), 'gear');
    add(xpBlock(m, false, cp), 'gear');
    add(cp ? null : el('h4', {}, ['A check', el('span', { class: 'muted small' }, [' · pick a skill below, a ring, the TN'])]), 'roll');
    if (roller.refresh) roller.refresh();
    add(roller, 'roll');
    const onRoll = (skill, rank) => roller.set({ skill, skillRank: rank });
    add(render(Object.assign({}, v, { Honor: current(m, 'Honor'), Glory: current(m, 'Glory'), Status: current(m, 'Status') }), null, { onRoll, stance: lv.stance, compact: cp }), 'sheet');
    const rollLog = el('div', { class: 'roll-log' });
    // the player's page: their rolls only (the trackers already show what an event changed)
    (cp ? logOf(m).filter((x) => x.kind === 'roll').slice(-5) : logOf(m).slice(-8)).reverse().forEach((x) => rollLog.appendChild(Dice.logLine(x, { compact: cp })));
    // an advantage from a book not yet loaded: load it, then draw again with its type and ring
    ensureTraits(v).then((loaded) => { if (loaded) window.VttBus.emit('state:remote', { loaded: true }, { local: true }); });
    add(rollLog, 'roll');
    if (o.player) panes(m, box, roller);
    return box;
  }

  // ── the player's copy of the sheet (liveSheet { player: true }) ──
  // Play: who, rings, trackers, conditions, Honor/Glory/Status, passions and anxieties, techniques,
  // Advancement (its own page, not a tab). Conflict: while the GM has the character in one. Roll:
  // the roller and the player's rolls. Gear: weapons, armor, the player's own notes.
  function playerSheet(m, v, d, lv, box, roller, add, redraw) {
    add(header(m, v, versionPicker(m, redraw, true), true), 'play');
    const conds = conditions(m);
    add(el('div', { class: 'chiprow tight' }, [ringTiles(v, null, { stance: lv.stance, deficient: deficientRings(v) }), conds.map((c) => el('span', { class: 'cond', title: 'the Samurai type’s own rule' }, [c]))]), 'play');
    add(track('Fatigue', current(m, 'Fatigue'), value(v, 'Endurance'), (n) => patch(m, { Fatigue: n })), 'play');
    add(track('Strife', current(m, 'Strife'), value(v, 'Composure'), (n) => patch(m, { Strife: n })), 'play');
    add(track('Void points', current(m, 'Void Points'), d.voidMax, (n) => patch(m, { voidPoints: Math.min(n, d.voidMax || n) })), 'play');
    add(conditionsBlock(m, false, true), 'play');
    add(socialBlock(m, false, true), 'play');
    add(traitButtons(m, v), 'play');
    add(techniquesBlock(m, v, roller, true), 'play');
    add(el('div', { class: 'muted small' }, ['Focus ' + value(v, 'Focus') + ' · Vigilance ' + value(v, 'Vigilance')]), 'play');
    const x = xp(m);
    add(el('div', { class: 'advance-open' }, [button('Advancement', () => openAdvancement(m), 'btn'), el('span', { class: 'muted small' }, [x.available + ' XP to spend'])]), 'play');
    // the conflict the GM has started: initiative first, rolled here
    const c = conflictOf(m);
    const ini = c ? initiativeCheck(c.type) : null;
    const iniPending = !!(c && ini && c.initiative == null);
    if (c) add(conflictPane(m, v, roller, iniPending ? roller : null), 'conflict');
    if (iniPending && iniSetUp[m.id] !== c.type) {
      iniSetUp[m.id] = c.type;
      (roller.rawSet || roller.set)({ skill: ini.skill, skillRank: (v.Skills || {})[ini.skill] || 0, tn: ini.tn, source: 'Initiative (' + c.type + ')', tag: { kind: 'initiative', surprised: !!c.surprised } });
    }
    if (!c) delete iniSetUp[m.id];
    if (roller.refresh) roller.refresh();
    if (!iniPending) add(roller, 'roll');
    else add(el('p', { class: 'muted' }, ['Initiative first, on the Conflict tab.']), 'roll');
    const rollLog = el('div', { class: 'roll-log' });
    logOf(m).filter((e) => e.kind === 'roll').slice(-5).reverse().forEach((e) => rollLog.appendChild(Dice.logLine(e, { compact: true })));
    add(rollLog, 'roll');
    add(gearBlock(m, v, true), 'gear');
    add(el('div', { class: 'player-notes' }, [el('div', { class: 'track-name' }, ['Notes']),
      el('textarea', { class: 'text', rows: 8, placeholder: 'Your notes — only you and the GM see them', oninput: debounceNotes(m) }, [memberNow(m.id, m).playerNotes || ''])]), 'gear');
    ensureTraits(v).then((loaded) => { if (loaded) window.VttBus.emit('state:remote', { loaded: true }, { local: true }); });
    panes(m, box, roller, !iniPending);
    return box;
  }
  const iniSetUp = {};   // member id → the conflict whose initiative the roller was set up for
  const notesTimers = {};
  const debounceNotes = (m) => (ev) => {
    clearTimeout(notesTimers[m.id]);
    const text = ev.target.value;
    notesTimers[m.id] = setTimeout(() => State().commit('setPartyPlayerNotes', [m.id, text]), 400);
  };

  // a conflict action declared: logged, and its check set up — a Strike with the weapon struck with
  function declareAction(m, v, roller, c, e) {
    const mm = memberNow(m.id, m);
    const lv = mm.live || {};
    const w = readied(mm);
    const act = plain(D.kwArg(e, 'ACTIVATION'));
    logEvent(mm, 'Declares ' + e.name + (act ? ' — ' + act.split('. ')[0] : ''), 'action');
    const a = activation(e);
    if (!a) return;
    const skill = e.name === 'Strike' && w && w.skill ? w.skill : a.skill || a.skills[0];
    const patch = { skill, skillRank: (v.Skills || {})[skill] || 0, tn: a.tn, source: e.name, sourceId: e.id, sourceType: c.type + ' action', tag: e.name === 'Strike' ? { kind: 'strike' } : null };
    if (lv.stance) Object.assign(patch, { ring: lv.stance, ringValue: v.Rings[lv.stance] });
    roller.set(patch);
  }
  // a weapon readied with the first grip the free hands allow
  function readyWeapon(m, w) {
    const mm = memberNow(m.id, m);
    const used = handsUsed(mm);
    const first = gripsOf(w).find((x) => used + handsOf(x.name) <= HANDS);
    if (!first) return 'No hand is free to ready the ' + w.name + ' — sheathe something first.';
    setWeapon(mm, w.name, { state: 'readied', grip: first.name }, 'Readies the ' + w.name + ' (' + first.name + ')');
    return null;
  }
  // the Conflict tab: the type and initiative (its check, until rolled), the stance, the weapons —
  // strike with one readied, ready one sheathed — the other actions, the NPCs engaged
  function conflictPane(m, v, roller, iniRoller) {
    const c = conflictOf(m);
    const lv = m.live || {};
    const rules = stanceRules();
    const eq = equipOf(m);
    const note = el('div', { class: 'muted small gear-note' });
    const actions = conflictActions(c.type);
    const strikeE = actions.find((e) => e.name === 'Strike');
    const strike = (name, text) => { setEquip(m, { strikeWith: name }, text); if (strikeE) declareAction(m, v, roller, c, strikeE); };
    const carried = weaponsFor(v).filter((w) => !w.unarmed);
    const surprised = el('input', { type: 'checkbox', checked: c.surprised || null, onchange: (ev) => setConflict(m, { surprised: ev.target.checked }, null) });
    const Sys = window.VttSystem;
    const sid = Sys && Sys.currentSceneId ? Sys.currentSceneId() : null;
    const castHere = sid && Sys.cast ? Sys.cast(sid) : [];
    const engaged = (c.engaged || []).map((id) => D.entity(id) || castHere.find((e) => e.id === id)).filter(Boolean);
    const npcConds = ((State().state || {}).npcConditions) || {};
    const defs = conditionDefs();
    const pick = el('select', { class: 'scope', 'aria-label': 'Engage an NPC' }, [el('option', { value: '' }, [castHere.length ? 'Engage an NPC…' : 'No NPC in this scene'])].concat(castHere.filter((e) => (c.engaged || []).indexOf(e.id) === -1).map((e) => el('option', { value: e.id }, [e.name]))));
    pick.addEventListener('change', () => { if (pick.value) setConflict(m, { engaged: (c.engaged || []).concat([pick.value]) }, 'Engages ' + (castHere.find((e) => e.id === pick.value) || {}).name); });
    return el('div', { class: 'conflict-pane' }, [
      el('div', { class: 'conflict-head' }, [el('h3', {}, [c.type]), c.initiative != null ? el('div', { class: 'ini' }, [el('span', { class: 'track-name' }, ['Initiative']), el('b', {}, [String(c.initiative)])]) : null]),
      iniRoller ? el('div', { class: 'ini-roll' }, [el('div', { class: 'track-name' }, ['Initiative']), el('label', { class: 'small' }, [surprised, ' Unprepared (surprised)']), iniRoller]) : null,
      el('div', { class: 'track-name' }, ['Stance']),
      el('div', { class: 'ring-pick stance-pick' }, RINGS.map((r) => el('button', { class: 'ring-btn' + (lv.stance === r ? ' on' : ''), type: 'button', onclick: () => setStance(m, r, roller) }, [Dice.ringIcon(r), el('span', {}, [r])]))),
      lv.stance && rules[lv.stance] ? el('div', { class: 'small stance-rule' }, [E.span(rules[lv.stance], 'core')]) : null,
      el('div', { class: 'track-name' }, ['Weapons']),
      el('div', { class: 'conflict-weapons' }, [
        carried.map((w) => {
          const st = eq.weapons[w.name] || { state: 'sheathed' };
          if (st.state === 'readied') return el('div', { class: 'cw-row' }, [button('Strike with ' + w.name, () => strike(w.name, 'Strikes with the ' + w.name), 'btn'),
            button('Sheathe', () => setWeapon(m, w.name, { state: 'sheathed' }, 'Sheathes the ' + w.name), 'ghost tiny')]);
          return el('div', { class: 'cw-row' }, [button('Ready ' + w.name, () => { note.textContent = readyWeapon(m, w) || ''; }, 'ghost')]);
        }),
        unarmed().length ? el('div', { class: 'cw-row unarmed' }, unarmed().map((e) => button(e.name, () => strike(e.name, 'Strikes with a ' + e.name.toLowerCase()), 'ghost'))) : null,
        note,
      ]),
      el('div', { class: 'track-name' }, ['Actions']),
      el('div', { class: 'conflict-actions' }, actions.filter((e) => e.name !== 'Strike').map((e) => {
        const b = button(e.name, () => declareAction(m, v, roller, c, e), 'ghost');
        b.title = [plain(D.kwArg(e, 'ACTIVATION'))].concat(blockLines(D.block(e, 'EFFECTS'))).filter(Boolean).join('\n\n');
        return b;
      })),
      el('div', { class: 'track-name' }, ['Engaged']),
      el('div', { class: 'engaged' }, [pick, engaged.map((e) => el('div', { class: 'engaged-npc' }, [el('b', {}, [e.name]), ' ',
        button('×', () => setConflict(m, { engaged: (c.engaged || []).filter((x) => x !== e.id) }, 'No longer engaged with ' + e.name), 'ghost tiny'),
        (npcConds[e.id] || []).map((cn) => { const dd = defs.find((q) => q.name === cn); return el('div', { class: 'small' }, [el('span', { class: 'cond' }, [cn]), ' ', dd ? dd.effects : '']); })]))]),
      button('Resist a critical strike…', () => resistCrit(m, v, roller), 'ghost'),
    ]);
  }

  // ── Advancement: its own page over the player's sheet. Exit leaves the character as it was;
  // Save archives it as a version and makes the advanced character the current one (the op
  // advancePartyMember). Costs are the corpus's Table 2–2 (core p. 97): a skill or a ring by the
  // rank or value bought, a technique at 3 XP or its listed value. ──
  function advancementCosts() {
    const e = D.entity('#qLicpynLdNu07y2a636A0M') || D.named('Advancement', 'core');
    const b = e && (e.blocks || []).find((x) => x.kw === 'ADVANCEMENT_COSTS');
    const out = { skill: {}, ring: {}, technique: 3 };
    let kind = null;
    ((b && b.body) || []).forEach((x) => {
      if (x.vk === 'name') { kind = /Skill/.test(x.name) ? 'skill' : /Ring/.test(x.name) ? 'ring' : /Technique/.test(x.name) ? 'technique' : null; return; }
      if (x.kw !== 'COST' || !kind) return;
      if (kind === 'technique') { const n = parseInt(((x.args || [])[0] || {}).s, 10); if (n) out.technique = n; return; }
      const cells = (x.body || []).map((q) => q.s);
      for (let i = 0; i + 1 < cells.length; i += 2) {
        const to = /→\s*(\d+)/.exec(cells[i]);
        const cost = parseInt(cells[i + 1], 10);
        if (to && cost) out[kind][+to[1]] = cost;
      }
    });
    return out;
  }
  function openAdvancement(m) {
    if (document.querySelector('.advance-page')) return;   // one at a time
    const mm = memberNow(m.id, m);
    const was = complete(mm.character || {});
    const next = JSON.parse(JSON.stringify(mm.character || {}));
    next.Rings = Object.assign({}, was.Rings);
    next.Skills = Object.assign({}, was.Skills);
    next.Techniques = (was.Techniques || []).slice();
    const x0 = xp(mm);
    let earned = x0.earned;
    const buys = [];   // { kind, name, to, cost } — undone last-first
    const costs = advancementCosts();
    const techNames = Array.from(new Set(D.techniques().map((r) => r.name))).sort();
    const page = el('div', { class: 'advance-page', role: 'dialog', 'aria-label': 'Advancement' });
    const close = () => { page.remove(); document.body.classList.remove('advancing'); };
    const spent = () => x0.spent + buys.reduce((a, b) => a + b.cost, 0);
    const buy = (kind, name, to, cost) => { buys.push({ kind, name, to, cost }); draw(); };
    const undo = (kind, name) => {
      const i = buys.map((b) => b.kind + '|' + b.name).lastIndexOf(kind + '|' + name);
      if (i === -1) return;
      const b = buys.splice(i, 1)[0];
      if (kind === 'ring') next.Rings[name] = b.to - 1;
      if (kind === 'skill') next.Skills[name] = b.to - 1;
      if (kind === 'technique') next.Techniques = next.Techniques.filter((t) => t !== name);
      draw();
    };
    const save = () => {
      if (earned - spent() < 0) return;   // never more than the XP there is
      if (!buys.length) { if (earned !== x0.earned) change(mm, { xpEarned: earned }); close(); return; }
      const when = new Date().toISOString().slice(0, 10);
      const lines = buys.map((b) => ({ cost: b.cost, what: b.kind === 'technique' ? b.name : b.name + ' ' + (b.to - 1) + ' → ' + b.to, note: null, when }));
      const now = memberNow(m.id, m);
      const version = { id: State().genId('v'), label: 'Before advancement', date: when, character: JSON.parse(JSON.stringify(now.character || {})), live: JSON.parse(JSON.stringify(now.live || {})) };
      State().commit('advancePartyMember', [m.id, { version, character: next, live: { xpEarned: earned, xpSpent: spent(), xpLedger: x0.ledger.concat(lines) } }]);
      logEvent(memberNow(m.id, m), 'Advances: ' + lines.map((l) => l.what + ' (' + l.cost + ' XP)').join(', '), 'advancement');
      close();
    };
    const stepRow = (label, n, onMinus, onPlus, plusLabel) => el('div', { class: 'adv-row' }, [
      el('span', { class: 'adv-k' }, [label]),
      el('span', { class: 'stepper' }, [
        el('button', { class: 'step', type: 'button', disabled: onMinus ? null : true, onclick: onMinus || null }, ['−']),
        el('b', { class: 'step-v' }, [String(n)]),
        el('button', { class: 'step', type: 'button', disabled: onPlus ? null : true, onclick: onPlus || null }, ['+']),
      ]),
      el('span', { class: 'adv-cost muted small' }, [plusLabel || '']),
    ]);
    function draw() {
      const avail = earned - spent();
      page.innerHTML = '';
      page.appendChild(el('div', { class: 'adv-bar' }, [
        button('Exit', close, 'ghost'),
        el('h2', {}, ['Advancement']),
        button('Save', save, 'btn adv-save'),
      ]));
      const body = el('div', { class: 'adv-body' });
      page.appendChild(body);
      body.appendChild(el('div', { class: 'adv-sec' }, [el('h3', {}, ['Experience']),
        stepRow('Earned', earned, earned > 0 ? () => { earned -= 1; draw(); } : null, () => { earned += 1; draw(); }),
        el('div', { class: 'adv-row' }, [el('span', { class: 'adv-k' }, ['Spent']), el('b', { class: 'adv-n' }, [String(spent())])]),
        el('div', { class: 'adv-row' + (avail < 0 ? ' over' : '') }, [el('span', { class: 'adv-k' }, ['Available']), el('b', { class: 'adv-n' }, [String(avail)])]),
      ]));
      body.appendChild(el('div', { class: 'adv-sec' }, [el('h3', {}, ['Rings']), RINGS.map((r) => {
        const n = next.Rings[r] || 1;
        const cost = costs.ring[n + 1];
        const mine = buys.some((b) => b.kind === 'ring' && b.name === r);
        return stepRow(r, n, mine ? () => undo('ring', r) : null, n < 5 && cost ? () => { next.Rings[r] = n + 1; buy('ring', r, n + 1, cost); } : null, n < 5 && cost ? '+1 · ' + cost + ' XP' : '');
      })]));
      body.appendChild(el('div', { class: 'adv-sec' }, [el('h3', {}, ['Skills']), skillGroups().map((g) => el('div', { class: 'adv-group' }, [el('div', { class: 'track-name' }, [g.name]),
        g.skills.map((k) => {
          const n = next.Skills[k.name] || 0;
          const cost = costs.skill[n + 1];
          const mine = buys.some((b) => b.kind === 'skill' && b.name === k.name);
          return stepRow(k.name, n, mine ? () => undo('skill', k.name) : null, n < 5 && cost ? () => { next.Skills[k.name] = n + 1; buy('skill', k.name, n + 1, cost); } : null, n < 5 && cost ? '+1 · ' + cost + ' XP' : '');
        })]))]));
      const tIn = el('input', { class: 'text', type: 'text', list: 'adv-techs', placeholder: 'A technique…' });
      const tCost = el('input', { class: 'text num small', type: 'number', min: 1, value: costs.technique });
      body.appendChild(el('div', { class: 'adv-sec' }, [el('h3', {}, ['Techniques']),
        el('ul', { class: 'items adv-techs' }, next.Techniques.map((t) => el('li', {}, [t, buys.some((b) => b.kind === 'technique' && b.name === t) ? button('×', () => undo('technique', t), 'ghost tiny') : null]))),
        el('datalist', { id: 'adv-techs' }, techNames.filter((n) => next.Techniques.indexOf(n) === -1).map((n) => el('option', { value: n }))),
        el('div', { class: 'adv-add' }, [tIn, Dice.stepper(tCost, 1, 30, 'XP'), button('Add', () => {
          const name = tIn.value.trim();
          if (!name || next.Techniques.indexOf(name) !== -1) return;
          next.Techniques.push(name);
          buy('technique', name, 1, parseInt(tCost.value, 10) || costs.technique);
        }, 'btn')]),
      ]));
      page.querySelector('.adv-save').disabled = avail < 0 || (!buys.length && earned === x0.earned) ? true : null;
    }
    document.body.appendChild(page);
    document.body.classList.add('advancing');
    draw();
    window.scrollTo(0, 0);
  }

  // ── the player's page on a phone: the panes and the bar that switches them ──
  const PANES = [['play', 'Play'], ['conflict', 'Conflict'], ['roll', 'Roll'], ['gear', 'Gear']];
  const paneOf = {};   // member id → the pane showing; kept across the page's redraws
  const shown = {};    // member id → the pane switcher of the sheet on the page now
  const inConflict = {};   // member id → whether the last draw had a conflict (to open its tab once)
  function panes(m, box, roller, rollHere) {
    const nav = el('nav', { class: 'pane-nav', 'aria-label': 'Sheet sections' });
    // the GM starts a conflict: its tab appears and opens; it ends: the tab goes, back to Play
    const c = !!conflictOf(m);
    if (c && !inConflict[m.id]) paneOf[m.id] = 'conflict';
    if (!c && paneOf[m.id] === 'conflict') paneOf[m.id] = 'play';
    if (paneOf[m.id] === 'sheet') paneOf[m.id] = 'play';
    inConflict[m.id] = c;
    // on the Roll tab its own name in the bar is the Roll button (red); elsewhere it opens the tab
    const show = (p, scroll) => {
      paneOf[m.id] = p;
      box.setAttribute('data-show', p);
      nav.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('on', b.getAttribute('data-for') === p);
        b.classList.toggle('go', b.getAttribute('data-for') === 'roll' && p === 'roll' && !!rollHere);
      });
      if (scroll) window.scrollTo(0, 0);
    };
    PANES.filter(([p]) => p !== 'conflict' || c).forEach(([p, label]) => nav.appendChild(el('button', { type: 'button', 'data-for': p,
      onclick: () => {
        if (p === 'roll' && paneOf[m.id] === 'roll' && rollHere && roller.roll) {
          roller.roll();
          // the dice come up below the skills: bring them into view, once the page has redrawn
          setTimeout(() => { const tray = roller.querySelector('.tray'); if (tray && tray.isConnected) tray.scrollIntoView({ block: 'start' }); }, 60);
        } else show(p, true);
      } }, [label])));
    box.appendChild(nav);
    shown[m.id] = show;
    show(paneOf[m.id] || 'play', false);
    // a technique, a skill or an initiative set up a check: take the player to it. The roller outlives
    // the page's redraws (rollerFor keeps one per member), so it is wrapped once, and switches
    // whichever sheet is on the page when it is used
    if (!roller.panesWrapped) {
      const set = roller.set;
      roller.rawSet = set;   // a set-up that stays where it is (the Conflict tab's initiative)
      roller.set = (x) => {
        set(x);
        if (paneOf[m.id] !== 'roll' && shown[m.id]) shown[m.id]('roll', true);
      };
      roller.panesWrapped = true;
    }
  }

  // a character's log: what its file brought (earlier sessions), then this table's entries
  function logOf(m) {
    const here = (((State().state || {}).log) || []).filter((x) => (x.kind === 'roll' || x.kind === 'event') && x.memberId === m.id);
    const seen = new Set(here.map((x) => x.at + '|' + x.kind));
    return (m.history || []).filter((x) => !seen.has(x.at + '|' + x.kind)).concat(here);
  }

  return {
    conflictTypes, conflictOf, setConflict, openAdvancement,
    ACTOR, FILE_KIND, spec, skills, skillGroups, formula, evaluate, derived, conditionRules, blank, complete, value,
    fromEntity, fromEntityView, sentence, render, readFile, fileOf, download, memberFrom, readMember, downloadMember,
    memberFromEntity, current, conditions, tokenText, live, rollerFor, traits, rerollModes, gainVoid, change,
    conditionDefs, xp, logOf, isViewingArchive, deficientRings, activation, endScene, endSession, sessionClearsStrife,
    npcConditionsBlock, opportunityList, severityRow, initiativeCheck, stanceRules, weaponsFor, readied,
  };
})();
