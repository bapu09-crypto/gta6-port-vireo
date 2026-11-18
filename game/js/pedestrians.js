// Pedestrians: people walking the sidewalks who flee from gunfire and crashes.
import { PED_NAMES, makeRng, pick, clamp, dist2 } from './config.js';

const SHIRT_COLORS = ['#d94f3d', '#3d7dd9', '#e8b73a', '#5da85d', '#9b6dd9', '#e8e4da', '#d97fb0', '#4fb0a5'];

export function spawnPedestrians(city, count, seed) {
  const rng = makeRng(seed);
  const peds = [];
  for (let i = 0; i < count; i++) {
    const road = pick(rng, city.roadsV);
    const y = rng() * 2300;
    peds.push({
      kind: 'ped',
      name: pick(rng, PED_NAMES),
      x: road + (rng() < 0.5 ? -62 : 62),
      y,
      angle: rng() * Math.PI * 2,
      speed: 34 + rng() * 26,
      color: pick(rng, SHIRT_COLORS),
      walkPhase: rng() * 10,
      flee: 0,
      id: Math.floor(rng() * 1e9),
    });
  }
  return peds;
}

export function updatePedestrians(peds, city, world, dt) {
  for (const p of peds) {
    p.walkPhase += dt * 8;
    // Flee from nearby danger (gunfire, explosions, speeding cars).
    let danger = null;
    for (const e of world.dangerEvents || []) {
      if (dist2(p.x, p.y, e.x, e.y) < 260 * 260) { danger = e; break; }
    }
    if (danger) p.flee = 2.5;
    if (p.flee > 0) {
      p.flee -= dt;
      const a = Math.atan2(p.y - danger.y, p.x - danger.x);
      p.angle = a;
      p.x += Math.cos(a) * 120 * dt;
      p.y += Math.sin(a) * 120 * dt;
    } else {
      // Stroll along the sidewalk; turn at random.
      if (Math.random() < 0.004) p.angle = Math.random() * Math.PI * 2;
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
    }
    // Stay out of buildings and water; wrap at the edges.
    if (city && city.buildings) {
      for (const b of city.buildings) {
        if (p.x > b.x - 6 && p.x < b.x + b.w + 6 && p.y > b.y - 6 && p.y < b.y + b.h + 6) {
          p.angle += Math.PI / 2;
          p.x += Math.cos(p.angle) * 30 * dt;
          p.y += Math.sin(p.angle) * 30 * dt;
        }
      }
    }
    p.x = clamp(p.x, 20, 4180);
    p.y = clamp(p.y, 20, 2280);
  }
  // Danger events expire.
  if (world.dangerEvents) world.dangerEvents = world.dangerEvents.filter((e) => e.ttl > 0);
}

export function drawPedestrians(ctx, peds, cam) {
  for (const p of peds) {
    const sx = p.x - cam.x, sy = p.y - cam.y;
    if (sx < -20 || sx > 1300 || sy < -20 || sy > 740) continue;
    const bob = Math.sin(p.walkPhase) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(sx, sy + 7, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(sx, sy + bob * 0.3, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath(); ctx.arc(sx, sy - 9 + bob * 0.3, 4.5, 0, Math.PI * 2); ctx.fill();
  }
}

// A pedestrian near a point (taxi pickup, mission target).
export function nearestPed(peds, x, y, maxDist) {
  let best = null, bd = maxDist * maxDist;
  for (const p of peds) {
    const d = dist2(p.x, p.y, x, y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
