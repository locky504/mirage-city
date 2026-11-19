// Pedestrians: low-poly walkers who stroll the sidewalks, cross at
// intersections and scatter when a car barrels at them. Pure ambience,
// except the VIP and taxi customers the missions borrow.
import { CITY } from './config.js';

const SHIRTS = [0xe86a5a, 0x5aa8e8, 0x8ae85a, 0xe8d25a, 0xc05ae8, 0xe8e8e8, 0x5ae8d8];
const SKINS = [0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf0c8a0];

export function makePedMesh(shirtColor, skinColor) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const skin = new THREE.MeshLambertMaterial({ color: skinColor });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.9, 8), shirt);
  body.position.y = 1.05;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.75;
  g.add(head);
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.65, 6), pants);
  legL.position.set(-0.14, 0.33, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.14;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.6, 6), shirt);
  armL.position.set(-0.45, 1.1, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.45;
  g.add(armR);
  g.userData.legs = [legL, legR];
  g.userData.arms = [armL, armR];
  return g;
}

export function spawnPedestrians(scene, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const shirt = SHIRTS[i % SHIRTS.length];
    const skin = SKINS[i % SKINS.length];
    const mesh = makePedMesh(shirt, skin);
    // start on a sidewalk edge: 8m off a road centreline, along a road
    const line = (Math.floor(Math.random() * 7) - 3) * CITY.block;
    const along = (Math.random() * 2 - 1) * (CITY.halfSize - 10);
    const side = Math.random() < 0.5 ? -8 : 8;
    const onXRoad = Math.random() < 0.5;
    const x = onXRoad ? along : line + side;
    const z = onXRoad ? line + side : along;
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    peds.push({
      mesh,
      pos: mesh.position,
      heading: Math.random() * Math.PI * 2,
      speed: 1.2 + Math.random() * 1.3,
      walkPhase: Math.random() * 10,
      target: null,
      isVIP: false,
      isCustomer: false,
    });
  }
  return peds;
}

export function makeSpecialPed(scene, x, z, shirtColor) {
  const mesh = makePedMesh(shirtColor, SKINS[0]);
  mesh.position.set(x, 0, z);
  // a gold ring on the ground so the player can spot them
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1.1, 20),
    new THREE.MeshBasicMaterial({ color: 0xffc300, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  mesh.add(ring);
  scene.add(mesh);
  return { mesh, pos: mesh.position, heading: 0, speed: 0, walkPhase: 0, target: null, isVIP: false, isCustomer: false };
}

export function updatePedestrians(peds, dt, playerPos, playerSpeed) {
  for (const p of peds) {
    if (p.isVIP || p.isCustomer) continue; // mission peds wait in place
    // scatter from a fast-moving player/car
    const dx = p.pos.x - playerPos.x, dz = p.pos.z - playerPos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 36 && playerSpeed > 6) {
      p.heading = Math.atan2(dx, dz);
      p.speed = 4.5;
    } else {
      p.speed = 1.2 + (p.baseSpeed || 1.5);
    }
    if (!p.target || p.pos.distanceTo(p.target) < 1.5) {
      const bx = Math.round(p.pos.x / CITY.block) * CITY.block;
      const bz = Math.round(p.pos.z / CITY.block) * CITY.block;
      const axis = Math.random() < 0.5 ? 'x' : 'z';
      const off = (Math.floor(Math.random() * 9) - 4) * CITY.block;
      p.target = new THREE.Vector3(
        axis === 'x' ? off : bx + (Math.random() * 2 - 1) * 10,
        0,
        axis === 'z' ? off : bz + (Math.random() * 2 - 1) * 10
      );
    }
    const tx = p.target.x - p.pos.x, tz = p.target.z - p.pos.z;
    const want = Math.atan2(tx, tz);
    let dh = want - p.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    p.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
    p.pos.x += Math.sin(p.heading) * p.speed * dt;
    p.pos.z += Math.cos(p.heading) * p.speed * dt;
    p.pos.x = Math.max(-CITY.halfSize, Math.min(CITY.halfSize, p.pos.x));
    p.pos.z = Math.max(-CITY.halfSize, Math.min(CITY.halfSize, p.pos.z));
    p.mesh.rotation.y = p.heading;
    p.walkPhase += dt * p.speed * 4;
    const swing = Math.sin(p.walkPhase) * 0.5;
    p.mesh.userData.legs[0].rotation.x = swing;
    p.mesh.userData.legs[1].rotation.x = -swing;
    p.mesh.userData.arms[0].rotation.x = -swing * 0.7;
    p.mesh.userData.arms[1].rotation.x = swing * 0.7;
  }
}
