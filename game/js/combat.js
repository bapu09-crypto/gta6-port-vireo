// Combat: fists, a pistol, bullets, particles and explosions.
import { TUNE, clamp, dist2 } from './config.js';

export function createParticles() {
  return [];
}

export function spawnExplosion(particles, x, y, big = false) {
  const n = big ? 46 : 22;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * (big ? 340 : 200);
    particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.5 + Math.random() * 0.7, ttl: 0.5 + Math.random() * 0.7,
      size: 3 + Math.random() * (big ? 9 : 5),
      color: ['#ff9d2e', '#ff5a2e', '#ffd23e', '#5a5a5a'][Math.floor(Math.random() * 4)],
    });
  }
  // Smoke lingers longer.
  for (let i = 0; i < 10; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 30,
      vx: (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 30,
      life: 1.6, ttl: 1.6, size: 12 + Math.random() * 14,
      color: 'rgba(90,90,90,0.35)',
    });
  }
}

export function spawnMuzzle(particles, x, y, angle) {
  for (let i = 0; i < 6; i++) {
    particles.push({
      x: x + Math.cos(angle) * 14, y: y + Math.sin(angle) * 14,
      vx: Math.cos(angle + (Math.random() - 0.5)) * 260,
      vy: Math.sin(angle + (Math.random() - 0.5)) * 260,
      life: 0.12, ttl: 0.12, size: 3, color: '#ffe9a8',
    });
  }
}

export function spawnSparks(particles, x, y) {
  for (let i = 0; i < 8; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 220, vy: (Math.random() - 0.5) * 220,
      life: 0.3, ttl: 0.3, size: 2, color: '#ffd23e',
    });
  }
}

export function updateParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96; p.vy *= 0.96;
  }
}

export function drawParticles(ctx, particles, cam) {
  for (const p of particles) {
    const sx = p.x - cam.x, sy = p.y - cam.y;
    if (sx < -30 || sx > 1310 || sy < -30 || sy > 750) continue;
    ctx.globalAlpha = clamp(p.life / p.ttl, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(sx, sy, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Fire the pistol from (x, y) toward an angle. Returns the bullet or null.
export function firePistol(world, x, y, angle) {
  if (world.ammo <= 0) return null;
  world.ammo -= 1;
  const b = { x: x + Math.cos(angle) * 18, y: y + Math.sin(angle) * 18, vx: Math.cos(angle) * 620, vy: Math.sin(angle) * 620, life: 0.9 };
  world.bullets.push(b);
  spawnMuzzle(world.particles, x, y, angle);
  if (world.dangerEvents) world.dangerEvents.push({ x, y, ttl: 1.2 });
  return b;
}

export function updateBullets(world, dt) {
  for (let i = world.bullets.length - 1; i >= 0; i--) {
    const b = world.bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let hit = b.life <= 0;
    // Hit a pedestrian.
    if (!hit) {
      for (const p of world.peds) {
        if (dist2(b.x, b.y, p.x, p.y) < 14 * 14) {
          spawnSparks(world.particles, p.x, p.y);
          world.peds.splice(world.peds.indexOf(p), 1);
          hit = true;
          break;
        }
      }
    }
    // Hit a police car.
    if (!hit) {
      for (const c of world.policeCars) {
        if (dist2(b.x, b.y, c.x, c.y) < 26 * 26) {
          spawnExplosion(world.particles, c.x, c.y, false);
          world.policeCars.splice(world.policeCars.indexOf(c), 1);
          hit = true;
          break;
        }
      }
    }
    // Hit a foot cop.
    if (!hit) {
      for (const c of world.cops) {
        if (dist2(b.x, b.y, c.x, c.y) < 14 * 14) {
          spawnSparks(world.particles, c.x, c.y);
          world.cops.splice(world.cops.indexOf(c), 1);
          hit = true;
          break;
        }
      }
    }
    if (hit) world.bullets.splice(i, 1);
  }
}

export function drawBullets(ctx, bullets, cam) {
  ctx.fillStyle = '#ffe9a8';
  for (const b of bullets) {
    const sx = b.x - cam.x, sy = b.y - cam.y;
    ctx.fillRect(sx - 2, sy - 2, 4, 4);
  }
}
