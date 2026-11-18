// Port Vireo — main loop, player, driving, camera and game state.
// Top-down open-world crime game: on foot and by car, wanted level, missions.
import { WORLD_W, WORLD_H, TUNE, VEHICLES, makeRng, clamp, dist2, angleDiff } from './config.js';
import { createCity, drawCity, pointInBuilding, pointInWater, nearestRoadPoint, districtAt } from './city.js';
import { spawnTraffic, updateTraffic, drawTraffic, drawCar, nearestCar } from './traffic.js';
import { spawnPedestrians, updatePedestrians, drawPedestrians, nearestPed } from './pedestrians.js';
import { addWanted, updatePolice, drawPolice } from './police.js';
import { createMissions, startMission, updateMissions, missionMarker, drawMissionMarkers, scatterTokens, STORY } from './missions.js';
import { createParticles, updateParticles, drawParticles, spawnExplosion, spawnSparks, firePistol, updateBullets, drawBullets } from './combat.js';
import { drawHud, drawTitleScreen, drawPauseScreen, drawEndScreen } from './hud.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';
import { createInput } from './input.js';
import * as audio from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = 1280;
canvas.height = 720;

const input = createInput();

function createWorld(seed) {
  const rng = makeRng(seed);
  const city = createCity(seed);
  const world = {
    seed,
    city,
    cam: { x: 0, y: 0 },
    state: 'title',
    player: { x: 1890, y: 1470, angle: 0, health: 100, speed: 0 }, // Vireo Tower intersection
    playerCar: null,
    traffic: spawnTraffic(city, TUNE.trafficCount, seed + 7),
    peds: spawnPedestrians(city, TUNE.pedCount, seed + 13),
    policeCars: [],
    cops: [],
    particles: createParticles(),
    bullets: [],
    dangerEvents: [],
    wanted: 0,
    wantedTimer: 0,
    money: 250,
    ammo: TUNE.pistolAmmo,
    missions: createMissions(),
    clock: 600, // minutes since midnight: 10:00
    raining: false,
    rainTimer: 0,
    weatherTimer: 40,
    stats: { carsStolen: 0, missionsDone: 0, shotsFired: 0, arrests: 0 },
    radio: null,
    hint: null,
    time: 0,
    punchCooldown: 0,
    onCrime: null,
    onRam: null,
    onCaught: null,
    onPickup: null,
    onMissionStart: null,
    onMissionComplete: null,
  };
  world.missions.tokens = scatterTokens(rng, city);
  world.onCrime = (stars, reason) => { world.radio = { text: 'VPD DISPATCH: ' + reason, ttl: 4 }; };
  world.onRam = (cop) => {
    if (world.playerCar) {
      world.playerCar.condition -= 12;
      spawnSparks(world.particles, cop.x, cop.y);
      audio.playPunch();
      if (world.playerCar.condition <= 0) explodePlayerCar(world);
    } else {
      world.player.health -= 15;
      spawnSparks(world.particles, world.player.x, world.player.y);
    }
  };
  world.onCaught = () => {
    if (world.state !== 'playing') return;
    world.state = 'busted';
    world.stats.arrests += 1;
    const fine = Math.min(500, Math.floor(world.money * 0.2));
    world.money -= fine;
    world.bustedFine = fine;
    audio.playBusted();
    audio.stopSiren();
    audio.stopEngine();
  };
  world.onPickup = (x, y) => { audio.playPickup(); spawnSparks(world.particles, x, y); };
  world.onMissionStart = () => { audio.playChime(); };
  world.onMissionComplete = () => {
    world.ammo = TUNE.pistolAmmo;
    world.stats.missionsDone += 1;
    audio.playMissionComplete();
    saveGame(world);
  };
  return world;
}

function explodePlayerCar(world) {
  const car = world.playerCar;
  if (!car) return;
  spawnExplosion(world.particles, car.x, car.y, true);
  audio.playExplosion();
  addWanted(world, 1, 'Vehicle explosion in Downtown');
  world.player.x = car.x + 40;
  world.player.y = car.y + 40;
  world.playerCar = null;
  audio.stopEngine();
}

// Circle vs building push-out for a point with radius r.
function collideBuildings(world, x, y, r) {
  const b = pointInBuilding(world.city, x, y, 0);
  if (!b) return { x, y };
  const dxl = x - (b.x - r), dxr = (b.x + b.w + r) - x;
  const dyt = y - (b.y - r), dyb = (b.y + b.h + r) - y;
  const m = Math.min(dxl, dxr, dyt, dyb);
  if (m === dxl) return { x: b.x - r, y };
  if (m === dxr) return { x: b.x + b.w + r, y };
  if (m === dyt) return { x, y: b.y - r };
  return { x, y: b.y + b.h + r };
}

