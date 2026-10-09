/* DEAD KEY — browser prototype
   256x192 black / white / red pixel screen (ZX Spectrum style),
   typewriter input, generated cases, clock + cigarette timers. */
(() => {
'use strict';

// ============================================================
// 1. RANDOM (seeded, so a room can be replayed)
// ============================================================
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
let rng = Math.random;
const rint = (n) => Math.floor(rng() * n);
const pick = (arr) => arr[rint(arr.length)];
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rint(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ============================================================
// 2. PIXEL ENGINE (0 = black, 1 = white, 2 = red)
// ============================================================
const W = 256, H = 192;
const base = new Uint8Array(W * H);
const frame = new Uint8Array(W * H);
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const dith = (x, y, t) => t * 16 > BAYER[y & 3][x & 3] + 0.5;

function P(b, x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < H) b[y * W + x] = c; }
function G(b, x, y) { return (x >= 0 && x < W && y >= 0 && y < H) ? b[y * W + x] : 0; }
function line(b, x0, y0, x1, y1, c = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    P(b, x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function lineW(b, x0, y0, x1, y1, c, w) { for (let k = 0; k < w; k++) line(b, x0, y0 + k, x1, y1 + k, c); }
function rectF(b, x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) P(b, x, y, c); }
function rectO(b, x0, y0, x1, y1, c = 1) { line(b, x0, y0, x1, y0, c); line(b, x0, y1, x1, y1, c); line(b, x0, y0, x0, y1, c); line(b, x1, y0, x1, y1, c); }
function ellF(b, x0, y0, x1, y1, c) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2 + 0.5, ry = (y1 - y0) / 2 + 0.5;
  for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) {
    const u = (x - cx) / rx, v = (y - cy) / ry; if (u * u + v * v <= 1) P(b, x, y, c);
  }
}
function ellO(b, x0, y0, x1, y1, c = 1) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2;
  const n = Math.max(24, Math.round((rx + ry) * 3));
  let px = cx + rx, py = cy;
  for (let i = 1; i <= n; i++) { const a = i / n * Math.PI * 2; const nx = cx + rx * Math.cos(a), ny = cy + ry * Math.sin(a); line(b, px, py, nx, ny, c); px = nx; py = ny; }
}
function inPoly(x, y, pts) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins;
  }
  return ins;
}
function polyEach(pts, fn) {
  let minx = W, miny = H, maxx = 0, maxy = 0;
  for (const [x, y] of pts) { minx = Math.min(minx, x); miny = Math.min(miny, y); maxx = Math.max(maxx, x); maxy = Math.max(maxy, y); }
  for (let y = Math.max(0, Math.floor(miny)); y <= Math.min(H - 1, Math.ceil(maxy)); y++)
    for (let x = Math.max(0, Math.floor(minx)); x <= Math.min(W - 1, Math.ceil(maxx)); x++)
      if (inPoly(x + 0.5, y + 0.5, pts)) fn(x, y);
}
const polyF = (b, pts, c) => polyEach(pts, (x, y) => P(b, x, y, c));
const polyO = (b, pts, c = 1) => { for (let i = 0; i < pts.length; i++) { const a = pts[i], d = pts[(i + 1) % pts.length]; line(b, a[0], a[1], d[0], d[1], c); } };
const polyDither = (b, pts, f) => polyEach(pts, (x, y) => P(b, x, y, dith(x, y, f(x, y)) ? 1 : 0));
const shadePoly = (b, pts, f) => polyEach(pts, (x, y) => { if (G(b, x, y) === 0 && dith(x, y, f(x, y))) P(b, x, y, 1); });
const darkenPoly = (b, pts, f) => polyEach(pts, (x, y) => { if (G(b, x, y) === 1 && !dith(x, y, 1 - f(x, y))) P(b, x, y, 0); });

// tiny 3x5 pixel font
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111',
  '9': '111101111001110', '>': '100010001010100', '.': '000000000000010', ',': '000000000010100', '_': '000000000000111',
  '?': '110001010000010', '!': '010010010000010', "'": '010010000000000', '-': '000000111000000', ':': '000010000010000',
  ' ': '000000000000000'
};
function text(b, x, y, s, c = 1, scale = 1, mirror = false) {
  if (mirror) s = s.split('').reverse().join('');
  for (const ch of s.toUpperCase()) {
    const g = FONT[ch] || FONT[' '];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) {
      const ii = mirror ? 2 - i : i;
      if (g[j * 3 + ii] === '1') rectF(b, x + i * scale, y + j * scale, x + i * scale + scale - 1, y + j * scale + scale - 1, c);
    }
    x += 4 * scale;
  }
}

// ============================================================
// 3. THE ROOM (static layer, drawn once per case)
// ============================================================
const BX0 = 84, BY0 = 22, BX1 = 212, BY1 = 104, VP = [148, 63];
const lwTop = (x) => BY0 * x / BX0;
const lwBot = (x) => 150 - (150 - BY1) * x / BX0;
const wallPt = (x, v) => [x, lwTop(x) + (lwBot(x) - lwTop(x)) * v];
const WINDOWS = [[6, 36], [48, 72]];
const windowPoly = ([x0, x1]) => [wallPt(x0, 0.18), wallPt(x1, 0.18), wallPt(x1, 0.62), wallPt(x0, 0.62)];
const LEFT_SLOT = [[4, 172], [40, 166], [46, 188], [8, 192]];
const RIGHT_SLOT = [[182, 174], [222, 168], [228, 190], [188, 192]];
const CABLE = [];
(function buildCable() {
  const bez = (p0, p1, p2, p3, n = 80) => {
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      CABLE.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
                  u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
    }
  };
  bez([186, 150], [196, 150], [204, 146], [206, 141]);
  bez([206, 141], [212, 136], [222, 131], [212, 126]);
  bez([212, 126], [200, 121], [186, 118], [196, 113]);
  bez([196, 113], [204, 109], [194, 106], [189, 104]);
})();

function drawNotepad(b, slot) {
  polyF(b, slot, 1);
  const [[ax, ay], [bx, by]] = slot;
  for (let k = 0; k < 4; k++) line(b, ax + 5, ay + 3 + k * 4, bx - 3, by + 3 + k * 4, 0);
}
function drawLetter(b, slot) {
  polyF(b, slot, 1);
  const [[ax, ay], [bx, by], [cx, cy], [dx, dy]] = slot;
  const mx = (ax + bx + cx + dx) / 4, my = (ay + by + cy + dy) / 4;
  line(b, ax, ay, mx, my, 0); line(b, bx, by, mx, my, 0);
}

// ---- slots where interchangeable objects can stand ----
const SLOTS = {
  WA: [86, 28, 108, 56],       // back wall, left
  WB: [112, 28, 134, 54],      // back wall, middle
  FURN: [88, 60, 112, 106],    // furniture against the back wall
  FLOOR: [54, 112, 84, 134],   // floor, back left
  DL: [2, 162, 50, 192],       // desk, front left
  DR: [180, 164, 232, 192]     // desk, front right
};
const SLOT_POOL = {
  WA: ['calendar', 'painting', 'map', 'photo', 'mirror', null],
  WB: ['newspaper', 'calendar', 'painting', 'map', 'photo'],
  FURN: ['cabinet', 'safe', 'radio', 'chest'],
  FLOOR: ['basket', 'umbrella', 'globe', 'crate', null],
  DL: ['notepad', 'letter', 'deskphoto', 'cigarbox', 'folded'],
  DR: ['letter', 'notepad', 'deskphoto', 'cigarbox', 'folded']
};
const frameBox = (b, x0, y0, x1, y1) => { rectF(b, x0, y0, x1, y1, 0); rectO(b, x0, y0, x1, y1); rectO(b, x0 + 2, y0 + 2, x1 - 2, y1 - 2); };
const OBJ = {
  calendar: { draw(b, [x0, y0, x1, y1]) { rectF(b, x0 + 2, y0, x1 - 2, y1, 1); rectF(b, x0 + 2, y0, x1 - 2, y0 + 5, 0); text(b, x0 + 5, y0 + 1, '1934', 1);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) rectO(b, x0 + 4 + c * 3.6, y0 + 9 + r * 4.5, x0 + 6 + c * 3.6, y0 + 11 + r * 4.5, 0); line(b, (x0 + x1) / 2, y0 - 3, (x0 + x1) / 2, y0, 1); }, container: true },
  painting: { draw(b, [x0, y0, x1, y1]) { frameBox(b, x0, y0 + 4, x1, y1 - 4);
    for (let y = y0 + 7; y < y1 - 6; y++) for (let x = x0 + 3; x < x1 - 2; x++) { const hill = y0 + 16 + Math.sin(x * 0.4) * 3; if (y > hill && dith(x, y, 0.5)) P(b, x, y, 1); else if (y < hill && dith(x, y, 0.12)) P(b, x, y, 1); } }, container: true },
  map: { draw(b, [x0, y0, x1, y1]) { polyDither(b, [[x0, y0 + 2], [x1, y0 + 2], [x1, y1 - 2], [x0, y1 - 2]], () => 0.3); rectO(b, x0, y0 + 2, x1, y1 - 2);
    for (let i = 0; i < 4; i++) line(b, x0 + 2, y0 + 8 + i * 5, x1 - 2, y0 + 6 + i * 6, 1); line(b, x0 + 8, y0 + 3, x0 + 12, y1 - 3); ellO(b, x0 + 13, y0 + 12, x0 + 17, y0 + 16, 0); } },
  photo: { draw(b, [x0, y0, x1, y1]) { frameBox(b, x0 + 3, y0 + 2, x1 - 3, y1 - 2); ellF(b, (x0 + x1) / 2 - 3, y0 + 8, (x0 + x1) / 2 + 3, y0 + 15, 1); rectF(b, (x0 + x1) / 2 - 6, y0 + 17, (x0 + x1) / 2 + 6, y1 - 5, 1); }, container: true },
  mirror: { draw(b, [x0, y0, x1, y1]) { ellF(b, x0 + 3, y0, x1 - 3, y1, 0); ellO(b, x0 + 3, y0, x1 - 3, y1); polyEach([[x0 + 6, y0 + 3], [x1 - 6, y0 + 3], [x1 - 6, y1 - 3], [x0 + 6, y1 - 3]], (x, y) => { if (dith(x, y, 0.22 + (x - x0) * 0.01) && Math.hypot((x - (x0 + x1) / 2) / ((x1 - x0) / 2 - 4), (y - (y0 + y1) / 2) / ((y1 - y0) / 2 - 3)) < 1) P(b, x, y, 1); }); }, container: true },
  newspaper: { draw(b, [x0, y0, x1, y1]) { rectF(b, x0, y0 + 2, x1, y1, 1);
    for (let y = y0 + 8; y < y1 - 1; y += 2) for (let x = x0 + 2; x < x1 - 1; x++) if (y === y0 + 8 || (x < x0 + 10 && y > y0 + 10) || (x >= x0 + 12 && y % 4 === 0)) P(b, x, y, 0);
    rectF(b, x0 + 2, y0 + 3, x1 - 6, y0 + 5, 0); rectF(b, x0 + 2, y0 + 12, x0 + 9, y0 + 21, 0); rectF(b, x0 + 4, y0 + 14, x0 + 7, y0 + 21, 1); } },
  cabinet: { draw(b, [x0, y0, x1, y1]) { rectF(b, x0 + 2, y0 + 2, x1 - 2, y1 - 2, 0); rectO(b, x0 + 2, y0 + 2, x1 - 2, y1 - 2);
    for (const y of [y0 + 12, y0 + 22, y0 + 32]) { line(b, x0 + 2, y, x1 - 2, y); line(b, x0 + 10, y - 5, x0 + 14, y - 5); }
    shadePoly(b, [[x0 + 3, y0 + 3], [x1 - 3, y0 + 3], [x1 - 3, y1 - 3], [x0 + 3, y1 - 3]], (x) => 0.4 - (x - x0) * 0.016); }, container: true },
  safe: { draw(b, [x0, y0, x1, y1]) { rectF(b, x0 + 1, y0 + 16, x1 - 1, y1 - 2, 0); rectO(b, x0 + 1, y0 + 16, x1 - 1, y1 - 2); rectO(b, x0 + 4, y0 + 19, x1 - 4, y1 - 5);
    ellO(b, x0 + 8, y0 + 26, x0 + 16, y0 + 34); P(b, x0 + 12, y0 + 30, 1); line(b, x1 - 8, y0 + 26, x1 - 8, y0 + 36);
    shadePoly(b, [[x0 + 2, y0 + 17], [x1 - 2, y0 + 17], [x1 - 2, y1 - 3], [x0 + 2, y1 - 3]], (x) => 0.3 - (x - x0) * 0.012); }, container: true },
  radio: { draw(b, [x0, y0, x1, y1]) { polyF(b, [[x0 + 2, y1 - 2], [x0 + 2, y0 + 14], [(x0 + x1) / 2, y0 + 8], [x1 - 2, y0 + 14], [x1 - 2, y1 - 2]], 0);
    polyO(b, [[x0 + 2, y1 - 2], [x0 + 2, y0 + 14], [(x0 + x1) / 2, y0 + 8], [x1 - 2, y0 + 14], [x1 - 2, y1 - 2]]);
    for (let y = y0 + 16; y < y0 + 30; y += 2) line(b, x0 + 5, y, x1 - 5, y); rectO(b, x0 + 6, y0 + 33, x1 - 6, y0 + 37); ellF(b, x0 + 6, y1 - 9, x0 + 9, y1 - 6, 1); ellF(b, x1 - 9, y1 - 9, x1 - 6, y1 - 6, 1); }, container: true },
  chest: { draw(b, [x0, y0, x1, y1]) { rectF(b, x0 + 1, y0 + 10, x1 - 1, y1 - 2, 0); rectO(b, x0 + 1, y0 + 10, x1 - 1, y1 - 2);
    for (let k = 0; k < 4; k++) { const y = y0 + 12 + k * 8.5; rectO(b, x0 + 3, y, x1 - 3, y + 6); P(b, (x0 + x1) / 2 - 3, y + 3, 1); P(b, (x0 + x1) / 2 + 3, y + 3, 1); }
    shadePoly(b, [[x0 + 2, y0 + 11], [x1 - 2, y0 + 11], [x1 - 2, y1 - 3], [x0 + 2, y1 - 3]], (x) => 0.32 - (x - x0) * 0.013); }, container: true },
  basket: { draw(b, [x0, y0, x1, y1]) { const q = [[x0 + 6, y0 + 6], [x1 - 6, y0 + 6], [x1 - 9, y1], [x0 + 9, y1]]; polyF(b, q, 0); polyO(b, q);
    for (let x = x0 + 9; x < x1 - 8; x += 3) line(b, x, y0 + 7, x + (x < (x0 + x1) / 2 ? 1 : -1), y1 - 1); ellF(b, x0 + 10, y0 + 1, x0 + 17, y0 + 7, 1); ellF(b, x0 + 15, y0 + 3, x0 + 21, y0 + 8, 1); }, container: true },
  umbrella: { draw(b, [x0, y0, x1, y1]) { rectF(b, x0 + 9, y0 + 8, x1 - 9, y1, 0); rectO(b, x0 + 9, y0 + 8, x1 - 9, y1); line(b, x0 + 12, y0 + 8, x0 + 10, y0 - 6); ellO(b, x0 + 6, y0 - 9, x0 + 11, y0 - 4); line(b, x1 - 12, y0 + 8, x1 - 13, y0 - 2); }, container: true },
  globe: { draw(b, [x0, y0, x1, y1]) { const cx0 = (x0 + x1) / 2; ellF(b, cx0 - 9, y0 + 1, cx0 + 9, y0 + 19, 0); ellO(b, cx0 - 9, y0 + 1, cx0 + 9, y0 + 19);
    ellO(b, cx0 - 4, y0 + 1, cx0 + 4, y0 + 19); line(b, cx0 - 9, y0 + 10, cx0 + 9, y0 + 10); shadePoly(b, [[cx0 - 8, y0 + 2], [cx0, y0 + 2], [cx0, y0 + 18], [cx0 - 8, y0 + 18]], () => 0.35);
    line(b, cx0, y0 + 19, cx0, y1 - 2); line(b, cx0 - 6, y1, cx0 + 6, y1); }, container: true },
  crate: { draw(b, [x0, y0, x1, y1]) { rectF(b, x0 + 3, y0 + 6, x1 - 3, y1, 0); rectO(b, x0 + 3, y0 + 6, x1 - 3, y1);
    for (let y = y0 + 11; y < y1; y += 5) line(b, x0 + 3, y, x1 - 3, y); line(b, x0 + 3, y0 + 6, x1 - 3, y1); text(b, x0 + 9, y0 + 13, 'X', 1); }, container: true },
  notepad: { draw(b, [x0, y0, x1, y1]) { const q = [[x0 + 2, y0 + 10], [x0 + 38, y0 + 4], [x0 + 44, y1 - 4], [x0 + 6, y1]]; polyF(b, q, 1); for (let k = 0; k < 4; k++) line(b, x0 + 7, y0 + 13 + k * 4, x0 + 35, y0 + 8 + k * 4, 0); } },
  letter: { draw(b, [x0, y0, x1, y1]) { const q = [[x0 + 2, y0 + 10], [x0 + 42, y0 + 4], [x0 + 48, y1 - 2], [x0 + 8, y1]]; polyF(b, q, 1);
    const mx = x0 + 25, my = y0 + 17; line(b, x0 + 2, y0 + 10, mx, my, 0); line(b, x0 + 42, y0 + 4, mx, my, 0); } },
  deskphoto: { draw(b, [x0, y0, x1, y1]) { const x = x0 + 14; frameBox(b, x, y0 + 2, x + 18, y1 - 6); ellF(b, x + 6, y0 + 7, x + 12, y0 + 13, 1); rectF(b, x + 5, y0 + 15, x + 13, y1 - 9, 1); line(b, x + 9, y1 - 6, x + 13, y1 - 1); } , container: true },
  cigarbox: { draw(b, [x0, y0, x1, y1]) { const q = [[x0 + 6, y0 + 12], [x0 + 38, y0 + 8], [x0 + 42, y1 - 6], [x0 + 9, y1 - 2]]; polyF(b, q, 0); polyO(b, q); rectF(b, x0 + 16, y0 + 14, x0 + 30, y0 + 19, 1); line(b, x0 + 6, y0 + 15, x0 + 39, y0 + 11); }, container: true },
  folded: { draw(b, [x0, y0, x1, y1]) { const q = [[x0 + 2, y0 + 12], [x0 + 40, y0 + 6], [x0 + 45, y1 - 4], [x0 + 6, y1 - 1]]; polyF(b, q, 1);
    for (let k = 0; k < 4; k++) line(b, x0 + 8 + (k % 2) * 16, y0 + 14 + k * 3, x0 + 20 + (k % 2) * 16, y0 + 12 + k * 3, 0); rectF(b, x0 + 8, y0 + 10, x0 + 30, y0 + 11, 0); } }
};
// fixed objects that can also hide things
const FIXED_PAPER = ['typewriter', 'coat', 'bookshelf', 'ashtray', 'phone', 'lamp', 'clock'];
const FIXED_CONTAINER = { typewriter: true, coat: true, bookshelf: true, ashtray: true, lamp: true, clock: true };
const NEON_WORDS = ['HOTEL', 'BAR', 'CAFE', 'JAZZ', 'LOANS', 'DANCE', 'MOTEL'];
const WEATHERS = ['rain', 'snow', 'fog', 'clear'];

function makeLayout() {
  const slots = {}; const used = new Set();
  for (const s of Object.keys(SLOT_POOL)) {
    const opts = SLOT_POOL[s].filter((o) => o === null || !used.has(o));
    const o = pick(opts); slots[s] = o; if (o) used.add(o);
  }
  return { slots, neonWin: rint(2), neonWord: pick(NEON_WORDS), weather: pick(WEATHERS), bookShelf: rint(4), bookX: 218 + rint(10) * 3 };
}
const placed = (layout) => Object.values(layout.slots).filter(Boolean);

function drawRoom(b, layout) {
  b.fill(0);
  // back wall: faint wallpaper stripes + light bands from the blinds
  for (let y = BY0; y <= BY1; y++) for (let x = BX0; x <= BX1; x++) {
    let t = 0;
    if (x % 12 === 0) t = 0.08;
    const band = (x * 0.9 + y * 1.6) % 14;
    if (x < 150 && band < 5 && y > 40) t = Math.max(t, 0.28 - (x - 84) * 0.004);
    t = Math.max(t, 0.3 - Math.abs(x - 150) / 150 - Math.abs(y - 60) / 200);
    P(b, x, y, dith(x, y, t) ? 1 : 0);
  }
  rectO(b, BX0, BY0, BX1, BY1);
  line(b, 0, 0, BX0, BY0); line(b, 256, 0, BX1, BY0);
  // left wall with moonlight glow around the windows
  polyDither(b, [[0, 0], [BX0, BY0], [BX0, BY1], [0, 150]], (x, y) => Math.max(0.03, 0.32 - Math.abs(y - lwTop(x) - (lwBot(x) - lwTop(x)) * 0.4) / 60));
  line(b, BX0, BY1, 0, 150);
  // right wall + floor
  polyDither(b, [[256, 0], [BX1, BY0], [BX1, BY1], [256, 150]], () => 0.03);
  line(b, BX1, BY1, 256, 150);
  polyDither(b, [[0, 150], [BX0, BY1], [BX1, BY1], [256, 150]], () => 0.04);
  for (let bx = BX0 - 40; bx < BX1 + 48; bx += 9) {
    const dx = bx - VP[0], dy = BY1 - VP[1];
    for (let s = 0; s < 120; s++) {
      const t = 1 + s * 0.02, x = VP[0] + dx * t, y = VP[1] + dy * t;
      if (y > 150 || y < BY1) break;
      if (s % 2 === 0 || y > 120) P(b, x, y, 1);
    }
  }
  // light cone of the hanging lamp
  for (let y = 30; y < 150; y++) for (let x = 0; x < W; x++) {
    let tt = 0;
    if (y >= BY1) { const d = Math.hypot((x - 150) / 1.6, (y - 122) / 0.7); tt = Math.max(0, (46 - d) / 46) * 0.35; }
    else if (x > BX0 && x < BX1) { tt = Math.max(0, (18 + (y - 30) * 0.5 - Math.abs(x - 150)) / 40) * 0.25; }
    if (tt > 0 && G(b, x, y) === 0 && dith(x, y, tt)) P(b, x, y, 1);
  }
  // moonlight through the blinds: diagonal stripes on the floor
  for (let y = BY1 + 2; y < 150; y++) for (let x = 0; x < 150; x++) {
    if (x < BX0 && y < lwBot(x)) continue;
    const band = ((x * 1.0 - y * 1.4) % 11 + 11) % 11;
    if (band < 4) { const t = Math.max(0, 0.65 - x * 0.0035 - (y - 104) * 0.002); if (G(b, x, y) === 0 && dith(x, y, t)) P(b, x, y, 1); }
  }
  darkenPoly(b, [[BX1 - 30, BY0], [BX1, BY0], [BX1, BY1], [BX1 - 30, BY1]], (x) => (x - (BX1 - 30)) / 30 * 0.6);
  darkenPoly(b, [[256, 0], [BX1, BY0], [BX1, BY1], [256, 150]], () => 0.35);
  // rug
  const rug = [[104, 112], [176, 112], [196, 132], [88, 132]];
  polyF(b, rug, 0); polyO(b, rug); polyO(b, [[110, 115], [171, 115], [187, 129], [96, 129]]);
  for (let y = 116; y < 129; y += 3) for (let x = 100; x < 190; x += 6) if (inPoly(x + (y & 1) * 3, y, rug)) P(b, x + (y & 1) * 3, y, 1);

  // windows (inside stays dark, rain is animated later)
  for (const wdw of WINDOWS) {
    const q = windowPoly(wdw);
    polyF(b, q, 0); polyO(b, q);
    for (let k = 0; k < 9; k++) { const v = 0.18 + 0.44 * 0.45 * k / 8; const a = wallPt(wdw[0], v), d = wallPt(wdw[1], v); line(b, a[0], a[1], d[0], d[1]); }
    const m0 = wallPt((wdw[0] + wdw[1]) / 2, 0.18), m1 = wallPt((wdw[0] + wdw[1]) / 2, 0.62); line(b, m0[0], m0[1], m1[0], m1[1]);
    const s0 = wallPt(wdw[0] - 2, 0.64), s1 = wallPt(wdw[1] + 2, 0.64); line(b, s0[0], s0[1], s1[0], s1[1]);
  }
  // radiator
  for (let k = 0; k < 8; k++) { const a = wallPt(54 + k * 3, 0.68), d = wallPt(54 + k * 3, 0.86); line(b, a[0], a[1], d[0], d[1]); }
  { const a = wallPt(52, 0.68), d = wallPt(78, 0.68); line(b, a[0], a[1], d[0], d[1]); const e = wallPt(52, 0.86), f = wallPt(78, 0.86); line(b, e[0], e[1], f[0], f[1]); }

  // clock case (face and hands are animated)
  rectF(b, 140, 26, 156, 78, 0); rectO(b, 140, 26, 156, 78); rectO(b, 143, 46, 153, 74);
  shadePoly(b, [[141, 43], [155, 43], [155, 77], [141, 77]], (x) => 0.3 - (x - 141) * 0.015);
  // coat rack, hat, coat
  line(b, 162, 46, 162, 103); line(b, 158, 103, 166, 103); line(b, 162, 48, 158, 46); line(b, 162, 48, 166, 46);
  ellF(b, 155, 42, 169, 47, 1); rectF(b, 158, 38, 166, 44, 1); line(b, 157, 44, 167, 44, 0);
  polyDither(b, [[158, 50], [166, 50], [168, 86], [156, 86]], () => 0.45); polyO(b, [[158, 50], [166, 50], [168, 86], [156, 86]]);
  // door, frosted glass with reversed lettering
  rectF(b, 174, 44, 204, 104, 0); rectO(b, 174, 44, 204, 104); rectO(b, 178, 50, 200, 72);
  for (let y = 51; y < 72; y++) for (let x = 179; x < 200; x++) if (dith(x, y, 0.55 - (y - 51) * 0.015)) P(b, x, y, 1);
  rectF(b, 181, 57, 197, 65, 1); text(b, 182, 58, 'P.I.', 0, 1, true);
  rectO(b, 178, 78, 200, 100); line(b, 189, 78, 189, 100); ellF(b, 200, 80, 203, 83, 1);
  shadePoly(b, [[175, 73], [203, 73], [203, 103], [175, 103]], (x) => 0.3 - (x - 175) * 0.009);
  line(b, 176, 103, 202, 103, 2); line(b, 178, 104, 200, 104, 2);
  // hanging lamp
  line(b, 150, 0, 150, 14); polyF(b, [[141, 22], [159, 22], [154, 14], [146, 14]], 1); line(b, 141, 22, 159, 22, 0); ellF(b, 147, 22, 153, 26, 1);
  // bookshelf on the right wall (one book sticks out: varies per case)
  for (let k = 0; k < 4; k++) {
    const y = 40 + k * 16;
    line(b, 214, y, 254, y + 18);
    for (let x = 216; x < 252; x += 3) { const yy = y + (x - 214) * 18 / 40; const h = 5 + ((x * 7 + k * 13) % 5); line(b, x, yy - h, x, yy - 1); }
  }
  { const k = layout.bookShelf, y = 40 + k * 16, x = layout.bookX, yy = y + (x - 214) * 18 / 40; rectF(b, x - 1, yy - 11, x + 2, yy - 1, 1); }

  // desk
  const DY = 140;
  for (let y = DY; y < H; y++) for (let x = 0; x < W; x++) {
    const wave = Math.sin(x * 0.045 + y * 0.8) + Math.sin(x * 0.011 - y * 0.25);
    let c = (y % 8 === 4 && wave > 0.6) ? 1 : 0;
    const d = Math.hypot((x - 30) / 1.3, (y - 152) / 0.8);
    if (d < 46 && dith(x, y, (46 - d) / 46 * 0.45)) c = 1;
    if (c === 1 && x > 150 && !dith(x, y, Math.max(0, 1 - (x - 150) / 110))) c = 0;
    P(b, x, y, c);
  }
  line(b, 0, DY, 255, DY); line(b, 0, DY + 1, 255, DY + 1);
  darkenPoly(b, [[174, 152], [214, 156], [232, 192], [190, 192]], () => 1);
  // banker's lamp
  ellF(b, 18, 150, 44, 156, 1); ellF(b, 20, 150, 42, 154, 0); ellO(b, 22, 151, 40, 153);
  lineW(b, 31, 128, 31, 151, 1, 2);
  polyDither(b, [[6, 130], [54, 130], [48, 116], [12, 116]], (x, y) => y < 121 ? 0.75 : 0.4); polyO(b, [[6, 130], [54, 130], [48, 116], [12, 116]]);
  for (let x = 10; x < 52; x++) for (let y = 131; y < 136; y++) if (dith(x, y, 0.6 - (y - 131) * 0.1)) P(b, x, y, 1);
  // ---- interchangeable objects in slots ----
  for (const slot of Object.keys(SLOTS)) {
    const id = layout.slots[slot];
    if (id && OBJ[id]) OBJ[id].draw(b, SLOTS[slot]);
  }
  // ashtray (cigarette is animated)
  ellF(b, 54, 160, 84, 172, 1); ellF(b, 57, 161, 81, 169, 0); ellO(b, 60, 163, 78, 168);
  // telephone
  ellF(b, 222, 152, 248, 160, 1); ellF(b, 224, 152, 246, 157, 0);
  rectF(b, 233, 112, 237, 153, 0); rectO(b, 233, 112, 237, 153);
  ellF(b, 228, 104, 242, 114, 0); ellO(b, 228, 104, 242, 114); ellF(b, 232, 107, 238, 112, 1);
  rectF(b, 242, 118, 247, 138, 0); rectO(b, 242, 118, 247, 138); line(b, 237, 124, 242, 124);
  shadePoly(b, [[234, 113], [236, 113], [236, 152], [234, 152]], () => 0.6);
  // typewriter: paper, roller, body, typebars, keys
  rectF(b, 104, 96, 167, 143, 1);
  rectF(b, 92, 144, 180, 151, 0); rectO(b, 92, 144, 180, 151); line(b, 94, 146, 178, 146);
  rectF(b, 86, 142, 92, 153, 1); rectF(b, 180, 142, 186, 153, 1); lineW(b, 186, 146, 194, 138, 1, 2);
  const body = [[98, 152], [174, 152], [190, 192], [82, 192]];
  polyF(b, body, 0); polyO(b, body);
  shadePoly(b, body, (x) => Math.max(0, 0.55 - (x - 82) * 0.009));
  for (let i = 0; i < 19; i++) { const a = Math.PI * (0.1 + 0.8 * i / 18); line(b, 136 + 24 * Math.cos(a), 162 - 7 * Math.sin(a), 136 + 11 * Math.cos(a), 158 - 2 * Math.sin(a)); }
  ellF(b, 128, 155, 144, 161, 0); ellO(b, 128, 155, 144, 161);
  for (const k of KEYPOS) { ellF(b, k.x - 3, k.y - 2, k.x + 3, k.y + 2, 0); ellO(b, k.x - 3, k.y - 2, k.x + 3, k.y + 2); }
  rectF(b, 118, 187, 154, 189, 1);
  // the red cable
  for (const [x, y] of CABLE) { const th = y > 124 ? 2 : 1; for (let k = 0; k < th; k++) P(b, x, y + k, 2); }
}

// typewriter keys on the drawn machine (for lighting up)
const KEYPOS = [];
const KEYMAP = {};
(function () {
  const rows = [['QWERTYUIOP', 8, 104, 168], ['ASDFGHJKL', 8, 108, 175], ['ZXCVBNM', 7, 112, 182]];
  for (const [letters, n, x0, y] of rows) {
    for (let i = 0; i < n; i++) KEYPOS.push({ x: x0 + i * 9, y });
    for (let i = 0; i < letters.length; i++) KEYMAP[letters[i]] = KEYPOS.length - n + Math.min(i, n - 1);
  }
})();

