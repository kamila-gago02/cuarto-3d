// =========================================================
//  MI CUARTO 3D  —  chic geek room
//  Avatar personalizable, 1a/3a persona, cuarto completo
//  caminable con colisiones. Geometria primitiva + Three.js.
// =========================================================
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// =========================================================
//  PALETA (identidad chic-geek: lila, rosa, cian + neutros)
// =========================================================
const PAL = {
  lila:      '#b98fe0',
  lilaSoft:  '#a97fd4',
  lilaPale:  '#e7ddf5',
  rosa:      '#ff4fa3',
  rosaNeon:  '#ff6ec7',
  cian:      '#4de0d0',
  cianNeon:  '#5ad1ff',
  amber:     '#ffd98a',
  blanco:    '#f4f1fb',
  neutro:    '#cfcfd6',
  madera:    '#c98a4e',
  maderaDk:  '#7a5230',
  piso:      '#caa06e',
  ink:       '#15161c',
};

// Capa de BLOOM selectivo (solo lo que pongamos en esta capa brilla)
const BLOOM_LAYER = 1;
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_LAYER);
function markBloom(obj){ obj.traverse(o=>{ if(o.isMesh||o.isSprite||o.isPoints) o.layers.enable(BLOOM_LAYER); }); if(obj.isMesh||obj.isSprite) obj.layers.enable(BLOOM_LAYER); }

// ---------- Estado global ----------
const clickable  = [];   // meshes interactivos (raycast)
const animators  = [];   // funciones update(dt)
const colliders  = [];   // {box:Box3} para colision del avatar
const registry   = {};

// ======== ENLACES DE APPS (editar con tus datos) ========
const APP_LINKS = {
  music:    'https://open.spotify.com/',
  linkedin: 'https://www.linkedin.com/',
  shop:     'https://www.amazon.com/',
};

// ======== Config avatar (desde la pantalla de inicio) ========
const AVATAR = { name: 'kamil', skin: '#e8b48c', hair: '#3a2a1a', shirt: '#ff4fa3', pants: '#2b3a6b' };

// =========================================================
//  RENDERER / ESCENA
// =========================================================
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false }); // AA lo hace SMAA en el composer
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#d9c7f0');
// niebla atmosferica MUY ligera (profundidad en las esquinas)
scene.fog = new THREE.Fog('#cdbce8', 16, 34);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// =========================================================
//  CAMARA + CONTROL DE PERSONAJE (1a / 3a persona)
// =========================================================
const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.05, 100);

const ROOM = 12, WALL_H = 6, HALF = ROOM/2;

// jugador
const player = {
  pos: new THREE.Vector3(2.5, 0, 3.0),
  yaw: Math.PI,          // mirando -Z
  pitch: 0,
  speed: 3.2,
  radius: 0.35,
  height: 1.7,
  thirdPerson: true,
};
let pointerLocked = false;

// avatar (grupo 3D)
let avatar = null;

// zoom cinematografico (solo 3a persona): al interactns se acerca al objeto
const camZoom = { active: false, t: 0, dur: 0.7, from: new THREE.Vector3(), to: new THREE.Vector3(), fromTgt: new THREE.Vector3(), toTgt: new THREE.Vector3(), hold: 0 };

// =========================================================
//  LUCES (simplificadas): 1 clave direccional con sombra,
//  hemisferica suave de relleno y el environment map (IBL).
//  Sin AmbientLight (lo cubre hemi+IBL). PointLights sin sombra.
// =========================================================
const sunHemi = new THREE.HemisphereLight('#fff6e8', '#b9a0d8', 0.85);
scene.add(sunHemi);

const sun = new THREE.DirectionalLight('#fff2d0', 2.6);
sun.position.set(-8, 10, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 40;
sun.shadow.camera.left=-12; sun.shadow.camera.right=12; sun.shadow.camera.top=12; sun.shadow.camera.bottom=-12;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun);
registry.sun = sun; registry.sunHemi = sunHemi;

// LED strips chic geek (color de ambiente, SIN sombras — baratas)
const ledPink = new THREE.PointLight(PAL.rosaNeon, 0.6, 14); ledPink.position.set(-4, 3.6, -2); scene.add(ledPink);
const ledCyan = new THREE.PointLight(PAL.cianNeon, 0.5, 14); ledCyan.position.set(4, 3.2, -3.5); scene.add(ledCyan);
registry.leds = [ledPink, ledCyan];

// lampara de escritorio (controlable) — SIN sombra (era el point-light caro)
const deskLampLight = new THREE.PointLight('#ffd9a0', 0.0, 6, 2);
deskLampLight.position.set(-2.0, 2.6, -3.6);
scene.add(deskLampLight); registry.deskLampLight = deskLampLight;

// =========================================================
//  HELPERS
// =========================================================
const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...opts });
const metal = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.9, ...opts });
// material para HITBOXES de raycast: transparente pero SI raycasteable
// (un mesh con visible:false es ignorado por el Raycaster; opacity:0 no lo es)
const hitboxMat = () => new THREE.MeshBasicMaterial({ transparent:true, opacity:0, depthWrite:false });

// PRNG determinista (mulberry32) — texturas reproducibles sin repeticion obvia
function makeRng(seed){ let a=seed>>>0; return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }

// caja con bordes redondeados (elimina el look "caja CG").
// radio proporcional al lado menor, con tope pequeno; cae a BoxGeometry si es muy fina.
const _boxCache = new Map();
function box(w,h,d,material,x=0,y=0,z=0){
  const minDim=Math.min(w,h,d);
  let geo;
  if(minDim < 0.06){ geo=new THREE.BoxGeometry(w,h,d); }
  else {
    const r=Math.min(0.04, minDim*0.18);
    const key=`${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}_${r.toFixed(3)}`;
    geo=_boxCache.get(key);
    if(!geo){ geo=new RoundedBoxGeometry(w,h,d,2,r); _boxCache.set(key,geo); }
  }
  const m=new THREE.Mesh(geo,material); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; return m;
}
function cyl(rt,rb,h,material,seg=24){ const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),material); m.castShadow=true; m.receiveShadow=true; return m; }

function makeCanvasTexture(draw,w=256,h=256){ const c=document.createElement('canvas'); c.width=w;c.height=h; const g=c.getContext('2d'); draw(g,w,h); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return t; }
// textura lineal (normal/roughness NO van en sRGB)
function makeDataTexture(draw,w=256,h=256){ const c=document.createElement('canvas'); c.width=w;c.height=h; const g=c.getContext('2d'); draw(g,w,h); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.NoColorSpace; t.anisotropy=8; return t; }
function roundRect(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }

// registra un collider AABB a partir de un mesh/caja en world
function addCollider(obj, pad=0){ obj.updateWorldMatrix(true,false); const b=new THREE.Box3().setFromObject(obj); b.expandByScalar(pad); colliders.push({box:b}); }

function makeInteractive(root, cfg){
  root.userData.interactive=true; root.userData.name=cfg.name; root.userData.info=cfg.info;
  root.userData.onClick=cfg.onClick; root.userData.focus=cfg.focus;
  root.traverse(o=>{ if(o.isMesh){ o.userData.rootInteractive=root; clickable.push(o); } });
  if(root.isMesh) clickable.push(root);
  return root;
}


// =========================================================
//  CUARTO CERRADO (4 paredes + techo + piso)
// =========================================================
function buildRoom(){
  // ---- Piso parquet DETERMINISTA (semilla fija) con color+roughness+normal ----
  const PW=1024, PH=1024, rows=8, cols=4, plankW=PW/cols, plankH=PH/rows;
  const rng=makeRng(13377);
  // color
  const plankTex = makeCanvasTexture((g,w,h)=>{
    g.fillStyle=PAL.piso; g.fillRect(0,0,w,h);
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const offset=(row%2)*(plankW/2);
      const x=((col*plankW+offset)%w), y=row*plankH;
      const s=168+Math.floor(rng()*46);
      const r=s, gg=Math.floor(s*0.68+rng()*8), b=Math.floor(s*0.42+rng()*6);
      g.fillStyle=`rgb(${r},${gg},${b})`; g.fillRect(x+1,y+1,plankW-2,plankH-2);
      if(x+plankW>w){ g.fillRect(x-w+1,y+1,plankW-2,plankH-2); }
      // vetas
      g.strokeStyle=`rgba(90,55,20,${0.08+rng()*0.1})`; g.lineWidth=1;
      for(let v=0;v<5;v++){ const vy=y+6+v*(plankH/6)+rng()*4; g.beginPath(); g.moveTo(x+2,vy); g.bezierCurveTo(x+plankW*0.3,vy+2,x+plankW*0.6,vy-2,x+plankW-2,vy); g.stroke(); }
    }
    g.strokeStyle='rgba(60,35,12,0.35)'; g.lineWidth=2;
    for(let i=0;i<=rows;i++){ g.beginPath(); g.moveTo(0,i*plankH); g.lineTo(w,i*plankH); g.stroke(); }
  },PW,PH);
  // roughness: tablones ligeramente distintos + brillo en juntas
  const rng2=makeRng(13377);
  const plankRough = makeDataTexture((g,w,h)=>{
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const offset=(row%2)*(plankW/2); const x=((col*plankW+offset)%w), y=row*plankH;
      const v=150+Math.floor(rng2()*70); g.fillStyle=`rgb(${v},${v},${v})`; g.fillRect(x,y,plankW,plankH);
    }
    g.strokeStyle='rgba(60,60,60,1)'; g.lineWidth=3; // juntas mas pulidas (mas oscuro = menos rough)
    for(let i=0;i<=rows;i++){ g.beginPath(); g.moveTo(0,i*plankH); g.lineTo(w,i*plankH); g.stroke(); }
  },PW,PH);
  // normal: relieve en las juntas
  const plankNormal = makeDataTexture((g,w,h)=>{
    g.fillStyle='rgb(128,128,255)'; g.fillRect(0,0,w,h);
    g.strokeStyle='rgb(128,180,220)'; g.lineWidth=2;
    for(let i=0;i<=rows;i++){ g.beginPath(); g.moveTo(0,i*plankH); g.lineTo(w,i*plankH); g.stroke(); }
    g.strokeStyle='rgb(128,80,220)'; g.lineWidth=2;
    for(let i=0;i<=rows;i++){ g.beginPath(); g.moveTo(0,i*plankH+2); g.lineTo(w,i*plankH+2); g.stroke(); }
  },PW,PH);
  [plankTex,plankRough,plankNormal].forEach(t=>{ t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(2,2); });
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(ROOM,ROOM), new THREE.MeshStandardMaterial({
    map:plankTex, roughnessMap:plankRough, normalMap:plankNormal, normalScale:new THREE.Vector2(0.4,0.4), roughness:0.7, metalness:0.0 }));
  floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);

  // ---- Techo ----
  const ceil=new THREE.Mesh(new THREE.PlaneGeometry(ROOM,ROOM), mat(PAL.lilaPale,{roughness:1}));
  ceil.rotation.x=Math.PI/2; ceil.position.y=WALL_H; scene.add(ceil);
  // plafon de luz (brilla con bloom)
  const plafon=box(1.4,0.06,1.4, new THREE.MeshStandardMaterial({color:'#fff',emissive:'#fff',emissiveIntensity:0.9}), 0,WALL_H-0.05,0);
  scene.add(plafon); markBloom(plafon);

  // ---- Paredes LILAS (4) con leve textura de pintura (normal sutil) ----
  const wallNormal = makeDataTexture((g,w,h)=>{ g.fillStyle='rgb(128,128,255)'; g.fillRect(0,0,w,h);
    const r=makeRng(7); for(let i=0;i<2500;i++){ const x=r()*w,y=r()*h,a=r()*0.08; g.fillStyle=`rgba(128,128,255,1)`; g.fillStyle=`rgb(${120+Math.floor(r()*16)},${120+Math.floor(r()*16)},255)`; g.fillRect(x,y,2,2);} },256,256);
  wallNormal.wrapS=wallNormal.wrapT=THREE.RepeatWrapping; wallNormal.repeat.set(4,2);
  const wallMat = new THREE.MeshStandardMaterial({ color:PAL.lila, roughness:0.96, metalness:0.0, side:THREE.FrontSide, normalMap:wallNormal, normalScale:new THREE.Vector2(0.15,0.15) });
  const wallSoft= new THREE.MeshStandardMaterial({ color:PAL.lilaSoft, roughness:0.96, metalness:0.0, side:THREE.FrontSide, normalMap:wallNormal, normalScale:new THREE.Vector2(0.15,0.15) });
  // back -Z
  const back=new THREE.Mesh(new THREE.PlaneGeometry(ROOM,WALL_H),wallMat); back.position.set(0,WALL_H/2,-HALF); back.receiveShadow=true; scene.add(back);
  // front +Z (mira hacia -Z interior)
  const front=new THREE.Mesh(new THREE.PlaneGeometry(ROOM,WALL_H),wallSoft); front.position.set(0,WALL_H/2,HALF); front.rotation.y=Math.PI; front.receiveShadow=true; scene.add(front);
  // left -X
  const left=new THREE.Mesh(new THREE.PlaneGeometry(ROOM,WALL_H),wallSoft); left.rotation.y=Math.PI/2; left.position.set(-HALF,WALL_H/2,0); left.receiveShadow=true; scene.add(left);
  // right +X
  const right=new THREE.Mesh(new THREE.PlaneGeometry(ROOM,WALL_H),wallMat); right.rotation.y=-Math.PI/2; right.position.set(HALF,WALL_H/2,0); right.receiveShadow=true; scene.add(right);

  // colliders de paredes (finos, en el borde)
  [[0,-HALF,ROOM,0.3],[0,HALF,ROOM,0.3],[-HALF,0,0.3,ROOM],[HALF,0,0.3,ROOM]].forEach(([x,z,w,d])=>{
    const c=box(w,WALL_H,d, new THREE.MeshBasicMaterial({visible:false}), x,WALL_H/2,z); scene.add(c); addCollider(c);
  });

  // zocalos + molduras claras
  const skirt=mat('#efe6fb',{roughness:0.6});
  scene.add(box(ROOM,0.26,0.06,skirt,0,0.13,-HALF+0.03));
  scene.add(box(0.06,0.26,ROOM,skirt,-HALF+0.03,0.13,0));
  scene.add(box(ROOM,0.26,0.06,skirt,0,0.13,HALF-0.03));
  scene.add(box(0.06,0.26,ROOM,skirt,HALF-0.03,0.13,0));

  // ---- Alfombra PELUDA ----
  buildFluffyRug(0.2, 0.012, 2.1, 2.6);

  // ---- Guirnalda de luces (string lights) en pared back: chic geek (bloom) ----
  for(let i=0;i<14;i++){ const b=new THREE.Mesh(new THREE.SphereGeometry(0.04,8,8),
    new THREE.MeshStandardMaterial({color:'#ffd98a',emissive:'#ffcf6a',emissiveIntensity:1.4}));
    b.position.set(-5+i*0.75, 5.1 + Math.sin(i)*0.12, -HALF+0.1); scene.add(b); markBloom(b); }

  // cuadro motivacional / poster pequeno con cita
  const quoteTex=makeCanvasTexture((g,w,h)=>{ g.fillStyle='#fff6e8'; g.fillRect(0,0,w,h);
    g.fillStyle='#8a6bff'; g.font='bold 22px Georgia'; g.textAlign='center';
    g.fillText('stay',w/2,h*0.4); g.fillText('curious',w/2,h*0.6);
    g.strokeStyle='#ff4fa3'; g.lineWidth=8; g.strokeRect(10,10,w-20,h-20); },220,160);
  const quote=new THREE.Mesh(new THREE.PlaneGeometry(1.0,0.72), new THREE.MeshStandardMaterial({map:quoteTex,roughness:0.9}));
  quote.position.set(3.4,2.4,-HALF+0.06); scene.add(quote);
}