function updatePlayerOnFoot(world, dt) {
  const p = world.player;
  const mv = input.moveVector();
  p.speed = mv.x || mv.y ? TUNE.walkSpeed : 0;
  if (mv.x || mv.y) p.angle = Math.atan2(mv.y, mv.x);
  let nx = p.x + mv.x * TUNE.walkSpeed * dt;
  let ny = p.y + mv.y * TUNE.walkSpeed * dt;
  if (pointInWater(world.city, nx, ny)) { nx = p.x; ny = p.y; }
  const fixed = collideBuildings(world, nx, ny, 10);
  p.x = clamp(fixed.x, 16, WORLD_W - 16);
  p.y = clamp(fixed.y, 16, WORLD_H - 16);
  // Health regen out of trouble.
  if (world.wanted === 0 && p.health < 100) p.health = Math.min(100, p.health + 4 * dt);
}

function updatePlayerCar(world, dt) {
  const car = world.playerCar;
  if (!car) return;
  const fwd = input.down('w') || input.down('ArrowUp') ? 1 : 0;
  const rev = input.down('s') || input.down('ArrowDown') ? 1 : 0;
  const left = input.down('a') || input.down('ArrowLeft') ? 1 : 0;
  const right = input.down('d') || input.down('ArrowRight') ? 1 : 0;
  const brake = input.down(' ') ? 1 : 0;
  if (fwd) car.speed += car.def.accel * dt;
  if (rev) car.speed -= car.def.accel * 0.7 * dt;
  if (!fwd && !rev) car.speed -= Math.sign(car.speed) * 120 * dt;
  if (brake) car.speed -= Math.sign(car.speed) * 420 * dt;
  if (Math.abs(car.speed) < 8 && !fwd && !rev) car.speed = 0;
  car.speed = clamp(car.speed, -car.def.top * 0.45, car.def.top);
  const steer = (right - left) * car.def.grip * (car.speed >= 0 ? 1 : -1) * clamp(Math.abs(car.speed) / 120, 0, 1);
  car.angle += steer * dt * (brake ? 1.5 : 1);
  let nx = car.x + Math.cos(car.angle) * car.speed * dt;
  let ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (pointInWater(world.city, nx, ny)) { nx = car.x; ny = car.y; car.speed *= 0.4; }
  const fixed = collideBuildings(world, nx, ny, 22);
  if (fixed.x !== nx || fixed.y !== ny) {
    car.speed *= 0.55;
    car.condition -= Math.abs(car.speed) * 0.02;
    spawnSparks(world.particles, fixed.x, fixed.y);
  }
  car.x = clamp(fixed.x, 20, WORLD_W - 20);
  car.y = clamp(fixed.y, 20, WORLD_H - 20);
  // Bump traffic cars.
  for (const t of world.traffic) {
    if (dist2(car.x, car.y, t.x, t.y) < 42 * 42) {
      const a = Math.atan2(t.y - car.y, t.x - car.x);
      t.x += Math.cos(a) * 26;
      t.y += Math.sin(a) * 26;
      car.speed *= 0.7;
      car.condition -= 1.5;
      spawnSparks(world.particles, (car.x + t.x) / 2, (car.y + t.y) / 2);
      if (world.wanted === 0 && Math.abs(car.speed) > 200) addWanted(world, 1, 'Hit-and-run on a civilian car');
    }
  }
  // Run over pedestrians.
  for (let i = world.peds.length - 1; i >= 0; i--) {
    const p = world.peds[i];
    if (dist2(car.x, car.y, p.x, p.y) < 30 * 30 && Math.abs(car.speed) > 60) {
      world.peds.splice(i, 1);
      addWanted(world, 1, 'Pedestrian struck by a vehicle');
      world.dangerEvents.push({ x: p.x, y: p.y, ttl: 1.5 });
    }
  }
  // Sync the player to the car.
  world.player.x = car.x;
  world.player.y = car.y;
  world.player.angle = car.angle;
  audio.setEngineSpeed(Math.abs(car.speed) / car.def.top);
  if (car.condition <= 0) explodePlayerCar(world);
}