// ============================================================
// 4. LANGUAGES, WORDS AND THE PUZZLE GENERATOR
// ============================================================
const WORDS = {
  en: `ASPHALT BICYCLE UMBRELLA LANTERN HARMONICA PENGUIN VOLCANO ANCHOR BLANKET CARPET CHIMNEY COMPASS CRICKET DIAMOND
    DOLPHIN ENGINE FEATHER FORTRESS GARDEN GLOVES GRAVEYARD HAMMER HELMET HONEY ISLAND JACKET KETTLE LADDER LETTUCE
    LIBRARY LOBSTER MAGNET MARBLE MATCHBOX MIRROR MONKEY MUSHROOM NEEDLE NOTEBOOK ORCHESTRA OYSTER PADLOCK PAINTING
    PARROT PEPPER PICKLE PILLOW PIRATE POCKET POTATO PUMPKIN PUPPET QUARTER RABBIT RAINCOAT RIBBON ROCKET SADDLE
    SANDWICH SCISSORS SHADOW SHOVEL SILVER SKELETON SPIDER SPOON STATION SUITCASE SUNFLOWER TEACUP TELESCOPE THUNDER
    TICKET TOMATO TROMBONE TRUMPET TUNNEL TURTLE VIOLIN WALNUT WARDROBE WHISTLE WINDMILL WINTER ZIPPER BALLOON BUTTER
    CANDLE CASTLE CHERRY CIRCUS COCONUT COOKIE CORKSCREW CRYSTAL CUSHION DAGGER DOORBELL ELEPHANT FIREPLACE FOUNTAIN
    GIRAFFE GRAPEFRUIT HANDBAG HORSESHOE ICEBERG JIGSAW KANGAROO KEYHOLE LIGHTHOUSE MATTRESS MEADOW MITTEN NAPKIN
    OCTOPUS ORANGE OSTRICH PANTHER PARACHUTE PEACOCK PENCIL PERFUME PIANO PLANET POSTCARD RADIATOR REVOLVER SAILBOAT
    SAUSAGE SCARECROW SEAHORSE SNOWMAN SPARROW STAIRCASE STRAWBERRY TEAPOT TORCH TRACTOR TRUMPET VELVET WAGON WALLET
    WATERFALL WHISKEY WOODPECKER BRIDGE CABBAGE COFFIN DONKEY FLAMINGO GLACIER HEDGEHOG JUNGLE LEMONADE NECKLACE`,
  hu: `asztal bicikli hajnal kalap ablak csillag dinnye hangya kakas kanal kincs kocsi kulcs labda malom macska majom
    nyereg palack papucs pince posta puska sapka szalag szigony tanya tarisznya telefon templom torta uborka vihar villa
    vonat zongora harang hinta homok kalitka kemence kenguru korcsolya lakat lepke mazsola paprika parittya pecset pingvin
    pisztoly piramis rakpart szivar szobor tinta titok tolvaj trombita villamos vitorla gyertya gyufa horgony szappan
    szalonna citrom kokusz revolver bilincs csavar csiga deszka fogas orgona szita kabala patkolat kalapos bunda
    szamovar ostor kasza gereblye kanna kosz bogrács fakanal`,
  fr: `parapluie bicyclette chapeau bougie lanterne poisson baleine cerise chaussure crayon drapeau fourchette guitare
    horloge jardin lunettes mouchoir orange pantalon pigeon renard savon tambour tortue valise violon ballon bouteille
    cadenas canard carotte chandelle chaussette citron cochon couteau couverture escargot fantome fromage girafe grenouille
    hibou journal lapin miroir moustache nuage oreiller pamplemousse papillon parfum pieuvre pirate poupee pinceau
    radiateur requin revolver ruban sablier sardine serpent singe sorciere sucette tabouret tonneau trompette tulipe
    valet vampire volcan whisky zebre ananas boussole brouette cactus casquette chocolat ciseaux clocher coquillage
    dentelle dauphin flambeau framboise gilet hamac harmonica lampion manteau marteau moulin noisette ouragan perroquet`
};
for (const k in WORDS) WORDS[k] = WORDS[k].trim().split(/\s+/).map((w) => w.toUpperCase()).filter((w) => /^[A-Z]{5,10}$/.test(w));

const T = {
  en: {
    tagline: 'You wake up at your desk. You can’t move. Something is wrong.',
    wake: 'Wake up', wakeHard: 'Wake up (hard: 10 minutes)', small: 'Best with sound. Click objects to look closer. Type on your keyboard; on a phone, tap the paper.',
    sound: 'Sound', spec: 'Spectrum colours', on: 'on', off: 'off', restart: 'Start over', putBack: 'Put it back', ret: 'Return',
    newRoom: 'New room', sameRoom: 'Same room again',
    cantMove: 'You can’t move. You can’t speak.', eyes: 'Your eyes slowly come back into focus.', hands: 'Your hands answer again. Look around.',
    shaking: 'Your hands are shaking.', races: 'Your heart races. The poison spreads faster.', ringing: 'The telephone is ringing.', slides: 'Something slides under the door.',
    names: { note: 'A note under the door', ashtray: 'Ashtray', phone: 'Telephone', letter: 'Envelope', notepad: 'Notebook', typewriter: 'Typewriter', lamp: 'Desk lamp', newspaper: 'Newspaper clipping', clock: 'Wall clock', coat: 'Trench coat', door: 'Door', ledger: 'Filing cabinet', book: 'Bookshelf', window: 'Window' },
    intro: (m) => ['GOOD EVENING, DETECTIVE.', 'YOU WERE POISONED AN HOUR AGO.', `YOU HAVE ${m} MINUTES.`, 'ONE WORD IS HIDDEN IN THIS ROOM.', 'TYPE IT AND YOU LIVE.'],
    taunts: ['NO.', 'YOU CAN DO BETTER.', 'I EXPECTED MORE FROM YOU.', 'THINK, DETECTIVE.', 'TIME IS NOT ON YOUR SIDE.', 'THE CLOCK DOES NOT LIE.'],
    correct: ['CORRECT.', 'THE DOOR IS OPEN.'], timeUp: 'TIME IS UP.',
    mark: 'Marked in the corner:',
    typewriterNote: (code, dir) => `Under the typewriter you find a scrap of paper, typed in a hurry: <b class="code">${code}</b><br>Someone has added in pencil: “My hands were shaking. I hit every key one to the ${dir}.”`,
    right: 'right', left: 'left',
    typewriterPlain: 'An old typewriter. A red cable comes out of the back, crosses the whole room and disappears under the door.',
    windowMorse: 'Rain. Across the street the HOTEL sign is flickering, but not at random: short and long flashes, a pause, then the same again.',
    windowPlain: 'Rain. Across the street the HOTEL sign flickers on and off. Nobody out there is looking up.',
    plate: 'A small enamel plate is screwed under the sign:',
    phoneDial: 'An old rotary telephone. Letters are printed around the dial:',
    phoneNote: 'Next to it, a note in your own handwriting:', deadLine: 'You lift the receiver. A dead line, only static.',
    whisper: 'You pick up the receiver. A voice, barely a whisper:', lineDead: 'The line goes dead.',
    paperName: 'THE HARBOR GAZETTE', edition: 'Late edition, October 1934', headline: 'Who silenced the dock worker?',
    article: 'A dock worker was found dead at the harbor on Friday night. The police refuse to comment. Friends say he talked too much about a powerful man.',
    classifieds: 'In the classifieds someone has circled a few numbers with a red pencil, in this order:',
    coatPlain: 'You search the pockets of your trench coat. A matchbook from the Blue Orchid Club, two cents and a cinema ticket.',
    coatBook: 'You search the pockets of your trench coat. Inside a matchbook from the Blue Orchid Club, in pencil:',
    bookIntro: 'One book sticks out: “Signals and Codes, 1931”. A card with the Morse alphabet is tucked inside. Page 17 is dog-eared:',
    linesWord: 'line', letterWord: 'letter',
    pairsHint: '(line – letter)',
    notepadHead: 'Your own notebook. Your own handwriting.', rent: 'Rent due Friday.', neverTrust: 'Never trust R. Not once.',
    mirrorIntro: 'On the last page, something written backwards, as if seen in a mirror:',
    letterHead: 'An envelope sealed with red wax. Already opened.', letterBody: 'Detective, I know what they want from you. Here is what you need:', sig: 'R.',
    ledger: 'Old case files. The newest folder has no name on it, only a photograph of a man in an expensive coat, his face scratched out.',
    clockText: 'An old pendulum clock without a second hand. Something about it is not right. Watch it long enough and you will see.',
    ash: ['It is almost whole.', 'About a third of it is ash.', 'More than half of it is ash.', 'Only a stub is left. The ember is close to the filter.'],
    ashHead: 'A cigarette is burning in the ashtray. You don’t remember lighting it.',
    door: 'The door is locked. Through the frosted glass a shadow stands perfectly still. The red cable runs under the door: whoever is out there reads every word you type.',
    lamp: 'Your desk lamp. The only warm light in the room.',
    noteHead: 'Someone slid a folded note under the door.',
    hints: { shift: 'Look at the keys of your typewriter. Then look at the note again.', morse: 'The sign across the street is not broken. It is talking.', dial: 'Every number on the dial hides three or four letters.', a1z26: 'The alphabet has twenty-six letters. The red pencil knew that.', book: 'The matchbook and the dog-eared page belong together.', mirror: 'Read your notebook the way a mirror would.', decoy: 'Two pieces with the same mark. One of them came from a liar.' },
    winHead: 'You live.', winText: 'The door swings open. A man in a grey suit crosses the room, slides a needle into your arm and waits until the warmth returns to your fingers.',
    winCard: 'On the desk he leaves a plain white card with an eagle stamped on it and a single line: <em>We’ll be in touch.</em>',
    trueEnd: 'At the door he turns back. “You passed, detective. Few do.”',
    loseHead: 'The cigarette burns out.', loseText: 'So do you. The last thing you hear is the clock, still ticking backwards.', wordWas: 'The word was',
    timeLeft: 'Time left', wrongs: 'Wrong answers', helps: 'Help used', rank: 'Rank', room: 'Room number',
    ranks: ['Rookie', 'Gumshoe', 'Private eye', 'Hard-boiled', 'Legend'],
    page: ['The rain had not stopped for three days and nobody in the city remembered the sun.', 'He lit a cigarette and watched the harbor lights tremble in the water.', 'Every man in this town owes somebody something, and most of them pay in silence.', 'The telephone rang twice and then the line went dead again.', 'She left before dawn with a small suitcase and a quiet goodbye.', 'Money talks, but in this part of the city it mostly whispers.', 'The old clock in the hall had been wrong for years and nobody fixed it.', 'A ship without a name came in at midnight and was gone by morning.', 'Quick questions get you killed, so I asked them very slowly.', 'The jazz from the bar across the street was lazy and sad.', 'Zero witnesses, six empty glasses and one broken window.', 'Somebody always knows, and that somebody is always afraid.']
  },
  hu: {
    tagline: 'Az íróasztalodnál ébredsz. Nem tudsz mozdulni. Valami nincs rendben.',
    wake: 'Ébredés', wakeHard: 'Ébredés (nehéz: 10 perc)', small: 'Hanggal a legjobb. Kattints a tárgyakra a közelebbi nézethez. A saját billentyűzeteden gépelj, telefonon koppints a papírra.',
    sound: 'Hang', spec: 'Spectrum-színek', on: 'be', off: 'ki', restart: 'Újrakezdés', putBack: 'Visszateszem', ret: 'Enter',
    newRoom: 'Új szoba', sameRoom: 'Ugyanez a szoba újra',
    cantMove: 'Nem tudsz mozdulni. Nem tudsz beszélni.', eyes: 'A szemed lassan újra fókuszál.', hands: 'A kezed újra engedelmeskedik. Nézz körül.',
    shaking: 'Remeg a kezed.', races: 'Hevesen ver a szíved. A méreg gyorsabban terjed.', ringing: 'Csörög a telefon.', slides: 'Valamit becsúsztattak az ajtó alatt.',
    names: { note: 'Cetli az ajtó alatt', ashtray: 'Hamutartó', phone: 'Telefon', letter: 'Boríték', notepad: 'Jegyzetfüzet', typewriter: 'Írógép', lamp: 'Asztali lámpa', newspaper: 'Újságkivágás', clock: 'Falióra', coat: 'Ballonkabát', door: 'Ajtó', ledger: 'Iratszekrény', book: 'Könyvespolc', window: 'Ablak' },
    intro: (m) => ['JÓ ESTÉT, DETEKTÍV.', 'EGY ÓRÁJA MEGMÉRGEZTÜNK.', `${m} PERCED VAN.`, 'EGY SZÓ VAN ELREJTVE A SZOBÁBAN.', 'GÉPELD BE, ÉS ÉLSZ.'],
    taunts: ['NEM.', 'TÖBBRE VAGY KÉPES.', 'TÖBBET VÁRTAM TŐLED.', 'GONDOLKODJ, DETEKTÍV.', 'AZ IDŐ NEM A TE OLDALADON ÁLL.', 'AZ ÓRA NEM HAZUDIK.'],
    correct: ['HELYES.', 'AZ AJTÓ NYITVA.'], timeUp: 'LEJÁRT AZ IDŐ.',
    mark: 'A sarkában egy jel:',
    typewriterNote: (code, dir) => `Az írógép alatt egy sietve gépelt papírfecnit találsz: <b class="code">${code}</b><br>Valaki ceruzával hozzáírta: „Remegett a kezem. Minden billentyűt eggyel ${dir} ütöttem.”`,
    right: 'jobbra', left: 'balra',
    typewriterPlain: 'Egy régi írógép. Hátulról piros kábel jön ki, átszeli az egész szobát, és eltűnik az ajtó alatt.',
    windowMorse: 'Esik. Az utca túloldalán villog a HOTEL felirat, de nem véletlenszerűen: rövid és hosszú villanások, szünet, aztán újra ugyanaz.',
    windowPlain: 'Esik. Az utca túloldalán ki-be kapcsol a HOTEL felirat. Odakint senki nem néz fel.',
    plate: 'A felirat alá egy kis zománctábla van csavarozva:',
    phoneDial: 'Egy régi tárcsás telefon. A tárcsa körül betűk:',
    phoneNote: 'Mellette egy cetli a saját kézírásoddal:', deadLine: 'Felveszed a kagylót. Halott vonal, csak sistergés.',
    whisper: 'Felveszed a kagylót. Egy hang, alig suttogva:', lineDead: 'A vonal megszakad.',
    paperName: 'KIKÖTŐI HÍRLAP', edition: 'Esti kiadás, 1934. október', headline: 'Ki hallgattatta el a dokkmunkást?',
    article: 'Péntek éjjel holtan találtak egy dokkmunkást a kikötőben. A rendőrség hallgat. A barátai szerint túl sokat beszélt egy befolyásos emberről.',
    classifieds: 'Az apróhirdetések között valaki piros ceruzával bekarikázott néhány számot, ebben a sorrendben:',
    coatPlain: 'Átkutatod a ballonkabátod zsebeit. Egy gyufásdoboz a Kék Orchidea klubból, két fillér és egy mozijegy.',
    coatBook: 'Átkutatod a ballonkabátod zsebeit. A Kék Orchidea klub gyufásdobozában ceruzával:',
    bookIntro: 'Az egyik könyv kilóg: „Jelek és kódok, 1931”. Benne egy kártya a Morse-ábécével. A 17. oldal sarka be van hajtva:',
    linesWord: 'sor', letterWord: 'betű',
    pairsHint: '(sor – betű)',
    notepadHead: 'A saját jegyzetfüzeted, a saját kézírásoddal.', rent: 'Péntekig lakbér.', neverTrust: 'R.-nek soha ne higgy. Egyszer se.',
    mirrorIntro: 'Az utolsó oldalon valami fordítva, mintha tükörben látnád:',
    letterHead: 'Piros viasszal lepecsételt boríték. Már felbontották.', letterBody: 'Detektív, tudom, mit akarnak tőled. Ez kell neked:', sig: 'R.',
    ledger: 'Régi ügyek aktái. A legújabb dosszién nincs név, csak egy fénykép egy drága kabátos férfiról, az arca kikaparva.',
    clockText: 'Egy régi ingaóra, másodpercmutató nélkül. Valami nem stimmel vele. Ha elég sokáig nézed, rájössz.',
    ash: ['Szinte egész.', 'Nagyjából a harmada hamu.', 'Több mint a fele hamu.', 'Már csak a csikk maradt. A parázs a filter közelében jár.'],
    ashHead: 'A hamutartóban ég egy cigaretta. Nem emlékszel, hogy meggyújtottad volna.',
    door: 'Az ajtó zárva. A tejüvegen át egy árnyék áll mozdulatlanul. A piros kábel az ajtó alatt fut ki: aki odakint van, minden szavadat olvassa.',
    lamp: 'Az asztali lámpád. Az egyetlen meleg fény a szobában.',
    noteHead: 'Valaki egy összehajtott cetlit csúsztatott be az ajtó alatt.',
    hints: { shift: 'Nézd meg az írógéped billentyűit. Aztán nézd meg újra a cetlit.', morse: 'A túloldali felirat nem rossz. Beszél.', dial: 'A tárcsán minden szám három-négy betűt rejt.', a1z26: 'Az ábécének huszonhat betűje van. A piros ceruza tudta ezt.', book: 'A gyufásdoboz és a behajtott oldal összetartozik.', mirror: 'Olvasd a füzetet úgy, ahogy egy tükör tenné.', decoy: 'Két darab ugyanazzal a jellel. Az egyik egy hazugtól jött.' },
    winHead: 'Élsz.', winText: 'Kinyílik az ajtó. Egy szürke öltönyös férfi átvág a szobán, tűt szúr a karodba, és megvárja, amíg visszatér a meleg az ujjaidba.',
    winCard: 'Az asztalon hagy egy egyszerű fehér kártyát, rajta egy sas és egyetlen sor: <em>Még keresni fogjuk.</em>',
    trueEnd: 'Az ajtóban visszafordul. „Átment, detektív. Kevesen szoktak.”',
    loseHead: 'A cigaretta csonkig ég.', loseText: 'Te is. Az utolsó, amit hallasz, az óra, ami még mindig visszafelé ketyeg.', wordWas: 'A szó ez volt:',
    timeLeft: 'Hátralévő idő', wrongs: 'Rossz válaszok', helps: 'Kapott segítség', rank: 'Rang', room: 'Szoba száma',
    ranks: ['Újonc', 'Szaglászó', 'Magánnyomozó', 'Kemény fickó', 'Legenda'],
    page: ['Három napja esett, és a városban senki sem emlékezett már a napra.', 'Rágyújtott, és nézte, ahogy a kikötő fényei remegnek a vízen.', 'Ebben a városban mindenki tartozik valakinek, és a legtöbben hallgatással fizetnek.', 'A telefon kétszer kicsengett, aztán a vonal megint elnémult.', 'Hajnal előtt ment el egy kis bőrönddel és egy halk búcsúval.', 'A pénz beszél, de a város ezen részén inkább csak suttog.', 'A folyosón álló öreg óra évek óta késett, és senki sem javította meg.', 'Éjfélkor befutott egy név nélküli hajó, reggelre nyoma veszett.', 'A gyors kérdésekbe bele lehet halni, ezért én nagyon lassan kérdeztem.', 'A szemközti bárból lusta és szomorú dzsessz szűrődött át.', 'Nulla szemtanú, hat üres pohár és egy betört ablak.', 'Valaki mindig tudja, és az a valaki mindig fél.', 'A xilofon hangja és a whisky íze összekeveredett a füstben.', 'Quintet játszott a sarokban, de senki sem figyelt rájuk.']
  },
  fr: {
    tagline: 'Vous vous réveillez à votre bureau. Impossible de bouger. Quelque chose ne va pas.',
    wake: 'Se réveiller', wakeHard: 'Se réveiller (difficile : 10 minutes)', small: 'Meilleur avec le son. Cliquez sur les objets pour les examiner. Tapez sur votre clavier ; sur téléphone, touchez la feuille.',
    sound: 'Son', spec: 'Couleurs Spectrum', on: 'oui', off: 'non', restart: 'Recommencer', putBack: 'Reposer', ret: 'Entrée',
    newRoom: 'Nouvelle pièce', sameRoom: 'Même pièce',
    cantMove: 'Impossible de bouger. Impossible de parler.', eyes: 'Votre vue redevient nette, lentement.', hands: 'Vos mains vous obéissent à nouveau. Regardez autour de vous.',
    shaking: 'Vos mains tremblent.', races: 'Votre cœur s’emballe. Le poison se répand plus vite.', ringing: 'Le téléphone sonne.', slides: 'Quelque chose glisse sous la porte.',
    names: { note: 'Un mot sous la porte', ashtray: 'Cendrier', phone: 'Téléphone', letter: 'Enveloppe', notepad: 'Carnet', typewriter: 'Machine à écrire', lamp: 'Lampe de bureau', newspaper: 'Coupure de journal', clock: 'Horloge', coat: 'Trench-coat', door: 'Porte', ledger: 'Classeur', book: 'Bibliothèque', window: 'Fenêtre' },
    intro: (m) => ['BONSOIR, DÉTECTIVE.', 'VOUS AVEZ ÉTÉ EMPOISONNÉ IL Y A UNE HEURE.', `IL VOUS RESTE ${m} MINUTES.`, 'UN MOT EST CACHÉ DANS CETTE PIÈCE.', 'TAPEZ-LE ET VOUS VIVREZ.'],
    taunts: ['NON.', 'VOUS POUVEZ MIEUX FAIRE.', 'J’ATTENDAIS PLUS DE VOUS.', 'RÉFLÉCHISSEZ, DÉTECTIVE.', 'LE TEMPS N’EST PAS DE VOTRE CÔTÉ.', 'L’HORLOGE NE MENT PAS.'],
    correct: ['CORRECT.', 'LA PORTE EST OUVERTE.'], timeUp: 'LE TEMPS EST ÉCOULÉ.',
    mark: 'Marqué dans le coin :',
    typewriterNote: (code, dir) => `Sous la machine à écrire, un bout de papier tapé à la hâte : <b class="code">${code}</b><br>Quelqu’un a ajouté au crayon : « Mes mains tremblaient. J’ai tapé chaque touche décalée d’un cran vers la ${dir}. »`,
    right: 'droite', left: 'gauche',
    typewriterPlain: 'Une vieille machine à écrire. Un câble rouge sort de l’arrière, traverse toute la pièce et disparaît sous la porte.',
    windowMorse: 'Il pleut. En face, l’enseigne HOTEL clignote, mais pas au hasard : des éclats courts et longs, une pause, puis la même chose.',
    windowPlain: 'Il pleut. En face, l’enseigne HOTEL s’allume et s’éteint. Dehors, personne ne lève les yeux.',
    plate: 'Une petite plaque émaillée est vissée sous l’enseigne :',
    phoneDial: 'Un vieux téléphone à cadran. Des lettres sont imprimées autour du cadran :',
    phoneNote: 'À côté, un mot de votre main :', deadLine: 'Vous décrochez. Ligne morte, seulement des grésillements.',
    whisper: 'Vous décrochez. Une voix, à peine un murmure :', lineDead: 'La ligne est coupée.',
    paperName: 'LA GAZETTE DU PORT', edition: 'Édition du soir, octobre 1934', headline: 'Qui a fait taire le docker ?',
    article: 'Un docker a été retrouvé mort au port vendredi soir. La police refuse de commenter. Ses amis disent qu’il parlait trop d’un homme puissant.',
    classifieds: 'Dans les petites annonces, quelqu’un a entouré quelques nombres au crayon rouge, dans cet ordre :',
    coatPlain: 'Vous fouillez les poches de votre trench-coat. Une boîte d’allumettes du Blue Orchid Club, deux centimes et un ticket de cinéma.',
    coatBook: 'Vous fouillez les poches de votre trench-coat. Dans une boîte d’allumettes du Blue Orchid Club, au crayon :',
    bookIntro: 'Un livre dépasse : « Signaux et codes, 1931 ». Une carte de l’alphabet morse est glissée dedans. La page 17 est cornée :',
    linesWord: 'ligne', letterWord: 'lettre',
    pairsHint: '(ligne – lettre)',
    notepadHead: 'Votre propre carnet. Votre propre écriture.', rent: 'Loyer à payer vendredi.', neverTrust: 'Ne jamais croire R. Jamais.',
    mirrorIntro: 'Sur la dernière page, quelque chose écrit à l’envers, comme vu dans un miroir :',
    letterHead: 'Une enveloppe scellée à la cire rouge. Déjà ouverte.', letterBody: 'Détective, je sais ce qu’ils veulent de vous. Voici ce qu’il vous faut :', sig: 'R.',
    ledger: 'De vieux dossiers. Le plus récent n’a pas de nom, seulement la photo d’un homme en manteau de luxe, le visage gratté.',
    clockText: 'Une vieille horloge à balancier, sans trotteuse. Quelque chose ne va pas. Regardez-la assez longtemps et vous verrez.',
    ash: ['Elle est presque entière.', 'Un tiers est déjà en cendre.', 'Plus de la moitié est en cendre.', 'Il ne reste qu’un mégot. La braise approche du filtre.'],
    ashHead: 'Une cigarette brûle dans le cendrier. Vous ne vous souvenez pas l’avoir allumée.',
    door: 'La porte est fermée à clé. Derrière le verre dépoli, une ombre attend sans bouger. Le câble rouge passe sous la porte : celui qui est dehors lit chaque mot que vous tapez.',
    lamp: 'Votre lampe de bureau. La seule lumière chaude de la pièce.',
    noteHead: 'Quelqu’un a glissé un mot plié sous la porte.',
    hints: { shift: 'Regardez les touches de votre machine. Puis relisez le papier.', morse: 'L’enseigne d’en face n’est pas en panne. Elle parle.', dial: 'Chaque chiffre du cadran cache trois ou quatre lettres.', a1z26: 'L’alphabet a vingt-six lettres. Le crayon rouge le savait.', book: 'La boîte d’allumettes et la page cornée vont ensemble.', mirror: 'Lisez votre carnet comme le ferait un miroir.', decoy: 'Deux morceaux avec la même marque. L’un vient d’un menteur.' },
    winHead: 'Vous vivez.', winText: 'La porte s’ouvre. Un homme en costume gris traverse la pièce, vous plante une aiguille dans le bras et attend que la chaleur revienne dans vos doigts.',
    winCard: 'Sur le bureau, il laisse une carte blanche frappée d’un aigle, avec une seule ligne : <em>Nous vous recontacterons.</em>',
    trueEnd: 'À la porte, il se retourne. « Vous avez réussi, détective. Peu y arrivent. »',
    loseHead: 'La cigarette s’éteint.', loseText: 'Vous aussi. La dernière chose que vous entendez, c’est l’horloge qui tourne toujours à l’envers.', wordWas: 'Le mot était',
    timeLeft: 'Temps restant', wrongs: 'Mauvaises réponses', helps: 'Aides utilisées', rank: 'Rang', room: 'Numéro de pièce',
    ranks: ['Débutant', 'Fouineur', 'Détective privé', 'Dur à cuire', 'Légende'],
    page: ['La pluie ne s’était pas arrêtée depuis trois jours et personne ne se souvenait du soleil.', 'Il alluma une cigarette et regarda les lumières du port trembler sur l’eau.', 'Dans cette ville, chacun doit quelque chose à quelqu’un, et la plupart paient en silence.', 'Le téléphone sonna deux fois, puis la ligne redevint muette.', 'Elle partit avant l’aube avec une petite valise et un adieu discret.', 'L’argent parle, mais dans ce quartier il chuchote surtout.', 'La vieille horloge du couloir retardait depuis des années.', 'Un navire sans nom arriva à minuit et disparut au matin.', 'Les questions rapides vous font tuer, alors je les posais très lentement.', 'Le jazz du bar d’en face était paresseux et triste.', 'Zéro témoin, six verres vides et une fenêtre brisée.', 'Quelqu’un sait toujours, et ce quelqu’un a toujours peur.', 'Le whisky avait un goût de fumée et de kérosène.', 'Le xylophone du quartet jouait faux, comme toujours.']
  }
};
let LANG = 'en';
const L = () => T[LANG];

