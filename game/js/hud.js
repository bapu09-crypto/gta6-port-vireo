// HUD: money, health, wanted stars, minimap, mission panel, vehicle info,
// speedometer, clock, radio banners, and the title / pause / busted screens.
import { CITY_NAME, WORLD_W, WORLD_H, clamp } from './config.js';
import { STORY, currentStage, missionMarker } from './missions.js';
import { districtAt } from './city.js';

const MM_W = 190, MM_H = 132;

export function drawMinimap(ctx, world, city, x, y) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,20,0.82)';
  ctx.fillRect(x, y, MM_W, MM_H);
  ctx.strokeStyle = '#5f7a99';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, MM_W, MM_H);
  const sx = MM_W / WORLD_W, sy = MM_H / WORLD_H;
  // Roads.
  ctx.strokeStyle = '#8a8a92';
  ctx.lineWidth = 1;
  for (const rx of city.roadsV) {
    ctx.beginPath(); ctx.moveTo(x + rx * sx, y); ctx.lineTo(x + rx * sx, y + (WORLD_H - 700) * sy); ctx.stroke();
  }
  for (const ry of city.roadsH) {
    ctx.beginPath(); ctx.moveTo(x, y + ry * sy); ctx.lineTo(x + WORLD_W * sx, y + ry * sy); ctx.stroke();
  }
  // Water.
  ctx.fillStyle = '#2b6d8f';
  ctx.fillRect(x, y + (WORLD_H - 700) * sy, MM_W, 700 * sy);
  // Mission marker.
  const mk = missionMarker(world);
  if (mk) {
    const blink = Math.sin(performance.now() / 250) > 0;
    ctx.fillStyle = blink ? '#ffd23e' : '#ff9d2e';
    ctx.beginPath(); ctx.arc(x + mk.x * sx, y + mk.y * sy, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Police dots.
  ctx.fillStyle = '#ff3b30';
  for (const c of world.policeCars) { ctx.fillRect(x + c.x * sx - 2, y + c.y * sy - 2, 4, 4); }
  for (const c of world.cops) { ctx.fillRect(x + c.x * sx - 2, y + c.y * sy - 2, 4, 4); }
  // Player arrow.
  const px = x + world.player.x * sx, py = y + world.player.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(world.player.angle || 0);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  // Viewport box.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.strokeRect(x + world.cam.x * sx, y + world.cam.y * sy, 1280 * sx, 720 * sy);
  ctx.restore();
}

function drawStars(ctx, wanted, x, y) {
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < wanted ? '#ffd23e' : 'rgba(255,255,255,0.25)';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    const cx = x + i * 32;
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k * 4 * Math.PI) / 5;
      const r = k % 2 === 0 ? 12 : 5;
      const px = cx + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

export function drawHud(ctx, world, city) {
  const W = 1280, H = 720;
  const player = world.player;
  // Money and health, top left.
  ctx.textAlign = 'left';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(14, 12, 240, 66);
  ctx.fillStyle = '#7ee787';
  ctx.fillText('$' + world.money.toLocaleString('en-US'), 24, 40);
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(24, 50, 200, 12);
  ctx.fillStyle = player.health > 30 ? '#7ee787' : '#ff5a4e';
  ctx.fillRect(24, 50, 200 * clamp(player.health / 100, 0, 1), 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.strokeRect(24, 50, 200, 12);
  // Wanted stars, top center.
  drawStars(ctx, world.wanted, W / 2 - 80, 34);
  // District + clock, under the stars.
  const d = districtAt(city, player.x, player.y);
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2ead8';
  const hours = Math.floor(world.clock / 60) % 24;
  const mins = Math.floor(world.clock % 60);
  const clockStr = String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
  ctx.fillText(d.name + '  •  ' + clockStr + (world.raining ? '  •  RAIN' : ''), W / 2, 62);
  // Minimap, top right.
  drawMinimap(ctx, world, city, W - MM_W - 14, 12);
  // Mission panel, bottom center-left.
  const st = currentStage(world);
  if (st) {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(14, H - 92, 430, 78);
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(STORY[world.missions.index].title.toUpperCase(), 26, H - 66);
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px sans-serif';
    ctx.fillText(st.text, 26, H - 44);
    if (st.time) {
      const left = Math.max(0, st.time - world.missions.stageTimer);
      ctx.fillStyle = left < 15 ? '#ff5a4e' : '#ffd23e';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(Math.ceil(left) + 's', 26, H - 22);
    }
  } else if (world.missions.done) {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(14, H - 92, 430, 48);
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('STORY COMPLETE — Port Vireo is yours.', 26, H - 62);
  } else {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(14, H - 92, 430, 48);
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px sans-serif';
    ctx.fillText('Press M to start the next mission: ' + STORY[world.missions.index].title, 26, H - 62);
  }
  // Vehicle panel, bottom right.
  if (world.playerCar) {
    const car = world.playerCar;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(W - 260, H - 92, 246, 78);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(car.def.name, W - 26, H - 64);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#c9c9c9';
    const mph = Math.round(Math.abs(car.speed) * 0.12);
    ctx.fillText(mph + ' mph  •  ' + (world.ammo) + ' rounds', W - 26, H - 40);
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(W - 236, H - 30, 210, 10);
    ctx.fillStyle = car.condition > 30 ? '#7ee787' : '#ff5a4e';
    ctx.fillRect(W - 236, H - 30, 210 * clamp(car.condition / 100, 0, 1), 10);
  } else {
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(W - 260, H - 92, 246, 78);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('ON FOOT', W - 26, H - 64);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#c9c9c9';
    ctx.fillText('E — steal car    F — punch', W - 26, H - 42);
    ctx.fillText('Click — shoot (' + world.ammo + ' rounds)', W - 26, H - 22);
  }
  // Radio banner.
  if (world.radio && world.radio.ttl > 0) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px sans-serif';
    const tw = ctx.measureText(world.radio.text).width + 28;
    ctx.fillStyle = 'rgba(10,20,40,0.78)';
    ctx.fillRect(W / 2 - tw / 2, 84, tw, 30);
    ctx.fillStyle = '#9ecfff';
    ctx.fillText(world.radio.text, W / 2, 105);
  }
  // Context hint, bottom center.
  if (world.hint) {
    ctx.textAlign = 'center';
    ctx.font = '15px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(world.hint, W / 2, H - 8);
  }
}

export function drawTitleScreen(ctx, world, hasSave) {
  ctx.fillStyle = '#0e1a2b';
  ctx.fillRect(0, 0, 1280, 720);
  // Sun-soaked skyline silhouette.
  ctx.fillStyle = '#f2a541';
  ctx.beginPath(); ctx.arc(1040, 150, 70, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#13273f';
  const skyline = [120, 200, 150, 260, 180, 300, 140, 220, 260, 170, 240, 190];
  let x = 0;
  for (const h of skyline) {
    ctx.fillRect(x, 560 - h, 110, h);
    x += 112;
  }
  ctx.fillStyle = '#1d3a5c';
  ctx.fillRect(0, 560, 1280, 160);
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath(); ctx.arc(640, 470, 26, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2ead8';
  ctx.font = 'bold 84px Georgia, serif';
  ctx.fillText('PORT VIREO', 640, 240);
  ctx.font = '24px Georgia, serif';
  ctx.fillStyle = '#f2a541';
  ctx.fillText('A Rook Calloway story', 640, 290);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#c9c9c9';
  ctx.fillText('WASD move  •  E steal / enter car  •  F punch  •  Click shoot  •  M mission  •  P pause', 640, 380);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  const blink = Math.sin(performance.now() / 400) > 0;
  if (blink) ctx.fillText(hasSave ? 'ENTER — Continue    N — New game' : 'Press ENTER to start', 640, 430);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#8a94a6';
  ctx.fillText('An original game. No real places, brands or franchises.', 640, 680);
}

export function drawPauseScreen(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2ead8';
  ctx.font = 'bold 56px Georgia, serif';
  ctx.fillText('PAUSED', 640, 320);
  ctx.font = '20px sans-serif';
  ctx.fillStyle = '#c9c9c9';
  ctx.fillText('P — resume    M — mute sound    R — restart from save', 640, 370);
}

export function drawEndScreen(ctx, kind, money) {
  ctx.fillStyle = kind === 'busted' ? 'rgba(10,20,60,0.75)' : 'rgba(60,10,10,0.75)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2ead8';
  ctx.font = 'bold 72px Georgia, serif';
  ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', 640, 320);
  ctx.font = '22px sans-serif';
  ctx.fillStyle = '#c9c9c9';
  ctx.fillText(kind === 'busted'
    ? 'The VPD took you in. You lost $' + money + ' in fines.'
    : 'Rook went down. The harbor keeps its secrets.', 640, 370);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('Press ENTER to get back on your feet', 640, 430);
}