function tryEnterCar(world) {
  const p = world.player;
  if (world.playerCar) {
    // Exit the car.
    const car = world.playerCar;
    car.parked = true;
    car.speed = 0;
    world.traffic.push(car);
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    world.playerCar = null;
    audio.stopEngine();
    return;
  }
  const car = nearestCar(world.traffic, p.x, p.y, 56);
  if (!car) return;
  world.traffic.splice(world.traffic.indexOf(car), 1);
  car.condition = car.condition ?? 100;
  car.speed = 0;
  world.playerCar = car;
  world.stats.carsStolen += 1;
  addWanted(world, 1, 'Vehicle theft reported near ' + districtAt(world.city, p.x, p.y).name);
  audio.startEngine();
  world.radio = { text: 'You took the ' + car.def.name + '. The VPD is on its way.', ttl: 3 };
}

function tryPunch(world) {
  const p = world.player;
  if (world.punchCooldown > 0) return;
  world.punchCooldown = 0.35;
  audio.playPunch();
  const range = TUNE.punchRange;
  const fx = p.x + Math.cos(p.angle) * range, fy = p.y + Math.sin(p.angle) * range;
  // Debtor (mission target).
  const m = world.missions;
  if (m.debtor && dist2(fx, fy, m.debtor.x, m.debtor.y) < 40 * 40) {
    m.debtor.hp -= TUNE.punchDamage;
    spawnSparks(world.particles, m.debtor.x, m.debtor.y);
    if (m.debtor.hp <= 0) {
      m.debtor = null;
      world.money += 0; // paid on delivery
      if (world.onMissionComplete) { /* stage completes via missions update */ }
      // Advance the punch stage directly.
      m.stage += 1;
      m.stageTimer = 0;
      world.radio = { text: 'Debt collected. Get it to The Gull & Anchor.', ttl: 3 };
    }
    return;
  }
  // Mugger (vigilante).
  if (m.vigilante && dist2(fx, fy, m.vigilante.x, m.vigilante.y) < 40 * 40) {
    m.vigilante.hp -= TUNE.punchDamage;
    spawnSparks(world.particles, m.vigilante.x, m.vigilante.y);
    return;
  }
  // A cop: risky.
  const cop = world.cops.find((c) => dist2(fx, fy, c.x, c.y) < 34 * 34);
  if (cop) {
    addWanted(world, 1, 'Assault on a VPD officer');
    cop.x += Math.cos(p.angle) * 40;
    cop.y += Math.sin(p.angle) * 40;
    return;
  }
  // A pedestrian: they flee, and someone saw it.
  const ped = nearestPed(world.peds, fx, fy, 30);
  if (ped) {
    ped.flee = 3;
    addWanted(world, 1, 'Assault reported in ' + districtAt(world.city, p.x, p.y).name);
  }
}

function tryShoot(world) {
  if (world.state !== 'playing') return;
  const p = world.player;
  const rect = canvas.getBoundingClientRect();
  const mx = (input.mouse.x - rect.left) * (1280 / rect.width) + world.cam.x;
  const my = (input.mouse.y - rect.top) * (720 / rect.height) + world.cam.y;
  const angle = Math.atan2(my - p.y, mx - p.x);
  p.angle = angle;
  const b = firePistol(world, p.x, p.y, angle);
  if (b) {
    world.stats.shotsFired += 1;
    audio.playGunshot();
    if (world.wanted === 0) addWanted(world, 1, 'Shots fired in ' + districtAt(world.city, p.x, p.y).name);
  }
}

