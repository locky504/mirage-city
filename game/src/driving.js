// Driving: arcade car physics — acceleration, braking/reverse, speed
// sensitive steering, a little drift on the handbrake, building collision
// and traffic bumps. Tuned so the car feels weighty but stays controllable
// on a keyboard.
import { CITY } from './config.js';
import { resolveCircleColliders } from './city.js';
import { separateCars } from './vehicles.js';

export function updateDriving(G, dt) {
  const { input, player, colliders, cars } = G;
  const car = player.inCar;
  if (!car) return;
  // mouse orbit still works while driving (offsets the chase camera yaw)
  player.camYaw -= input.mouseDX * 0.0042;

  const throttle = (input.keys.has('KeyW') || input.keys.has('ArrowUp') ? 1 : 0) - (input.keys.has('KeyS') || input.keys.has('ArrowDown') ? 1 : 0);
  const steerInput = (input.keys.has('KeyA') || input.keys.has('ArrowLeft') ? 1 : 0) - (input.keys.has('KeyD') || input.keys.has('ArrowRight') ? 1 : 0);
  const handbrake = input.keys.has('Space');

  const accel = 16;
  const maxFwd = CITY.maxSpeed;
  const maxRev = 12;
  if (throttle > 0) car.speed += accel * dt;
  else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= 26 * dt; // brake
    else car.speed -= 9 * dt; // reverse
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  }
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 22 * dt);
  car.speed = Math.max(-maxRev, Math.min(maxFwd, car.speed));

  // steering: sharper at low speed, gentle at full speed; reversed in reverse
  const speedFactor = Math.min(1, Math.abs(car.speed) / 12);
  const steerAngle = steerInput * (0.55 + 0.55 * (1 - Math.min(1, Math.abs(car.speed) / maxFwd)));
  car.heading += steerAngle * speedFactor * Math.sign(car.speed || 1) * dt * 1.9;
  if (handbrake && Math.abs(car.speed) > 8) car.heading += steerInput * dt * 0.9 * Math.sign(car.speed);

  const prevX = car.pos.x, prevZ = car.pos.z;
  car.pos.x += Math.sin(car.heading) * car.speed * dt;
  car.pos.z += Math.cos(car.heading) * car.speed * dt;
  resolveCircleColliders(car.pos, 1.7, colliders);
  const hitWall = Math.hypot(car.pos.x - prevX, car.pos.z - prevZ) < Math.abs(car.speed) * dt * 0.4;
  if (hitWall && Math.abs(car.speed) > 6) {
    G.sound.crash();
    G.addShake(Math.min(0.5, Math.abs(car.speed) * 0.012));
    car.speed *= 0.35;
  }
  car.pos.x = Math.max(-CITY.halfSize, Math.min(CITY.halfSize, car.pos.x));
  car.pos.z = Math.max(-CITY.halfSize, Math.min(CITY.halfSize, car.pos.z));

  // bump traffic cars
  for (const other of cars) {
    if (other === car || other.isCop) continue;
    if (separateCars(car, other)) {
      if (Math.abs(car.speed) > 8) {
        G.sound.crash();
        other.speed = 0;
        other.isTraffic = false; // a shoved car stops being traffic
        car.speed *= 0.7;
      }
    }
  }

  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = car.heading;
  // wheel spin + front-wheel steer visual
  for (const w of car.mesh.userData.wheels) w.rotation.x += (car.speed * dt) / 0.38;
  // slight body roll into corners
  car.mesh.rotation.z = -steerInput * speedFactor * 0.04;
  car.mesh.rotation.x = Math.max(-0.03, Math.min(0.05, -throttle * 0.02 * speedFactor));
  player.camYaw = car.heading + Math.PI;
}
