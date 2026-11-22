'use strict';
(function () {
  var MAP = [
    '####################',
    '#......#.......#..G#',
    '#.CC...#...C...#.###',
    '#......#.......#...#',
    '#..##.....##...#...#',
    '#V.....C......##...#',
    '#..#.......#.......#',
    '#..#...C...#...##..#',
    '#P.....#.......#...#',
    '####################'
  ];
  var TILE = 48, W = 20, H = 10;
  var CV = document.getElementById('cv');
  var CX = CV.getContext('2d');
  var statusEl = document.getElementById('status');
  var lootEl = document.getElementById('loot');
  var barEl = document.getElementById('alarmbar');
  var pctEl = document.getElementById('pct');
  var winEl = document.getElementById('win');

  var DIRS = { right: [1, 0], down: [0, 1], left: [-1, 0], up: [0, -1] };
  var DIRS_ORD = ['right', 'down', 'left', 'up'];

  var grid = [];
  var player = { x: 1, y: 8, hasGem: false };
  var start = { x: 1, y: 8 };
  var gem = { x: 18, y: 1 };
  var van = { x: 1, y: 5 };
  var alarm = 0;
  var tick = 0;
  var won = false;
  var lastCaught = false;
  var justCaught = false;
  var statusText = '';

  function initGrid() {
    grid = [];
    for (var y = 0; y < H; y++) {
      var row = [];
      for (var x = 0; x < W; x++) row.push(MAP[y].charAt(x));
      grid.push(row);
    }
  }
  function solidAt(x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return true;
    var c = grid[y][x];
    return c === '#' || c === 'C';
  }
  function blocksLOS(x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return true;
    var c = grid[y][x];
    return c === '#' || c === 'C';
  }

  // Guards
  var guards = [
    { wx: [5, 9, 9, 5], wy: [1, 1, 3, 3], idx: 0, x: 5, y: 1, dir: 'right' },
    { wx: [14, 17, 17, 14], wy: [4, 4, 7, 7], idx: 0, x: 14, y: 4, dir: 'right' }
  ];
  var DIR_INDEX = { right: 0, down: 1, left: 2, up: 3 };

  // Cameras: fixed pos, phase (0..3) into DIRS_ORD cycle down,right,up,left
  var cams = [
    { x: 10, y: 0, phase: 0 },
    { x: 18, y: 5, phase: 3 }
  ];
  var CAM_CYCLE = ['down', 'right', 'up', 'left'];
  function camDir(c) { return CAM_CYCLE[(c.phase + Math.floor(tick / 3)) % 4]; }

function reset(keepStatus) {
    initGrid();
    player.x = start.x; player.y = start.y; player.hasGem = false;
    alarm = 0; tick = 0; won = false; lastCaught = false;
    guards[0].x = guards[0].wx[0]; guards[0].y = guards[0].wy[0];
    guards[0].idx = 0; guards[0].dir = 'right';
    guards[1].x = guards[1].wx[0]; guards[1].y = guards[1].wy[0];
    guards[1].idx = 0; guards[1].dir = 'right';
    if (!keepStatus) statusText = 'Grab the gem in the vault (top right), then escape to the van (bottom left).';
  }
  function init() { reset(false); buildTicks(); }
  function buildTicks() {
    var tk = document.getElementById('ticks');
    tk.innerHTML = '';
    var marks = [25, 50, 75];
    for (var i = 0; i < marks.length; i++) {
      var d = document.createElement('div');
      d.className = 'tick';
      d.style.left = (960 * (marks[i] / 100) - 1) + 'px';
      tk.appendChild(d);
    }
  }

  // Vision cone: for watcher at (wx,wy) facing cardinal dir, return set of cone tile keys.
  function lineBlocked(x0, y0, x1, y1) {
    var dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
    var cx = x0, cy = y0;
    while (cx !== x1 || cy !== y1) {
      if (cx !== x0 || cy !== y0) { if (blocksLOS(cx, cy)) return true; }
      if (cx !== x1) cx += dx;
      if (cy !== y1) cy += dy;
    }
    return false;
  }
  function coneOf(wx, wy, dir) {
    var d = DIRS[dir];
    var set = {};
    var dx, dy, dist, ox, oy;
    for (ox = -3; ox <= 3; ox++) {
      for (oy = -3; oy <= 3; oy++) {
        if (ox === 0 && oy === 0) continue;
        dist = Math.abs(ox) + Math.abs(oy);
        if (dist < 1 || dist > 3) continue;
        var dot = ox * d[0] + oy * d[1];
        if (dot <= 0) continue;
        var cross = ox * d[1] - oy * d[0];
        if (Math.abs(cross) > dist - 1) continue;
        var tx = wx + ox, ty = wy + oy;
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
        if (lineBlocked(wx, wy, tx, ty)) continue;
        set[tx + ',' + ty] = true;
      }
    }
    return set;
  }
  function allCones() {
    var cones = [];
    for (var i = 0; i < guards.length; i++) {
      cones.push({ kind: 'guard', x: guards[i].x, y: guards[i].y, tiles: coneOf(guards[i].x, guards[i].y, guards[i].dir) });
    }
    for (var j = 0; j < cams.length; j++) {
      cones.push({ kind: 'camera', x: cams[j].x, y: cams[j].y, tiles: coneOf(cams[j].x, cams[j].y, camDir(cams[j])) });
    }
    return cones;
  }
  function inAnyCone(cones, px, py) {
    for (var i = 0; i < cones.length; i++) {
      if (cones[i].tiles[px + ',' + py]) return true;
    }
    return false;
  }

  function guardStep(g) {
    var tx = g.wx[g.idx], ty = g.wy[g.idx];
    var nx = g.x, ny = g.y;
    if (g.x < tx) nx = g.x + 1;
    else if (g.x > tx) nx = g.x - 1;
    else if (g.y < ty) ny = g.y + 1;
    else if (g.y > ty) ny = g.y - 1;
    else { g.idx = (g.idx + 1) % g.wx.length; tx = g.wx[g.idx]; ty = g.wy[g.idx];
      if (g.x < tx) nx = g.x + 1; else if (g.x > tx) nx = g.x - 1;
      else if (g.y < ty) ny = g.y + 1; else if (g.y > ty) ny = g.y - 1; }
    if (nx === g.x && ny === g.y) return;
    var px = g.x, py = g.y;
    g.x = nx; g.y = ny;
    if (g.x > px) g.dir = 'right'; else if (g.x < px) g.dir = 'left';
    else if (g.y > py) g.dir = 'down'; else if (g.y < py) g.dir = 'up';
  }

  function applyStep(px, py) {
    if (won) return;
    if (px === gem.x && py === gem.y && !player.hasGem) {
      player.hasGem = true;
      player.x = gem.x; player.y = gem.y;
    } else {
      player.x = px; player.y = py;
    }
    // guards advance one tile, tick advances, then recompute.
    guardStep(guards[0]);
    guardStep(guards[1]);
    tick++;
    if (applyAlarm()) { draw(); return; }
    // loot & win
    if (player.hasGem) lootEl.textContent = 'LOOT: GEM';
    if (player.hasGem && player.x === van.x && player.y === van.y) {
      won = true; winEl.style.display = 'flex';
      statusText = 'Heist complete.';
      lootEl.textContent = 'LOOT: GEM';
    } else if (player.hasGem) {
      statusText = 'Gem taken! Now get to the van (blue, bottom left).';
    } else {
statusText = 'Grab the gem in the vault (top right), then escape to the van (bottom left).';
    }
    draw();
  }

  // Recompute cones and update alarm for the player's current tile. Returns true if caught.
  function applyAlarm() {
    var cones = allCones();
    if (inAnyCone(cones, player.x, player.y)) alarm += 34; else alarm -= 8;
    if (alarm < 0) alarm = 0;
    if (alarm >= 100) {
      alarm = 0; player.hasGem = false; player.x = start.x; player.y = start.y;
      won = false; justCaught = true;
      statusText = 'ALARM TRIPPED — caught! Restarting position.';
      lootEl.textContent = 'LOOT: none';
      winEl.style.display = 'none';
      return true;
    }
    return false;
  }

  function inDrawCone(cones, x, y) {
    for (var i = 0; i < cones.length; i++) if (cones[i].tiles[x + ',' + y]) return true;
    return false;
  }

  // Vision-cone fan: one bright polygon per watcher, built from the convex
  // hull of its detection tiles plus the watcher centre (the fan vertex).
  // Detection logic (coneOf) is untouched; only the rendering changes.
  function hullPoints(pts) {
    var p = pts.slice();
    p.sort(function (a, b) { return a.x !== b.x ? a.x - b.x : a.y - b.y; });
    var uniq = [];
    for (var i = 0; i < p.length; i++) {
      if (i && p[i].x === p[i - 1].x && p[i].y === p[i - 1].y) continue;
      uniq.push(p[i]);
    }
    if (uniq.length < 3) return uniq;
    function cross(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
    var lower = [];
    for (var j = 0; j < uniq.length; j++) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], uniq[j]) <= 0) lower.pop();
      lower.push(uniq[j]);
    }
    var upper = [];
    for (var k = uniq.length - 1; k >= 0; k--) {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], uniq[k]) <= 0) upper.pop();
      upper.push(uniq[k]);
    }
    lower.pop();
    upper.pop();
    return lower.concat(upper);
  }
  function drawConeFan(cn) {
    var pts = [{ x: cn.x * TILE + TILE / 2, y: cn.y * TILE + TILE / 2 }];
    for (var k in cn.tiles) {
      if (!cn.tiles.hasOwnProperty(k)) continue;
      var p = k.split(',');
      var tx = parseInt(p[0], 10) * TILE, ty = parseInt(p[1], 10) * TILE;
      pts.push({ x: tx, y: ty });
      pts.push({ x: tx + TILE, y: ty });
      pts.push({ x: tx, y: ty + TILE });
      pts.push({ x: tx + TILE, y: ty + TILE });
    }
    var hull = hullPoints(pts);
    if (hull.length < 3) return;
    var guard = cn.kind === 'guard';
    CX.beginPath();
    CX.moveTo(hull[0].x, hull[0].y);
    for (var i = 1; i < hull.length; i++) CX.lineTo(hull[i].x, hull[i].y);
    CX.closePath();
    CX.fillStyle = guard ? 'rgba(255,214,64,0.55)' : 'rgba(255,64,190,0.55)';
    CX.fill();
    CX.lineWidth = 2;
    CX.strokeStyle = guard ? 'rgba(255,226,110,0.95)' : 'rgba(255,110,215,0.95)';
    CX.stroke();
  }

  function draw() {
    CX.fillStyle = '#1e1830';
    CX.fillRect(0, 0, W * TILE, H * TILE);
    var x, y;
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        var c = grid[y][x];
        if (c === '#') { CX.fillStyle = '#3a2f55'; CX.fillRect(x * TILE, y * TILE, TILE, TILE); }
        else if (c === 'C') { CX.fillStyle = '#7a5a2e'; CX.fillRect(x * TILE, y * TILE, TILE, TILE);
          CX.fillStyle = '#8d6b3a'; CX.fillRect(x * TILE + 8, y * TILE + 8, TILE - 16, TILE - 12); }
        else if (c === 'G') { drawGem(x, y); }
        else if (c === 'V') { drawVan(x, y); }
      }
    }
    // cones: one bright fan polygon per watcher (watcher centre = vertex),
    // built from the convex hull of its detection tiles. Detection logic
    // (coneOf) is untouched; only the rendering changes.
    var cones = allCones();
    for (var ci = 0; ci < cones.length; ci++) drawConeFan(cones[ci]);
    // draw gem & van again on top (above cones)
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      var cc = grid[y][x];
      if (cc === 'G') drawGem(x, y);
      else if (cc === 'V') drawVan(x, y);
    }
    // guards
    for (var gi = 0; gi < guards.length; gi++) {
      var g = guards[gi];
      CX.fillStyle = '#e5484d';
      CX.beginPath();
      CX.arc(g.x * TILE + TILE / 2, g.y * TILE + TILE / 2, TILE / 2 - 6, 0, Math.PI * 2);
      CX.fill();
    }
    // cameras (with direction tick)
    for (var cami = 0; cami < cams.length; cami++) {
      var cam = cams[cami];
      var cx0 = cam.x * TILE + TILE / 2, cy0 = cam.y * TILE + TILE / 2;
      CX.fillStyle = '#ff50c8';
      CX.fillRect(cx0 - 7, cy0 - 7, 14, 14);
      // small arrow tick showing the sweep direction
      var cd = DIRS[camDir(cam)];
      var atx = cx0 + cd[0] * 9, aty = cy0 + cd[1] * 9;
      var abx = cx0 - cd[0] * 9, aby = cy0 - cd[1] * 9;
      var apx = -cd[1], apy = cd[0];
      CX.fillStyle = '#ffffff';
      CX.beginPath();
      CX.moveTo(atx, aty);
      CX.lineTo(abx + apx * 4, aby + apy * 4);
      CX.lineTo(abx - apx * 4, aby - apy * 4);
      CX.closePath();
      CX.fill();
    }
    // player
    CX.fillStyle = player.hasGem ? '#ffd94a' : '#39c2ff';
    CX.beginPath();
    CX.arc(player.x * TILE + TILE / 2, player.y * TILE + TILE / 2, TILE / 2 - 6, 0, Math.PI * 2);
    CX.fill();
    if (player.hasGem) { CX.strokeStyle = '#39c2ff'; CX.lineWidth = 3; CX.stroke(); }
    // HUD
    statusEl.textContent = statusText;
    if (justCaught) statusEl.textContent = 'ALARM TRIPPED — caught! Restarting position.';
    lootEl.textContent = player.hasGem ? 'LOOT: GEM' : 'LOOT: none';
    barEl.style.width = alarm + '%';
    // pulse red while the alarm is high (alternate brightness on the step counter)
    if (alarm >= 67) {
      barEl.style.background = (tick % 2 === 0)
        ? 'linear-gradient(90deg,#ff5050,#e73b3b)'
        : 'linear-gradient(90deg,#d23636,#b02828)';
    } else {
      barEl.style.background = 'linear-gradient(90deg,#ffb347,#ff7a3c,#ff5050)';
    }
    pctEl.textContent = Math.round(alarm) + '%';
    pctEl.style.left = (960 * (alarm / 100) - 18) + 'px';
  }

  function drawGem(x, y) {
    var cx0 = x * TILE + TILE / 2, cy0 = y * TILE + TILE / 2;
    CX.fillStyle = '#ffd94a';
    CX.beginPath();
    CX.moveTo(cx0, cy0 - 14);
    CX.lineTo(cx0 + 12, cy0);
    CX.lineTo(cx0, cy0 + 14);
    CX.lineTo(cx0 - 12, cy0);
    CX.closePath();
    CX.fill();
    CX.fillStyle = '#fff3c0';
    CX.fillRect(cx0 - 8, cy0 - 2, 6, 4);
  }
  function drawVan(x, y) {
    var cx0 = x * TILE + TILE / 2, cy0 = y * TILE + TILE / 2;
    CX.fillStyle = '#39c2ff';
    CX.fillRect(cx0 - 17, cy0 - 5, 34, 10);
    CX.fillStyle = '#9fe4ff';
    CX.fillRect(cx0 - 10, cy0 - 3, 8, 6);
    CX.fillStyle = '#ffd94a';
    CX.fillRect(cx0 - 4, cy0 - 1, 4, 2);
  }
  function resetStatusText() {
    statusText = 'Grab the gem in the vault (top right), then escape to the van (bottom left).';
  }

  function move(dir) {
    if (won) return;
    var d = DIRS[dir];
    var nx = player.x + d[0], ny = player.y + d[1];
    if (solidAt(nx, ny)) { draw(); return; }
    applyStep(nx, ny);
  }

  // shot scenes (deterministic, executed by the game's own code)
  function parseShot() {
    var m = /[?&]shot=([a-z]+)/.exec(location.search);
    return m ? m[1] : null;
  }
  function runShot() {
    var shot = parseShot();
    if (!shot) return;
    if (shot === 'start') { reset(false); justCaught = false; draw(); return; }
    if (shot === 'caught') {
      reset(false);
      player.x = start.x; player.y = start.y; player.hasGem = false;
      alarm = 0; justCaught = true;
      statusText = 'ALARM TRIPPED — caught! Restarting position.';
      lootEl.textContent = 'LOOT: none';
      draw(); return;
    }
    if (shot === 'end') {
      reset(false);
      player.hasGem = true; player.x = van.x; player.y = van.y;
      won = true; winEl.style.display = 'flex';
      statusText = 'Heist complete.';
      lootEl.textContent = 'LOOT: GEM';
      draw(); return;
    }
    if (shot === 'play') { runPlayShot(); }
  }
  function runPlayShot() {
    reset(false);
    // scripted sequence ending with the player alive, mid-level, near a crate,
    // a guard cone and a camera cone visible nearby but not spotting the player.
    var seq = ['up','up','up','up','up','right','right','right','right','right','right','right','down','down','down'];
    for (var i = 0; i < seq.length; i++) move(seq[i]);
    justCaught = false;
    draw();
  }

  // events
  var KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
  window.addEventListener('keydown', function (e) {
    var d = KEYMAP[e.key];
    if (d) { e.preventDefault(); move(d); }
  });
  document.getElementById('restart').addEventListener('click', function () {
    reset(false); justCaught = false; winEl.style.display = 'none'; draw();
  });

  init();
  runShot();
  draw();
  window.__game = { move: move, state: function () {
      return { px: player.x, py: player.y, alarm: alarm, hasGem: player.hasGem, won: won, justCaught: justCaught };
    },
    setPos: function (x, y) { player.x = x; player.y = y; draw(); },
    setAlarm: function (n) { alarm = n; draw(); },
    setGem: function (b) { player.hasGem = b; if (b) lootEl.textContent = 'LOOT: GEM'; else lootEl.textContent = 'LOOT: none'; draw(); },
    cones: function () {
      var c = allCones();
      return c.map(function (k) { return { kind: k.kind, x: k.x, y: k.y, tiles: Object.keys(k.tiles) }; });
    },
    findCrateCover: function () {
      var dirs4 = ['right', 'down', 'left', 'up'];
      // guard positions across their patrol loop
      var guardPos = [];
      for (var gi = 0; gi < guards.length; gi++) {
        var w = guards[gi];
        for (var pi = 0; pi < w.wx.length; pi++) guardPos.push([w.wx[pi], w.wy[pi]]);
        guardPos.push([w.x, w.y]);
      }
      var wps = [{ x: 10, y: 0 }, { x: 18, y: 5 }];
      for (var gpi = 0; gpi < guardPos.length; gpi++) {
        var wpx = guardPos[gpi][0], wpy = guardPos[gpi][1];
        for (var di = 0; di < 4; di++) {
          var dd = DIRS[dirs4[di]];
          for (var ox = -3; ox <= 3; ox++) for (var oy = -3; oy <= 3; oy++) {
            if (ox === 0 && oy === 0) continue;
            var dist = Math.abs(ox) + Math.abs(oy);
            if (dist < 1 || dist > 3) continue;
            var dot = ox * dd[0] + oy * dd[1];
            if (dot <= 0) continue;
            var cr = ox * dd[1] - oy * dd[0];
            if (Math.abs(cr) > dist - 1) continue;
            var tx = wpx + ox, ty = wpy + oy;
            if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
            if (grid[ty][tx] !== '.') continue;
            if (blockedByCrate(wpx, wpy, tx, ty)) return { x: tx, y: ty, gx: wpx, gy: wpy };
          }
        }
      }
      for (var cj = 0; cj < wps.length; cj++) {
        var cm = wps[cj];
        for (var dj = 0; dj < 4; dj++) {
          var d2 = DIRS[dirs4[dj]];
          for (var ox2 = -3; ox2 <= 3; ox2++) for (var oy2 = -3; oy2 <= 3; oy2++) {
            if (ox2 === 0 && oy2 === 0) continue;
            var dist2 = Math.abs(ox2) + Math.abs(oy2);
            if (dist2 < 1 || dist2 > 3) continue;
            var dot2 = ox2 * d2[0] + oy2 * d2[1];
            if (dot2 <= 0) continue;
            var cr2 = ox2 * d2[1] - oy2 * d2[0];
            if (Math.abs(cr2) > dist2 - 1) continue;
            var tx2 = cm.x + ox2, ty2 = cm.y + oy2;
            if (tx2 < 0 || ty2 < 0 || tx2 >= W || ty2 >= H) continue;
            if (grid[ty2][tx2] !== '.') continue;
            if (blockedByCrate(cm.x, cm.y, tx2, ty2)) return { x: tx2, y: ty2, gx: cm.x, gy: cm.y };
          }
        }
      }
      return null;
    },
    map: function () { return MAP.slice(); },
    solid: function (x, y) { return solidAt(x, y); },
    los: function (x0, y0, x1, y1) { return lineBlocked(x0, y0, x1, y1); },
    applyAlarm: function () { var r = applyAlarm(); draw(); return r; } };
  function blockedByCrate(x0, y0, x1, y1) {
    var dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
    var cx = x0, cy = y0;
    while (cx !== x1 || cy !== y1) {
      if (cx !== x0 || cy !== y0) {
        if (grid[cy][cx] === 'C') return true;
        if (grid[cy][cx] === '#') return false;
      }
      if (cx !== x1) cx += dx;
      if (cy !== y1) cy += dy;
    }
    return false;
  }
})();