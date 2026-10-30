// =========================================================
//  MI CUARTO 3D  —  cuarto de estudiante de ingenieria
//  Geometria primitiva + Three.js. Estetica 2000s + 3D.
// =========================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------- Estado global de interactivos ----------
const clickable = [];        // meshes raycasteables (con .userData.interactive)
const animators = [];        // funciones update(dt) activas
const registry  = {};        // refs a objetos por nombre

// =========================================================
//  RENDERER / ESCENA / CAMARA
// =========================================================
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0a0e1f');
scene.fog = new THREE.Fog('#0a0e1f', 14, 30);

const camera = new THREE.PerspectiveCamera(
  55, window.innerWidth / window.innerHeight, 0.1, 100
);
camera.position.set(6.5, 5.2, 7.5);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 3;
controls.maxDistance = 16;
controls.maxPolarAngle = Math.PI * 0.49; // no bajar del piso
controls.target.set(0, 1.6, 0);

// =========================================================
//  LUCES
// =========================================================
const ambient = new THREE.AmbientLight('#4a5a90', 0.9);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight('#fff3d6', 1.1);
keyLight.position.set(5, 9, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 30;
keyLight.shadow.camera.left = -10;
keyLight.shadow.camera.right = 10;
keyLight.shadow.camera.top = 10;
keyLight.shadow.camera.bottom = -10;
scene.add(keyLight);

// luz neon ambiente (rollo retro)
const neonPink = new THREE.PointLight('#ff3cac', 0.8, 18);
neonPink.position.set(-4, 3.2, -3);
scene.add(neonPink);

const neonCyan = new THREE.PointLight('#19f7c8', 0.7, 18);
neonCyan.position.set(4, 2.6, -3.5);
scene.add(neonCyan);

// =========================================================
//  HELPERS DE MATERIAL / GEOMETRIA
// =========================================================
const mat = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, ...opts });

const metal = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.85, ...opts });

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function cyl(rt, rb, h, material, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Textura de poster/vinilo generada por canvas (sin assets externos)
function makeCanvasTexture(draw, w = 256, h = 256) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Marca un mesh como interactivo y le da un leve glow via emissive
function makeInteractive(mesh, name, info, onClick) {
  mesh.userData.interactive = true;
  mesh.userData.name = name;
  mesh.userData.info = info;
  mesh.userData.onClick = onClick;
  mesh.userData.baseEmissive = new THREE.Color('#000000');
  mesh.traverse((o) => {
    if (o.isMesh) {
      o.userData.rootInteractive = mesh;
      clickable.push(o);
    }
  });
  if (mesh.isMesh) clickable.push(mesh);
  return mesh;
}

// =========================================================
//  CUARTO: piso, paredes, zocalos
// =========================================================
const ROOM = 12;   // ancho/largo
const WALL_H = 6;  // alto

function buildRoom() {
  // Piso (tablones de madera simulados por color)
  const floorMat = mat('#6b4a2f', { roughness: 0.95 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM, ROOM), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // lineas de tablones
  const plankTex = makeCanvasTexture((g, w, h) => {
    g.fillStyle = '#6b4a2f'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
    for (let i = 0; i <= 8; i++) {
      g.beginPath(); g.moveTo(0, i * h / 8); g.lineTo(w, i * h / 8); g.stroke();
    }
  });
  plankTex.wrapS = plankTex.wrapT = THREE.RepeatWrapping;
  plankTex.repeat.set(4, 4);
  floorMat.map = plankTex;
  floorMat.needsUpdate = true;

  // Alfombra con estrella (rollo 2000s)
  const rugTex = makeCanvasTexture((g, w, h) => {
    g.fillStyle = '#1b2550'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff3cac';
    g.save(); g.translate(w / 2, h / 2);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? w * 0.34 : w * 0.15;
      const a = Math.PI / 5 * i - Math.PI / 2;
      g[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath(); g.fill();
    g.strokeStyle = '#19f7c8'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    g.restore();
  });
  const rug = new THREE.Mesh(new THREE.CircleGeometry(2.6, 48),
    new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.01;
  rug.receiveShadow = true;
  scene.add(rug);

  // Paredes (2: back -Z, left -X) para que el cuarto sea abierto a camara
  const wallMat = mat('#2a2f47', { roughness: 1, side: THREE.DoubleSide });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM, WALL_H), wallMat);
  backWall.position.set(0, WALL_H / 2, -ROOM / 2);
  backWall.receiveShadow = true;
  scene.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM, WALL_H), wallMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-ROOM / 2, WALL_H / 2, 0);
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  // Zocalos
  const skirtMat = mat('#1a1d2e');
  const s1 = box(ROOM, 0.3, 0.1, skirtMat, 0, 0.15, -ROOM / 2 + 0.05); scene.add(s1);
  const s2 = box(0.1, 0.3, ROOM, skirtMat, -ROOM / 2 + 0.05, 0.15, 0); scene.add(s2);

  // Ventana con cielo nocturno en pared izquierda
  const skyTex = makeCanvasTexture((g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0b1033'); grad.addColorStop(1, '#3a1c5a');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff';
    for (let i = 0; i < 80; i++) {
      g.globalAlpha = Math.random() * 0.8 + 0.2;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    g.globalAlpha = 1; g.fillStyle = '#ffd166';
    g.beginPath(); g.arc(w * 0.72, h * 0.28, 26, 0, Math.PI * 2); g.fill();
  });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.2),
    new THREE.MeshBasicMaterial({ map: skyTex }));
  win.rotation.y = Math.PI / 2;
  win.position.set(-ROOM / 2 + 0.06, 3.2, 2.2);
  scene.add(win);
  const winFrame = box(0.12, 2.5, 3.3, mat('#d8d8d8'), -ROOM / 2 + 0.04, 3.2, 2.2);
  scene.add(winFrame);
}

