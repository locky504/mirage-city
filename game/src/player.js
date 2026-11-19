// On-foot player: third-person walker with a mouse-orbit camera, WASD
// movement relative to the camera, building collision, and the enter-car
// (E) / steal-car (F) interactions. The player mesh is a courier with a
// delivery backpack.
import { CITY } from './config.js';
import { resolveCircleColliders } from './city.js';
import { makePedMesh } from './pedestrians.js';

export function createPlayer(scene) {
  const mesh = makePedMesh(0xff7a2e, 0xe8b88a);
  // courier backpack
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.25), new THREE.MeshLambertMaterial({ color: 0x2e7ad8 }));
  pack.position.set(0, 1.15, -0.32);
  mesh.add(pack);
  mesh.position.set(-60, 0, 88); // on the z=88 road, facing +x down the road
  scene.add(mesh);
  return {
    mesh,
    pos: mesh.position,
    heading: Math.PI / 2,
    camYaw: Math.PI / 2,
    camPitch: 0.32,
    camDist: 7.5,
    speed: 0,
    inCar: null,
    health: 100,
    maxHealth: 100,
  };
}

export function updatePlayerOnFoot(G, dt) {
  const { input, player, colliders } = G;
  // camera orbit from mouse drag
  player.camYaw -= input.mouseDX * 0.0042;
  player.camPitch = Math.max(-0.15, Math.min(0.9, player.camPitch + input.mouseDY * 0.003));
  const fwd = (input.keys.has('KeyW') || input.keys.has('ArrowUp') ? 1 : 0) - (input.keys.has('KeyS') || input.keys.has('ArrowDown') ? 1 : 0);
  const strafe = (input.keys.has('KeyD') || input.keys.has('ArrowRight') ? 1 : 0) - (input.keys.has('KeyA') || input.keys.has('ArrowLeft') ? 1 : 0);
  const running = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  const targetSpeed = (fwd !== 0 || strafe !== 0) ? (running ? CITY.runSpeed : CITY.walkSpeed) : 0;
  player.speed += Math.max(-30 * dt, Math.min(30 * dt, targetSpeed - player.speed));
  if (player.speed > 0.1) {
    const moveAngle = player.camYaw + Math.atan2(strafe, fwd);
    player.pos.x += Math.sin(moveAngle) * player.speed * dt;
    player.pos.z += Math.cos(moveAngle) * player.speed * dt;
    // face the direction of travel, smoothly
    let dh = moveAngle - player.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    player.heading += Math.max(-10 * dt, Math.min(10 * dt, dh));
  }
  player.pos.x = Math.max(-CITY.halfSize, Math.min(CITY.halfSize, player.pos.x));
  player.pos.z = Math.max(-CITY.halfSize, Math.min(CITY.halfSize, player.pos.z));
  resolveCircleColliders(player.pos, 0.6, colliders);
  // walk-cycle swing
  player.walkPhase = (player.walkPhase || 0) + dt * player.speed * 2.2;
  const swing = Math.sin(player.walkPhase) * 0.55 * Math.min(1, player.speed / CITY.walkSpeed);
  player.mesh.userData.legs[0].rotation.x = swing;
  player.mesh.userData.legs[1].rotation.x = -swing;
  player.mesh.userData.arms[0].rotation.x = -swing * 0.7;
  player.mesh.userData.arms[1].rotation.x = swing * 0.7;
  player.mesh.rotation.y = player.heading;
  player.mesh.position.copy(player.pos);
}

// Position the chase camera behind the player (or the car) with smoothing.
export function updateCamera(G, dt) {
  const { camera, player } = G;
  const anchor = player.inCar ? player.inCar.pos : player.pos;
  const yaw = player.inCar ? player.inCar.heading + Math.PI : player.camYaw;
  const dist = player.inCar ? 11 : player.camDist;
  const height = player.inCar ? 4.6 : 3.1;
  const pitch = player.inCar ? 0.22 : player.camPitch;
  const tx = anchor.x + Math.sin(yaw) * Math.cos(pitch) * dist;
  const tz = anchor.z + Math.cos(yaw) * Math.cos(pitch) * dist;
  const ty = height + Math.sin(pitch) * dist;
  const k = 1 - Math.pow(0.0001, dt); // frame-rate independent smoothing
  camera.position.x += (tx - camera.position.x) * k;
  camera.position.y += (ty - camera.position.y) * k;
  camera.position.z += (tz - camera.position.z) * k;
  camera.lookAt(anchor.x, anchor.y + (player.inCar ? 1.4 : 1.6), anchor.z);
}

// Nearest car the player could enter, and whether it needs stealing.
export function nearestEnterableCar(G, maxDist = 4.2) {
  let best = null, bestD = maxDist;
  for (const car of G.cars) {
    if (car.isCop) continue;
    if (car === G.player.inCar) continue;
    const d = Math.hypot(car.pos.x - G.player.pos.x, car.pos.z - G.player.pos.z);
    if (d < bestD) { best = car; bestD = d; }
  }
  if (!best) return null;
  return { car: best, dist: bestD, needsSteal: best.isTraffic };
}

export function enterCar(G, car) {
  G.player.inCar = car;
  car.isPlayerCar = true;
  car.isTraffic = false;
  car.isParked = false;
  car.speed = 0;
  G.player.mesh.visible = false;
  G.sound.pickup();
}

export function exitCar(G) {
  const car = G.player.inCar;
  if (!car) return;
  G.player.inCar = null;
  car.isPlayerCar = false;
  car.speed = 0;
  const side = car.heading + Math.PI / 2;
  G.player.pos.set(car.pos.x + Math.sin(side) * 2.4, 0, car.pos.z + Math.cos(side) * 2.4);
  G.player.mesh.visible = true;
  G.player.camYaw = car.heading + Math.PI;
}