// alfombra peluda: muchas briznas (instancias simples) sobre un disco base
function buildFluffyRug(cx, y, rx, rz){
  const base=new THREE.Mesh(new THREE.CircleGeometry(2.55,48),
    new THREE.MeshStandardMaterial({color:'#f2d8e8',roughness:1}));
  base.rotation.x=-Math.PI/2; base.position.set(0,y,2.0); base.receiveShadow=true; scene.add(base);
  // borde mas oscuro
  const ring=new THREE.Mesh(new THREE.RingGeometry(2.3,2.55,48),
    new THREE.MeshStandardMaterial({color:'#e3b8d4',roughness:1,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2; ring.position.set(0,y+0.001,2.0); scene.add(ring);

  // briznas: conos finos distribuidos en el disco con InstancedMesh
  const n=1400;
  const geo=new THREE.ConeGeometry(0.02,0.1,5);
  const fluffMat=new THREE.MeshStandardMaterial({color:'#fbe3ef',roughness:1});
  const inst=new THREE.InstancedMesh(geo,fluffMat,n);
  const dummy=new THREE.Object3D();
  let k=0;
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, r=Math.sqrt(Math.random())*2.45;
    const px=Math.cos(a)*r, pz=2.0+Math.sin(a)*r;
    dummy.position.set(px, y+0.05, pz);
    dummy.rotation.set((Math.random()-0.5)*0.4, Math.random()*Math.PI, (Math.random()-0.5)*0.4);
    const s=0.7+Math.random()*0.7; dummy.scale.set(s,s,s);
    dummy.updateMatrix(); inst.setMatrixAt(k++, dummy.matrix);
    // alterna color
    if(i%5===0) inst.setColorAt(i, new THREE.Color('#f6c9e2'));
  }
  inst.instanceMatrix.needsUpdate=true; inst.castShadow=false; inst.receiveShadow=true;
  scene.add(inst);
}


// =========================================================
//  VENTANAS con cortinas + dia soleado  (interactivas)
// =========================================================
function sunnyOutsideTexture(){
  return makeCanvasTexture((g,w,h)=>{
    const grad=g.createLinearGradient(0,0,0,h); grad.addColorStop(0,'#5fb8ff'); grad.addColorStop(0.7,'#bfe6ff'); grad.addColorStop(1,'#d8f0d0');
    g.fillStyle=grad; g.fillRect(0,0,w,h);
    // sol
    g.fillStyle='#fff6b0'; g.beginPath(); g.arc(w*0.72,h*0.26,34,0,7); g.fill();
    g.strokeStyle='rgba(255,246,160,0.6)'; g.lineWidth=4;
    for(let i=0;i<12;i++){ const a=i/12*Math.PI*2; g.beginPath(); g.moveTo(w*0.72+Math.cos(a)*42,h*0.26+Math.sin(a)*42); g.lineTo(w*0.72+Math.cos(a)*58,h*0.26+Math.sin(a)*58); g.stroke(); }
    // nubes
    g.fillStyle='rgba(255,255,255,0.9)';
    [[0.25,0.3,30],[0.4,0.22,22],[0.15,0.45,26]].forEach(([x,y,r])=>{ g.beginPath(); g.arc(w*x,h*y,r,0,7); g.arc(w*x+r*0.8,h*y,r*0.8,0,7); g.arc(w*x-r*0.7,h*y,r*0.7,0,7); g.fill(); });
    // colinas
    g.fillStyle='#8fd07a'; g.beginPath(); g.moveTo(0,h); g.quadraticCurveTo(w*0.3,h*0.7,w*0.6,h*0.85); g.quadraticCurveTo(w*0.8,h*0.95,w,h*0.8); g.lineTo(w,h); g.fill();
  },256,256);
}

function makeWindow(wallSide, zx, cfgName){
  // wallSide: 'back'(-Z) o 'right'(+X). Construimos ventana + marco + cortinas abribles
  const grp=new THREE.Group();
  const W=2.6, Hh=1.9;
  const sky=new THREE.Mesh(new THREE.PlaneGeometry(W,Hh), new THREE.MeshBasicMaterial({map:sunnyOutsideTexture()}));
  grp.add(sky);
  const frameMat=mat('#ffffff',{roughness:0.5});
  grp.add(box(W+0.2,0.12,0.08,frameMat,0,Hh/2+0.06,0));
  grp.add(box(W+0.2,0.12,0.08,frameMat,0,-Hh/2-0.06,0));
  grp.add(box(0.12,Hh+0.24,0.08,frameMat,-W/2-0.06,0,0));
  grp.add(box(0.12,Hh+0.24,0.08,frameMat, W/2+0.06,0,0));
  grp.add(box(0.06,Hh,0.06,frameMat,0,0,0.02)); // cruceta vertical
  grp.add(box(W,0.06,0.06,frameMat,0,0,0.02));   // cruceta horizontal
  // repisa
  grp.add(box(W+0.3,0.1,0.26,frameMat,0,-Hh/2-0.12,0.1));

  // cortinas (dos paneles que se abren hacia los lados)
  const curtainMat=new THREE.MeshStandardMaterial({color:'#ffd98a',roughness:0.9});
  const curtTex=makeCanvasTexture((g,w,h)=>{ g.fillStyle='#ffd98a'; g.fillRect(0,0,w,h);
    g.strokeStyle='rgba(180,120,40,0.35)'; g.lineWidth=3; for(let i=0;i<10;i++){ g.beginPath(); g.moveTo(i*w/10,0); g.lineTo(i*w/10,h); g.stroke(); } },128,128);
  curtainMat.map=curtTex;
  const barMat=metal('#b8902f');
  const bar=cyl(0.03,0.03,W+0.5,barMat); bar.rotation.z=Math.PI/2; bar.position.set(0,Hh/2+0.18,0.08); grp.add(bar);

  const curtL=new THREE.Mesh(new THREE.PlaneGeometry(W/2,Hh+0.1), curtainMat); curtL.position.set(-W/4,0,0.09);
  const curtR=new THREE.Mesh(new THREE.PlaneGeometry(W/2,Hh+0.1), curtainMat.clone()); curtR.position.set(W/4,0,0.09);
  grp.add(curtL,curtR);
  grp.userData.curtL=curtL; grp.userData.curtR=curtR; grp.userData.open=false;

  // Panel de pared alrededor del hueco (MISMO color que la pared) para dar
  // coherencia: la ventana se "empotra" en vez de parecer pegada.
  const wallCol = (wallSide==='right') ? PAL.lila : PAL.lila; // ambas lila por defecto
  const reveal = mat(wallCol,{roughness:0.96});
  // jamba interior (caja hueca simulada con 4 piezas finas rodeando el cristal)
  const jd=0.22; // profundidad del alfeizar hacia dentro
  grp.add(box(W+0.5,0.16,jd,reveal,0,Hh/2+0.2,-jd/2+0.02));   // dintel
  grp.add(box(W+0.5,0.16,jd,reveal,0,-Hh/2-0.2,-jd/2+0.02));  // alfeizar
  grp.add(box(0.16,Hh+0.5,jd,reveal,-W/2-0.2,0,-jd/2+0.02));  // jamba izq
  grp.add(box(0.16,Hh+0.5,jd,reveal, W/2+0.2,0,-jd/2+0.02));  // jamba der

  // hitbox grande para apuntar facil — raycasteable
  const hit=box(W+0.3,Hh+0.3,0.3, hitboxMat(),0,0,0.12); grp.add(hit);

  // posicion segun pared (empotrada: el cristal queda a ras de pared, el marco hacia dentro)
  if(wallSide==='back'){ grp.position.set(zx, 3.0, -HALF+0.06); }
  else if(wallSide==='right'){ grp.position.set(HALF-0.06, 3.0, zx); grp.rotation.y=-Math.PI/2; }
  scene.add(grp);

  makeInteractive(grp, {
    name:'Ventana',
    info:'Ventana con vistas a un dia soleado. Clic (o E) para abrir/cerrar las cortinas.',
    focus: focusAt(grp.position.clone(), grp.rotation.y),
    onClick: ()=> toggleCurtains(grp),
  });
  return grp;
}
function toggleCurtains(grp){
  const open=!grp.userData.open; grp.userData.open=open;
  const L=grp.userData.curtL, R=grp.userData.curtR;
  const lx0=L.position.x, rx0=R.position.x;
  const lxT=open? lx0-0.55 : (open?0:-0.65); // destino
  let t=0,dur=0.6; const lStart=L.position.x,rStart=R.position.x;
  const lEnd=open?-1.15:-0.65, rEnd=open?1.15:0.65;
  animators.push(dt=>{ t+=dt; const k=Math.min(t/dur,1); const e=k*k*(3-2*k);
    L.position.x=lStart+(lEnd-lStart)*e; R.position.x=rStart+(rEnd-rStart)*e;
    L.scale.x=open?Math.max(0.3,1-e*0.6):1-(1-e)*0.6*0 + (open?0:1)*0; // leve pliegue
    if(k>=1)return false; return true; });
}

// =========================================================
//  PUERTA (abrible)
// =========================================================
function buildDoor(){
  const pivot=new THREE.Group();
  const doorMat=mat('#8a5a33',{roughness:0.6});
  const door=box(1.1,2.6,0.08,doorMat, 0.55,1.3,0); // offset para pivotar en x=0
  pivot.add(door);
  // pomo
  const knob=cyl(0.05,0.05,0.1,metal('#e0c060')); knob.rotation.x=Math.PI/2; knob.position.set(1.0,1.3,0.08); pivot.add(knob);
  // marco
  const frame=new THREE.Group();
  frame.add(box(0.12,2.8,0.14,mat('#efe6fb'),-0.06,1.4,0));
  frame.add(box(0.12,2.8,0.14,mat('#efe6fb'),1.18,1.4,0));
  frame.add(box(1.36,0.14,0.14,mat('#efe6fb'),0.56,2.74,0));
  // colocar en pared derecha (+X), hacia +Z
  pivot.position.set(HALF-0.12, 0, -1.2);
  pivot.rotation.y=-Math.PI/2;
  frame.position.copy(pivot.position); frame.rotation.y=pivot.rotation.y;
  scene.add(pivot); scene.add(frame);
  registry.door=pivot; pivot.userData.open=false;

  makeInteractive(pivot, {
    name:'Puerta',
    info:'La puerta del cuarto. Clic (o E) para abrir/cerrar.',
    focus: focusAt(new THREE.Vector3(HALF-1.2,1.4,-1.2), -Math.PI/2),
    onClick: ()=>{
      const open=!pivot.userData.open; pivot.userData.open=open;
      let t=0,dur=0.7; const y0=pivot.rotation.y, yT=(-Math.PI/2)+(open?-1.2:0);
      animators.push(dt=>{t+=dt;const k=Math.min(t/dur,1);const e=k*k*(3-2*k);pivot.rotation.y=y0+(yT-y0)*e;if(k>=1)return false;return true;});
    },
  });
}

// =========================================================
//  CAMA
// =========================================================
function buildBed(){
  const g=new THREE.Group();
  const frameMat=mat('#7a5230',{roughness:0.6});
  g.add(box(2.0,0.4,2.6,frameMat,0,0.2,0));                 // base
  g.add(box(2.0,0.9,0.15,frameMat,0,0.65,-1.3));            // cabecero
  const mattress=box(1.86,0.3,2.4, mat('#f3edf8',{roughness:0.9}),0,0.55,0.05); g.add(mattress);
  // edredon
  g.add(box(1.9,0.18,1.7, new THREE.MeshStandardMaterial({color:'#8a6bff',roughness:0.85}),0,0.72,0.35));
  // almohadas
  g.add(box(0.8,0.2,0.5, mat('#ffd98a',{roughness:0.9}),-0.45,0.78,-0.95));
  g.add(box(0.8,0.2,0.5, mat('#ff9ec7',{roughness:0.9}), 0.45,0.78,-0.95));
  // cojin decorativo
  const cush=box(0.5,0.5,0.15, mat('#4de0d0',{roughness:0.9}),0,0.9,-0.4); cush.rotation.z=0.2; g.add(cush);

  g.position.set(-HALF+1.3, 0, HALF-1.7);
  g.rotation.y=Math.PI/2;
  scene.add(g); addCollider(g,0.0);
}

// =========================================================
//  ARMARIO (abrible, con ropa en colgadores)
// =========================================================
function buildWardrobe(){
  const g=new THREE.Group();
  const bodyMat=mat('#6b4a30',{roughness:0.55});
  const W=1.8,H=3.0,D=0.7;
  // cuerpo (sin frente, las puertas lo cubren)
  g.add(box(W,H,0.06,bodyMat,0,H/2,-D/2));          // fondo
  g.add(box(0.06,H,D,bodyMat,-W/2,H/2,0));          // lado izq
  g.add(box(0.06,H,D,bodyMat, W/2,H/2,0));          // lado der
  g.add(box(W,0.06,D,bodyMat,0,H,0));               // techo
  g.add(box(W,0.06,D,bodyMat,0,0.03,0));            // piso
  g.add(box(W,0.06,D,bodyMat,0,H*0.62,0));          // balda

  // barra + ropa colgada (ocultas hasta abrir — visibles siempre, pero tapadas por puertas)
  const bar=cyl(0.02,0.02,W-0.2,metal('#ccc')); bar.rotation.z=Math.PI/2; bar.position.set(0,H*0.82,0); g.add(bar);
  const shirtCols=['#ff4fa3','#4de0d0','#ffd166','#8a6bff','#e14b4b','#39c'];
  for(let i=0;i<6;i++){
    const hx=-0.7+i*0.28;
    // percha
    const hook=cyl(0.01,0.01,0.12,metal('#aaa')); hook.position.set(hx,H*0.82-0.06,0); g.add(hook);
    // camisa (caja fina + hombros)
    const shirt=box(0.22,0.5,0.1, mat(shirtCols[i],{roughness:0.85}), hx, H*0.82-0.33, 0); g.add(shirt);
    shirt.rotation.z=(Math.random()-0.5)*0.05;
  }
  // zapatos en el piso
  g.add(box(0.3,0.1,0.15,mat('#222'),-0.4,0.12,0.15));
  g.add(box(0.3,0.1,0.15,mat('#733'),0.3,0.12,0.15));
  // cajon en la balda
  g.add(box(W-0.2,0.3,D-0.1,mat('#5a3d28'),0,0.35,0.0));

  // Puertas (2 hojas abribles)
  const doorMat=mat('#7a5230',{roughness:0.5});
  const pivL=new THREE.Group(); pivL.position.set(-W/2, 0, D/2);
  const dL=box(W/2,H,0.05,doorMat, W/4, H/2, 0); pivL.add(dL);
  const knobL=cyl(0.035,0.035,0.08,metal('#e0c060')); knobL.rotation.x=Math.PI/2; knobL.position.set(W/2-0.08,H/2,0.03); pivL.add(knobL);
  const pivR=new THREE.Group(); pivR.position.set(W/2, 0, D/2);
  const dR=box(W/2,H,0.05,doorMat, -W/4, H/2, 0); pivR.add(dR);
  const knobR=cyl(0.035,0.035,0.08,metal('#e0c060')); knobR.rotation.x=Math.PI/2; knobR.position.set(-W/2+0.08,H/2,0.03); pivR.add(knobR);
  g.add(pivL,pivR);
  g.userData.pivL=pivL; g.userData.pivR=pivR; g.userData.open=false;

  g.position.set(HALF-1.0, 0, HALF-1.3);
  g.rotation.y=-Math.PI/2;
  scene.add(g); addCollider(g,0.0);
  registry.wardrobe=g;

  makeInteractive(g, {
    name:'Armario',
    info:'Armario con ropa. Clic (o E) para abrir/cerrar las puertas y ver la ropa colgada.',
    focus: focusAt(g.position.clone(), g.rotation.y),
    onClick: ()=>{
      const open=!g.userData.open; g.userData.open=open;
      let t=0,dur=0.7; const lS=pivL.rotation.y,rS=pivR.rotation.y;
      const lE=open?-1.3:0, rE=open?1.3:0;
      animators.push(dt=>{t+=dt;const k=Math.min(t/dur,1);const e=k*k*(3-2*k);
        pivL.rotation.y=lS+(lE-lS)*e; pivR.rotation.y=rS+(rE-rS)*e; if(k>=1)return false; return true;});
    },
  });
}


// =========================================================
//  ESCRITORIO ESQUINERO GRANDE, BLANCO
// =========================================================
function buildDesk(){
  const topMat=mat('#f4f1fb',{roughness:0.35,metalness:0.05});   // blanco
  const edgeMat=mat('#e3dcf0',{roughness:0.4});
  const legMat=metal('#cfcfd6');
  const g=new THREE.Group();
  const TH=0.1, Y=1.28;
  const armA_w=5.2, armA_d=1.5;   // mas grande
  const armB_w=1.5, armB_d=4.4;

  const zA=-HALF+armA_d/2+0.08;
  const xA=-HALF+armB_w+armA_w/2+0.08;
  const tA=box(armA_w,TH,armA_d,topMat,xA,Y,zA); g.add(tA);
  const xB=-HALF+armB_w/2+0.08;
  const zB=-HALF+armB_d/2+0.08;
  const tB=box(armB_w,TH,armB_d,topMat,xB,Y,zB); g.add(tB);
  // cantos
  g.add(box(armA_w,0.05,0.04,edgeMat,xA,Y-TH/2-0.02,zA+armA_d/2));
  g.add(box(0.04,0.05,armB_d,edgeMat,xB-armB_w/2,Y-TH/2-0.02,zB));

  const legY=Y/2-TH/2;
  [[xA+armA_w/2-0.1,zA+armA_d/2-0.1],[xA+armA_w/2-0.1,zA-armA_d/2+0.1],
   [xB-armB_w/2+0.1,zB+armB_d/2-0.1],[xB-armB_w/2+0.1,zB-armB_d/2+0.1],
   [-HALF+armB_w+0.1,-HALF+armA_d/2+0.1],[xB+0.1,zB+armB_d/2-0.1]]
   .forEach(([x,z])=>g.add(box(0.1,Y-TH,0.1,legMat,x,legY,z)));

  // cajonera blanca
  g.add(box(0.95,Y-TH-0.05,1.1,mat('#eae4f5'),xA+1.6,(Y-TH)/2,zA));
  for(let i=0;i<3;i++){ g.add(box(0.85,0.28,0.04,topMat,xA+1.6,0.26+i*0.34,zA+0.56)); g.add(box(0.14,0.04,0.04,metal('#bbb'),xA+1.6,0.26+i*0.34,zA+0.59)); }

  scene.add(g);
  // colliders del escritorio (dos AABB)
  addCollider(tA,0); addCollider(tB,0);
  registry.deskY=Y+TH/2;
  registry.deskArmA={x:xA,z:zA,w:armA_w,d:armA_d};
  registry.deskArmB={x:xB,z:zB,w:armB_w,d:armB_d};
}

// Lampara de escritorio ENCENDIBLE
function buildDeskLamp(){
  const g=new THREE.Group();
  const base=cyl(0.16,0.2,0.04,metal('#d9d9df')); base.position.y=0.02; g.add(base);
  const a1=box(0.05,0.7,0.05,metal('#cfcfd6'),0,0.37,0); a1.rotation.z=0.35; g.add(a1);
  const a2=box(0.05,0.5,0.05,metal('#cfcfd6'),0.28,0.75,0); a2.rotation.z=-0.7; g.add(a2);
  const head=cyl(0.16,0.1,0.22,metal('#ff9ec7')); head.rotation.z=1.3; head.position.set(0.5,0.78,0); g.add(head);
  // bombilla (emissive que togglea)
  const bulb=new THREE.Mesh(new THREE.SphereGeometry(0.06,12,12), new THREE.MeshStandardMaterial({color:'#fff',emissive:'#000',emissiveIntensity:0}));
  bulb.position.set(0.56,0.74,0); g.add(bulb); registry.lampBulb=bulb;

  const A=registry.deskArmA;
  g.position.set(A.x-1.8, registry.deskY, A.z-0.2);
  g.scale.setScalar(0.95);
  scene.add(g); registry.deskLamp=g; g.userData.on=false;

  makeInteractive(g, {
    name:'Lampara',
    info:'Lampara de escritorio. Clic (o E) para encender/apagar.',
    focus: focusAt(g.position.clone(), 0),
    onClick: ()=> toggleLamp(),
  });
  deskLampLight.position.set(g.position.x+0.3, registry.deskY+0.9, g.position.z);
}
function toggleLamp(){
  const g=registry.deskLamp; const on=!g.userData.on; g.userData.on=on;
  registry.deskLampLight.intensity = on ? 1.6 : 0.0;
  registry.lampBulb.material.emissive.set(on?'#ffdf9a':'#000');
  registry.lampBulb.material.emissiveIntensity = on?1:0;
}

// =========================================================
//  SWITCH de pared + BOLA DISCO (apaga todo el cuarto)
// =========================================================
function buildSwitchAndDisco(){
  // switch en pared derecha junto a la puerta — agrupado para interactuar como un todo
  const sw=new THREE.Group();
  const plate=box(0.22,0.32,0.04, mat('#f0ecf8'), 0,0,0); sw.add(plate);
  const lever=box(0.08,0.14,0.05, mat('#333'), 0,0.06,0.02); sw.add(lever); registry.switchLever=lever;
  // hitbox grande (facil de apuntar desde lejos) — raycasteable
  const swHit=box(0.6,0.7,0.3, hitboxMat(), 0,0,0.1); sw.add(swHit);
  sw.position.set(HALF-0.07, 1.5, 0.4); sw.rotation.y=-Math.PI/2; scene.add(sw);
  registry.switchGroup=sw;

  makeInteractive(sw, {
    name:'Switch del cuarto',
    info:'Interruptor general. Clic (o E) para apagar las luces del cuarto: aparece una bola disco. Otra vez para volver a la luz.',
    focus: focusAt(new THREE.Vector3(HALF-0.6,1.6,0.4), -Math.PI/2),
    onClick: ()=> toggleRoomPower(),
  });

  // bola disco (oculta arriba del techo hasta activar)
  const disco=new THREE.Group();
  const ballMat=new THREE.MeshStandardMaterial({color:'#cfd3da',roughness:0.1,metalness:1.0});
  const ball=new THREE.Mesh(new THREE.SphereGeometry(0.4,20,16), ballMat);
  // facetas: pequenos quads emissivos alrededor
  for(let i=0;i<10;i++) for(let j=0;j<16;j++){
    const phi=(i/10)*Math.PI, th=(j/16)*Math.PI*2;
    const tile=new THREE.Mesh(new THREE.PlaneGeometry(0.1,0.1), new THREE.MeshStandardMaterial({color:'#eee',roughness:0.05,metalness:1,emissive:'#111'}));
    tile.position.setFromSphericalCoords(0.41,phi,th); tile.lookAt(0,0,0); disco.add(tile);
  }
  disco.add(ball);
  disco.add(cyl(0.01,0.01,0.6,metal('#888')).translateY(0.7));
  disco.position.set(0, WALL_H+0.8, 1.5); // oculto sobre el techo
  scene.add(disco); registry.disco=disco; registry.discoOn=false; markBloom(disco);

  // luces de la bola disco
  const spots=[];
  ['#ff4fa3','#4de0d0','#ffd166','#8a6bff'].forEach(c=>{ const s=new THREE.PointLight(c,0,10); s.position.set(0,3.5,1.5); scene.add(s); spots.push(s); });
  registry.discoSpots=spots;
}
let roomPower=true;
function toggleRoomPower(){
  roomPower=!roomPower;
  const lever=registry.switchLever; lever.position.y = roomPower?0.06:-0.06; // posicion LOCAL al grupo
  if(!roomPower){
    // apagar cuarto
    registry.sun.intensity=0.12; registry.sunHemi.intensity=0.12;
    registry.leds.forEach(l=>l.intensity=0.08);
    scene.background=new THREE.Color('#0a0a16'); scene.fog.color.set('#0a0a16');
    // bajar bola disco
    registry.discoOn=true;
    animateDisco(true);
  } else {
    registry.sun.intensity=2.6; registry.sunHemi.intensity=0.85;
    registry.leds[0].intensity=0.6; registry.leds[1].intensity=0.5;
    scene.background=new THREE.Color('#d9c7f0'); scene.fog.color.set('#cdbce8');
    registry.discoOn=false;
    animateDisco(false);
    registry.discoSpots.forEach(s=>s.intensity=0);
  }
}
function animateDisco(show){
  const d=registry.disco; const yShow=WALL_H-1.4, yHide=WALL_H+0.8;
  let t=0,dur=0.9; const y0=d.position.y, yT=show?yShow:yHide;
  animators.push(dt=>{ t+=dt; const k=Math.min(t/dur,1); const e=k*k*(3-2*k); d.position.y=y0+(yT-y0)*e; if(k>=1)return false; return true; });
  if(show){
    // rotacion + luces de colores mientras este encendida
    animators.push(dt=>{ if(!registry.discoOn)return false; d.rotation.y+=dt*1.2;
      const tt=performance.now()*0.002;
      registry.discoSpots.forEach((s,i)=>{ s.intensity=2.2; s.position.set(Math.sin(tt+i*1.6)*3, 3.4, 1.5+Math.cos(tt+i*1.6)*3); });
      return true; });
  }
}


// =========================================================
//  FOCOS DE CAMARA (zoom 3a persona)
// =========================================================
function focusFor(pos, dist=2.2, height=1.3, azi=0.6){
  const tgt=pos.clone().add(new THREE.Vector3(0,0.25,0));
  const dir=new THREE.Vector3(Math.sin(azi),0.55,Math.cos(azi)).normalize();
  const camPos=tgt.clone().add(dir.multiplyScalar(dist)).add(new THREE.Vector3(0,height*0.2,0));
  return {pos:camPos,tgt};
}
// foco frente a un objeto montado en pared, segun su rotacion Y
function focusAt(pos, rotY){
  const tgt=pos.clone().add(new THREE.Vector3(0,0.1,0));
  const forward=new THREE.Vector3(Math.sin(rotY+Math.PI),0,Math.cos(rotY+Math.PI)); // hacia el interior
  const camPos=tgt.clone().add(forward.multiplyScalar(2.4)).add(new THREE.Vector3(0,0.8,0));
  return {pos:camPos,tgt};
}

// posiciones sobre la L del escritorio (repartidas)
function deskSpot(name){
  const Y=registry.deskY, A=registry.deskArmA, B=registry.deskArmB;
  const spots={
    printer: new THREE.Vector3(A.x+A.w/2-0.8, Y, A.z-0.1),
    arm:     new THREE.Vector3(A.x+0.2, Y, A.z+0.2),
    solder:  new THREE.Vector3(A.x-A.w/2+1.0, Y, A.z+0.2),
    robot:   new THREE.Vector3(B.x+0.1, Y, B.z+0.6),
    laptop:  new THREE.Vector3(B.x, Y, B.z-1.4),
    lego:    new THREE.Vector3(B.x+0.15, Y, B.z+1.7),
  };
  return spots[name];
}

// =========================================================
//  POSTERS + VINILOS + REPISAS
// =========================================================
function posterTexture(cfg){
  return makeCanvasTexture((g,w,h)=>{
    const grad=g.createLinearGradient(0,0,w,h); grad.addColorStop(0,cfg.c1); grad.addColorStop(1,cfg.c2);
    g.fillStyle=grad; g.fillRect(0,0,w,h);
    const rg=g.createRadialGradient(w/2,h*0.42,10,w/2,h*0.42,w*0.7); rg.addColorStop(0,'rgba(255,255,255,0.35)'); rg.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=rg; g.fillRect(0,0,w,h);
    cfg.art(g,w,h);
    g.textAlign='center'; g.fillStyle='#fff'; g.strokeStyle='rgba(0,0,0,0.55)'; g.lineWidth=6;
    g.font=`bold ${cfg.size||44}px Impact, sans-serif`; g.strokeText(cfg.t,w/2,h*0.74); g.fillText(cfg.t,w/2,h*0.74);
    g.font='20px Georgia'; g.fillStyle='rgba(255,255,255,0.9)'; g.fillText(cfg.s,w/2,h*0.84);
    g.strokeStyle='#111'; g.lineWidth=14; g.strokeRect(0,0,w,h);
  },360,500);
}
function buildPosters(){
  const posters=[
    {t:'THUNDER ROAD',s:'WORLD TOUR 87',c1:'#7b0d1a',c2:'#1a0505',size:44,art:(g,w,h)=>{g.strokeStyle='#ffd24a';g.lineWidth=14;g.beginPath();g.moveTo(w*0.5,h*0.1);g.lineTo(w*0.38,h*0.4);g.lineTo(w*0.52,h*0.4);g.lineTo(w*0.4,h*0.66);g.stroke();},x:-3.9,y:4.0,w:1.6,h:2.2},
    {t:'NEON WOLVES',s:'LIVE MCMXCI',c1:'#13235f',c2:'#7a1b86',size:38,art:(g,w,h)=>{g.fillStyle='#e9f0ff';g.beginPath();g.arc(w*0.5,h*0.33,70,0,7);g.fill();g.fillStyle='#0a0a1a';g.beginPath();g.moveTo(w*0.3,h*0.5);g.lineTo(w*0.42,h*0.3);g.lineTo(w*0.5,h*0.42);g.lineTo(w*0.58,h*0.3);g.lineTo(w*0.7,h*0.5);g.closePath();g.fill();},x:-1.2,y:4.25,w:1.5,h:2.1},
    {t:'STATIC SUN',s:'GREATEST HITS',c1:'#0d2a2a',c2:'#124e63',size:42,art:(g,w,h)=>{g.fillStyle='#ff7b4a';g.beginPath();g.arc(w*0.5,h*0.35,80,0,7);g.fill();g.strokeStyle='#0d2a2a';g.lineWidth=8;for(let i=0;i<6;i++){g.beginPath();g.moveTo(w*0.3,h*0.3+i*12);g.lineTo(w*0.7,h*0.3+i*12);g.stroke();}},x:1.5,y:3.95,w:1.6,h:2.2},
  ];
  posters.forEach(p=>{ const grp=new THREE.Group();
    grp.add(box(p.w+0.12,p.h+0.12,0.06,mat('#241633',{roughness:0.5})));
    const paper=new THREE.Mesh(new THREE.PlaneGeometry(p.w,p.h), new THREE.MeshStandardMaterial({map:posterTexture(p),roughness:0.85})); paper.position.z=0.04; grp.add(paper);
    grp.position.set(p.x,p.y,-HALF+0.07); grp.rotation.z=(Math.random()-0.5)*0.02; scene.add(grp); });

  // vinilos en pared back, arriba derecha
  ['#ff4fa3','#4de0d0','#ffd24a','#8a6bff'].forEach((c,i)=>{ const grp=new THREE.Group();
    const disc=cyl(0.42,0.42,0.02,new THREE.MeshStandardMaterial({color:'#0a0a0a',roughness:0.35,metalness:0.4})); disc.rotation.x=Math.PI/2;
    const ring=new THREE.Mesh(new THREE.RingGeometry(0.2,0.4,32),new THREE.MeshStandardMaterial({color:'#1a1a1a',roughness:0.3,metalness:0.5,side:THREE.DoubleSide})); ring.position.z=0.011;
    const label=cyl(0.15,0.15,0.024,mat(c)); label.rotation.x=Math.PI/2; grp.add(disc,ring,label);
    grp.position.set(5.0,4.7-i*0.95,-HALF+0.07); scene.add(grp); });
}
function plant(x,y,z,s=1){ const g=new THREE.Group();
  const pot=cyl(0.16,0.12,0.28,mat('#e0652f',{roughness:0.5})); pot.position.y=0.14; g.add(pot);
  g.add(cyl(0.15,0.15,0.04,mat('#2d1c10')).translateY(0.28));
  for(let i=0;i<7;i++){ const leaf=new THREE.Mesh(new THREE.ConeGeometry(0.06,0.42,8),mat('#36a85b',{roughness:0.6})); const a=(i/7)*Math.PI*2; leaf.position.set(Math.cos(a)*0.08,0.5,Math.sin(a)*0.08); leaf.rotation.z=Math.cos(a)*0.45; leaf.rotation.x=Math.sin(a)*0.45; g.add(leaf); }
  g.position.set(x,y,z); g.scale.setScalar(s); return g; }
function books(x,y,z,n=5){ const g=new THREE.Group(); const cols=['#e14b4b','#3a9bd4','#6bbf4a','#e6b13a','#8457c9','#e0722f']; let off=0;
  for(let i=0;i<n;i++){ const w=0.08+Math.random()*0.04,hgt=0.34+Math.random()*0.12; const b=box(w,hgt,0.26,mat(cols[i%cols.length],{roughness:0.6})); b.position.set(off+w/2,hgt/2,0); g.add(b); off+=w+0.012; } g.position.set(x,y,z); return g; }
function buildShelves(){
  const wx=-HALF+0.22; const shelfMat=mat('#c98a4e',{roughness:0.55});
  [1.5,2.55,3.6].forEach((hy,idx)=>{
    scene.add(box(0.52,0.08,3.4,shelfMat,wx,hy,-2.2));
    if(idx===0){ const bk=books(wx-0.18,hy+0.04,-3.0); bk.rotation.y=Math.PI/2; scene.add(bk); scene.add(plant(wx,hy+0.04,-1.2)); }
    else if(idx===1){ scene.add(plant(wx,hy+0.04,-3.2,0.9)); const bk=books(wx-0.18,hy+0.04,-2.1,4); bk.rotation.y=Math.PI/2; scene.add(bk); }
    else { const bk=books(wx-0.18,hy+0.04,-3.2,6); bk.rotation.y=Math.PI/2; scene.add(bk); scene.add(plant(wx,hy+0.04,-1.4,0.85)); }
  });
}


// =========================================================
//  [1] IMPRESORA 3D realista -> imprime engranaje
// =========================================================
function gearGeometry(teeth=10,rO=0.2,rI=0.14,rH=0.055,thick=0.14){
  const shape=new THREE.Shape(); const step=(Math.PI*2)/(teeth*2);
  for(let i=0;i<=teeth*2;i++){ const r=i%2===0?rO:rI; const a=i*step; const x=Math.cos(a)*r,y=Math.sin(a)*r; if(i===0)shape.moveTo(x,y); else shape.lineTo(x,y); }
  const hole=new THREE.Path(); hole.absarc(0,0,rH,0,Math.PI*2,true); shape.holes.push(hole);
  const geo=new THREE.ExtrudeGeometry(shape,{depth:thick,bevelEnabled:true,bevelThickness:0.015,bevelSize:0.012,bevelSegments:2}); geo.center(); geo.rotateX(Math.PI/2); return geo;
}
function buildPrinter(){
  const g=new THREE.Group();
  const alu=metal('#3a3f4b'),aluDk=metal('#23262f'),steel=metal('#9aa0ab');
  const black=new THREE.MeshStandardMaterial({color:'#15161c',roughness:0.5,metalness:0.4});
  g.add(box(1.0,0.16,0.7,aluDk,0,0.08,0));
  g.add(box(1.02,0.03,0.72,black,0,0.17,0));
  g.add(box(0.22,0.12,0.02,new THREE.MeshStandardMaterial({color:'#0a3b2a',emissive:'#0f6',emissiveIntensity:0.4}),0.32,0.12,0.36));
  const bedGrp=new THREE.Group();
  bedGrp.add(box(0.78,0.03,0.6,new THREE.MeshStandardMaterial({color:'#1a1c24',roughness:0.4,metalness:0.3})));
  bedGrp.add(box(0.74,0.008,0.56,new THREE.MeshStandardMaterial({color:'#2a2d38',roughness:0.25,metalness:0.5}),0,0.02,0));
  [[-0.32,-0.24],[0.32,-0.24],[-0.32,0.24],[0.32,0.24]].forEach(([x,z])=>bedGrp.add(cyl(0.03,0.03,0.05,steel,10).translateX(x).translateY(-0.04).translateZ(z)));
  bedGrp.position.set(0,0.26,0); g.add(bedGrp); registry.printerBed=bedGrp;
  const H=1.25;
  g.add(box(0.07,H,0.07,alu,-0.42,0.18+H/2,-0.28)); g.add(box(0.07,H,0.07,alu,0.42,0.18+H/2,-0.28)); g.add(box(0.95,0.07,0.07,alu,0,0.18+H,-0.28));
  g.add(cyl(0.02,0.02,H*0.95,steel,10).translateX(-0.28).translateY(0.2+H/2).translateZ(-0.28));
  g.add(cyl(0.015,0.015,H*0.95,steel,8).translateX(0.28).translateY(0.2+H/2).translateZ(-0.28));
  const carriage=new THREE.Group(); carriage.add(box(0.9,0.05,0.06,aluDk,0,0,-0.28));
  const ext=new THREE.Group();
  ext.add(box(0.16,0.2,0.14,new THREE.MeshStandardMaterial({color:'#d23b2a',roughness:0.4,metalness:0.2}),0,0,-0.2));
  const fan=cyl(0.08,0.08,0.03,black,16); fan.rotation.x=Math.PI/2; fan.position.set(0.12,0,-0.2); ext.add(fan);
  ext.add(box(0.07,0.06,0.07,metal('#c9a24a'),0,-0.12,-0.2));
  const nozzle=new THREE.Mesh(new THREE.ConeGeometry(0.025,0.07,16),metal('#b8872f')); nozzle.position.set(0,-0.18,-0.2); ext.add(nozzle);
  carriage.add(ext); carriage.position.set(0,0.2+H*0.62,0); g.add(carriage); registry.printerExtruder=ext; registry.printerCarriage=carriage;
  const spool=new THREE.Group();
  spool.add(cyl(0.22,0.22,0.02,mat('#ff8a3c',{roughness:0.4}),20).rotateZ(Math.PI/2));
  spool.add(cyl(0.08,0.08,0.1,black,16).rotateZ(Math.PI/2));
  spool.position.set(-0.5,0.2+H*0.9,-0.28); g.add(spool);
  const gear=new THREE.Mesh(gearGeometry(),new THREE.MeshStandardMaterial({color:'#ffb347',roughness:0.35,metalness:0.25,emissive:'#331a00',emissiveIntensity:0.25}));
  gear.position.set(0,0.3,0); gear.scale.y=0.001; g.add(gear); registry.printGear=gear;
  const spot=deskSpot('printer'); g.position.copy(spot); g.scale.setScalar(0.58); scene.add(g);
  makeInteractive(g,{name:'Impresora 3D',info:'Impresora tipo Prusa/Ender. Imprime un engranaje capa a capa. Clic (o E) para reimprimir.',focus:focusFor(spot,1.8,1.3,0.35),onClick:()=>startPrint()});
}
let printing=false;
function startPrint(){ if(printing)return; printing=true;
  const gear=registry.printGear,ext=registry.printerExtruder,carr=registry.printerCarriage;
  gear.scale.y=0.001; let t=0,dur=3.6; const cY=carr.position.y,pH=0.14;
  animators.push(dt=>{ t+=dt; const k=Math.min(t/dur,1); gear.scale.y=Math.max(0.001,k);
    carr.position.y=cY-0.35+(0.3+pH*k)*1.0; ext.position.x=Math.sin(t*22)*0.22; ext.position.z=Math.sin(t*14)*0.06; gear.rotation.y+=dt*0.4;
    if(k>=1){printing=false;ext.position.x=0;ext.position.z=0;carr.position.y=cY;return false;} return true; });
}

// =========================================================
//  [2] BRAZO ROBOTICO 2 GDL + GARRA
// =========================================================
function buildArm(){
  const g=new THREE.Group();
  const armMat=new THREE.MeshStandardMaterial({color:'#ff7a00',roughness:0.4,metalness:0.3});
  const joint=metal('#2a2a2a');
  g.add(cyl(0.26,0.3,0.1,joint).translateY(0.05));
  // GDL1: base gira en Y
  const turret=new THREE.Group(); turret.position.y=0.1; g.add(turret);
  turret.add(cyl(0.14,0.16,0.3,armMat).translateY(0.15));
  turret.add(cyl(0.1,0.1,0.14,joint).rotateZ(Math.PI/2).translateY(0.32)); // codo-hombro visible
  // GDL2: hombro levanta (pitch)
  const upper=new THREE.Group(); upper.position.y=0.32; turret.add(upper);
  upper.add(box(0.12,0.62,0.12,armMat,0,0.31,0));
  upper.add(cyl(0.08,0.08,0.14,joint).rotateZ(Math.PI/2).translateY(0.62)); // muneca
  upper.rotation.z=0.4;
  // antebrazo fijo respecto al hombro (para mantener 2 GDL reales) + garra
  const wrist=new THREE.Group(); wrist.position.y=0.62; upper.add(wrist);
  wrist.add(box(0.1,0.3,0.1,armMat,0,0.15,0));
  // GARRA (dos dedos que abren/cierran)
  const gripBase=new THREE.Group(); gripBase.position.y=0.3; wrist.add(gripBase);
  gripBase.add(box(0.14,0.06,0.1,joint,0,0.03,0));
  const fingerL=box(0.04,0.16,0.06,joint,0.06,0.11,0); const fingerR=box(0.04,0.16,0.06,joint,-0.06,0.11,0);
  gripBase.add(fingerL,fingerR);
  registry.armTurret=turret; registry.armUpper=upper; registry.armFingerL=fingerL; registry.armFingerR=fingerR;

  const spot=deskSpot('arm'); g.position.copy(spot); g.scale.setScalar(0.92); scene.add(g);
  makeInteractive(g,{name:'Brazo robotico',info:'Brazo de 2 grados de libertad con garra. Clic (o E): gira la base, levanta el hombro y la garra agarra.',
    focus:{pos:spot.clone().add(new THREE.Vector3(1.2,1.05,1.3)),tgt:spot.clone().add(new THREE.Vector3(0,0.6,0))},
    onClick:()=>startArm()});
}
let armBusy=false;
function startArm(){ if(armBusy)return; armBusy=true; let t=0,dur=3.2;
  const {armTurret:tu,armUpper:up,armFingerL:fl,armFingerR:fr}=registry; const u0=up.rotation.z;
  animators.push(dt=>{ t+=dt; const k=Math.min(t/dur,1);
    tu.rotation.y=Math.sin(k*Math.PI*2)*Math.PI*0.8;          // GDL1
    up.rotation.z=u0+Math.sin(k*Math.PI*3)*0.5;               // GDL2
    const grip=(Math.sin(k*Math.PI*6)*0.5+0.5)*0.06;          // garra abre/cierra
    fl.position.x=0.06-grip; fr.position.x=-0.06+grip;
    if(k>=1){armBusy=false;return false;} return true; });
}

// =========================================================
//  [3] ROBOT MOVIL -> consola
// =========================================================
function buildRobot(){
  const g=new THREE.Group();
  const bodyMat=new THREE.MeshStandardMaterial({color:'#eef1f6',roughness:0.25,metalness:0.6});
  const accent=new THREE.MeshStandardMaterial({color:'#4de0d0',emissive:'#064',emissiveIntensity:0.5,roughness:0.4});
  g.add(cyl(0.24,0.28,0.32,bodyMat).translateY(0.18));
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.2,24,16),bodyMat); head.position.y=0.46; g.add(head);
  const visor=box(0.28,0.1,0.06,new THREE.MeshStandardMaterial({color:'#06121f',emissive:'#4de0d0',emissiveIntensity:0.7}),0,0.48,0.18); g.add(visor); registry.robotVisor=visor; visor.layers.enable(BLOOM_LAYER);
  g.add(cyl(0.012,0.012,0.2,accent).translateY(0.7));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.035,12,12),accent).translateY(0.82));
  [-0.18,0.18].forEach(x=>{ const w=cyl(0.07,0.07,0.05,metal('#111')); w.rotation.z=Math.PI/2; w.position.set(x,0.06,0); g.add(w); });
  const spot=deskSpot('robot'); g.position.copy(spot); g.scale.setScalar(0.8); scene.add(g); registry.robot=g; registry.robotBaseY=spot.y;
  makeInteractive(g,{name:'Robot movil',info:'Robot de escritorio. Clic (o E) abre su consola de comandos.',focus:focusFor(spot,1.7,1.1,0.9),onClick:()=>openRobotConsole()});
  let t=0; animators.push(dt=>{ t+=dt; g.position.y=registry.robotBaseY+Math.sin(t*2)*0.012; visor.material.emissiveIntensity=0.4+Math.abs(Math.sin(t*3))*0.4; return true; });
}