// =========================================================
//  POSTERS DE ROCK (80-90) + VINILOS en pared back
// =========================================================
function posterTexture(title, sub, c1, c2) {
  return makeCanvasTexture((g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, c1); grad.addColorStop(1, c2);
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    // rayo / estrella decorativa
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(w * 0.2, 0); g.lineTo(w * 0.5, h * 0.55);
    g.lineTo(w * 0.35, h * 0.55); g.lineTo(w * 0.7, h); g.stroke();
    g.fillStyle = '#fff';
    g.font = 'bold 40px Impact, sans-serif';
    g.textAlign = 'center';
    g.fillText(title, w / 2, h * 0.45);
    g.font = '20px Georgia, serif';
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillText(sub, w / 2, h * 0.56);
    g.strokeStyle = '#000'; g.lineWidth = 10; g.strokeRect(0, 0, w, h);
  }, 300, 420);
}

function buildPosters() {
  const posters = [
    { t: 'THUNDER ROAD', s: 'world tour 87', a: '#b31217', b: '#2c0a0a', x: -3.6, y: 4.0 },
    { t: 'NEON WOLVES',  s: 'live 1991',    a: '#1a2a6c', b: '#b21f1f', x: -1.1, y: 4.2 },
    { t: 'STATIC SUN',   s: 'greatest hits',a: '#141e30', b: '#243b55', x: 1.5,  y: 3.9 },
  ];
  posters.forEach(p => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.1),
      new THREE.MeshStandardMaterial({ map: posterTexture(p.t, p.s, p.a, p.b), roughness: 0.9 }));
    m.position.set(p.x, p.y, -ROOM / 2 + 0.05);
    scene.add(m);
  });

  // Discos de vinilo colgados
  const vinylColors = ['#ff3cac', '#19f7c8', '#ffd166'];
  [3.6, 4.3, 5.0].forEach((x, i) => {
    const grp = new THREE.Group();
    const disc = cyl(0.45, 0.45, 0.02, new THREE.MeshStandardMaterial({ color: '#0a0a0a', roughness: 0.4, metalness: 0.3 }));
    disc.rotation.x = Math.PI / 2;
    const label = cyl(0.17, 0.17, 0.022, mat(vinylColors[i]));
    label.rotation.x = Math.PI / 2;
    grp.add(disc, label);
    grp.position.set(x - 0.0, 4.2 - i * 0.05, -ROOM / 2 + 0.06);
    scene.add(grp);
  });
}

// =========================================================
//  REPISAS con plantas y libros (pared izquierda)
// =========================================================
function plant(x, y, z) {
  const g = new THREE.Group();
  const pot = cyl(0.16, 0.12, 0.28, mat('#c1572f'));
  pot.position.y = 0.14;
  g.add(pot);
  const soil = cyl(0.15, 0.15, 0.04, mat('#2d1c10'));
  soil.position.y = 0.28;
  g.add(soil);
  // hojas (conos verdes)
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 8), mat('#2e8b4f'));
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.08, 0.5, Math.sin(a) * 0.08);
    leaf.rotation.z = Math.cos(a) * 0.4;
    leaf.rotation.x = Math.sin(a) * 0.4;
    leaf.castShadow = true;
    g.add(leaf);
  }
  g.position.set(x, y, z);
  return g;
}

function books(x, y, z, n = 5) {
  const g = new THREE.Group();
  const cols = ['#b33', '#39c', '#7b3', '#d92', '#639'];
  let off = 0;
  for (let i = 0; i < n; i++) {
    const w = 0.08 + Math.random() * 0.04;
    const hgt = 0.34 + Math.random() * 0.12;
    const b = box(w, hgt, 0.26, mat(cols[i % cols.length]));
    b.position.set(off + w / 2, hgt / 2, 0);
    g.add(b);
    off += w + 0.012;
  }
  g.position.set(x, y, z);
  return g;
}

