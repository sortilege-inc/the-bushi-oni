// system/l5r5e/table.js — what Legend of the Five Rings tells the table (engine/vtt.js) and the
// player's page (engine/play.js): which scenes are in play, what can stand on the table, what a
// token's state reads as, and how a character file becomes a party member. The engine never
// asks the corpus directly.
//
// The module in play is one of the corpus's sixteen .arc adventures, picked in the Adventure
// panel (campaign.modules[0]); its scenes are read by L5RData.module. Its book loads on demand:
// when the adventure's book is not yet in memory this loads it and asks the page to redraw.
// The cast of a scene is the GM's own (system op `setSceneCast`), beside the NPCs the arc names.
// One map ships: the map of Rokugan from the owner's art, offered as an image.
//
// An instance whose campaign is its own adventure (VttConfig.ownAdventure = { title }) has no .arc:
// its module is built from the GM's arc (the Scenes pane, state `arc`), sessions as its parts, and
// its cast is the instance's own layer's NPCs. The arc is the GM's alone, so a player's page knows
// only the current scene's id (`current`, shared) and who is in it (`cast`, shared).
window.VttSystem = (function () {
  const D = window.L5RData;
  const State = window.VttState;
  const Bus = window.VttBus;
  const S = () => State.state;
  const Sheet = () => window.L5RSheet;

  const OWN = (window.VttConfig || {}).ownAdventure || null;
  const OWN_ID = 'campaign';
  const moduleId = () => (OWN ? OWN_ID : ((S().campaign || {}).modules || [])[0] || null);
  function ownModule() {
    const scenes = (S().arc || []).map((x) => ({ id: x.id, name: x.title || 'Untitled', session: x.session || null, played: !!x.played, own: true }));
    const phases = [];
    scenes.forEach((s) => {
      const last = phases[phases.length - 1];
      if (last && last.name === s.session) last.scenes.push(s.id);
      else phases.push({ name: s.session, scenes: [s.id] });
    });
    return { id: OWN_ID, name: OWN.title || (window.VttConfig || {}).title || 'The campaign', book: null, own: true, phases, scenes, blocks: [] };
  }
  let asked = {};
  function module() {
    if (OWN) return ownModule();
    const mid = moduleId();
    if (!mid) return null;
    const m = D.module(mid);
    if (m) return m;
    const ref = D.moduleList().find((x) => x.id === mid);
    if (ref && !asked[ref.book]) {
      asked[ref.book] = true;
      D.ensure(['core', ref.book]).then(() => Bus.emit('state:remote', { loaded: true }, { local: true }));
    }
    return null;
  }

  // the GM's arrangement wins where there is one (order.scenes, the engine's op); else the arc's
  function scenes() {
    const m = module();
    if (!m) return [];
    return m.scenes.map((s) => ({ id: s.id, name: s.name, phase: s.part ? s.part.name : (s.session || null), moduleId: m.id }));
  }
  const scene = (id) => {
    const m = module();
    return m ? m.scenes.find((s) => s.id === id) || null : null;
  };
  function currentSceneId() {
    const mid = moduleId();
    const cur = mid ? (S().current || {})[mid] : null;
    const all = scenes();
    if (OWN && !all.length) return cur || null;             // a player's page: no arc, only the id
    // with nothing chosen, the campaign's own arc runs its first unplayed scene
    const next = OWN ? module().scenes.find((s) => !s.played) : null;
    return (all.find((s) => s.id === cur) || next || all[0] || {}).id || null;
  }

  // who is in a scene: the GM's own list (entity or record ids — a record's book loads when opened)
  const castIds = (sceneId) => ((S().cast || {})[sceneId] || []).slice();
  const byId = (id) => D.entity(id) || D.records().find((r) => r.id === id) || null;
  const cast = (sceneId) => castIds(sceneId).map(byId).filter(Boolean);

  // the arc's own named cast: KEY_NPCS / CAST lists and its locations' NPCS, as names resolved
  // to the NPCs the corpus prints (the adventure's book first)
  function namedCast() {
    const m = module();
    if (!m) return [];
    if (m.own) {
      const mine = D.books().filter((b) => b.kind === 'campaign').map((b) => b.id);
      return D.npcs().filter((r) => mine.indexOf(r.book) !== -1);
    }
    const names = [];
    const visit = (list) => (list || []).forEach((b) => {
      if (!b || typeof b !== 'object') return;
      if (b.kw && /NPCS|CAST|ANTAGONISTS|ALLIES|NEUTRAL|MEMBERS/.test(b.kw)) (b.args || []).forEach((a) => (a.l || [a]).forEach((x) => x.c && names.push(x.c)));
      if (b.body) visit(b.body);
      if (b.ent) {
        const e = D.entity(b.ent);
        if (e) visit(e.blocks);
      }
    });
    visit(m.blocks);
    const seen = new Set();
    const out = [];
    names.forEach((n) => {
      if (seen.has(n)) return;
      seen.add(n);
      const e = D.all([m.book]).find((x) => x.name === n && x.type === 'NPC') || D.records().find((r) => r.name === n && r.type === 'NPC');
      if (e) out.push(e);
    });
    return out;
  }

  const maps = () => [];
  const mapDef = () => null;
  const defaultMapId = (sceneId) => sceneId;
  const legend = () => null;
  const mapAssets = () => [{ label: 'Rokugan', image: 'assets/art/rokugan-map.webp' }];

  // ── tokens: the party, and the current scene's cast ────────────────
  function tokenSources() {
    const groups = [];
    const party = (S().party || []).map((m) => ({ id: 'tk-' + m.id, label: m.name, kind: 'party', owner: m.id, ref: m.id }));
    if (party.length) groups.push({ label: 'The party', items: party });
    const sid = currentSceneId();
    const sc = scene(sid);
    const here = sc ? cast(sid).map((e) => ({ label: e.name, kind: 'cast', ref: e.id })) : [];
    if (here.length) groups.push({ label: sc.name, items: here });
    const named = namedCast().filter((e) => !here.some((h) => h.ref === e.id)).map((e) => ({ label: e.name, kind: 'cast', ref: e.id }));
    if (named.length) groups.push({ label: 'The adventure’s cast', items: named });
    return groups;
  }

  const COLORS = { party: '#b62432', cast: '#2a2016', marker: '#9a7b3f' };

  // the rings a token may wear (the table's options menu) and a dozen generic faces for an NPC with
  // no art (assets/tokens/npc/) — ported from sortilege-vtt-teeth (2026-10-09)
  const PALETTE = [
    { name: 'Green', color: '#4f6b3a' }, { name: 'Red', color: '#8f1d22' }, { name: 'Black', color: '#1a1613' }, { name: 'Grey', color: '#6b6154' },
    { name: 'Ochre', color: '#b9842a' }, { name: 'Blue', color: '#2f4f6b' }, { name: 'Violet', color: '#5b3a6b' }, { name: 'Teal', color: '#2f6b5e' }, { name: 'Rust', color: '#a1481e' }, { name: 'Bone', color: '#efe6d3' },
  ];
  function tokenPalette() {
    return PALETTE.map((c) => Object.assign({}, c));
  }
  const ICONS = ['person', 'hood', 'helm', 'crown', 'mitre', 'hat', 'skull', 'wolf', 'crow', 'boar', 'hound', 'purse'];
  function tokenIcons() {
    return ICONS.map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1), image: 'assets/tokens/npc/' + id + '.svg' }));
  }
  const tokenColor = (t) => COLORS[t.kind] || COLORS.marker;
  // a token's word: a samurai's strife and fatigue; an NPC's conflict ranks
  function tokenStatus(t) {
    if (t.kind === 'party') {
      const m = (S().party || []).find((x) => x.id === t.owner);
      return m && Sheet() ? { text: Sheet().tokenText(m), pips: [] } : null;
    }
    const e = t.kind === 'cast' && t.ref ? byId(t.ref) : null;
    if (!e) return null;
    const f = e.fields || {};
    const cr = e.props ? D.num(e, 'Combat Conflict Rank') : f['Combat Conflict Rank'];
    const ir = e.props ? D.num(e, 'Intrigue Conflict Rank') : f['Intrigue Conflict Rank'];
    return { text: [cr != null ? 'Combat ' + cr : null, ir != null ? 'Intrigue ' + ir : null].filter(Boolean).join(' · '), pips: [] };
  }

  function selectToken(t) {
    if (t.kind === 'party') Bus.emit('select', { kind: 'party', id: t.owner });
    else if (t.kind === 'cast' && t.ref) Bus.emit('select', { kind: 'entity', id: t.ref });
  }
  const tokenMenu = () => null;

  // ── the character: the sheet derived from ACTOR "Samurai" (system/l5r5e/sheet.js) ──
  const readCharacter = (obj, fileName) => Sheet().readMember(obj, fileName);
  const downloadCharacter = (m) => Sheet().downloadMember(m);
  const liveSheet = (m, opts) => Sheet().live(m, opts);
  const memberSubtitle = (m) => Sheet().sentence(m.character || {});

  return {
    moduleId, module, scenes, scene, currentSceneId, cast, castIds, namedCast, byId, maps, mapDef, defaultMapId, legend, mapAssets,
    tokenSources, tokenColor, tokenPalette, tokenIcons, tokenStatus, selectToken, tokenMenu,
    liveSheet, readCharacter, downloadCharacter, memberSubtitle,
  };
})();
