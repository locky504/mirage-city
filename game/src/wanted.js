// Wanted system: 0–5 stars, police cars that spawn at the city edge and
// chase the player, ramming on foot and in a car. Stars decay when the
// player lays low; stealing a car or shooting adds stars immediately.
import { CITY, COP_COUNT_BY_STARS, WANTED_DECAY_SECONDS } from './config.js';
import { spawnCar } from './vehicles.js';
import { resolveCircleColliders } from './city.js';

export function addWanted(G, n, reason) {
  const before = G.wanted;
  G.wanted = Math.max(0, Math.min(5, G.wanted + n));
  if (G.wanted > before) {
    G.lastCrimeTime = G.time;
    G.toast(`WANTED +${G.wanted - before} ★ — ${reason}`, '#ff5a5a');
    G.sound.horn();
  }
  syncPolice(G);
  return G.wanted;
}

export function setWanted(G, n) {
  G.wanted = Math.max(0, Math.min(5, n));
  G.lastCrimeTime = G.time;
  syncPolice(G);
}

export function clearWanted(G) {
  G.wanted = 0;
  for (const cop of G.cops) {
    G.scene.remove(cop.mesh);
    const i = G.cars.indexOf(cop);
    if (i >= 0) G.cars.splice(i, 1);
  }
  G.cops = [];
  G.sound.setSiren(false);
}

function makeCopCar(G, x, z) {
  const car = spawnCar(G.scene, x, z, 0, 'sedan');
  // black-and-white police livery
  car.mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(2.02, 0.2, 4.42),
    new THREE.MeshLambertMaterial({ color: 0xf0f0f0 })
  );
  stripe.position.y = 0.62;
  car.mesh.add(stripe);
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.18, 0.4),
    new THREE.MeshBasicMaterial({ color: 0xff2222 })
  );
  bar.position.set(0, 1.45, -0.2);
  car.mesh.add(bar);
  car.isCop = true;
  car.isTraffic = false;
  car.lightBar = bar;
  car.sirenPhase = Math.random() * 10;
  return car;
}

// Keep the number of cop cars in the world equal to the wanted level.
export function syncPolice(G) {
  const want = COP_COUNT_BY_STARS[G.wanted] || 0;
  while (G.cops.length < want) {
    const a = Math.random() * Math.PI * 2;
    const px = G.player.pos.x, pz = G.player.pos.z;
    const x = Math.max(-CITY.halfSize + 10, Math.min(CITY.halfSize - 10, px + Math.cos(a) * 70));
    const z = Math.max(-CITY.halfSize + 10, Math.min(CITY.halfSize - 10, pz + Math.sin(a) * 70));
    const cop = makeCopCar(G, x, z);
    G.cops.push(cop);
    G.cars.push(cop);
  }
  while (G.cops.length > want) {
    const cop = G.cops.pop();
    G.scene.remove(cop.mesh);
    const i = G.cars.indexOf(cop);
    if (i >= 0) G.cars.splice(i, 1);
  }
  G.sound.setSiren(G.wanted > 0);
}

export function updateWanted(G, dt) {
  // decay: lay low with no crime and no cop close by
  if (G.wanted > 0 && G.time - G.lastCrimeTime > WANTED_DECAY_SECONDS) {
    let copNear = false;
    for (const cop of G.cops) {
      if (Math.hypot(cop.pos.x - G.player.pos.x, cop.pos.z - G.player.pos.z) < 35) { copNear = true; break; }
    }
    if (!copNear) {
      G.wanted = Math.max(0, G.wanted - 1);
      G.lastCrimeTime = G.time;
      G.toast(`Heat cooling off — ${G.wanted} ★`, '#ffd27a');
      syncPolice(G);
    }
  }
}

export function updatePolice(G, dt) {
  const target = G.player.inCar ? G.player.inCar.pos : G.player.pos;
  for (const cop of G.cops) {
    const dx = target.x - cop.pos.x, dz = target.z - cop.pos.z;
    const dist = Math.hypot(dx, dz);
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - cop.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const turnRate = dist < 8 ? 2.6 : 1.7;
    cop.heading += Math.max(-turnRate * dt, Math.min(turnRate * dt, dh));
    const speed = dist > 60 ? CITY.copSpeed : CITY.copSpeed * 0.92;
    cop.speed = speed;
    cop.pos.x += Math.sin(cop.heading) * cop.speed * dt;
    cop.pos.z += Math.cos(cop.heading) * cop.speed * dt;
    // don't drive through buildings
    const beforeX = cop.pos.x, beforeZ = cop.pos.z;
    resolveCircleColliders(cop.pos, 1.7, G.colliders);
    if (Math.hypot(cop.pos.x - beforeX, cop.pos.z - beforeZ) > 0.01) cop.speed *= 0.6;
    cop.mesh.position.copy(cop.pos);
    cop.mesh.rotation.y = cop.heading;
    for (const w of cop.mesh.userData.wheels) w.rotation.x += (cop.speed * dt) / 0.38;
    // flashing light bar
    cop.sirenPhase += dt * 8;
    cop.lightBar.material.color.setHex(Math.sin(cop.sirenPhase) > 0 ? 0xff2222 : 0x2255ff);
    // ram the player (with a cooldown so a cop can't glue itself to the car
    // and drain all its speed — it hits, then falls back and chases again)
    if (dist < 3.4 && G.time - (cop.lastRam || 0) > 1.2) {
      cop.lastRam = G.time;
      if (G.player.inCar) {
        G.player.inCar.speed *= 0.55;
        G.addShake(0.35);
        G.sound.crash();
        cop.speed *= 0.5;
        cop.pos.x -= Math.sin(cop.heading) * 3;
        cop.pos.z -= Math.cos(cop.heading) * 3;
      } else if (G.time - (cop.lastHit || 0) > 1.0) {
        cop.lastHit = G.time;
        G.damagePlayer(12, 'police');
        // shove the player away from the car
        G.player.pos.x += (G.player.pos.x - cop.pos.x) * 0.4;
        G.player.pos.z += (G.player.pos.z - cop.pos.z) * 0.4;
        G.addShake(0.3);
        G.sound.crash();
      }
    }
  }
}