function buildShelves() {
  const wx = -ROOM / 2 + 0.18;
  const shelfMat = mat('#8a5a33');
  const heights = [1.4, 2.4, 3.4];
  heights.forEach((hy, idx) => {
    const shelf = box(0.5, 0.08, 3.4, shelfMat, wx, hy, -1.2);
    scene.add(shelf);
    // soportes
    scene.add(box(0.5, 0.05, 0.05, shelfMat, wx, hy - 0.06, -2.8));
    scene.add(box(0.5, 0.05, 0.05, shelfMat, wx, hy - 0.06, 0.4));
    if (idx === 0) {
      const bk = books(wx - 0.18, hy + 0.04, -2.2); bk.rotation.y = Math.PI / 2; scene.add(bk);
      const pl = plant(wx, hy + 0.04, -0.2); scene.add(pl);
    } else if (idx === 1) {
      const pl = plant(wx, hy + 0.04, -2.4); scene.add(pl);
      const bk = books(wx - 0.18, hy + 0.04, -1.2, 4); bk.rotation.y = Math.PI / 2; scene.add(bk);
    } else {
      const bk = books(wx - 0.18, hy + 0.04, -2.4, 6); bk.rotation.y = Math.PI / 2; scene.add(bk);
      const pl = plant(wx, hy + 0.04, -0.6); scene.add(pl);
    }
  });
}

// =========================================================
//  ESCRITORIO ESQUINERO en L (grande)
// =========================================================
function buildDesk() {
  const topMat = mat('#3b2c20', { roughness: 0.6 });
  const legMat = metal('#1b1b1f');
  const g = new THREE.Group();

  // dos tableros en L
  const t1 = box(4.4, 0.12, 1.3, topMat, 0, 1.2, -ROOM / 2 + 0.9);
  const t2 = box(1.3, 0.12, 4.0, topMat, -ROOM / 2 + 0.9, 1.2, -1.0);
  g.add(t1, t2);

  // patas
  const legPos = [
    [-2.0, -ROOM / 2 + 0.4], [2.0, -ROOM / 2 + 0.4],
    [2.0, -ROOM / 2 + 1.4], [-ROOM / 2 + 1.4, -2.8],
    [-ROOM / 2 + 0.4, -2.8], [-ROOM / 2 + 1.4, 0.8],
  ];
  legPos.forEach(([x, z]) => {
    const leg = box(0.1, 1.2, 0.1, legMat, x, 0.6, z);
    g.add(leg);
  });
  scene.add(g);
  registry.deskTopY = 1.26;
}

// =========================================================
//  [1] IMPRESORA 3D  (clic => imprime una pieza capa a capa)
// =========================================================
function buildPrinter() {
  const g = new THREE.Group();
  const frameMat = metal('#20242e');
  // marco cubico tipo CoreXY
  const sz = 1.1;
  const edges = [
    [sz, 0.06, 0.06, 0, sz, 0], [sz, 0.06, 0.06, 0, 0, 0],
    [0.06, sz, 0.06, sz / 2, sz / 2, 0], [0.06, sz, 0.06, -sz / 2, sz / 2, 0],
    [0.06, sz, 0.06, sz / 2, sz / 2, -sz], [0.06, sz, 0.06, -sz / 2, sz / 2, -sz],
    [sz, 0.06, 0.06, 0, sz, -sz], [sz, 0.06, 0.06, 0, 0, -sz],
    [0.06, 0.06, sz, sz / 2, sz, -sz / 2], [0.06, 0.06, sz, -sz / 2, sz, -sz / 2],
    [0.06, 0.06, sz, sz / 2, 0, -sz / 2], [0.06, 0.06, sz, -sz / 2, 0, -sz / 2],
  ];
  edges.forEach(([w, h, d, x, y, z]) => g.add(box(w, h, d, frameMat, x, y, z)));

  // base caliente
  const bed = box(0.9, 0.04, 0.9, mat('#111', { metalness: 0.4, roughness: 0.5 }), 0, 0.08, -sz / 2);
  g.add(bed);

  // cabezal
  const head = box(0.2, 0.18, 0.2, metal('#e23', { emissive: '#300' }), 0, sz * 0.8, -sz / 2);
  g.add(head);
  registry.printerHead = head;

  // pieza que se imprime (escala en Y de 0 a 1)
  const printMat = new THREE.MeshStandardMaterial({ color: '#19f7c8', emissive: '#063', roughness: 0.4 });
  const printed = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.6, 6), printMat);
  printed.position.set(0, 0.1, -sz / 2);
  printed.scale.y = 0.001;
  printed.castShadow = true;
  g.add(printed);
  registry.printedPart = printed;

  g.position.set(1.4, registry.deskTopY, -ROOM / 2 + 0.9);
  scene.add(g);

  makeInteractive(g, 'Impresora 3D',
    'Imprime una pieza capa a capa. El cabezal sube mientras la figura crece. Clic otra vez para reiniciar.',
    () => startPrint());
}

