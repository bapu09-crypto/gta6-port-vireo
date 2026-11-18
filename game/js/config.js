// Port Vireo — shared constants, tuning and data.
// Every name here is original: no real-world city, brand or franchise names.
export const CITY_NAME = 'Port Vireo';
export const WORLD_W = 4200;
export const WORLD_H = 3000;
export const ROAD_SPACING = 420;
export const ROAD_W = 92;

// Districts of Port Vireo, laid out on the city grid.
export const DISTRICTS = [
  { name: 'Old Town', x: 0, y: 0, w: 1300, h: 1100, tint: '#c9a06a' },
  { name: 'University Hill', x: 1300, y: 0, w: 1400, h: 1100, tint: '#7fae7a' },
  { name: 'Downtown', x: 1300, y: 1100, w: 1400, h: 900, tint: '#8fa8c9' },
  { name: 'Westfield', x: 0, y: 1100, w: 1300, h: 900, tint: '#b08a9e' },
  { name: 'The Yards', x: 2700, y: 0, w: 1500, h: 1100, tint: '#9a938a' },
  { name: 'Marina', x: 0, y: 2000, w: 4200, h: 1000, tint: '#5f9db3' },
];

// Named places the player can see on signs and the minimap.
export const LANDMARKS = [
  { name: 'Vireo Tower', x: 1850, y: 1500 },
  { name: 'Harbor Market', x: 900, y: 2350 },
  { name: 'Copperline Station', x: 3050, y: 650 },
  { name: 'The Gull & Anchor', x: 700, y: 2600 },
  { name: 'Marina Pier 9', x: 2100, y: 2750 },
  { name: 'Westfield Park', x: 500, y: 1500 },
  { name: 'St. Anselm Steps', x: 1150, y: 400 },
  { name: 'The Foundry', x: 3300, y: 500 },
];

// Drivable vehicles. color is the body paint, top is the top speed (px/s).
export const VEHICLES = {
  sedan:   { name: 'Vireo Sedan',   len: 46, wid: 22, accel: 260, top: 330, grip: 2.6, color: '#c8452c', roof: '#7e2a1a' },
  taxi:    { name: 'Harbor Cab',    len: 46, wid: 22, accel: 240, top: 310, grip: 2.6, color: '#e8b73a', roof: '#3a3a3a' },
  coupe:   { name: 'Vireo GT',      len: 48, wid: 22, accel: 330, top: 430, grip: 3.1, color: '#2c6ec8', roof: '#173a6e' },
  van:     { name: 'Dockside Van',  len: 56, wid: 24, accel: 200, top: 280, grip: 2.2, color: '#e8e4da', roof: '#8a8578' },
  truck:   { name: 'Yard Hauler',   len: 62, wid: 26, accel: 170, top: 250, grip: 2.0, color: '#5d7a4a', roof: '#33452a' },
  cruiser: { name: 'VPD Cruiser',   len: 48, wid: 22, accel: 320, top: 420, grip: 3.0, color: '#1d2f45', roof: '#e8e4da' },
};

// Brainrot-free original pedestrian first names for flavor.
export const PED_NAMES = [
  'Mara', 'Tomas', 'Ines', 'Jules', 'Priya', 'Oskar', 'Lena', 'Dario',
  'Sana', 'Felix', 'Rosa', 'Henrik', 'Aya', 'Marco', 'Nia', 'Petr',
];

// Radio dispatch flavor lines, shown as banners.
export const DISPATCH_LINES = [
  'VPD DISPATCH: All units, suspect last seen near the Marina.',
  'VPD DISPATCH: Be advised, stolen vehicle reported on Copperline Ave.',
  'VPD DISPATCH: Units 4 and 7, respond to a disturbance in Old Town.',
  'HARBOUR RADIO: Fog rolling in off the bay. Drive careful out there.',
  'VPD DISPATCH: Air support is grounded. Repeat, grounded.',
  'CITY WIRE: The Gull & Anchor is packed tonight. Free oysters at nine.',
];

// Tuning.
export const TUNE = {
  walkSpeed: 185,
  punchRange: 34,
  punchDamage: 25,
  pistolDamage: 34,
  pistolAmmo: 12,
  maxHealth: 100,
  wantedDecaySeconds: 12,
  copChaseRange: 700,
  copCatchRange: 26,
  trafficCount: 22,
  pedCount: 42,
  dayLengthSeconds: 240,
};

// Deterministic RNG (mulberry32) so screenshots and saves reproduce.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI;
  return d;
}