// =========================================================
//  [4] LAPTOP (girada hacia la silla) + MONITOR cerca
// =========================================================
function desktopTexture(label){
  return makeCanvasTexture((g,w,h)=>{
    const grad=g.createLinearGradient(0,0,0,h); grad.addColorStop(0,'#16203c'); grad.addColorStop(1,'#0a1020'); g.fillStyle=grad; g.fillRect(0,0,w,h);
    g.fillStyle='#1b2440'; g.fillRect(0,0,w,26);
    g.fillStyle='#ff5f57'; g.beginPath(); g.arc(14,13,5,0,7); g.fill(); g.fillStyle='#febc2e'; g.beginPath(); g.arc(30,13,5,0,7); g.fill(); g.fillStyle='#28c840'; g.beginPath(); g.arc(46,13,5,0,7); g.fill();
    g.fillStyle='#9fc2d6'; g.font='12px monospace'; g.fillText('mi-cuarto.dev',70,17);
    const apps=[['#1db954','MUS'],['#0a66c2','in'],['#ff9900','SHOP'],['#8a6bff','PLAY']];
    apps.forEach((a,i)=>{ const x=40+i*(w-80)/4+(w-80)/8,y=h*0.42; g.fillStyle=a[0]; roundRect(g,x-30,y-30,60,60,12); g.fill(); g.fillStyle='#fff'; g.font='bold 16px monospace'; g.textAlign='center'; g.fillText(a[1],x,y+6); g.textAlign='left'; });
    g.fillStyle='#4de0d0'; g.font='bold 20px monospace'; g.textAlign='center'; g.fillText('MIS APPS',w/2,h*0.2); g.textAlign='left';
  },400,300);
}
function buildLaptop(){
  const gMat=new THREE.MeshStandardMaterial({color:'#cfd3da',roughness:0.3,metalness:0.7});
  const spotL=deskSpot('laptop');
  // La silla esta frente al brazo B mirando -X; la laptop debe mirar hacia la silla (hacia +Z/+X del usuario).
  // Orientamos la laptop con la pantalla hacia la silla.
  const FACE=Math.PI*0.5; // pantalla hacia +X (donde se sienta el avatar)
  const laptop=new THREE.Group();
  laptop.add(box(0.8,0.035,0.54,gMat,0,0.018,0));
  const lid=new THREE.Group(); lid.add(box(0.8,0.5,0.028,gMat,0,0.25,0));
  const ls=new THREE.Mesh(new THREE.PlaneGeometry(0.72,0.42),new THREE.MeshBasicMaterial({map:desktopTexture('laptop')})); ls.position.set(0,0.25,0.018); lid.add(ls); ls.layers.enable(BLOOM_LAYER);
  lid.position.z=-0.27; lid.rotation.x=-0.3; laptop.add(lid);
  laptop.add(box(0.72,0.01,0.34,mat('#15161c'),0,0.04,0.06));
  for(let r=0;r<4;r++)for(let c=0;c<11;c++) laptop.add(box(0.045,0.012,0.045,mat('#2a2d38'),-0.3+c*0.06,0.05,-0.02+r*0.065));
  laptop.position.copy(spotL); laptop.rotation.y=FACE; laptop.scale.setScalar(0.9); scene.add(laptop);

  // Monitor CERCA de la laptop (sobre la mesa, justo detras), mirando a la silla
  const monitor=new THREE.Group();
  monitor.add(box(0.1,0.42,0.1,gMat,0,0.21,0));
  monitor.add(box(0.5,0.03,0.3,gMat,0,0.02,0));
  monitor.add(box(1.25,0.78,0.05,mat('#111'),0,0.82,0));
  const ms=new THREE.Mesh(new THREE.PlaneGeometry(1.15,0.68),new THREE.MeshBasicMaterial({map:desktopTexture('monitor')})); ms.position.set(0,0.82,0.03); monitor.add(ms); registry.monitorScreen=ms; ms.layers.enable(BLOOM_LAYER);
  // colocado justo detras de la laptop (hacia -X respecto a la silla), misma orientacion
  monitor.position.set(spotL.x-0.55, registry.deskY, spotL.z);
  monitor.rotation.y=FACE; monitor.scale.setScalar(0.9); scene.add(monitor);

  // mouse + pad del lado de la silla
  scene.add(box(0.28,0.006,0.22,mat('#17384f'),spotL.x+0.1,registry.deskY+0.004,spotL.z+0.45));
  const mouse=new THREE.Mesh(new THREE.SphereGeometry(0.055,16,12),mat('#1c1c22',{roughness:0.4})); mouse.scale.set(1,0.55,1.4); mouse.position.set(spotL.x+0.1,registry.deskY+0.035,spotL.z+0.45); scene.add(mouse);

  makeInteractive(laptop,{name:'Laptop',info:'Clic (o E) abre el navegador con mis apps: Musica, LinkedIn, Tienda y un minijuego.',
    focus:{pos:spotL.clone().add(new THREE.Vector3(1.3,1.0,0.4)),tgt:new THREE.Vector3(spotL.x-0.2,registry.deskY+0.6,spotL.z)},
    onClick:()=>openBrowser()});
}