let printing = false;
function startPrint() {
  if (printing) return;
  printing = true;
  const part = registry.printedPart;
  const head = registry.printerHead;
  part.scale.y = 0.001;
  let t = 0;
  const dur = 3.2;
  const baseHeadY = 0.9;
  const fn = (dt) => {
    t += dt;
    const k = Math.min(t / dur, 1);
    part.scale.y = Math.max(0.001, k);
    part.position.y = 0.1 + (0.6 * k) / 2 - 0.3 + 0.3; // crece desde la base
    head.position.y = baseHeadY * 0.9 + k * 0.05;
    // vibracion del cabezal
    head.position.x = Math.sin(t * 40) * 0.015;
    if (k >= 1) {
      printing = false;
      head.position.x = 0;
      return false; // remover animator
    }
    return true;
  };
  animators.push(fn);
}

// =========================================================
//  [2] BRAZO ROBOTICO  (clic => gira la base y articula)
// =========================================================
function buildArm() {
  const g = new THREE.Group();
  const armMat = metal('#ff7a00');
  const jointMat = metal('#333');

  const base = cyl(0.26, 0.3, 0.12, jointMat); base.position.y = 0.06; g.add(base);

  const turret = new THREE.Group(); turret.position.y = 0.12; g.add(turret);
  const col = cyl(0.14, 0.16, 0.3, armMat); col.position.y = 0.15; turret.add(col);

  const upper = new THREE.Group(); upper.position.y = 0.3; turret.add(upper);
  const upperArm = box(0.12, 0.6, 0.12, armMat, 0, 0.3, 0); upper.add(upperArm);
  upper.rotation.z = 0.5;

  const fore = new THREE.Group(); fore.position.y = 0.6; upper.add(fore);
  const foreArm = box(0.1, 0.5, 0.1, armMat, 0, 0.25, 0); fore.add(foreArm);
  fore.rotation.z = -0.9;

  const grip = new THREE.Group(); grip.position.y = 0.5; fore.add(grip);
  grip.add(box(0.05, 0.14, 0.03, jointMat, 0.04, 0.07, 0));
  grip.add(box(0.05, 0.14, 0.03, jointMat, -0.04, 0.07, 0));

  g.position.set(-1.4, registry.deskTopY, -ROOM / 2 + 0.9);
  g.scale.setScalar(0.95);
  scene.add(g);

  registry.armTurret = turret;
  registry.armUpper = upper;
  registry.armFore = fore;

  makeInteractive(g, 'Brazo robotico',
    'Un brazo de 3 ejes. Al hacer clic gira la base y articula los eslabones en una secuencia de "saludo".',
    () => startArm());
}

let armBusy = false;
function startArm() {
  if (armBusy) return;
  armBusy = true;
  let t = 0; const dur = 3.0;
  const turret = registry.armTurret, upper = registry.armUpper, fore = registry.armFore;
  const u0 = upper.rotation.z, f0 = fore.rotation.z;
  const fn = (dt) => {
    t += dt;
    const k = Math.min(t / dur, 1);
    turret.rotation.y = Math.sin(k * Math.PI * 2) * Math.PI * 0.9;
    upper.rotation.z = u0 + Math.sin(k * Math.PI * 4) * 0.35;
    fore.rotation.z = f0 + Math.sin(k * Math.PI * 4 + 1) * 0.5;
    if (k >= 1) { armBusy = false; return false; }
    return true;
  };
  animators.push(fn);
}

// =========================================================
//  [3] ROBOT MOVIL DE ESCRITORIO  (clic => abre consola)
// =========================================================
function buildRobot() {
  const g = new THREE.Group();
  const bodyMat = metal('#d8dde6');
  const accentMat = new THREE.MeshStandardMaterial({ color: '#19f7c8', emissive: '#064', roughness: 0.4 });

  const body = cyl(0.26, 0.3, 0.34, bodyMat); body.position.y = 0.2; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), bodyMat);
  head.position.y = 0.5; head.castShadow = true; g.add(head);
  // visor
  const visor = box(0.3, 0.1, 0.06, new THREE.MeshStandardMaterial({ color: '#06121f', emissive: '#19f7c8', emissiveIntensity: 0.6 }), 0, 0.52, 0.2);
  g.add(visor);
  registry.robotVisor = visor;
  // antena
  const ant = cyl(0.012, 0.012, 0.22, accentMat); ant.position.y = 0.76; g.add(ant);
  const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), accentMat); antTip.position.y = 0.88; g.add(antTip);
  // ruedas
  [-0.2, 0.2].forEach(x => {
    const w = cyl(0.08, 0.08, 0.05, metal('#111')); w.rotation.z = Math.PI / 2; w.position.set(x, 0.06, 0); g.add(w);
  });

  g.position.set(0.1, registry.deskTopY, -ROOM / 2 + 1.1);
  g.scale.setScalar(0.9);
  scene.add(g);
  registry.robot = g;

  makeInteractive(g, 'Robot movil',
    'Un robot de escritorio. Al hacer clic abre su consola: escribe una frase o comando y responde. (Logica avanzada: luego la ampliamos.)',
    () => openRobotConsole());

  // idle flotante leve
  let t = 0;
  animators.push((dt) => {
    t += dt;
    g.position.y = registry.deskTopY + Math.sin(t * 2) * 0.015;
    registry.robotVisor.material.emissiveIntensity = 0.4 + Math.abs(Math.sin(t * 3)) * 0.4;
    return true; // idle permanente
  });
}

