// Missions: the six-job delivery chain (M1–M6) plus repeatable taxi and
// courier side jobs. A mission is a list of steps; each step is a beacon
// the player reaches, a kill count, or a hold-in-place. Completing a step
// pays out and advances the story; M6's escape ends the game in a win.
import { MISSIONS, SIDE_JOBS } from './config.js';
import { spawnEnemy, clearEnemies } from './combat.js';
import { makeSpecialPed } from './pedestrians.js';
import { setWanted } from './wanted.js';

export function createMissionState() {
  return {
    index: 0,          // current mission in MISSIONS
    step: 0,           // current step inside the mission
    kills: 0,          // kills in the current kill step
    holdT: 0,          // hold-step progress
    timeLeft: 0,       // timed mission countdown
    active: false,
    done: false,       // whole chain complete
    sideJob: null,     // { kind, phase, x, z, reward }
    beacon: null,      // THREE.Group marker in the world
    vip: null,         // mission pedestrian (M5)
  };
}

export function buildBeacon(scene) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.6, 2.4, 24),
    new THREE.MeshBasicMaterial({ color: 0xffc300, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  g.add(ring);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 60, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffc300, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = 30;
  g.add(beam);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.55),
    new THREE.MeshBasicMaterial({ color: 0xffc300 })
  );
  diamond.position.y = 3.5;
  g.add(diamond);
  g.userData.diamond = diamond;
  g.visible = false;
  scene.add(g);
  return g;
}

export function currentMission(G) {
  return MISSIONS[G.mission.index] || null;
}

export function currentStep(G) {
  const m = currentMission(G);
  return m ? m.steps[G.mission.step] : null;
}

export function startMission(G, index) {
  const m = MISSIONS[index];
  if (!m) return;
  G.mission.index = index;
  G.mission.step = 0;
  G.mission.kills = 0;
  G.mission.holdT = 0;
  G.mission.active = true;
  G.mission.timeLeft = m.timeLimit || 0;
  clearEnemies(G);
  G.toast(`${m.id} — ${m.title}`, '#ffc300');
  G.showBriefing(m.title, m.briefing);
  G.sound.cash();
  placeBeaconForStep(G);
}

function placeBeaconForStep(G) {
  const step = currentStep(G);
  if (!step) { G.mission.beacon.visible = false; return; }
  G.mission.beacon.position.set(step.x, 0, step.z);
  G.mission.beacon.visible = true;
  if (step.type === 'kill') {
    const n = step.count;
    for (let i = 0; i < n; i++) {
      spawnEnemy(G, step.x + (Math.random() * 2 - 1) * 12, step.z + (Math.random() * 2 - 1) * 12);
    }
  }
  if (step.type === 'escape') setWanted(G, step.wanted || 3);
}

function advanceStep(G) {
  const m = currentMission(G);
  G.mission.step++;
  G.mission.kills = 0;
  G.mission.holdT = 0;
  if (G.mission.step >= m.steps.length) {
    completeMission(G, m);
  } else {
    G.sound.pickup();
    placeBeaconForStep(G);
  }
}

function completeMission(G, m) {
  G.money += m.reward;
  G.mission.active = false;
  G.mission.beacon.visible = false;
  clearEnemies(G);
  if (G.mission.vip) { G.scene.remove(G.mission.vip.mesh); G.mission.vip = null; }
  G.toast(`${m.id} complete — +$${m.reward}`, '#7dff8a');
  G.sound.cash();
  if (G.mission.index >= MISSIONS.length - 1) {
    G.mission.done = true;
    G.saveGame();
    G.winGame();
  } else {
    G.mission.index++;
    G.saveGame();
    // next mission starts when the player reaches its first beacon: auto-start
    // after a short breather so the chain feels continuous.
    G.nextMissionAt = G.time + 2.5;
  }
}

export function objectiveText(G) {
  if (G.mission.sideJob) {
    const j = G.mission.sideJob;
    if (j.phase === 'pickup') return `${j.kind === 'taxi' ? 'Taxi fare' : 'Courier run'}: pick up ${j.kind === 'taxi' ? 'the passenger' : 'the parcel'}`;
    return `${j.kind === 'taxi' ? 'Taxi fare' : 'Courier run'}: drop off at the marker ($${j.reward})`;
  }
  const m = currentMission(G);
  if (!m) return 'Solara is yours — free roam';
  if (!G.mission.active) return `${m.id} ${m.title} — starting…`;
  const step = currentStep(G);
  if (!step) return '';
  let label = step.label;
  if (step.type === 'kill') label = label.replace(/\(\d+\/\d+\)/, `(${G.mission.kills}/${step.count})`);
  if (m.timeLimit) label += ` — ${Math.max(0, Math.ceil(G.mission.timeLeft))}s`;
  return `${m.id} ${m.title}: ${label}`;
}