// =========================================================
//  [5] LEGO en MONTON -> arma torre -> cae -> robot
// =========================================================
function buildLego(){
  const g=new THREE.Group();
  const cols=['#d6322f','#2a8a46','#2f6fd6','#edc02a','#8457c9','#e0722f'];
  const bricks=[];
  const towerTargets=[],robotTargets=[];
  for(let y=0;y<5;y++)for(let bx=0;bx<2;bx++)for(let bz=0;bz<2;bz++) towerTargets.push(new THREE.Vector3((bx-0.5)*0.19,0.06+y*0.1,(bz-0.5)*0.19));
  const R=[[-0.12,0.06,0],[-0.12,0.16,0],[0.12,0.06,0],[0.12,0.16,0],
    [-0.08,0.28,0],[0.08,0.28,0],[-0.08,0.38,0],[0.08,0.38,0],[-0.08,0.48,0],[0.08,0.48,0],
    [-0.24,0.4,0],[0.24,0.4,0],[-0.24,0.3,0],[0.24,0.3,0],
    [-0.06,0.6,0],[0.06,0.6,0],[-0.06,0.7,0],[0.06,0.7,0],[0,0.8,0],[0,0.52,0]];
  R.forEach(([x,y,z])=>robotTargets.push(new THREE.Vector3(x,y,z)));
  const N=Math.min(towerTargets.length,robotTargets.length);
  for(let i=0;i<N;i++){ const bg=new THREE.Group(); const col=cols[i%cols.length];
    bg.add(box(0.17,0.1,0.17,mat(col,{roughness:0.35})));
    for(let sx=-1;sx<=1;sx+=2)for(let sz=-1;sz<=1;sz+=2) bg.add(cyl(0.028,0.028,0.03,mat(col),12).translateX(sx*0.045).translateY(0.065).translateZ(sz*0.045));
    // MONTON: pila desordenada compacta cerca del centro (no circulo)
    const start=new THREE.Vector3((Math.random()-0.5)*0.5, 0.05+Math.random()*0.28, (Math.random()-0.5)*0.5);
    bg.position.copy(start); bg.rotation.set(Math.random()*0.6,Math.random()*Math.PI,Math.random()*0.6);
    bg.userData={start,tower:towerTargets[i],robot:robotTargets[i],order:i,vel:new THREE.Vector3()};
    g.add(bg); bricks.push(bg); }
  const spot=deskSpot('lego'); g.position.copy(spot); g.scale.setScalar(1.05); scene.add(g); registry.legoBricks=bricks; registry.legoGroup=g;
  makeInteractive(g,{name:'LEGO',info:'Clic 1: el monton se ensambla en torre. Clic 2: se cae y se rearma en forma de ROBOT. Clic 3: vuelve al monton.',
    focus:focusFor(spot,1.8,1.3,1.0),onClick:()=>legoNext()});
}
let legoState=0,legoBusy=false;
function legoNext(){ if(legoBusy)return; if(legoState===0)assembleLego('tower',()=>legoState=1); else if(legoState===1)collapseThenRobot(()=>legoState=2); else assembleLego('start',()=>legoState=0); }
function assembleLego(key,done){ legoBusy=true; const b=registry.legoBricks; const from=b.map(x=>x.position.clone()); let t=0,per=0.1,set=0.5;
  animators.push(dt=>{ t+=dt; let all=true; b.forEach((br,i)=>{ const s=br.userData.order*per; const k=Math.min(Math.max((t-s)/set,0),1); const e=1-Math.pow(1-k,3);
    br.position.lerpVectors(from[i],br.userData[key],e); br.rotation.y=(1-e)*6; br.rotation.x*= (1-e); br.rotation.z*=(1-e); if(k<1)all=false; });
    if(all){legoBusy=false;done&&done();return false;} return true; }); }