// =========================================================
//  [4] LAPTOP + PANTALLA + MOUSE + TECLADO
// =========================================================
function screenTexture(txt) {
  return makeCanvasTexture((g, w, h) => {
    g.fillStyle = '#06121f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#19f7c8'; g.font = 'bold 22px monospace';
    g.fillText('> ' + txt, 16, 40);
    g.fillStyle = '#7fa7b8'; g.font = '15px monospace';
    const lines = ['booting kiroOS v2.0 ...', 'loading drivers ... ok',
      'git status: clean', 'npm run dev', 'listening on :3000', '> _'];
    lines.forEach((l, i) => g.fillText(l, 16, 80 + i * 26));
    // ventana retro
    g.strokeStyle = '#ff3cac'; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h - 12);
  }, 320, 240);
}

function buildLaptop() {
  const gMat = metal('#c9ccd2');
  const laptop = new THREE.Group();
  const base = box(0.9, 0.04, 0.6, gMat, 0, 0.02, 0);
  const lid = new THREE.Group();
  const lidPanel = box(0.9, 0.56, 0.03, gMat, 0, 0.28, 0);
  const lidScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.48),
    new THREE.MeshBasicMaterial({ map: screenTexture('laptop') }));
  lidScreen.position.set(0, 0.28, 0.02);
  lid.add(lidPanel, lidScreen);
  lid.position.z = -0.3;
  lid.rotation.x = -0.2;
  laptop.add(base, lid);
  // teclado dibujado
  const kb = box(0.8, 0.012, 0.42, mat('#1b1d24'), 0, 0.045, 0.06);
  laptop.add(kb);
  laptop.position.set(-0.5, registry.deskTopY, -ROOM / 2 + 1.0);
  laptop.rotation.y = 0.3;
  scene.add(laptop);

  // Monitor externo conectado
  const monitor = new THREE.Group();
  const mStand = box(0.1, 0.4, 0.1, gMat, 0, 0.2, 0);
  const mBaseP = box(0.5, 0.03, 0.3, gMat, 0, 0.02, 0);
  const mPanel = box(1.3, 0.8, 0.05, mat('#111'), 0, 0.85, 0);
  const mScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7),
    new THREE.MeshBasicMaterial({ map: screenTexture('monitor') }));
  mScreen.position.set(0, 0.85, 0.03);
  monitor.add(mStand, mBaseP, mPanel, mScreen);
  monitor.position.set(-1.5, registry.deskTopY, -ROOM / 2 + 0.9);
  monitor.rotation.y = 0.25;
  scene.add(monitor);
  registry.monitorScreen = mScreen;

  // Mouse y mousepad
  const pad = box(0.3, 0.008, 0.24, mat('#15324a'), 0.25, registry.deskTopY + 0.005, -ROOM / 2 + 1.5);
  scene.add(pad);
  const mouse = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), mat('#222'));
  mouse.scale.set(1, 0.6, 1.4);
  mouse.position.set(0.25, registry.deskTopY + 0.04, -ROOM / 2 + 1.5);
  mouse.castShadow = true;
  scene.add(mouse);

  makeInteractive(laptop, 'Laptop + setup',
    'Laptop con monitor externo, teclado y mouse. Al hacer clic la pantalla cambia. (Interaccion avanzada: luego la ampliamos.)',
    () => {
      const msgs = ['hola kamil', 'compilando...', 'tests 12/12 OK', 'deploy :3000', 'git push'];
      const pick = msgs[Math.floor(Math.random() * msgs.length)];
      registry.monitorScreen.material.map = screenTexture(pick);
      registry.monitorScreen.material.needsUpdate = true;
    });
}

