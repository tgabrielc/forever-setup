// The downloads page's choices: cards, "Help me choose" questions and Fine-tune, all ending in one Forever-Setup.bat.
// Untouched, a card downloads its own preset file from the release (the installer asks the rest). Changed, the page
// writes the installer's answers into the .bat (FOREVER_ANSWERS, "|" between) and the installer goes straight to its
// summary. The data (setup-data) is made by make_page.ps1 from the installer's own lists; answers use its words.
(function () {
  'use strict';
  var D = JSON.parse(document.getElementById('setup-data').textContent);
  var $ = function (id) { return document.getElementById(id); };
  var big = $('download'), label = $('dl-name'), note = $('dl-note'), tune = $('tune'), body = $('tune-body'), quiz = $('quiz');
  var REL = big.href.replace(/[^\/]+$/, '');
  var noteDefault = note.innerHTML;
  var LOOK = [['explore', 'Exploration: how do you find your way?'], ['plates', 'Nameplates and target frame'],
    ['fade', 'Interface while you explore'], ['camera', 'Camera'], ['click', 'Left click']];
  var preset = function (n) { return D.presets.filter(function (p) { return p.n === n; })[0]; };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  var kindOf = function (p) { return p.parts.indexOf('Journey') >= 0 ? 'journey' : p.parts.indexOf('Core') >= 0 ? 'core' : 'fixed'; };
  var std = D.parts.filter(function (p) { return p.std; }).map(function (p) { return p.n; });
  var S;

  // --- state: a preset's answers, as an Enter on every installer question gives them
  function load(p) {
    S = { p: p, kind: kindOf(p), parts: {}, off: {}, look: { explore: 0, plates: 0, fade: 0, camera: 0, click: 0 }, cvar: {}, shaman: false, jr: {} };
    // "Let me pick" has no parts of its own (its list sets them): it starts from the standard ones.
    var on = p.parts.indexOf('Pick') >= 0 ? std : p.parts;
    D.parts.forEach(function (g) { S.parts[g.n] = on.indexOf(g.n) >= 0; });
    D.look.cvars.forEach(function (c) { S.cvar[c[0]] = true; });
    D.journey.forEach(function (j) { S.jr[j.n] = !j.opt; });
  }
  // Parts the look answers bring (the installer's hidden parts).
  function hiddenOn() {
    var h = [];
    if (S.look.explore !== 1) h.push('Compass');
    if (S.look.explore === 0) h.push('CompassOnly');
    if (S.look.plates === 0) h.push('Plates');
    if (S.look.camera === 0) h.push('Camera');
    if (S.shaman) h.push('Shaman');
    return h;
  }
  var must = function (f) { return D.must.indexOf(f) >= 0 || (f === 'HideAnything' && S.look.explore === 0); };
  var rowsOf = function (part) { return D.rows.filter(function (r) { return r.p === part; }); };
  var anyOn = function (part) { return rowsOf(part).some(function (r) { return must(r.f) || !S.off[r.f]; }); };

  function answers() {
    if (S.kind === 'fixed') return '';
    var a = [];
    if (S.kind === 'journey') {
      a.push('Journey');
      // The first two (Social Diary, Journey Icons) are always in, as in the installer.
      D.journey.forEach(function (j, i) { if (i > 1 && !S.jr[j.n]) j.f.forEach(function (f) { a.push('Skip:' + f); }); });
      return a.join('|');
    }
    var hid = hiddenOn(), parts = [];
    D.parts.forEach(function (g) { if (g.n === 'Core' || (S.parts[g.n] && anyOn(g.n))) parts.push(g.n); });
    a = a.concat(parts, hid);
    if (S.look.explore !== 0) a.push('Minimap');
    if (S.look.plates === 1) a.push('OriginalPlates');
    if (S.look.fade === 1) a.push('NoFade');
    if (S.look.camera === 1) a.push('StandardCamera');
    if (S.look.click === 1) a.push('InteractClick');
    if (!S.shaman) a.push('NoShaman');
    D.look.cvars.forEach(function (c) { if (!S.cvar[c[0]]) a.push('OwnCVar:' + c[0]); });
    D.rows.forEach(function (r) {
      if ((parts.indexOf(r.p) >= 0 || hid.indexOf(r.p) >= 0) && S.off[r.f] && !must(r.f))
        [r].concat(r.w).forEach(function (x) { a.push('Skip:' + x.f); });
    });
    return a.join('|');
  }

  // --- the big button: the card's own file, or a .bat with the answers in it
  var bat = new TextDecoder().decode(Uint8Array.from(atob(D.bat), function (c) { return c.charCodeAt(0); }));
  var blobUrl = null;
  function refresh() {
    label.textContent = S.p.n;
    $('tune-name').textContent = S.p.n;
    var ans = answers(), plain = ans === '' || ans === fresh(S.p);
    if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
    // (The installer refuses anything it doesn't know; this only keeps the batch line safe.)
    if (plain || !/^[A-Za-z0-9 _:&!|]+$/.test(ans)) {
      big.href = REL + 'Forever-Setup-' + S.p.n.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.bat';
      big.setAttribute('download', '');
      note.innerHTML = noteDefault;
    } else {
      blobUrl = URL.createObjectURL(new Blob([bat.replace('set "FOREVER_ANSWERS="', 'set "FOREVER_ANSWERS=' + ans + '"')], { type: 'application/octet-stream' }));
      big.href = blobUrl; big.setAttribute('download', 'Forever-Setup.bat');
      note.innerHTML = 'Your choices are inside this small <code>.bat</code> file: the installer goes straight to its summary. ' +
        'Your account, characters and the settings per addon get their usual answers there; pick <i>Change my answers</i> in it to see them all.';
    }
    $('tune-sum').textContent = summary();
    document.querySelectorAll('[data-count]').forEach(function (el) {
      var rs = rowsOf(el.getAttribute('data-count'));
      el.textContent = rs.filter(function (r) { return must(r.f) || !S.off[r.f]; }).length + ' of ' + rs.length;
    });
  }
  function fresh(p) { var keep = S; load(p); var a = answers(); S = keep; return a; }
  function summary() {
    if (S.kind === 'journey') { var n = D.journey.filter(function (j) { return S.jr[j.n]; }).length; return n + ' of ' + D.journey.length + ' journey addons'; }
    var parts = D.parts.filter(function (g) { return g.n === 'Core' || (S.parts[g.n] && anyOn(g.n)); }).length;
    var out = D.rows.filter(function (r) { return S.off[r.f] && !must(r.f) && (S.parts[r.p] || hiddenOn().indexOf(r.p) >= 0); }).length;
    return parts + ' parts' + (out ? ', ' + out + ' addon' + (out > 1 ? 's' : '') + ' left out' : '') + ', ' +
      ['compass bar, no minimap', 'minimap, no compass bar', 'compass bar and minimap'][S.look.explore] + ', ' + (S.look.plates ? 'original' : 'Cinematic') + ' nameplates';
  }

  // --- Fine-tune
  function radios(key, title) {
    return '<fieldset><legend>' + esc(title) + '</legend>' + D.look[key].map(function (o, i) {
      return '<label class="opt"><input type="radio" name="look-' + key + '" value="' + i + '"' + (S.look[key] === i ? ' checked' : '') +
        '> <span><b>' + esc(o[0]) + '</b> ' + esc(o[1]) + '</span></label>';
    }).join('') + '</fieldset>';
  }
  function rowHtml(r) {
    var m = must(r.f), on = m || !S.off[r.f];
    return '<li><label class="opt"><input type="checkbox" data-row="' + esc(r.f) + '"' + (on ? ' checked' : '') + (m ? ' disabled' : '') + '> <span><b>' + esc(r.t) + '</b>' +
      (r.h ? ' <i class="own">helper</i>' : '') + (m ? ' <i class="tag">always</i>' : '') + ' <span class="about">' + esc(r.a) + '</span>' +
      (r.w.length ? '<span class="with">With it: ' + r.w.map(function (w) { return esc(w.t); }).join(', ') + '</span>' : '') + '</span></label></li>';
  }
  function partsHtml() {
    var open = {};
    body.querySelectorAll('.tpart details[open]').forEach(function (d) { open[d.getAttribute('data-part')] = true; });
    var list = D.parts.filter(function (g) { return rowsOf(g.n).length; }).map(function (g) { return { n: g.n, t: g.n, a: g.a, why: g.why, locked: g.n === 'Core' }; })
      .concat(hiddenOn().filter(function (h) { return rowsOf(h).length; }).map(function (h) { return { n: h, t: D.hidden[h], a: 'Comes with your look answers above.', hid: true }; }));
    return list.map(function (g) {
      var box = g.hid ? '<span class="tp-dot" aria-hidden="true"></span>' :
        '<input type="checkbox" data-part="' + esc(g.n) + '" aria-label="' + esc(g.t) + '"' + (g.locked || S.parts[g.n] ? ' checked' : '') + (g.locked ? ' disabled' : '') + '>';
      return '<div class="tpart' + (g.hid || g.locked || S.parts[g.n] ? '' : ' off') + '">' + box + '<details data-part="' + esc(g.n) + '"' + (open[g.n] ? ' open' : '') + '><summary><span class="t-head"><b>' + esc(g.t) +
        '</b><span class="t-count" data-count="' + esc(g.n) + '"></span></span><span class="gist">' + esc(g.a) + '</span></summary>' +
        (g.why ? '<p class="why">' + esc(g.why) + '</p>' : '') + '<ul class="trows">' + rowsOf(g.n).map(rowHtml).join('') + '</ul></details></div>';
    }).join('');
  }
  function render() {
    tune.hidden = S.kind === 'fixed';
    if (S.kind === 'journey') {
      body.innerHTML = '<p class="small">What records your journey. Social Diary and Journey Icons are always in; Spoken and Lore Forever start unticked because they are large; one you already have stays. Anything else you untick is taken out of your game if it is there.</p><ul class="trows jr">' +
        D.journey.map(function (j, i) {
          return '<li><label class="opt"><input type="checkbox" data-jr="' + esc(j.n) + '"' + (i < 2 || S.jr[j.n] ? ' checked' : '') + (i < 2 ? ' disabled' : '') +
            '> <span><b>' + esc(j.n) + '</b> <span class="about">' + esc(j.a) + '</span></span></label></li>';
        }).join('') + '</ul>';
    } else if (S.kind === 'core') {
      body.innerHTML = '<div class="tlook">' + LOOK.map(function (l) { return radios(l[0], l[1]); }).join('') +
        '<fieldset><legend>Game options and extras</legend>' + D.look.cvars.map(function (c) {
          return '<label class="opt"><input type="checkbox" data-cvar="' + esc(c[0]) + '"' + (S.cvar[c[0]] ? ' checked' : '') + '> <span>' + esc(c[1]) + '</span></label>';
        }).join('') + '<label class="opt"><input type="checkbox" data-shaman' + (S.shaman ? ' checked' : '') + '> <span><b>ShamanPower</b> totem bar (only useful on a shaman)</span></label></fieldset></div>' +
        '<h3>Addons</h3><p class="small">Tick a part, open it to pick single addons. Voice packs and the helpers made for an addon come with it. An addon you untick is taken out of your game if it is there.</p><div class="tparts" id="tparts">' + partsHtml() + '</div>';
    }
    refresh();
  }
  body.addEventListener('change', function (e) {
    var t = e.target, a;
    if ((a = t.getAttribute('data-row')) !== null) {
      S.off[a] = !t.checked;
      var r = D.rows.filter(function (x) { return x.f === a; })[0];
      if (t.checked && S.parts[r.p] === false) { S.parts[r.p] = true; $('tparts').innerHTML = partsHtml(); }
    } else if ((a = t.getAttribute('data-part')) !== null) {
      S.parts[a] = t.checked;
      if (t.checked && !anyOn(a)) rowsOf(a).forEach(function (r) { delete S.off[r.f]; });
      $('tparts').innerHTML = partsHtml();
      body.querySelector('[data-part="' + a + '"]').focus();
    } else if ((a = t.getAttribute('data-cvar')) !== null) S.cvar[a] = t.checked;
    else if ((a = t.getAttribute('data-jr')) !== null) S.jr[a] = t.checked;
    else if (t.hasAttribute('data-shaman')) { S.shaman = t.checked; $('tparts').innerHTML = partsHtml(); }
    else if (t.name && t.name.indexOf('look-') === 0) { S.look[t.name.slice(5)] = +t.value; $('tparts').innerHTML = partsHtml(); }
    refresh();
  });

  // --- cards
  function choose(name, keepState) {
    var r = document.querySelector('input[name=preset][data-name="' + name + '"]');
    if (r) r.checked = true;
    if (!keepState) load(preset(name));
    render();
  }
  $('cards').addEventListener('change', function (e) {
    if (e.target.name !== 'preset') return;
    choose(e.target.getAttribute('data-name'));
    if (S.p.parts.indexOf('Pick') >= 0) tune.open = true;
  });

  // --- Help me choose: a few questions, then the suggestion loaded into Fine-tune
  var KINDS = [['Full experience', 'The whole experience', 'The cinematic look, quests and maps, profession journals, your journey page, and quests read aloud.'],
    ['Gameplay only', 'All of it, without the voices', 'The same without Spoken narration: a much smaller download.'],
    ['Journey only', 'Only the Journey story page', 'Keep your own addons; get just the ones the story page is built from.'],
    ['Narration only', 'Only the narration', 'Spoken and Lore Forever read quests, books and lore aloud. The rest of your addons stay as they are.'],
    ['Menagerie only', 'Only the Menagerie card game', 'Collect creature cards and battle with them. Nothing else changes.']];
  var Q = [{ id: 'kind', q: 'What do you want from the setup?', opts: KINDS.map(function (k) { return [k[1], k[2]]; }) }]
    .concat(LOOK.map(function (l) { return { id: l[0], core: true, q: l[1], opts: D.look[l[0]] }; }))
    .concat([{ id: 'extra', core: true, multi: true, q: 'Anything to add or leave out?' },
      { id: 'voices', journey: true, q: 'Include the narration addons?', opts: [['No', 'keep the download small'], ['Yes', 'Spoken and Lore Forever also record what you heard on the page (over 1 GB of voices)']] }]);
  var A, at;
  function steps() {
    var k = A.kind === undefined ? null : kindOf(preset(KINDS[A.kind][0]));
    return Q.filter(function (s) { return !(s.core && k !== 'core') && !(s.journey && k !== 'journey'); });
  }
  function ask() {
    var list = steps(), s = list[at];
    if (!s) return finish();
    var head = '<p class="q-step">Question ' + (at + 1) + (A.kind === undefined ? '' : ' of ' + list.length) + '</p><h3>' + esc(s.q) + '</h3>';
    var back = at ? '<button type="button" class="link" data-back>Back</button>' : '';
    if (s.multi) {
      var p = preset(KINDS[A.kind][0]), on = A.extra || p.parts;
      quiz.innerHTML = head + '<div class="q-multi">' + D.parts.filter(function (g) { return g.n !== 'Core'; }).map(function (g) {
        return '<label class="opt"><input type="checkbox" value="' + esc(g.n) + '"' + (on.indexOf(g.n) >= 0 ? ' checked' : '') + '> <span><b>' + esc(g.n) + '</b> ' + esc(g.a) + '</span></label>';
      }).join('') + '<label class="opt"><input type="checkbox" value="Shaman"' + (A.shaman ? ' checked' : '') + '> <span><b>ShamanPower</b> totem bar (only useful on a shaman)</span></label></div>' +
        '<p class="q-nav">' + back + '<button type="button" class="btn" data-next>Next</button></p>';
    } else {
      quiz.innerHTML = head + '<div class="q-opts">' + s.opts.map(function (o, i) {
        return '<button type="button" class="q-opt' + (A[s.id] === i ? ' on' : '') + '" data-i="' + i + '"><b>' + esc(o[0]) + (i === 0 ? ' <span class="badge">Recommended</span>' : '') + '</b><span>' + esc(o[1]) + '</span></button>';
      }).join('') + '</div><p class="q-nav">' + back + '</p>';
    }
    var first = quiz.querySelector('.q-opt, input'); if (first && at) first.focus();
  }
  quiz.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var s = steps()[at];
    if (b.hasAttribute('data-back')) { at--; return ask(); }
    if (b.hasAttribute('data-restart')) { A = {}; at = 0; return ask(); }
    if (b.hasAttribute('data-tune')) { tune.open = true; tune.scrollIntoView({ block: 'start' }); return; }
    if (b.hasAttribute('data-next')) {
      var ticked = [].map.call(quiz.querySelectorAll('input:checked'), function (i) { return i.value; });
      A.shaman = ticked.indexOf('Shaman') >= 0; A.extra = ['Core'].concat(ticked.filter(function (v) { return v !== 'Shaman'; }));
    } else if (b.hasAttribute('data-i')) {
      if (s.id === 'kind' && A.kind !== +b.getAttribute('data-i')) { A = {}; }
      A[s.id] = +b.getAttribute('data-i');
    } else return;
    at++; ask();
  });
  function finish() {
    var name = KINDS[A.kind][0], k = A.kind;
    // Parts ticked as another preset has them (Full without Spoken): suggest that one.
    var same = A.extra && D.presets.filter(function (p) { return kindOf(p) === 'core' && p.parts.slice().sort().join() === A.extra.slice().sort().join(); })[0];
    if (same) { name = same.n; k = Math.max(0, KINDS.map(function (x) { return x[0]; }).indexOf(name)); }
    load(preset(name));
    LOOK.forEach(function (l) { if (A[l[0]] !== undefined) S.look[l[0]] = A[l[0]]; });
    if (A.extra) D.parts.forEach(function (g) { S.parts[g.n] = A.extra.indexOf(g.n) >= 0; });
    S.shaman = !!A.shaman;
    if (A.voices === 1) D.journey.forEach(function (j) { if (j.opt) S.jr[j.n] = true; });
    choose(name, true);
    var changed = answers() !== fresh(S.p);
    quiz.innerHTML = '<p class="q-step">Suggestion</p><h3>' + esc(name) + (changed ? ', set to your answers' : '') + '</h3><p>' + esc(KINDS[k][2]) + ' ' +
      (S.kind === 'fixed' ? 'There is nothing more to choose: download it below.' : esc(summary()) + '. Fine-tune it below or download it as it is.') + '</p>' +
      '<p class="q-nav"><button type="button" class="link" data-restart>Start over</button>' + (S.kind === 'fixed' ? '' : '<button type="button" class="btn" data-tune>Fine-tune it</button>') + '</p>';
    quiz.querySelector('h3').setAttribute('tabindex', '-1'); quiz.querySelector('h3').focus();
  }
  $('quiz-start').addEventListener('click', function () { quiz.hidden = false; A = {}; at = 0; ask(); quiz.querySelector('.q-opt').focus(); });
  $('quiz-start').parentNode.hidden = false;

  // --- "Already installed?" buttons: Windows starts PowerShell twice before the window shows, so say it is on its way.
  var starting = $('starting'), closeLater;
  document.querySelectorAll('[data-starting]').forEach(function (a) {
    a.addEventListener('click', function () {   // (the link itself still goes to Windows)
      $('starting-what').textContent = a.getAttribute('data-starting');
      if (!starting.open) starting.showModal();
      clearTimeout(closeLater); closeLater = setTimeout(function () { starting.close(); }, 20000);
    });
  });
  starting.addEventListener('click', function (e) { if (e.target === starting) starting.close(); });   // a click outside the box

  var on = document.querySelector('input[name=preset]:checked');
  choose(on ? on.getAttribute('data-name') : D.presets[0].n);
})();
