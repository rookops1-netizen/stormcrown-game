import * as THREE from 'three';

let scene, camera, renderer, clock;
let player, enemies = [], particles = [], projectiles = [];
let keys = {};
let activeHero = 0;
let gameStarted = false;
let cameraAngleY = 0;
let cameraAngleX = 0.4;
let firePitLight;
let score = 0;
let respawnTimer = 0;

const HEROES = [
  { name: 'Zeal', color: 0x4CAF50, speed: 7, jump: 10, attack: 8, health: 80, hairColor: 0x3B2507 },
  { name: 'Brave', color: 0xF44336, speed: 5, jump: 8, attack: 15, health: 120, hairColor: 0xB8860B },
  { name: 'River', color: 0x2196F3, speed: 6, jump: 11, attack: 10, health: 95, hairColor: 0x1a1a2e },
];
const GRAVITY = -25;

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);
  scene.fog = new THREE.FogExp2(0x87CEEB, 0.008);
  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  document.body.appendChild(renderer.domElement);
  clock = new THREE.Clock();
  scene.add(new THREE.AmbientLight(0xffeedd, 0.5));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.3);
  sun.position.set(50, 80, 30); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const d = 80;
  sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
  sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 200;
  scene.add(sun); scene.add(new THREE.HemisphereLight(0x87CEEB, 0x3d6b3d, 0.3));

  buildTerrain(); buildVillage(); buildForest(); buildMountains();
  createPlayer(); spawnEnemies();

  document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Digit1') switchHero(0);
    if (e.code === 'Digit2') switchHero(1);
    if (e.code === 'Digit3') switchHero(2);
    if (e.code === 'KeyR' && player.health <= 0) revive();
    if (e.code === 'Space' && gameStarted) e.preventDefault();
  });
  document.addEventListener('keyup', e => keys[e.code] = false);
  document.addEventListener('mousedown', () => { if (gameStarted) doAttack(); });
  document.addEventListener('mousemove', e => {
    if (!gameStarted || !document.pointerLockElement) return;
    cameraAngleY -= e.movementX * 0.003;
    cameraAngleX = Math.max(0.15, Math.min(1.2, cameraAngleX + e.movementY * 0.002));
  });
  renderer.domElement.addEventListener('click', () => {
    if (gameStarted) renderer.domElement.requestPointerLock();
  });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight);
  });
  document.getElementById('start-btn').addEventListener('click', startGame);
  animate();
}

function buildTerrain() {
  const geo = new THREE.PlaneGeometry(300, 300, 80, 80);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), z = pos.getY(i);
    let y = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 2 + Math.sin(x * 0.02 + z * 0.03) * 3;
    const dist = Math.sqrt(x * x + z * z);
    if (dist < 25) y *= dist / 25;
    pos.setZ(i, y);
  }
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x4a7c3f }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const pm = new THREE.MeshLambertMaterial({ color: 0x8B7355 });
  const p1 = new THREE.Mesh(new THREE.PlaneGeometry(4, 100), pm);
  p1.rotation.x = -Math.PI / 2; p1.position.set(0, 0.05, 20); scene.add(p1);
  const p2 = new THREE.Mesh(new THREE.PlaneGeometry(100, 4), pm);
  p2.rotation.x = -Math.PI / 2; p2.position.set(10, 0.05, 0); scene.add(p2);
}