function updateWorld(world, dt) {
  world.time += dt;
  world.clock = (world.clock + dt * 6) % 1440;
  // Weather.
  world.weatherTimer -= dt;
  if (world.weatherTimer <= 0) {
    world.weatherTimer = 45 + Math.random() * 30;
    world.raining = Math.random() < 0.3;
  }
  if (world.raining) world.rainTimer = 0.1;
  world.punchCooldown -= dt;
  if (world.radio) { world.radio.ttl -= dt; if (world.radio.ttl <= 0) world.radio = null; }
  // Input: pause, mute, mission.
  if (input.justPressed('p') || input.justPressed('P') || input.justPressed('Escape')) {
    world.state = world.state === 'playing' ? 'paused' : 'playing';
    audio.playClick();
  }
  if (input.justPressed('m') || input.justPressed('M')) {
    if (!world.missions.active && !world.missions.done) startMission(world, world.missions.index);
    else if (!world.missions.active && world.missions.done) world.radio = { text: 'Story complete. Side jobs still pay.', ttl: 3 };
  }
  if (input.justPressed('e') || input.justPressed('E')) tryEnterCar(world);
  if (input.justPressed('f') || input.justPressed('F')) tryPunch(world);
  if (input.mouse.clicked) tryShoot(world);
  if (world.state !== 'playing') return;
  if (world.playerCar) updatePlayerCar(world, dt);
  else updatePlayerOnFoot(world, dt);
  updateTraffic(world.traffic, world.city, world, dt);
  updatePedestrians(world.peds, world.city, world, dt);
  updatePolice(world, world.city, dt);
  updateMissions(world, dt);
  updateBullets(world, dt);
  updateParticles(world.particles, dt);
  // Siren when police are near.
  const near = world.policeCars.length > 0 || world.cops.length > 0;
  if (near && world.wanted > 0) audio.startSiren(); else audio.stopSiren();
  // Busted / wasted.
  if (world.player.health <= 0) {
    world.state = 'wasted';
    const fine = Math.min(500, Math.floor(world.money * 0.2));
    world.money -= fine;
    world.wastedFine = fine;
    audio.playBusted();
    audio.stopSiren();
    audio.stopEngine();
  }
  // Camera follows the player.
  world.cam.x = clamp(world.player.x - 640, 0, WORLD_W - 1280);
  world.cam.y = clamp(world.player.y - 360, 0, WORLD_H - 720);
  // Context hint.
  const nearCar = !world.playerCar && nearestCar(world.traffic, world.player.x, world.player.y, 56);
  world.hint = nearCar ? 'Press E to steal the ' + nearCar.def.name : null;
}

function timeOfDay(world) {
  // 0 = dawn, 0.5 = noon, 0.75 = dusk, 0.9+ = night.
  return (world.clock / 1440);
}

