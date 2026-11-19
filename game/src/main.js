// Mirage City — Desert Heat Run: entry point. Builds the world, owns the
// game state object G that every module shares, runs the loop and the
// menu / playing / paused / wasted / won state machine, and exposes a
// small debug API (window.__game) the playtest harness drives.
import { CITY, MISSIONS, AUTOSAVE_SECONDS } from './config.js';
import { SoundEngine } from './audio.js';
import { createInput, wasPressed, endFrameInput } from './input.js';
import { buildCity } from './city.js';
import { spawnParkedCars, spawnTraffic, updateTraffic } from './vehicles.js';
import { spawnPedestrians, updatePedestrians } from './pedestrians.js';
import { createPlayer, updatePlayerOnFoot, updateCamera, nearestEnterableCar, enterCar, exitCar } from './player.js';
import { updateDriving } from './driving.js';
import { addWanted, setWanted, clearWanted, updateWanted, updatePolice } from './wanted.js';
import { playerShoot, updateEnemies, clearEnemies } from './combat.js';
import { createMissionState, buildBeacon, startMission, updateMissions, objectiveText, onEnemyKilledForMission, tryStartSideJob } from './missions.js';
import { createHud, showMenu, hideMenu, updateHud } from './hud.js';
import { saveGame, loadSave, hasSave, applySave } from './save.js';

const G = {
  time: 0,
  state: 'menu', // menu | playing | paused | wasted | won
  menuKind: 'start',
  money: 0,
  wanted: 0,
  lastCrimeTime: -100,
  lastShotTime: -10,
  lastSaveAt: 0,
  nextMissionAt: 0,
  shake: 0,
  cars: [],
  cops: [],
  enemies: [],
  tracers: [],
  muzzleLight: null,
  muzzleTtl: 0,
  ammoShots: 0,
};

function init() {
  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(-80, 30, 90);

  G.renderer = renderer;
  G.scene = scene;
  G.camera = camera;
  G.input = createInput();
  G.sound = new SoundEngine();

  const { colliders } = buildCity(scene);
  G.colliders = colliders;
  G.player = createPlayer(scene);
  G.cars = [...spawnParkedCars(scene, 10), ...spawnTraffic(scene, 10)];
  G.peds = spawnPedestrians(scene, 14);
  G.mission = createMissionState();
  G.mission.beacon = buildBeacon(scene);
  G.hud = createHud(G);
  G.objectiveText = () => objectiveText(G);
  G.saveGame = () => saveGame(G);
  G.hasSave = () => hasSave();
  G.onEnemyKilled = (e) => onEnemyKilledForMission(G);
  G.addShake = (n) => { G.shake = Math.min(0.6, G.shake + n); };
  G.damagePlayer = (n, src) => damagePlayer(n, src);
  G.winGame = () => winGame();
  G.newGame = () => newGame();
  G.continueGame = () => continueGame();
  G.resumeGame = () => resumeGame();
  G.restartMission = () => restartMission();
  G.respawnAfterWasted = () => respawnAfterWasted();
  G.showMenu = (kind) => { G.state = kind === 'start' ? 'menu' : kind; showMenu(G, kind); };

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // menu backdrop: slow orbit around the casino while on the start screen
  showMenu(G, 'start');
  applyShotPreset();
  renderer.setAnimationLoop(tick);
  window.__ready = true;
}

function damagePlayer(n, src) {
  if (G.state !== 'playing') return;
  G.player.health -= n;
  G.addShake(0.25);
  if (G.player.health <= 0) {
    G.player.health = 0;
    G.state = 'wasted';
    G.sound.wasted();
    G.sound.setSiren(false);
    showMenu(G, 'wasted');
  }
}

function winGame() {
  G.state = 'won';
  clearWanted(G);
  G.sound.win();
  showMenu(G, 'win');
}

function resetWorld() {
  clearEnemies(G);
  clearWanted(G);
  if (G.mission && G.mission.beacon) G.scene.remove(G.mission.beacon);
  G.mission = createMissionState();
  G.mission.beacon = buildBeacon(G.scene);
  G.money = 0;
  G.wanted = 0;
  G.lastCrimeTime = -100;
  G.player.health = G.player.maxHealth;
  G.player.pos.set(-60, 0, 88); // on the z=88 road
  G.player.heading = Math.PI / 2;
  G.player.camYaw = Math.PI / 2;
  G.player.mesh.visible = true;
  if (G.player.inCar) { G.player.inCar.isPlayerCar = false; G.player.inCar = null; }
  G.nextMissionAt = 0;
}

function newGame() {
  resetWorld();
  hideMenu(G);
  G.state = 'playing';
  startMission(G, 0);
  saveGame(G);
}

function continueGame() {
  const d = loadSave();
  if (!d) { newGame(); return; }
  resetWorld();
  applySave(G, d);
  hideMenu(G);
  G.state = 'playing';
  startMission(G, G.mission.index);
  G.toast('Welcome back, Jax — save loaded', '#7dff8a');
}

