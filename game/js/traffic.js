// Traffic: civilian cars that drive the road grid, stop for jams and honk.
import { VEHICLES, makeRng, pick, clamp, angleDiff } from './config.js';

const TRAFFIC_TYPES = ['sedan', 'sedan', 'taxi', 'van', 'truck', 'coupe'];

export function createTrafficCar(city, rng) {
  const alongV = rng() < 0.5;
  const road = alongV
    ? pick(rng, city.roadsV)
    : pick(rng, city.roadsH);
  const type = pick(rng, TRAFFIC_TYPES);
  const def = VEHICLES[type];
  const dir = rng() < 0.5 ? 1 : -1;
  const x = alongV ? road : rng() * 4200;
  const y = alongV ? rng() * 2300 : road;
  return {
    kind: 'traffic', type, def,
    x, y,
    angle: alongV ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
    speed: 90 + rng() * 60,
    dir, alongV, road,
    stopped: 0,
    color: def.color,
    id: Math.floor(rng() * 1e9),
  };
}

export function spawnTraffic(city, count, seed) {
  const rng = makeRng(seed);
  const cars = [];
  for (let i = 0; i < count; i++) cars.push(createTrafficCar(city, rng));
  return cars;
}

// A traffic car drives straight along its road; at an intersection it may turn.
function atIntersection(car, city) {
  const tol = 14;
  if (car.alongV) {
    for (const y of city.roadsH) if (Math.abs(car.y - y) < tol) return y;
  } else {
    for (const x of city.roadsV) if (Math.abs(car.x - x) < tol) return x;
  }
  return null;
}

export function updateTraffic(cars, city, world, dt) {
  for (const car of cars) {
    // Stop for a car directly ahead.
    let blocked = false;
    const ahead = 58;
    const ax = car.x + Math.cos(car.angle) * ahead;
    const ay = car.y + Math.sin(car.angle) * ahead;
    for (const other of cars) {
      if (other === car) continue;
      if (Math.abs(other.x - ax) < 26 && Math.abs(other.y - ay) < 26) { blocked = true; break; }
    }
    if (world.playerCar && Math.abs(world.playerCar.x - ax) < 30 && Math.abs(world.playerCar.y - ay) < 30) blocked = true;
    if (blocked) { car.stopped += dt; continue; }
    car.stopped = 0;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Turn at intersections, sometimes.
    const cross = atIntersection(car, city);
    if (cross !== null && Math.random() < 0.012) {
      const turnLeft = Math.random() < 0.5;
      if (car.alongV) {
        car.alongV = false; car.road = cross;
        car.angle = turnLeft ? Math.PI : 0;
        car.y = cross;
      } else {
        car.alongV = true; car.road = cross;
        car.angle = turnLeft ? -Math.PI / 2 : Math.PI / 2;
        car.x = cross;
      }
    }
    // Wrap around the world edges.
    if (car.x < -60) car.x = 4260; if (car.x > 4260) car.x = -60;
    if (car.y < -60) car.y = 2360; if (car.y > 2360) car.y = -60;
  }
}

export function drawCar(ctx, car, cam, headlights) {
  const sx = car.x - cam.x, sy = car.y - cam.y;
  if (sx < -80 || sx > 1360 || sy < -80 || sy > 800) return;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(car.angle);
  const L = car.def.len, W = car.def.wid;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-L / 2 + 3, -W / 2 + 3, L, W);
  // Body.
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-L / 2, -W / 2, L, W, 7);
  ctx.fill();
  // Roof and windshield.
  ctx.fillStyle = car.def.roof;
  ctx.fillRect(-L / 2 + 10, -W / 2 + 3, L * 0.42, W - 6);
  ctx.fillStyle = '#bcd8e8';
  ctx.fillRect(L / 2 - 12, -W / 2 + 3, 8, W - 6);
  // Headlights at night.
  if (headlights) {
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(L / 2 - 2, -W / 2 + 2, 4, 5);
    ctx.fillRect(L / 2 - 2, W / 2 - 7, 4, 5);
  }
  ctx.restore();
}

export function drawTraffic(ctx, cars, cam, night) {
  for (const car of cars) drawCar(ctx, car, cam, night);
}

// Nearest drivable car to a point (for stealing).
export function nearestCar(cars, x, y, maxDist) {
  let best = null, bd = maxDist * maxDist;
  for (const car of cars) {
    const dx = car.x - x, dy = car.y - y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}
