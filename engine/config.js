// engine/config.js — where things are. The one file a deployment edits.
// INSTANCE-OWNED: The Bushi Oni (merge=ours; see ~/Sortilege/VTT/INSTANCES.md and campaign/PLAN.md).
window.VttConfig = {
  system: 'l5r5e',
  title: 'The Bushi Oni',
  channel: 'bushi-oni-vtt',              // BroadcastChannel name (same-machine windows)
  storagePrefix: 'bushi-oni-vtt',        // localStorage key prefix
  dataGlobal: 'L5R5E',                   // the global data/*.js registers into
  // The pages, relative to the site root; the gm/ pages carry <base href="../"> so every
  // path stays root-relative.
  pages: { site: './', gm: 'gm/', table: 'gm/vtt.html', play: 'gm/play.html' },
  // What a fresh browser opens on until a campaign is created or restored, and the seed
  // (engine/state.js seed): the GM's planning documents, moved into the GM tabs (campaign/PLAN.md M3,
  // campaign/source/absorb_planning.py). It fills what the campaign has never had, entry by entry; the
  // pack is the source from then on, edited in the tabs.
  defaultCampaign: { name: 'The Bushi Oni', modules: [], books: [], seed: 'campaign/pack/seed.json' },
  // the campaign is its own adventure: its arc is what the table, the cast and the current scene
  // follow; the published-adventure picker and the Notes document are left out (PLAYBOOK §4b)
  ownAdventure: { title: 'The Bushi Oni' },
  hidePanes: ['adventure', 'notes'],
  paneOrder: ['overview', 'scenes', 'threads', 'encounters', 'cast', 'places', 'party', 'inspector', 'dice', 'rules', 'log', 'lore', 'campaign', 'settings'],
  // the warning in front of /gm/, once per tab (PLAYBOOK §4b.3) — a courtesy, not access control
  gmGate: {
    title: 'The Magistrate’s Papers',
    text: 'Beyond lie the GM’s papers — the conspiracy, the threads, who did what and why. A player who reads on learns what the task force has not. Enter, or turn back and keep the mystery.',
    enter: 'Enter',
    leave: 'Turn back',
  },
  // the public site shows the campaign's tabs and the dice; the books' own text is the GM's to
  // turn on, per browser, in Settings (PLAYBOOK §4b.4)
  siteBooks: false,
  // the three panels the GM page opens on (engine/app.js)
  defaultSlots: ['overview', 'scenes', 'threads'],
  // What this instance adds to the upstream pages (engine/instance.js). Two DSL layers, each a book
  // built by build/build_layer.sh: the GM's characters (campaign/dsl-gm → campaign/data-gm) and the
  // players' (campaign/dsl → campaign/data). Each index puts its book first, so the players' loads last
  // and leads.
  instance: {
    // the campaign's documents, scoped to .bo-doc (campaign/site/bo.css)
    styles: ['campaign/site/bo.css'],
    stages: {
      data: ['campaign/data-gm/index.js', 'campaign/data/index.js', 'campaign/site/portraits.js'],
      // the campaign's tabs (M4): home, Chronicle, Dramatis Personae, the map — campaign/docs/
      site: ['campaign/site/map.js', 'campaign/site/site.js'],
      gm: [], table: [], play: [],
    },
  },
  // The Worker that holds player sessions. Served from localhost the app talks to
  // `wrangler dev` (launch entry bushi-oni-worker); deployed, to the Worker `the-bushi-oni`
  // (campaign/PLAN.md M5; ALLOWED_ORIGIN in worker/wrangler.jsonc is the github.io origin).
  worker: {
    deployed: 'https://the-bushi-oni.sortilege.workers.dev',
    local: 'http://localhost:8799',
  },
};
window.VttConfig.workerUrl = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? window.VttConfig.worker.local : window.VttConfig.worker.deployed;
