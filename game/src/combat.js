// Pistol combat: click to fire a raycast shot from the camera, tracer
// lines, enemy gunmen who advance and shoot back, and hit feedback.
// Enemies are the rival crews of M4 and the vault guards of M6.
import { makePedMesh } from './pedestrians.js';

export function spawnEnemy(G, x, z) {
  const mesh = makePedMesh(0x8a2e2e, 0xc98a5a);
  // dark bandana + gun in hand
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  band.position.y = 1.85;
  mesh.add(band);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.45), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  gun.position.set(0.45, 1.15, 0.3);
  mesh.add(gun);
  mesh.position.set(x, 0, z);
  G.scene.add(mesh);
  const enemy = {
    mesh, pos: mesh.position, heading: 0,
    health: 100, maxHealth: 100,
    shootCooldown: 1 + Math.random(),
    strafeDir: Math.random() < 0.5 ? 1 : -1,
    alive: true,
  };
  G.enemies.push(enemy);
  return enemy;
}

export function clearEnemies(G) {
  for (const e of G.enemies) G.scene.remove(e.mesh);
  G.enemies = [];
}

// Fire the pistol at the screen centre. Returns the enemy hit (or null).
export function playerShoot(G) {
  if (G.player.inCar) return null; // no drive-by in this build
  if (G.time - G.lastShotTime < 0.28) return null;
  G.lastShotTime = G.time;
  G.sound.shoot();
  G.addShake(0.12);
  G.ammoShots = (G.ammoShots || 0) + 1;

  const origin = G.camera.position.clone();
  const dir = new THREE.Vector3();
  G.camera.getWorldDirection(dir);
  // small spread so it feels like a pistol, not a laser
  dir.x += (Math.random() - 0.5) * 0.02;
  dir.y += (Math.random() - 0.5) * 0.02;
  dir.z += (Math.random() - 0.5) * 0.02;
  dir.normalize();
  const ray = new THREE.Raycaster(origin, dir, 0.1, 90);
  const targets = G.enemies.filter((e) => e.alive).map((e) => e.mesh);
  const hits = ray.intersectObjects(targets, true);
  // tracer line from muzzle to hit point / max range
  const end = hits.length ? hits[0].point.clone() : origin.clone().add(dir.clone().multiplyScalar(60));
  drawTracer(G, origin, end);
  if (hits.length) {
    let obj = hits[0].object;
    while (obj && !obj.userData.enemyRef) obj = obj.parent;
    const enemy = hits[0].object.userData.enemyRef || findEnemyByMesh(G, hits[0].object);
    if (enemy) {
      damageEnemy(G, enemy, 34);
      return enemy;
    }
  }
  return null;
}

function findEnemyByMesh(G, obj) {
  let o = obj;
  while (o) {
    for (const e of G.enemies) if (e.mesh === o) return e;
    o = o.parent;
  }
  return null;
}

function drawTracer(G, from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
  G.scene.add(line);
  G.tracers.push({ line, ttl: 0.07 });
  // muzzle flash light
  if (!G.muzzleLight) {
    G.muzzleLight = new THREE.PointLight(0xffc36a, 0, 12);
    G.scene.add(G.muzzleLight);
  }
  G.muzzleLight.position.copy(from).add(new THREE.Vector3(0, -0.2, 0));
  G.muzzleLight.intensity = 14;
  G.muzzleTtl = 0.06;
}

export function damageEnemy(G, enemy, dmg) {
  if (!enemy.alive) return;
  enemy.health -= dmg;
  // flinch: flash the mesh red
  enemy.mesh.traverse((o) => {
    if (o.isMesh && o.material && o.material.emissive) o.material.emissive.setHex(0x661111);
  });
  setTimeout(() => {
    enemy.mesh.traverse((o) => {
      if (o.isMesh && o.material && o.material.emissive) o.material.emissive.setHex(0x000000);
    });
  }, 90);
  if (enemy.health <= 0) {
    enemy.alive = false;
    G.scene.remove(enemy.mesh);
    G.money += 25;
    G.toast('Rival down — +$25', '#ffd27a');
    G.onEnemyKilled && G.onEnemyKilled(enemy);
  }
}

export function updateEnemies(G, dt) {
  const pp = G.player.inCar ? G.player.inCar.pos : G.player.pos;
  for (const e of G.enemies) {
    if (!e.alive) continue;
    const dx = pp.x - e.pos.x, dz = pp.z - e.pos.z;
    const dist = Math.hypot(dx, dz);
    e.heading = Math.atan2(dx, dz);
    e.mesh.rotation.y = e.heading;
    // advance until 14m, then strafe and shoot
    if (dist > 14) {
      e.pos.x += Math.sin(e.heading) * 3.2 * dt;
      e.pos.z += Math.cos(e.heading) * 3.2 * dt;
    } else {
      e.pos.x += Math.cos(e.heading) * e.strafeDir * 1.6 * dt;
      e.pos.z -= Math.sin(e.heading) * e.strafeDir * 1.6 * dt;
      if (Math.random() < dt * 0.4) e.strafeDir *= -1;
    }
    e.shootCooldown -= dt;
    if (e.shootCooldown <= 0 && dist < 42 && !G.player.inCar) {
      e.shootCooldown = 1.6 + Math.random() * 1.2;
      G.sound.enemyShoot();
      drawTracer(G, e.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), pp.clone().add(new THREE.Vector3(0, 1.2, 0)));
      // enemies are bad shots at range, dangerous up close
      const hitChance = dist < 12 ? 0.45 : 0.18;
      if (Math.random() < hitChance) G.damagePlayer(8, 'gunfire');
    }
    // walk-cycle
    e.walkPhase = (e.walkPhase || 0) + dt * 5;
    const swing = Math.sin(e.walkPhase) * 0.4;
    e.mesh.userData.legs[0].rotation.x = swing;
    e.mesh.userData.legs[1].rotation.x = -swing;
  }
  // tracer cleanup
  for (let i = G.tracers.length - 1; i >= 0; i--) {
    G.tracers[i].ttl -= dt;
    if (G.tracers[i].ttl <= 0) {
      G.scene.remove(G.tracers[i].line);
      G.tracers[i].line.geometry.dispose();
      G.tracers.splice(i, 1);
    }
  }
  if (G.muzzleLight && G.muzzleTtl > 0) {
    G.muzzleTtl -= dt;
    if (G.muzzleTtl <= 0) G.muzzleLight.intensity = 0;
  }
}