// ---- extra texts for random rooms ----
const TX = {
  en: {
    obj: {
      window: ['Window'], radiator: ['Radiator', 'An old iron radiator under the window.'],
      lamp: ['Desk lamp', 'Your desk lamp. The only warm light in the room.', 'Lift the base'],
      phone: ['Telephone', 'An old rotary telephone. Letters are printed around the dial:'],
      typewriter: ['Typewriter', 'An old typewriter. A red cable comes out of the back, crosses the whole room and disappears under the door.', 'Look under it'],
      coat: ['Trench coat', 'Your trench coat hangs on the rack.', 'Search the pockets'],
      bookshelf: ['Bookshelf', 'Rows of old books. One of them sticks out.', 'Pull it out'],
      ashtray: ['Ashtray', '', 'Lift the ashtray'], clock: ['Wall clock', '', 'Open the case'], door: ['Door'],
      calendar: ['Calendar', 'A wall calendar: October 1934.', 'Turn it over'],
      painting: ['Painting', 'A cheap painting of a harbor at dusk.', 'Look behind it'],
      map: ['City map', 'A map of the city, covered in pencil marks.'],
      photo: ['Photograph', 'A framed photo: you, shaking hands with a man whose face has been scratched out.', 'Turn it over'],
      mirror: ['Mirror', 'A small mirror. Your face looks grey.', 'Look behind it'],
      newspaper: ['Newspaper clipping', 'A clipping pinned to the wall.'],
      cabinet: ['Filing cabinet', 'Old case files.', 'Open the drawer'],
      safe: ['Safe', 'A small iron safe. Its door is open a crack.', 'Open it'],
      radio: ['Radio', 'A big wooden radio. Only static.', 'Open the back panel'],
      chest: ['Chest of drawers', 'An old chest of drawers.', 'Open the drawers'],
      basket: ['Wastebasket', 'A wastebasket full of crumpled paper.', 'Dig through it'],
      umbrella: ['Umbrella stand', 'An umbrella stand with one black umbrella in it.', 'Look inside'],
      globe: ['Globe', 'An old globe. The top half lifts off.', 'Open the globe'],
      crate: ['Crate', 'A wooden crate with a shipping stamp.', 'Lift the lid'],
      notepad: ['Notebook', 'Your own notebook. Your own handwriting.'],
      letter: ['Envelope', 'An envelope, already opened.'],
      deskphoto: ['Photo frame', 'A photo frame on the desk. A woman you don’t remember.', 'Turn it over'],
      cigarbox: ['Cigar box', 'A cigar box. Something rattles inside.', 'Open it'],
      folded: ['Newspaper', 'Tonight’s paper, folded in half.']
    },
    weather: { rain: 'Rain runs down the glass.', snow: 'Snow is falling outside.', fog: 'Thick fog presses against the glass.', clear: 'A clear, cold night.' },
    neonRandom: (w) => `Across the street the ${w} sign flickers on and off.`,
    signal: {
      window: (w) => `Across the street the ${w} sign is flickering, but not at random: short and long flashes, a pause, then the same again.`,
      lamp: () => 'The bulb flickers: short and long, a pause, then the same again.',
      radiator: () => 'Knocking in the pipes: short and long knocks, a pause, then the same again.',
      phone: () => 'You lift the receiver. Faint clicks on the line: short and long, a pause, then again.',
      radio: () => 'Under the static, beeps: short and long, a pause, then again.'
    },
    nothing: 'Nothing useful.', mark: 'Marked:',
    shift: (n, d) => `Typed in a hurry. Underneath, in pencil: “My hands were shaking. Every key is ${n === 1 ? 'one' : 'two'} to the ${d > 0 ? 'right' : 'left'}.”`,
    dial: 'A scrap of paper with numbers:', a1: 'Numbers circled in red pencil, in this order:', z1: '(Z = 1)',
    mirrorText: 'Something written for a mirror:', reverseText: 'A torn scrap of paper:',
    bookNums: 'Numbers in pencil:', fmtLL: '(line – letter)', fmtLWL: '(line – word – letter)',
    morseKey: 'A card with the Morse alphabet.',
    pageIntro: { bookshelf: '“Signals and Codes, 1931”. Page 17 is dog-eared:', newspaper: 'The article, line by line:', folded: 'The front page article, line by line:', letter: 'The letter inside reads:' },
    warn: (n) => `In your own handwriting: “Never trust ${n} Not once.”`,
    signed: (n) => `A note signed ${n}:`,
    hintsX: { shift: 'One of the notes was typed by shaking hands. Your typewriter knows the way back.', morse: 'Something in this room keeps blinking or knocking. It is not broken. It is talking.', dial: 'Numbers on a scrap? The telephone dial turns numbers into letters.', a1z26: 'Some numbers are only letters in disguise.', book: 'Line and letter. Find the page that belongs to the numbers.', mirror: 'Some words in this room were written for a mirror, or simply backwards.', key: 'The Morse card is hidden somewhere in this room.', decoy: (n) => `${n} lies. Two pieces share a mark: throw away the liar’s.` }
  },
  hu: {
    obj: {
      window: ['Ablak'], radiator: ['Radiátor', 'Egy régi öntöttvas radiátor az ablak alatt.'],
      lamp: ['Asztali lámpa', 'Az asztali lámpád. Az egyetlen meleg fény a szobában.', 'Megemelem a talpát'],
      phone: ['Telefon', 'Egy régi tárcsás telefon. A tárcsa körül betűk:'],
      typewriter: ['Írógép', 'Egy régi írógép. Hátulról piros kábel jön ki, átszeli az egész szobát, és eltűnik az ajtó alatt.', 'Benézek alá'],
      coat: ['Ballonkabát', 'A ballonkabátod a fogason lóg.', 'Átkutatom a zsebeit'],
      bookshelf: ['Könyvespolc', 'Régi könyvek sorai. Az egyik kilóg.', 'Kihúzom'],
      ashtray: ['Hamutartó', '', 'Felemelem a hamutartót'], clock: ['Falióra', '', 'Kinyitom a szekrényét'], door: ['Ajtó'],
      calendar: ['Naptár', 'Falinaptár: 1934. október.', 'Megfordítom'],
      painting: ['Festmény', 'Egy olcsó festmény egy alkonyati kikötőről.', 'Mögé nézek'],
      map: ['Várostérkép', 'A város térképe, tele ceruzajelekkel.'],
      photo: ['Fénykép', 'Bekeretezett fénykép: te, amint kezet fogsz egy férfival, akinek kikaparták az arcát.', 'Megfordítom'],
      mirror: ['Tükör', 'Egy kis tükör. Szürke az arcod.', 'Mögé nézek'],
      newspaper: ['Újságkivágás', 'Egy falra tűzött újságkivágás.'],
      cabinet: ['Iratszekrény', 'Régi ügyek aktái.', 'Kihúzom a fiókot'],
      safe: ['Széf', 'Egy kis vasszéf. Az ajtaja résnyire nyitva.', 'Kinyitom'],
      radio: ['Rádió', 'Egy nagy fa rádió. Csak sistereg.', 'Leveszem a hátlapját'],
      chest: ['Fiókos szekrény', 'Egy régi fiókos szekrény.', 'Kihúzom a fiókokat'],
      basket: ['Papírkosár', 'Egy papírkosár, tele gyűrött papírral.', 'Átkutatom'],
      umbrella: ['Esernyőtartó', 'Egy esernyőtartó egyetlen fekete esernyővel.', 'Belenézek'],
      globe: ['Földgömb', 'Egy régi földgömb. A felső fele leemelhető.', 'Kinyitom'],
      crate: ['Láda', 'Egy fa láda szállítási pecséttel.', 'Felemelem a fedelét'],
      notepad: ['Jegyzetfüzet', 'A saját jegyzetfüzeted, a saját kézírásoddal.'],
      letter: ['Boríték', 'Egy már felbontott boríték.'],
      deskphoto: ['Fényképkeret', 'Egy fényképkeret az asztalon. Egy nő, akire nem emlékszel.', 'Megfordítom'],
      cigarbox: ['Szivardoboz', 'Egy szivardoboz. Valami zörög benne.', 'Kinyitom'],
      folded: ['Újság', 'A mai esti lap, félbehajtva.']
    },
    weather: { rain: 'Az üvegen folyik az eső.', snow: 'Odakint esik a hó.', fog: 'Sűrű köd tapad az üveghez.', clear: 'Tiszta, hideg éjszaka.' },
    neonRandom: (w) => `Az utca túloldalán ki-be kapcsol a ${w} felirat.`,
    signal: {
      window: (w) => `Az utca túloldalán villog a ${w} felirat, de nem véletlenszerűen: rövid és hosszú villanások, szünet, aztán újra ugyanaz.`,
      lamp: () => 'Pislákol az izzó: rövid és hosszú, szünet, aztán újra ugyanaz.',
      radiator: () => 'Kopogás a csövekben: rövid és hosszú koppanások, szünet, aztán újra ugyanaz.',
      phone: () => 'Felveszed a kagylót. Halk kattogás a vonalban: rövid és hosszú, szünet, aztán újra.',
      radio: () => 'A sistergés alatt sípolás: rövid és hosszú, szünet, aztán újra.'
    },
    nothing: 'Semmi hasznos.', mark: 'Jelölés:',
    shift: (n, d) => `Sietve gépelve. Alatta ceruzával: „Remegett a kezem. Minden billentyű ${n === 1 ? 'eggyel' : 'kettővel'} ${d > 0 ? 'jobbra' : 'balra'} van.”`,
    dial: 'Egy papírfecni számokkal:', a1: 'Piros ceruzával bekarikázott számok, ebben a sorrendben:', z1: '(Z = 1)',
    mirrorText: 'Valami, amit tükörnek írtak:', reverseText: 'Egy leszakadt papírfecni:',
    bookNums: 'Ceruzás számok:', fmtLL: '(sor – betű)', fmtLWL: '(sor – szó – betű)',
    morseKey: 'Egy kártya a Morse-ábécével.',
    pageIntro: { bookshelf: '„Jelek és kódok, 1931”. A 17. oldal sarka be van hajtva:', newspaper: 'A cikk, soronként:', folded: 'A címlapcikk, soronként:', letter: 'A levél így szól:' },
    warn: (n) => `A saját kézírásoddal: „${n} szavának soha ne higgy. Egyszer se.”`,
    signed: (n) => `Egy cetli, aláírás: ${n}`,
    hintsX: { shift: 'Az egyik cetlit remegő kézzel gépelték. Az írógéped tudja a visszautat.', morse: 'Valami ebben a szobában folyton villog vagy kopog. Nem rossz. Beszél.', dial: 'Számok egy cetlin? A telefontárcsa betűkké változtatja őket.', a1z26: 'Némelyik szám csak álruhás betű.', book: 'Sor és betű. Keresd meg az oldalt, amihez a számok tartoznak.', mirror: 'Néhány szót tükörnek írtak, vagy egyszerűen visszafelé.', key: 'A Morse-kártya valahol el van rejtve a szobában.', decoy: (n) => `${n} hazudik. Két darabon ugyanaz a jel: a hazugét dobd el.` }
  },
  fr: {
    obj: {
      window: ['Fenêtre'], radiator: ['Radiateur', 'Un vieux radiateur en fonte sous la fenêtre.'],
      lamp: ['Lampe de bureau', 'Votre lampe de bureau. La seule lumière chaude de la pièce.', 'Soulever le pied'],
      phone: ['Téléphone', 'Un vieux téléphone à cadran. Des lettres autour du cadran :'],
      typewriter: ['Machine à écrire', 'Une vieille machine à écrire. Un câble rouge sort de l’arrière, traverse la pièce et disparaît sous la porte.', 'Regarder dessous'],
      coat: ['Trench-coat', 'Votre trench-coat est accroché au portemanteau.', 'Fouiller les poches'],
      bookshelf: ['Bibliothèque', 'Des rangées de vieux livres. L’un d’eux dépasse.', 'Le sortir'],
      ashtray: ['Cendrier', '', 'Soulever le cendrier'], clock: ['Horloge', '', 'Ouvrir le boîtier'], door: ['Porte'],
      calendar: ['Calendrier', 'Un calendrier mural : octobre 1934.', 'Le retourner'],
      painting: ['Tableau', 'Un tableau bon marché : un port au crépuscule.', 'Regarder derrière'],
      map: ['Plan de la ville', 'Un plan de la ville, couvert de marques au crayon.'],
      photo: ['Photographie', 'Une photo encadrée : vous, serrant la main d’un homme au visage gratté.', 'La retourner'],
      mirror: ['Miroir', 'Un petit miroir. Votre visage est gris.', 'Regarder derrière'],
      newspaper: ['Coupure de journal', 'Une coupure punaisée au mur.'],
      cabinet: ['Classeur', 'De vieux dossiers.', 'Ouvrir le tiroir'],
      safe: ['Coffre-fort', 'Un petit coffre en fer. La porte est entrouverte.', 'L’ouvrir'],
      radio: ['Radio', 'Une grande radio en bois. Seulement des grésillements.', 'Ouvrir le panneau arrière'],
      chest: ['Commode', 'Une vieille commode.', 'Ouvrir les tiroirs'],
      basket: ['Corbeille', 'Une corbeille pleine de papiers froissés.', 'Fouiller'],
      umbrella: ['Porte-parapluies', 'Un porte-parapluies avec un seul parapluie noir.', 'Regarder dedans'],
      globe: ['Globe', 'Un vieux globe. La moitié supérieure se soulève.', 'Ouvrir le globe'],
      crate: ['Caisse', 'Une caisse en bois avec un tampon d’expédition.', 'Soulever le couvercle'],
      notepad: ['Carnet', 'Votre propre carnet. Votre propre écriture.'],
      letter: ['Enveloppe', 'Une enveloppe déjà ouverte.'],
      deskphoto: ['Cadre photo', 'Un cadre sur le bureau. Une femme dont vous ne vous souvenez pas.', 'Le retourner'],
      cigarbox: ['Boîte à cigares', 'Une boîte à cigares. Quelque chose cliquette dedans.', 'L’ouvrir'],
      folded: ['Journal', 'Le journal du soir, plié en deux.']
    },
    weather: { rain: 'La pluie ruisselle sur la vitre.', snow: 'Il neige dehors.', fog: 'Un brouillard épais colle à la vitre.', clear: 'Une nuit claire et froide.' },
    neonRandom: (w) => `En face, l’enseigne ${w} s’allume et s’éteint.`,
    signal: {
      window: (w) => `En face, l’enseigne ${w} clignote, mais pas au hasard : des éclats courts et longs, une pause, puis la même chose.`,
      lamp: () => 'L’ampoule clignote : court et long, une pause, puis la même chose.',
      radiator: () => 'Des coups dans les tuyaux : courts et longs, une pause, puis la même chose.',
      phone: () => 'Vous décrochez. De faibles clics sur la ligne : courts et longs, une pause, puis encore.',
      radio: () => 'Sous les grésillements, des bips : courts et longs, une pause, puis encore.'
    },
    nothing: 'Rien d’utile.', mark: 'Marqué :',
    shift: (n, d) => `Tapé à la hâte. En dessous, au crayon : « Mes mains tremblaient. Chaque touche est décalée de ${n === 1 ? 'un cran' : 'deux crans'} vers la ${d > 0 ? 'droite' : 'gauche'}. »`,
    dial: 'Un bout de papier avec des chiffres :', a1: 'Des nombres entourés au crayon rouge, dans cet ordre :', z1: '(Z = 1)',
    mirrorText: 'Quelque chose écrit pour un miroir :', reverseText: 'Un bout de papier déchiré :',
    bookNums: 'Des nombres au crayon :', fmtLL: '(ligne – lettre)', fmtLWL: '(ligne – mot – lettre)',
    morseKey: 'Une carte de l’alphabet morse.',
    pageIntro: { bookshelf: '« Signaux et codes, 1931 ». La page 17 est cornée :', newspaper: 'L’article, ligne par ligne :', folded: 'L’article de une, ligne par ligne :', letter: 'La lettre dit :' },
    warn: (n) => `De votre main : « Ne jamais croire ${n} Jamais. »`,
    signed: (n) => `Un mot signé ${n} :`,
    hintsX: { shift: 'Un des papiers a été tapé par des mains tremblantes. Votre machine connaît le chemin du retour.', morse: 'Quelque chose dans cette pièce clignote ou frappe. Ce n’est pas une panne. Ça parle.', dial: 'Des chiffres sur un papier ? Le cadran du téléphone les change en lettres.', a1z26: 'Certains nombres ne sont que des lettres déguisées.', book: 'Ligne et lettre. Trouvez la page qui va avec les nombres.', mirror: 'Certains mots ont été écrits pour un miroir, ou simplement à l’envers.', key: 'La carte morse est cachée quelque part dans la pièce.', decoy: (n) => `${n} ment. Deux morceaux ont la même marque : jetez celui du menteur.` }
  }
};
for (const k in TX) Object.assign(T[k], TX[k]);
const LIARS = ['R.', 'M.', 'V.', 'L.', 'K.', 'D.', 'J.'];
const DOTS = ['•', '••', '•••', '••••', '•••••'];
const markOf = (order) => (S.pz.markStyle === 'roman' ? ROMAN : DOTS)[order];
const objName = (id) => (L().obj[id] || [id])[0];
const objDesc = (id) => (L().obj[id] || [])[1] || '';
const objAction = (id) => (L().obj[id] || [])[2] || '';
const isContainer = (id) => !!(OBJ[id] && OBJ[id].container) || !!FIXED_CONTAINER[id];

// ---- the ciphers ----
const QROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
function shiftKey(ch, d) { for (const r of QROWS) { const i = r.indexOf(ch); if (i >= 0) return r[i + d] || null; } return null; }
const MORSE = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..' };
const DIAL = { 2: 'ABC', 3: 'DEF', 4: 'GHI', 5: 'JKL', 6: 'MNO', 7: 'PQRS', 8: 'TUV', 9: 'WXYZ' };
const dialOf = (ch) => +Object.keys(DIAL).find((k) => DIAL[k].includes(ch));
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const stripAcc = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const lettersOf = (line) => [...line].filter((c) => /\p{L}/u.test(c));

function encode(kind, frag, pageLines, hard, simple) {
  switch (kind) {
    case 'shift': {
      const amounts = simple ? [1] : hard ? shuffle([1, 2]) : (rng() < 0.7 ? [1, 2] : [2, 1]);
      for (const n of amounts) for (const d of shuffle([1, -1])) {
        const out = [...frag].map((c) => shiftKey(c, d * n)); if (out.every(Boolean)) return { code: out.join(''), dir: d, amount: n };
      }
      return null;
    }
    case 'morse': return frag.length <= 2 ? { code: [...frag].map((c) => MORSE[c]).join('   ') } : null;
    case 'dial': return { code: [...frag].map(dialOf).join('-') };
    case 'a1z26': { const rev = !simple && rng() < (hard ? 0.5 : 0.3); return { rev, code: [...frag].map((c) => rev ? 91 - c.charCodeAt(0) : c.charCodeAt(0) - 64).join(' – ') }; }
    case 'mirror': return frag.length >= 2 ? { style: simple || rng() < 0.5 ? 'mirror' : 'reverse', code: [...frag].reverse().join('') } : null;
    case 'book': {
      const lwl = !simple && rng() < (hard ? 0.6 : 0.35);
      const out = [];
      for (const c of frag) {
        const opts = [];
        pageLines.forEach((ln, li) => {
          if (lwl) ln.split(/\s+/).forEach((w, wi) => lettersOf(w).forEach((x, xi) => { if (x.toUpperCase() === c) opts.push(`${li + 1}–${wi + 1}–${xi + 1}`); }));
          else lettersOf(ln).forEach((x, xi) => { if (x.toUpperCase() === c) opts.push(`${li + 1}–${xi + 1}`); });
        });
        if (!opts.length) return null;
        out.push(pick(opts));
      }
      return { lwl, code: out.join('   ') };
    }
  }
  return null;
}

function makePuzzle(hard, layout, cfg = {}) {
  const lang = L();
  const here = placed(layout);
  for (let attempt = 0; attempt < 600; attempt++) {
    const word = pick(WORDS[LANG]);
    let n = cfg.pieces ? cfg.pieces : Math.min(hard ? 5 : 4 + (word.length >= 9 ? 1 : 0), word.length >= 7 ? 5 : 4);
    if (word.length < n || word.length > n * 3) continue;
    const sizes = Array(n).fill(1); let rest = word.length - n;
    if (rest < 0 || rest > n * 2) continue;
    while (rest > 0) { const i = rint(n); if (sizes[i] < 3) { sizes[i]++; rest--; } }
    const frags = []; let p = 0; for (const s of sizes) { frags.push(word.slice(p, p + s)); p += s; }
    const pageLines = shuffle(lang.page).slice(0, 9);
    const kinds = shuffle(['shift', 'morse', 'dial', 'a1z26', 'book', 'mirror']);
    const pieces = []; const used = new Set(); let ok = true;
    for (let i = 0; i < frags.length; i++) {
      let done = false;
      for (const k of kinds) {
        if (used.has(k)) continue;
        const enc = encode(k, frags[i], pageLines, hard, cfg.simple);
        if (enc) { pieces.push({ kind: k, frag: frags[i], order: i, ...enc }); used.add(k); done = true; break; }
      }
      if (!done) { ok = false; break; }
    }
    if (!ok) continue;
    // ---- where everything goes ----
    const at = {}; const put = (id, item) => { (at[id] = at[id] || []).push(item); };
    const paper = shuffle([...FIXED_PAPER, ...here]);
    const light = shuffle(layout.lights ? layout.lights.slice() : ['window', 'lamp', 'radiator', 'phone', ...(here.includes('radio') ? ['radio'] : [])]);
    let pi = 0; const nextPaper = () => paper[pi++ % paper.length];
    for (const pc of pieces) {
      if (pc.kind === 'morse') { pc.at = light[0]; put(pc.at, { type: 'piece', p: pc }); }
      else { pc.at = nextPaper(); put(pc.at, { type: 'piece', p: pc }); }
    }
    const pageOpts = ['bookshelf', ...['newspaper', 'folded', 'letter'].filter((o) => here.includes(o))];
    const pageAt = used.has('book') ? pick(pageOpts) : null;
    if (pageAt) put(pageAt, { type: 'page' });
    if (used.has('morse')) put(pick(paper), { type: 'morsekey' });
    const liar = pick(LIARS);
    put(nextPaper(), { type: 'warn' });
    const decoys = [];
    const marks = shuffle(pieces.map((x) => x.order)).slice(0, cfg.decoys || (hard ? 2 : 1));
    for (const m of marks) {
      let fake = ''; const len = 1 + rint(2); for (let i = 0; i < len; i++) fake += String.fromCharCode(65 + rint(26));
      const k = pick(['a1z26', 'dial', 'shift']);
      const enc = encode(k, fake, pageLines, hard, cfg.simple);
      if (!enc) { ok = false; break; }
      const d = { kind: k, frag: fake, order: m, decoy: true, ...enc, at: nextPaper() };
      decoys.push(d); put(d.at, { type: 'decoy', p: d });
    }
    if (!ok) continue;
    // co-op: split the knowledge between the players, so they have to talk
    const np = cfg.players || 1;
    if (np > 1) {
      const order = shuffle([...Array(np).keys()]); let oi = 0;
      const nextOwner = () => order[oi++ % np];
      pieces.forEach((pc) => { pc.owner = nextOwner(); });
      for (const id in at) for (const it of at[id]) {
        if (it.type === 'piece' || it.type === 'decoy') it.owner = it.p.owner !== undefined ? it.p.owner : (it.p.owner = rint(np));
        else if (it.type === 'morsekey') { const mp = pieces.find((x) => x.kind === 'morse'); it.owner = (mp.owner + 1 + rint(np - 1)) % np; }
        else if (it.type === 'page') { const bp = pieces.find((x) => x.kind === 'book'); it.owner = (bp.owner + 1 + rint(np - 1)) % np; }
        else it.owner = rint(np);
      }
    }
    return { word, pieces, decoys, pageLines, pageAt, at, liar, used: [...used], markStyle: rng() < 0.5 ? 'roman' : 'dots', players: np,
      morseAt: (pieces.find((x) => x.kind === 'morse') || {}).at || null };
  }
  return makePuzzle(hard, layout, cfg);
}

// ============================================================
// 5. DOCUMENTS (close-up views)
// ============================================================
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function morseCardHTML() { return `<div class="morse">${Object.entries(MORSE).map(([k, v]) => `<span><b>${k}</b> ${v.replace(/\./g, '·').replace(/-/g, '–')}</span>`).join('')}</div>`; }
function dialHTML() { return `<div class="dial">${Object.entries(DIAL).map(([k, v]) => `<span><b>${k}</b> ${v}</span>`).join('')}</div>`; }

function pieceHTML(p) {
  const l = L();
  const mk = `<p class="mark">${l.mark} <b>${markOf(p.order)}</b></p>`;
  switch (p.kind) {
    case 'shift': return `<p><b class="code">${esc(p.code)}</b></p><p class="hand">${l.shift(p.amount, p.dir)}</p>${mk}`;
    case 'dial': return `<p>${l.dial}</p><p class="hand">${esc(p.code)}</p>${mk}`;
    case 'a1z26': return `<p>${l.a1}</p><p class="circled">${esc(p.code)}${p.rev ? ` <span class="meta">${l.z1}</span>` : ''}</p>${mk}`;
    case 'mirror': return p.style === 'mirror' ? `<p>${l.mirrorText}</p><p class="hand mirror">${esc(p.frag)}</p>${mk}` : `<p>${l.reverseText}</p><p class="hand">${esc(p.code)}</p>${mk}`;
    case 'book': return `<p>${l.bookNums}</p><p class="hand">${esc(p.code)}</p><p class="meta">${p.lwl ? l.fmtLWL : l.fmtLL}</p>${mk}`;
    case 'morse': return `<div class="signal sig-${p.at}" id="signal">${p.at === 'window' ? esc(S.layout.neonWord) : p.at === 'lamp' ? '◉' : p.at === 'radiator' ? '▮▮▮' : p.at === 'phone' ? '☎' : '≋'}</div>${mk}`;
  }
  return '';
}