function buildVillage() {
  const wood = new THREE.MeshLambertMaterial({ color: 0x8B6914 });
  const roof = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
  const stone = new THREE.MeshLambertMaterial({ color: 0x808080 });
  const door = new THREE.MeshLambertMaterial({ color: 0x4a3520 });
  const winMat = new THREE.MeshBasicMaterial({ color: 0xFFCC66 });

  function house(x, z, w, h, d, rh) {
    const g = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood);
    walls.position.y = h / 2; walls.castShadow = true; g.add(walls);
    g.add(new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.75, rh, 4), roof)).position.y = h + rh / 2;
    g.children[g.children.length - 1].rotation.y = Math.PI / 4;
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(w * 0.25, h * 0.5), door)).position.set(0, h * 0.25, d / 2 + 0.01);
    for (let s of [-1, 1]) { const w2 = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), winMat); w2.position.set(s * w * 0.3, h * 0.6, d / 2 + 0.01); g.add(w2); }
    g.position.set(x, 0, z); scene.add(g);
  }
  house(-8, -5, 4, 3, 4, 2); house(5, -8, 3.5, 2.8, 3.5, 1.8);
  house(-12, 6, 3, 2.5, 3, 1.5); house(8, 5, 3.5, 3, 4, 2);
  house(0, -15, 5, 3.5, 5, 2.5);

  scene.add(new THREE.Mesh(new THREE.CylinderGeometry(1, 1.2, 1.5, 8), stone)).position.set(0, 0.75, 2);
  const wr = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.5, 4), roof);
  wr.position.set(0, 3.5, 2); wr.rotation.y = Math.PI / 4; scene.add(wr);

  const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 0.3, 8), new THREE.MeshBasicMaterial({ color: 0xFF4400 }));
  fp.position.set(0, 0.15, -8); scene.add(fp);
  firePitLight = new THREE.PointLight(0xFF6600, 2, 15);
  firePitLight.position.set(0, 1.5, -8); scene.add(firePitLight);

  function lantern(x, z) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), wood);
    p.position.set(x, 1.5, z); scene.add(p);
    const l = new THREE.PointLight(0xFF8C00, 0.6, 8); l.position.set(x, 3, z); scene.add(l);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshBasicMaterial({ color: 0xFFAA00 }));
    b.position.set(x, 3, z); scene.add(b);
  }
  lantern(-4, 0); lantern(4, 0); lantern(0, -10); lantern(-10, 2);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.7, 8), wood);
    barrel.position.set(Math.cos(a) * 3 - 8, 0.35, Math.sin(a) * 3 - 5);
    barrel.castShadow = true; scene.add(barrel);
  }
}

function buildForest() {
  const trunk = new THREE.MeshLambertMaterial({ color: 0x4a3520 });
  const leafColors = [0x2d6b2d, 0x3d8b3d, 0x1d5b1d, 0x4d9b4d];
  function tree(x, z, s = 1) {
    const g = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.35 * s, 3 * s, 5), trunk);
    t.position.y = 1.5 * s; t.castShadow = true; g.add(t);
    const lc = leafColors[Math.floor(Math.random() * leafColors.length)];
    for (let j = 0; j < 3; j++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry((2.5 - j * 0.6) * s, (2 - j * 0.3) * s, 6), new THREE.MeshLambertMaterial({ color: lc }));
      cone.position.y = (3 + j * 1.2) * s; cone.castShadow = true; g.add(cone);
    }
    g.position.set(x, 0, z); scene.add(g);
  }
  const rng = seed => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };
  const r = rng(42);
  for (let i = 0; i < 45; i++) { const a = r() * Math.PI * 2, d = 22 + r() * 15; tree(Math.cos(a) * d, Math.sin(a) * d, 0.7 + r() * 0.5); }
  for (let i = 0; i < 80; i++) { const a = r() * Math.PI * 2, d = 40 + r() * 60; tree(Math.cos(a) * d, Math.sin(a) * d, 0.6 + r() * 0.7); }
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x808080 });
  for (let i = 0; i < 25; i++) {
    const a = r() * Math.PI * 2, d = 20 + r() * 70, s = 0.3 + r() * 0.7;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
    rock.position.set(Math.cos(a) * d, s * 0.4, Math.sin(a) * d);
    rock.rotation.set(r() * 3, r() * 3, 0); rock.castShadow = true; scene.add(rock);
  }
}

function buildMountains() {
  const mt = new THREE.MeshLambertMaterial({ color: 0x5a5a6e });
  const snow = new THREE.MeshLambertMaterial({ color: 0xe8e8f0 });
  function mountain(x, z, h) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.ConeGeometry(h * 1.2, h, 6), mt); b.position.y = h / 2; g.add(b);
    const c = new THREE.Mesh(new THREE.ConeGeometry(h * 0.5, h * 0.25, 6), snow); c.position.y = h * 0.85; g.add(c);
    g.position.set(x, 0, z); scene.add(g);
  }
  mountain(-60, -120, 50); mountain(-20, -130, 60); mountain(30, -125, 55); mountain(80, -120, 45);
  mountain(130, -40, 45); mountain(140, 20, 55); mountain(-130, -30, 50); mountain(-125, 30, 45);
}

