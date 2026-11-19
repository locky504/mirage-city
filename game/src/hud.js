// HUD + menus: the circular minimap (canvas), wanted stars, health bar,
// money, objective banner, toasts, and the start / pause / WASTED / win
// screens. All DOM lives in index.html; this module wires it up.
import { CITY, STAR_NAMES } from './config.js';

export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  const hud = {
    root: $('hud'), minimap: $('minimap'), stars: $('stars'),
    healthFill: $('health-fill'), money: $('money'), objective: $('objective'),
    speed: $('speed'), toast: $('toast'), timer: $('timer'),
    menu: $('menu'), menuTitle: $('menu-title'), menuSub: $('menu-sub'),
    briefing: $('briefing'), briefingTitle: $('briefing-title'), briefingText: $('briefing-text'),
    ctx: $('minimap').getContext('2d'),
    toastTimer: null,
  };

  G.toast = (text, color = '#fff') => {
    hud.toast.textContent = text;
    hud.toast.style.color = color;
    hud.toast.style.opacity = '1';
    clearTimeout(hud.toastTimer);
    hud.toastTimer = setTimeout(() => { hud.toast.style.opacity = '0'; }, 3200);
  };

  G.showBriefing = (title, text) => {
    hud.briefingTitle.textContent = title;
    hud.briefingText.textContent = text;
    hud.briefing.style.opacity = '1';
    clearTimeout(G._briefingTimer);
    G._briefingTimer = setTimeout(() => { hud.briefing.style.opacity = '0'; }, 6000);
  };

  // menu buttons
  $('btn-new').addEventListener('click', () => { G.sound.init(); G.newGame(); });
  $('btn-continue').addEventListener('click', () => { G.sound.init(); G.continueGame(); });
  $('btn-resume').addEventListener('click', () => { G.sound.init(); G.resumeGame(); });
  $('btn-restart-mission').addEventListener('click', () => { G.sound.init(); G.restartMission(); });
  $('btn-quit-menu').addEventListener('click', () => { G.showMenu('start'); });
  $('btn-respawn').addEventListener('click', () => { G.sound.init(); G.respawnAfterWasted(); });
  $('btn-again').addEventListener('click', () => { G.sound.init(); G.newGame(); });
  $('btn-mute').addEventListener('click', () => {
    G.sound.init();
    G.sound.setMuted(!G.sound.muted);
    $('btn-mute').textContent = G.sound.muted ? '🔇 Unmute (M)' : '🔊 Mute (M)';
  });
  // any first click also unlocks audio
  document.addEventListener('pointerdown', () => G.sound.init(), { once: true });

  return hud;
}

export function showMenu(G, kind) {
  const h = G.hud;
  const m = h.menu;
  m.style.display = 'flex';
  const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? 'block' : 'none'; };
  show('btn-new', kind === 'start');
  show('btn-continue', kind === 'start' && G.hasSave());
  show('btn-resume', kind === 'pause');
  show('btn-restart-mission', kind === 'pause');
  show('btn-quit-menu', kind === 'pause');
  show('btn-respawn', kind === 'wasted');
  show('btn-again', kind === 'win');
  const titles = {
    start: ['MIRAGE CITY', 'Desert Heat Run — Solara, a casino city at dusk. Courier by day, wheelman by night.'],
    pause: ['PAUSED', 'Take a breath, Jax. The desert waits.'],
    wasted: ['WASTED', 'The Solara sun sets on Jax Moreno… for now.'],
    win: ['SOLARA HEAT — YOU WIN', 'The vault is empty, the cops are lost, and Jax Moreno owns the night.'],
  };
  const [t, s] = titles[kind] || titles.start;
  h.menuTitle.textContent = t;
  h.menuSub.textContent = s;
  if (kind === 'win') {
    h.menuSub.textContent += ` Final take: $${G.money}. Missions: 6/6.`;
  }
  if (kind === 'wasted') {
    h.menuSub.textContent += ` You lost $100 in hospital bills.`;
  }
  G.menuKind = kind;
}

export function hideMenu(G) {
  G.hud.menu.style.display = 'none';
  G.menuKind = null;
}