const visible = (it) => it.owner === undefined || it.owner === S.myIndex;
function morseVisible() { const p = S.pz && S.pz.pieces.find((x) => x.kind === 'morse'); return !!p && (p.owner === undefined || p.owner === S.myIndex); }
function itemsHTML(id) {
  const l = L(), pz = S.pz;
  const items = (pz.at[id] || []).filter(visible);
  if (!items.length) return `<p class="meta">${l.nothing}</p>`;
  return items.map((it) => {
    if (it.type === 'piece') return pieceHTML(it.p);
    if (it.type === 'decoy') return `<p class="meta">${l.signed(esc(pz.liar))}</p>${pieceHTML(it.p)}`;
    if (it.type === 'page') return `<p class="meta">${l.pageIntro[id] || l.pageIntro.bookshelf}</p><ol class="page">${pz.pageLines.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
    if (it.type === 'morsekey') return `<p class="meta">${l.morseKey}</p>${morseCardHTML()}`;
    if (it.type === 'warn') return `<p class="hand">${l.warn(esc(pz.liar))}</p>`;
    return '';
  }).join('<hr>');
}

function docFor(id) {
  const l = L(), pz = S.pz;
  const remaining = Math.max(0, S.total - S.elapsed), left = remaining / S.total;
  const morseHere = pz.morseAt === id && morseVisible();
  let head = '';
  switch (id) {
    case 'window': head = `${l.weather[S.layout.weather]} ${morseHere ? l.signal.window(S.layout.neonWord) : l.neonRandom(S.layout.neonWord)}`; break;
    case 'lamp': case 'radiator': case 'radio': case 'floorlamp': head = morseHere ? `${objDesc(id)} ${(l.signal[id] || l.signal.lamp)()}` : objDesc(id); break;
    case 'phone': head = objDesc(id); break;
    case 'clock': head = l.clockText; break;
    case 'ashtray': head = `${l.ashHead} ${l.ash[left > 0.75 ? 0 : left > 0.5 ? 1 : left > 0.25 ? 2 : 3]}`; break;
    case 'door': head = l.door; break;
    default: head = objDesc(id);
  }
  let html = `<div class="d${['window', 'radiator', 'door', 'ashtray', 'lamp'].includes(id) ? ' plain' : ''}"><h2 id="doc-title">${esc(objName(id))}</h2>`;
  if (id === 'clock') html += clockSVG(remaining);
  html += `<p>${head}</p>`;
  if (id === 'phone') { html += dialHTML(); if (morseHere) html += `<p>${l.signal.phone()}</p>`; }
  if (id === 'door') return html + '</div>';
  const items = (pz.at[id] || []).filter(visible);
  const morseItems = items.filter((it) => it.type === 'piece' && it.p.kind === 'morse');
  const otherItems = items.filter((it) => !(it.type === 'piece' && it.p.kind === 'morse'));
  html += morseItems.map((it) => pieceHTML(it.p)).join('');
  const needsOpen = isContainer(id) && !S.opened.has(id);
  if (needsOpen) html += `<p><button type="button" class="btn btn-small" id="openBtn">${esc(objAction(id))}</button></p>`;
  else if (otherItems.length) { const save = pz.at[id]; pz.at[id] = otherItems; html += `<hr>${itemsHTML(id)}`; pz.at[id] = save; }
  else if (!morseItems.length && id !== 'phone' && id !== 'clock') html += `<p class="meta">${l.nothing}</p>`;
  if (NET.isCoop()) html += `<p><button type="button" class="btn btn-quiet btn-small" id="showBtn">${l.show}</button></p>`;
  return html + '</div>';
}

function clockSVG(remaining) {
  const m = (remaining / 60) % 60, h = (remaining / 3600) % 12;
  const hand = (frac, len, w) => { const a = frac * Math.PI * 2 - Math.PI / 2; return `<line x1="50" y1="50" x2="${50 + len * Math.cos(a)}" y2="${50 + len * Math.sin(a)}" stroke="#000" stroke-width="${w}" stroke-linecap="round"/>`; };
  let ticks = '';
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ticks += `<line x1="${50 + 38 * Math.cos(a)}" y1="${50 + 38 * Math.sin(a)}" x2="${50 + 43 * Math.cos(a)}" y2="${50 + 43 * Math.sin(a)}" stroke="#000" stroke-width="${i % 3 ? 1.5 : 3}"/>`; }
  return `<svg class="clockface" viewBox="0 0 100 100" aria-label="Clock face"><circle cx="50" cy="50" r="47" fill="#ece8dc" stroke="#000" stroke-width="3"/>${ticks}
    ${hand(h / 12 + m / 720, 22, 4)}${hand(m / 60, 36, 2.5)}<circle cx="50" cy="50" r="3" fill="#000"/></svg>`;
}

// Morse timeline (unit = 260 ms) for whatever is signalling
function morseTimeline(frag) {
  const seq = [];
  [...frag].forEach((c, ci) => {
    [...MORSE[c]].forEach((s) => { seq.push([1, s === '.' ? 1 : 3]); seq.push([0, 1]); });
    seq[seq.length - 1] = [0, ci < frag.length - 1 ? 3 : 10];
  });
  return seq;
}
function morseOnAt(ms) {
  const p = S.pz && S.pz.pieces.find((x) => x.kind === 'morse');
  if (!p) return false;
  if (!S.morseSeq) { S.morseSeq = morseTimeline(p.frag); S.morseLen = S.morseSeq.reduce((a, x) => a + x[1], 0); }
  let u = Math.floor(ms / 260) % S.morseLen;
  for (const [on, d] of S.morseSeq) { if (u < d) return on === 1; u -= d; }
  return false;
}
function neonOnAt(ms) {
  if (S.pz && S.pz.morseAt === 'window' && morseVisible()) return morseOnAt(ms);
  return Math.sin(ms / 700) > -0.6 && Math.random() > 0.03;
}

// ============================================================
// 6. SOUND (synthesised, no files needed)
// ============================================================
const Snd = {
  ctx: null, on: true, rainNode: null, master: null,
  buf: {}, ready: null, ringSrc: null,
  loadSamples() {
    const names = ['key1', 'key2', 'key3', 'key4', 'bell', 'carriage', 'tick', 'tock', 'ring', 'rain'];
    this.ready = Promise.all(names.map((n) => fetch('sounds/' + n + '.mp3').then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((b) => this.ctx.decodeAudioData(b)).then((d) => { this.buf[n] = d; }).catch(() => {})));
  },
  playBuf(n, gain = 1, rate = 1, loop = false) {
    if (!this.ctx || !this.buf[n]) return null;
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain(); src.buffer = this.buf[n]; src.playbackRate.value = rate; src.loop = loop; g.gain.value = this.on ? gain : 0;
    src.connect(g).connect(this.master); src.start(); src.gainNode = g; return src;
  },
  stopRing() { if (this.ringSrc) { try { this.ringSrc.stop(); } catch (e) {} this.ringSrc = null; } },
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2; this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.loadSamples();
  },
  burst(dur, freq, type, gain, q = 1) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime, src = this.ctx.createBufferSource(); src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master); src.start(t, Math.random()); src.stop(t + dur + 0.02);
  },
  tone(freq, dur, gain, type = 'sine', slide = 0) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  },
  click() { if (!this.on) return; const ks = ['key1', 'key2', 'key3', 'key4'].filter((n) => this.buf[n]); if (ks.length) { this.playBuf(pick(ks), 0.7, 0.94 + Math.random() * 0.12); return; } this.burst(0.035, 2500, 'highpass', 0.5); this.burst(0.05, 300, 'lowpass', 0.25); },
  bell() { if (!this.on) return; if (this.buf.bell) { this.playBuf('bell', 0.45); return; } this.tone(2093, 0.9, 0.18); this.tone(4186, 0.5, 0.05); },
  carriage() { if (!this.on) return; if (this.buf.carriage) { this.playBuf('carriage', 0.6); return; } this.burst(0.25, 900, 'bandpass', 0.25, 2); },
  tick(alt) { if (!this.on) return; if (this.buf.tick) { this.playBuf(alt && this.buf.tock ? 'tock' : 'tick', 0.22); return; } this.burst(0.012, alt ? 3200 : 2400, 'bandpass', 0.07, 6); },
  thump() { this.tone(62, 0.18, 0.5, 'sine', 0.6); },
  ring() { if (this.buf.ring) { if (!this.ringSrc && this.on) { this.ringSrc = this.playBuf('ring', 0.5); if (this.ringSrc) this.ringSrc.onended = () => { this.ringSrc = null; }; } return; } for (let i = 0; i < 10; i++) setTimeout(() => { this.tone(440, 0.05, 0.08, 'square'); this.tone(480, 0.05, 0.06, 'square'); }, i * 55); },
  door() { this.tone(110, 1.4, 0.15, 'sawtooth', 0.6); this.burst(1.2, 400, 'lowpass', 0.15); },
  startRain() {
    if (!this.ctx || this.rainNode) return;
    if (this.ready && !this.rainWaited) { this.rainWaited = true; this.ready.then(() => this.startRain()); return; }
    if (this.buf.rain) { const src = this.playBuf('rain', 0.32, 1, true); this.rainNode = src.gainNode; this.rainNode.baseGain = 0.32; return; }
    const src = this.ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1100;
    const g = this.ctx.createGain(); g.gain.value = this.on ? 0.06 : 0;
    src.connect(f).connect(g).connect(this.master); src.start(); this.rainNode = g;
  },
  setOn(v) { this.on = v; if (this.rainNode) this.rainNode.gain.value = v ? (this.rainNode.baseGain || 0.06) : 0; if (!v) this.stopRing(); }
};

// ============================================================
// 7. GAME STATE
// ============================================================
const $ = (id) => document.getElementById(id);
const canvas = $('screen'), cx = canvas.getContext('2d');
const img = cx.createImageData(W, H);
const PAL = [[0, 0, 0], [255, 255, 255], [255, 0, 0]];
const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

const S = {
  mode: 'title', total: 900, elapsed: 0, seed: 0, pz: null, layout: null, hard: false,
  lines: [], input: '', locked: true, wrong: 0, hints: 0, hintPool: [], nextHint: 180,
  ringing: false, noteUnder: false, noteText: '', doorOpen: 0, hover: null, litKey: -1, litUntil: 0,
  spectrum: false, viewMode: 'image', paused: false, token: 0, urlSeed: 0, lastTick: 0, shakeWarned: false, endAt: 0, statusUntil: 0, docOpen: null,
  morseSeq: null, morseLen: 0, opened: new Set(), freeze: 0, rewarded: new Set(), rate: 1, myIndex: 0, players: 1, sharedDoc: null, onlineMode: 'solo', syncAt: 0,
  gp: { active: false, x: 128, y: 96, prevA: false, prevB: false }
};

function newGame(minutes, seed, opts = {}) {
  S.token++;
  if (!opts.keepSeries) S.series = opts.series ? { round: 1, carry: 0 } : null;
  S.onlineMode = opts.mode || 'solo'; S.players = opts.players || 1; if (!NET.online()) S.myIndex = 0;
  S.freeze = 0; S.rewarded = new Set(); S.rate = 1; $('notesArea').value = ''; S.sharedDoc = null; $('sharedBtn').hidden = true;
  S.seed = seed || (Math.floor(Math.random() * 900000) + 100000);
  rng = mulberry32(S.seed);
  S.hard = S.onlineMode === 'solo' && minutes <= 10 && !S.series;
  S.total = minutes * 60; S.elapsed = 0; S.wrong = 0; S.hints = 0;
  S.hintEvery = S.onlineMode === 'versus' ? 120 : S.onlineMode === 'coop' ? 240 : S.hard ? 150 : 180;
  S.maxHints = S.onlineMode === 'coop' ? 2 : 4;
  S.nextHint = S.hintEvery;
  S.ringing = false; S.noteUnder = false; S.doorOpen = 0; S.lines = []; S.input = ''; S.shakeWarned = false;
  S.morseSeq = null;
  S.viewMode = S.spectrum ? 'spectrum' : 'image';
  S.layout = S.viewMode === 'image' ? makeImageLayout() : makeLayout();
  rain = [];
  const cfg = S.onlineMode === 'versus' ? { pieces: 3 + rint(2), decoys: 1, simple: true }
    : S.onlineMode === 'coop' ? { pieces: S.players >= 3 ? 6 : 5 + rint(2), decoys: S.players >= 3 ? 3 : 2, players: S.players } : {};
  S.pz = makePuzzle(S.hard, S.layout, cfg);
  S.opened = new Set();
  S.hintPool = shuffle([...S.pz.used, 'decoy', ...(S.pz.used.includes('morse') ? ['key'] : [])]);
  drawRoom(base, S.layout);
  renderPaper();
  intro();
}

// ============================================================
// 8. TYPEWRITER (paper + keys)
// ============================================================
function renderPaper(fromNet) {
  const sheet = $('sheet');
  if (!fromNet && NET.role === 'host' && NET.mode === 'coop' && S.mode !== 'title') NET.toAll({ t: 'paper', lines: S.lines.map((l) => ({ text: l.text, who: l.who })), input: S.input });
  const html = S.lines.slice(-40).map((l, i, arr) => `<div class="line ${l.who}${i === arr.length - 1 && l.fresh ? ' feed' : ''}">${esc(l.text)}</div>`).join('');
  const showCur = S.mode === 'play' && (!S.locked || (NET.role === 'client' && NET.mode === 'coop'));
  const cur = showCur ? `<div class="line">&gt; ${esc(S.input)}<span class="caret"></span></div>` : '';
  sheet.innerHTML = html + cur;
  S.lines.forEach((l) => { l.fresh = false; });
  $('keys').classList.toggle('locked', S.locked);
}
function addLine(text, who) { S.lines.push({ text, who, fresh: true }); S.feedAt = performance.now(); renderPaper(); }

function typeTheirs(lines, done, speed = 55) {
  const tok = S.token;
  S.locked = true; renderPaper();
  let li = 0;
  const nextLine = () => {
    if (tok !== S.token) return;
    if (li >= lines.length) { S.locked = false; renderPaper(); if (done) done(); return; }
    const full = lines[li]; let ci = 0;
    S.lines.push({ text: '', who: 'theirs', fresh: true }); S.feedAt = performance.now();
    const step = () => {
      if (tok !== S.token) return;
      ci++; S.lines[S.lines.length - 1].text = full.slice(0, ci);
      if (full[ci - 1] !== ' ') { Snd.click(); lightKey(stripAcc(full[ci - 1])); }
      renderPaper();
      if (ci < full.length) setTimeout(step, speed + Math.random() * 40);
      else { setTimeout(() => { Snd.carriage(); li++; setTimeout(nextLine, 380); }, 260); }
    };
    setTimeout(step, 200);
  };
  nextLine();
}

function lightKey(ch) {
  ch = (ch || '').toUpperCase();
  const k = KEYMAP[ch];
  S.litKey = k === undefined ? -1 : k; S.litUntil = performance.now() + 130; S.litChar = ch;
  const el = document.querySelector(`.key[data-k="${ch}"]`);
  if (el) { el.classList.add('lit'); setTimeout(() => el.classList.remove('lit'), 130); }
}

const NEIGH = {};
ROWS.forEach((r, ri) => { for (let i = 0; i < r.length; i++) NEIGH[r[i]] = (r[i - 1] || '') + (r[i + 1] || '') + (ROWS[ri + 1] ? ROWS[ri + 1][i] || '' : ''); });

function pressKey(k) {
  if (NET.role === 'client' && NET.mode === 'coop') { if (S.mode === 'play') status(L().hostTypes, 3); return; }
  if (S.mode !== 'play' || S.locked || S.docOpen) return;
  Snd.init();
  if (k === 'BACK') { S.input = S.input.slice(0, -1); Snd.click(); renderPaper(); return; }
  if (k === 'ENTER') { submit(); return; }
  if (!/^[A-Z]$/.test(k) || S.input.length >= 14) return;
  if (S.total - S.elapsed < 120 && NEIGH[k] && Math.random() < 0.07) {
    k = pick(NEIGH[k].split(''));
    if (!S.shakeWarned) { S.shakeWarned = true; status(L().shaking, 4); }
  }
  S.input += k; Snd.click(); lightKey(k); renderPaper();
}

function submit() {
  const guess = S.input.trim();
  if (!guess) return;
  S.input = '';
  addLine('> ' + guess, 'mine');
  Snd.bell();
  if (guess === S.pz.word) { win(); return; }
  S.wrong++;
  S.elapsed = Math.min(S.total - 5, S.elapsed + (S.onlineMode === 'versus' ? 30 : 45));   // wrong answers make the poison spread faster
  // secret reward: a wrong word that contains a real piece (2+ letters) stops the clock for a while, once per piece
  for (const pc of S.pz.pieces) if (pc.frag.length >= 2 && !S.rewarded.has(pc.order) && guess.includes(pc.frag)) { S.rewarded.add(pc.order); S.freeze += 30; }
  coopSync();
  status(L().races, 4); Snd.thump();
  const tt = L().taunts;
  setTimeout(() => typeTheirs([S.wrong <= tt.length ? tt[S.wrong - 1] : pick(tt.slice(1))]), 700);
}

function buildKeys() {
  const wrap = $('keys'); wrap.innerHTML = '';
  const mk = (label, k, wide) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'key' + (wide ? ' wide' : ''); b.textContent = label; b.dataset.k = k;
    b.setAttribute('aria-label', k === 'BACK' ? 'Backspace' : label);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); pressKey(k); });
    return b;
  };
  ROWS.forEach((r, i) => {
    const row = document.createElement('div'); row.className = 'krow';
    for (const ch of r) row.appendChild(mk(ch, ch));
    if (i === 2) row.appendChild(mk('⌫', 'BACK', true));
    wrap.appendChild(row);
  });
  const last = document.createElement('div'); last.className = 'krow';
  last.appendChild(mk(L().ret, 'ENTER', true));
  wrap.appendChild(last);
}

// ============================================================
// 9. HOTSPOTS
// ============================================================
function hotspots() {
  if (S.viewMode === 'image') { const l = imgHotspots(); l.forEach((h) => { h.name = h.id === 'note' ? L().names.note : h.id === 'paper' ? L().paperName2 : objName(h.id); }); return l; }
  const list = [];
  if (S.noteUnder) list.push({ id: 'note', r: [178, 104, 200, 113] });
  const sl = S.layout ? S.layout.slots : {};
  const slotSpot = (s) => sl[s] ? [{ id: sl[s], r: SLOTS[s] }] : [];
  list.push(
    { id: 'ashtray', r: [52, 150, 96, 174] },
    { id: 'phone', r: [216, 100, 250, 160] },
    ...slotSpot('DL'), ...slotSpot('DR'),
    { id: 'paper', r: PAPER_BOX },
    { id: 'typewriter', r: [82, 144, 190, 192] },
    { id: 'lamp', r: [4, 112, 56, 158] },
    ...slotSpot('FLOOR'), ...slotSpot('WA'), ...slotSpot('WB'),
    { id: 'clock', r: [138, 24, 158, 80] },
    { id: 'coat', r: [153, 36, 171, 98] },
    { id: 'door', r: [172, 42, 206, 104] },
    ...slotSpot('FURN'),
    { id: 'bookshelf', r: [212, 28, 256, 112] },
    { id: 'radiator', r: [50, 84, 82, 110] },
    { id: 'window', r: [2, 10, 76, 84] }
  );
  list.forEach((h) => { h.name = h.id === 'note' ? L().names.note : h.id === 'paper' ? L().paperName2 : objName(h.id); });
  return list;
}
function hitTest(x, y) { return hotspots().find((h) => x >= h.r[0] && x <= h.r[2] && y >= h.r[1] && y <= h.r[3]) || null; }

let signalTimer = null, lastSig = false;
function openDoc(id) {
  if (S.mode !== 'play' && S.mode !== 'intro') return;
  const l = L();
  if (id === 'phone' && S.ringing) { S.ringing = false; Snd.stopRing(); giveHint('phone'); if (NET.isCoop()) NET.toHost({ t: 'hintTaken', src: 'phone' }); return; }
  if (id === 'paper') { focusKbd(); return; }
  let html;
  if (id === 'note') { S.noteUnder = false; if (NET.isCoop()) NET.toHost({ t: 'hintTaken', src: 'note' }); html = `<div class="d"><h2 id="doc-title" class="meta">${l.noteHead}</h2><p class="hand">${esc(S.noteText)}</p></div>`; }
  else html = docFor(id);
  $('doc-body').innerHTML = html;
  $('doc').hidden = false; S.docOpen = id;
  $('doc-close').textContent = l.putBack;
  if ($('showBtn')) $('showBtn').onclick = () => { shareDoc(); $('showBtn').disabled = true; };
  const ob = $('openBtn');
  if (ob) ob.onclick = () => { S.opened.add(id); Snd.burst(0.15, 700, 'lowpass', 0.3); openDoc(id); };
  else $('doc-close').focus({ preventScroll: true });
  clearInterval(signalTimer);
  if ($('signal')) {
    const kind = S.pz.morseAt;
    signalTimer = setInterval(() => {
      const el = $('signal'); if (!el) return;
      const on = morseOnAt(performance.now());
      el.classList.toggle('on', on);
      if (on && !lastSig) {
        if (kind === 'radiator') Snd.tone(90, 0.12, 0.5, 'triangle', 0.7);
        else if (kind === 'phone') Snd.burst(0.03, 3000, 'bandpass', 0.35, 4);
        else if (kind === 'radio') Snd.tone(760, 0.09, 0.08, 'sine');
      }
      lastSig = on;
    }, 30);
  }
}
function closeDoc() { $('doc').hidden = true; S.docOpen = null; clearInterval(signalTimer); }

function giveHint(source) {
  const l = L();
  const key = S.hintPool.length ? S.hintPool.shift() : 'decoy';
  S.hints++;
  const h = l.hintsX[key];
  const msg = typeof h === 'function' ? h(S.pz.liar) : h;
  if (source === 'phone') {
    $('doc-body').innerHTML = `<div class="d plain"><p id="doc-title">${l.whisper}</p><p class="hand" style="font-family:var(--hand);font-size:1.6rem">“${esc(msg)}”</p><p>${l.lineDead}</p></div>`;
    $('doc').hidden = false; S.docOpen = 'phone'; $('doc-close').textContent = l.putBack;
  } else {
    S.noteText = msg;
  }
}

// ============================================================
// 10. FLOW: intro, win, lose
// ============================================================
function status(msg, secs = 3) { $('status').textContent = msg; S.statusUntil = S.elapsed + secs; }

function intro() {
  Music.play('ambient');
  S.mode = 'intro'; S.locked = true;
  $('overlay').hidden = true; $('title-art').style.display = 'none'; document.body.classList.remove('on-title');
  canvas.style.filter = 'blur(6px) brightness(0.15)';
  const l = L();
  status(S.series ? `${l.round(S.series.round)} · ${l.cantMove}` : l.cantMove, 99);
  Snd.init(); Snd.startRain();
  const mins = Math.max(1, Math.floor(S.total / 60));
  const tok = S.token;
  setTimeout(() => { if (tok !== S.token) return; canvas.style.filter = 'blur(3px) brightness(0.45)'; status(l.eyes, 99); }, 2500);
  setTimeout(() => {
    if (tok !== S.token) return;
    canvas.style.filter = 'none';
    if (NET.role === 'client' && NET.mode === 'coop') return;   // the host types, we watch
    typeTheirs(l.intro(mins), () => {
      if (tok !== S.token) return;
      S.mode = 'play'; S.locked = false; renderPaper();
      status(l.hands, 4);
      if (NET.role === 'host' && NET.mode === 'coop') NET.toAll({ t: 'go' });
    }, 24);
  }, 4200);
}

function fmt(sec) { sec = Math.max(0, Math.round(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }

function win(fromNet) {
  if (S.mode === 'won') return;
  Music.play('win');
  S.mode = 'won'; S.locked = true; S.endAt = S.elapsed;
  if (NET.online() && NET.mode === 'versus') NET.toHost({ t: 'solved', secs: Math.round(S.elapsed) });
  if (NET.role === 'host' && NET.mode === 'coop') NET.toAll({ t: 'end', win: true, elapsed: S.elapsed });
  const l = L(), tok = S.token;
  const left = S.total - S.elapsed;
  const afterTyping = (fn) => (NET.role === 'client' && NET.mode === 'coop') ? setTimeout(fn, 1500) : typeTheirs(l.correct, fn);
  afterTyping(() => {
    Snd.door();
    const score = Math.max(0, Math.round(left / S.total * 100 - S.wrong * 10 - S.hints * 10));
    const rank = l.ranks[score >= 80 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : score >= 20 ? 1 : 0];
    const trueEnd = S.hints === 0 && S.wrong <= 1;
    setTimeout(() => { if (tok !== S.token) return; showEnd(`<div class="d end"><h2 id="doc-title">${l.winHead}</h2><p>${l.winText}</p><p>${l.winCard}</p>${trueEnd ? `<p>${l.trueEnd}</p>` : ''}
      <div class="stats"><p>${l.timeLeft}: ${fmt(left)}</p><p>${l.wrongs}: ${S.wrong}</p><p>${l.helps}: ${S.hints}</p><p>${l.rank}: ${rank}</p><p class="meta">${l.room}: ${S.seed}</p></div></div>`); }, 2600);
  });
}

function lose(fromNet) {
  if (S.mode === 'lost') return;
  Music.play('lose');
  S.mode = 'lost'; S.locked = true; S.endAt = S.elapsed;
  if (NET.online() && NET.mode === 'versus') NET.toHost({ t: 'lost' });
  if (NET.role === 'host' && NET.mode === 'coop') NET.toAll({ t: 'end', win: false });
  const l = L(), tok = S.token;
  addLine(l.timeUp, 'theirs');
  setTimeout(() => { if (tok !== S.token) return; showEnd(`<div class="d end"><h2 id="doc-title">${l.loseHead}</h2><p>${l.loseText}</p>
    <div id="revealAsk"><p>${l.revealQ}</p><div class="end-actions"><button type="button" class="btn btn-small" id="revealYes">${l.revealYes}</button><button type="button" class="btn btn-small btn-quiet" id="revealNo">${l.revealNo}</button></div></div>
    <p id="wordLine" hidden>${l.wordWas} <strong>${S.pz.word}</strong>.</p>
    <div class="stats"><p>${l.wrongs}: ${S.wrong}</p><p>${l.helps}: ${S.hints}</p><p class="meta">${l.room}: ${S.seed}</p></div></div>`, true); }, 3500);
}

function caseFileHTML() {
  const l = L(), pz = S.pz; if (!pz) return '';
  const where = (id) => esc(objName(id));
  const rows = pz.pieces.slice().sort((a, b) => a.order - b.order).map((p) =>
    `<li><b>${markOf(p.order)}</b> ${l.kinds[p.kind]}, ${l.hiddenIn} ${where(p.at)}: <span class="code-s">${esc(p.code)}</span> → <b>${p.frag}</b></li>`).join('');
  const dec = pz.decoys.map((d) => `<li><b>${markOf(d.order)}</b> ${l.falseFrom(esc(pz.liar))}, ${l.hiddenIn} ${where(d.at)}: <span class="code-s">${esc(d.code)}</span></li>`).join('');
  const extra = [];
  for (const id in pz.at) for (const it of pz.at[id]) {
    if (it.type === 'morsekey') extra.push(`${l.keyIn} ${where(id)}`);
    if (it.type === 'page') extra.push(`${l.pageIn} ${where(id)}`);
    if (it.type === 'warn') extra.push(`${l.warnIn} ${where(id)}`);
  }
  const kind = S.layout && S.layout.img ? ` · ${l.roomType(!!S.layout.modR)}` : '';
  return `<details class="d casefile"><summary>${l.caseFile}: ${pz.word}</summary><ol>${rows}${dec}</ol><p class="meta">${extra.join(' · ')}${kind}</p></details>`;
}
function showEnd(html, hideAnswer) {
  const l = L();
  html += hideAnswer ? `<div id="caseBox" hidden>${caseFileHTML()}</div>` : caseFileHTML();
  setTimeout(() => {
    const y = $('revealYes'), n = $('revealNo');
    if (y) y.onclick = () => { $('wordLine').hidden = false; $('caseBox').hidden = false; $('revealAsk').hidden = true; };
    if (n) n.onclick = () => { $('revealAsk').innerHTML = `<p class="meta">${l.revealKept}</p>`; };
  }, 0);
  if (NET.online()) {
    $('doc-body').innerHTML = html + (NET.mode === 'versus' ? '<div class="d" id="results"></div>' : '') +
      (NET.role === 'host' ? `<div class="end-actions"><button type="button" class="btn" id="againNet">${l.newRoom}</button></div>` : `<p class="meta" style="text-align:center">${l.waiting}</p>`);
    $('doc').hidden = false; S.docOpen = 'end'; $('doc-close').hidden = true; renderResults();
    if ($('againNet')) $('againNet').onclick = () => { $('doc-close').hidden = false; closeDoc(); NET.players.forEach((p) => { delete p.done; delete p.secs; });
      NET.toAll({ t: 'start', seed: Math.floor(Math.random() * 900000) + 100000, minutes: NET.mode === 'coop' ? 15 : 12, mode: NET.mode, lang: LANG, players: NET.players }); };
    return;
  }
  if (S.series && S.mode === 'won' && S.series.round < 3) {
    const left = Math.max(0, S.total - S.elapsed);
    $('doc-body').innerHTML = html + `<p class="meta" style="text-align:center;color:#ccc">${l.carry(fmt(left))}</p><div class="end-actions"><button type="button" class="btn" id="nextRoom">${l.nextRoom}</button></div>`;
    $('doc').hidden = false; S.docOpen = 'end'; $('doc-close').hidden = true;
    $('nextRoom').onclick = () => { $('doc-close').hidden = false; closeDoc(); S.series.round++; S.series.carry = left; newGame(8 + left / 60, 0, { keepSeries: true }); };
    return;
  }
  if (S.series && S.mode === 'won' && S.series.round === 3) html = `<div class="d end"><h2>${l.round(3)}</h2><p>${l.seriesWin}</p><p>${l.seriesScore}: ${fmt(Math.max(0, S.total - S.elapsed))}</p></div>` + html;
  $('doc-body').innerHTML = html + `<div class="end-actions"><button type="button" class="btn" id="againNew">${l.newRoom}</button><button type="button" class="btn btn-quiet" id="againSame">${l.sameRoom}</button></div>`;
  $('doc').hidden = false; S.docOpen = 'end';
  $('doc-close').hidden = true;
  $('againNew').onclick = () => { $('doc-close').hidden = false; closeDoc(); newGame(S.total / 60); };
  $('againSame').onclick = () => { $('doc-close').hidden = false; closeDoc(); newGame(S.total / 60, S.seed); };
}

// ============================================================
// 11. FRAME RENDERING (animated layer + poison effects)
// ============================================================
let rain = [];
function animate(t) {
  canvas.classList.toggle('pixel', S.viewMode === 'spectrum');
  if (S.viewMode !== 'spectrum') { animateIMG(t); return; }
  fitCanvas();
  cx.setTransform(1, 0, 0, 1, 0, 0);
  frame.set(base);
  const remaining = Math.max(0, S.total - S.elapsed);
  const left = S.total ? remaining / S.total : 1;
  const poison = 1 - left;

  // weather + neon inside the windows
  const lay = S.layout || { weather: 'rain', neonWin: 0, neonWord: 'HOTEL' };
  const wp = WINDOWS.map(windowPoly);
  const inWin = (x, y) => wp.some((p) => inPoly(x + 0.5, y + 0.5, p));
  if (lay.weather === 'rain' || lay.weather === 'snow') {
    if (rain.length < 60) for (let i = 0; i < 4; i++) rain.push({ x: Math.random() * 80, y: Math.random() * 90, v: 1.5 + Math.random() });
    for (const d of rain) {
      const snow = lay.weather === 'snow';
      d.y += snow ? d.v * 0.25 : d.v; d.x += snow ? Math.sin(t / 600 + d.v * 9) * 0.25 : -0.4;
      if (d.y > 90) { d.y = 10; d.x = Math.random() * 80; }
      const n = snow ? 1 : 3;
      for (let k = 0; k < n; k++) { const x = Math.round(d.x - k * 0.3), y = Math.round(d.y + k); if (inWin(x, y)) P(frame, x, y, 1); }
    }
  } else if (lay.weather === 'fog') {
    for (const p of wp) polyEach(p, (x, y) => { if (dith(x, y, 0.18 + 0.1 * Math.sin((x + t / 90) * 0.15))) P(frame, x, y, 1); });
  } else { ellF(frame, 22, 30, 27, 35, 1); }
  const neonOn = neonOnAt(t);
  if (neonOn) { const w = lay.neonWord.slice(0, 5), nx = lay.neonWin ? 58 : 14, ny = lay.neonWin ? 46 : 40; for (let i = 0; i < w.length; i++) text(frame, nx, ny + i * 6, w[i], 1); }
  // something else may be signalling
  if (S.pz && S.mode !== 'title') {
    const mOn = morseVisible() ? morseOnAt(t) : true;
    if (S.pz.morseAt === 'lamp' && !mOn) { polyEach([[6, 130], [54, 130], [48, 116], [12, 116]], (x, y) => P(frame, x, y, 0)); polyO(frame, [[6, 130], [54, 130], [48, 116], [12, 116]]); for (let x = 10; x < 52; x++) for (let y = 131; y < 136; y++) P(frame, x, y, 0); }
    if (S.pz.morseAt === 'radiator' && mOn) { const a = wallPt(66, 0.66); line(frame, a[0] - 3, a[1] - 3, a[0] - 6, a[1] - 6); line(frame, a[0] + 3, a[1] - 3, a[0] + 6, a[1] - 6); }
    if (S.pz.morseAt === 'radio' && S.layout.slots.FURN === 'radio' && mOn) { const r = SLOTS.FURN; rectF(frame, r[0] + 7, r[1] + 34, r[2] - 7, r[1] + 36, 1); }
  }

  // clock: face, hands running backwards, pendulum
  ellF(frame, 141, 28, 155, 42, 1); ellO(frame, 143, 30, 153, 40, 0);
  const mA = (remaining / 3600) * Math.PI * 2 - Math.PI / 2, hA = (remaining / 43200) * Math.PI * 2 - Math.PI / 2;
  line(frame, 148, 35, 148 + 6 * Math.cos(mA), 35 + 6 * Math.sin(mA), 0);
  line(frame, 148, 35, 148 + 3.5 * Math.cos(hA), 35 + 3.5 * Math.sin(hA), 0);
  const sw = Math.sin(t / 1000 * Math.PI) * 0.25;
  const bx = 148 + Math.sin(sw) * 19, by = 47 + Math.cos(sw) * 19;
  line(frame, 148, 47, bx, by); ellF(frame, bx - 3, by - 3, bx + 3, by + 3, 1);

  // cigarette burning down
  rectF(frame, 62, 156, 95, 160, 0);
  const ember = Math.round(64 + (1 - left) * 24);
  for (let x = 64; x < ember; x++) for (const y of [158, 159]) if ((x + y) % 2 === 0) P(frame, x, y, 1);
  if (S.mode !== 'lost' || S.elapsed - S.endAt < 1) {
    rectF(frame, ember, 158, ember + 1, 159, 2);
    if (Math.random() > 0.3) P(frame, ember - 1, 158, 2);
    rectF(frame, ember + 3, 158, 92, 159, 1);
    for (let i = 0; i < 30; i++) if ((i + Math.floor(t / 120)) % 3 !== 2) P(frame, ember + 1 + 3 * Math.sin(i * 0.33 + t / 900) - i * 0.06, 154 - i, 1);
  }

  // telephone ringing / note under the door
  if (S.ringing && Math.floor(t / 250) % 2 === 0) { line(frame, 222, 100, 226, 96); line(frame, 220, 106, 225, 104); line(frame, 246, 98, 250, 94); line(frame, 247, 104, 252, 102); }
  if (S.noteUnder) { polyF(frame, [[182, 106], [196, 105], [198, 110], [184, 111]], 1); line(frame, 183, 108, 196, 107, 0); }

  // door opening at the end
  if (S.mode === 'won' && S.doorOpen < 1) S.doorOpen = Math.min(1, S.doorOpen + 0.01);
  if (S.doorOpen > 0) {
    const w = Math.round(29 * S.doorOpen);
    rectF(frame, 175, 45, 175 + w, 103, 0);
    for (let y = 45; y < 103; y++) for (let x = 175; x <= 175 + w; x++) if (dith(x, y, 0.85)) P(frame, x, y, 1);
    if (S.doorOpen > 0.6) { ellF(frame, 184, 56, 192, 64, 0); rectF(frame, 182, 54, 194, 56, 0); polyF(frame, [[181, 66], [195, 66], [197, 103], [179, 103]], 0); }
  }

  // tiny paper text on the drawn sheet
  const shown = S.lines.slice(-5);
  shown.forEach((l, i) => text(frame, 107, 99 + i * 8, stripAcc(l.text).slice(0, 15), l.who === 'theirs' ? 2 : 0));
  if (S.mode === 'play' && !S.locked) text(frame, 107, 99 + shown.length * 8, ('> ' + S.input).slice(0, 15) + (Math.floor(t / 500) % 2 ? '_' : ''), 0);

  // lit key on the drawn typewriter
  if (S.litKey >= 0 && performance.now() < S.litUntil) { const k = KEYPOS[S.litKey]; ellF(frame, k.x - 3, k.y - 2, k.x + 3, k.y + 2, 1); }

  // hover brackets (XOR, like a Spectrum cursor)
  const h = S.hover;
  if (h && S.mode === 'play' && !S.docOpen) {
    const [x0, y0, x1, y1] = h.r, L = 4;
    const xor = (x, y) => { if (x >= 0 && x < W && y >= 0 && y < H) { const i = y * W + x; frame[i] = frame[i] === 0 ? 1 : 0; } };
    for (let k = 0; k < L; k++) { xor(x0 + k, y0); xor(x0, y0 + k + 1); xor(x1 - k, y0); xor(x1, y0 + k + 1); xor(x0 + k, y1); xor(x0, y1 - k - 1); xor(x1 - k, y1); xor(x1, y1 - k - 1); }
  }
  // gamepad cursor
  if (S.gp.active) {
    const gx = Math.round(S.gp.x), gy = Math.round(S.gp.y);
    for (let k = -3; k <= 3; k++) { const a = gy * W + gx + k, b2 = (gy + k) * W + gx; if (gx + k >= 0 && gx + k < W) frame[a] = frame[a] ? 0 : 1; if (gy + k >= 0 && gy + k < H && k) frame[b2] = frame[b2] ? 0 : 1; }
  }

  // poison: darkness creeps in from the edges, the picture starts to crackle
  if (S.mode === 'play' || S.mode === 'lost') {
    const p = S.mode === 'lost' ? Math.min(1, poison + (S.elapsed - S.endAt) / 3) : poison;
    if (p > 0.35) {
      const k = (p - 0.35) / 0.65;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const e = Math.max(Math.abs(x - 128) / 128, Math.abs(y - 96) / 96);
        const dark = (e - (1 - k * 0.75)) * 3;
        if (dark > 0 && frame[y * W + x] !== 2 && !dith(x, y, 1 - Math.min(1, dark))) frame[y * W + x] = 0;
      }
      const n = Math.floor(k * k * 120);
      for (let i = 0; i < n; i++) { const j = Math.floor(Math.random() * W * H); if (frame[j] !== 2) frame[j] = frame[j] ? 0 : 1; }
      if (p > 0.85 && Math.random() < 0.006) frame.fill(0);
    }
  }

  if (S.spectrum) attributeClash(frame);
  const d = img.data;
  for (let i = 0; i < W * H; i++) { const c = PAL[frame[i]]; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; }
  cx.putImageData(img, 0, 0);
}

// the ZX Spectrum rule: one 8x8 cell may hold only two colours
function attributeClash(b) {
  for (let cy = 0; cy < 24; cy++) for (let cxl = 0; cxl < 32; cxl++) {
    let red = 0, wh = 0, bl = 0;
    for (let y = cy * 8; y < cy * 8 + 8; y++) for (let x = cxl * 8; x < cxl * 8 + 8; x++) { const v = b[y * W + x]; if (v === 2) red++; else if (v === 1) wh++; else bl++; }
    if (!red || !wh || !bl) continue;
    const other = wh > bl ? 1 : 0, drop = other === 1 ? 0 : 1;
    for (let y = cy * 8; y < cy * 8 + 8; y++) for (let x = cxl * 8; x < cxl * 8 + 8; x++) if (b[y * W + x] === drop) b[y * W + x] = other;
  }
}

// ============================================================
// 11b. HIGH-RESOLUTION NOIR RENDERER (browser version)
// Same 256x192 coordinate system as the pixel room, drawn with vectors and greys.
// ============================================================
const HD = { stat: document.createElement('canvas'), lr: document.createElement('canvas'), dirty: true, key: '', grain: null, smoke: [], px: 2 };
HD.lr.width = W * HD.px; HD.lr.height = H * HD.px; HD.lc = HD.lr.getContext('2d', { willReadFrequently: true });
// pixel-art look: a few greys + red, ordered dithering
const GREYS = [0, 30, 62, 100, 145, 195, 240];
const BAY8 = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21].map((v) => (v + 0.5) / 64);
function pixelate(c) {
  const w = c.canvas.width, h = c.canvas.height, im = c.getImageData(0, 0, w, h), d = im.data;
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2], th = BAY8[(y & 7) * 8 + (x & 7)];
    if (r > 90 && r - g > 70 && r - b > 70) {
      const k = Math.min(1, (r - 70) / 90);
      if (k > th) { d[i] = 232; d[i + 1] = 20; d[i + 2] = 27; } else { d[i] = 70; d[i + 1] = 0; d[i + 2] = 4; }
      continue;
    }
    const L = 0.3 * r + 0.59 * g + 0.11 * b;
    let k = 0; while (k < GREYS.length - 2 && L > GREYS[k + 1]) k++;
    const f = (L - GREYS[k]) / (GREYS[k + 1] - GREYS[k]);
    const v = f > th ? GREYS[k + 1] : GREYS[k];
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  c.putImageData(im, 0, 0);
}
const RED = '#e8141b';
function hdPath(c, pts) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }
function hdFill(c, pts, f) { hdPath(c, pts); c.fillStyle = f; c.fill(); }
function hdStroke(c, pts, s, w = 0.4) { hdPath(c, pts); c.strokeStyle = s; c.lineWidth = w; c.stroke(); }
function lg(c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; }
function rg(c, x, y, r0, r1, stops) { const g = c.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; }
function hdRect(c, x0, y0, x1, y1, f) { c.fillStyle = f; c.fillRect(x0, y0, x1 - x0, y1 - y0); }
function hdLine(c, x0, y0, x1, y1, s, w = 0.4) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.strokeStyle = s; c.lineWidth = w; c.stroke(); }
function hdEll(c, x0, y0, x1, y1, f, s, w = 0.4) { c.beginPath(); c.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2); if (f) { c.fillStyle = f; c.fill(); } if (s) { c.strokeStyle = s; c.lineWidth = w; c.stroke(); } }
function hdBox(c, [x0, y0, x1, y1], top = '#3a3a3a', bottom = '#151515') { hdRect(c, x0, y0, x1, y1, lg(c, x0, y0, x1, y1, [[0, top], [1, bottom]])); c.strokeStyle = '#000'; c.lineWidth = 0.5; c.strokeRect(x0, y0, x1 - x0, y1 - y0); }
const PAPER = '#ece7d8';

// ---- interchangeable objects, noir style ----
const OBJ_HD = {
  calendar(c, [x0, y0, x1]) { const w = x1 - x0 - 4, X = x0 + 2;
    hdRect(c, X, y0 + 1, X + w, y0 + 27, PAPER); hdRect(c, X, y0 + 1, X + w, y0 + 7, '#222'); c.fillStyle = '#ddd'; c.font = '3.6px "Special Elite", monospace'; c.fillText('OCT 1934', X + 2, y0 + 5.5);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) { c.strokeStyle = '#8a857a'; c.lineWidth = 0.2; c.strokeRect(X + 1 + k * (w - 2) / 6, y0 + 9 + r * 4.4, (w - 2) / 6, 4.4); }
    hdLine(c, X + w / 2, y0 - 2, X + w / 2, y0 + 1, '#777', 0.4); c.shadowColor = 'transparent'; },
  painting(c, [x0, y0, x1, y1]) { const r = [x0, y0 + 3, x1, y1 - 3]; hdBox(c, r, '#5a5040', '#2a2418');
    hdRect(c, x0 + 2.5, y0 + 5.5, x1 - 2.5, y1 - 5.5, lg(c, 0, y0 + 5, 0, y1 - 5, [[0, '#9a9a9a'], [0.55, '#4a4a4a'], [1, '#1c1c1c']]));
    c.beginPath(); c.moveTo(x0 + 2.5, y1 - 10); for (let x = x0 + 2.5; x <= x1 - 2.5; x += 1) c.lineTo(x, y1 - 12 - Math.sin(x * 0.5) * 2); c.lineTo(x1 - 2.5, y1 - 5.5); c.lineTo(x0 + 2.5, y1 - 5.5); c.fillStyle = '#121212'; c.fill();
    hdLine(c, x0 + 12, y1 - 13, x0 + 12, y1 - 20, '#121212', 0.6); hdLine(c, x0 + 12, y1 - 20, x0 + 16, y1 - 14, '#cfcfcf', 0.3); },
  map(c, [x0, y0, x1, y1]) { hdRect(c, x0, y0 + 2, x1, y1 - 2, '#b9b4a6'); c.strokeStyle = '#6a665c'; c.lineWidth = 0.3;
    for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(x0 + 1, y0 + 6 + i * 4.5); c.bezierCurveTo(x0 + 8, y0 + 3 + i * 5, x1 - 8, y0 + 9 + i * 4, x1 - 1, y0 + 6 + i * 4.8); c.stroke(); }
    hdEll(c, x0 + 12, y0 + 11, x0 + 17, y0 + 16, null, RED, 0.5); },
  photo(c, [x0, y0, x1, y1]) { hdBox(c, [x0 + 3, y0 + 2, x1 - 3, y1 - 2], '#444', '#222'); hdRect(c, x0 + 5, y0 + 4, x1 - 5, y1 - 4, lg(c, 0, y0, 0, y1, [[0, '#8f8f8f'], [1, '#3a3a3a']]));
    const cx0 = (x0 + x1) / 2; hdEll(c, cx0 - 3, y0 + 8, cx0 + 3, y0 + 15, '#1a1a1a'); hdFill(c, [[cx0 - 6, y1 - 4], [cx0 - 5, y0 + 17], [cx0 + 5, y0 + 17], [cx0 + 6, y1 - 4]], '#1a1a1a'); },
  mirror(c, [x0, y0, x1, y1]) { hdEll(c, x0 + 3, y0, x1 - 3, y1, '#3d3d3d', '#777', 0.8); hdEll(c, x0 + 5, y0 + 2, x1 - 5, y1 - 2, lg(c, x0, y0, x1, y1, [[0, '#9aa0a6'], [0.5, '#3a3d40'], [1, '#15171a']])); hdLine(c, x0 + 8, y0 + 8, x0 + 12, y0 + 4, 'rgba(255,255,255,.6)', 0.5); },
  newspaper(c, [x0, y0, x1, y1]) { hdRect(c, x0, y0 + 2, x1, y1, '#d8d3c4'); c.fillStyle = '#222'; c.font = '3px "Special Elite", monospace'; c.fillText('GAZETTE', x0 + 2, y0 + 6);
    hdRect(c, x0 + 2, y0 + 8, x1 - 2, y0 + 8.4, '#333'); hdRect(c, x0 + 2, y0 + 10, x0 + 10, y0 + 19, '#555');
    for (let y = y0 + 10; y < y1 - 1; y += 1.6) { hdRect(c, x0 + 11, y, x1 - 2, y + 0.5, '#888'); if (y > y0 + 20) hdRect(c, x0 + 2, y, x0 + 10, y + 0.5, '#888'); } },
  cabinet(c, [x0, y0, x1, y1]) { hdBox(c, [x0 + 2, y0 + 2, x1 - 2, y1 - 2], '#4a4a4a', '#1a1a1a');
    for (const y of [y0 + 12, y0 + 22, y0 + 32]) { hdLine(c, x0 + 2, y, x1 - 2, y, '#0a0a0a', 0.6); hdLine(c, x0 + 2, y + 0.6, x1 - 2, y + 0.6, '#5a5a5a', 0.2); hdRect(c, x0 + 9, y - 6, x0 + 15, y - 4.8, '#aaa'); } },
  safe(c, [x0, y0, x1, y1]) { hdBox(c, [x0 + 1, y0 + 16, x1 - 1, y1 - 2], '#555', '#1c1c1c'); hdRect(c, x0 + 4, y0 + 19, x1 - 4, y1 - 5, lg(c, x0, 0, x1, 0, [[0, '#3c3c3c'], [1, '#202020']]));
    hdEll(c, x0 + 8, y0 + 26, x0 + 16, y0 + 34, '#888', '#222', 0.4); hdEll(c, x0 + 10.5, y0 + 28.5, x0 + 13.5, y0 + 31.5, '#222'); hdRect(c, x1 - 9, y0 + 26, x1 - 7.5, y0 + 36, '#999'); },
  radio(c, [x0, y0, x1, y1]) { const pts = [[x0 + 2, y1 - 2], [x0 + 2, y0 + 14], [(x0 + x1) / 2, y0 + 8], [x1 - 2, y0 + 14], [x1 - 2, y1 - 2]]; hdFill(c, pts, lg(c, x0, y0, x1, y1, [[0, '#5a4a3a'], [1, '#1d1712']])); hdStroke(c, pts, '#000', 0.5);
    for (let y = y0 + 16; y < y0 + 30; y += 1.6) hdLine(c, x0 + 5, y, x1 - 5, y, '#0d0b09', 0.6); hdRect(c, x0 + 6, y0 + 32, x1 - 6, y0 + 37, '#cfc6a8'); hdEll(c, x0 + 5, y1 - 9, x0 + 9, y1 - 5, '#aaa'); hdEll(c, x1 - 9, y1 - 9, x1 - 5, y1 - 5, '#aaa'); },
  chest(c, [x0, y0, x1, y1]) { hdBox(c, [x0 + 1, y0 + 10, x1 - 1, y1 - 2], '#4a3e33', '#1a1510');
    for (let k = 0; k < 4; k++) { const y = y0 + 12 + k * 8.5; c.strokeStyle = '#0b0907'; c.lineWidth = 0.5; c.strokeRect(x0 + 3, y, x1 - x0 - 6, 6.5); hdEll(c, (x0 + x1) / 2 - 1, y + 2.5, (x0 + x1) / 2 + 1, y + 4.5, '#bbb'); } },
  basket(c, [x0, y0, x1, y1]) { const q = [[x0 + 6, y0 + 6], [x1 - 6, y0 + 6], [x1 - 9, y1], [x0 + 9, y1]]; hdFill(c, q, lg(c, x0, 0, x1, 0, [[0, '#4a4a4a'], [1, '#141414']])); for (let x = x0 + 9; x < x1 - 8; x += 2.5) hdLine(c, x, y0 + 7, x + (x < (x0 + x1) / 2 ? 1 : -1), y1 - 1, '#0a0a0a', 0.3);
    hdEll(c, x0 + 9, y0 + 1, x0 + 17, y0 + 8, '#d6d1c2'); hdEll(c, x0 + 14, y0 + 2, x0 + 22, y0 + 8, '#bdb8aa'); },
  umbrella(c, [x0, y0, x1, y1]) { hdRect(c, x0 + 9, y0 + 8, x1 - 9, y1, lg(c, x0 + 9, 0, x1 - 9, 0, [[0, '#555'], [0.4, '#2a2a2a'], [1, '#0e0e0e']])); hdLine(c, x0 + 12, y0 + 8, x0 + 10, y0 - 6, '#111', 1.2); c.beginPath(); c.arc(x0 + 8, y0 - 6, 2.3, Math.PI, 0); c.strokeStyle = '#555'; c.lineWidth = 0.8; c.stroke(); },
  globe(c, [x0, y0, x1, y1]) { const m = (x0 + x1) / 2; hdEll(c, m - 9, y0 + 1, m + 9, y0 + 19, rg(c, m - 4, y0 + 6, 1, 13, [[0, '#9a9a9a'], [1, '#1e1e1e']]), '#000', 0.4); hdEll(c, m - 4, y0 + 1, m + 4, y0 + 19, null, 'rgba(0,0,0,.6)', 0.3); hdLine(c, m - 9, y0 + 10, m + 9, y0 + 10, 'rgba(0,0,0,.6)', 0.3);
    hdLine(c, m, y0 + 19, m, y1 - 2, '#777', 1); hdRect(c, m - 6, y1 - 2, m + 6, y1, '#555'); },
  crate(c, [x0, y0, x1, y1]) { hdBox(c, [x0 + 3, y0 + 6, x1 - 3, y1], '#6a5a46', '#2a2218'); for (let y = y0 + 11; y < y1; y += 5) hdLine(c, x0 + 3, y, x1 - 3, y, '#1a140e', 0.4); hdLine(c, x0 + 3, y0 + 6, x1 - 3, y1, '#1a140e', 0.8); c.fillStyle = '#111'; c.font = '4px "Special Elite", monospace'; c.fillText('XX', x0 + 8, y0 + 16); },
  notepad(c, [x0, y0, x1, y1]) { const q = [[x0 + 2, y0 + 10], [x0 + 38, y0 + 4], [x0 + 44, y1 - 4], [x0 + 6, y1]]; hdFill(c, q, '#e3dcc6'); for (let k = 0; k < 5; k++) hdLine(c, x0 + 7, y0 + 13 + k * 3.5, x0 + 37, y0 + 8 + k * 3.5, '#8a9bb0', 0.25); hdLine(c, x0 + 7, y0 + 12, x0 + 30, y0 + 8, '#333', 0.35); },
  letter(c, [x0, y0, x1, y1]) { const q = [[x0 + 2, y0 + 10], [x0 + 42, y0 + 4], [x0 + 48, y1 - 2], [x0 + 8, y1]]; hdFill(c, q, '#e9e3d2'); const mx = x0 + 25, my = y0 + 17; hdLine(c, x0 + 2, y0 + 10, mx, my, '#9a9484', 0.4); hdLine(c, x0 + 42, y0 + 4, mx, my, '#9a9484', 0.4); hdEll(c, mx - 2.5, my - 2.5, mx + 2.5, my + 2.5, RED); },
  deskphoto(c, [x0, y0, x1, y1]) { const x = x0 + 14; hdBox(c, [x, y0 + 2, x + 18, y1 - 6], '#666', '#2a2a2a'); hdRect(c, x + 2, y0 + 4, x + 16, y1 - 8, lg(c, 0, y0, 0, y1, [[0, '#8a8a8a'], [1, '#2f2f2f']])); hdEll(c, x + 6, y0 + 7, x + 12, y0 + 13, '#1d1d1d'); hdRect(c, x + 5, y0 + 14, x + 13, y1 - 8, '#1d1d1d'); },
  cigarbox(c, [x0, y0, x1, y1]) { const q = [[x0 + 6, y0 + 12], [x0 + 38, y0 + 8], [x0 + 42, y1 - 6], [x0 + 9, y1 - 2]]; hdFill(c, q, lg(c, x0, y0, x1, y1, [[0, '#5a4532'], [1, '#22180f']])); hdFill(c, [[x0 + 16, y0 + 13], [x0 + 30, y0 + 11], [x0 + 31, y0 + 16], [x0 + 17, y0 + 18]], '#d8cfb0'); },
  folded(c, [x0, y0, x1, y1]) { const q = [[x0 + 2, y0 + 12], [x0 + 40, y0 + 6], [x0 + 45, y1 - 4], [x0 + 6, y1 - 1]]; hdFill(c, q, '#d2cdbf'); for (let k = 0; k < 5; k++) hdLine(c, x0 + 8, y0 + 15 + k * 2.6, x0 + 38, y0 + 10 + k * 2.6, '#7c776b', 0.3); hdLine(c, x0 + 8, y0 + 12, x0 + 30, y0 + 8.5, '#222', 0.8); }
};

function drawStaticHD(c, layout) {
  const s = c.canvas.width / W;
  c.setTransform(s, 0, 0, s, 0, 0);
  c.fillStyle = '#050505'; c.fillRect(0, 0, W, H);
  // ceiling
  hdFill(c, [[0, 0], [256, 0], [BX1, BY0], [BX0, BY0]], lg(c, 0, 0, 0, BY0, [[0, '#060606'], [1, '#141414']]));
  // back wall with lamp glow and wallpaper stripes
  hdRect(c, BX0, BY0, BX1, BY1, '#1b1b1b');
  hdRect(c, BX0, BY0, BX1, BY1, rg(c, 150, 30, 4, 90, [[0, 'rgba(255,250,230,.22)'], [1, 'rgba(0,0,0,0)']]));
  for (let x = BX0; x < BX1; x += 6) hdLine(c, x, BY0, x, BY1, 'rgba(0,0,0,.25)', 0.3);
  c.save(); hdPath(c, [[BX0, BY0], [BX1, BY0], [BX1, BY1], [BX0, BY1]]); c.clip();
  for (let k = -6; k < 8; k++) { const x = BX0 + k * 14; hdFill(c, [[x, BY1], [x + 5, BY1], [x + 40, BY0], [x + 35, BY0]], 'rgba(220,225,235,.05)'); }
  c.restore();
  hdRect(c, BX0, BY1 - 14, BX1, BY1, 'rgba(0,0,0,.35)'); hdLine(c, BX0, BY1 - 14, BX1, BY1 - 14, '#2c2c2c', 0.5);   // wainscot
  // side walls
  hdFill(c, [[0, 0], [BX0, BY0], [BX0, BY1], [0, 150]], lg(c, 0, 0, BX0, 0, [[0, '#0b0b0b'], [1, '#191919']]));
  hdFill(c, [[256, 0], [BX1, BY0], [BX1, BY1], [256, 150]], lg(c, 256, 0, BX1, 0, [[0, '#050505'], [1, '#121212']]));
  // floor: planks converging to the vanishing point
  const floor = [[0, 150], [BX0, BY1], [BX1, BY1], [256, 150]];
  hdFill(c, floor, lg(c, 0, BY1, 0, 150, [[0, '#151515'], [1, '#262422']]));
  c.save(); hdPath(c, floor); c.clip();
  for (let bx = BX0 - 60; bx < BX1 + 70; bx += 6) { const dx = bx - VP[0], dy = BY1 - VP[1]; hdLine(c, bx, BY1, VP[0] + dx * 2.6, VP[1] + dy * 2.6, 'rgba(0,0,0,.55)', 0.35); }
  // light pool of the hanging lamp + moonlight stripes from the blinds
  c.fillStyle = rg(c, 150, 122, 2, 60, [[0, 'rgba(255,250,225,.16)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(0, BY1, 256, 50);
  for (let k = 0; k < 7; k++) { const x = 6 + k * 13; hdFill(c, [[x, 150], [x + 6, 150], [x + 30, BY1], [x + 26, BY1]], 'rgba(200,210,230,.06)'); }
  c.restore();
  // rug
  const rug = [[104, 112], [176, 112], [196, 132], [88, 132]];
  hdFill(c, rug, '#1a1616'); hdStroke(c, rug, '#3a3030', 0.7); hdStroke(c, [[110, 115], [171, 115], [187, 129], [96, 129]], '#2c2424', 0.5);
  // windows on the left wall
  WINDOWS.forEach((wdw) => {
    const q = windowPoly(wdw);
    hdFill(c, q, lg(c, 0, q[0][1], 0, q[2][1], [[0, '#0c1016'], [1, '#1a1f26']]));
    c.save(); hdPath(c, q); c.clip();
    for (let i = 0; i < 6; i++) { const bx = wdw[0] + i * 6, top = 40 + ((i * 37) % 17); hdRect(c, bx, top, bx + 5, 90, '#050608'); for (let y = top + 2; y < 88; y += 3) for (let x = bx + 1; x < bx + 5; x += 2) if (((x * 7 + y * 13) % 5) === 0) hdRect(c, x, y, x + 0.8, y + 1, 'rgba(230,220,170,.55)'); }
    c.restore();
    for (let k = 0; k < 9; k++) { const v = 0.18 + 0.44 * 0.45 * k / 8; const a = wallPt(wdw[0], v), d = wallPt(wdw[1], v); hdLine(c, a[0], a[1], d[0], d[1], '#8c8c8c', 0.9); hdLine(c, a[0], a[1] + 0.6, d[0], d[1] + 0.6, '#2a2a2a', 0.3); }
    hdStroke(c, q, '#3a3a3a', 1.6); hdStroke(c, q, '#6a6a6a', 0.4);
    const m0 = wallPt((wdw[0] + wdw[1]) / 2, 0.18), m1 = wallPt((wdw[0] + wdw[1]) / 2, 0.62); hdLine(c, m0[0], m0[1], m1[0], m1[1], '#3a3a3a', 1.2);
    const s0 = wallPt(wdw[0] - 2, 0.64), s1 = wallPt(wdw[1] + 2, 0.64); hdLine(c, s0[0], s0[1], s1[0], s1[1], '#4a4a4a', 1.4);
  });
  // radiator
  for (let k = 0; k < 9; k++) { const a = wallPt(54 + k * 3, 0.68), d = wallPt(54 + k * 3, 0.86); hdLine(c, a[0], a[1], d[0], d[1], '#3c3c3c', 1.6); hdLine(c, a[0] - 0.5, a[1], d[0] - 0.5, d[1], '#666', 0.3); }
  // hanging lamp
  hdLine(c, 150, 0, 150, 14, '#333', 0.5); hdFill(c, [[140, 22], [160, 22], [154, 14], [146, 14]], lg(c, 140, 0, 160, 0, [[0, '#222'], [0.5, '#555'], [1, '#1a1a1a']]));
  hdEll(c, 146, 21, 154, 26, rg(c, 150, 23, 0.5, 5, [[0, '#fffbe8'], [1, 'rgba(255,240,200,.2)']]));
  // clock case (face and hands are animated)
  hdBox(c, [140, 26, 156, 78], '#4a3a2c', '#1e1710'); hdRect(c, 143, 46, 153, 74, '#0c0b0a'); hdEll(c, 140.5, 27, 155.5, 43, '#2b2118');
  hdEll(c, 141.5, 28, 154.5, 42, rg(c, 146, 32, 1, 9, [[0, '#f4efe2'], [1, '#bdb6a4']]));
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; hdLine(c, 148 + 5.6 * Math.cos(a), 35 + 5.6 * Math.sin(a), 148 + 6.3 * Math.cos(a), 35 + 6.3 * Math.sin(a), '#222', i % 3 ? 0.25 : 0.5); }
  // coat rack, hat, coat
  hdLine(c, 162, 46, 162, 103, '#2c2c2c', 1); hdLine(c, 157, 103, 167, 103, '#2c2c2c', 1);
  hdFill(c, [[157, 50], [167, 50], [170, 88], [154, 88]], lg(c, 154, 0, 170, 0, [[0, '#5c5a55'], [0.5, '#3c3a36'], [1, '#1e1d1b']]));
  hdLine(c, 162, 52, 161, 86, 'rgba(0,0,0,.6)', 0.3); hdEll(c, 154, 43, 170, 48, '#222'); hdFill(c, [[157.5, 45], [158.5, 38], [165.5, 38], [166.5, 45]], '#2a2a2a'); hdRect(c, 157.5, 43, 166.5, 44.3, '#555');
  // door with frosted glass, reversed lettering, red light underneath
  hdBox(c, [174, 44, 204, 104], '#3a2f25', '#17120d');
  hdRect(c, 178, 50, 200, 72, lg(c, 0, 50, 0, 72, [[0, '#b9b9b4'], [1, '#6f6f6b']]));
  c.save(); c.translate(189, 63); c.scale(-1, 1); c.fillStyle = '#1a1a1a'; c.font = '5px "Special Elite", monospace'; c.textAlign = 'center'; c.fillText('P.I.', 0, 0); c.restore(); c.textAlign = 'left';
  c.strokeStyle = '#0d0a07'; c.lineWidth = 0.5; c.strokeRect(178, 77, 22, 23); hdLine(c, 189, 77, 189, 100, '#0d0a07', 0.5); hdEll(c, 199.5, 80, 202.5, 83, '#b8a77a');
  // bookshelf on the right wall
  for (let k = 0; k < 4; k++) { const y = 40 + k * 16;
    for (let x = 216; x < 252; x += 2.6) { const yy = y + (x - 214) * 18 / 40, h = 5 + ((x * 7 + k * 13) % 5); const g = 25 + ((x * 13 + k * 7) % 40); hdRect(c, x, yy - h, x + 2.2, yy - 0.5, `rgb(${g},${g},${g})`); }
    hdLine(c, 214, y, 254, y + 18, '#3a3a3a', 0.8); }
  { const k = layout.bookShelf, y = 40 + k * 16, x = layout.bookX, yy = y + (x - 214) * 18 / 40; hdRect(c, x - 1, yy - 12, x + 2.5, yy - 0.5, '#8a8478'); }
  // interchangeable objects
  for (const slot of Object.keys(SLOTS)) { const id = layout.slots[slot]; if (id && OBJ_HD[id]) OBJ_HD[id](c, SLOTS[slot]); }
  // desk
  const DY = 140;
  hdRect(c, 0, DY, 256, H, lg(c, 0, DY, 0, H, [[0, '#2a2420'], [1, '#14100d']]));
  for (let y = DY + 2; y < H; y += 2.2) { c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= 256; x += 16) c.lineTo(x, y + Math.sin(x * 0.05 + y) * 0.6); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 0.25; c.stroke(); }
  hdRect(c, 0, DY, 256, DY + 1.2, '#4a4038');
  c.fillStyle = rg(c, 30, 152, 2, 70, [[0, 'rgba(255,245,215,.30)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(0, DY, 256, H - DY);
  c.fillStyle = lg(c, 150, 0, 256, 0, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.55)']]); c.fillRect(150, DY, 106, H - DY);
  hdFill(c, [[174, 152], [214, 156], [232, 192], [190, 192]], 'rgba(0,0,0,.45)');
  // banker's lamp (shade and pool; flicker is animated)
  hdEll(c, 18, 150, 44, 157, lg(c, 18, 0, 44, 0, [[0, '#8a7a50'], [1, '#3a3220']])); hdLine(c, 31, 128, 31, 151, '#8a7a50', 1.6);
  hdFill(c, [[6, 130], [54, 130], [48, 116], [12, 116]], lg(c, 0, 116, 0, 130, [[0, '#3c3c3c'], [0.6, '#1c1c1c'], [1, '#0c0c0c']])); hdLine(c, 6, 130, 54, 130, '#777', 0.5);
  hdFill(c, [[8, 131], [52, 131], [62, 138], [-2, 138]], 'rgba(255,245,210,.25)');
  // ashtray (cigarette is animated)
  hdEll(c, 54, 160, 84, 172, lg(c, 54, 0, 84, 0, [[0, '#9a9a9a'], [1, '#4a4a4a']])); hdEll(c, 57, 161, 81, 169, '#151515'); hdEll(c, 60, 163, 78, 168, null, '#444', 0.3);
  // telephone
  hdEll(c, 222, 152, 248, 160, '#111', '#333', 0.4); hdRect(c, 233, 112, 237, 153, lg(c, 233, 0, 237, 0, [[0, '#444'], [0.5, '#151515'], [1, '#050505']]));
  hdEll(c, 228, 104, 242, 114, '#111', '#444', 0.5); hdEll(c, 231.5, 106.5, 238.5, 112, '#2a2a2a'); hdRect(c, 242, 118, 247, 138, '#0d0d0d'); hdLine(c, 237, 124, 242, 124, '#333', 0.6);
  // typewriter: paper area (text is animated), platen, body, typebars, keys
  hdRect(c, PAPER_BOX[0], PAPER_BOX[1], PAPER_BOX[2], PAPER_BOX[3], lg(c, 0, PAPER_BOX[1], 0, PAPER_BOX[3], [[0, '#d9d3c2'], [0.15, PAPER], [1, '#f2ede0']]));
  hdRect(c, 92, 144, 180, 151, lg(c, 0, 144, 0, 151, [[0, '#3a3a3a'], [0.5, '#0c0c0c'], [1, '#222']])); hdLine(c, 94, 146, 178, 146, 'rgba(255,255,255,.35)', 0.3);
  hdRect(c, 86, 142, 92, 153, '#bdbdbd'); hdRect(c, 180, 142, 186, 153, '#bdbdbd'); hdLine(c, 186, 146, 195, 137, '#aaa', 1.2);
  const body = [[98, 152], [174, 152], [190, 192], [82, 192]];
  hdFill(c, body, lg(c, 82, 0, 190, 0, [[0, '#3a3a3a'], [0.35, '#151515'], [1, '#050505']])); hdStroke(c, body, '#555', 0.4);
  for (let i = 0; i < 25; i++) { const a = Math.PI * (0.1 + 0.8 * i / 24); hdLine(c, 136 + 24 * Math.cos(a), 162 - 7 * Math.sin(a), 136 + 11 * Math.cos(a), 158 - 2 * Math.sin(a), '#8a8a8a', 0.25); }
  hdEll(c, 128, 155, 144, 161, '#0a0a0a', '#777', 0.3);
  for (const k of KEYPOS) { hdEll(c, k.x - 3, k.y - 2.2, k.x + 3, k.y + 2.2, '#0d0d0d', '#b8b8b8', 0.45); hdEll(c, k.x - 1.8, k.y - 1.5, k.x + 0.5, k.y - 0.4, 'rgba(255,255,255,.18)'); }
  hdRect(c, 118, 187, 154, 189.5, '#9a9a9a');
  // red cable: thick near, thin far
  for (let i = 1; i < CABLE.length; i++) { const [x0, y0] = CABLE[i - 1], [x1, y1] = CABLE[i]; hdLine(c, x0, y0, x1, y1, RED, y1 > 124 ? 1.6 : y1 > 112 ? 1.1 : 0.7); }
  hdLine(c, 176, 103.6, 202, 103.6, RED, 0.8);
  c.fillStyle = rg(c, 189, 104, 0, 16, [[0, 'rgba(232,20,27,.35)'], [1, 'rgba(232,20,27,0)']]); c.fillRect(170, 96, 38, 14);
}
const PAPER_BOX = [104, 86, 168, 143];

function wrapLines(c, lines, maxW) {
  const out = [];
  for (const l of lines) {
    const words = l.text.split(' '); let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxW && cur) { out.push({ text: cur, who: l.who }); cur = w; } else cur = t; }
    out.push({ text: cur, who: l.who });
  }
  return out;
}

function animateHD(t) {
  const c = HD.lc, s = HD.lr.width / W;
  const lay = S.layout;
  const key = `${HD.lr.width}|${S.token}|${S.mode === 'title'}`;
  if (HD.dirty || HD.key !== key) { HD.stat.width = HD.lr.width; HD.stat.height = HD.lr.height; drawStaticHD(HD.stat.getContext('2d'), lay); HD.key = key; HD.dirty = false; }
  c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(HD.stat, 0, 0);
  c.setTransform(s, 0, 0, s, 0, 0);
  const remaining = Math.max(0, S.total - S.elapsed), left = S.total ? remaining / S.total : 1, poison = 1 - left;
  // weather + neon inside the windows
  c.save(); c.beginPath(); WINDOWS.map(windowPoly).forEach((q) => { q.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }); c.clip();
  if (lay.weather === 'rain' || lay.weather === 'snow') {
    if (rain.length < 70) for (let i = 0; i < 4; i++) rain.push({ x: Math.random() * 80, y: Math.random() * 90, v: 1.5 + Math.random() });
    for (const d of rain) { const snow = lay.weather === 'snow'; d.y += snow ? d.v * 0.25 : d.v; d.x += snow ? Math.sin(t / 600 + d.v * 9) * 0.25 : -0.4; if (d.y > 90) { d.y = 10; d.x = Math.random() * 80; }
      if (snow) hdEll(c, d.x - 0.5, d.y - 0.5, d.x + 0.5, d.y + 0.5, 'rgba(240,240,240,.8)'); else hdLine(c, d.x, d.y, d.x - 0.6, d.y + 2.4, 'rgba(200,210,225,.45)', 0.25); }
  } else if (lay.weather === 'fog') { c.fillStyle = `rgba(190,195,200,${0.22 + 0.06 * Math.sin(t / 900)})`; c.fillRect(0, 0, 90, 100); }
  else { hdEll(c, 20, 28, 28, 36, rg(c, 24, 32, 0.5, 6, [[0, '#f2f2ea'], [1, 'rgba(240,240,230,0)']])); }
  if (neonOnAt(t)) {
    const w = lay.neonWord.slice(0, 5), nx = lay.neonWin ? 59.5 : 15.5, ny = lay.neonWin ? 46 : 40;
    c.font = '5px "Special Elite", monospace'; c.textAlign = 'center'; c.shadowColor = 'rgba(255,255,255,.9)'; c.shadowBlur = 6 * s; c.fillStyle = '#f6f6f0';
    for (let i = 0; i < w.length; i++) c.fillText(w[i], nx, ny + 4.5 + i * 6);
    c.shadowBlur = 0; c.textAlign = 'left';
  }
  c.restore();
  // clock hands (no second hand), pendulum
  const mA = (remaining / 3600) * Math.PI * 2 - Math.PI / 2, hA = (remaining / 43200) * Math.PI * 2 - Math.PI / 2;
  c.lineCap = 'round';
  hdLine(c, 148, 35, 148 + 3.6 * Math.cos(hA), 35 + 3.6 * Math.sin(hA), '#111', 0.9);
  hdLine(c, 148, 35, 148 + 5.4 * Math.cos(mA), 35 + 5.4 * Math.sin(mA), '#111', 0.55);
  hdEll(c, 147.4, 34.4, 148.6, 35.6, '#111');
  const sw = Math.sin(t / 1000 * Math.PI) * 0.25, bx = 148 + Math.sin(sw) * 19, by = 47 + Math.cos(sw) * 19;
  hdLine(c, 148, 47, bx, by, '#9a8a5a', 0.4); hdEll(c, bx - 3, by - 3, bx + 3, by + 3, rg(c, bx - 1, by - 1, 0.3, 3.5, [[0, '#e8dcaa'], [1, '#6a5a2a']]));
  c.lineCap = 'butt';
  // cigarette burning down, smoke
  const ember = 64 + (1 - left) * 24;
  for (let x = 64; x < ember; x += 1.1) hdEll(c, x, 157.6, x + 1.2, 159.8, `rgb(${110 + ((x * 37) % 50)},${110 + ((x * 37) % 50)},${105 + ((x * 37) % 50)})`);
  if (S.mode !== 'lost' || S.elapsed - S.endAt < 1) {
    const glow = 0.75 + 0.25 * Math.sin(t / 180);
    c.fillStyle = rg(c, ember + 0.8, 158.7, 0, 4, [[0, `rgba(255,60,30,${0.6 * glow})`], [1, 'rgba(255,40,20,0)']]); c.fillRect(ember - 4, 154, 9, 9);
    hdRect(c, ember, 157.6, ember + 1.6, 159.8, `rgb(255,${Math.round(40 + 50 * glow)},30)`);
    hdRect(c, ember + 1.6, 157.6, 88, 159.8, '#f0ece2'); hdRect(c, 88, 157.6, 92, 159.8, '#c9a46a');
    if (Math.random() < 0.3) HD.smoke.push({ x: ember + 1, y: 156, a: 0.35, r: 0.6, ph: Math.random() * 6 });
  }
  HD.smoke = HD.smoke.filter((p) => p.a > 0.01);
  for (const p of HD.smoke) { p.y -= 0.22; p.x += Math.sin(t / 500 + p.ph) * 0.08; p.r += 0.03; p.a *= 0.985; hdEll(c, p.x - p.r, p.y - p.r, p.x + p.r, p.y + p.r, `rgba(220,220,220,${p.a * 0.35})`); }
  // something may be signalling
  if (S.pz && S.mode !== 'title') {
    const mOn = morseVisible() ? morseOnAt(t) : true;
    if (S.pz.morseAt === 'lamp' && !mOn) { hdFill(c, [[6, 130], [54, 130], [48, 116], [12, 116]], 'rgba(0,0,0,.6)'); c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(-2, 130, 70, 40); }
    if (S.pz.morseAt === 'radiator' && mOn) { const a = wallPt(66, 0.66); hdLine(c, a[0] - 3, a[1] - 3, a[0] - 6, a[1] - 6, '#ddd', 0.4); hdLine(c, a[0] + 3, a[1] - 3, a[0] + 6, a[1] - 6, '#ddd', 0.4); }
    if (S.pz.morseAt === 'radio' && lay.slots.FURN === 'radio' && mOn) { const r = SLOTS.FURN; c.fillStyle = rg(c, (r[0] + r[2]) / 2, r[1] + 34.5, 0, 8, [[0, 'rgba(255,240,190,.9)'], [1, 'rgba(255,240,190,0)']]); c.fillRect(r[0], r[1] + 28, r[2] - r[0], 14); }
  } else if (Math.random() < 0.002) { /* idle */ }
  // telephone ringing / note under the door / door opening
  if (S.ringing && Math.floor(t / 250) % 2 === 0) { for (const [x0, y0, x1, y1] of [[222, 100, 226, 96], [220, 106, 225, 104], [246, 98, 250, 94], [247, 104, 252, 102]]) hdLine(c, x0, y0, x1, y1, '#eee', 0.5); }
  if (S.noteUnder) { hdFill(c, [[182, 106], [196, 105], [198, 110], [184, 111]], '#e9e4d6'); hdLine(c, 183.5, 108, 196, 107, '#999', 0.3); }
  if (S.mode === 'won' && S.doorOpen < 1) S.doorOpen = Math.min(1, S.doorOpen + 0.01);
  if (S.doorOpen > 0) { const w = 29 * S.doorOpen; hdRect(c, 175, 45, 175 + w, 103, rg(c, 189, 74, 2, 40, [[0, '#f4f1e6'], [1, '#8a8780']]));
    if (S.doorOpen > 0.6) { c.globalAlpha = (S.doorOpen - 0.6) / 0.4; hdEll(c, 184, 56, 192, 64, '#0a0a0a'); hdRect(c, 181.5, 54, 194.5, 56, '#0a0a0a'); hdFill(c, [[181, 66], [195, 66], [197, 103], [179, 103]], '#0a0a0a'); c.globalAlpha = 1; } }
  // lit key on the machine
  if (S.litKey >= 0 && performance.now() < S.litUntil) { const k = KEYPOS[S.litKey]; hdEll(c, k.x - 3, k.y - 2.2, k.x + 3, k.y + 2.2, '#f0f0f0'); }
  // vignette, poison and film grain
  c.fillStyle = rg(c, 128, 96, 60, 170, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.65)']]); c.fillRect(0, 0, W, H);
  if (S.mode === 'play' || S.mode === 'lost') {
    const p = S.mode === 'lost' ? Math.min(1, poison + (S.elapsed - S.endAt) / 3) : poison;
    if (p > 0.35) { const k = (p - 0.35) / 0.65; c.fillStyle = rg(c, 128, 96, 120 - k * 90, 170, [[0, 'rgba(0,0,0,0)'], [1, `rgba(0,0,0,${0.5 + k * 0.45})`]]); c.fillRect(0, 0, W, H);
      if (p > 0.85 && Math.random() < 0.006) { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); } }
  }
  pixelate(c);
  // blow the small picture up with hard pixels, then draw the crisp things on top
  const m = cx, ms = canvas.width / W;
  m.setTransform(1, 0, 0, 1, 0, 0); m.imageSmoothingEnabled = false; m.drawImage(HD.lr, 0, 0, canvas.width, canvas.height);
  m.setTransform(ms, 0, 0, ms, 0, 0);
  drawOverlayHD(m, t, ms);
}
function drawOverlayHD(c, t, s) {
  // the paper in the typewriter: readable text, red replies
  const [px0, py0, px1, py1] = PAPER_BOX;
  c.save(); c.beginPath(); c.rect(px0, py0, px1 - px0, py1 - py0); c.clip();
  c.font = '4.4px "VT323", "Special Elite", monospace';
  const all = wrapLines(c, S.lines.slice(-30), px1 - px0 - 6);
  const showCur = S.mode === 'play' && (!S.locked || (NET.role === 'client' && NET.mode === 'coop'));
  if (showCur) all.push({ text: '> ' + S.input + (Math.floor(t / 500) % 2 ? '_' : ' '), who: 'mine' });
  const lh = 4.4, maxLines = Math.floor((py1 - py0 - 4) / lh), shown = all.slice(-maxLines);
  shown.forEach((l, i) => { c.fillStyle = l.who === 'theirs' ? '#a3070c' : '#151515'; c.fillText(l.text, px0 + 3, py1 - 3.5 - (shown.length - 1 - i) * lh); });
  c.restore();
  // hover: soft corners around the object
  const h = S.hover;
  if (h && S.mode === 'play' && !S.docOpen) {
    const [x0, y0, x1, y1] = h.r, L2 = 4;
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 0.6; c.shadowColor = '#fff'; c.shadowBlur = 4 * s; c.beginPath();
    [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]].forEach(([x, y, dx, dy]) => { c.moveTo(x + dx * L2, y); c.lineTo(x, y); c.lineTo(x, y + dy * L2); });
    c.stroke(); c.shadowBlur = 0;
  }
  if (S.gp.active) { c.strokeStyle = '#fff'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(S.gp.x - 4, S.gp.y); c.lineTo(S.gp.x + 4, S.gp.y); c.moveTo(S.gp.x, S.gp.y - 4); c.lineTo(S.gp.x, S.gp.y + 4); c.stroke(); }
}

function fitCanvas() {
  if (S.viewMode === 'spectrum') { if (canvas.width !== W) { canvas.width = W; canvas.height = H; } return; }
  const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(256, Math.round(r.width * dpr)), h = Math.round(w * 0.75);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; HD.dirty = true; }
}
window.addEventListener('resize', () => { HD.dirty = true; });
if (document.fonts && document.fonts.load) { document.fonts.load('20px "Special Elite"').then(() => { HD.dirty = true; }); document.fonts.load('20px "VT323"'); }

// ============================================================
// 11c. PICTURE ROOMS (illustrated offices, one is drawn at random each game)
// ============================================================
const IW = 1448, IH = 1086, IK = IW / W;
const LAMP_POLY = [[0, 500], [270, 500], [330, 880], [0, 880]];
// all coordinates are picture pixels (1448 x 1086)
const ROOMS = [
  { img: 'room1.png', paper: [561, 575, 854, 775], neon: { r: [86, 278, 120, 450], x: 103, y: 306, color: '#fbfbfb', keep: true },
    rain: [[28, 20, 215, 470], [282, 40, 118, 450]], clock: { x: 849, y: 207, r: 22, box: [832, 231, 866, 331], top: 233, len: 80 },
    cig: { tip: [327, 872], fil: [276, 900] }, door: [1105, 145, 1300, 505], note: [1150, 506, 1232, 528], phone: [1190, 600, 1410, 900],
    keys: { x0: 520, x1: 919, rows: [879, 913, 947] }, lights: ['window', 'lamp', 'phone'],
    spots: [['ashtray', 170, 850, 345, 955], ['photo', 1028, 195, 1085, 282], ['stack', 540, 232, 612, 285], ['clock', 810, 140, 890, 350], ['newspaper', 650, 170, 785, 360],
      ['chair', 610, 390, 745, 530], ['letter', 1050, 900, 1370, 1045], ['deskbooks', 0, 895, 165, 1060], ['phone', 1190, 600, 1410, 900], ['typewriter', 430, 776, 960, 1086],
      ['lamp', 0, 515, 275, 885], ['coat', 905, 180, 1030, 515], ['cabinet', 470, 285, 610, 535], ['rug', 1110, 590, 1195, 770], ['door', 1095, 135, 1310, 505],
      ['bookshelf', 1312, 60, 1448, 600], ['window', 20, 0, 410, 500]] },
  { img: 'room2.png', paper: [563, 626, 858, 760], neon: { r: [1294, 232, 1332, 410], x: 1313, y: 262, color: '#ff2a20', keep: true },
    rain: [[1262, 20, 170, 420]], clock: { x: 731, y: 154, r: 25, box: [714, 182, 748, 275], top: 181, len: 76 },
    cig: { tip: [329, 854], fil: [265, 888] }, door: [228, 114, 468, 514], note: [262, 512, 377, 530], phone: [1210, 588, 1415, 913],
    keys: { x0: 508, x1: 930, rows: [873, 907, 942] }, lights: ['window', 'lamp', 'phone', 'radio', 'radiator'],
    spots: [['ashtray', 177, 828, 348, 948], ['matchbox', 1353, 890, 1410, 936], ['radio', 942, 257, 1050, 314], ['globe', 959, 34, 1022, 108], ['painting', 480, 171, 548, 228],
      ['stack', 548, 274, 616, 331], ['calendar', 582, 120, 645, 257], ['clock', 708, 114, 765, 280], ['basket', 651, 468, 696, 537], ['cup', 1102, 742, 1199, 890],
      ['deskbooks', 0, 879, 126, 1016], ['notepad', 1056, 890, 1370, 1016], ['phone', 1210, 588, 1415, 913], ['typewriter', 434, 760, 970, 1033], ['lamp', 0, 500, 268, 870],
      ['sidetable', 1113, 491, 1267, 639], ['radiator', 1284, 474, 1404, 594], ['safe', 474, 308, 628, 537], ['chair', 731, 365, 839, 537], ['plant', 822, 137, 879, 394],
      ['armchair', 1027, 388, 1233, 639], ['photo', 11, 57, 91, 320], ['coat', 68, 114, 183, 576], ['door', 228, 114, 468, 514], ['rug', 377, 616, 548, 760],
      ['bookshelf', 879, 114, 1102, 537], ['window', 1240, 0, 1448, 460]] },
  { img: 'room3.png', paper: [564, 639, 862, 763], neon: null,
    rain: [[1200, 40, 235, 380]], clock: { x: 785, y: 174, r: 25, box: [768, 202, 802, 292], top: 201, len: 73 },
    cig: { tip: [331, 862], fil: [265, 890] }, door: [143, 108, 337, 514], note: [160, 510, 320, 528], phone: [1187, 622, 1341, 902],
    keys: { x0: 508, x1: 930, rows: [873, 907, 942] }, lights: ['lamp', 'phone', 'radio', 'radiator'],
    spots: [['ashtray', 177, 845, 342, 948], ['matchbox', 1062, 862, 1124, 925], ['camera', 913, 205, 970, 245], ['radio', 930, 342, 1033, 394], ['painting', 508, 154, 599, 234],
      ['photo', 500, 262, 600, 345], ['calendar', 622, 183, 713, 325], ['clock', 755, 108, 815, 320], ['basket', 645, 491, 685, 548], ['cup', 1376, 748, 1448, 930],
      ['deskbooks', 0, 896, 126, 1016], ['notepad', 1102, 913, 1376, 1016], ['phone', 1187, 622, 1341, 902], ['typewriter', 434, 768, 970, 1033], ['lamp', 0, 520, 268, 868],
      ['fan', 1147, 348, 1233, 479], ['plant', 902, 63, 1045, 154], ['radiator', 696, 405, 822, 548], ['chair', 474, 382, 634, 565], ['coat', 382, 166, 479, 542],
      ['mantel', 0, 290, 108, 525], ['door', 143, 108, 337, 514], ['cabinet', 1016, 434, 1404, 731], ['rug', 320, 650, 536, 799], ['bookshelf', 850, 160, 1050, 548],
      ['window', 1100, 0, 1448, 340]] },
  { img: 'room4.png', paper: [559, 634, 862, 776], neon: { r: [55, 272, 92, 452], x: 73, y: 302, color: '#ff2a20', keep: true },
    rain: [[30, 10, 200, 440], [230, 40, 140, 420]], clock: { x: 862, y: 188, r: 25, box: [845, 216, 879, 305], top: 215, len: 76 },
    cig: { tip: [328, 873], fil: [265, 908] }, door: [953, 120, 1153, 537], note: [990, 532, 1130, 548], phone: [1216, 640, 1387, 902],
    keys: { x0: 508, x1: 930, rows: [873, 907, 942] }, lights: ['window', 'lamp', 'phone', 'radio', 'radiator'],
    spots: [['ashtray', 171, 862, 342, 948], ['matchbox', 1056, 862, 1124, 925], ['cigarbox', 1358, 908, 1438, 959], ['deskphoto', 559, 348, 605, 405], ['stack', 788, 360, 868, 405],
      ['radio', 626, 342, 753, 405], ['photo', 634, 217, 673, 331], ['calendar', 702, 143, 788, 308], ['clock', 840, 130, 885, 345], ['globe', 1404, 337, 1448, 400],
      ['cup', 1164, 765, 1267, 868], ['notes', 120, 959, 348, 1039], ['deskbooks', 0, 902, 126, 1039], ['notepad', 1096, 919, 1364, 1039], ['phone', 1216, 640, 1387, 902],
      ['typewriter', 434, 776, 970, 1033], ['lamp', 0, 502, 268, 868], ['basket', 599, 502, 656, 571], ['sidetable', 337, 457, 428, 599], ['chest', 759, 405, 868, 548],
      ['painting', 443, 177, 605, 325], ['map', 1336, 34, 1444, 251], ['plant', 200, 365, 354, 559], ['armchair', 371, 377, 559, 594], ['radiator', 34, 508, 205, 548],
      ['coat', 1176, 188, 1267, 582], ['cabinet', 1267, 285, 1347, 616], ['door', 953, 120, 1153, 537], ['rug', 960, 620, 1180, 800], ['bookshelf', 1364, 400, 1448, 639],
      ['window', 23, 0, 377, 457]] },
  { img: 'room5.png', paper: [559, 639, 862, 776], neon: { r: [1404, 260, 1442, 448], x: 1423, y: 290, color: '#ff2a20', keep: true },
    rain: [[1272, 10, 170, 470]], clock: { x: 664, y: 196, r: 25, box: [647, 224, 681, 312], top: 223, len: 72 },
    cig: { tip: [328, 873], fil: [265, 908] }, door: [816, 125, 1027, 537], note: [850, 532, 990, 548], phone: [1204, 611, 1358, 902],
    keys: { x0: 508, x1: 930, rows: [873, 907, 942] }, lights: ['window', 'lamp', 'phone', 'radiator', 'floorlamp'],
    spots: [['ashtray', 171, 862, 342, 948], ['matchbox', 1062, 873, 1136, 930], ['deskphoto', 126, 331, 183, 394], ['photo', 537, 240, 611, 371], ['painting', 411, 200, 554, 314],
      ['calendar', 1084, 171, 1164, 302], ['clock', 640, 125, 690, 330], ['umbrella', 685, 457, 725, 571], ['cup', 1376, 788, 1448, 913], ['deskbooks', 0, 896, 126, 1016],
      ['notepad', 1102, 936, 1364, 1033], ['phone', 1204, 611, 1358, 902], ['typewriter', 434, 776, 970, 1033], ['lamp', 0, 502, 268, 868], ['sidetable', 405, 434, 468, 576],
      ['floorlamp', 360, 302, 457, 582], ['plant', 228, 91, 377, 205], ['armchair', 440, 400, 662, 576], ['coat', 719, 251, 805, 559], ['radiator', 1307, 508, 1433, 639],
      ['chair', 1147, 440, 1307, 696], ['cabinet', 1045, 325, 1250, 662], ['door', 816, 125, 1027, 537], ['rug', 308, 605, 548, 799], ['bookshelf', 46, 0, 342, 537],
      ['window', 1260, 0, 1448, 500]] }
];
const ROOM_FIXED = new Set(['typewriter', 'coat', 'bookshelf', 'ashtray', 'phone', 'lamp', 'clock', 'window', 'door', 'radiator', 'paper', 'note']);
Object.assign(FIXED_CONTAINER, { chair: true, rug: true, deskbooks: true, armchair: true, sidetable: true, cup: true, matchbox: true, mantel: true, camera: true, plant: true, fan: true, floorlamp: true });
const MORE_OBJ = {
  en: { chair: ['Chair', 'The client’s chair. Nobody has sat in it for days.', 'Look under the cushion'], rug: ['Rug', 'A worn rug.', 'Lift the corner'], deskbooks: ['Books', 'A stack of books on the desk.', 'Open the top one'], stack: ['Papers', 'A pile of papers and books.'],
    plant: ['Plant', 'A dusty pot plant.', 'Search the pot'], armchair: ['Armchair', 'A deep leather armchair.', 'Feel between the cushions'], sidetable: ['Side table', 'A small side table.', 'Open the drawer'], cup: ['Cup', 'A cup on the desk.', 'Look inside'],
    matchbox: ['Matchbox', 'A matchbox.', 'Slide it open'], fan: ['Fan', 'An electric fan, switched off.', 'Look behind it'], floorlamp: ['Floor lamp', 'A tall floor lamp.', 'Look under the shade'], mantel: ['Mantelpiece', 'An old mantelpiece.', 'Feel along the top'],
    camera: ['Camera', 'An old camera on the shelf.', 'Open the back'], notes: ['Loose pages', 'A few loose pages on the desk.'] },
  hu: { chair: ['Szék', 'Az ügyfelek széke. Napok óta senki nem ült benne.', 'Megnézem a párna alatt'], rug: ['Szőnyeg', 'Egy kopott szőnyeg.', 'Felhajtom a sarkát'], deskbooks: ['Könyvek', 'Egy halom könyv az asztalon.', 'Kinyitom a legfelsőt'], stack: ['Papírok', 'Egy köteg papír és könyv.'],
    plant: ['Növény', 'Egy poros cserepes növény.', 'Átkutatom a cserepet'], armchair: ['Fotel', 'Egy mély bőrfotel.', 'Benyúlok a párnák közé'], sidetable: ['Kisasztal', 'Egy kis kisasztal.', 'Kihúzom a fiókját'], cup: ['Bögre', 'Egy bögre az asztalon.', 'Belenézek'],
    matchbox: ['Gyufásdoboz', 'Egy gyufásdoboz.', 'Kinyitom'], fan: ['Ventilátor', 'Egy kikapcsolt villanyventilátor.', 'Mögé nézek'], floorlamp: ['Állólámpa', 'Egy magas állólámpa.', 'Benézek a burája alá'], mantel: ['Kandallópárkány', 'Egy régi kandallópárkány.', 'Végigtapogatom a tetejét'],
    camera: ['Fényképezőgép', 'Egy régi fényképezőgép a polcon.', 'Kinyitom a hátulját'], notes: ['Lapok', 'Néhány szétszórt lap az asztalon.'] },
  fr: { chair: ['Chaise', 'La chaise des clients. Personne ne s’y est assis depuis des jours.', 'Regarder sous le coussin'], rug: ['Tapis', 'Un tapis usé.', 'Soulever le coin'], deskbooks: ['Livres', 'Une pile de livres sur le bureau.', 'Ouvrir celui du dessus'], stack: ['Papiers', 'Une pile de papiers et de livres.'],
    plant: ['Plante', 'Une plante en pot poussiéreuse.', 'Fouiller le pot'], armchair: ['Fauteuil', 'Un profond fauteuil en cuir.', 'Glisser la main entre les coussins'], sidetable: ['Guéridon', 'Une petite table d’appoint.', 'Ouvrir le tiroir'], cup: ['Tasse', 'Une tasse sur le bureau.', 'Regarder dedans'],
    matchbox: ['Boîte d’allumettes', 'Une boîte d’allumettes.', 'L’ouvrir'], fan: ['Ventilateur', 'Un ventilateur électrique éteint.', 'Regarder derrière'], floorlamp: ['Lampadaire', 'Un grand lampadaire.', 'Regarder sous l’abat-jour'], mantel: ['Cheminée', 'Un vieux manteau de cheminée.', 'Tâter le dessus'],
    camera: ['Appareil photo', 'Un vieil appareil photo sur l’étagère.', 'Ouvrir le dos'], notes: ['Feuilles', 'Quelques feuilles volantes sur le bureau.'] }
};
for (const k in MORE_OBJ) Object.assign(T[k].obj, MORE_OBJ[k]);

const ROOMIMGS = {};
function roomImage(i) { const f = ROOMS[i].img; if (!ROOMIMGS[f]) { const im = new Image(); im.src = f; ROOMIMGS[f] = im; } return ROOMIMGS[f]; }
function makeImageLayout(roomIndex) {
  const nMod = MOD_OK ? MOD_TEMPLATES.length : 0;
  let ri;
  if (roomIndex !== undefined) ri = roomIndex;
  else if (ROOM_PREF === 'built' && nMod) ri = ROOMS.length + rint(nMod);
  else if (ROOM_PREF === 'painted') ri = rint(ROOMS.length);
  else ri = rint(ROOMS.length + nMod);
  const weather = pick(['rain', 'rain', 'snow', 'fog', 'clear']), word = pick(NEON_WORDS.filter((w) => w.length <= 5));
  if (ri >= ROOMS.length) {
    const plan = planModRoom(), ids = planIds(plan), slots = {};
    ids.filter((id) => !ROOM_FIXED.has(id)).forEach((id, i) => { slots['M' + i] = id; });
    const lights = ['window', 'lamp', 'phone', ...['radio', 'radiator', 'floorlamp'].filter((id) => ids.includes(id))];
    return { img: true, room: 0, modR: buildModRoom(plan), slots, lights, neonWin: 0, neonWord: word, weather, bookShelf: 0, bookX: 228 };
  }
  const R = ROOMS[ri];
  const slots = {}; R.spots.map((s) => s[0]).filter((id) => !ROOM_FIXED.has(id)).forEach((id, i) => { slots['I' + i] = id; });
  roomImage(ri);
  return { img: true, room: ri, slots, lights: R.lights, neonWin: 0, neonWord: R.neon && R.neon.keep ? 'HOTEL' : word, weather, bookShelf: 0, bookX: 228 };
}
function imgHotspots() {
  const R = S.layout.modR || ROOMS[S.layout.room || 0], list = [];
  if (S.layout.modR && !S.layout.modR.ready) return list;
  if (S.noteUnder) { const n = R.note; list.push({ id: 'note', r: [n[0] / IK, (n[1] - 10) / IK, n[2] / IK, (n[3] + 6) / IK] }); }
  const p = R.paper; list.push({ id: 'paper', r: [p[0] / IK, (p[1] - 70) / IK, p[2] / IK, p[3] / IK] });
  for (const [id, x0, y0, x1, y1] of R.spots) list.push({ id, r: [x0 / IK, y0 / IK, x1 / IK, y1 / IK] });
  return list;
}
let ditherPat = null;
function lightDither(c) {
  if (!ditherPat) { const p = document.createElement('canvas'); p.width = p.height = 2; const g = p.getContext('2d'); g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, 2, 2); g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, 1, 1); g.fillRect(1, 1, 1, 1); ditherPat = c.createPattern(p, 'repeat'); }
  return ditherPat;
}
const SPOT = (R, id) => { const s = R.spots.find((x) => x[0] === id); return s ? s.slice(1) : null; };

function animateIMG(t) {
  const c = cx;
  const rr = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(256, Math.round(rr.width * dpr)), h = Math.round(w * 0.75);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const lay = S.layout && S.layout.img ? S.layout : { room: 0, weather: 'rain', neonWord: 'HOTEL' };
  const R = lay.modR || ROOMS[lay.room || 0], img = lay.modR ? lay.modR.canvas : roomImage(lay.room || 0);
  const k = canvas.width / IW;
  c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false;
  c.fillStyle = '#000'; c.fillRect(0, 0, canvas.width, canvas.height);
  if (lay.modR ? !lay.modR.ready : (!img.complete || !img.naturalWidth)) return;
  c.drawImage(img, 0, 0, canvas.width, canvas.height);
  c.setTransform(k, 0, 0, k, 0, 0);
  const remaining = Math.max(0, S.total - S.elapsed), left = S.total ? remaining / S.total : 1, poison = 1 - left;
  const now = performance.now();

  // weather in the windows
  c.save(); c.beginPath(); R.rain.forEach(([x, y, ww, hh]) => c.rect(x, y, ww, hh)); c.clip();
  if (lay.weather === 'rain' || lay.weather === 'snow') {
    const [bx, by] = R.rain[0];
    if (rain.length < 90) for (let i = 0; i < 5; i++) rain.push({ x: Math.random() * 420, y: Math.random() * 500, v: 6 + Math.random() * 6 });
    for (const d of rain) { const snow = lay.weather === 'snow';
      d.y += snow ? d.v * 0.2 : d.v; d.x += snow ? Math.sin(t / 600 + d.v) * 0.8 : -1; if (d.y > 500) { d.y = 0; d.x = Math.random() * 420; } if (d.x < 0) d.x += 420;
      const px = Math.round((bx - 20 + d.x) / 3) * 3, py = Math.round((by + d.y) / 3) * 3;
      c.fillStyle = snow ? 'rgba(255,255,255,.9)' : 'rgba(230,230,230,.5)'; c.fillRect(px, py, 3, snow ? 3 : 12); }
  } else if (lay.weather === 'fog') { c.fillStyle = `rgba(200,200,200,${0.28 + 0.07 * Math.sin(t / 900)})`; c.fillRect(0, 0, IW, IH); }
  c.restore();
  // neon sign: our own word, blinking (Morse when it carries a piece)
  if (R.neon && R.neon.keep) {
    const n = R.neon, on = neonOnAt(t);
    if (!on) { c.fillStyle = 'rgba(8,8,8,.86)'; c.fillRect(n.r[0], n.r[1], n.r[2] - n.r[0], n.r[3] - n.r[1]); }
  } else if (R.neon) {
    const n = R.neon;
    if (n.sign) {
      const word = lay.neonWord.slice(0, 5), on = neonOnAt(t);
      c.strokeStyle = 'rgba(70,70,70,.8)'; c.lineWidth = 2; c.strokeRect(n.r[0] - 4, n.r[1] - 8, n.r[2] - n.r[0] + 8, word.length * 33 + 14);
      c.font = 'bold 32px "VT323", monospace'; c.textAlign = 'center';
      if (on) { c.shadowColor = '#ff2a20'; c.shadowBlur = 18; c.fillStyle = '#ff3a2a'; } else { c.shadowBlur = 0; c.fillStyle = '#3a0c0a'; }
      for (let i = 0; i < word.length; i++) c.fillText(word[i], n.x, n.y + i * 33);
      if (on) { c.shadowBlur = 6; c.fillStyle = '#ffd0c8'; for (let i = 0; i < word.length; i++) c.fillText(word[i], n.x, n.y + i * 33); }
      c.shadowBlur = 0; c.textAlign = 'left';
    } else { c.fillStyle = '#060606'; c.fillRect(n.r[0], n.r[1], n.r[2] - n.r[0], n.r[3] - n.r[1]); }
    if (!n.sign && neonOnAt(t)) {
      const word = lay.neonWord.slice(0, 5);
      c.font = '34px "VT323", monospace'; c.textAlign = 'center'; c.shadowColor = n.color; c.shadowBlur = 14; c.fillStyle = n.color;
      for (let i = 0; i < word.length; i++) c.fillText(word[i], n.x, n.y + i * 33);
      c.shadowBlur = 0; c.textAlign = 'left';
    }
  }
  // clock: hour + minute hands running backwards, swinging pendulum
  const ck = R.clock;
  if (!ck.handsOnly) { c.beginPath(); c.arc(ck.x, ck.y, ck.r, 0, Math.PI * 2); c.fillStyle = lightDither(c); c.fill(); c.lineWidth = 2; c.strokeStyle = '#111'; c.stroke(); }
  if (!ck.handsOnly) for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; c.fillStyle = '#111'; c.fillRect(Math.round(ck.x + (ck.r - 4) * Math.cos(a)) - 1, Math.round(ck.y + (ck.r - 4) * Math.sin(a)) - 1, 3, 3); }
  const mA = (remaining / 3600) * Math.PI * 2 - Math.PI / 2, hA = (remaining / 43200) * Math.PI * 2 - Math.PI / 2;
  c.lineCap = 'square'; c.strokeStyle = '#000';
  c.lineWidth = 4; c.beginPath(); c.moveTo(ck.x, ck.y); c.lineTo(ck.x + ck.r * 0.5 * Math.cos(hA), ck.y + ck.r * 0.5 * Math.sin(hA)); c.stroke();
  c.lineWidth = 2.5; c.beginPath(); c.moveTo(ck.x, ck.y); c.lineTo(ck.x + ck.r * 0.78 * Math.cos(mA), ck.y + ck.r * 0.78 * Math.sin(mA)); c.stroke();
  const b = ck.box; c.fillStyle = '#050505'; c.fillRect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
  const sw = Math.sin(t / 1000 * Math.PI) * 0.22, px = ck.x + Math.sin(sw) * ck.len, py = ck.top + Math.cos(sw) * ck.len;
  c.strokeStyle = '#cfcfcf'; c.lineWidth = 3; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(ck.x, ck.top); c.lineTo(px, py); c.stroke(); c.setLineDash([]);
  c.beginPath(); c.arc(px, py, ck.bob || 10, 0, Math.PI * 2); c.fillStyle = lightDither(c); c.fill();
  // built rooms: the lit HOTEL sign and the ashtray with its six burning phases
  if (R.hotel && neonOnAt(t) && sprOk('hotel/hotel_on.png')) { const hp = R.hotel; c.save(); c.beginPath(); c.rect(...hp.clip); c.clip(); c.globalAlpha = 0.85 + 0.15 * Math.sin(t / 90); c.drawImage(sprite('hotel/hotel_on.png'), hp.x, hp.y, hp.w, hp.h); c.globalAlpha = 1; c.restore(); }
  if (R.ash) {
    const a = R.ash, burnt = 1 - left, dead = S.mode === 'lost' && S.elapsed - S.endAt >= 1;
    const fi = dead ? 5 : burnt < 0.18 ? 0 : burnt < 0.38 ? 1 : burnt < 0.56 ? 2 : burnt < 0.74 ? 3 : burnt < 0.95 ? 4 : 5;
    const im = sprite(ASH_FRAMES[fi]);
    if (sprOk(ASH_FRAMES[fi])) { if (a.flip) { c.save(); c.translate(a.x + a.w, a.y); c.scale(-1, 1); c.drawImage(im, 0, 0, a.w, a.h); c.restore(); } else c.drawImage(im, a.x, a.y, a.w, a.h); }
    const em = ASH_EMBER[fi];
    if (em) {
      const k2 = a.w / 360, ex = a.flip ? a.x + a.w - em[0] * k2 : a.x + em[0] * k2, ey = a.y + em[1] * k2, glow = 0.7 + 0.3 * Math.sin(t / 170) + 0.1 * Math.sin(t / 47);
      const gg = c.createRadialGradient(ex, ey, 1, ex, ey, 22); gg.addColorStop(0, `rgba(255,90,40,${0.75 * glow})`); gg.addColorStop(1, 'rgba(255,60,30,0)'); c.fillStyle = gg; c.fillRect(ex - 22, ey - 22, 44, 44);
      // a thin wisp of smoke, drifting
      for (let i = 0; i < 46; i++) { const yy = ey - 6 - i * 5.2, xx = ex + Math.sin(t / 900 + i * 0.22) * (2 + i * 0.55) + Math.sin(t / 2300 + i * 0.07) * i * 0.25, al = 0.32 * (1 - i / 46); c.fillStyle = `rgba(225,225,225,${al})`; c.beginPath(); c.arc(xx, yy, 1.4 + i * 0.09, 0, Math.PI * 2); c.fill(); }
    }
  }
  // cigarette burns from the tip towards the filter (painted rooms)
  if (R.cig) {
  const tip = R.cig.tip, fil = R.cig.fil, f = Math.min(0.92, 1 - left);
  const ex = tip[0] + (fil[0] - tip[0]) * f, ey = tip[1] + (fil[1] - tip[1]) * f;
  c.lineCap = 'round'; c.strokeStyle = '#8a8a8a'; c.lineWidth = 11; c.beginPath(); c.moveTo(tip[0] + 4, tip[1] - 2); c.lineTo(ex, ey); c.stroke();
  c.strokeStyle = '#3a3a3a'; c.setLineDash([2, 4]); c.lineWidth = 9; c.stroke(); c.setLineDash([]); c.lineCap = 'butt';
  if (S.mode !== 'lost' || S.elapsed - S.endAt < 1) { const glow = 0.75 + 0.25 * Math.sin(t / 180); c.shadowColor = '#ff2a1a'; c.shadowBlur = 16 * glow; c.fillStyle = '#f0221a'; c.fillRect(Math.round(ex) - 5, Math.round(ey) - 5, 10, 10); c.shadowBlur = 0; }
  }
  // other things that may be signalling Morse
  if (S.pz && S.mode !== 'title') {
    const mOn = morseVisible() ? morseOnAt(t) : true;
    if (S.pz.morseAt === 'lamp' && !mOn) { const lg0 = R.lampGlow || { x: 170, y: 700, r: 320 }; const gd = c.createRadialGradient(lg0.x, lg0.y, 10, lg0.x, lg0.y, lg0.r); gd.addColorStop(0, 'rgba(0,0,0,.62)'); gd.addColorStop(0.7, 'rgba(0,0,0,.35)'); gd.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gd; c.fillRect(lg0.x - lg0.r, lg0.y - lg0.r, lg0.r * 2, lg0.r * 2); }
    const glowAt = (id) => { const s = SPOT(R, id); if (!s) return; const g = c.createRadialGradient((s[0] + s[2]) / 2, (s[1] + s[3]) / 2, 2, (s[0] + s[2]) / 2, (s[1] + s[3]) / 2, Math.max(s[2] - s[0], s[3] - s[1]) * 0.7); g.addColorStop(0, 'rgba(255,250,220,.75)'); g.addColorStop(1, 'rgba(255,250,220,0)'); c.fillStyle = g; c.fillRect(s[0] - 40, s[1] - 40, s[2] - s[0] + 80, s[3] - s[1] + 80); };
    if (mOn && (S.pz.morseAt === 'radio' || S.pz.morseAt === 'radiator') && morseVisible()) glowAt(S.pz.morseAt);
    if (S.pz.morseAt === 'floorlamp' && !mOn) { const s = SPOT(R, 'floorlamp'); c.fillStyle = 'rgba(0,0,0,.75)'; c.fillRect(s[0], s[1], s[2] - s[0], (s[3] - s[1]) * 0.35); }
  }
  if (S.ringing && Math.floor(t / 250) % 2 === 0) { const p = R.phone; c.strokeStyle = '#fff'; c.lineWidth = 4; for (const [x0, y0, x1, y1] of [[p[0] + 15, p[1] + 40, p[0] - 10, p[1] + 20], [p[0] + 10, p[1] + 70, p[0] - 18, p[1] + 64], [p[2] - 15, p[1] + 40, p[2] + 10, p[1] + 20], [p[2] - 10, p[1] + 70, p[2] + 18, p[1] + 64]]) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); } }
  if (S.noteUnder) { const n = R.note; c.fillStyle = '#efefef'; c.beginPath(); c.moveTo(n[0], n[1] + 6); c.lineTo(n[2] - 6, n[1]); c.lineTo(n[2], n[3] - 6); c.lineTo(n[0] + 6, n[3]); c.fill(); }
  if (S.mode === 'won' && S.doorOpen < 1) S.doorOpen = Math.min(1, S.doorOpen + 0.01);
  if (S.doorOpen > 0) {
    const d = R.door, dw = d[2] - d[0], dh = d[3] - d[1], mx = (d[0] + d[2]) / 2;
    c.fillStyle = `rgba(245,245,240,${0.9 * S.doorOpen})`; c.fillRect(d[0] + 4, d[1] + 4, (dw - 8) * S.doorOpen, dh - 8);
    if (S.doorOpen > 0.6) { c.globalAlpha = (S.doorOpen - 0.6) / 0.4; c.fillStyle = '#060606'; c.beginPath(); c.arc(mx, d[1] + dh * 0.27, dw * 0.11, 0, Math.PI * 2); c.fill(); c.fillRect(mx - dw * 0.17, d[1] + dh * 0.21, dw * 0.34, 9); c.beginPath(); c.moveTo(mx - dw * 0.18, d[1] + dh * 0.38); c.lineTo(mx + dw * 0.18, d[1] + dh * 0.38); c.lineTo(mx + dw * 0.26, d[3] - 4); c.lineTo(mx - dw * 0.26, d[3] - 4); c.fill(); c.globalAlpha = 1; }
  }
  // the typewriter comes alive: pressed key, typebar strike
  const lit = now < S.litUntil && S.litChar;
  if (lit) {
    const ks = R.keys, rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
    const ri = rows.findIndex((r) => r.includes(S.litChar));
    if (ri >= 0) { const ci = rows[ri].indexOf(S.litChar), span = ks.x1 - ks.x0, kx = ks.x0 + 18 + ri * 20 + ci * (span - 40) / 10, ky = ks.rows[ri];
      c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.ellipse(kx, ky, 15, 10, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.ellipse(kx, ky + 2, 9, 5, 0, 0, Math.PI * 2); c.fill();
      const pp = R.paper, sx = (pp[0] + pp[2]) / 2; c.strokeStyle = '#d8d8d8'; c.lineWidth = 4; c.beginPath(); c.moveTo(sx + (ci - 4.5) * 9, pp[3] + 60); c.lineTo(sx, pp[3] - 6); c.stroke(); }
  }
  // the paper sticks out of the machine; it nudges left while typing and slides up on every new line
  const pp = R.paper, top = pp[1] - 70;
  const shift = -Math.min(14, S.input.length) * 3 + (lit ? -2 : 0);
  const feed = Math.max(0, 1 - (now - (S.feedAt || 0)) / 180);
  c.fillStyle = '#f2f0ea'; c.fillRect(pp[0] + shift, top, pp[2] - pp[0] - shift, pp[3] - top); c.fillStyle = '#d0cec6'; c.fillRect(pp[0] + shift, top, pp[2] - pp[0] - shift, 4);
  c.save(); c.beginPath(); c.rect(pp[0] + shift, top + 4, pp[2] - pp[0], pp[3] - top - 4); c.clip();
  c.font = '27px "VT323", "Courier New", monospace';
  const lines = wrapLines(c, S.lines.slice(-20), pp[2] - pp[0] - 26);
  const showCur = S.mode === 'play' && (!S.locked || (NET.role === 'client' && NET.mode === 'coop'));
  if (showCur) lines.push({ text: '> ' + S.input + (Math.floor(t / 500) % 2 ? '_' : ' '), who: 'mine' });
  const shown = lines.slice(-7);
  shown.forEach((l, i) => { c.fillStyle = l.who === 'theirs' ? '#b10a10' : '#111'; c.fillText(l.text, pp[0] + 13 + shift, pp[3] - 9 + feed * 26 - (shown.length - 1 - i) * 26); });
  c.restore();
  // hover corners and gamepad cursor
  const hv = S.hover;
  if (hv && S.mode === 'play' && !S.docOpen) {
    const [x0, y0, x1, y1] = hv.r.map((v) => v * IK), L2 = 22;
    c.strokeStyle = '#fff'; c.lineWidth = 4; c.shadowColor = '#fff'; c.shadowBlur = 10; c.beginPath();
    [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]].forEach(([x, y, dx, dy]) => { c.moveTo(x + dx * L2, y); c.lineTo(x, y); c.lineTo(x, y + dy * L2); });
    c.stroke(); c.shadowBlur = 0;
  }
  if (S.gp.active) { const gx = S.gp.x * IK, gy = S.gp.y * IK; c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.moveTo(gx - 20, gy); c.lineTo(gx + 20, gy); c.moveTo(gx, gy - 20); c.lineTo(gx, gy + 20); c.stroke(); }
  // poison
  if (S.mode === 'play' || S.mode === 'lost') {
    const p = S.mode === 'lost' ? Math.min(1, poison + (S.elapsed - S.endAt) / 3) : poison;
    if (p > 0.35) { const q = (p - 0.35) / 0.65; const g = c.createRadialGradient(724, 543, 650 - q * 480, 724, 543, 920); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.55 + q * 0.42})`); c.fillStyle = g; c.fillRect(0, 0, IW, IH);
      if (p > 0.85 && Math.random() < 0.006) { c.fillStyle = '#000'; c.fillRect(0, 0, IW, IH); } }
  }
}