function drawNightTint(ctx, world) {
  const t = timeOfDay(world);
  let dark = 0;
  if (t >= 0.72 && t < 0.85) dark = (t - 0.72) / 0.13 * 0.25; // dusk
  else if (t >= 0.85 || t < 0.2) dark = 0.42; // night
  else if (t >= 0.2 && t < 0.3) dark = 0.18; // dawn
  if (dark > 0) {
    ctx.fillStyle = t >= 0.72 && t < 0.85 ? `rgba(40,20,60,${dark})` : `rgba(8,12,30,${dark})`;
    ctx.fillRect(0, 0, 1280, 720);
  }
  // Streetlight glow at night.
  if (dark > 0.2) {
    ctx.fillStyle = 'rgba(255,220,140,0.10)';
    for (const x of world.city.roadsV) {
      for (const y of world.city.roadsH) {
        const sx = x - world.cam.x, sy = y - world.cam.y;
        if (sx < -60 || sx > 1340 || sy < -60 || sy > 780) continue;
        ctx.beginPath(); ctx.arc(sx, sy, 46, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}

function drawRain(ctx, world) {
  if (!world.raining) return;
  ctx.strokeStyle = 'rgba(180,200,220,0.35)';
  ctx.lineWidth = 1;
  const t = world.time * 900;
  for (let i = 0; i < 90; i++) {
    const x = (i * 97 + t) % 1320 - 20;
    const y = (i * 173 + t * 1.7) % 760 - 20;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 16); ctx.stroke();
  }
}

function drawPlayer(ctx, world) {
  const p = world.player;
  const sx = p.x - world.cam.x, sy = p.y - world.cam.y;
  if (world.playerCar) return; // the car is drawn by traffic drawing
  // White ring so the player reads clearly among the pedestrians.
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(sx, sy, 12, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(sx, sy + 7, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2c6ec8';
  ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath(); ctx.arc(sx, sy - 10, 5, 0, Math.PI * 2); ctx.fill();
  // Facing tick.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(p.angle) * 12, sy + Math.sin(p.angle) * 12); ctx.stroke();
}

function drawOffscreenMarker(ctx, world) {
  const mk = missionMarker(world);
  if (!mk) return;
  const sx = mk.x - world.cam.x, sy = mk.y - world.cam.y;
  if (sx > 0 && sx < 1280 && sy > 0 && sy < 720) return;
  const cx = clamp(sx, 30, 1250), cy = clamp(sy, 30, 690);
  const a = Math.atan2(sy - 360, sx - 640);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(Math.round(Math.hypot(mk.x - world.player.x, mk.y - world.player.y) / 10) * 10 + 'm', cx, cy + 26);
}

function render(world) {
  ctx.clearRect(0, 0, 1280, 720);
  if (world.state === 'title') { drawTitleScreen(ctx, world, hasSave()); return; }
  drawCity(ctx, world.city, world.cam, timeOfDay(world));
  drawMissionMarkers(ctx, world, world.cam);
  drawTraffic(ctx, world.traffic, world.cam, timeOfDay(world) >= 0.72);
  drawPedestrians(ctx, world.peds, world.cam);
  drawPolice(ctx, world, world.cam, timeOfDay(world) >= 0.72);
  if (world.playerCar) drawCar(ctx, world.playerCar, world.cam, timeOfDay(world) >= 0.72);
  drawPlayer(ctx, world);
  drawBullets(ctx, world.bullets, world.cam);
  drawParticles(ctx, world.particles, world.cam);
  drawNightTint(ctx, world);
  drawRain(ctx, world);
  drawOffscreenMarker(ctx, world);
  drawHud(ctx, world, world.city);
  if (world.state === 'paused') drawPauseScreen(ctx);
  if (world.state === 'busted') drawEndScreen(ctx, 'busted', world.bustedFine || 0);
  if (world.state === 'wasted') drawEndScreen(ctx, 'wasted', world.wastedFine || 0);
}

// --- Deterministic screenshot scenes (?shot=chase|street|mission|night) ---
function setupShot(world, shot) {
  const city = world.city;
  world.state = 'playing';
  const road = (x) => city.roadsV.reduce((a, b) => Math.abs(b - x) < Math.abs(a - x) ? b : a);
  if (shot === 'chase') {
    // Cover: driving chase, 2 police cars, 3 wanted stars, mission countdown.
    const coupe = { kind: 'player', type: 'coupe', def: VEHICLES.coupe, x: 2100, y: 1500, angle: 0, speed: 320, condition: 100, color: VEHICLES.coupe.color };
    world.playerCar = coupe;
    world.player.x = 2100; world.player.y = 1500; world.player.angle = 0;
    world.wanted = 3;
    world.money = 4820;
    world.clock = 13 * 60;
    world.missions.index = 2;
    world.missions.active = true;
    world.missions.stage = 0;
    world.missions.stageTimer = 13; // 47s left on the 60s timer
    world.policeCars = [
      { kind: 'police', type: 'cruiser', def: VEHICLES.cruiser, x: 1980, y: 1540, angle: 0, speed: 380, color: VEHICLES.cruiser.color, sirenPhase: 1, ramCooldown: 0 },
      { kind: 'police', type: 'cruiser', def: VEHICLES.cruiser, x: 2020, y: 1440, angle: 0.2, speed: 370, color: VEHICLES.cruiser.color, sirenPhase: 0, ramCooldown: 0 },
    ];
    world.radio = { text: 'VPD DISPATCH: All units, suspect last seen near Downtown.', ttl: 99 };
  } else if (shot === 'street') {
    // On foot in a busy Downtown district.
    world.player.x = 1500; world.player.y = 1300; world.player.angle = -Math.PI / 2;
    world.money = 1250;
    world.clock = 11 * 60 + 30;
    world.missions.index = 1;
    world.missions.active = true;
    world.missions.stage = 0;
    world.missions.stageTimer = 0;
    world.peds = world.peds.slice(0, 14).map((p, i) => ({ ...p, x: 1350 + (i % 5) * 70, y: 1150 + Math.floor(i / 5) * 90 }));
    world.radio = { text: 'CITY WIRE: The Gull & Anchor is packed tonight.', ttl: 99 };
  } else if (shot === 'mission') {
    // Mission in progress: delivering the van at dusk, police on the tail.
    // The van runs the coastal road east toward the pier approach, so the
    // frame holds city, road, chase and the pier marker at once.
    const van = { kind: 'player', type: 'van', def: VEHICLES.van, x: 1500, y: 2100, angle: 0, speed: 240, condition: 82, color: VEHICLES.van.color };
    world.playerCar = van;
    world.player.x = 1500; world.player.y = 2100; world.player.angle = 0;
    world.wanted = 4;
    world.money = 3100;
    world.clock = 18 * 60 + 30;
    world.missions.index = 3;
    world.missions.active = true;
    world.missions.stage = 1;
    world.missions.stageTimer = 0;
    world.policeCars = [
      { kind: 'police', type: 'cruiser', def: VEHICLES.cruiser, x: 1350, y: 2140, angle: 0, speed: 390, color: VEHICLES.cruiser.color, sirenPhase: 2, ramCooldown: 0 },
    ];
    world.radio = { text: 'ROOK: One last run. Pier 9, no stops.', ttl: 99 };
  } else if (shot === 'night') {
    // Night drive with headlights, streetlight glow and rain.
    const coupe = { kind: 'player', type: 'coupe', def: VEHICLES.coupe, x: 1850, y: 1500, angle: 0, speed: 260, condition: 100, color: VEHICLES.coupe.color };
    world.playerCar = coupe;
    world.player.x = 1850; world.player.y = 1500; world.player.angle = 0;
    world.wanted = 1;
    world.money = 5400;
    world.clock = 22 * 60;
    world.raining = true;
    world.missions.index = 2;
    world.missions.active = true;
    world.missions.stage = 0;
    world.missions.stageTimer = 20;
    world.policeCars = [
      { kind: 'police', type: 'cruiser', def: VEHICLES.cruiser, x: 1700, y: 1540, angle: 0, speed: 360, color: VEHICLES.cruiser.color, sirenPhase: 0.5, ramCooldown: 0 },
    ];
    world.radio = { text: 'HARBOUR RADIO: Fog rolling in off the bay. Drive careful out there.', ttl: 99 };
  }
  world.cam.x = clamp(world.player.x - 640, 0, WORLD_W - 1280);
  world.cam.y = clamp(world.player.y - 360, 0, WORLD_H - 720);
  // Shot scenes auto-drive: the player car holds its line so the frame stays composed.
  world.shotMode = shot;
  window.__shotReady = true;
}

function autoDrive(world, dt) {
  // In shot mode the player car drives straight ahead so screenshots stay composed.
  const car = world.playerCar;
  if (!car) return;
  car.speed = Math.min(car.speed + 200 * dt, car.def.top * 0.75);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const fixed = collideBuildings(world, car.x, car.y, 22);
  car.x = fixed.x; car.y = fixed.y;
  world.player.x = car.x;
  world.player.y = car.y;
  world.cam.x = clamp(world.player.x - 640, 0, WORLD_W - 1280);
  world.cam.y = clamp(world.player.y - 360, 0, WORLD_H - 720);
}

// --- Boot ---
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const world = createWorld(1);
window.__game = world;

if (shot) {
  setupShot(world, shot);
} else {
  const save = loadGame();
  if (save) {
    world.money = save.money;
    world.player.health = save.health;
    world.missions.index = Math.min(save.missionIndex || 0, STORY.length - 1);
    world.missions.tokensCollected = save.tokensCollected || 0;
    world.stats = save.stats || world.stats;
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (world.state === 'title') {
    if (input.justPressed('Enter')) {
      world.state = 'playing';
      audio.playClick();
      if (!world.missions.active && world.missions.index === 0) {
        world.radio = { text: 'Press M to start your first mission: Wheels Up', ttl: 6 };
      }
    }
    if (input.justPressed('n') || input.justPressed('N')) {
      clearSave();
      world.money = 250;
      world.missions.index = 0;
      world.state = 'playing';
    }
  } else if (world.state === 'busted' || world.state === 'wasted') {
    if (input.justPressed('Enter')) {
      world.player.health = 100;
      world.player.x = 1850;
      world.player.y = 1500;
      world.wanted = 0;
      world.policeCars = [];
      world.cops = [];
      world.state = 'playing';
      saveGame(world);
    }
  } else if (world.state === 'playing') {
    if (world.shotMode) {
      // Scripted scenes: run the world but keep the player car on its line.
      updateTraffic(world.traffic, world.city, world, dt);
      updatePedestrians(world.peds, world.city, world, dt);
      updateParticles(world.particles, dt);
      updatePolice(world, world.city, dt);
      autoDrive(world, dt);
      if (world.radio) world.radio.ttl = 99;
    } else {
      updateWorld(world, dt);
    }
  } else if (world.state === 'paused') {
    if (input.justPressed('m') || input.justPressed('M')) audio.setMuted(!audio.isMuted());
    if (input.justPressed('r') || input.justPressed('R')) {
      const save = loadGame();
      if (save) { world.money = save.money; world.player.health = save.health; }
      world.state = 'playing';
    }
    updateWorld(world, 0);
  }
  // A draw error must never kill the loop: log it and keep playing.
  try {
    render(world);
  } catch (err) {
    console.error('render error', err);
  }
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