function collapseThenRobot(done){ legoBusy=true; const b=registry.legoBricks;
  b.forEach(x=>x.userData.vel.set((Math.random()-0.5)*1.6,Math.random()*1.4+0.6,(Math.random()-0.5)*1.6));
  let t=0,fall=1.2; const floorY=-registry.legoGroup.position.y+0.06;
  animators.push(dt=>{ t+=dt; b.forEach(x=>{ x.userData.vel.y-=4.5*dt; x.position.addScaledVector(x.userData.vel,dt); x.rotation.x+=x.userData.vel.z*dt*3; x.rotation.z+=x.userData.vel.x*dt*3;
    if(x.position.y<floorY){x.position.y=floorY;x.userData.vel.y*=-0.35;x.userData.vel.x*=0.7;x.userData.vel.z*=0.7;} });
    if(t>=fall){ assembleLego('robot',done); return false; } return true; }); }

// =========================================================
//  [6] SOLDADURA -> humo
// =========================================================
function buildSolder(){
  const g=new THREE.Group();
  g.add(box(0.72,0.05,0.46,mat('#f2f2ea',{roughness:0.7}),0,0.03,0));
  for(let i=0;i<10;i++)for(let j=0;j<6;j++) g.add(box(0.014,0.01,0.014,mat('#888'),-0.3+i*0.065,0.06,-0.18+j*0.07));
  g.add(box(0.28,0.04,0.2,mat('#0a7a56'),0,0.08,0.3)); g.add(box(0.08,0.05,0.06,metal('#bbb'),-0.12,0.09,0.4)); g.add(box(0.08,0.03,0.08,mat('#111'),0.03,0.1,0.3));
  ['#f33','#3f3','#39f'].forEach((c,i)=>{ const led=new THREE.Mesh(new THREE.SphereGeometry(0.02,10,10),new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:0.9})); led.position.set(0.08+i*0.05,0.11,0.24); g.add(led); });
  ['#e33','#33e','#ee3'].forEach((c,i)=>{ const cab=cyl(0.008,0.008,0.3,mat(c)); cab.position.set(-0.1+i*0.05,0.12,0.16); cab.rotation.x=Math.PI/3; g.add(cab); });
  g.add(box(0.1,0.02,0.2,metal('#444'),-0.42,0.04,0.26));
  const handle=cyl(0.03,0.03,0.26,mat('#1b63c4')); handle.rotation.z=0.9; handle.position.set(-0.34,0.18,0.26); g.add(handle);
  const tip=cyl(0.008,0.02,0.12,metal('#c8803a')); tip.rotation.z=0.9; tip.position.set(-0.19,0.26,0.26); g.add(tip);
  registry.ironTipLocal=new THREE.Vector3(-0.12,0.33,0.26);
  // hitbox para apuntar facil toda la estacion — raycasteable
  g.add(box(1.0,0.6,0.8, hitboxMat(),0,0.25,0.1));
  const spot=deskSpot('solder'); g.position.copy(spot); g.scale.setScalar(0.95); scene.add(g); registry.solderGroup=g;
  const smokeTex=makeCanvasTexture((gx,w,h)=>{ const r=gx.createRadialGradient(w/2,h/2,2,w/2,h/2,w/2); r.addColorStop(0,'rgba(210,210,210,0.9)'); r.addColorStop(1,'rgba(210,210,210,0)'); gx.fillStyle=r; gx.fillRect(0,0,w,h); },64,64);
  const smoke=new THREE.Group(); g.add(smoke); const puffs=[];
  for(let i=0;i<16;i++){ const s=new THREE.Sprite(new THREE.SpriteMaterial({map:smokeTex,transparent:true,opacity:0,depthWrite:false})); s.scale.setScalar(0.12); s.position.copy(registry.ironTipLocal); s.userData={life:0,active:false}; smoke.add(s); puffs.push(s); }
  registry.smokePuffs=puffs;
  makeInteractive(g,{name:'Estacion de soldadura',info:'Protoboard, microcontrolador, LEDs y cautin. Clic (o E): suelda y sale humo.',focus:focusFor(spot,1.7,1.1,0.7),onClick:()=>startSolder()});
}
let soldering=false;
function startSolder(){ if(soldering)return; soldering=true; const p=registry.smokePuffs; let t=0,emit=0,dur=4.0;
  animators.push(dt=>{ t+=dt; emit+=dt; if(t<dur&&emit>0.16){ emit=0; const f=p.find(x=>!x.userData.active); if(f){f.userData.active=true;f.userData.life=0;f.position.copy(registry.ironTipLocal);f.position.x+=(Math.random()-0.5)*0.03;f.material.opacity=0.8;f.scale.setScalar(0.1);} }
    p.forEach(x=>{ if(!x.userData.active)return; x.userData.life+=dt; x.position.y+=dt*0.35; x.position.x+=Math.sin(x.userData.life*4)*dt*0.05; x.scale.setScalar(0.1+x.userData.life*0.22); x.material.opacity=Math.max(0,0.8-x.userData.life*0.5); if(x.userData.life>1.6){x.userData.active=false;x.material.opacity=0;} });
    if(t>=dur&&!p.some(x=>x.userData.active)){soldering=false;return false;} return true; }); }

