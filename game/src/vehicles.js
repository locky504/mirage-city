// Vehicles: boxy low-poly cars (body + cabin + wheels + headlights), the
// traffic AI that cruises the road grid, and parked cars the player can
// take with E. A car is { mesh, pos, heading, speed, kind, color, ... }.
import { CITY } from './config.js';

const CAR_COLORS = [0xd83a2e, 0x2e7ad8, 0xe8b400, 0x7ad82e, 0xd8d8d8, 0x8a2ed8, 0x2ed8c8, 0xff7a2e];
const TAXI_COLOR = 0xffc300;

let colorIdx = 0;

export function makeCarMesh(color, kind = 'sedan') {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x182030 });
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glassMat);
  cabin.position.set(0, 1.1, kind === 'truck' ? -0.7 : -0.2);
  g.add(cabin);
  if (kind === 'truck') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 1.8), bodyMat);
    bed.position.set(0, 0.95, 1.2);
    g.add(bed);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0xfff2a8 }));
    sign.position.set(0, 1.5, -0.2);
    g.add(sign);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.38, z);
    g.add(w);
    wheels.push(w);
  }
  // headlights + taillights
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  for (const x of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.1), headMat);
    h.position.set(x, 0.6, -2.22);
    g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.1), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    t.position.set(x, 0.6, 2.22);
    g.add(t);
  }
  g.userData.wheels = wheels;
  return g;
}

export function spawnCar(scene, x, z, heading, kind = 'sedan') {
  const color = kind === 'taxi' ? TAXI_COLOR : CAR_COLORS[colorIdx++ % CAR_COLORS.length];
  const mesh = makeCarMesh(color, kind);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    mesh, kind, color,
    pos: new THREE.Vector3(x, 0, z),
    heading,
    speed: 0,
    // traffic AI state
    axis: Math.abs(Math.sin(heading)) > 0.5 ? 'x' : 'z',
    dir: Math.sin(heading) >= 0 ? 1 : -1,
    targetSpeed: CITY.trafficSpeed * (0.8 + Math.random() * 0.4),
    isTraffic: false,
    isCop: false,
    isPlayerCar: false,
    stolen: false,
    steer: 0,
  };
}

// Parked cars on road lanes (3m off the centreline), E to enter, no wanted.
export function spawnParkedCars(scene, count) {
  const cars = [];
  // [x, z, heading]: each spot sits on a road (roads run at multiples of 44)
  const spots = [
    [-85, -60, 0], [47, -85, Math.PI / 2], [91, 20, Math.PI], [20, 91, 0],
    [-41, 60, Math.PI / 2], [135, -41, Math.PI], [-135, 41, 0], [60, -41, Math.PI / 2],
    [-85, 100, Math.PI], [41, -60, 0], [-41, -100, Math.PI / 2], [100, 41, Math.PI],
  ];
  for (let i = 0; i < Math.min(count, spots.length); i++) {
    const [x, z, h] = spots[i];
    const car = spawnCar(scene, x, z, h, i === 3 ? 'taxi' : (i % 4 === 0 ? 'truck' : 'sedan'));
    car.isParked = true;
    cars.push(car);
  }
  return cars;
}

// Traffic: cars cruise along road centrelines, turning at intersections.
export function spawnTraffic(scene, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const axis = Math.random() < 0.5 ? 'x' : 'z';
    const line = (Math.floor(Math.random() * 7) - 3) * CITY.block; // -132..132
    const along = (Math.random() * 2 - 1) * (CITY.halfSize - 10);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const x = axis === 'x' ? along : line + (dir > 0 ? 3 : -3);
    const z = axis === 'x' ? line + (dir > 0 ? 3 : -3) : along;
    const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = spawnCar(scene, x, z, heading);
    car.isTraffic = true;
    car.axis = axis;
    car.dir = dir;
    car.speed = car.targetSpeed;
    cars.push(car);
  }
  return cars;
}

function nearestIntersection(v) {
  // distance along the car's axis to the next grid line
  const along = v.axis === 'x' ? v.pos.x : v.pos.z;
  const next = Math.round(along / CITY.block) * CITY.block;
  return next - along;
}

export function updateTraffic(cars, dt, colliders) {
  for (const c of cars) {
    if (!c.isTraffic) continue;
    // slow down if another traffic car is close ahead
    let slow = false;
    for (const o of cars) {
      if (o === c || !o.isTraffic) continue;
      const dx = o.pos.x - c.pos.x, dz = o.pos.z - c.pos.z;
      const ahead = c.axis === 'x' ? dx * c.dir : dz * c.dir;
      const side = c.axis === 'x' ? Math.abs(dz) : Math.abs(dx);
      if (ahead > 0 && ahead < 9 && side < 4) { slow = true; break; }
    }
    const target = slow ? 0 : c.targetSpeed;
    c.speed += Math.max(-14 * dt, Math.min(8 * dt, target - c.speed));
    // turn at an intersection sometimes
    const toNext = nearestIntersection(c);
    if (Math.abs(toNext) < c.speed * dt + 0.4 && Math.random() < 0.35) {
      const turn = Math.random() < 0.5 ? 1 : -1;
      if (c.axis === 'x') {
        c.axis = 'z';
        c.pos.x = Math.round(c.pos.x / CITY.block) * CITY.block + (turn > 0 ? 3 : -3);
        c.dir = turn;
        c.heading = turn > 0 ? 0 : Math.PI;
      } else {
        c.axis = 'x';
        c.pos.z = Math.round(c.pos.z / CITY.block) * CITY.block + (turn > 0 ? 3 : -3);
        c.dir = turn;
        c.heading = turn > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    }
    if (c.axis === 'x') c.pos.x += c.dir * c.speed * dt;
    else c.pos.z += c.dir * c.speed * dt;
    // wrap around the city edge
    if (c.pos.x > CITY.halfSize) c.pos.x = -CITY.halfSize;
    if (c.pos.x < -CITY.halfSize) c.pos.x = CITY.halfSize;
    if (c.pos.z > CITY.halfSize) c.pos.z = -CITY.halfSize;
    if (c.pos.z < -CITY.halfSize) c.pos.z = CITY.halfSize;
    c.mesh.position.copy(c.pos);
    c.mesh.rotation.y = c.heading;
    for (const w of c.mesh.userData.wheels) w.rotation.x += (c.speed * dt) / 0.38;
  }
}

// Simple circle-circle push between cars (used for player car vs traffic).
export function separateCars(a, b, radius = 3.2) {
  const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
  const d2 = dx * dx + dz * dz;
  if (d2 > 0.01 && d2 < radius * radius) {
    const d = Math.sqrt(d2);
    const push = (radius - d) / 2;
    const nx = dx / d, nz = dz / d;
    a.pos.x -= nx * push; a.pos.z -= nz * push;
    b.pos.x += nx * push; b.pos.z += nz * push;
    return true;
  }
  return false;
}

export function syncCarMesh(car) {
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = car.heading;
}