// =========================================================
//  [5] LEGO  (clic => se arma solo, piezas suben a su sitio)
// =========================================================
function buildLego() {
  const g = new THREE.Group();
  const cols = ['#d32', '#2a6', '#39c', '#ec3', '#92c'];
  const bricks = [];
  // definimos una torrecita 2x2 de 5 pisos
  let idx = 0;
  for (let y = 0; y < 5; y++) {
    for (let bx = 0; bx < 2; bx++) {
      for (let bz = 0; bz < 2; bz++) {
        const brickGrp = new THREE.Group();
        const b = box(0.18, 0.1, 0.18, mat(cols[y % cols.length]));
        brickGrp.add(b);
        // studs
        for (let sx = -1; sx <= 1; sx += 2)
          for (let sz = -1; sz <= 1; sz += 2) {
            const stud = cyl(0.03, 0.03, 0.03, mat(cols[y % cols.length]), 10);
            stud.position.set(sx * 0.045, 0.065, sz * 0.045);
            brickGrp.add(stud);
          }
        const targetY = 0.06 + y * 0.1;
        const targetX = (bx - 0.5) * 0.19;
        const targetZ = (bz - 0.5) * 0.19;
        brickGrp.userData.target = new THREE.Vector3(targetX, targetY, targetZ);
        // posicion inicial "desarmado": disperso alrededor
        const a = idx * 1.3;
        brickGrp.position.set(Math.cos(a) * 0.9, 0.02, Math.sin(a) * 0.9);
        brickGrp.userData.start = brickGrp.position.clone();
        brickGrp.userData.order = idx;
        g.add(brickGrp);
        bricks.push(brickGrp);
        idx++;
      }
    }
  }
  g.position.set(1.0, registry.deskTopY, -ROOM / 2 + 1.55);
  g.scale.setScalar(1.1);
  scene.add(g);
  registry.legoBricks = bricks;

  makeInteractive(g, 'LEGO auto-ensamblable',
    'Piezas dispersas que se ensamblan solas en una torre, una tras otra, al hacer clic. Clic de nuevo para desarmar y repetir.',
    () => toggleLego());
}

let legoBuilt = false, legoBusy = false;
function toggleLego() {
  if (legoBusy) return;
  legoBusy = true;
  const bricks = registry.legoBricks;
  const assembling = !legoBuilt;
  let t = 0;
  const perBrick = 0.18, settle = 0.5;
  const fn = (dt) => {
    t += dt;
    let allDone = true;
    bricks.forEach(b => {
      const startAt = b.userData.order * perBrick;
      const k = Math.min(Math.max((t - startAt) / settle, 0), 1);
      const ease = 1 - Math.pow(1 - k, 3);
      const from = assembling ? b.userData.start : b.userData.target;
      const to   = assembling ? b.userData.target : b.userData.start;
      b.position.lerpVectors(from, to, ease);
      b.rotation.y = (1 - ease) * (assembling ? 6 : -6);
      if (k < 1) allDone = false;
    });
    if (allDone) {
      legoBuilt = assembling;
      legoBusy = false;
      return false;
    }
    return true;
  };
  animators.push(fn);
}

// =========================================================
//  [6] ESTACION DE SOLDADURA (protoboard, micro, sensores)
//      clic => sale humo del cautin
// =========================================================
function buildSolder() {
  const g = new THREE.Group();

  // protoboard
  const proto = box(0.7, 0.05, 0.45, mat('#f2f2ea'), 0, 0.03, 0);
  g.add(proto);
  // filas de agujeros (puntitos)
  for (let i = 0; i < 10; i++)
    for (let j = 0; j < 6; j++) {
      const hole = box(0.015, 0.01, 0.015, mat('#999'), -0.3 + i * 0.065, 0.06, -0.18 + j * 0.07);
      g.add(hole);
    }
  // microcontrolador (tipo arduino)
  const mcu = box(0.28, 0.04, 0.2, mat('#0a6b4f'), 0.0, 0.08, 0.28);
  g.add(mcu);
  const usb = metal('#bbb'); g.add(box(0.08, 0.05, 0.06, usb, -0.12, 0.09, 0.38));
  // chip
  g.add(box(0.08, 0.03, 0.08, mat('#111'), 0.03, 0.1, 0.28));
  // LEDs sensores
  ['#f33', '#3f3', '#39f'].forEach((c, i) => {
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 10),
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.8 }));
    led.position.set(0.08 + i * 0.05, 0.11, 0.22);
    g.add(led);
  });
  // cables (curvas simples)
  ['#e33', '#33e', '#ee3'].forEach((c, i) => {
    const cable = cyl(0.008, 0.008, 0.3, mat(c));
    cable.position.set(-0.1 + i * 0.05, 0.12, 0.15);
    cable.rotation.x = Math.PI / 3;
    g.add(cable);
  });

  // cautin / soldador
  const ironStand = box(0.1, 0.02, 0.2, metal('#444'), -0.4, 0.04, 0.25); g.add(ironStand);
  const ironHandle = cyl(0.03, 0.03, 0.26, mat('#1b63c4')); ironHandle.rotation.z = 0.9;
  ironHandle.position.set(-0.32, 0.18, 0.25); g.add(ironHandle);
  const ironTip = cyl(0.008, 0.02, 0.12, metal('#c8803a'));
  ironTip.rotation.z = 0.9; ironTip.position.set(-0.17, 0.26, 0.25); g.add(ironTip);
  registry.ironTipPos = new THREE.Vector3(-0.1, 0.33, 0.25);

  g.position.set(-0.3, registry.deskTopY, -ROOM / 2 + 1.7);
  g.scale.setScalar(1.0);
  scene.add(g);
  registry.solderGroup = g;

  // sistema de humo (sprites) — oculto hasta clic
  const smokeTex = makeCanvasTexture((gx, w, h) => {
    const grad = gx.createRadialGradient(w/2, h/2, 2, w/2, h/2, w/2);
    grad.addColorStop(0, 'rgba(220,220,220,0.9)');
    grad.addColorStop(1, 'rgba(220,220,220,0)');
    gx.fillStyle = grad; gx.fillRect(0, 0, w, h);
  }, 64, 64);
  const smokeGroup = new THREE.Group();
  g.add(smokeGroup);
  const puffs = [];
  for (let i = 0; i < 14; i++) {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: smokeTex, transparent: true, opacity: 0, depthWrite: false
    }));
    spr.scale.setScalar(0.12);
    spr.position.copy(registry.ironTipPos);
    spr.userData = { life: 0, active: false };
    smokeGroup.add(spr);
    puffs.push(spr);
  }
  registry.smokePuffs = puffs;

  makeInteractive(g, 'Estacion de soldadura',
    'Protoboard, microcontrolador, LEDs/sensores y cautin. Al hacer clic el cautin "suelda" y sale humo durante unos segundos.',
    () => startSolder());
}