// =========================================================
//  SILLA (frente al brazo B del escritorio)
// =========================================================
function buildChair(){
  const g=new THREE.Group(); const m=new THREE.MeshStandardMaterial({color:'#2a2a33',roughness:0.5,metalness:0.2});
  g.add(cyl(0.04,0.04,0.5,metal('#111'))); g.add(box(0.6,0.1,0.6,m,0,0.55,0)); g.add(box(0.6,0.7,0.1,m,0,0.95,-0.28));
  for(let i=0;i<5;i++){ const a=(i/5)*Math.PI*2; const leg=box(0.4,0.04,0.06,metal('#111'),Math.cos(a)*0.2,0.04,Math.sin(a)*0.2); leg.rotation.y=-a; g.add(leg); }
  const B=registry.deskArmB; g.position.set(B.x+1.1,0,B.z-1.2); g.rotation.y=-Math.PI/2; scene.add(g);
}


// =========================================================
//  AVATAR personalizable
// =========================================================
function buildAvatar(){
  const g=new THREE.Group();
  const skin=mat(AVATAR.skin,{roughness:0.7});
  const shirt=mat(AVATAR.shirt,{roughness:0.8});
  const pants=mat(AVATAR.pants,{roughness:0.8});
  const hair=mat(AVATAR.hair,{roughness:0.9});
  // piernas
  const legL=box(0.14,0.5,0.16,pants,-0.1,0.25,0); const legR=box(0.14,0.5,0.16,pants,0.1,0.25,0); g.add(legL,legR);
  // torso
  g.add(box(0.44,0.55,0.24,shirt,0,0.78,0));
  // brazos
  const armL=box(0.12,0.45,0.12,shirt,-0.3,0.82,0); const armR=box(0.12,0.45,0.12,shirt,0.3,0.82,0); g.add(armL,armR);
  // manos
  g.add(box(0.1,0.1,0.1,skin,-0.3,0.56,0)); g.add(box(0.1,0.1,0.1,skin,0.3,0.56,0));
  // cabeza
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.2,20,16),skin); head.position.set(0,1.22,0); g.add(head);
  // pelo (casquete)
  const hcap=new THREE.Mesh(new THREE.SphereGeometry(0.22,20,16,0,Math.PI*2,0,Math.PI*0.6),hair); hcap.position.set(0,1.26,0); g.add(hcap);
  // ojos
  g.add(box(0.04,0.04,0.02,mat('#111'),-0.07,1.24,0.19)); g.add(box(0.04,0.04,0.02,mat('#111'),0.07,1.24,0.19));
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  g.userData.legL=legL; g.userData.legR=legR; g.userData.armL=armL; g.userData.armR=armR;
  return g;
}