// ============================================================
// 11d. MODULAR ROOMS: empty office + sprites placed at random, then dithered into one picture
// ============================================================
const MOD_TEMPLATES = [
  { bg: 'assets/rooms/room_a.png', door: [902, 228, 1124, 662], note: [930, 660, 1090, 676], doorFoot: [1013, 664], doorLine: [[910, 662], [1116, 662]],
    rain: [[17, 200, 166, 394], [263, 320, 85, 274]], neon: [128, 330, 166, 506], wall: [[470, 150, 890, 560]], base: 655, floorX: [[470, 895]], windows: [],
    tallSides: true, sides: [{ x0: 1190, x1: 1440, base: 790, s: 1.25, allowTall: true, sTall: 1.0 }, { x0: 300, x1: 440, base: 712, s: 1.2, short: true }] },
  { bg: 'assets/rooms/room_b.png', door: [97, 137, 245, 731], note: [112, 734, 238, 752], doorFoot: [175, 712], doorLine: [[100, 735], [244, 689]],
    rain: [[599, 337, 251, 194], [965, 337, 228, 194]], neon: [1150, 345, 1186, 521], wall: [[405, 160, 568, 560], [858, 160, 945, 560]], base: 648, floorX: [[400, 1250]],
    windows: [[576, 205, 856, 537], [947, 205, 1210, 537]], tallSides: true, sides: [{ x0: 1256, x1: 1440, base: 790, s: 1.25, allowTall: true, sTall: 1.0 }, { x0: 250, x1: 400, base: 720, s: 1.2, allowTall: true, sTall: 0.95 }] },
  { bg: 'assets/rooms/room_c.png', door: [434, 234, 662, 668], note: [462, 664, 636, 680], doorFoot: [548, 670], doorLine: [[438, 668], [658, 668]],
    rain: [[17, 171, 97, 423], [143, 217, 102, 377]], neon: [204, 330, 240, 506], wall: [[680, 150, 1120, 570]], base: 664, floorX: [[680, 1125]], windows: [],
    tallSides: true, sides: [{ x0: 1170, x1: 1440, base: 790, s: 1.25, allowTall: true, sTall: 1.0 }] }
];
// sprite catalogue: id = object id in the game, h = height in the picture at the back wall
const MOD_WALL = [
  { f: 'wall/calendar.png', id: 'calendar', h: 181 }, { f: 'wall/painting1.png', id: 'painting', h: 145 }, { f: 'wall/painting2.png', id: 'painting', h: 145 },
  { f: 'wall/photo1.png', id: 'photo', h: 104 }, { f: 'wall/photo2.png', id: 'photo', h: 104 }, { f: 'wall/map.png', id: 'map', h: 145 },
  { f: 'wall/poster.png', id: 'newspaper', h: 203 }, { f: 'wall/mirror.png', id: 'mirror', h: 174 }
];
// where the HOTEL sign hangs in each empty room (sprite 400x600, clipped to one window pane)
const HOTEL_AT = [
  { x: 40, y: 322, w: 187, h: 280, clip: [20, 328, 150, 262] },
  { x: 1090, y: 331, w: 140, h: 210, clip: [965, 342, 225, 196] },
  { x: -4, y: 293, w: 173, h: 260, clip: [18, 300, 90, 290] }
];
const ASH_FRAMES = [1, 2, 3, 4, 5, 6].map((i) => `cigarette/ashtray_${i}.png`);
const ASH_EMBER = [[214, 116], [147, 99], [147, 98], [146, 97], [139, 93], null];
const MOD_CLOCK = { f: 'wall/clock.png', id: 'clock', h: 300 };
const MOD_FLOOR = [
  { f: 'furniture/cabinet.png', id: 'cabinet', h: 341, tall: true, top: true }, { f: 'furniture/floorlamp.png', id: 'floorlamp', h: 384, tall: true },
  { f: 'furniture/safe.png', id: 'safe', h: 225, top: true }, { f: 'furniture/chest.png', id: 'chest', h: 218, top: true }, { f: 'furniture/armchair.png', id: 'armchair', h: 210 },
  { f: 'furniture/chair.png', id: 'chair', h: 225, short: true }, { f: 'furniture/sidetable.png', id: 'sidetable', h: 167, short: true, top: true },
  { f: 'furniture/plant.png', id: 'plant', h: 196, short: true }, { f: 'furniture/globe.png', id: 'globe', h: 188, short: true },
  { f: 'furniture/umbrella.png', id: 'umbrella', h: 167, short: true }, { f: 'furniture/basket.png', id: 'basket', h: 104, short: true },
  { f: 'furniture/crate.png', id: 'crate', h: 145, short: true }, { f: 'furniture/radiator.png', id: 'radiator', h: 160 }
];
const MOD_MUST = [{ f: 'furniture/bookshelf.png', id: 'bookshelf', h: 442, tall: true }, { f: 'furniture/coatrack.png', id: 'coat', h: 420, tall: true }];
const MOD_ON_TOP = [{ f: 'furniture/radio.png', id: 'radio', h: 102 }, { f: 'furniture/fan.png', id: 'fan', h: 116 }];
const MOD_DESK = [
  { f: 'desk/books.png', id: 'deskbooks', h: 110 }, { f: 'desk/cigarbox.png', id: 'cigarbox', h: 85 }, { f: 'desk/cup.png', id: 'cup', h: 80 },
  { f: 'desk/envelope.png', id: 'letter', h: 95 }, { f: 'desk/matchbox.png', id: 'matchbox', h: 70 }, { f: 'desk/notepad.png', id: 'notepad', h: 105 },
  { f: 'desk/pencilcup.png', id: 'pencilcup', h: 110 }
];
const MOD_AR = {"desk/books.png": 1.3, "desk/cigarbox.png": 1.108, "desk/cup.png": 1.099, "desk/envelope.png": 1.317, "desk/matchbox.png": 1.28, "desk/notepad.png": 1.243, "desk/pencilcup.png": 0.833, "furniture/armchair.png": 0.993, "furniture/basket.png": 0.812, "furniture/bookshelf.png": 0.536, "furniture/cabinet.png": 0.452, "furniture/chair.png": 0.688, "furniture/chest.png": 0.798, "furniture/coatrack.png": 0.402, "furniture/crate.png": 0.995, "furniture/fan.png": 0.721, "furniture/floorlamp.png": 0.4, "furniture/globe.png": 0.61, "furniture/plant.png": 0.836, "furniture/radiator.png": 0.824, "furniture/radio.png": 0.952, "furniture/safe.png": 0.805, "furniture/sidetable.png": 0.626, "furniture/umbrella.png": 0.395, "wall/calendar.png": 0.845, "wall/clock.png": 0.419, "wall/map.png": 1.304, "wall/mirror.png": 0.695, "wall/painting1.png": 1.419, "wall/painting2.png": 1.419, "wall/photo1.png": 1.803, "wall/photo2.png": 2.09, "wall/poster.png": 0.836};
[MOD_CLOCK, ...MOD_WALL, ...MOD_FLOOR, ...MOD_MUST, ...MOD_ON_TOP, ...MOD_DESK].forEach((sp) => { sp.ar = MOD_AR[sp.f] || 1; });
Object.assign(FIXED_CONTAINER, { pencilcup: true, crate: true, globe: true, safe: true, mirror: true, cigarbox: true, umbrella: true, basket: true });
Object.assign(T.en.obj, { pencilcup: ['Pencil cup', 'A cup full of pencils.', 'Tip it out'] });
Object.assign(T.hu.obj, { pencilcup: ['Ceruzatartó', 'Egy pohár tele ceruzával.', 'Kiborítom'] });
Object.assign(T.fr.obj, { pencilcup: ['Pot à crayons', 'Un pot plein de crayons.', 'Le renverser'] });