let soldering = false;
function startSolder() {
  if (soldering) return;
  soldering = true;
  const puffs = registry.smokePuffs;
  let t = 0, emitTimer = 0;
  const duration = 4.0;
  const fn = (dt) => {
    t += dt; emitTimer += dt;
    // emitir una bocanada cada ~0.18s mientras dura
    if (t < duration && emitTimer > 0.18) {
      emitTimer = 0;
      const free = puffs.find(p => !p.userData.active);
      if (free) {
        free.userData.active = true;
        free.userData.life = 0;
        free.position.copy(registry.ironTipPos);
        free.position.x += (Math.random() - 0.5) * 0.03;
        free.material.opacity = 0.8;
        free.scale.setScalar(0.1);
      }
    }
    // animar bocanadas
    puffs.forEach(p => {
      if (!p.userData.active) return;
      p.userData.life += dt;
      p.position.y += dt * 0.35;
      p.position.x += Math.sin(p.userData.life * 4) * dt * 0.05;
      p.scale.setScalar(0.1 + p.userData.life * 0.22);
      p.material.opacity = Math.max(0, 0.8 - p.userData.life * 0.5);
      if (p.userData.life > 1.6) { p.userData.active = false; p.material.opacity = 0; }
    });
    const anyActive = puffs.some(p => p.userData.active);
    if (t >= duration && !anyActive) { soldering = false; return false; }
    return true;
  };
  animators.push(fn);
}

// =========================================================
//  SILLA (ambientacion)
// =========================================================
function buildChair() {
  const g = new THREE.Group();
  const m = mat('#222');
  g.add(cyl(0.04, 0.04, 0.5, metal('#111')));         // columna
  const seat = box(0.6, 0.1, 0.6, m, 0, 0.55, 0); g.add(seat);
  const back = box(0.6, 0.7, 0.1, m, 0, 0.95, -0.28); g.add(back);
  // base 5 patas
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leg = box(0.4, 0.04, 0.06, metal('#111'), Math.cos(a) * 0.2, 0.04, Math.sin(a) * 0.2);
    leg.rotation.y = -a; g.add(leg);
  }
  g.position.set(-0.5, 0, -2.2);
  scene.add(g);
}

// =========================================================
//  RAYCASTING: hover + click
// =========================================================
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hovered = null;

function resolveRoot(obj) {
  // sube hasta el mesh/grupo marcado interactivo
  let o = obj;
  while (o) {
    if (o.userData && o.userData.interactive) return o;
    if (o.userData && o.userData.rootInteractive) return o.userData.rootInteractive;
    o = o.parent;
  }
  return null;
}