// creador de avatar en la pantalla de inicio
const PALETTES={
  skin:['#e8b48c','#f3cfae','#c68642','#8d5524','#ffdbac'],
  hair:['#3a2a1a','#111','#7a4a1a','#b5651d','#d9b38c','#ff4fa3','#4de0d0'],
  shirt:['#ff4fa3','#4de0d0','#ffd166','#8a6bff','#e14b4b','#2b3a6b','#2a8a46'],
  pants:['#2b3a6b','#1b1b22','#5a3d28','#355e3b','#6b6b6b','#4a2b6b'],
};
function initCreator(){
  Object.keys(PALETTES).forEach(group=>{
    const cont=document.querySelector(`.swatches[data-group="${group}"]`);
    PALETTES[group].forEach((c,i)=>{
      const sw=document.createElement('div'); sw.className='sw'+((c===AVATAR[group])?' sel':''); sw.style.background=c;
      sw.onclick=()=>{ AVATAR[group]=c; cont.querySelectorAll('.sw').forEach(s=>s.classList.remove('sel')); sw.classList.add('sel'); drawAvatarPreview(); };
      cont.appendChild(sw);
    });
  });
  document.getElementById('avName').addEventListener('input',e=>{ AVATAR.name=e.target.value||'kamil'; });
  drawAvatarPreview();
}
function drawAvatarPreview(){
  const cv=document.getElementById('avatarPreview'); const g=cv.getContext('2d'); const w=cv.width,h=cv.height;
  g.clearRect(0,0,w,h);
  // piernas
  g.fillStyle=AVATAR.pants; g.fillRect(w*0.4,h*0.6,18,70); g.fillRect(w*0.5,h*0.6,18,70);
  // torso
  g.fillStyle=AVATAR.shirt; g.fillRect(w*0.38,h*0.35,56,120);
  // brazos
  g.fillRect(w*0.3,h*0.36,16,90); g.fillRect(w*0.62,h*0.36,16,90);
  // manos / cara
  g.fillStyle=AVATAR.skin; g.beginPath(); g.arc(w*0.5,h*0.25,28,0,7); g.fill();
  g.fillRect(w*0.3,h*0.62,16,16); g.fillRect(w*0.62,h*0.62,16,16);
  // pelo
  g.fillStyle=AVATAR.hair; g.beginPath(); g.arc(w*0.5,h*0.23,30,Math.PI,0); g.fill();
  // ojos
  g.fillStyle='#111'; g.beginPath(); g.arc(w*0.44,h*0.26,3,0,7); g.arc(w*0.56,h*0.26,3,0,7); g.fill();
}

// =========================================================
//  MOVIMIENTO + COLISIONES + CAMARA 1a/3a persona
// =========================================================
const keys={};
window.addEventListener('keydown',e=>{ keys[e.key.toLowerCase()]=true; });
window.addEventListener('keyup',e=>{ keys[e.key.toLowerCase()]=false; });

// pointer lock para mirar
const clickToPlay=document.getElementById('clickToPlay');
function requestLock(){ canvas.requestPointerLock && canvas.requestPointerLock(); }
document.addEventListener('pointerlockchange',()=>{ pointerLocked=(document.pointerLockElement===canvas);
  clickToPlay.classList.toggle('hidden', pointerLocked || !gameStarted);
});
document.addEventListener('mousemove',e=>{ if(!pointerLocked)return;
  player.yaw -= e.movementX*0.0025; player.pitch -= e.movementY*0.0022;
  player.pitch=Math.max(-1.1,Math.min(1.0,player.pitch));
});

// tecla V: cambiar vista
window.addEventListener('keydown',e=>{ if(e.key.toLowerCase()==='v'){ player.thirdPerson=!player.thirdPerson; } });

// colision: resolver pos contra AABBs (circulo del jugador)
function resolveCollisions(next){
  const r=player.radius;
  for(const c of colliders){
    const b=c.box;
    // solo si el jugador (a su altura de cadera) intersecta en Y
    if(0.2>b.max.y || 1.0<b.min.y) { /* overlap vertical con cuerpo */ }
    const cx=Math.max(b.min.x,Math.min(next.x,b.max.x));
    const cz=Math.max(b.min.z,Math.min(next.z,b.max.z));
    const dx=next.x-cx, dz=next.z-cz; const d2=dx*dx+dz*dz;
    if(d2<r*r){ const d=Math.sqrt(d2)||0.0001; const push=(r-d);
      if(cx===next.x && cz===next.z){ next.x=b.max.x+r; } // dentro: empuja en X
      else { next.x+=dx/d*push; next.z+=dz/d*push; }
    }
  }
  // limites del cuarto
  const lim=HALF-0.4;
  next.x=Math.max(-lim,Math.min(lim,next.x)); next.z=Math.max(-lim,Math.min(lim,next.z));
}

function updatePlayer(dt){
  const fwd=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
  const rightV=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw)); // perpendicular
  const move=new THREE.Vector3();
  if(keys['w']||keys['arrowup']) move.add(fwd);
  if(keys['s']||keys['arrowdown']) move.sub(fwd);
  if(keys['d']) move.add(rightV);
  if(keys['a']) move.sub(rightV);
  // flechas izq/der giran en vez de strafe (comodidad)
  if(keys['arrowleft']) player.yaw+=dt*1.6;
  if(keys['arrowright']) player.yaw-=dt*1.6;

  const moving=move.lengthSq()>0;
  if(moving){ move.normalize(); const next=player.pos.clone().addScaledVector(move,player.speed*dt); resolveCollisions(next); player.pos.copy(next); }

  // avatar sigue al jugador
  if(avatar){ avatar.position.set(player.pos.x,0,player.pos.z); avatar.rotation.y=player.yaw+Math.PI;
    // bob de piernas al caminar
    const t=performance.now()*0.01; const sw=moving?Math.sin(t)*0.4:0;
    avatar.userData.legL.rotation.x=sw; avatar.userData.legR.rotation.x=-sw;
    avatar.userData.armL.rotation.x=-sw; avatar.userData.armR.rotation.x=sw;
    avatar.visible=player.thirdPerson; // oculto en 1a persona
  }
}

function updateCamera(dt){
  const eye=new THREE.Vector3(player.pos.x, player.height, player.pos.z);
  const dir=new THREE.Vector3(-Math.sin(player.yaw)*Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw)*Math.cos(player.pitch));

  // zoom cinematografico (solo 3a persona)
  if(camZoom.active){
    camZoom.t+=dt;
    if(camZoom.t < camZoom.dur){ const k=camZoom.t/camZoom.dur; const e=k*k*(3-2*k);
      camera.position.lerpVectors(camZoom.from,camZoom.to,e);
      const tgt=new THREE.Vector3().lerpVectors(camZoom.fromTgt,camZoom.toTgt,e); camera.lookAt(tgt); return;
    } else { camZoom.hold-=dt; camera.position.copy(camZoom.to); camera.lookAt(camZoom.toTgt);
      if(camZoom.hold<=0) camZoom.active=false; return; }
  }

  if(player.thirdPerson){
    const back=new THREE.Vector3(Math.sin(player.yaw),0,Math.cos(player.yaw));
    const camPos=eye.clone().addScaledVector(back,3.0).add(new THREE.Vector3(0,0.9,0));
    // no atravesar paredes: limitar
    const lim=HALF-0.3; camPos.x=Math.max(-lim,Math.min(lim,camPos.x)); camPos.z=Math.max(-lim,Math.min(lim,camPos.z));
    camera.position.lerp(camPos,0.2);
    camera.lookAt(eye.x, eye.y+0.2, eye.z);
    canvas.classList.remove('fp-cursor');
  } else {
    camera.position.copy(eye);
    camera.lookAt(eye.clone().add(dir));
    canvas.classList.add('fp-cursor');
  }
}

// =========================================================
//  INTERACCION: mirada (raycast desde centro/puntero) + E / clic
// =========================================================
const raycaster=new THREE.Raycaster();
let lookTarget=null;
const hudPrompt=document.getElementById('hudPrompt');

function updateLook(){
  // raycast desde el centro de la pantalla (direccion de camara)
  raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
  // En 3a persona la camara esta ~3m detras del avatar, asi que el alcance
  // efectivo debe contar esa distancia. Usamos un alcance generoso.
  const reach = player.thirdPerson ? 8.5 : 5.5;
  const hits=raycaster.intersectObjects(clickable,true);
  let root=null;
  if(hits.length && hits[0].distance<reach){ root=resolveRoot(hits[0].object); }
  if(root!==lookTarget){ if(lookTarget)setGlow(lookTarget,false); lookTarget=root; if(lookTarget)setGlow(lookTarget,true); }
  if(lookTarget){ hudPrompt.textContent='E / clic: '+lookTarget.userData.name; hudPrompt.classList.add('active'); }
  else { hudPrompt.textContent='\u00A0'; hudPrompt.classList.remove('active'); }
}
function resolveRoot(obj){ let o=obj; while(o){ if(o.userData&&o.userData.interactive)return o; if(o.userData&&o.userData.rootInteractive)return o.userData.rootInteractive; o=o.parent; } return null; }
function setGlow(root,on){ root.traverse(o=>{ if(o.isMesh&&o.material&&o.material.emissive){ if(on){ if(o.userData._se===undefined){o.userData._se=o.material.emissive.getHex();o.userData._si=o.material.emissiveIntensity??1;} o.material.emissive.setHex(0x4de0d0); o.material.emissiveIntensity=0.3; } else if(o.userData._se!==undefined){ o.material.emissive.setHex(o.userData._se); o.material.emissiveIntensity=o.userData._si; delete o.userData._se; delete o.userData._si; } } }); }

function activate(root){
  if(!root)return;
  showInfo(root.userData.name, root.userData.info);
  // zoom cinematografico solo en 3a persona
  if(player.thirdPerson && root.userData.focus){
    camZoom.active=true; camZoom.t=0; camZoom.hold=1.6;
    camZoom.from.copy(camera.position); camZoom.fromTgt.copy(player.pos).add(new THREE.Vector3(0,player.height,0));
    camZoom.to.copy(root.userData.focus.pos); camZoom.toTgt.copy(root.userData.focus.tgt);
  }
  if(typeof root.userData.onClick==='function') root.userData.onClick();
}
window.addEventListener('keydown',e=>{ if(e.key.toLowerCase()==='e' && gameStarted) activate(lookTarget); });
canvas.addEventListener('click',()=>{
  if(!gameStarted)return;
  if(!pointerLocked){ requestLock(); return; }
  if(lookTarget) activate(lookTarget);
});

// =========================================================
//  UI: info, robot console, navegador, minijuego
// =========================================================
const infoCard=document.getElementById('infocard');
document.getElementById('infoClose').onclick=()=>infoCard.classList.add('hidden');
function showInfo(title,body){ document.getElementById('infoTitle').textContent=title; document.getElementById('infoBody').textContent=body; infoCard.classList.remove('hidden'); }