const SPR = {};
function sprite(f) { if (!SPR[f]) { const im = new Image(); im.onerror = () => { im.failed = true; }; im.src = 'assets/' + f; SPR[f] = im; } return SPR[f]; }
const sprReady = (f) => { const im = sprite(f); return im.failed || (im.complete && im.naturalWidth > 0); };
const sprOk = (f) => { const im = sprite(f); return !im.failed && im.naturalWidth > 0; };
// the modular rooms are only used when the assets folder is really there
let MOD_OK = false, MOD_STATE = 'checking';
(function () { const probe = new Image(); probe.onload = () => { MOD_OK = true; MOD_STATE = 'ok'; }; probe.onerror = () => { MOD_STATE = 'missing'; }; probe.src = 'assets/rooms/room_a.png'; })();
const VERSION = '2.3';
let ROOM_PREF = 'built'; try { ROOM_PREF = localStorage.getItem('deadkey-rooms') || 'built'; } catch (e) {}

// decide everything with the seeded random generator, so online players get the same room
function planModRoom() {
  const ti = rint(MOD_TEMPLATES.length), tp = MOD_TEMPLATES[ti];
  const items = []; // {spec, x, y, w, h, z, flip}
  const boxOk = (b, list, pad = 14) => list.every((o) => b[2] + pad < o.x || b[0] - pad > o.x + o.w || b[3] + pad < o.y || b[1] - pad > o.y + o.h);
  const hitsRect = (b, r) => !(b[2] < r[0] || b[0] > r[2] || b[3] < r[1] || b[1] > r[3]);
  const aspect = (spec) => { const im = sprite(spec.f); return im.naturalWidth ? im.naturalWidth / im.naturalHeight : (spec.w || 1); };
  // the clock first: it must stay visible
  const wallPlaced = [];
  for (let tries = 0; tries < 80; tries++) {
    const z = pick(tp.wall), h = MOD_CLOCK.h, w = h * MOD_CLOCK.ar;
    if (z[2] - z[0] < w) continue;
    const x = z[0] + rng() * (z[2] - z[0] - w), y = z[1] + rng() * Math.max(1, Math.min(60, z[3] - z[1] - h));
    const b = [x, y, x + w, y + h];
    if (hitsRect(b, tp.door) || tp.windows.some((r) => hitsRect(b, r))) continue;
    const it = { spec: MOD_CLOCK, x, y, w, h, z: 0, wall: true }; wallPlaced.push(it); items.push(it); break;
  }
  // floor: bookshelf + coat rack always, then a few more
  const floorList = [...MOD_MUST, ...shuffle(MOD_FLOOR).slice(0, 3 + rint(3))];
  const floorPlaced = [];
  const doorBox = [tp.door[0] - 30, tp.door[1], tp.door[2] + 30, tp.door[3]];
  for (const spec of floorList) {
    let done = false;
    for (let tries = 0; tries < 60 && !done; tries++) {
      const sdOpts = tp.sides.filter((sd) => !(sd.short && !spec.short && !(spec.tall && sd.allowTall)) && (!spec.tall || sd.allowTall));
      const useSide = sdOpts.length && (spec.tall ? (tp.tallSides && rng() < 0.6) : rng() < 0.35);
      const sd = useSide ? pick(sdOpts) : null;
      const fwd = sd ? 0 : 22 + rng() * 34, base = sd ? sd.base : tp.base + fwd;
      const s = (sd ? (spec.tall ? (sd.sTall || 1) : sd.s) : 1) * (1 + fwd / 520), h = spec.h * s, w = h * (spec.ar || 1);
      const rx = sd ? [sd.x0, sd.x1] : pick(tp.floorX);
      if (rx[1] - rx[0] < w) continue;
      const x = rx[0] + rng() * (rx[1] - rx[0] - w), y = base - h;
      const b = [x, y, x + w, base];
      if (!sd && hitsRect(b, doorBox)) continue;
      if (!spec.tall && x < 1015 && x + w > 435 && y > 540) continue;   // would hide behind the typewriter and its paper
      if (!sd && tp.windows.some((r) => hitsRect(b, r))) continue;
      if (!boxOk(b, floorPlaced, 16) || (!sd && !boxOk(b, wallPlaced.filter((o) => o.spec.id === 'clock'), 8))) continue;
      const it = { spec, x, y, w, h, z: base, flip: rng() < 0.3 && !spec.tall }; floorPlaced.push(it); items.push(it); done = true;
    }
    if (!done && MOD_MUST.includes(spec)) {   // must exist: put it at the front, beside the desk
      const sd = tp.sides[MOD_MUST.indexOf(spec) % tp.sides.length], h = spec.h * (sd.sTall || 1), w = h * spec.ar;
      const x = MOD_MUST.indexOf(spec) ? sd.x1 - w : sd.x0;
      const it = { spec, x, y: sd.base - h, w, h, z: sd.base + 0.1 }; floorPlaced.push(it); items.push(it);
    }
  }
  // wall: the clock + a few pictures
  const wallList = [...shuffle(MOD_WALL).filter((s, i, a) => a.findIndex((x) => x.id === s.id) === i).slice(0, 2 + rint(3))];
  for (const spec of wallList) {
    for (let tries = 0; tries < 40; tries++) {
      const z = pick(tp.wall), h = spec.h, w = h * (spec.ar || 1);
      if (z[2] - z[0] < w) continue;
      const x = z[0] + rng() * (z[2] - z[0] - w), y = z[1] + rng() * Math.max(1, z[3] - z[1] - h);
      const b = [x, y, x + w, y + h];
      if (hitsRect(b, tp.door) || tp.windows.some((r) => hitsRect(b, r)) || !boxOk(b, wallPlaced) || !boxOk(b, floorPlaced.filter((o) => o.y + o.h <= tp.base + 70), 10)) continue;
      const it = { spec, x, y, w, h, z: 0, wall: true }; wallPlaced.push(it); items.push(it); break;
    }
  }
  if (!items.some((i) => i.spec.id === 'clock')) { const z = tp.wall[0], h = MOD_CLOCK.h * 0.8; items.push({ spec: MOD_CLOCK, x: z[0] + 6, y: z[1], w: h * MOD_CLOCK.ar, h, z: 0, wall: true }); }
  // a radio or a fan on top of something
  const tops = floorPlaced.filter((o) => o.spec.top);
  shuffle(MOD_ON_TOP).slice(0, tops.length ? 1 + rint(2) : 0).forEach((spec, i) => {
    const host = tops[i % tops.length]; if (!host || host.hasTop) return; host.hasTop = true;
    const s = host.h / host.spec.h, h = spec.h * s, w = h * (spec.ar || 1);
    const it = { spec, x: host.x + (host.w - w) / 2, y: host.y - h + 6 * s, w, h, z: host.z + 0.5 };
    if (!boxOk([it.x, it.y, it.x + w, it.y + h], wallPlaced.filter((o) => o.spec.id === 'clock'), 6)) { host.hasTop = false; return; }
    items.push(it);
  });
  // the desk: lamp and phone swap sides, a few things on top
  const lampLeft = rng() < 0.6;
  const desk = { lampLeft, items: [] };
  const deskSlots = shuffle(lampLeft ? [[20, 1082], [1060, 1082], [1255, 1082]] : [[30, 1082], [245, 1082], [1262, 1082]]);
  shuffle(MOD_DESK).slice(0, 3).forEach((spec, i) => { const [x, yb] = deskSlots[i]; const h = spec.h * 1.15, w = h * (spec.ar || 1.3); desk.items.push({ spec, x: Math.min(IW - w - 4, x), y: yb - h, w, h, z: 2000 + yb }); });
  return { ti, items, desk, wiggle: [rng(), rng(), rng()] };
}


