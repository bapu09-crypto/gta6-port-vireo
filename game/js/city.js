// Port Vireo city: grid of streets, blocks of buildings, parks and a harbor.
// Everything is drawn procedurally on canvas; no image assets anywhere.
import { WORLD_W, WORLD_H, ROAD_SPACING, ROAD_W, DISTRICTS, LANDMARKS, makeRng, pick, clamp } from './config.js';

// A building is an axis-aligned box with a roof color and a height (for shadow).
export function createCity(seed) {
  const rng = makeRng(seed);
  const roadsV = [];
  const roadsH = [];
  for (let x = ROAD_SPACING / 2; x < WORLD_W; x += ROAD_SPACING) roadsV.push(x);
  for (let y = ROAD_SPACING / 2; y < WORLD_H - 700; y += ROAD_SPACING) roadsH.push(y);

  const buildings = [];
  const parks = [];
  const roofColors = ['#b98a5e', '#8a6f5c', '#7d8a99', '#a89a7d', '#96695a', '#6f7f6a', '#9c7f8e', '#c2b49a'];
  for (let bx = 0; bx < roadsV.length - 1; bx++) {
    for (let by = 0; by < roadsH.length - 1; by++) {
      const x0 = roadsV[bx] + ROAD_W / 2 + 14;
      const x1 = roadsV[bx + 1] - ROAD_W / 2 - 14;
      const y0 = roadsH[by] + ROAD_W / 2 + 14;
      const y1 = roadsH[by + 1] - ROAD_W / 2 - 14;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      // One park per few blocks, plus the big Westfield Park.
      if (rng() < 0.14) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, trees: Math.floor(rng() * 6) + 4 });
        continue;
      }
      const n = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const w = 60 + rng() * 110;
        const h = 60 + rng() * 110;
        const x = x0 + rng() * Math.max(1, (x1 - x0) - w);
        const y = y0 + rng() * Math.max(1, (y1 - y0) - h);
        buildings.push({
          x, y, w, h,
          color: pick(rng, roofColors),
          height: 8 + rng() * 22,
          windows: Math.floor(rng() * 3),
        });
      }
    }
  }
  // The harbor: water along the south edge, piers jutting into it.
  const harbor = { x: 0, y: WORLD_H - 700, w: WORLD_W, h: 700 };
  const piers = [];
  for (let i = 0; i < 5; i++) {
    const x = 350 + i * 780 + rng() * 120;
    piers.push({ x, y: WORLD_H - 700, w: 90, h: 300 + rng() * 160 });
  }
  return { roadsV, roadsH, buildings, parks, harbor, piers, districts: DISTRICTS, landmarks: LANDMARKS };
}

export function districtAt(city, x, y) {
  for (const d of city.districts) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return city.districts[city.districts.length - 1];
}

