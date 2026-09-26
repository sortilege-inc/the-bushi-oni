/* campaign/site/site.js — the campaign's site tabs (M4), loaded at the `site` stage (engine/config.js),
   before engine/site.js first renders. Each tab draws one of campaign/docs/ into a `.bo-doc` container,
   the element campaign/site/bo.css is scoped to. A tab's path is an anchor in its document:
   #chronicle/session-two. The map tab hands its path to window.BO.map (campaign/site/map.js). */
(function () {
  var cache = {};

  function fetchDoc(name) {
    if (!cache[name]) cache[name] = fetch('campaign/docs/' + name + '.html').then(function (r) {
      if (!r.ok) throw new Error('campaign/docs/' + name + '.html: ' + r.status);
      return r.text();
    });
    return cache[name];
  }

  function docTab(name, after) {
    return function (main, path, ctx) {
      var host = document.createElement('div');
      host.className = 'bo-doc bo-tab';
      host.innerHTML = '<p class="bo-muted">Reading…</p>';
      main.appendChild(host);
      fetchDoc(name).then(function (html) {
        if (!host.isConnected) return;
        host.innerHTML = html;
        if (after) after(host, path || [], ctx);
        var id = (path || [])[0];
        var at = id && host.querySelector('#' + CSS.escape(id));
        if (at) at.scrollIntoView();
      }).catch(function (e) { host.textContent = 'Could not read ' + name + ' (' + e.message + ').'; });
    };
  }

  var tabs = [
    { id: 'bushi-oni', label: 'The Bushi Oni', render: docTab('home') },
    { id: 'chronicle', label: 'Chronicle', render: docTab('chronicle') },
    { id: 'personae', label: 'Dramatis Personae', render: docTab('personae') },
    { id: 'map', label: 'Otosan Uchi', render: docTab('map', function (host, path) { window.BO.map(host, path[0]); }) },
  ];
  // the campaign's tabs first: the site opens on the campaign; the menu draws a line after them
  tabs.forEach(function (t) { t.group = 'campaign'; });
  window.VttSiteTabs = tabs.concat(window.VttSiteTabs || []);
})();