function resumeGame() {
  hideMenu(G);
  G.state = 'playing';
}

function restartMission() {
  hideMenu(G);
  G.state = 'playing';
  clearEnemies(G);
  if (G.mission.vip) { G.scene.remove(G.mission.vip.mesh); G.mission.vip = null; }
  G.mission.sideJob = null;
  startMission(G, G.mission.index);
}

function respawnAfterWasted() {
  G.money = Math.max(0, G.money - 100);
  G.player.health = G.player.maxHealth;
  G.player.pos.set(-88, 0, 88); // hospital corner
  G.player.heading = 0;
  G.player.mesh.visible = true;
  if (G.player.inCar) { G.player.inCar.isPlayerCar = false; G.player.inCar = null; }
  clearWanted(G);
  clearEnemies(G);
  hideMenu(G);
  G.state = 'playing';
  startMission(G, G.mission.index);
  G.toast('Patched up at the Desert Clinic — $100', '#ffd27a');
}

function handleActions() {
  const input = G.input;
  if (wasPressed(input, 'KeyP') || wasPressed(input, 'Escape')) {
    if (G.state === 'playing') { G.state = 'paused'; showMenu(G, 'pause'); }
    else if (G.state === 'paused') resumeGame();
    return;
  }
  if (wasPressed(input, 'KeyM')) {
    G.sound.setMuted(!G.sound.muted);
    const b = document.getElementById('btn-mute');
    if (b) b.textContent = G.sound.muted ? '🔇 Unmute (M)' : '🔊 Mute (M)';
  }
  if (G.state !== 'playing') return;
  if (wasPressed(input, 'KeyR')) { restartMission(); return; }
  if (wasPressed(input, 'KeyE')) {
    if (G.player.inCar) { exitCar(G); return; }
    const near = nearestEnterableCar(G);
    if (near) {
      if (near.needsSteal) {
        G.toast('That car is moving — press F to steal it', '#ffd27a');
      } else {
        enterCar(G, near.car);
        G.toast('You took the car', '#fff');
      }
      return;
    }
    tryStartSideJob(G);
  }
  if (wasPressed(input, 'KeyF')) {
    if (G.player.inCar) return;
    const near = nearestEnterableCar(G);
    if (near && near.needsSteal) {
      enterCar(G, near.car);
      near.car.stolen = true;
      addWanted(G, 1, 'grand theft auto');
      G.toast('STOLEN — the cops are coming', '#ff5a5a');
    } else if (near) {
      enterCar(G, near.car);
    }
  }
  if (input.clicked && !G.player.inCar) playerShoot(G);
}

let lastT = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
  lastT = now;
  G.time += dt;

  if (G.state === 'playing') {
    handleActions();
    if (G.player.inCar) updateDriving(G, dt);
    else updatePlayerOnFoot(G, dt);
    updateTraffic(G.cars, dt, G.colliders);
    updatePedestrians(G.peds, dt, G.player.inCar ? G.player.inCar.pos : G.player.pos, G.player.inCar ? Math.abs(G.player.inCar.speed) : G.player.speed);
    updateWanted(G, dt);
    updatePolice(G, dt);
    updateEnemies(G, dt);
    updateMissions(G, dt);
    // engine hum follows speed
    const car = G.player.inCar;
    G.sound.setEngine(car ? Math.abs(car.speed) / CITY.maxSpeed : 0, !!car);
    // autosave
    if (G.time - G.lastSaveAt > AUTOSAVE_SECONDS) saveGame(G);
    updateHud(G);
  } else if (G.state === 'menu') {
    // menu backdrop: slow orbit around the Solara Grand
    const a = G.time * 0.05;
    G.camera.position.set(Math.sin(a) * 90, 34, Math.cos(a) * 90);
    G.camera.lookAt(0, 18, 0);
    updateTraffic(G.cars, dt, G.colliders);
    updatePedestrians(G.peds, dt, G.player.pos, 0);
    G.renderer.render(G.scene, G.camera);
    endFrameInput(G.input);
    return;
  }
  updateCamera(G, dt);
  // screen shake
  if (G.shake > 0.001) {
    G.camera.position.x += (Math.random() - 0.5) * G.shake;
    G.camera.position.y += (Math.random() - 0.5) * G.shake;
    G.shake *= Math.pow(0.001, dt);
  } else if (G.state !== 'playing') {
    // updateCamera already aimed the camera; menu orbit above is the view
  }
  G.renderer.render(G.scene, G.camera);
  endFrameInput(G.input);
}

