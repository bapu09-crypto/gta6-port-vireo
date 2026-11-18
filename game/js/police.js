// Wanted level and the Vireo Police Department: cruisers and foot cops.
import { VEHICLES, clamp, angleDiff, dist2 } from './config.js';
import { drawCar } from './traffic.js';

// Wanted stars 0-5. Crimes add heat; heat decays when the police lose sight.
export function addWanted(world, stars, reason) {
  if (world.wanted >= 5) return;
  world.wanted = clamp(world.wanted + stars, 0, 5);
  world.wantedTimer = 0;
  world.lastCrime = reason;
  if (world.onCrime) world.onCrime(stars, reason);
}

export function createPoliceCar(x, y, rng) {
  return {
    kind: 'police', type: 'cruiser', def: VEHICLES.cruiser,
    x, y, angle: 0, speed: 0, color: VEHICLES.cruiser.color,
    sirenPhase: rng ? rng() * 2 : 0,
    ramCooldown: 0,
    id: Math.floor(Math.random() * 1e9),
  };
}

export function createFootCop(x, y) {
  return {
    kind: 'cop', x, y, angle: 0, speed: 150,
    color: '#1d2f45', catchCooldown: 0,
    id: Math.floor(Math.random() * 1e9),
  };
}

// How many police units the current wanted level fields.
export function wantedUnitCount(wanted) {
  return [0, 1, 2, 3, 4, 6][wanted] || 0;
}

export function updatePolice(world, city, dt) {
  const player = world.player;
  const px = player.x, py = player.y;
  // Spawn units up to the wanted level's count.
  const want = wantedUnitCount(world.wanted);
  const cops = world.cops;
  const cruisers = world.policeCars;
  while (cruisers.length + cops.length < want) {
    const edge = Math.random() < 0.5;
    const sx = edge ? clamp(px + (Math.random() < 0.5 ? -700 : 700), 40, 4160) : px + (Math.random() - 0.5) * 900;
    const sy = edge ? py + (Math.random() - 0.5) * 900 : clamp(py + (Math.random() < 0.5 ? -700 : 700), 40, 2260);
    if (world.wanted >= 2 && Math.random() < 0.75) {
      cruisers.push(createPoliceCar(clamp(sx, 40, 4160), clamp(sy, 40, 2260), Math.random));
    } else {
      cops.push(createFootCop(clamp(sx, 40, 4160), clamp(sy, 40, 2260)));
    }
  }
  // Despawn far-away units when the heat is gone.
  if (world.wanted === 0) {
    world.policeCars.length = 0;
    world.cops.length = 0;
  }
  // Cruiser pursuit: steer toward the player, ram at close range.
  for (const c of cruisers) {
    c.sirenPhase += dt * 6;
    const target = angleDiff(c.angle, Math.atan2(py - c.y, px - c.x));
    c.angle += clamp(target, -2.4 * dt, 2.4 * dt);
    const targetSpeed = 380 + world.wanted * 12;
    c.speed += clamp(targetSpeed - c.speed, -500 * dt, 320 * dt);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    c.ramCooldown -= dt;
    if (dist2(c.x, c.y, px, py) < 46 * 46 && c.ramCooldown <= 0) {
      c.ramCooldown = 1.2;
      if (world.onRam) world.onRam(c);
    }
  }
  // Foot cops chase on foot and try to grab the player.
  for (const cop of cops) {
    const d = Math.sqrt(dist2(cop.x, cop.y, px, py));
    if (d > 4) {
      cop.angle = Math.atan2(py - cop.y, px - cop.x);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
    }
    cop.catchCooldown -= dt;
    if (d < 26 && cop.catchCooldown <= 0) {
      cop.catchCooldown = 1.5;
      if (world.onCaught) world.onCaught(cop);
    }
  }
  // Wanted decay: only while no police unit is close.
  const nearest = nearestPoliceDistance(world, px, py);
  if (world.wanted > 0 && nearest > 520) {
    world.wantedTimer += dt;
    if (world.wantedTimer > 12) {
      world.wanted -= 1;
      world.wantedTimer = 0;
    }
  } else {
    world.wantedTimer = 0;
  }
}

export function nearestPoliceDistance(world, x, y) {
  let best = Infinity;
  for (const c of world.policeCars) best = Math.min(best, Math.sqrt(dist2(c.x, c.y, x, y)));
  for (const c of world.cops) best = Math.min(best, Math.sqrt(dist2(c.x, c.y, x, y)));
  return best;
}

export function drawPolice(ctx, world, cam, night) {
  for (const c of world.policeCars) {
    drawCar(ctx, c, cam, night);
    // Flashing light bar.
    const sx = c.x - cam.x, sy = c.y - cam.y;
    if (sx < -80 || sx > 1360 || sy < -80 || sy > 800) continue;
    const on = Math.sin(c.sirenPhase) > 0;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(c.angle);
    ctx.fillStyle = on ? '#ff3b30' : '#2f7bff';
    ctx.fillRect(-6, -9, 12, 5);
    ctx.fillStyle = on ? '#2f7bff' : '#ff3b30';
    ctx.fillRect(-6, 4, 12, 5);
    ctx.restore();
  }
  for (const cop of world.cops) {
    const sx = cop.x - cam.x, sy = cop.y - cam.y;
    if (sx < -20 || sx > 1300 || sy < -20 || sy > 740) continue;
    ctx.fillStyle = '#1d2f45';
    ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath(); ctx.arc(sx, sy - 9, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(sx - 5, sy - 4, 10, 3);
  }
}