function updatePointer(e) {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

function onMove(e) {
  updatePointer(e);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(clickable, true);
  const root = hits.length ? resolveRoot(hits[0].object) : null;
  if (root !== hovered) {
    if (hovered) setGlow(hovered, false);
    hovered = root;
    if (hovered) setGlow(hovered, true);
    canvas.style.cursor = hovered ? 'pointer' : 'default';
  }
}

function setGlow(root, on) {
  root.traverse((o) => {
    if (o.isMesh && o.material && o.material.emissive) {
      if (on) {
        if (!o.userData._savedEmissive) {
          o.userData._savedEmissive = o.material.emissive.getHex();
          o.userData._savedInt = o.material.emissiveIntensity ?? 1;
        }
        o.material.emissive.setHex(0x19f7c8);
        o.material.emissiveIntensity = 0.35;
      } else if (o.userData._savedEmissive !== undefined) {
        o.material.emissive.setHex(o.userData._savedEmissive);
        o.material.emissiveIntensity = o.userData._savedInt;
        delete o.userData._savedEmissive;
        delete o.userData._savedInt;
      }
    }
  });
}

function onClick(e) {
  updatePointer(e);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(clickable, true);
  if (!hits.length) return;
  const root = resolveRoot(hits[0].object);
  if (!root) return;
  showInfo(root.userData.name, root.userData.info);
  if (typeof root.userData.onClick === 'function') root.userData.onClick();
}

canvas.addEventListener('pointermove', onMove);
canvas.addEventListener('click', onClick);

// =========================================================
//  UI: tarjeta de info + consola del robot
// =========================================================
const infoCard = document.getElementById('infocard');
document.getElementById('infoClose').onclick = () => infoCard.classList.add('hidden');
function showInfo(title, body) {
  document.getElementById('infoTitle').textContent = title;
  document.getElementById('infoBody').textContent = body;
  infoCard.classList.remove('hidden');
}

const robotConsole = document.getElementById('robotConsole');
const rcLog = document.getElementById('rcLog');
const rcInput = document.getElementById('rcInput');
document.getElementById('rcClose').onclick = () => robotConsole.classList.add('hidden');
function openRobotConsole() {
  robotConsole.classList.remove('hidden');
  rcInput.focus();
  if (!rcLog.dataset.greeted) {
    logBot('ROBOT-UNIT en linea. Escribe "ayuda".');
    rcLog.dataset.greeted = '1';
  }
}
function logUser(t) { rcLog.innerHTML += `<div class="user">&gt; ${escapeHtml(t)}</div>`; rcLog.scrollTop = rcLog.scrollHeight; }
function logBot(t)  { rcLog.innerHTML += `<div class="bot">${escapeHtml(t)}</div>`;      rcLog.scrollTop = rcLog.scrollHeight; }
function escapeHtml(s){ return s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

rcInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const cmd = rcInput.value.trim();
  if (!cmd) return;
  logUser(cmd);
  rcInput.value = '';
  handleRobotCommand(cmd.toLowerCase());
});

// Logica basica del robot (placeholder ampliable)
function handleRobotCommand(cmd) {
  if (cmd.includes('ayuda')) {
    logBot('comandos: hola | baila | girar | color <nombre> | salta | ayuda');
  } else if (cmd.includes('hola')) {
    logBot('Hola! Soy tu robot de escritorio.');
    robotHop();
  } else if (cmd.includes('baila')) {
    logBot('A bailar! *beep boop*');
    robotDance();
  } else if (cmd.includes('girar') || cmd.includes('gira')) {
    logBot('Girando 360...');
    robotSpin();
  } else if (cmd.startsWith('color')) {
    const name = cmd.replace('color', '').trim();
    const map = { rojo:'#f33', verde:'#3f3', azul:'#39f', amarillo:'#ffd166', rosa:'#ff3cac', cyan:'#19f7c8' };
    const hex = map[name];
    if (hex) { registry.robotVisor.material.emissive.set(hex); logBot('visor -> ' + name); }
    else logBot('no conozco ese color. prueba: rojo, verde, azul, amarillo, rosa, cyan');
  } else if (cmd.includes('salta')) {
    logBot('hop!'); robotHop();
  } else {
    logBot('no entiendo "' + cmd + '". escribe "ayuda".');
  }
}

function robotSpin() {
  const g = registry.robot; let t = 0; const dur = 1.2; const y0 = g.rotation.y;
  animators.push((dt) => { t += dt; const k = Math.min(t/dur,1); g.rotation.y = y0 + k*Math.PI*2; if(k>=1){g.rotation.y=y0;return false;} return true; });
}
function robotHop() {
  const g = registry.robot; let t = 0; const dur = 0.6;
  animators.push((dt) => { t += dt; const k = Math.min(t/dur,1); g.position.y = registry.deskTopY + Math.sin(k*Math.PI)*0.25; if(k>=1){return false;} return true; });
}
function robotDance() {
  const g = registry.robot; let t = 0; const dur = 2.4;
  animators.push((dt) => { t += dt; const k=Math.min(t/dur,1);
    g.position.y = registry.deskTopY + Math.abs(Math.sin(t*8))*0.12;
    g.rotation.z = Math.sin(t*10)*0.15;
    if(k>=1){g.rotation.z=0;return false;} return true; });
}

// =========================================================
//  BUILD ALL
// =========================================================
function buildAll() {
  buildRoom();
  buildPosters();
  buildShelves();
  buildDesk();
  buildChair();
  buildPrinter();
  buildArm();
  buildRobot();
  buildLaptop();
  buildLego();
  buildSolder();
}

// =========================================================
//  LOADER simulado + arranque
// =========================================================
const loaderFill = document.querySelector('.loader-fill');
const loaderEl = document.getElementById('loader');
let lp = 0;
const loaderInt = setInterval(() => {
  lp += Math.random() * 18 + 6;
  loaderFill.style.width = Math.min(lp, 100) + '%';
  if (lp >= 100) {
    clearInterval(loaderInt);
    setTimeout(() => loaderEl.classList.add('gone'), 300);
  }
}, 140);

buildAll();

// =========================================================
//  RESIZE + LOOP
// =========================================================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  // ejecutar animadores, quitar los que terminaron
  for (let i = animators.length - 1; i >= 0; i--) {
    const keep = animators[i](dt);
    if (keep === false) animators.splice(i, 1);
  }
  controls.update();
  renderer.render(scene, camera);
}
animate();