// --- screenshot presets (?shot=cover|street|combat|heist) ----------------
// Real game states staged for the camera: the shots are genuine renders.
function applyShotPreset() {
  const q = new URLSearchParams(location.search).get('shot');
  if (!q) return;
  newGame();
  const P = G.player;
  if (q === 'cover') {
    // mid-chase: Jax in a stolen coupe, 3 stars, two cop cars closing in,
    // M3 timed delivery objective on the HUD.
    const car = G.cars.find((c) => c.isParked);
    if (car) {
      P.pos.set(car.pos.x + 2, 0, car.pos.z);
      enterCar(G, car);
      car.pos.set(-60, 0, 44); // on the z=44 road, heading east toward the casino
      car.heading = Math.PI / 2;
      car.speed = 18;
    }
    G.mission.index = 2; G.mission.step = 0;
    startMission(G, 2);
    setWanted(G, 3);
    G.cops.forEach((cop, i) => {
      if (i === 0) {
        // roadblock ahead, head-on — visible in the cover frame
        cop.pos.set(P.inCar.pos.x + 45, 0, 44);
        cop.heading = -Math.PI / 2;
      } else {
        cop.pos.set(P.inCar.pos.x - 30 - (i - 1) * 8, 0, 44);
        cop.heading = Math.PI / 2;
      }
    });
    G.money = 1240;
  } else if (q === 'street') {
    // at the (-44,-44) intersection, facing the Solara Grand diagonally;
    // the camera sits inside the intersection too, clear of all buildings
    P.pos.set(-44, 0, -44);
    P.heading = Math.PI / 4;
    P.camYaw = 5 * Math.PI / 4;
    G.mission.index = 0;
    startMission(G, 0);
  } else if (q === 'combat') {
    G.mission.index = 3;
    startMission(G, 3);
    // stand on the junkyard beacon so the kill step (and its enemies) trigger
    P.pos.set(-44, 0, 136);
    P.heading = Math.PI;
    P.camYaw = Math.PI;
    G.money = 860;
  } else if (q === 'heist') {
    G.mission.index = 5;
    startMission(G, 5);
    // jump to the escape step: vault cleared, 3 stars, run for the safehouse
    G.mission.step = 3;
    G.mission.beacon.position.set(-132, 0, 132);
    G.mission.beacon.visible = true;
    setWanted(G, 3);
    const car = G.cars.find((c) => c.isParked);
    if (car) {
      P.pos.set(car.pos.x + 2, 0, car.pos.z);
      enterCar(G, car);
      car.pos.set(44, 0, -40); // on the x=44 road
      car.heading = Math.PI;
      car.speed = 22;
    }
    G.money = 4860;
  }
}

// --- debug / playtest API -------------------------------------------------
window.__game = {
  G,
  state: () => ({
    state: G.state,
    money: G.money,
    wanted: G.wanted,
    health: Math.round(G.player.health),
    missionIndex: G.mission.index,
    missionStep: G.mission.step,
    missionActive: G.mission.active,
    missionDone: G.mission.done,
    inCar: !!G.player.inCar,
    carSpeed: G.player.inCar ? Math.round(G.player.inCar.speed * 10) / 10 : 0,
    pos: [Math.round(G.player.pos.x), Math.round(G.player.pos.z)],
    enemiesAlive: G.enemies.filter((e) => e.alive).length,
    cops: G.cops.length,
    traffic: G.cars.filter((c) => c.isTraffic).length,
    peds: G.peds.length,
    timeLeft: Math.round(G.mission.timeLeft),
  }),
  newGame,
  continueGame,
  teleport: (x, z) => {
    const car = G.player.inCar;
    if (car) { car.pos.set(x, 0, z); car.speed = 0; }
    else G.player.pos.set(x, 0, z);
  },
  setWanted: (n) => setWanted(G, n),
  setMoney: (n) => { G.money = n; },
  startMission: (i) => startMission(G, i),
  damagePlayer: (n) => damagePlayer(n, 'debug'),
  enterNearestCar: () => {
    const near = nearestEnterableCar(G, 30);
    if (near) { enterCar(G, near.car); return true; }
    return false;
  },
  stealNearestTraffic: () => {
    const near = G.cars.filter((c) => c.isTraffic)
      .map((c) => ({ c, d: Math.hypot(c.pos.x - G.player.pos.x, c.pos.z - G.player.pos.z) }))
      .sort((a, b) => a.d - b.d)[0];
    if (!near) return false;
    G.player.pos.set(near.c.pos.x + 2, 0, near.c.pos.z);
    enterCar(G, near.c);
    near.c.stolen = true;
    addWanted(G, 1, 'grand theft auto');
    return true;
  },
  shootAt: (enemyIndex = 0) => {
    const e = G.enemies.filter((x) => x.alive)[enemyIndex];
    if (!e) return false;
    // aim the camera at the enemy and fire for real
    G.camera.lookAt(e.pos.x, e.pos.y + 1.2, e.pos.z);
    G.lastShotTime = -10;
    playerShoot(G);
    return true;
  },
};

init();