// a rubber cable: soft shadow, dark underside, red body, shiny ridge
function drawCable(c, pts, widthAt, alphaAt) {
  const seg = (fn) => { for (let i = 1; i < pts.length; i++) fn(pts[i - 1], pts[i], i / (pts.length - 1)); };
  const off = (p, q, d) => { const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1; return [-dy / L * d, dx / L * d]; };
  c.lineCap = 'round'; c.lineJoin = 'round';
  const pass = (col, wk, nudge) => seg((p, q, t) => { const w = widthAt(q, t); const [ox, oy] = off(p, q, nudge * w); c.globalAlpha = alphaAt ? alphaAt(q, t) : 1; c.strokeStyle = col; c.lineWidth = Math.max(1, w * wk); c.beginPath(); c.moveTo(p[0] + ox, p[1] + oy); c.lineTo(q[0] + ox, q[1] + oy); c.stroke(); });
  seg((p, q, t) => { const w = widthAt(q, t); c.globalAlpha = 0.35 * (alphaAt ? alphaAt(q, t) : 1); c.strokeStyle = '#000'; c.lineWidth = w * 1.7; c.beginPath(); c.moveTo(p[0] + w * 0.35, p[1] + w * 0.6); c.lineTo(q[0] + w * 0.35, q[1] + w * 0.6); c.stroke(); });
  pass('#4a0306', 1, 0); pass('#a50f16', 0.72, -0.08); pass('#e01a22', 0.42, -0.16); pass('rgba(255,160,150,.8)', 0.14, -0.28);
  c.globalAlpha = 1;
}
function modSpecAR(it) { const im = sprite(it.spec.f); if (im.naturalWidth) { const ar = im.naturalWidth / im.naturalHeight; it.w = it.h * ar; } }

// build the picture (after the sprites are loaded) and all the coordinates the game needs
function buildModRoom(plan) {
  const tp = MOD_TEMPLATES[plan.ti];
  const R = { mod: true, canvas: document.createElement('canvas'), ready: false, plan };
  const all = [tp.bg.replace('assets/', ''), ...plan.items.map((i) => i.spec.f), ...plan.desk.items.map((i) => i.spec.f), 'props/typewriter.png', 'props/lamp.png', 'props/phone.png', 'hotel/hotel_off.png', 'hotel/hotel_on.png', ...ASH_FRAMES];
  all.forEach(sprite);
  const t0 = performance.now();
  const tryBuild = () => {
    if (!all.every(sprReady) && performance.now() - t0 < 8000) { setTimeout(tryBuild, 80); return; }
    const C = document.createElement('canvas'); C.width = IW; C.height = IH; const c = C.getContext('2d');
    c.fillStyle = '#0a0a0a'; c.fillRect(0, 0, IW, IH);
    if (sprOk(tp.bg.replace('assets/', ''))) c.drawImage(sprite(tp.bg.replace('assets/', '')), 0, 0, IW, IH);
    const spots = [];
    const draw = (it) => {
      modSpecAR(it);
      const im = sprite(it.spec.f);
      if (!it.wall && !it.onDesk) { c.fillStyle = 'rgba(0,0,0,.55)'; c.beginPath(); c.ellipse(it.x + it.w / 2, it.y + it.h - 2, it.w * 0.48, Math.max(5, it.h * 0.05), 0, 0, Math.PI * 2); c.fill(); }
      if (sprOk(it.spec.f)) { if (it.flip) { c.save(); c.translate(it.x + it.w, it.y); c.scale(-1, 1); c.drawImage(im, 0, 0, it.w, it.h); c.restore(); } else c.drawImage(im, it.x, it.y, it.w, it.h); }
      spots.push({ id: it.spec.id, r: [it.x, it.y, it.x + it.w, it.y + it.h], z: it.z });
    };
    // aspect ratios are known now: redo the x position so nothing sticks out of its zone
    plan.items.forEach(modSpecAR);
    plan.items.filter((i) => i.wall).forEach(draw);
    plan.items.filter((i) => !i.wall).sort((a, b) => a.z - b.z).forEach(draw);
    // clock anchors (the clock sprite has no hands; we add them)
    const ck = plan.items.find((i) => i.spec.id === 'clock');
    if (ck) { const s = ck.h / 420; R.clock = { x: ck.x + 88 * s, y: ck.y + 141 * s, r: 40 * s, handsOnly: true, box: [ck.x + 54 * s, ck.y + 192 * s, ck.x + 122 * s, ck.y + 328 * s], top: ck.y + 192 * s, len: 100 * s, bob: 20 * s }; }
    // red cable on the floor, from behind the desk to the door
    const [dx, dy] = tp.doorFoot, sx = 1040, sy = 800, w3 = plan.wiggle;
    const pts = []; const bez = (p0, p1, p2, p3) => { for (let i = 0; i <= 60; i++) { const t = i / 60, u = 1 - t; pts.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); } };
    const mx = (sx + dx) / 2 + (w3[0] - 0.5) * 260, my = tp.base + 55 + w3[1] * 40;
    bez([sx, sy], [sx + 60, sy - 60], [mx + 160, my + 10], [mx, my]);
    bez([mx, my], [mx - 160, my - 10], [dx + (w3[2] - 0.5) * 200, Math.max(dy, tp.base) + 40], [dx, dy]);
    drawCable(c, pts, (q) => 5 + Math.max(0, (q[1] - tp.base) / (sy - tp.base)) * 10, (q, t) => (t > 0.94 ? Math.max(0, (1 - t) / 0.06) : 1));
    { const [[ax, ay], [bx2, by2]] = tp.doorLine, mx2 = (ax + bx2) / 2, my2 = (ay + by2) / 2, ang = Math.atan2(by2 - ay, bx2 - ax), len = Math.hypot(bx2 - ax, by2 - ay);
      c.save(); c.translate(mx2, my2 + 6); c.rotate(ang); c.scale(1, 0.22);
      const gl = c.createRadialGradient(0, 0, 4, 0, 0, len * 0.62); gl.addColorStop(0, 'rgba(255,45,30,.42)'); gl.addColorStop(0.5, 'rgba(255,35,25,.16)'); gl.addColorStop(1, 'rgba(255,30,20,0)');
      c.fillStyle = gl; c.beginPath(); c.arc(0, 0, len * 0.62, 0, Math.PI * 2); c.fill(); c.restore();
      const gap = c.createLinearGradient(ax, ay, bx2, by2); gap.addColorStop(0, 'rgba(255,60,40,0)'); gap.addColorStop(0.15, 'rgba(255,70,50,.85)'); gap.addColorStop(0.85, 'rgba(255,70,50,.85)'); gap.addColorStop(1, 'rgba(255,60,40,0)');
      c.strokeStyle = gap; c.lineWidth = 2.5; c.lineCap = 'butt'; c.beginPath(); c.moveTo(ax, ay - 1); c.lineTo(bx2, by2 - 1); c.stroke(); }
    // the HOTEL sign outside, behind the glass
    { const hp = HOTEL_AT[plan.ti]; if (sprOk('hotel/hotel_off.png')) { c.save(); c.beginPath(); c.rect(...hp.clip); c.clip(); c.drawImage(sprite('hotel/hotel_off.png'), hp.x, hp.y, hp.w, hp.h); c.fillStyle = 'rgba(10,14,20,.25)'; c.fillRect(...hp.clip); c.restore(); } }
    // the desk
    const DY = 790;
    const g = c.createLinearGradient(0, DY, 0, IH); g.addColorStop(0, '#3a332c'); g.addColorStop(1, '#14100c'); c.fillStyle = g; c.fillRect(0, DY, IW, IH - DY);
    for (let y = DY + 6; y < IH; y += 7) { c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= IW; x += 60) c.lineTo(x, y + Math.sin(x * 0.01 + y) * 2); c.stroke(); }
    c.fillStyle = '#6a5c50'; c.fillRect(0, DY, IW, 5);
    const L = plan.desk.lampLeft;
    const lampX = L ? 10 : IW - 10 - 300, lampW = 300, lampH = lampW * 344 / 288, lampY = 905 - lampH;
    const pool = { x: L ? 260 : IW - 260, y: 880, r: 330 };
    const lg2 = c.createRadialGradient(pool.x, pool.y, 10, pool.x, pool.y, pool.r); lg2.addColorStop(0, 'rgba(255,250,230,.55)'); lg2.addColorStop(1, 'rgba(255,250,230,0)'); c.fillStyle = lg2; c.fillRect(0, DY, IW, IH - DY);
    const drawProp = (f, x, y, w, h, flip, id) => { const im = sprite(f); if (!sprOk(f)) { if (id) spots.push({ id, r: [x, y, x + w, y + h], z: 3000 + y + h }); return; } if (flip) { c.save(); c.translate(x + w, y); c.scale(-1, 1); c.drawImage(im, 0, 0, w, h); c.restore(); } else c.drawImage(im, x, y, w, h); if (id) spots.push({ id, r: [x, y, x + w, y + h], z: 3000 + y + h }); };
    drawProp('props/lamp.png', lampX, lampY, lampW, lampH, !L, 'lamp');
    const phW = 230, phH = phW * 340 / 246, phX = L ? IW - 40 - phW : 40, phY = 935 - phH;
    drawProp('props/phone.png', phX, phY, phW, phH, !L, 'phone');
    const atW = 230, atH = atW * 239 / 360, atX = L ? 200 : IW - 200 - atW, atY = 985 - atH;
    plan.desk.items.forEach((it) => { modSpecAR(it); it.onDesk = true; });
    plan.desk.items.sort((a, b) => a.z - b.z).forEach((it) => drawProp(it.spec.f, it.x, it.y, it.w, it.h, false, it.spec.id));
    spots.push({ id: 'ashtray', r: [atX, atY, atX + atW, atY + atH], z: 3000 + atY + atH });
    const twW = 600, s = twW / 412, twH = 319 * s, twX = IW / 2 - twW / 2, twY = IH - twH + 10;
    drawProp('props/typewriter.png', twX, twY, twW, twH, false, null);
    // cable over the desk
    { const p0 = [twX + twW - 70, twY + 150], p1 = [twX + twW + 40, twY + 150], p2 = [twX + twW - 20, IH - 90], p3 = [twX + twW + 50, IH + 20], dp = [];
      for (let i = 0; i <= 50; i++) { const t = i / 50, u = 1 - t; dp.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); }
      drawCable(c, dp, (q, t) => 13 + t * 5); }
    // a dark frame of the room, then dither everything into one pixel-art picture
    const v = c.createRadialGradient(IW / 2, IH / 2, 380, IW / 2, IH / 2, 900); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); c.fillStyle = v; c.fillRect(0, 0, IW, IH);
    const half = document.createElement('canvas'); half.width = IW / 2; half.height = IH / 2; const hc = half.getContext('2d', { willReadFrequently: true });
    hc.imageSmoothingEnabled = true; hc.drawImage(C, 0, 0, IW / 2, IH / 2);
    const dithered = false;
    R.canvas.width = IW; R.canvas.height = IH; const rc = R.canvas.getContext('2d'); rc.imageSmoothingEnabled = false; rc.drawImage(dithered ? half : C, 0, 0, IW, IH);
    // everything the animation layer needs
    R.paper = [twX + 92 * s, twY + 4 * s, twX + 330 * s, twY + 78 * s];
    R.keys = { x0: twX + 78 * s, x1: twX + 348 * s, rows: [twY + 206 * s, twY + 226 * s, twY + 246 * s] };
    const as = atW / 178;
    R.ash = { x: atX, y: atY, w: atW, h: atH, flip: !L };
    R.door = tp.door; R.note = tp.note; R.phone = [phX, phY, phX + phW, phY + phH];
    R.rain = tp.rain; R.neon = null; R.hotel = HOTEL_AT[plan.ti];
    R.lampGlow = pool;
    R.lights = ['window', 'lamp', 'phone', ...['radio', 'radiator', 'floorlamp'].filter((id) => spots.some((p) => p.id === id))];
    // hotspots: things in front first
    const front = spots.filter((p) => p.z >= 2000).sort((a, b) => b.z - a.z);
    const back = spots.filter((p) => p.z < 2000).sort((a, b) => b.z - a.z);
    R.spots = [...front.map((p) => [p.id, ...p.r]), ['typewriter', twX, twY + 90 * s, twX + twW, IH],
      ...back.map((p) => [p.id, ...p.r]), ['door', ...tp.door], ['window', ...tp.rain.reduce((a, r) => [Math.min(a[0], r[0]), Math.min(a[1], r[1]), Math.max(a[2], r[0] + r[2]), Math.max(a[3], r[1] + r[3])], [IW, IH, 0, 0])]];
    R.ready = true;
  };
  tryBuild();
  return R;
}
// which object ids a planned room contains (needed before the picture is built)
function planIds(plan) { return [...plan.items.map((i) => i.spec.id), ...plan.desk.items.map((i) => i.spec.id)]; }

// ---- music: title, ambience, the last three minutes, win, lose ----
const Music = {
  tracks: {}, current: null, vol: 0.55,
  get(name) { if (!this.tracks[name]) { const a = new Audio('sounds/' + name + '.mp3'); a.preload = 'auto'; a.loop = ['title', 'ambient', 'final'].includes(name); a.volume = 0; this.tracks[name] = a; } return this.tracks[name]; },
  play(name) {
    if (this.current === name) return;
    const old = this.current ? this.get(this.current) : null; this.current = name;
    if (old) this.fade(old, 0, () => { old.pause(); });
    if (!name) return;
    const a = this.get(name); a.currentTime = 0;
    if (Snd.on) { a.play().catch(() => {}); this.fade(a, this.vol); }
  },
  fade(a, to, done) { const from = a.volume, t0 = performance.now(), dur = 1500;
    const step = () => { const k = Math.min(1, (performance.now() - t0) / dur); a.volume = from + (to - from) * k; if (k < 1) requestAnimationFrame(step); else if (done) done(); }; step(); },
  setOn(on) { const a = this.current && this.get(this.current); if (!a) return; if (on) { a.play().catch(() => {}); this.fade(a, this.vol); } else a.pause(); },
  pause(p) { const a = this.current && this.get(this.current); if (!a) return; if (p) a.pause(); else if (Snd.on) a.play().catch(() => {}); }
};
// browsers only allow sound after a click: start the title music on the first touch
window.addEventListener('pointerdown', () => { if (S.mode === 'title' && !Music.current) Music.play('title'); }, { once: false });

// ============================================================
// 12. MAIN LOOP
// ============================================================
let lastT = 0, beatAt = 0;
function loop(t) {
  const dt = Math.min(0.1, (t - lastT) / 1000 || 0); lastT = t;
  const coopClient = NET.role === 'client' && NET.mode === 'coop';
  if (!S.paused && S.mode === 'play') {
    if (!coopClient) { if (S.freeze > 0) S.freeze = Math.max(0, S.freeze - dt); else S.elapsed += dt * S.rate; }
    if (NET.role === 'host' && NET.mode === 'coop' && t > S.syncAt) { S.syncAt = t + 250; coopSync(); }
    const sec = Math.floor(S.elapsed);
    if (sec !== S.lastTick) { S.lastTick = sec; Snd.tick(sec % 2); }
    if (!coopClient && S.elapsed >= S.nextHint && S.elapsed < S.total - 30) {
      S.nextHint += S.hintEvery;
      if (S.hints < S.maxHints && !S.ringing && !S.noteUnder) {
        if (Math.random() < 0.5) { S.ringing = true; status(L().ringing, 5); Snd.ring(); if (NET.isCoop()) NET.toAll({ t: 'hint', src: 'phone', key: S.hintPool[0] || 'decoy' }); }
        else { const key = S.hintPool[0] || 'decoy'; giveHint('note'); S.noteUnder = true; status(L().slides, 5); Snd.burst(0.4, 1500, 'bandpass', 0.2, 1); if (NET.isCoop()) NET.toAll({ t: 'hint', src: 'note', key, msg: S.noteText }); }
      }
    }
    if (S.ringing && sec % 3 === 0 && Math.abs(S.elapsed - sec) < dt) Snd.ring();
    const poison = S.elapsed / S.total;
    if (poison > 0.6 && t > beatAt) { Snd.thump(); setTimeout(() => Snd.thump(), 180); beatAt = t + 1600 - poison * 900; }
    if (S.statusUntil && S.elapsed > S.statusUntil && !S.hover) { $('status').innerHTML = '&nbsp;'; S.statusUntil = 0; }
    if (S.total - S.elapsed < 180 && S.mode === 'play') Music.play('final');
    if (S.elapsed >= S.total && !coopClient) lose();
  }
  pollGamepad(dt);
  if (S.mode !== 'title' || t % 2 < 1) animate(t);
  requestAnimationFrame(loop);
}