function createPlayer() {
  const hero = HEROES[activeHero];
  player = { group: new THREE.Group(), health: hero.health, maxHealth: hero.health,
    velocity: new THREE.Vector3(), grounded: true, attacking: false, attackTimer: 0,
    invincible: 0, walkCycle: 0 };
  buildPlayerModel();
  player.group.position.set(0, 1, 8);
  scene.add(player.group);
}

function buildPlayerModel() {
  while (player.group.children.length) player.group.remove(player.group.children[0]);
  const hero = HEROES[activeHero];
  const bc = new THREE.Color(hero.color);
  const bodyMat = new THREE.MeshLambertMaterial({ color: bc });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xFFDDB0 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x3d3d3d });
  const hairMat = new THREE.MeshLambertMaterial({ color: hero.hairColor });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1, 0.5), bodyMat);
  body.position.y = 1.2; body.castShadow = true; player.group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMat);
  head.position.y = 2; head.castShadow = true; player.group.add(head);
  for (const s of [-0.12, 0.12]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), eyeMat);
    eye.position.set(s, 2.05, 0.26); player.group.add(eye);
  }
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.55), hairMat);
  hair.position.y = 2.25; player.group.add(hair);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 0.3), darkMat);
    leg.position.set(s * 0.2, 0.4, 0); leg.castShadow = true; player.group.add(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), bodyMat);
    arm.position.set(s * 0.55, 1.2, 0); player.group.add(arm);
  }

  if (activeHero === 1) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.08), new THREE.MeshLambertMaterial({ color: 0xDEB887 }));
    blade.position.set(0.7, 1.8, 0.2); blade.rotation.z = -0.3; player.group.add(blade);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.1), new THREE.MeshLambertMaterial({ color: 0x8B6914 }));
    guard.position.set(0.6, 1.3, 0.2); player.group.add(guard);
  } else if (activeHero === 2) {
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6), new THREE.MeshLambertMaterial({ color: 0x6B4226 }));
    staff.position.set(-0.6, 1.6, 0.2); player.group.add(staff);
    const herb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 4), new THREE.MeshLambertMaterial({ color: 0x66BB6A }));
    herb.position.set(-0.6, 2.5, 0.2); player.group.add(herb);
  } else {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 6), new THREE.MeshLambertMaterial({ color: 0x6B4226 }));
    stick.position.set(0.6, 1.6, 0.15); stick.rotation.z = -0.2; player.group.add(stick);
  }

  // Name label
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.font = 'Bold 32px Arial';
  ctx.fillStyle = '#FFD700';
  ctx.textAlign = 'center';
  ctx.fillText(hero.name, 128, 40);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.position.y = 2.8;
  sprite.scale.set(2, 0.5, 1);
  player.group.add(sprite);
}

function switchHero(idx) {
  if (idx === activeHero || !gameStarted) return;
  activeHero = idx;
  const hero = HEROES[idx];
  const ratio = player.health / player.maxHealth;
  player.health = Math.ceil(hero.health * ratio);
  player.maxHealth = hero.health;
  buildPlayerModel();
  updateHUD();
  showMessage(hero.name + '!');
}

function revive() {
  if (player.health > 0) return;
  player.health = player.maxHealth;
  player.invincible = 2;
  updateHUD();
  showMessage('Revived!');
}

function updateHUD() {
  const hero = HEROES[activeHero];
  document.getElementById('health-label').textContent = hero.name.toUpperCase();
  document.getElementById('health-fill').style.width = Math.max(0, (player.health / player.maxHealth) * 100) + '%';
  document.querySelectorAll('.hero-btn').forEach((btn, i) => btn.classList.toggle('active', i === activeHero));
}

function showMessage(text) {
  const el = document.getElementById('message');
  el.textContent = text; el.style.opacity = 1;
  setTimeout(() => el.style.opacity = 0, 1500);
}