export function pointInBuilding(city, x, y, pad = 0) {
  for (const b of city.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

export function pointInWater(city, x, y) {
  return x >= city.harbor.x && x < city.harbor.x + city.harbor.w &&
    y >= city.harbor.y && y < city.harbor.y + city.harbor.h;
}

// Nearest point on any road to (x, y) — used to snap spawns onto streets.
export function nearestRoadPoint(city, x, y) {
  let best = null, bd = Infinity;
  for (const rx of city.roadsV) {
    const cy = clamp(y, 0, WORLD_H - 700);
    const d = Math.abs(x - rx);
    if (d < bd) { bd = d; best = { x: rx, y: cy, along: 'v' }; }
  }
  for (const ry of city.roadsH) {
    const cx = clamp(x, 0, WORLD_W);
    const d = Math.abs(y - ry);
    if (d < bd) { bd = d; best = { x: cx, y: ry, along: 'h' }; }
  }
  return best;
}

function drawRoads(ctx, city, cam) {
  ctx.fillStyle = '#2e2e33';
  for (const x of city.roadsV) ctx.fillRect(x - ROAD_W / 2 - cam.x, -cam.y, ROAD_W, WORLD_H - 700);
  for (const y of city.roadsH) ctx.fillRect(-cam.x, y - ROAD_W / 2 - cam.y, WORLD_W, ROAD_W);
  // Lane dashes.
  ctx.fillStyle = '#c9b458';
  for (const x of city.roadsV) {
    for (let y = 0; y < WORLD_H - 700; y += 56) {
      if (x - cam.x < -60 || x - cam.x > 1340) continue;
      ctx.fillRect(x - 2 - cam.x, y - cam.y, 4, 26);
    }
  }
  for (const y of city.roadsH) {
    for (let x = 0; x < WORLD_W; x += 56) {
      if (y - cam.y < -60 || y - cam.y > 780) continue;
      ctx.fillRect(x - cam.x, y - 2 - cam.y, 26, 4);
    }
  }
  // Sidewalk edges.
  ctx.strokeStyle = '#5c5c62';
  ctx.lineWidth = 4;
  for (const x of city.roadsV) {
    ctx.beginPath(); ctx.moveTo(x - ROAD_W / 2 - cam.x, -cam.y); ctx.lineTo(x - ROAD_W / 2 - cam.x, WORLD_H - 700 - cam.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + ROAD_W / 2 - cam.x, -cam.y); ctx.lineTo(x + ROAD_W / 2 - cam.x, WORLD_H - 700 - cam.y); ctx.stroke();
  }
  for (const y of city.roadsH) {
    ctx.beginPath(); ctx.moveTo(-cam.x, y - ROAD_W / 2 - cam.y); ctx.lineTo(WORLD_W - cam.x, y - ROAD_W / 2 - cam.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-cam.x, y + ROAD_W / 2 - cam.y); ctx.lineTo(WORLD_W - cam.x, y + ROAD_W / 2 - cam.y); ctx.stroke();
  }
}

function drawBuildings(ctx, city, cam, time) {
  for (const b of city.buildings) {
    const sx = b.x - cam.x, sy = b.y - cam.y;
    if (sx > 1320 || sy > 760 || sx + b.w < -40 || sy + b.h < -40) continue;
    // Drop shadow for height.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(sx + b.height * 0.4, sy + b.height * 0.4, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(sx, sy, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(sx, sy, b.w, 10);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, b.w, b.h);
    // Lit windows at dusk and night.
    if (time >= 0.55) {
      ctx.fillStyle = '#ffd977';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if ((i * 7 + j * 13 + b.height) % 3 === 0) {
            ctx.fillRect(sx + 8 + i * 34, sy + 10 + j * 34, 12, 14);
          }
        }
      }
    }
  }
}

function drawParksAndHarbor(ctx, city, cam, time) {
  for (const p of city.parks) {
    ctx.fillStyle = '#4d7a44';
    ctx.fillRect(p.x - cam.x, p.y - cam.y, p.w, p.h);
    ctx.fillStyle = '#3f6b3a';
    for (let i = 0; i < p.trees; i++) {
      const tx = p.x + ((i * 97) % p.w);
      const ty = p.y + ((i * 61) % p.h);
      ctx.beginPath(); ctx.arc(tx - cam.x, ty - cam.y, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5d8a4a';
      ctx.beginPath(); ctx.arc(tx - cam.x - 4, ty - cam.y - 4, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3f6b3a';
    }
  }
  // Harbor water with animated shimmer.
  const hb = city.harbor;
  ctx.fillStyle = '#2b6d8f';
  ctx.fillRect(hb.x - cam.x, hb.y - cam.y, hb.w, hb.h);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  const t = performance.now() / 900;
  for (let i = 0; i < 60; i++) {
    const wx = ((i * 173 + t * 40) % WORLD_W) - cam.x;
    const wy = hb.y + ((i * 97) % hb.h) - cam.y;
    ctx.fillRect(wx, wy, 26, 3);
  }
  // Piers and moored boats.
  for (const p of city.piers) {
    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(p.x - cam.x, p.y - cam.y, p.w, p.h);
    ctx.fillStyle = '#e8e4da';
    ctx.fillRect(p.x + 12 - cam.x, p.y + p.h - 60 - cam.y, 66, 22);
    ctx.fillStyle = '#c8452c';
    ctx.fillRect(p.x + 26 - cam.x, p.y + p.h - 78 - cam.y, 20, 18);
  }
  // Beach strip above the water.
  ctx.fillStyle = '#d9c48f';
  ctx.fillRect(-cam.x, WORLD_H - 730 - cam.y, WORLD_W, 30);
}

export function drawCity(ctx, city, cam, time) {
  // Ground.
  ctx.fillStyle = '#6f6f66';
  ctx.fillRect(-cam.x, -cam.y, WORLD_W, WORLD_H);
  drawParksAndHarbor(ctx, city, cam, time);
  drawRoads(ctx, city, cam);
  drawBuildings(ctx, city, cam, time);
  // Landmark labels on the world itself.
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  for (const lm of city.landmarks) {
    const sx = lm.x - cam.x, sy = lm.y - cam.y;
    if (sx < -120 || sx > 1400 || sy < -40 || sy > 780) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const w = ctx.measureText(lm.name).width + 14;
    ctx.fillRect(sx - w / 2, sy - 26, w, 20);
    ctx.fillStyle = '#f2ead8';
    ctx.fillText(lm.name, sx, sy - 11);
  }
}