const robotConsole=document.getElementById('robotConsole');
const rcLog=document.getElementById('rcLog'); const rcInput=document.getElementById('rcInput');
document.getElementById('rcClose').onclick=()=>robotConsole.classList.add('hidden');
function openRobotConsole(){ document.exitPointerLock&&document.exitPointerLock(); robotConsole.classList.remove('hidden'); rcInput.focus(); if(!rcLog.dataset.greeted){ logBot('ROBOT-UNIT en linea. Escribe "ayuda".'); rcLog.dataset.greeted='1'; } }
function logUser(t){ rcLog.innerHTML+=`<div class="user">&gt; ${esc(t)}</div>`; rcLog.scrollTop=rcLog.scrollHeight; }
function logBot(t){ rcLog.innerHTML+=`<div class="bot">${esc(t)}</div>`; rcLog.scrollTop=rcLog.scrollHeight; }
function esc(s){ return s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
rcInput.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key!=='Enter')return; const cmd=rcInput.value.trim(); if(!cmd)return; logUser(cmd); rcInput.value=''; handleRobotCommand(cmd.toLowerCase()); });
function handleRobotCommand(cmd){
  if(cmd.includes('ayuda')) logBot('comandos: hola | baila | girar | color <nombre> | salta | ayuda');
  else if(cmd.includes('hola')){ logBot('Hola '+AVATAR.name+'! Soy tu robot.'); robotHop(); }
  else if(cmd.includes('baila')){ logBot('A bailar! *beep boop*'); robotDance(); }
  else if(cmd.includes('gira')){ logBot('Girando 360...'); robotSpin(); }
  else if(cmd.startsWith('color')){ const n=cmd.replace('color','').trim(); const m={rojo:'#f33',verde:'#3f3',azul:'#39f',amarillo:'#ffd166',rosa:'#ff4fa3',cyan:'#4de0d0'}; if(m[n]){registry.robotVisor.material.emissive.set(m[n]);logBot('visor -> '+n);} else logBot('colores: rojo verde azul amarillo rosa cyan'); }
  else if(cmd.includes('salta')){ logBot('hop!'); robotHop(); }
  else logBot('no entiendo "'+cmd+'". escribe "ayuda".');
}
function robotSpin(){ const g=registry.robot; let t=0,dur=1.2,y0=g.rotation.y; animators.push(dt=>{t+=dt;const k=Math.min(t/dur,1);g.rotation.y=y0+k*Math.PI*2;if(k>=1){g.rotation.y=y0;return false;}return true;}); }
function robotHop(){ const g=registry.robot; let t=0,dur=0.6; animators.push(dt=>{t+=dt;const k=Math.min(t/dur,1);g.position.y=registry.robotBaseY+Math.sin(k*Math.PI)*0.22;if(k>=1)return false;return true;}); }
function robotDance(){ const g=registry.robot; let t=0,dur=2.4; animators.push(dt=>{t+=dt;const k=Math.min(t/dur,1);g.position.y=registry.robotBaseY+Math.abs(Math.sin(t*8))*0.12;g.rotation.z=Math.sin(t*10)*0.15;if(k>=1){g.rotation.z=0;return false;}return true;}); }

// navegador
const browserEl=document.getElementById('browser'); const gameWrap=document.getElementById('gameWrap');
function openBrowser(){ document.exitPointerLock&&document.exitPointerLock(); browserEl.classList.remove('hidden'); }
function closeBrowser(){ browserEl.classList.add('hidden'); stopGame(); gameWrap.classList.add('hidden'); }
document.getElementById('brClose').onclick=closeBrowser;
document.querySelectorAll('.app').forEach(btn=>btn.addEventListener('click',()=>{ const app=btn.dataset.app;
  if(app==='game'){ gameWrap.classList.remove('hidden'); startGame(); gameWrap.scrollIntoView({behavior:'smooth'}); }
  else { const url=APP_LINKS[app]; if(url) window.open(url,'_blank','noopener'); } }));

// minijuego
let gameRAF=null,gameState=null;
function startGame(){ const cv=document.getElementById('gameCanvas'); const ctx=cv.getContext('2d'); const W=cv.width,H=cv.height;
  gameState={px:W/2,pw:54,ph:14,score:0,lives:3,items:[],tick:0,over:false,keys:{}}; const s=gameState;
  const kd=e=>{ s.keys[e.key.toLowerCase()]=true; if(e.key==='Escape')closeBrowser(); }; const ku=e=>{ s.keys[e.key.toLowerCase()]=false; };
  window.addEventListener('keydown',kd); window.addEventListener('keyup',ku); s._kd=kd; s._ku=ku;
  function spawn(){ s.items.push({x:20+Math.random()*(W-40),y:-10,vy:1.4+Math.random()*1.6,good:Math.random()>0.4}); }
  function loop(){ s.tick++; if(s.tick%42===0)spawn();
    if(s.keys['arrowleft']||s.keys['a'])s.px-=4.5; if(s.keys['arrowright']||s.keys['d'])s.px+=4.5; s.px=Math.max(s.pw/2,Math.min(W-s.pw/2,s.px));
    for(let i=s.items.length-1;i>=0;i--){ const it=s.items[i]; it.y+=it.vy; const py=H-28;
      if(it.y>py-10&&it.y<py+10&&Math.abs(it.x-s.px)<s.pw/2+10){ if(it.good)s.score+=10; else s.lives--; s.items.splice(i,1); continue; }
      if(it.y>H+12) s.items.splice(i,1); }
    if(s.lives<=0)s.over=true;
    ctx.fillStyle='#05060f'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(25,247,200,0.12)'; ctx.lineWidth=1; for(let x=0;x<W;x+=28){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    s.items.forEach(it=>{ ctx.fillStyle=it.good?'#4de0d0':'#ff4f6d'; ctx.beginPath(); ctx.arc(it.x,it.y,9,0,7); ctx.fill(); ctx.fillStyle='#021'; ctx.font='10px monospace'; ctx.textAlign='center'; ctx.fillText(it.good?'C':'x',it.x,it.y+3); ctx.textAlign='left'; });
    ctx.fillStyle='#ffd24a'; ctx.fillRect(s.px-s.pw/2,H-34,s.pw,s.ph); ctx.fillStyle='#8a6bff'; ctx.fillRect(s.px-s.pw/2,H-34,s.pw,4);
    ctx.fillStyle='#e7f6ff'; ctx.font='bold 14px monospace'; ctx.fillText('score: '+s.score,10,20); ctx.fillText('vidas: '+'\u2665'.repeat(Math.max(0,s.lives)),W-120,20);
    if(s.over){ ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(0,0,W,H); ctx.fillStyle='#ff4fa3'; ctx.font='bold 26px monospace'; ctx.textAlign='center'; ctx.fillText('GAME OVER',W/2,H/2-10); ctx.fillStyle='#4de0d0'; ctx.font='14px monospace'; ctx.fillText('score '+s.score+' — clic Minijuego para reintentar',W/2,H/2+18); ctx.textAlign='left'; stopGame(); return; }
    gameRAF=requestAnimationFrame(loop); }
  loop();
}
function stopGame(){ if(gameRAF)cancelAnimationFrame(gameRAF); gameRAF=null; if(gameState){ window.removeEventListener('keydown',gameState._kd); window.removeEventListener('keyup',gameState._ku); } }

// ESC cierra overlays o suelta raton
window.addEventListener('keydown',e=>{ if(e.key!=='Escape')return;
  if(!browserEl.classList.contains('hidden')){ closeBrowser(); return; }
  if(!robotConsole.classList.contains('hidden')){ robotConsole.classList.add('hidden'); return; }
});

// =========================================================
//  BUILD + ARRANQUE
// =========================================================
function buildAll(){
  buildRoom(); buildPosters(); buildShelves(); buildDesk(); buildDeskLamp();
  buildSwitchAndDisco(); buildChair();
  buildBed(); buildWardrobe(); buildDoor();
  makeWindow('back', -2.0, 'w1'); makeWindow('right', 2.2, 'w2');
  buildPrinter(); buildArm(); buildRobot(); buildLaptop(); buildLego(); buildSolder();
  avatar=buildAvatar(); avatar.position.set(player.pos.x,0,player.pos.z); scene.add(avatar);
}

let gameStarted=false;
function startGameWorld(){
  const loaderEl=document.getElementById('loader'); const loaderFill=document.querySelector('.loader-fill');
  document.getElementById('startScreen').classList.add('gone');
  loaderEl.classList.remove('hidden');
  let lp=0; const li=setInterval(()=>{ lp+=Math.random()*20+8; loaderFill.style.width=Math.min(lp,100)+'%';
    if(lp>=100){ clearInterval(li); setTimeout(()=>{ loaderEl.classList.add('gone'); document.getElementById('hud').classList.remove('hidden'); document.getElementById('hudName').textContent=AVATAR.name; clickToPlay.classList.remove('hidden'); gameStarted=true; },300); } },120);
  buildAll();
}

initCreator();
document.getElementById('enterBtn').onclick=startGameWorld;

// =========================================================
//  POST-PROCESADO: bloom SELECTIVO (solo capa BLOOM) + SMAA + vignette
//  Tecnica de dos composers: 1) render de la escena con todo oscurecido
//  menos la capa bloom -> UnrealBloom. 2) composer final que suma ese
//  bloom sobre la escena completa, aplica vignette y SMAA.
// =========================================================
const bloomParams = { strength: 0.75, radius: 0.5, threshold: 0.0 };

// Composer 1: solo bloom
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), bloomParams.strength, bloomParams.radius, bloomParams.threshold);
const composerBloom = new EffectComposer(renderer);
composerBloom.renderToScreen = false;
composerBloom.addPass(renderScene);
composerBloom.addPass(bloomPass);

// Shader que mezcla (base + bloom) y aplica vignette sutil
const mixPass = new ShaderPass(new THREE.ShaderMaterial({
  uniforms: {
    baseTexture:  { value: null },
    bloomTexture: { value: composerBloom.renderTarget2.texture },
    vignette:     { value: 0.28 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D baseTexture;
    uniform sampler2D bloomTexture;
    uniform float vignette;
    varying vec2 vUv;
    void main(){
      vec4 base = texture2D(baseTexture, vUv);
      vec4 bloom = texture2D(bloomTexture, vUv);
      vec3 col = base.rgb + bloom.rgb;            // bloom aditivo
      // vignette suave
      vec2 q = vUv - 0.5;
      float v = smoothstep(0.85, 0.35, length(q));
      col *= mix(1.0, v, vignette);
      gl_FragColor = vec4(col, 1.0);
    }`,
  defines: {},
}), 'baseTexture');
mixPass.needsSwap = true;

const composerFinal = new EffectComposer(renderer);
composerFinal.addPass(renderScene);
composerFinal.addPass(mixPass);
const smaaPass = new SMAAPass(window.innerWidth*renderer.getPixelRatio(), window.innerHeight*renderer.getPixelRatio());
composerFinal.addPass(smaaPass);
composerFinal.addPass(new OutputPass());

// Para el pase de bloom: ennegrecer todo lo que NO esta en la capa bloom
const darkMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
const matStash = {};
function darkenNonBloom(obj){
  // solo Mesh (no Sprites: su SpriteMaterial no es intercambiable por MeshBasicMaterial)
  if(obj.isMesh && !bloomLayer.test(obj.layers)){
    matStash[obj.uuid] = obj.material; obj.material = darkMat;
  } else if(obj.isSprite && !bloomLayer.test(obj.layers)){
    // ocultar sprites no-bloom durante el pase
    obj.userData._wasVisible = obj.visible; obj.visible = false;
  }
}
function restoreMat(obj){
  if(matStash[obj.uuid]){ obj.material = matStash[obj.uuid]; delete matStash[obj.uuid]; }
  if(obj.isSprite && obj.userData._wasVisible!==undefined){ obj.visible = obj.userData._wasVisible; delete obj.userData._wasVisible; }
}

// =========================================================
//  RESIZE + LOOP
// =========================================================
function onResize(){
  const w=window.innerWidth, h=window.innerHeight;
  camera.aspect=w/h; camera.updateProjectionMatrix();
  renderer.setSize(w,h);
  composerBloom.setSize(w,h); composerFinal.setSize(w,h);
}
window.addEventListener('resize', onResize);

const clock=new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),0.05);
  if(gameStarted){ updatePlayer(dt); updateCamera(dt); updateLook(); }
  for(let i=animators.length-1;i>=0;i--){ if(animators[i](dt)===false) animators.splice(i,1); }

  // 1) pase de bloom: oscurecer no-bloom (y quitar fondo+niebla para no contaminar), render, restaurar
  const prevBg = scene.background; const prevFog = scene.fog;
  scene.background = null; scene.fog = null;
  scene.traverse(darkenNonBloom);
  composerBloom.render();
  scene.traverse(restoreMat);
  scene.background = prevBg; scene.fog = prevFog;
  // 2) pase final (escena completa + bloom + vignette + SMAA)
  composerFinal.render();
}
animate();