function flashDamage() {
  const el = document.getElementById('damage-flash');
  el.style.opacity = 1; setTimeout(() => el.style.opacity = 0, 200);
}

function spawnEnemies() {
  const spawnData = [
    { type: 'orc', x: 25, z: 25, health: 40 },
    { type: 'orc', x: -30, z: 15, health: 40 },
    { type: 'orc', x: 15, z: 35, health: 40 },
    { type: 'ogre', x: -20, z: -25, health: 100 },
    { type: 'orc', x: 35, z: -15, health: 40 },
    { type: 'troll', x: -35, z: -35, health: 200 },
  ];
  spawnData.forEach(sp => {
    const group = new THREE.Group();
    const colors = { orc: 0x556B2F, ogre: 0x5C4033, troll: 0x696969 };
    const sizes = { orc: 1, ogre: 1.5, troll: 1.8 };
    const s = sizes[sp.type];
    const mat = new THREE.MeshLambertMaterial({ color: colors[sp.type] });

    const b = new THREE.Mesh(new THREE.BoxGeometry(0.8 * s, 1.2 * s, 0.5 * s), mat);
    b.position.y = 0.6 * s; b.castShadow = true; group.add(b);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.45 * s, 0.45 * s), new THREE.MeshLambertMaterial({ color: new THREE.Color(colors[sp.type]).multiplyScalar(0.8) }));
    h.position.y = 1.4 * s; h.castShadow = true; group.add(h);

    const eyeColor = sp.type === 'troll' ? 0xFF0000 : 0xFFAA00;
    for (const side of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04 * s, 4, 4), new THREE.MeshBasicMaterial({ color: eyeColor }));
      eye.position.set(side * s, 1.45 * s, 0.23 * s); group.add(eye);
    }

    if (sp.type === 'troll') {
      const club = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2, 0.2), new THREE.MeshLambertMaterial({ color: 0x4a3520 }));
      club.position.set(0.6, 0.8, 0.3); club.rotation.z = -0.5; group.add(club);
    } else {
      const sword = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8 * s, 0.05), new THREE.MeshLambertMaterial({ color: 0x888888 }));
      sword.position.set(0.5 * s, 0.8, 0); group.add(sword);
    }

    group.position.set(sp.x, 0, sp.z); scene.add(group);
    enemies.push({
      group, type: sp.type, health: sp.health, maxHealth: sp.health,
      speed: sp.type === 'troll' ? 1.5 : sp.type === 'ogre' ? 2 : 3,
      damage: sp.type === 'troll' ? 20
 : sp.type === 'ogre' ? 12 : 6,
      range: sp.type === 'troll' ? 3 : 2, attackCooldown: 0, state: 'patrol',
      patrolCenter: new THREE.Vector3(sp.x, 0, sp.z), patrolAngle: Math.random() * Math.PI * 2,
    });
  });
}

function doAttack() {
  if (!gameStarted || player.attacking || player.health <= 0) return;
  player.attacking = true;
  player.attackTimer = 0.4;
  const hero = HEROES[activeHero];
  const pos = player.group.position;
  const fwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.group.rotation.y);

  enemies.forEach(enemy => {
    if (enemy.health <= 0) return;
    const dist = pos.distanceTo(enemy.group.position);
    const atkRange = activeHero === 1 ? 2.5 : activeHero === 2 ? 3 : 5;
    if (dist < atkRange) {
      const dir = new THREE.Vector3().subVectors(enemy.group.position, pos).normalize();
      const dot = fwd.dot(dir);
      if (dot > 0.3 || dist < 1.5) {
        enemy.health -= hero.attack;
        enemy.group.position.add(dir.multiplyScalar(0.5));
        for (let i = 0; i < 5; i++) spawnParticle(enemy.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xFF6600);
        if (enemy.health <= 0) {
          const pts = enemy.type === 'troll' ? 100 : enemy.type === 'ogre' ? 50 : 25;
          score += pts;
          showMessage(enemy.type.charAt(0).toUpperCase() + enemy.type.slice(1) + ' defeated! +' + pts);
          const epos = enemy.group.position.clone();
          const ecolor = enemy.type === 'troll' ? 0x696969 : enemy.type === 'ogre' ? 0x5C4033 : 0x556B2F;
          for (let i = 0; i < 15; i++) spawnParticle(epos.clone().add(new THREE.Vector3(Math.random() - 0.5, Math.random() * 2, Math.random() - 0.5)), ecolor);
          scene.remove(enemy.group);
        }
      }
    }
  });

  if (activeHero === 0) {
    const proj = new THREE.Mesh(new THREE.SphereGeometry(0.1, 4, 4), new THREE.MeshBasicMaterial({ color: 0x8B6914 }));
    proj.position.copy(pos).add(new THREE.Vector3(0, 1.5, 0));
    scene.add(proj);
    projectiles.push({ mesh: proj, velocity: fwd.clone().multiplyScalar(20).add(new THREE.Vector3(0, 2, 0)), life: 2 });
  }
  if (activeHero === 2 && Math.random() < 0.3) {
    player.health = Math.min(player.maxHealth, player.health + 5);
    updateHUD();
    for (let i = 0; i < 8; i++) spawnParticle(pos.clone().add(new THREE.Vector3(Math.random() - 0.5, Math.random() * 2, Math.random() - 0.5)), 0x66BB6A);
  }
}