export function updateHud(G) {
  const h = G.hud;
  // stars
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < G.wanted ? '★' : '☆';
  h.stars.textContent = stars;
  h.stars.style.color = G.wanted > 0 ? '#ff5a5a' : '#ffd27a';
  h.stars.title = STAR_NAMES[G.wanted];
  // health
  const hp = Math.max(0, Math.round(G.player.health));
  h.healthFill.style.width = hp + '%';
  h.healthFill.style.background = hp > 50 ? '#7dff8a' : hp > 25 ? '#ffc300' : '#ff5a5a';
  // money / objective / speed
  h.money.textContent = '$' + G.money;
  h.objective.textContent = G.objectiveText();
  const car = G.player.inCar;
  h.speed.style.display = car ? 'block' : 'none';
  if (car) h.speed.textContent = Math.round(Math.abs(car.speed) * 2.2) + ' mph';
  // mission timer
  const m = G.mission;
  h.timer.style.display = (m.active && m.timeLeft > 0) ? 'block' : 'none';
  if (m.active && m.timeLeft > 0) {
    h.timer.textContent = '⏱ ' + Math.max(0, Math.ceil(m.timeLeft)) + 's';
    h.timer.style.color = m.timeLeft < 20 ? '#ff5a5a' : '#fff';
  }
  drawMinimap(G);
}

function drawMinimap(G) {
  const c = G.hud.ctx;
  const S = 168, C = S / 2;
  const scale = S / (CITY.halfSize * 2 + 40);
  c.clearRect(0, 0, S, S);
  // circular clip
  c.save();
  c.beginPath();
  c.arc(C, C, C - 2, 0, Math.PI * 2);
  c.clip();
  // sand background
  c.fillStyle = '#3a2a1e';
  c.fillRect(0, 0, S, S);
  // roads
  c.strokeStyle = 'rgba(200,200,210,0.5)';
  c.lineWidth = 2;
  for (let k = -4; k <= 4; k++) {
    const p = C + k * CITY.block * scale;
    c.beginPath(); c.moveTo(p, 0); c.lineTo(p, S); c.stroke();
    c.beginPath(); c.moveTo(0, p); c.lineTo(S, p); c.stroke();
  }
  const dot = (x, z, color, r) => {
    c.fillStyle = color;
    c.beginPath();
    c.arc(C + x * scale, C + z * scale, r, 0, Math.PI * 2);
    c.fill();
  };
  // casino
  dot(0, 0, '#ff2d78', 5);
  // mission beacon
  if (G.mission.beacon && G.mission.beacon.visible) {
    const b = G.mission.beacon.position;
    const pulse = 4 + Math.sin(G.time * 5) * 1.5;
    dot(b.x, b.z, '#ffc300', pulse);
    c.strokeStyle = '#ffc300';
    c.beginPath();
    c.arc(C + b.x * scale, C + b.z * scale, pulse + 3, 0, Math.PI * 2);
    c.stroke();
  }
  // traffic (white) and enemies (red)
  for (const car of G.cars) {
    if (car.isCop) continue;
    if (car.isTraffic) dot(car.pos.x, car.pos.z, '#dddddd', 2);
  }
  for (const e of G.enemies) if (e.alive) dot(e.pos.x, e.pos.z, '#ff3333', 2.5);
  // cops flashing
  const copColor = Math.sin(G.time * 8) > 0 ? '#ff2222' : '#3388ff';
  for (const cop of G.cops) dot(cop.pos.x, cop.pos.z, copColor, 3);
  // player arrow (always centred on the map is nicer, but a moving dot
  // shows position in the city — draw the player as a triangle)
  const p = G.player.inCar ? G.player.inCar.pos : G.player.pos;
  const px = C + p.x * scale, py = C + p.z * scale;
  const heading = G.player.inCar ? G.player.inCar.heading : G.player.heading;
  c.fillStyle = '#ffffff';
  c.save();
  c.translate(px, py);
  c.rotate(heading);
  c.beginPath();
  c.moveTo(0, -6); c.lineTo(4.5, 5); c.lineTo(-4.5, 5); c.closePath();
  c.fill();
  c.restore();
  c.restore();
  // ring border
  c.strokeStyle = 'rgba(255,255,255,0.35)';
  c.lineWidth = 2;
  c.beginPath();
  c.arc(C, C, C - 2, 0, Math.PI * 2);
  c.stroke();
}
