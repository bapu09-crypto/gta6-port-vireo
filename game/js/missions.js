// Story missions and side activities for Port Vireo.
// Rook Calloway, ex-getaway driver, is back in town and owes the wrong people.
import { TUNE, clamp, dist2 } from './config.js';
import { addWanted } from './police.js';

export const STORY = [
  {
    id: 'wheels-up',
    title: 'Wheels Up',
    brief: 'Rook is back in Port Vireo with no car and a debt. Steal any car, then get to Marina Pier 9.',
    stages: [
      { kind: 'steal', text: 'Steal a car — walk up to one and press E' },
      { kind: 'reach', x: 2100, y: 2750, radius: 90, time: 90, text: 'Drive to Marina Pier 9' },
    ],
    reward: 500,
  },
  {
    id: 'harbormaster',
    title: 'The Harbormaster',
    brief: 'Old Man Kessler wants his money. Find the debtor in Old Town and collect. He will not come quietly.',
    stages: [
      { kind: 'reach', x: 1150, y: 400, radius: 80, text: 'Find the debtor at St. Anselm Steps' },
      { kind: 'punch', text: 'Collect the debt — punch the debtor' },
      { kind: 'reach', x: 700, y: 2600, radius: 90, text: 'Drop the cash at The Gull & Anchor' },
    ],
    reward: 800,
  },
  {
    id: 'blue-light',
    title: 'Blue Light Special',
    brief: 'The VPD knows Rook is back. Three stars, sixty seconds, one safehouse in Westfield.',
    stages: [
      { kind: 'survive', time: 60, x: 500, y: 1500, radius: 110, text: 'Lose the heat — reach the Westfield safehouse' },
    ],
    reward: 1200,
  },
  {
    id: 'long-tide',
    title: 'The Long Tide',
    brief: 'One last job: the Dockside Van, full of Kessler\'s cargo, has to reach Pier 9. The whole VPD will be on it.',
    stages: [
      { kind: 'van', x: 1850, y: 1500, radius: 100, text: 'Get the Dockside Van at Vireo Tower' },
      { kind: 'deliver', x: 2100, y: 2750, radius: 90, text: 'Deliver the van to Marina Pier 9 — stay ahead of the VPD' },
    ],
    reward: 2500,
  },
];

export function createMissions() {
  return {
    index: 0,
    stage: 0,
    stageTimer: 0,
    active: false,
    done: false,
    debtor: null,
    van: null,
    taxi: null,
    vigilante: null,
    tokens: [],
    tokensCollected: 0,
  };
}

// Scatter 20 harbor tokens (collectibles) around the city.
export function scatterTokens(rng, city) {
  const tokens = [];
  for (let i = 0; i < 20; i++) {
    const road = city.roadsV[Math.floor(rng() * city.roadsV.length)];
    tokens.push({
      x: road + (rng() < 0.5 ? -70 : 70),
      y: 120 + rng() * 2100,
      taken: false,
      bob: rng() * 6,
    });
  }
  return tokens;
}

export function startMission(world, idx) {
  const m = world.missions;
  m.index = idx;
  m.stage = 0;
  m.stageTimer = 0;
  m.active = true;
  const def = STORY[idx];
  world.radio = { text: def.title + ' — ' + def.brief, ttl: 6 };
  if (def.id === 'blue-light') addWanted(world, 3, 'mission');
  if (def.id === 'long-tide') addWanted(world, 2, 'mission');
  if (world.onMissionStart) world.onMissionStart(def);
}

export function currentStage(world) {
  const m = world.missions;
  if (!m.active) return null;
  const def = STORY[m.index];
  return def ? def.stages[m.stage] : null;
}

export function missionMarker(world) {
  const st = currentStage(world);
  if (!st) return null;
  if (st.kind === 'punch' && world.missions.debtor) {
    return { x: world.missions.debtor.x, y: world.missions.debtor.y, text: st.text };
  }
  if (st.x !== undefined) return { x: st.x, y: st.y, text: st.text, time: st.time, radius: st.radius };
  return { x: world.player.x, y: world.player.y, text: st.text };
}

function completeStage(world) {
  const m = world.missions;
  const def = STORY[m.index];
  m.stage += 1;
  m.stageTimer = 0;
  if (m.stage >= def.stages.length) {
    m.active = false;
    m.done = m.index >= STORY.length - 1;
    world.money += def.reward;
    world.radio = { text: 'Mission complete: ' + def.title + ' — +$' + def.reward, ttl: 5 };
    if (world.onMissionComplete) world.onMissionComplete(def);
    if (!m.done) {
      m.index += 1;
      world.radio = { text: 'New mission: ' + STORY[m.index].title + ' — press M to start it', ttl: 6 };
    } else {
      world.radio = { text: 'Story complete. Port Vireo is yours, Rook.', ttl: 8 };
    }
  }
}