function spawnParticle(pos, color) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 4, 4), new THREE.MeshBasicMaterial({ color }));
  mesh.position.copy(pos); scene.add(mesh);
  particles.push({ mesh, life: 1, velocity: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 5, (Math.random() - 0.5) * 3) });
}

function updatePlayer(dt) {
  if (player.health <= 0) return;
  const hero = HEROES[activeHero];
  const moveDir = new THREE.Vector3();
  if (keys['KeyW']) moveDir.z -= 1;
  if (keys['KeyS']) moveDir.z += 1;
  if (keys['KeyA']) moveDir.x -= 1;
  if (keys['KeyD']) moveDir.x += 1;

  if (moveDir.length() > 0) {
    moveDir.normalize();
    moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngleY);
    player.group.position.x += moveDir.x * hero.speed * dt;
    player.group.position.z += moveDir.z * hero.speed * dt;
    player.group.rotation.y = Math.atan2(moveDir.x, moveDir.z);
    player.walkCycle += dt * 10;
  }

  // Jump
  if (keys['Space'] && player.grounded) {
    player.velocity.y = hero.jump;
    player.grounded = false;
  }

  // Gravity
  player.velocity.y += GRAVITY * dt;
  player.group.position.y += player.velocity.y * dt;
  if (player.group.position.y <= 1) {
    player.group.position.y = 1;
    player.velocity.y = 0;
    player.grounded = true;
  }

  // Attack animation
  if (player.attacking) {
    player.attackTimer -= dt;
    if (player.attackTimer <= 0) player.attacking = false;
  }

  // Invincibility
  if (player.invincible > 0) {
    player.invincible -= dt;
    // Flash effect
    if (Math.floor(player.invincible * 10) % 2 === 0) {
      player.group.visible = true;
    } else {
      player.group.visible = false;
    }
  } else {
    player.group.visible = true;
  }

  // Walk bob
  if (moveDir.length() > 0) {
    const bobAmount = Math.sin(player.walkCycle) * 0.15;
    player.group.position.y += bobAmount * dt;
  }

  // Bounds
  player.group.position.x = Math.max(-120, Math.min(120, player.group.position.x));
  player.group.position.z = Math.max(-120, Math.min(120, player.group.position.z));
}

