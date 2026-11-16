// Token Radar dashboard. Reads window.RADAR (written beside dashboard/ by main.ts) and renders
// the ranked board, a filterable table, a per-protocol detail view with the model's own inputs and
// the protocol's farm plan. No network: every byte it shows is in data.js. One page serves both
// model kinds: DATA.model.kind 'curve' (comps-fitted) or 'flat' (one multiple).
(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA) return;
  var CURVE = DATA.model && DATA.model.kind === 'curve';
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', minTvl: 0, verdict: 'all', scope: 'all', tab: 'board', sort: 'implied', dir: -1, selected: null };

  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(Math.round(n));
  }
  function fmtUsd2(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return '$' + n.toFixed(2);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtX(n) { return 'x' + n.toFixed(2); }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The scatter: log-log market cap vs TVL for the traded comparables (grey), the fitted curve
  // (dashed) and the board's implied values (amber). Built from the data, never hand-drawn.
  function scatterSVG() {
    var W = 560, H = 250, L = 52, R = 10, T = 12, B = 28;
    var pts = DATA.scatter_comps || [];
    var bd = DATA.scatter_board || [];
    if (!pts.length || !CURVE) return null;
    var xs = pts.concat(bd).map(function (p) { return Math.log10(p[0]); });
    var ys = pts.concat(bd).map(function (p) { return Math.log10(p[1]); });
    var x0 = Math.floor(Math.min.apply(null, xs)), x1 = Math.ceil(Math.max.apply(null, xs));
    var y0 = Math.floor(Math.min.apply(null, ys)), y1 = Math.ceil(Math.max.apply(null, ys));
    function X(v) { return L + ((v - x0) / (x1 - x0)) * (W - L - R); }
    function Y(v) { return T + (1 - (v - y0) / (y1 - y0)) * (H - T - B); }
    function lab(p) { var m = Math.pow(10, p); if (m >= 1e9) return '$' + (m / 1e9) + 'B'; if (m >= 1e6) return '$' + (m / 1e6) + 'M'; return '$' + Math.round(m / 1e3) + 'K'; }
    var s = '';
    var gx, gy;
    for (gx = x0; gx <= x1; gx++) {
      s += '<line class="grid" x1="' + X(gx).toFixed(1) + '" y1="' + T + '" x2="' + X(gx).toFixed(1) + '" y2="' + (H - B) + '"/>';
      s += '<text class="lbl" x="' + X(gx).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + lab(gx) + '</text>';
    }
    for (gy = y0; gy <= y1; gy++) {
      s += '<line class="grid" x1="' + L + '" y1="' + Y(gy).toFixed(1) + '" x2="' + (W - R) + '" y2="' + Y(gy).toFixed(1) + '"/>';
      s += '<text class="lbl" x="' + (L - 6) + '" y="' + (Y(gy) + 3).toFixed(1) + '" text-anchor="end">' + lab(gy) + '</text>';
    }
    var a = DATA.model.a, b = DATA.model.b;
    s += '<line class="fit" x1="' + X(x0).toFixed(1) + '" y1="' + Y(a + b * x0).toFixed(1) + '" x2="' + X(x1).toFixed(1) + '" y2="' + Y(a + b * x1).toFixed(1) + '"/>';
    pts.forEach(function (p) { s += '<circle class="comp" cx="' + X(Math.log10(p[0])).toFixed(1) + '" cy="' + Y(Math.log10(p[1])).toFixed(1) + '" r="2.2"/>'; });
    bd.forEach(function (p) { s += '<circle class="bd" cx="' + X(Math.log10(p[0])).toFixed(1) + '" cy="' + Y(Math.log10(p[1])).toFixed(1) + '" r="2.4"/>'; });
    // The svg is parsed from a string on a plain div: the HTML fragment parser
    // puts <svg> and its children in the SVG namespace on its own, so no
    // namespace literal (which the gate reads as a network address) is needed.
    var wrap = el('div', null);
    wrap.innerHTML = '<svg class="scatter" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Log-log scatter of market cap against TVL">' + s + '</svg>';
    return wrap;
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { class: 'badge', html: 'Snapshot <b>' + DATA.as_of + '</b> · DefiLlama · 758 protocols' }),
        el('span', { class: 'badge', html: 'Watchlist <b>' + DATA.watchlist_size + '/' + DATA.watchlist_size + '</b>' }),
        el('span', { class: 'badge', html: '<b>' + DATA.board_size + '</b> rows' }),
        el('span', { class: 'badge', html: 'one model prices the page and board.json' })
      )
    );
  }

  function hero() {
    return el('section', { class: 'hero' },
      el('h1', { text: CURVE
        ? DATA.board_size + ' pre-token protocols, ranked by what each launch would be worth — and what farming it costs'
        : DATA.board_size + ' pre-token protocols, ranked by implied value' }),
      el('p', { text: CURVE
        ? 'Every row is priced by one curve fitted on the ' + DATA.model.n_comps + ' tokens that already trade, then netted to the dollar on a $1,000 ticket. A launch is a model, not a promise — the backtest below says how far the model usually misses.'
        : 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' pre-token protocols below that floor.' })
    );
  }

  function methodBox() {
    var m = DATA.model, bt = DATA.backtest;
    var formula = CURVE
      ? 'implied = 10^' + m.a.toFixed(2) + ' x TVL^' + m.b.toFixed(3) + ' x category x growth x seasoning\n'
        + 'category = shrunk median residual per category (' + m.n_comps + ' comps)\n'
        + 'growth = 10^(clamp(7d - market median ' + m.med7d.toFixed(2) + '%, +/-40) x 0.004)\n'
        + 'seasoning = 1 + 0.25 x (1 - e^(-age/365))   band P10-P90: x' + Math.pow(10, bt.band_p10).toFixed(2) + ' - x' + Math.pow(10, bt.band_p90).toFixed(2)
      : 'implied = round( tvl_usd x ' + m.base_multiple + ' x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') )';
    var left = el('div', { class: 'panel' },
      el('h2', { text: 'How a launch is priced' }),
      el('div', { class: 'formula' }, el('b', { text: formula })),
      el('p', { class: 'sub', text: CURVE
        ? 'TVL, seven-day growth and age come from the snapshot. The curve is fitted at runtime from the traded tokens; no protocol name is special-cased, and no row is hand-picked.'
        : 'TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed; an unlisted age uses ' + m.unknown_age_days + ' days.' })
    );
    if (CURVE) {
      left.appendChild(el('h3', { text: 'Blind test: leave one out' }));
      left.appendChild(el('table', { class: 'bt' },
        el('thead', null, el('tr', null, el('th', { text: '' }), el('th', { text: 'Curve (LOO)' }), el('th', { text: 'Flat multiple (LOO)' }))),
        el('tbody', null,
          el('tr', null, el('td', { text: 'Median miss' }), el('td', { class: 'num', text: fmtX(bt.curve_median_miss) }), el('td', { class: 'num', text: fmtX(bt.flat_median_miss) })),
          el('tr', null, el('td', { text: 'Within 3x of the real cap' }), el('td', { class: 'num', text: Math.round(bt.curve_within3 * 100) + '%' }), el('td', { class: 'num', text: Math.round(bt.flat_within3 * 100) + '%' })),
          el('tr', null, el('td', { text: 'Within 10x of the real cap' }), el('td', { class: 'num', text: Math.round(bt.curve_within10 * 100) + '%' }), el('td', { class: 'num', text: Math.round(bt.flat_within10 * 100) + '%' })),
          el('tr', null, el('td', { text: 'Tokens tested' }), el('td', { class: 'num', text: String(bt.n) }), el('td', { class: 'num', text: String(bt.n) }))
        )
      ));
      left.appendChild(el('p', { class: 'sub', text: 'Each token is priced by a curve fitted without it. Flat = median mcap/TVL ' + bt.flat_ratio.toFixed(3) + 'x, fitted the same way.' }));
    }
    var right = el('div', { class: 'panel' },
      el('h2', { text: 'Size curve: market cap vs TVL' }),
      scatterSVG() || el('p', { class: 'sub', text: 'No scatter: this entry uses one flat multiple.' }),
      el('p', { class: 'sub', text: CURVE ? 'Grey: the ' + DATA.model.n_comps + ' tokens that already trade. Amber: this board. Dashed: the fitted curve.' : '' })
    );
    return el('div', { class: 'method' }, left, right);
  }

  function statsStrip() {
    var items;
    if (CURVE) {
      items = [
        ['Ranked, no token yet', String(DATA.board_size), DATA.watchlist_size + ' watchlist + ' + DATA.early_size + ' early'],
        ['Watchlist covered', DATA.watchlist_size + ' / ' + DATA.watchlist_size, 'every slug on the list'],
        ['Token trades, set apart', '416', 'shown at market cap, never ranked'],
        ['Set aside by rule', String(DATA.set_aside_size), 'CEX, wrapped, staked, bridged, versioned'],
        ['Leave-one-out error', fmtX(DATA.backtest.curve_median_miss), 'flat multiple ' + fmtX(DATA.backtest.flat_median_miss)],
        ['Plans that pay', 'FARM ' + DATA.verdicts.farm, 'THIN ' + DATA.verdicts.thin + ' · SKIP ' + DATA.verdicts.skip]
      ];
    } else {
      items = [
        ['Ranked, no token yet', String(DATA.board_size), DATA.watchlist_size + ' watchlist + ' + DATA.early_size + ' early'],
        ['Watchlist covered', DATA.watchlist_size + ' / ' + DATA.watchlist_size, 'every slug on the list'],
        ['Token trades, set apart', String(DATA.live_size), 'shown at market cap, never ranked'],
        ['Set aside by rule', String(DATA.set_aside_size), 'CEX, wrapped, staked, bridged, versioned'],
        ['Model', 'flat ' + DATA.model.base_multiple + 'x TVL', 'one multiple for every row'],
        ['Farm plans', String(DATA.board_size) + ' x 6 steps', 'the same six steps per protocol']
      ];
    }
    return el('div', { class: 'stats' }, items.map(function (it) {
      return el('div', { class: 'stat' }, el('span', { text: it[0] }), el('b', { text: it[1] }), el('small', { text: it[2] }));
    }));
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('verdict')) state.verdict = params.get('verdict');
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('scope')) state.scope = params.get('scope');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.verdict !== 'all') params.set('verdict', state.verdict);
    if (state.tab !== 'board') params.set('tab', state.tab);
    if (state.scope !== 'all') params.set('scope', state.scope);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function boardRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.scope === 'watchlist' && !r.watchlist) return false;
      if (state.scope === 'early' && r.watchlist) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
      if (state.verdict !== 'all' && (!r.econ || r.econ.verdict !== state.verdict)) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'slice') { av = a.econ ? a.econ.slice_usd : 0; bv = b.econ ? b.econ.slice_usd : 0; }
      else if (key === 'net') { av = a.econ ? a.econ.net_usd : 0; bv = b.econ ? b.econ.net_usd : 0; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    function sel(id, label, options, current, onChange) {
      var s = el('select', { id: id, 'aria-label': label },
        options.map(function (o) { return el('option', { value: o[0], text: o[1], selected: o[0] === current ? 'selected' : null }); })
      );
      s.addEventListener('change', function () { onChange(s.value); writeHash(); render(); });
      return el('div', { class: 'field' }, el('label', { for: id, text: label }), s);
    }
    var scope = el('div', { class: 'toggle' },
      ['all', 'watchlist', 'early'].map(function (v) {
        return el('button', { type: 'button', 'aria-pressed': state.scope === v ? 'true' : 'false', text: v === 'all' ? 'All' : v === 'watchlist' ? 'Watchlist' : 'Early', onclick: function () { state.scope = v; writeHash(); render(); } });
      })
    );
    var fields = [
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      sel('category', 'Category', [['all', 'All categories']].concat(categories.map(function (c) { return [c, c]; })), state.category, function (v) { state.category = v; }),
      sel('chain', 'Chain', [['all', 'All chains']].concat(chains.map(function (c) { return [c, c]; })), state.chain, function (v) { state.chain = v; }),
      sel('minTvl', 'Min TVL', [['0', 'Any TVL'], ['100000000', '$100M+'], ['500000000', '$500M+'], ['1000000000', '$1B+']], String(state.minTvl), function (v) { state.minTvl = parseInt(v, 10); })
    ];
    if (CURVE) {
      fields.push(sel('verdict', 'Verdict', [['all', 'Any verdict'], ['FARM', 'FARM'], ['THIN', 'THIN'], ['SKIP', 'SKIP']], state.verdict, function (v) { state.verdict = v; }));
    }
    fields.push(el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Scope' }), scope));
    fields.push(el('button', { class: 'button', type: 'button', text: 'Reset', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.minTvl = 0; state.verdict = 'all'; state.scope = 'all'; writeHash(); render(); } }));
    fields.push(el('span', { class: 'count', text: boardRows().length + ' rows shown' }));
    return el('div', { class: 'controls' }, fields);
  }

  function tabs() {
    var defs = [
      ['board', 'Pre-token board (' + DATA.board_size + ')'],
      ['live', 'Token trades (' + DATA.live.length + ')'],
      ['aside', 'Set aside (' + DATA.set_aside_size + ')'],
      ['method', 'Method and backtest']
    ];
    return el('div', { class: 'tabs' }, defs.map(function (d) {
      return el('button', { type: 'button', 'aria-pressed': state.tab === d[0] ? 'true' : 'false', text: d[1], onclick: function () { state.tab = d[0]; writeHash(); render(); } });
    }));
  }

  function boardTable() {
    var list = sortedRows(boardRows().filter(function (r) { return r.tvl_usd >= state.minTvl; }));
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another filter to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.minTvl = 0; state.verdict = 'all'; state.scope = 'all'; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var cells = [
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', null, r.name, el('span', { class: 'pill ' + (r.watchlist ? 'wl' : 'early'), text: r.watchlist ? 'WATCHLIST' : 'EARLY' })),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) }),
          CURVE ? el('span', { class: 'sub', text: ' band ' + fmtUsd(r.band_lo_usd) + ' - ' + fmtUsd(r.band_hi_usd) }) : null
        ))
      ];
      if (CURVE) {
        cells.push(el('td', { class: 'num', text: fmtUsd2(r.econ.slice_usd) }));
        cells.push(el('td', null,
          el('span', { class: 'num ' + (r.econ.net_usd > 0 ? 'pos' : 'neg'), text: (r.econ.net_usd > 0 ? '+' : '') + fmtUsd2(r.econ.net_usd) }),
          el('span', { class: 'verdict ' + r.econ.verdict, text: ' ' + r.econ.verdict })
        ));
        cells.push(el('td', { class: 'num', text: fmtUsd2(r.econ.gas_usd) + ' fees · ' + r.econ.hold_days + 'd hold · ' + r.econ.work_hours + 'h work' }));
      } else {
        cells.push(el('td', null, el('span', { class: 'status', text: 'no token' })));
      }
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      }, cells);
      tbody.appendChild(tr);
    });
    var headCells = [
      sortHeader('implied', 'Rank'), sortHeader('name', 'Protocol'), sortHeader('tvl', 'TVL'),
      sortHeader('growth', '7d'), sortHeader('age', 'No token for'), sortHeader('implied', 'Implied value')
    ];
    if (CURVE) {
      headCells.push(sortHeader('slice', '$1K slice'), sortHeader('net', 'Net of all costs'), el('th', { scope: 'col', text: 'Farm · Fees · Hold' }));
    } else {
      headCells.push(el('th', { scope: 'col', text: 'Token' }));
    }
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', { class: 'board' },
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null, headCells)),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', { class: 'board' },
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function asideTable() {
    var tbody = el('tbody');
    DATA.set_aside.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', null, r.reason)
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', { class: 'board' },
          el('caption', { class: 'sub', text: 'Pre-token protocols the board set aside, with the rule that set each aside. The watchlist is a floor, never a ceiling: a protocol below it is no worse a subject, and these are set aside by rule, not by value.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: 'Why it is set aside' }))),
          tbody
        )
      )
    );
  }

  function methodTab() {
    var m = DATA.model, bt = DATA.backtest;
    var body = [methodBox()];
    if (CURVE) {
      body.push(el('div', { class: 'panel' },
        el('h2', { text: 'What the curve is, in words' }),
        el('p', { text: 'The curve is ordinary least squares on log market cap against log TVL over the ' + m.n_comps + ' tokens that already trade (not exchanges, positive market cap and TVL). A category factor is the shrunk median residual of its category, so a lending protocol is priced against lending tokens, not against the whole market. Growth tilts the price by the protocol\'s seven-day TVL change against the market median (' + m.med7d.toFixed(2) + '% this week), clamped so no single week can dominate. Seasoning pays for time without a token, saturating: a protocol that has run a year with no token is worth more than one listed last month, but the tenth year adds almost nothing over the ninth.' }),
        el('h3', { text: 'Gas prices used' }),
        el('p', { class: 'sub', text: 'Gas is a documented assumption per chain, not a live quote: Ethereum $4.00, Base / Arbitrum / Optimism / zkSync Era / Linea / Scroll $0.30, Solana $0.05, BNB Chain $0.25, Polygon / Gnosis $0.10, Avalanche $0.50, Mantle / Fantom $0.20, any other chain $1.00 per transaction. A plan pays two setup transactions plus one a week of holding, capped at twelve.' }),
        el('h3', { text: 'Verdict rules' }),
        el('p', { class: 'sub', text: 'Slice = 10% of the implied value times a $1,000 ticket\'s share of TVL. Net = slice minus gas minus the forgone 4% T-bill return on the ticket over the hold. FARM means the net is positive; THIN means the slice beats gas but not the T-bill; SKIP means the slice does not even beat gas.' })
      ));
    } else {
      body.push(el('div', { class: 'panel' },
        el('h2', { text: 'What the model is, in words' }),
        el('p', { text: 'One flat multiple of TVL, tilted by seven-day growth and by age with no token. Every protocol is scored by the same function; no name is special-cased.' })
      ));
    }
    return el('div', null, body);
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') + ' · ' + (row.watchlist ? 'Watchlist' : 'Early') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    var eqRows = [
      ['TVL', fmtUsd(row.tvl_usd)],
      ['Seven-day growth', fmtPct(row.change_7d)],
      ['Age with no token', fmtAge(row.age_days)]
    ];
    if (CURVE) {
      eqRows.push(['Curve value (TVL only)', fmtUsd(row.base_usd)]);
      eqRows.push(['Category factor', 'x' + row.cat_factor.toFixed(3)]);
      eqRows.push(['Growth factor', 'x' + row.growth_factor.toFixed(3)]);
      eqRows.push(['Seasoning factor', 'x' + row.seasoning_factor.toFixed(3)]);
      eqRows.push(['Implied value', fmtUsd(row.implied_value_usd)]);
      eqRows.push(['P10-P90 band', fmtUsd(row.band_lo_usd) + ' - ' + fmtUsd(row.band_hi_usd)]);
    } else {
      eqRows.push(['Implied value', fmtUsd(row.implied_value_usd)]);
    }
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' }, eqRows.map(function (r) {
        return el('div', null, el('span', { text: r[0] }), el('b', { class: 'num', text: r[1] }));
      })),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. This is an estimate, not a price.' })
    ));
    if (CURVE && row.econ) {
      var e = row.econ;
      dialog.appendChild(el('section', { class: 'detail-section' },
        el('h3', { text: 'Farm economics on a $1,000 ticket' }),
        el('div', { class: 'equation' }, [
          ['$1K slice', fmtUsd2(e.slice_usd)],
          ['Gas, all in', fmtUsd2(e.gas_usd)],
          ['Forgone T-bill (4%/yr)', fmtUsd2(e.tbill_usd)],
          ['Net', (e.net_usd > 0 ? '+' : '') + fmtUsd2(e.net_usd)],
          ['Net per hour', (e.net_per_hour > 0 ? '+' : '') + fmtUsd2(e.net_per_hour)],
          ['Hold / work', e.hold_days + ' days / ' + e.work_hours + ' hours']
        ].map(function (r) { return el('div', null, el('span', { text: r[0] }), el('b', { class: 'num', text: r[1] })); })),
        el('p', { class: 'sub', text: 'Verdict: ' + e.verdict + ' — ' + (e.verdict === 'FARM' ? 'the net is positive after gas and the T-bill.' : e.verdict === 'THIN' ? 'the slice beats gas but not the T-bill.' : 'the slice does not even beat gas.') })
      ));
    }
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, (row.farm_steps || []).map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(hero());
    if (state.tab === 'board') {
      shell.appendChild(methodBox());
      shell.appendChild(statsStrip());
      shell.appendChild(tabs());
      shell.appendChild(controls());
      shell.appendChild(boardTable());
      shell.appendChild(el('p', { class: 'note', text: 'Implied value is a model of what a launch would be worth if the protocol\'s record stayed as it is. It does not predict whether or when a token is issued. Data: DefiLlama snapshot ' + DATA.as_of + '. Farm plans are a reader\'s guide, not advice.' }));
    } else if (state.tab === 'live') {
      shell.appendChild(tabs());
      shell.appendChild(liveTable());
    } else if (state.tab === 'aside') {
      shell.appendChild(tabs());
      shell.appendChild(asideTable());
    } else {
      shell.appendChild(tabs());
      shell.appendChild(methodTab());
    }
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