export function updateMissions(G, dt) {
  // breather between missions
  if (G.nextMissionAt && G.time >= G.nextMissionAt) {
    G.nextMissionAt = 0;
    startMission(G, G.mission.index);
  }
  // side-job beacon handling
  if (G.mission.sideJob) {
    const j = G.mission.sideJob;
    const p = G.player.inCar ? G.player.inCar.pos : G.player.pos;
    const d = Math.hypot(p.x - j.x, p.z - j.z);
    if (d < 5) {
      if (j.phase === 'pickup') {
        j.phase = 'dropoff';
        j.x = j.dropX; j.z = j.dropZ;
        G.mission.beacon.position.set(j.x, 0, j.z);
        G.sound.pickup();
        if (j.kind === 'taxi' && j.customer) {
          j.customer.isCustomer = false;
          G.scene.remove(j.customer.mesh);
          j.customer = null;
          G.toast('Passenger aboard — drive to the marker', '#ffd27a');
        } else {
          G.toast('Parcel collected — deliver it', '#ffd27a');
        }
      } else {
        G.money += j.reward;
        G.toast(`${j.kind === 'taxi' ? 'Fare' : 'Delivery'} complete — +$${j.reward}`, '#7dff8a');
        G.sound.cash();
        G.mission.sideJob = null;
        G.mission.beacon.visible = false;
        G.saveGame();
      }
    }
    return;
  }
  if (!G.mission.active) return;
  const m = currentMission(G);
  const step = currentStep(G);
  if (!step) return;
  // mission timer
  if (m.timeLimit) {
    G.mission.timeLeft -= dt;
    if (G.mission.timeLeft <= 0) {
      G.toast(`${m.id} failed — out of time. Restarting ${m.id}…`, '#ff5a5a');
      G.sound.wasted();
      startMission(G, G.mission.index);
      return;
    }
  }
  const p = G.player.inCar ? G.player.inCar.pos : G.player.pos;
  const d = Math.hypot(p.x - step.x, p.z - step.z);
  if (step.type === 'goto') {
    if (d < 5) {
      if (m.id === 'M5' && G.mission.step === 0 && !G.mission.vip) {
        // pick up the VIP: he stands at the hotel until collected
        G.mission.vip = makeSpecialPed(G.scene, step.x + 2, step.z + 2, 0x2e7ad8);
        G.mission.vip.isVIP = true;
        G.toast('The VIP is waiting — walk up to him', '#ffd27a');
        return;
      }
      if (m.id === 'M5' && G.mission.step === 0 && G.mission.vip) {
        const vd = Math.hypot(p.x - G.mission.vip.pos.x, p.z - G.mission.vip.pos.z);
        if (vd > 4) return; // must actually reach the VIP on foot
        G.scene.remove(G.mission.vip.mesh);
        G.mission.vip = null;
        G.toast('VIP aboard — drive him to the Solara Grand', '#ffd27a');
      }
      advanceStep(G);
    }
  } else if (step.type === 'kill') {
    if (G.mission.kills >= step.count) advanceStep(G);
  } else if (step.type === 'hold') {
    if (d < 5) {
      G.mission.holdT += dt;
      if (G.mission.holdT >= step.holdSeconds) advanceStep(G);
    } else {
      G.mission.holdT = Math.max(0, G.mission.holdT - dt);
    }
  } else if (step.type === 'escape') {
    if (d < 6) {
      G.toast('You made it — the heat can\'t touch you here', '#7dff8a');
      advanceStep(G);
    }
  }
  // beacon spin
  if (G.mission.beacon.visible) {
    G.mission.beacon.userData.diamond.rotation.y += dt * 2;
    G.mission.beacon.userData.diamond.position.y = 3.5 + Math.sin(G.time * 2) * 0.4;
  }
}

export function onEnemyKilledForMission(G) {
  const step = currentStep(G);
  if (G.mission.active && step && step.type === 'kill') {
    G.mission.kills++;
  }
}

// Start a repeatable side job from the nearest side-job stand.
export function tryStartSideJob(G) {
  if (G.mission.sideJob || !G.mission.active) return false;
  const p = G.player.inCar ? G.player.inCar.pos : G.player.pos;
  // taxi stand at the casino plaza edge (on the z=44 road), courier stand at the market
  const stands = [
    { kind: 'taxi', x: 30, z: 44, px: 30, pz: 44 },
    { kind: 'courier', x: -44, z: 44, px: -44, pz: 44 },
  ];
  for (const s of stands) {
    if (Math.hypot(p.x - s.x, p.z - s.z) < 6) {
      const def = SIDE_JOBS[s.kind];
      const reward = def.rewardMin + Math.floor(Math.random() * (def.rewardMax - def.rewardMin));
      const dropX = (Math.floor(Math.random() * 9) - 4) * 44;
      const dropZ = (Math.floor(Math.random() * 9) - 4) * 44;
      const job = { kind: s.kind, phase: 'pickup', x: s.px, z: s.pz, dropX, dropZ, reward, customer: null };
      if (s.kind === 'taxi') {
        job.customer = makeSpecialPed(G.scene, s.px + 2, s.pz, 0x8ae85a);
        job.customer.isCustomer = true;
      }
      G.mission.sideJob = job;
      G.mission.beacon.position.set(job.x, 0, job.z);
      G.mission.beacon.visible = true;
      G.toast(`${s.kind === 'taxi' ? 'Taxi fare' : 'Courier run'} started — $${reward} on delivery`, '#ffd27a');
      return true;
    }
  }
  return false;
}