export function updateMissions(world, dt) {
  const m = world.missions;
  const player = world.player;
  // Token pickups.
  for (const t of m.tokens) {
    if (!t.taken && dist2(player.x, player.y, t.x, t.y) < 30 * 30) {
      t.taken = true;
      m.tokensCollected += 1;
      world.money += 50;
      if (world.onPickup) world.onPickup(t.x, t.y);
    }
  }
  // Taxi fares: while driving a taxi, offer a fare.
  if (world.playerCar && world.playerCar.type === 'taxi' && !m.taxi) {
    m.taxi = { x: 900 + Math.random() * 2400, y: 300 + Math.random() * 1800, time: 75, picked: false, fare: 150 + Math.floor(Math.random() * 150) };
    world.radio = { text: 'Fare waiting — drive to the marker and pick up your passenger', ttl: 4 };
  }
  if (m.taxi) {
    m.taxi.time -= dt;
    const tx = m.taxi.picked ? m.taxi.dx : m.taxi.x;
    const ty = m.taxi.picked ? m.taxi.dy : m.taxi.y;
    if (dist2(player.x, player.y, tx, ty) < 80 * 80) {
      if (!m.taxi.picked) {
        m.taxi.picked = true;
        m.taxi.dx = 900 + Math.random() * 2400;
        m.taxi.dy = 300 + Math.random() * 1800;
        m.taxi.time = 75;
        world.radio = { text: 'Passenger aboard — get them to the destination', ttl: 3 };
      } else {
        world.money += m.taxi.fare;
        world.radio = { text: 'Fare complete — +$' + m.taxi.fare, ttl: 3 };
        m.taxi = null;
      }
    }
    if (m.taxi && m.taxi.time <= 0) { m.taxi = null; world.radio = { text: 'The fare gave up and walked away.', ttl: 3 }; }
  }
  // Vigilante: a mugger appears now and then.
  if (!m.vigilante && Math.random() < 0.0006 && world.wanted === 0) {
    m.vigilante = { x: player.x + (Math.random() < 0.5 ? -400 : 400), y: player.y + (Math.random() - 0.5) * 600, hp: 50 };
    world.radio = { text: 'Vigilante job: a mugger is shaking down a shopkeeper nearby', ttl: 4 };
  }
  if (m.vigilante) {
    const v = m.vigilante;
    if (v.hp <= 0) {
      world.money += 200;
      world.radio = { text: 'Mugger down — the shopkeeper slips you $200', ttl: 3 };
      m.vigilante = null;
    } else if (dist2(player.x, player.y, v.x, v.y) > 1200 * 1200) {
      m.vigilante = null;
    }
  }
  // Story stages.
  const st = currentStage(world);
  if (!st) return;
  m.stageTimer += dt;
  if (st.kind === 'steal') {
    if (world.playerCar) completeStage(world);
  } else if (st.kind === 'reach' || st.kind === 'deliver' || st.kind === 'van') {
    if (dist2(player.x, player.y, st.x, st.y) < (st.radius || 90) * (st.radius || 90)) {
      if (st.kind === 'van' && !world.playerCar) {
        world.radio = { text: 'You need the van — press E to get in', ttl: 2 };
        return;
      }
      completeStage(world);
    } else if (st.time && m.stageTimer > st.time) {
      m.active = false;
      world.radio = { text: 'Mission failed — too slow. Press M to retry ' + STORY[m.index].title, ttl: 5 };
    }
  } else if (st.kind === 'survive') {
    if (st.time && m.stageTimer > st.time) {
      completeStage(world);
    } else if (dist2(player.x, player.y, st.x, st.y) < (st.radius || 110) * (st.radius || 110) && world.wanted === 0) {
      completeStage(world);
    }
  } else if (st.kind === 'punch') {
    // The debtor spawns at the marker when the stage begins.
    if (!m.debtor) {
      const prev = STORY[m.index].stages[m.stage - 1];
      m.debtor = { x: prev.x, y: prev.y, hp: 50, name: 'Debtor' };
    }
  }
}

export function drawMissionMarkers(ctx, world, cam) {
  const mk = missionMarker(world);
  if (mk) {
    const sx = mk.x - cam.x, sy = mk.y - cam.y;
    const bob = Math.sin(performance.now() / 300) * 6;
    ctx.fillStyle = '#ffd23e';
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 34 + bob);
    ctx.lineTo(sx - 10, sy - 52 + bob);
    ctx.lineTo(sx + 10, sy - 52 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath(); ctx.arc(sx, sy - 8, 8, 0, Math.PI * 2); ctx.fill();
    ctx.stroke();
  }
  // Taxi marker.
  const m = world.missions;
  if (m.taxi) {
    const t = m.taxi;
    const tx = t.picked ? t.dx : t.x;
    const ty = t.picked ? t.dy : t.y;
    const sx = tx - cam.x, sy = ty - cam.y;
    ctx.fillStyle = '#e8b73a';
    ctx.beginPath(); ctx.arc(sx, sy, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', sx, sy + 5);
  }
  // Vigilante mugger.
  if (m.vigilante) {
    const sx = m.vigilante.x - cam.x, sy = m.vigilante.y - cam.y;
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', sx, sy + 4);
  }
  // Harbor tokens.
  for (const t of m.tokens) {
    if (t.taken) continue;
    const sx = t.x - cam.x, sy = t.y - cam.y;
    if (sx < -20 || sx > 1300 || sy < -20 || sy > 740) continue;
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(sx, sy + Math.sin(performance.now() / 400 + t.bob) * 3, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a6d00';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Debtor.
  if (m.debtor) {
    const sx = m.debtor.x - cam.x, sy = m.debtor.y - cam.y;
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath(); ctx.arc(sx, sy - 9, 4.5, 0, Math.PI * 2); ctx.fill();
  }
}