// ============================================================
// 13. INPUT
// ============================================================
function canvasXY(e) {
  const r = canvas.getBoundingClientRect();
  return [Math.floor((e.clientX - r.left) / r.width * W), Math.floor((e.clientY - r.top) / r.height * H)];
}
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  S.gp.active = false;
  const [x, y] = canvasXY(e);
  const h = S.mode === 'play' ? hitTest(x, y) : null;
  S.hover = h; canvas.classList.toggle('pointer', !!h);
  if (h) $('status').textContent = h.name; else if (!S.statusUntil) $('status').innerHTML = '&nbsp;';
});
canvas.addEventListener('pointerleave', () => { S.hover = null; });
canvas.addEventListener('click', (e) => {
  if (S.mode !== 'play') return;
  Snd.init();
  const [x, y] = canvasXY(e);
  const h = hitTest(x, y);
  if (h) { status(h.name, 2); openDoc(h.id); }
});

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (S.docOpen && S.docOpen !== 'end' && (e.key === 'Escape' || e.key === 'Enter')) { e.preventDefault(); closeDoc(); return; }
  if (S.docOpen) return;
  if (e.key === 'Backspace') { e.preventDefault(); pressKey('BACK'); }
  else if (e.key === 'Enter') { e.preventDefault(); pressKey('ENTER'); }
  else if (/^[a-zA-Z]$/.test(e.key)) { pressKey(e.key.toUpperCase()); }
});

$('doc-close').addEventListener('click', closeDoc);
$('doc').addEventListener('click', (e) => { if (e.target.id === 'doc' && S.docOpen !== 'end') closeDoc(); });

$('start15').addEventListener('click', () => { Snd.init(); newGame(15, S.urlSeed); S.urlSeed = 0; });
$('start10').addEventListener('click', () => { Snd.init(); newGame(10, S.urlSeed); S.urlSeed = 0; });
$('restartBtn').addEventListener('click', () => {
  closeDoc(); $('doc-close').hidden = false;
  S.token++; S.mode = 'title'; S.lines = []; S.locked = true; titleScreen(); Music.play('title'); $('title-art').style.display = '';
  $('overlay').hidden = false; $('status').innerHTML = '&nbsp;';
});
$('soundBtn').addEventListener('click', () => { Snd.init(); Snd.setOn(!Snd.on); Music.setOn(Snd.on); applyTexts(); });
{ const mv = $('musicVol'); let v = 70; try { v = +(localStorage.getItem('deadkey-music') || 70); } catch (e) {} mv.value = v; Music.vol = v / 100 * 0.8;
  mv.addEventListener('input', () => { Music.vol = mv.value / 100 * 0.8; const a = Music.current && Music.get(Music.current); if (a) a.volume = Music.vol; try { localStorage.setItem('deadkey-music', mv.value); } catch (e) {} }); }
$('fsBtn').addEventListener('click', () => { const d = document; if (d.fullscreenElement) d.exitFullscreen(); else if (d.documentElement.requestFullscreen) d.documentElement.requestFullscreen().catch(() => {}); });
document.addEventListener('fullscreenchange', () => { HD.dirty = true; });
document.querySelectorAll('.lang').forEach((b) => b.addEventListener('click', () => {
  if (S.mode !== 'title') return;
  LANG = b.dataset.lang; try { localStorage.setItem('deadkey-lang', LANG); } catch (e) {}
  applyTexts(); buildKeys();
}));
function applyTexts() {
  const l = L();
  document.documentElement.lang = LANG;
  $('tagline').textContent = l.tagline; $('start15').textContent = l.wake; $('start10').textContent = l.wakeHard; $('small').textContent = l.small;
  $('soundBtn').textContent = `${l.sound}: ${Snd.on ? l.on : l.off}`;
  $('musicLbl').textContent = l.musicVol; $('fsBtn').textContent = l.fullscreen;
  $('restartBtn').textContent = l.restart; $('doc-close').textContent = l.putBack;
  $('dailyBtn').textContent = l.daily; $('vsBtn').textContent = l.versus; $('coopBtn').textContent = l.coop; $('moreBtn').textContent = l.more;
  $('notesSum').textContent = l.notes; $('notesArea').placeholder = l.notesPh;
  document.querySelectorAll('.lang').forEach((b) => b.setAttribute('aria-pressed', b.dataset.lang === LANG ? 'true' : 'false'));
}

document.addEventListener('visibilitychange', () => {
  S.paused = document.hidden;
  if (Snd.ctx) { if (document.hidden) Snd.ctx.suspend(); else Snd.ctx.resume(); }
  Music.pause(document.hidden);
});

// gamepad: left stick / d-pad moves a cursor, A looks closer, B puts it back
function pollGamepad(dt) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = Array.from(pads || []).find((p) => p);
  if (!gp) return;
  let ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  if (gp.buttons[14] && gp.buttons[14].pressed) ax = -1; if (gp.buttons[15] && gp.buttons[15].pressed) ax = 1;
  if (gp.buttons[12] && gp.buttons[12].pressed) ay = -1; if (gp.buttons[13] && gp.buttons[13].pressed) ay = 1;
  if (Math.abs(ax) > 0.2 || Math.abs(ay) > 0.2) {
    S.gp.active = true;
    const speed = 110 * (S.mode === 'play' && S.elapsed < 20 ? 0.5 : 1);
    S.gp.x = Math.max(0, Math.min(W - 1, S.gp.x + ax * speed * dt));
    S.gp.y = Math.max(0, Math.min(H - 1, S.gp.y + ay * speed * dt));
    S.hover = S.mode === 'play' ? hitTest(S.gp.x, S.gp.y) : null;
    if (S.hover) $('status').textContent = S.hover.name;
  }
  const A = gp.buttons[0] && gp.buttons[0].pressed, B = gp.buttons[1] && gp.buttons[1].pressed;
  if (A && !S.gp.prevA) {
    Snd.init();
    if (S.docOpen && S.docOpen !== 'end') closeDoc();
    else if (S.mode === 'title') { newGame(15); }
    else if (S.mode === 'play' && S.gp.active) { const h = hitTest(S.gp.x, S.gp.y); if (h) openDoc(h.id); }
  }
  if (B && !S.gp.prevB && S.docOpen && S.docOpen !== 'end') closeDoc();
  S.gp.prevA = A; S.gp.prevB = B;
}

// ============================================================
// 15. ONLINE: versus and co-op (host + link, like Deep Line)
// ============================================================
const TO = {
  en: { solo: 'Play alone', daily: 'Room of the day', versus: 'Online: versus', coop: 'Online: co-op', name: 'Your name', create: 'Create room', join: 'Join',
    link: 'Send this link to your friends:', copy: 'Copy link', copied: 'Copied', players: 'Players', start: 'Start', waiting: 'Waiting for the host to start…', connecting: 'Connecting…',
    connErr: 'Could not connect. Check the link and that the host is still in the lobby.', solvedBy: (n) => `${n} solved it. Your clock runs faster now.`, alive: (n) => `${n.toUpperCase()} LIVES.`,
    results: 'Results', stillPlaying: 'still in the room', died: 'did not make it', show: 'Show everyone', shared: (n) => `${n} is showing you something`, sharedFrom: (n) => `Shown by ${n}:`,
    hostTypes: 'Only the host can type. Tell them what you found.', notes: 'Notes', notesPh: 'Your own notes. Only you can see them.', back: 'Back', vsMode: 'Versus', coopMode: 'Co-op', modeLabel: 'Mode' },
  hu: { solo: 'Egyedül', daily: 'A nap szobája', versus: 'Online: egymás ellen', coop: 'Online: együtt', name: 'A neved', create: 'Szoba létrehozása', join: 'Csatlakozás',
    link: 'Ezt a linket küldd el a barátaidnak:', copy: 'Link másolása', copied: 'Másolva', players: 'Játékosok', start: 'Indítás', waiting: 'Várakozás, amíg a host elindítja…', connecting: 'Csatlakozás…',
    connErr: 'Nem sikerült csatlakozni. Ellenőrizd a linket, és hogy a host még a váróteremben van-e.', solvedBy: (n) => `${n} megfejtette. Mostantól gyorsabban jár az órád.`, alive: (n) => `${n.toUpperCase()} ÉL.`,
    results: 'Eredmények', stillPlaying: 'még a szobában', died: 'nem élte túl', show: 'Megmutatom mindenkinek', shared: (n) => `${n} mutat neked valamit`, sharedFrom: (n) => `${n} mutatja:`,
    hostTypes: 'Csak a host gépelhet. Mondd el neki, mit találtál.', notes: 'Jegyzetek', notesPh: 'A saját jegyzeteid. Csak te látod.', back: 'Vissza', vsMode: 'Egymás ellen', coopMode: 'Együtt', modeLabel: 'Mód' },
  fr: { solo: 'Jouer seul', daily: 'Pièce du jour', versus: 'En ligne : duel', coop: 'En ligne : coop', name: 'Votre nom', create: 'Créer la partie', join: 'Rejoindre',
    link: 'Envoyez ce lien à vos amis :', copy: 'Copier le lien', copied: 'Copié', players: 'Joueurs', start: 'Lancer', waiting: 'En attente de l’hôte…', connecting: 'Connexion…',
    connErr: 'Connexion impossible. Vérifiez le lien et que l’hôte est toujours dans le salon.', solvedBy: (n) => `${n} a trouvé. Votre horloge tourne plus vite maintenant.`, alive: (n) => `${n.toUpperCase()} EST VIVANT.`,
    results: 'Résultats', stillPlaying: 'encore dans la pièce', died: 'n’a pas survécu', show: 'Montrer à tous', shared: (n) => `${n} vous montre quelque chose`, sharedFrom: (n) => `Montré par ${n} :`,
    hostTypes: 'Seul l’hôte peut taper. Dites-lui ce que vous avez trouvé.', notes: 'Notes', notesPh: 'Vos notes. Vous seul les voyez.', back: 'Retour', vsMode: 'Duel', coopMode: 'Coop', modeLabel: 'Mode' }
};
const TM = {
  en: { more: 'More', roomNo: 'Room number', play: 'Play', series: 'Series: three rooms', about: 'About', full: 'This room is full (max. 4 players).',
    credits: 'A noir puzzle game by Richie.', ghLabel: 'More of my games on GitHub', caseFile: 'Case file', hiddenIn: 'hidden in', means: 'means', falseFrom: (n) => `false piece from ${n}`,
    keyIn: 'Morse card in', pageIn: 'Book page in', warnIn: 'Warning about the liar in',
    kinds: { shift: 'Shaky typewriter', morse: 'Morse code', dial: 'Telephone dial', a1z26: 'Numbers to letters', book: 'Book code', mirror: 'Mirror writing' },
    nextRoom: 'Next room', round: (n) => `Room ${n} of 3`, carry: (s) => `You carry ${s} into the next room.`,
    seriesWin: 'Three rooms, three words. The man in the grey suit finally speaks: “The powerful man you were chasing is real. Now you work for us, and we will catch him together.”',
    seriesScore: 'Time left in the end' },
  hu: { more: 'Továbbiak', roomNo: 'Szoba száma', play: 'Játék', series: 'Sorozat: három szoba', about: 'Névjegy', full: 'A szoba megtelt (legfeljebb 4 játékos).',
    credits: 'Noir rejtvényjáték. Készítette: Richie.', ghLabel: 'További játékaim a GitHubon', caseFile: 'Ügyirat', hiddenIn: 'helye:', means: 'jelentése:', falseFrom: (n) => `hamis darab, forrás: ${n}`,
    keyIn: 'Morse-kártya helye:', pageIn: 'Könyvoldal helye:', warnIn: 'Figyelmeztetés a hazugról:',
    kinds: { shift: 'Elcsúszott írógép', morse: 'Morse-kód', dial: 'Telefontárcsa', a1z26: 'Számokból betűk', book: 'Könyvkód', mirror: 'Tükörírás' },
    nextRoom: 'Következő szoba', round: (n) => `${n}. szoba a háromból`, carry: (s) => `${s} időt viszel át a következő szobába.`,
    seriesWin: 'Három szoba, három szó. A szürke öltönyös férfi végre megszólal: „A befolyásos ember, aki után nyomozott, létezik. Mostantól nekünk dolgozik, és együtt kapjuk el.”',
    seriesScore: 'Megmaradt idő a végén' },
  fr: { more: 'Plus', roomNo: 'Numéro de pièce', play: 'Jouer', series: 'Série : trois pièces', about: 'À propos', full: 'La partie est pleine (4 joueurs max.).',
    credits: 'Un jeu d’énigmes noir de Richie.', ghLabel: 'Mes autres jeux sur GitHub', caseFile: 'Dossier', hiddenIn: 'caché dans', means: 'signifie', falseFrom: (n) => `faux morceau de ${n}`,
    keyIn: 'Carte morse dans', pageIn: 'Page du livre dans', warnIn: 'Avertissement sur le menteur dans',
    kinds: { shift: 'Machine décalée', morse: 'Code morse', dial: 'Cadran téléphonique', a1z26: 'Nombres en lettres', book: 'Code du livre', mirror: 'Écriture miroir' },
    nextRoom: 'Pièce suivante', round: (n) => `Pièce ${n} sur 3`, carry: (s) => `Vous emportez ${s} dans la pièce suivante.`,
    seriesWin: 'Trois pièces, trois mots. L’homme en costume gris parle enfin : « L’homme puissant que vous traquiez existe. Désormais vous travaillez pour nous, et nous l’attraperons ensemble. »',
    seriesScore: 'Temps restant à la fin' }
};
for (const k in TO) Object.assign(T[k], TO[k], TM[k]);
const GITHUB = 'https://github.com/rblackwood224';
T.en.paperName2 = 'Paper (type here)'; T.hu.paperName2 = 'Papír (ide gépelj)'; T.fr.paperName2 = 'Feuille (tapez ici)';
T.en.specMode = 'Spectrum mode'; T.hu.specMode = 'Spectrum-mód'; T.fr.specMode = 'Mode Spectrum';
T.en.revealQ = 'Do you want to know the word?'; T.en.revealYes = 'Show me'; T.en.revealNo = 'No, I’ll keep thinking'; T.en.revealKept = 'The word stays secret. Try the same room again with the button below.';
T.hu.revealQ = 'Kíváncsi vagy a megoldásra?'; T.hu.revealYes = 'Mutasd'; T.hu.revealNo = 'Nem, inkább agyalok még'; T.hu.revealKept = 'A szó titok marad. Az alábbi gombbal újra nekifuthatsz ugyanennek a szobának.';
T.fr.revealQ = 'Voulez-vous connaître le mot ?'; T.fr.revealYes = 'Montrez-le'; T.fr.revealNo = 'Non, je continue à chercher'; T.fr.revealKept = 'Le mot reste secret. Rejouez la même pièce avec le bouton ci-dessous.';
T.en.musicVol = 'Music'; T.hu.musicVol = 'Zene'; T.fr.musicVol = 'Musique';
T.en.roomsLbl = 'Rooms'; T.hu.roomsLbl = 'Szobák'; T.fr.roomsLbl = 'Pièces';
T.en.roomsOpt = { all: 'all', painted: 'painted only', built: 'built only' }; T.hu.roomsOpt = { all: 'mind', painted: 'csak festett', built: 'csak összerakott' }; T.fr.roomsOpt = { all: 'toutes', painted: 'peintes', built: 'assemblées' };
T.en.assetState = { ok: 'Asset folder found.', missing: 'Asset folder NOT found: assets/rooms/room_a.png', checking: 'Checking the asset folder…' };
T.hu.assetState = { ok: 'Az assets mappa megvan.', missing: 'Az assets mappa NEM található: assets/rooms/room_a.png', checking: 'Az assets mappa ellenőrzése…' };
T.fr.assetState = { ok: 'Dossier assets trouvé.', missing: 'Dossier assets INTROUVABLE : assets/rooms/room_a.png', checking: 'Vérification du dossier assets…' };
T.en.roomType = (b) => b ? 'built room' : 'painted room'; T.hu.roomType = (b) => b ? 'összerakott szoba' : 'festett szoba'; T.fr.roomType = (b) => b ? 'pièce assemblée' : 'pièce peinte';
T.en.nextRoomNote = 'This takes effect in the next room.'; T.hu.nextRoomNote = 'Ez a következő szobától érvényes.'; T.fr.nextRoomNote = 'Ce réglage s’applique à la prochaine pièce.';
T.en.fullscreen = 'Full screen'; T.hu.fullscreen = 'Teljes képernyő'; T.fr.fullscreen = 'Plein écran';
// typing: physical keyboard anywhere, phone keyboard through a hidden input
function focusKbd() { const k = $('kbd'); k.value = ' '; k.focus({ preventScroll: true }); }
(function () {
  const k = $('kbd');
  k.addEventListener('input', () => {
    const v = k.value;
    if (v === '') pressKey('BACK');
    else for (const ch of stripAcc(v.trim()).toUpperCase()) if (/[A-Z]/.test(ch)) pressKey(ch);
    k.value = ' ';
  });
  k.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); pressKey('ENTER'); } });
  $('paper').addEventListener('click', focusKbd);
})();

const NET = {
  role: null, code: '', myId: Math.random().toString(36).slice(2, 10), name: '', players: [], conns: [], peer: null, bc: null, conn: null, mode: 'versus', local: false,
  // ---- transport ----
  async ensurePeer() {
    if (window.Peer) return true;
    await new Promise((res) => { const s = document.createElement('script'); s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'; s.onload = res; s.onerror = res; document.head.appendChild(s); });
    return !!window.Peer;
  },
  async host(mode) {
    this.role = 'host'; this.mode = mode; this.code = Math.random().toString(36).slice(2, 8).toUpperCase();
    this.players = [{ id: this.myId, name: this.name }];
    if (this.local) { this.bc = new BroadcastChannel('deadkey-' + this.code); this.bc.onmessage = (e) => { if (e.data._dir === 'h') this.onHost(e.data); }; return true; }
    if (!(await this.ensurePeer())) return false;
    return new Promise((res) => {
      this.peer = new window.Peer('deadkey-' + this.code);
      this.peer.on('open', () => res(true));
      this.peer.on('error', () => res(false));
      this.peer.on('connection', (c) => { this.conns.push(c); c.on('data', (d) => this.onHost(d)); c.on('close', () => { this.conns = this.conns.filter((x) => x !== c); }); });
    });
  },
  async join(code) {
    this.role = 'client'; this.code = code;
    if (this.local) { this.bc = new BroadcastChannel('deadkey-' + code); this.bc.onmessage = (e) => { if (e.data._dir === 'a') this.onClient(e.data); }; this.toHost({ t: 'hello', id: this.myId, name: this.name }); return true; }
    if (!(await this.ensurePeer())) return false;
    return new Promise((res) => {
      this.peer = new window.Peer();
      this.peer.on('error', () => res(false));
      this.peer.on('open', () => {
        this.conn = this.peer.connect('deadkey-' + code, { reliable: true });
        this.conn.on('open', () => { this.toHost({ t: 'hello', id: this.myId, name: this.name }); res(true); });
        this.conn.on('data', (d) => this.onClient(d));
        this.conn.on('error', () => res(false));
      });
      setTimeout(() => res(false), 12000);
    });
  },
  toHost(m) { m.from = this.myId; if (this.role === 'host') { this.onHost(m); return; } if (this.bc) this.bc.postMessage({ ...m, _dir: 'h' }); else if (this.conn) this.conn.send(m); },
  toAll(m) { if (this.role !== 'host') return; if (this.bc) this.bc.postMessage({ ...m, _dir: 'a' }); this.conns.forEach((c) => { try { c.send(m); } catch (e) {} }); this.onClient(m, true); },
  online() { return this.role === 'host' || this.role === 'client'; },
  isCoop() { return this.online() && this.mode === 'coop'; },
  // ---- host side ----
  onHost(m) {
    switch (m.t) {
      case 'hello':
        if (!this.players.find((p) => p.id === m.id)) {
          if (this.players.length >= 4 || S.mode !== 'title') { this.toAll({ t: 'full', id: m.id }); break; }
          this.players.push({ id: m.id, name: m.name || 'Detective' });
        }
        this.toAll({ t: 'lobby', players: this.players, mode: this.mode }); break;
      case 'solved': case 'lost': {
        const p = this.players.find((x) => x.id === m.from); if (!p || p.done) break;
        p.done = m.t; p.secs = m.secs;
        const count = this.players.filter((x) => x.done === 'solved').length;
        this.toAll({ t: 'progress', players: this.players, who: p.name, whoId: p.id, kind: m.t, count });
        break;
      }
      case 'show': this.toAll({ t: 'show', from: m.from, name: m.name, html: m.html }); break;
      case 'hintTaken': this.toAll({ t: 'hintTaken', src: m.src }); break;
    }
  },
  // ---- everyone (including host) ----
  onClient(m, self) {
    switch (m.t) {
      case 'full': if (m.id === this.myId) { this.fullRoom = true; const nm = $('netMsg'); if (nm) nm.textContent = L().full; else { $('lobby').innerHTML = `<div class="d"><p>${L().full}</p></div>`; } } break;
      case 'lobby': if (this.fullRoom || !m.players.find((p) => p.id === this.myId)) break; this.players = m.players; this.mode = m.mode; renderLobby(); break;
      case 'start': if (this.role === 'client') { LANG = m.lang; applyTexts(); buildKeys(); }
        this.players = m.players; S.myIndex = m.players.findIndex((p) => p.id === this.myId); $('lobby').hidden = true; $('doc-close').hidden = false; closeDoc();
        newGame(m.minutes, m.seed, { mode: m.mode, players: m.players.length }); break;
      case 'progress':
        this.players = m.players;
        if (m.kind === 'solved' && S.mode === 'play' && m.whoId !== this.myId && this.mode === 'versus') { S.rate = 60 / (60 - 10 * Math.min(3, m.count)); status(L().solvedBy(m.who), 6); Snd.bell(); }
        if (S.docOpen === 'end') renderResults();
        break;
      case 'paper': if (this.role === 'client' && this.mode === 'coop') { S.lines = m.lines; S.input = m.input; S.locked = true; renderPaper(true); } break;
      case 'time': if (this.role === 'client' && this.mode === 'coop') { S.elapsed = m.elapsed; S.freeze = m.freeze; S.wrong = m.wrong; S.hints = m.hints; } break;
      case 'go': if (this.role === 'client' && this.mode === 'coop' && S.mode === 'intro') { S.mode = 'play'; status(L().hostTypes, 6); } break;
      case 'hint': if (this.role === 'client' && this.mode === 'coop') { S.hintPool = [m.key]; if (m.src === 'phone') { S.ringing = true; status(L().ringing, 5); Snd.ring(); } else { S.noteUnder = true; S.noteText = m.msg; status(L().slides, 5); } } break;
      case 'hintTaken': if (m.src === 'phone') { S.ringing = false; Snd.stopRing(); } else S.noteUnder = false; break;
      case 'show': if (m.from !== this.myId) { S.sharedDoc = m; const b = $('sharedBtn'); b.textContent = L().shared(m.name); b.hidden = false; Snd.burst(0.2, 1200, 'bandpass', 0.2, 2); } break;
      case 'end': if (this.role === 'client' && this.mode === 'coop') { if (m.win) { S.elapsed = m.elapsed; win(true); } else { S.elapsed = S.total; lose(true); } } break;
    }
  }
};

// host broadcasts co-op state
function coopSync() {
  if (!(NET.role === 'host' && NET.mode === 'coop')) return;
  NET.toAll({ t: 'time', elapsed: S.elapsed, freeze: S.freeze, wrong: S.wrong, hints: S.hints });
}

// ---- lobby UI ----
function renderLobby() {
  const l = L(), box = $('lobby');
  box.hidden = false; $('overlay').hidden = true; $('title-art').style.display = 'none';
  const url = `${location.origin}${location.pathname}?join=${NET.code}${NET.local ? '&local=1' : ''}`;
  const names = NET.players.map((p) => `<li>${esc(p.name)}${p.id === NET.myId ? ' ✓' : ''}</li>`).join('');
  box.innerHTML = `<div class="d"><h2 id="lobby-title">${NET.mode === 'coop' ? l.coopMode : l.vsMode}</h2>
    ${NET.role === 'host' ? `<p>${l.link}</p><p class="linkline"><input id="linkBox" readonly value="${esc(url)}" aria-label="${l.link}"> <button type="button" class="btn btn-small" id="copyBtn">${l.copy}</button></p>` : ''}
    <p class="meta">${l.players} (${NET.players.length}/4)</p><ul class="plist">${names}</ul>
    ${NET.role === 'host' ? `<div class="end-actions"><button type="button" class="btn" id="lobbyStart">${l.start}</button><button type="button" class="btn btn-quiet" id="lobbyBack">${l.back}</button></div>` : `<p>${l.waiting}</p>`}</div>`;
  if ($('copyBtn')) $('copyBtn').onclick = () => { const i = $('linkBox'); i.select(); try { navigator.clipboard.writeText(i.value); } catch (e) { document.execCommand('copy'); } $('copyBtn').textContent = l.copied; };
  if ($('lobbyBack')) $('lobbyBack').onclick = () => location.reload();
  if ($('lobbyStart')) $('lobbyStart').onclick = () => {
    const seed = Math.floor(Math.random() * 900000) + 100000;
    const minutes = NET.mode === 'coop' ? 15 : 12;
    NET.toAll({ t: 'start', seed, minutes, mode: NET.mode, lang: LANG, players: NET.players });
  };
}

function askName(after) {
  const l = L(), box = $('lobby');
  box.hidden = false; $('overlay').hidden = true;
  let saved = ''; try { saved = localStorage.getItem('deadkey-name') || ''; } catch (e) {}
  box.innerHTML = `<div class="d"><label for="nameBox">${l.name}</label><p class="linkline"><input id="nameBox" maxlength="14" value="${esc(saved)}" autocomplete="nickname"> <button type="button" class="btn btn-small" id="nameOk">${NET.role === 'client' ? l.join : l.create}</button></p><p id="netMsg" class="meta"></p>
    <p><button type="button" class="btn btn-quiet btn-small" id="nameBack">${l.back}</button></p></div>`;
  $('nameBox').focus();
  $('nameBack').onclick = () => location.reload();
  const go = async () => {
    NET.name = ($('nameBox').value.trim() || 'Detective').slice(0, 14);
    try { localStorage.setItem('deadkey-name', NET.name); } catch (e) {}
    $('netMsg').textContent = l.connecting; $('nameOk').disabled = true;
    const ok = await after();
    if (!ok) { $('netMsg').textContent = l.connErr; $('nameOk').disabled = false; }
    else if (NET.role === 'client') setTimeout(() => { if (NET.fullRoom) { $('netMsg').textContent = l.full; $('nameOk').disabled = true; } }, 800);
  };
  $('nameOk').onclick = go;
  $('nameBox').onkeydown = (e) => { if (e.key === 'Enter') go(); };
}

function startOnline(mode) {
  Snd.init();
  NET.role = 'host';
  askName(async () => { const ok = await NET.host(mode); if (ok) renderLobby(); return ok; });
}

function renderResults() {
  const l = L();
  const el = $('results'); if (!el) return;
  const list = NET.players.slice().sort((a, b) => (a.done === 'solved' ? a.secs : 1e9) - (b.done === 'solved' ? b.secs : 1e9));
  el.innerHTML = `<p class="meta">${l.results}</p><ol>${list.map((p) => `<li>${esc(p.name)}: ${p.done === 'solved' ? fmt(p.secs) : p.done === 'lost' ? l.died : l.stillPlaying}</li>`).join('')}</ol>`;
}

function shareDoc() {
  const body = $('doc-body').cloneNode(true);
  body.querySelectorAll('button').forEach((b) => b.remove());
  NET.toHost({ t: 'show', name: NET.name, html: body.innerHTML });
}

// ============================================================
// 14. START
// ============================================================
try { const saved = localStorage.getItem('deadkey-lang'); if (saved && T[saved]) LANG = saved; } catch (e) {}
applyTexts();
buildKeys();
// optional title picture: put a title.png next to index.html
(function () { const im = $('title-art'); im.onload = () => { im.hidden = false; $('stage').classList.add('has-art'); }; im.src = 'title.png'; })();
function titleScreen() {
  document.body.classList.add('on-title');
  S.viewMode = S.spectrum ? 'spectrum' : 'image';
  rng = mulberry32(1934);
  S.layout = { slots: { WA: 'calendar', WB: 'newspaper', FURN: 'cabinet', FLOOR: 'basket', DL: 'notepad', DR: 'letter' }, neonWin: 0, neonWord: 'HOTEL', weather: 'rain', bookShelf: 1, bookX: 228 };
  drawRoom(base, S.layout);
  // big title on the dark room
  rectF(base, 60, 66, 196, 96, 0); rectO(base, 62, 68, 194, 94);
  text(base, 68, 72, 'DEAD KEY', 1, 4);
  canvas.style.filter = 'brightness(0.55)';
  renderPaper();
}
// on phones the settings and notes go below the paper instead of over the picture
(function placeBars() {
  const mq = window.matchMedia('(max-width: 760px), (orientation: portrait)');
  const apply = () => { const tb = $('toolbar'), nt = $('notes'); if (mq.matches) { $('app').appendChild(tb); $('app').appendChild(nt); } else { $('stage').appendChild(tb); $('stage').appendChild(nt); } };
  apply(); mq.addEventListener ? mq.addEventListener('change', apply) : mq.addListener(apply);
})();
if (location.hash === '#test') { window.__dk = S; window.__net = NET; window.__hot = () => hotspots(); }
{
  const qp = new URLSearchParams(location.search);
  NET.local = qp.get('local') === '1';
  $('vsBtn').addEventListener('click', () => startOnline('versus'));
  $('coopBtn').addEventListener('click', () => startOnline('coop'));
  $('dailyBtn').addEventListener('click', () => { Snd.init(); const d = new Date(); newGame(15, d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()); });
  $('sharedBtn').addEventListener('click', () => {
    const m = S.sharedDoc; if (!m) return;
    $('doc-body').innerHTML = `<p class="meta" style="color:#ccc">${L().sharedFrom(esc(m.name))}</p>` + m.html;
    $('doc').hidden = false; S.docOpen = 'shared'; $('sharedBtn').hidden = true;
  });
  $('moreBtn').addEventListener('click', () => {
    const l = L(), box = $('lobby'); box.hidden = false; $('overlay').hidden = true;
    box.innerHTML = `<div class="d menu"><h2>DEAD KEY</h2>
      <p><button type="button" class="btn" id="seriesBtn">${l.series}</button></p>
      <label for="roomBox">${l.roomNo}</label><p class="linkline"><input id="roomBox" inputmode="numeric" maxlength="8" placeholder="123456"> <button type="button" class="btn btn-small" id="roomGo">${l.play}</button></p>
      <p class="linkline">${l.roomsLbl}: ${['all', 'painted', 'built'].map((k) => `<button type="button" class="btn btn-small ${ROOM_PREF === k ? '' : 'btn-quiet'}" data-rooms="${k}">${l.roomsOpt[k]}</button>`).join(' ')}</p>
      <p class="meta">${l.assetState[MOD_STATE]}</p>
      <hr><h3>${l.about}</h3><p>${l.credits}</p><p><a href="${GITHUB}" target="_blank" rel="noopener">${l.ghLabel}</a></p><p class="meta">DEAD KEY · 2026 · v${VERSION}</p>
      <p><button type="button" class="btn btn-quiet btn-small" id="menuBack">${l.back}</button></p></div>`;
    $('menuBack').onclick = () => { box.hidden = true; $('overlay').hidden = false; };
    box.querySelectorAll('[data-rooms]').forEach((b) => { b.onclick = () => { ROOM_PREF = b.dataset.rooms; try { localStorage.setItem('deadkey-rooms', ROOM_PREF); } catch (e) {} $('moreBtn').click(); }; });
    $('seriesBtn').onclick = () => { Snd.init(); box.hidden = true; newGame(15, 0, { series: true }); };
    $('roomGo').onclick = () => { const n = parseInt($('roomBox').value, 10); if (n > 0) { Snd.init(); box.hidden = true; newGame(15, n); } };
  });
  const join = qp.get('join');
  if (join) { NET.role = 'client'; setTimeout(() => askName(() => NET.join(join.toUpperCase())), 50); }
}
S.urlSeed = parseInt(new URLSearchParams(location.search).get('room'), 10) || 0;
titleScreen();
requestAnimationFrame(loop);
})();