function updateEnemies(dt) {
  const playerPos = player.group.position;
  enemies.forEach(enemy => {
    if (enemy.health <= 0) return;
    const dist = playerPos.distanceTo(enemy.group.position);
    if (dist < 30) enemy.state = 'chase';
    if (dist > 45) enemy.state = 'patrol';

    if (enemy.state === 'chase' && player.health > 0) {
      const dir = new THREE.Vector3().subVectors(playerPos, enemy.group.position).normalize();
      enemy.group.lookAt(new THREE.Vector3(playerPos.x, enemy.group.position.y, playerPos.z));

      if (dist > enemy.range) {
        enemy.group.position.x += dir.x * enemy.speed * dt;
        enemy.group.position.z += dir.z * enemy.speed * dt;
      } else if (enemy.attackCooldown <= 0) {
        if (player.invincible <= 0) {
          player.health -= enemy.damage;
          flashDamage();
          updateHUD();
          if (player.health <= 0) {
            player.health = 0;
            updateHUD();
            showMessage(HEROES[activeHero].name + ' fell! Press R to revive');
          }
        }
        enemy.attackCooldown = 1.5;
        enemy.group.position.add(dir.clone().multiplyScalar(0.3));
        setTimeout(() => { if (enemy.health > 0) enemy.group.position.add(dir.clone().multiplyScalar(-0.3)); }, 200);
      }
    } else {
      enemy.patrolAngle += dt * 0.5;
      const px = enemy.patrolCenter.x + Math.cos(enemy.patrolAngle) * 5;
      const pz = enemy.patrolCenter.z + Math.sin(enemy.patrolAngle) * 5;
      const dir = new THREE.Vector3(px - enemy.group.position.x, 0, pz - enemy.group.position.z).normalize();
      enemy.group.position.x += dir.x * enemy.speed * 0.3 * dt;
      enemy.group.position.z += dir.z * enemy.speed * 0.3 * dt;
      enemy.group.lookAt(new THREE.Vector3(px, enemy.group.position.y, pz));
    }
    if (enemy.attackCooldown > 0) enemy.attackCooldown -= dt;

    // Walk bob
    const bob = Math.sin(Date.now() * 0.005 + enemy.patrolAngle) * 0.05;
    enemy.group.position.y = bob;
  });
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
    p.velocity.y -= 15 * dt;
    p.life -= dt;

    // Hit check
    enemies.forEach(enemy => {
      if (enemy.health <= 0) return;
      if (p.mesh.position.distanceTo(enemy.group.position) < 1.5) {
        enemy.health -= HEROES[activeHero].attack;
        for (let j = 0; j < 5; j++) spawnParticle(p.mesh.position.clone(), 0xFF6600);
        if (enemy.health <= 0) {
          const pts = enemy.type === 'troll' ? 100 : enemy.type === 'ogre' ? 50 : 25;
          score += pts;
          showMessage(enemy.type.charAt(0).toUpperCase() + enemy.type.slice(1) + ' defeated! +' + pts);
          scene.remove(enemy.group);
        }
        scene.remove(p.mesh);
        projectiles.splice(i, 1);
      }
    });

    if (p.life <= 0) { scene.remove(p.mesh); projectiles.splice(i, 1); }
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
    p.velocity.y -= 10 * dt;
    p.life -= dt * 2;
    p.mesh.scale.setScalar(Math.max(0.01, p.life));
    if (p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); }
  }
}

function updateCamera() {
  const pos = player.group.position;
  const camX = pos.x + Math.sin(cameraAngleY) * Math.cos(cameraAngleX) * 8;
  const camY = pos.y + Math.sin(cameraAngleX) * 8 + 2;
  const camZ = pos.z + Math.cos(cameraAngleY) * Math.cos(cameraAngleX) * 8;
  camera.position.set(camX, camY, camZ);
  camera.lookAt(pos.x, pos.y + 1.5, pos.z);
}

function startGame() {
  gameStarted = true;
  const title = document.getElementById('title-screen');
  title.style.opacity = 0;
  setTimeout(() => title.style.display = 'none', 1000);
  document.getElementById('hud').style.display = 'flex';
  document.getElementById('controls-hint').style.display = 'block';
  renderer.domElement.requestPointerLock();
  updateHUD();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (gameStarted) {
    updatePlayer(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateParticles(dt);
    updateCamera();

    // Fire flicker
    if (firePitLight) firePitLight.intensity = 2 + Math.sin(Date.now() * 0.01) * 0.5;
  } else {
    // Title screen camera orbit
    const t = Date.now() * 0.0003;
    camera.position.set(Math.cos(t) * 25, 15, Math.sin(t) * 25);
    camera.lookAt(0, 2, 0);
  }

  renderer.render(scene, camera);
}

// Make switchHero global for HTML buttons
window.switchHero = switchHero;

init();
