// system/l5r5e/settings.js — the GM's Settings pane: one section per feature that needs this
// browser's own configuration (the AI suggestions' key, the lore server's address and token). A feature
// adds its section with L5RSettings.section({ id, render(container, redraw) }); everything a
// section saves is its own, in this browser's localStorage, and never enters the pack or a session.
window.L5RSettings = (function () {
  const sections = [];
  const section = (s) => { if (!sections.some((x) => x.id === s.id)) sections.push(s); };
  function renderPane(container) {
    const { el } = window.VttRender;
    const draw = () => {
      container.innerHTML = '';
      container.appendChild(el('h4', {}, ['Settings']));
      container.appendChild(el('p', { class: 'muted small' }, ['Saved in this browser only — not in the pack, not shared with the table.']));
      sections.forEach((s) => { const box = el('div', { class: 'paper settings-section' }); container.appendChild(box); s.render(box, draw); });
    };
    draw();
  }
  if (window.VttPanels) window.VttPanels.register('settings', { label: 'Settings', render: renderPane });

  // The public site's book tabs (engine/site.js): off on an instance unless turned on — here, for
  // this browser only. Nobody else's view of the site changes.
  const CFG = window.VttConfig || {};
  const BOOKS_KEY = (CFG.storagePrefix || 'sortilege-vtt') + ':site-books';
  section({ id: 'site-books', render: (box, redraw) => {
    const { el } = window.VttRender;
    let on = !!CFG.siteBooks;
    try { const v = localStorage.getItem(BOOKS_KEY); if (v !== null) on = v === '1'; } catch (e) { /* default */ }
    box.appendChild(el('div', { class: 'guidance-k' }, ['The books on the site']));
    box.appendChild(el('p', { class: 'muted small' }, ['Whether the site shows the books’ own text — the shelf, the lore, adventures and search. Off, the schools, techniques, NPCs, characters, the creator and the dice still show, and a link to one entry still opens it. This setting is for this browser only; other visitors see the site’s default (' + (CFG.siteBooks ? 'on' : 'off') + ').']));
    box.appendChild(el('label', { class: 'set-row' }, [
      el('input', { type: 'checkbox', checked: on || null, onchange: (ev) => { try { localStorage.setItem(BOOKS_KEY, ev.target.checked ? '1' : '0'); } catch (e) { /* private mode */ } redraw(); } }),
      ' Show the books on the site, in this browser',
    ]));
  } });

  // Settings ▸ Layout (ported from sortilege-vtt-teeth, 2026-10-09): how the GM page arranges its regions on a wide screen
  function layoutIcon(cols) {
    const NS = 'http://www.w3.org/2000/svg';
    const W = 46;
    const H = 32;
    const gap = 2;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('class', 'layout-ico');
    const cw = (W - gap * (cols.length + 1)) / cols.length;
    cols.forEach((cells, ci) => {
      const x = gap + ci * (cw + gap);
      const ch = (H - gap * (cells.length + 1)) / cells.length;
      cells.forEach((_r, ri) => {
        const rect = document.createElementNS(NS, 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', gap + ri * (ch + gap));
        rect.setAttribute('width', cw);
        rect.setAttribute('height', ch);
        rect.setAttribute('rx', 1.5);
        svg.appendChild(rect);
      });
    });
    return svg;
  }
  section({ id: 'layout', render: (box, redraw) => {
    const { el } = window.VttRender;
    if (!(window.VttApp && window.VttApp.layouts)) return;
    const cur = window.VttApp.currentLayout();
    box.appendChild(el('div', { class: 'guidance-k' }, ['Layout']));
    box.appendChild(el('p', { class: 'muted small' }, ['How the GM page arranges its panels on a wide screen. Each region has its own picker in its heading, so one can hold a panel while the others change. Click a region to select it; a nav choice then opens there.']));
    box.appendChild(el('div', { class: 'layout-picker' }, window.VttApp.layouts().map((L) => el('button', {
      class: 'layout-opt' + (L.id === cur ? ' on' : ''), type: 'button', title: L.label,
      onclick: () => { window.VttApp.setLayout(L.id); redraw(); },
    }, [layoutIcon(L.cols), el('span', { class: 'layout-opt-label' }, [L.label])]))));
  } });
  return { section };
})();
