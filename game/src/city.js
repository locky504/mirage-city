// Solara: a desert casino city at dusk. A road grid with neon-lit blocks,
// a casino tower, desert dunes and cacti beyond the streets, a gradient
// dusk sky and a low sun. Returns the static colliders (building AABBs)
// the player, cars and AI all collide against.
import { CITY, PALETTE } from './config.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NEON = [0xff2d78, 0x00e5ff, 0xffc300, 0x7c4dff, 0x39ff88, 0xff6a00];

export function buildCity(scene) {
  const rand = mulberry32(20261119);
  const colliders = [];
  const matCache = new Map();
  const mat = (color, opts = {}) => {
    const key = color + JSON.stringify(opts);
    if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
    return matCache.get(key);
  };

  // --- sky: gradient dome + low sun disc + haze fog ----------------------
  scene.background = new THREE.Color(PALETTE.duskSkyBottom);
  scene.fog = new THREE.Fog(PALETTE.fog, 90, 420);
  const skyGeo = new THREE.SphereGeometry(480, 16, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.duskSkyTop) },
      bottom: { value: new THREE.Color(PALETTE.duskSkyBottom) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 bottom; void main(){ float h = normalize(vP).y * 0.5 + 0.5; gl_FragColor = vec4(mix(bottom, top, pow(max(h,0.0), 0.7)), 1.0); }',
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(26, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false })
  );
  sun.position.set(-260, 55, -320);
  sun.lookAt(0, 20, 0);
  scene.add(sun);

  // --- lights ------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0xffb37a, 0x6a4a5a, 1.15);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xff9a4d, 1.6);
  sunLight.position.set(-120, 90, -80);
  scene.add(sunLight);
  // cool fill from the opposite side so shadow faces are not black
  const fillLight = new THREE.DirectionalLight(0x8a7aff, 0.55);
  fillLight.position.set(120, 60, 100);
  scene.add(fillLight);

  // --- ground: sand everywhere, roads + sidewalks on the grid ------------
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 1100),
    mat(PALETTE.sand)
  );
  sand.rotation.x = -Math.PI / 2;
  scene.add(sand);

  const H = CITY.halfSize;
  const roadMat = mat(PALETTE.road);
  const walkMat = mat(PALETTE.sidewalk);
  // Road strips run along each grid line (x = k*block and z = k*block).
  for (let k = -4; k <= 4; k++) {
    const c = k * CITY.block;
    const stripX = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadWidth, H * 2 + 24), roadMat);
    stripX.rotation.x = -Math.PI / 2;
    stripX.position.set(c, 0.02, 0);
    scene.add(stripX);
    const stripZ = new THREE.Mesh(new THREE.PlaneGeometry(H * 2 + 24, CITY.roadWidth), roadMat);
    stripZ.rotation.x = -Math.PI / 2;
    stripZ.position.set(0, 0.02, c);
    scene.add(stripZ);
    // centre dashes
    for (let d = -H; d < H; d += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 4), mat(0xd8c98a));
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(c, 0.04, d + 6);
      scene.add(dash);
    }
  }
  // Sidewalk aprons around each block. Blocks sit BETWEEN the roads: their
  // centres are at (k+0.5)*block, so the roads stay clear corridors.
  const blockGeo = new THREE.BoxGeometry(CITY.block - CITY.roadWidth, 0.3, CITY.block - CITY.roadWidth);
  for (let bx = -4; bx <= 3; bx++) {
    for (let bz = -4; bz <= 3; bz++) {
      const cx = (bx + 0.5) * CITY.block;
      const cz = (bz + 0.5) * CITY.block;
      if (Math.abs(cx) < 30 && Math.abs(cz) < 30) continue; // casino plaza
      const apron = new THREE.Mesh(blockGeo, walkMat);
      apron.position.set(cx, 0.15, cz);
      scene.add(apron);
    }
  }

  // --- buildings: one or two per block, windows + neon signs ------------
  const winMat = new THREE.MeshLambertMaterial({ color: PALETTE.buildingGlass, emissive: 0xffc36a, emissiveIntensity: 0.9 });
  const wallColors = [0x6b4a5a, 0x7a5a3a, 0x4a4a6b, 0x5a3a4a, 0x8a6a4a, 0x3a4a5a];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let bx = -4; bx <= 3; bx++) {
    for (let bz = -4; bz <= 3; bz++) {
      const cx = (bx + 0.5) * CITY.block;
      const cz = (bz + 0.5) * CITY.block;
      if (Math.abs(cx) < 30 && Math.abs(cz) < 30) continue; // casino plaza
      const n = rand() < 0.55 ? 1 : 2;
      for (let i = 0; i < n; i++) {
        const w = 12 + rand() * 8;
        const d = 12 + rand() * 8;
        const h = 8 + rand() * rand() * 34;
        const ox = n === 1 ? 0 : (i === 0 ? -5 : 5);
        const oz = n === 1 ? 0 : (i === 0 ? 5 : -5);
        const b = new THREE.Mesh(boxGeo, mat(wallColors[Math.floor(rand() * wallColors.length)]));
        b.scale.set(w, h, d);
        b.position.set(cx + ox, h / 2 + 0.3, cz + oz);
        scene.add(b);
        colliders.push({ minX: cx + ox - w / 2, maxX: cx + ox + w / 2, minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2 });
        // lit window band
        const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, Math.min(h * 0.7, 10)), winMat);
        win.position.set(cx + ox, h * 0.55, cz + oz + d / 2 + 0.06);
        scene.add(win);
        // neon sign strip on the roof edge
        if (rand() < 0.7) {
          const neon = NEON[Math.floor(rand() * NEON.length)];
          const sign = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.7, 0.7, 0.4),
            new THREE.MeshBasicMaterial({ color: neon })
          );
          sign.position.set(cx + ox, h + 0.6, cz + oz + d / 2 - 0.5);
          scene.add(sign);
        }
      }
    }
  }

  // --- Solara Grand casino tower on the central plaza ---------------------
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(56, 56), mat(0x9a7a5a));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, 0.03, 0);
  scene.add(plaza);
  const tower = new THREE.Mesh(boxGeo, mat(0x54406a));
  tower.scale.set(26, 64, 26);
  tower.position.set(0, 32, 0);
  scene.add(tower);
  colliders.push({ minX: -13, maxX: 13, minZ: -13, maxZ: 13 });
  // lit window bands on all four faces so the tower never reads as a slab
  for (const face of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    for (const y of [16, 28, 40, 52]) {
      const band = new THREE.Mesh(new THREE.PlaneGeometry(22, 3.2), winMat);
      const r = 13.15;
      band.position.set(Math.sin(face) * r, y, Math.cos(face) * r);
      band.rotation.y = face;
      scene.add(band);
    }
  }
  // glowing crown + vertical neon fins
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 3, 8), new THREE.MeshBasicMaterial({ color: 0xff2d78 }));
  crown.position.set(0, 65.5, 0);
  scene.add(crown);
  for (let s = 0; s < 4; s++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.6, 58, 1.2), new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
    const a = (s * Math.PI) / 2;
    fin.position.set(Math.sin(a) * 13.4, 32, Math.cos(a) * 13.4);
    fin.rotation.y = a;
    scene.add(fin);
  }
  const casinoLight = new THREE.PointLight(0xff2d78, 60, 90);
  casinoLight.position.set(0, 40, 30);
  scene.add(casinoLight);
  // "SOLARA" sign: a row of bright panels spelling the name in light
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(2.6, 5, 0.5), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffc300 : 0xff2d78 }));
    p.position.set(-13 + i * 5.2, 52, 13.4);
    scene.add(p);
  }

  // --- desert beyond the grid: dunes + cacti + palms ----------------------
  const duneMat = mat(0xc98a4a);
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2;
    const r = 210 + rand() * 160;
    const dune = new THREE.Mesh(new THREE.SphereGeometry(18 + rand() * 26, 10, 6), duneMat);
    dune.scale.y = 0.22 + rand() * 0.15;
    dune.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    scene.add(dune);
  }
  const cactusMat = mat(0x3f7a3a);
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2;
    const r = 185 + rand() * 200;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = 2.5 + rand() * 3;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, h, 6), cactusMat);
    c.position.set(x, h / 2, z);
    scene.add(c);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.6, 6), cactusMat);
    arm.position.set(x + 0.9, h * 0.6, z);
    scene.add(arm);
  }
  // palms along the main boulevard (on the sidewalk edge, off the road)
  const trunkMat = mat(0x7a5a3a);
  const leafMat = mat(0x2f8a4a);
  for (let i = -3; i <= 3; i++) {
    for (const side of [-1, 1]) {
      const x = i * CITY.block + 8;
      const z = side * 9;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 5, 6), trunkMat);
      trunk.position.set(x, 2.5, z);
      scene.add(trunk);
      const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.4, 7), leafMat);
      leaves.position.set(x, 6, z);
      scene.add(leaves);
    }
  }

  // --- street lamps -------------------------------------------------------
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const poleMat = mat(0x3a3a3a);
  for (let bx = -4; bx <= 4; bx++) {
    for (let bz = -4; bz <= 4; bz++) {
      if (Math.abs(bx) + Math.abs(bz) > 6) continue;
      const x = bx * CITY.block + 8;
      const z = bz * CITY.block + 8;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.5, 5), poleMat);
      pole.position.set(x, 2.75, z);
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 5), lampMat);
      lamp.position.set(x, 5.6, z);
      scene.add(lamp);
    }
  }

  return { colliders, rand };
}

// Circle (x,z,r) vs AABB colliders: push the circle out, return corrected pos.
export function resolveCircleColliders(pos, r, colliders) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * r;
        pos.z = nz + (dz / d) * r;
      } else {
        // centre inside the box: push out along the smallest penetration axis
        const pl = pos.x - c.minX, pr = c.maxX - pos.x;
        const pt = pos.z - c.minZ, pb = c.maxZ - pos.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = c.minX - r;
        else if (m === pr) pos.x = c.maxX + r;
        else if (m === pt) pos.z = c.minZ - r;
        else pos.z = c.maxZ + r;
      }
    }
  }
}
