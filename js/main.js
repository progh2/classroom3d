import * as THREE from 'three';
import { buildRoom } from './room.js';
import { loadCast, updateActors, actorColliders } from './characters.js';
import { FPControls } from './controls.js';
import { ROOM } from './plan.js';
import { assetURL } from './assets.js';

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0d0f14');
const camera = new THREE.PerspectiveCamera(isTouch ? 75 : 70, innerWidth / innerHeight, 0.05, 60);

// ── 화면 텍스처 (리눅스 실습 캡처) ──
const tl = new THREE.TextureLoader();
const loadTex = f => { const t = tl.load(assetURL('assets/screens/' + f)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const screenTex = {
  s1: loadTex('term_chmod.png'), s2: loadTex('term_osrelease.png'), s3: loadTex('term_ps_grep.png'), s4: loadTex('term_vim.png'),
  t1: loadTex('teacher_check.png'), t2: loadTex('board_lesson.png'),
  board: loadTex('board_lesson.png'), tv: loadTex('tv_task.png'),
};

const room = buildRoom(scene, screenTex);

// ── 조명 ──
// 아침: 해가 동쪽(복도 쪽)이라 서쪽 창으로 직사광 없음 → 푸른 확산광 / 점심: 가장 밝음 / 저녁: 천장등만
const hemi = new THREE.HemisphereLight('#ffffff', '#887766', 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 1.0);
sun.position.set(-5, 7, 5); sun.target.position.set(3.3, 0, 4.2); scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight('#ffffff', 0.3); // 창(서쪽)에서 들어오는 확산 반사광 근사
fill.position.set(-8, 3, 4); fill.target.position.set(3.3, 1, 4.2); scene.add(fill, fill.target);
// LED 바 조명 묶음마다 스포트라이트 12개 (저녁에만 켬, 개수 고정 → 모드 전환 시 셰이더 재컴파일 없음)
const ceilLights = [];
for (const x of room.lightXs) for (const z of room.lightZs) {
  const sp = new THREE.SpotLight('#ffe9cc', 0, 0, 0.9, 0.55, 2);
  sp.position.set(x, ROOM.H - 0.05, z); sp.target.position.set(x, 0, z);
  scene.add(sp, sp.target); ceilLights.push(sp);
}

const MODES = [
  { key: 'morning', label: '아침', icon: '🌅', hemi: ['#cfe0ff', '#a9a69c', 0.72], sun: ['#ffffff', 0.0], fill: ['#bcd4ff', 0.38], ceil: 0, panel: '#cfcfcc', cove: '#958f84', dl: '#e2e2de', sky: '#c9dcf0', skyMap: 'day', bg: '#c9dcf0', corridor: 0.55, switchLed: '#555' },
  { key: 'noon', label: '점심', icon: '☀️', hemi: ['#ffffff', '#c9bfa9', 1.05], sun: ['#fff4dc', 1.15], fill: ['#ffffff', 0.3], ceil: 0, panel: '#dcdbd5', cove: '#a39d91', dl: '#e8e8e4', sky: '#b4dcff', skyMap: 'day', bg: '#b4dcff', corridor: 1.0, switchLed: '#555' },
  { key: 'evening', label: '저녁', icon: '🌙', hemi: ['#7d8cc0', '#3a342c', 0.05], sun: ['#000000', 0.0], fill: ['#000000', 0.0], ceil: 3.1, panel: '#fffaf0', cove: '#ffd59a', dl: '#fff1d6', sky: '#ffffff', skyMap: 'night', bg: '#02040a', corridor: 0.14, switchLed: '#5cff6a' },
];
let modeIdx = 0;
function setMode(i) {
  modeIdx = (i + MODES.length) % MODES.length;
  const m = MODES[modeIdx];
  hemi.color.set(m.hemi[0]); hemi.groundColor.set(m.hemi[1]); hemi.intensity = m.hemi[2];
  sun.color.set(m.sun[0]); sun.intensity = m.sun[1];
  fill.color.set(m.fill[0]); fill.intensity = m.fill[1];
  ceilLights.forEach(p => p.intensity = m.ceil);
  room.panelMat.color.set(m.panel); room.coveMat.color.set(m.cove); room.dlMat.color.set(m.dl);
  room.skyMat.map = m.skyMap === 'night' ? room.skyNight : room.skyDay; room.skyMat.color.set(m.sky); room.skyMat.needsUpdate = true;
  scene.background.set(m.bg);
  room.glassMat.opacity = m.key === 'evening' ? 0.1 : 0.1; room.glassMat.color.set(m.key === 'evening' ? '#7f8cab' : '#d8ecff');
  for (const cm of room.corridorMats) cm.color.copy(cm.userData.base).multiplyScalar(cm.userData.isLamp ? (m.key === 'evening' ? 0.9 : 1) : m.corridor);
  room.switchLed.material.color.set(m.switchLed);
  document.getElementById('modeIcon').textContent = m.icon;
  document.getElementById('modeText').textContent = m.label;
}
setMode(0);

// ── 이동 (시작: 앞문 안쪽에서 교실을 바라봄) ──
const colliders = [...room.colliders];
const START = { x: 6.05, z: 0.6, yaw: Math.PI / 2 + 0.55, pitch: -0.12 };
const controls = new FPControls(camera, canvas, colliders, { eye: 1.6, ...START });

// ── 상호작용: 조명 스위치 · 문(E/클릭) · 의자(E 앉기) ──
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const occupied = new Set();                       // VRM 학생이 앉아 있는 책상 번호
const targets = [...room.switches.map(w => w.hit), ...room.doors.flatMap(d => [d.hit, d.leafHit]), ...room.chairHits];
function pick(nx, ny) {
  camera.updateMatrixWorld(); ndc.set(nx, ny); ray.setFromCamera(ndc, camera); ray.far = 3.2;
  for (const h of ray.intersectObjects(targets, false)) {
    const o = h.object;
    if (o.userData.switch) return h.distance <= 2.5 ? { type: 'switch', key: o.userData.switch } : null;
    if (o.userData.door !== undefined) return h.distance <= 2.5 ? { type: 'door', i: o.userData.door } : null;  // 문틀 또는 열린 문짝
    if (o.userData.chair) return h.distance <= 2.0 && !controls.seated ? { type: 'chair', chair: o.userData.chair, busy: occupied.has(o.userData.chair.n) } : null;
  }
  return null;
}
const pickAtClient = (x, y) => pick((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
function toggle() { setMode(modeIdx + 1); }
// ── 교탁 가운데 / 일반 수업 모드 (스위치 2·3, T·G 키, 🧑‍🏫·📖 버튼) ──
const teachSt = { t: 0, target: 0 }, genSt = { t: 0, target: 0 };
// 일반 수업: 폴 기준 -92°(왼쪽·남쪽으로) + 팔꿈치 +132° + VESA 스위블 +40° → 모니터가 책상 왼쪽 가장자리를 따라 서고 화면은 안쪽(책상 가운데·학생 쪽)을 향함.
//   스위블은 팔이 35% 돈 뒤부터 함께 돌아감 (중간에도 창벽·기둥·앞 가림판에 닿지 않음 — tools/measure_monitors.mjs로 확인)
const ARM_A = -92 * Math.PI / 180, ARM_B = 132 * Math.PI / 180, ARM_S = 40 * Math.PI / 180, SWIVEL_FROM = 0.35;
const smooth = x => x * x * (3 - 2 * x);
let teacherActor = null, teacherCol = null, teacherBaseX = 0;
function applyGeneral() {
  const e = smooth(genSt.t);
  const es = Math.max(0, (e - SWIVEL_FROM) / (1 - SWIVEL_FROM));
  for (const m of room.monArms) { m.a.rotation.y = ARM_A * e; m.b.rotation.y = ARM_B * e; m.c.rotation.y = ARM_S * es; }
  room.labOnly.visible = genSt.t < 0.5; room.genOnly.visible = genSt.t >= 0.5;
  for (const mt of room.studentScrMats) mt.color.setScalar(1 - 0.8 * e);   // 일반 수업: 학생 화면은 어둡게(절전)
  room.switches[2].led.material.color.set(genSt.target ? '#5cff6a' : '#444');
}
function applyTeach() {
  const e = smooth(teachSt.t), dx = room.teach.dx * e, T = room.teach;
  T.group.position.x = dx; T.col.x1 = T.base.x1 + dx; T.col.x2 = T.base.x2 + dx;
  if (teacherActor) { teacherActor.group.position.x = teacherBaseX + dx; teacherCol.x1 = teacherBaseX + dx - 0.25; teacherCol.x2 = teacherBaseX + dx + 0.25; }
  room.switches[1].led.material.color.set(teachSt.target ? '#5cff6a' : '#444');
}
function toggleTeach() {
  const T = room.teach, p = controls.pos, r = controls.radius;
  // 교탁·선생님이 지나가는 앞쪽 띠(원래 자리 ~ 가운데)에 서 있으면 비켜 달라고 함
  if (p.x > T.base.x1 - r && p.x < T.base.x2 + T.dx + r && p.z > 0.15 - r && p.z < T.base.z2 + r && !controls.seated) { flash('교탁이 지나갈 자리에서 비켜 주세요'); return; }
  teachSt.target = 1 - teachSt.target; applyTeach();
}
function toggleGeneral() { genSt.target = 1 - genSt.target; applyGeneral(); }
function setTeach(v, instant) { teachSt.target = v ? 1 : 0; if (instant) teachSt.t = teachSt.target; applyTeach(); }
function setGeneral(v, instant) { genSt.target = v ? 1 : 0; if (instant) genSt.t = genSt.target; applyGeneral(); }
let flashText = '', flashUntil = 0;
const flash = msg => { flashText = msg; flashUntil = performance.now() + 1400; };
function toggleDoor(i) {
  const d = room.doors[i], p = controls.pos;
  if (d.target === 1) {
    if (p.x > ROOM.W - 0.3 && p.x < ROOM.W + 0.45 && p.z > d.z1 - 0.15 && p.z < d.z2 + 0.15) { flash('문 앞에서 비켜 주세요'); return; }
    d.target = 0;
  } else {
    const b = d.openBox, r = controls.radius;   // 문짝이 열려 붙을 자리에 서 있으면 열지 않음
    if (p.x > b.x1 - r && p.x < b.x2 + r && p.z > b.z1 - r && p.z < b.z2 + r) { flash('문 앞에서 비켜 주세요'); return; }
    d.target = 1;
  }
}
function sitIn(chair) {
  if (occupied.has(chair.n)) { flash('자리 있음'); return false; }
  controls.sit(chair); return true;
}
function standUp() { controls.stand(); }
// tg: pick() 결과. allowChair: E·탭·🪑일 때만 의자에 앉음 (마우스 클릭은 스위치·문만)
function act(tg, allowChair) {
  if (!tg) return false;
  if (tg.type === 'switch') { if (tg.key === 'teach') toggleTeach(); else if (tg.key === 'general') toggleGeneral(); else toggle(); return true; }
  if (tg.type === 'door') { toggleDoor(tg.i); return true; }
  if (tg.type === 'chair' && allowChair) { sitIn(tg.chair); return true; }
  return false;
}
const hintEl = document.getElementById('hint'), crossEl = document.getElementById('crosshair');
canvas.addEventListener('mousedown', e => {
  if (isTouch) return;
  if (controls.locked) { act(pick(0, 0), false); return; }
  const r = canvas.getBoundingClientRect();
  if (!act(pick(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), false)) controls.lock();
});
controls.onTap = (x, y) => { act(pickAtClient(x, y), true) || act(pick(0, 0), true); };
controls.onSeatedMove = standUp;
document.addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.code === 'KeyL') toggle();
  else if (e.code === 'KeyT') toggleTeach();
  else if (e.code === 'KeyG') toggleGeneral();
  else if (e.code === 'KeyE') { if (controls.seated) standUp(); else act(pick(0, 0), true); }
  else if (e.code === 'KeyC') { if (controls.seated) standUp(); else controls.toggleCrouch(); }
  else if (e.code === 'Escape' && controls.seated) standUp();
});
document.getElementById('lightBtn').addEventListener('click', e => { e.stopPropagation(); toggle(); });
document.getElementById('teachBtn').addEventListener('click', e => { e.stopPropagation(); toggleTeach(); });
document.getElementById('genBtn').addEventListener('click', e => { e.stopPropagation(); toggleGeneral(); });
// 🪑 버튼 (모바일): 조준한 의자에 앉기 / 일어나기. 조준한 의자가 없으면 1.3 m 안의 가장 가까운 빈 의자
document.getElementById('seatBtn').addEventListener('click', e => {
  e.stopPropagation();
  if (controls.seated) { standUp(); return; }
  const tg = pick(0, 0);
  if (tg?.type === 'chair') { sitIn(tg.chair); return; }
  let best = null, bd = 1.3;
  for (const c of room.chairs) { const dd = Math.hypot(c.x - controls.pos.x, c.z - controls.pos.z); if (dd < bd && !occupied.has(c.n)) { bd = dd; best = c; } }
  if (best) sitIn(best); else flash('앉을 의자를 조준하세요');
});

const helpEl = document.getElementById('help');
const HELP_DESK = '클릭: 시점 고정 · <kbd>WASD</kbd> 이동 · <kbd>Shift</kbd> 빠르게 · <kbd>C</kbd> 웅크리기/서기 · 의자 조준 <kbd>E</kbd> 앉기 · 문 조준 <kbd>E</kbd>/클릭 열기·닫기 · 스위치 클릭 또는 <kbd>L</kbd> 조명 · <kbd>T</kbd> 교탁 가운데 · <kbd>G</kbd> 일반 수업 · <kbd>Esc</kbd> 해제';
const HELP_TOUCH = '왼쪽 엄지: 이동 · 오른쪽 드래그: 둘러보기 · 문·스위치 탭 · 🪑 앉기/일어나기 · 💡 조명 · 🧑‍🏫 교탁 가운데 · 📖 일반 수업';
helpEl.innerHTML = isTouch ? HELP_TOUCH : HELP_DESK;
controls.onLockChange = locked => { helpEl.style.opacity = locked ? 0.55 : 1; if (!locked && controls.seated) standUp(); }; // Esc(시점 해제) → 일어나기

// ── 캐릭터 (CC0 VRM) ──
const loadingEl = document.getElementById('loading'), loadMsg = document.getElementById('loadMsg'), loadBar = document.getElementById('loadBar');
const app = window.__app = { ready: false, room, scene, THREE, setMode: i => setMode(i), get mode() { return MODES[modeIdx].key; }, controls, camera, actors: [], errors: [],
  pick: () => pick(0, 0), toggleDoor, setTeach, setGeneral, toggleTeach, toggleGeneral, teachSt, genSt, sitDesk: n => sitIn(room.chairs.find(c => c.n === n)), stand: standUp, occupied, doors: room.doors };
let actors = [];
loadCast(scene, room.chairs, 'assets/vrm/', (n, total, file) => {
  loadMsg.textContent = `캐릭터 불러오는 중 ${n}/${total} (${file})`;
  loadBar.style.width = (n / total * 100) + '%';
}, camera).then(a => {
  actors = app.actors = a;
  for (const x of a) if (!x.teacher && x.cfg.desk) occupied.add(x.cfg.desk);
  const acs = actorColliders(a); colliders.push(...acs);
  teacherActor = a.find(x => x.teacher) || null;
  if (teacherActor) { teacherCol = acs[0]; teacherBaseX = teacherActor.group.position.x; applyTeach(); }
  loadingEl.classList.add('hidden');
  const st = document.getElementById('start');
  document.getElementById('startHelp').innerHTML = isTouch
    ? '· 왼쪽 엄지로 이동, 오른쪽을 드래그해 둘러보기<br>· 앞문 옆 <b>조명 스위치</b>를 탭하거나 💡 버튼: 아침 → 점심 → 저녁<br>· 그 아래 스위치 또는 🧑‍🏫: 교탁을 앞 가운데로 · 📖: 일반 수업 모드(모니터 젖히고 책)<br>· <b>문</b>을 탭하면 열고 닫기 → 복도로 나갈 수 있어요<br>· 빈 의자를 조준하고 🪑 (또는 의자 탭): 앉기 · 🪑/조이스틱: 일어나기'
    : '· 클릭하면 마우스 시점 고정 (Esc로 해제)<br>· <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / 방향키 이동, <kbd>Shift</kbd> 빠르게, <kbd>C</kbd> 웅크리기/서기<br>· 앞문 옆 <b>조명 스위치</b>를 조준해 클릭 또는 <kbd>L</kbd>: 아침 → 점심 → 저녁<br>· 그 아래 스위치: <b>교탁 가운데</b>(<kbd>T</kbd>) · <b>일반 수업</b>(<kbd>G</kbd>, 모니터를 왼쪽으로 젖히고 키보드는 서랍에, 책을 펼침)<br>· <b>문</b>을 조준하고 <kbd>E</kbd> 또는 클릭: 열기/닫기 → 복도로 나갈 수 있어요<br>· 빈 <b>의자</b>를 조준하고 <kbd>E</kbd>: 앉기 · <kbd>E</kbd>/<kbd>C</kbd>/<kbd>Esc</kbd>: 일어나기';
  if (!new URLSearchParams(location.search).has('nostart')) {
    st.classList.remove('hidden');
    document.getElementById('startBtn').addEventListener('click', e => { e.stopPropagation(); st.classList.add('hidden'); if (!isTouch) controls.lock(); });
  }
  app.ready = true;
}).catch(e => { console.error(e); loadMsg.textContent = '캐릭터 로딩 실패: ' + e.message; });

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

let t = 0, last = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now(); const dt = Math.min((now - last) / 1000, 0.05); last = now; t += dt;
  controls.update(dt);
  updateActors(actors, t, dt);
  // 문 애니메이션 (여닫이, 교실 안쪽으로) + 열린 문 통로
  for (const d of room.doors) {
    if (d.t !== d.target) { d.t = Math.max(0, Math.min(1, d.t + Math.sign(d.target - d.t) * dt * 1.2)); const e = d.t * d.t * (3 - 2 * d.t); d.leaf.rotation.y = d.openAngle * e; }
  }
  if (teachSt.t !== teachSt.target) { teachSt.t = Math.max(0, Math.min(1, teachSt.t + Math.sign(teachSt.target - teachSt.t) * dt * 0.5)); applyTeach(); }
  if (genSt.t !== genSt.target) { genSt.t = Math.max(0, Math.min(1, genSt.t + Math.sign(genSt.target - genSt.t) * dt * 0.8)); applyGeneral(); }
  controls.passages = room.doors.filter(d => d.t > 0.8);
  controls.dynColliders = room.doors.filter(d => d.t > 0.3).map(d => d.openBox);   // 열린 문짝 (끝 벽에 붙음)
  // 조준 표시
  const tg = pick(0, 0);
  let msg = '';
  if (performance.now() < flashUntil) msg = flashText;
  else if (tg?.type === 'switch') {
    const how = isTouch ? '탭' : 'E/클릭';
    msg = tg.key === 'teach' ? how + ': ' + (teachSt.target ? '교탁 원래 자리로' : '교탁 가운데로')
      : tg.key === 'general' ? how + ': ' + (genSt.target ? '실습실 모드로' : '일반 수업 모드로')
      : how + ': 조명 모드 바꾸기 (지금 ' + MODES[modeIdx].label + ')';
  }
  else if (tg?.type === 'door') msg = (isTouch ? '탭 ' : 'E ') + (room.doors[tg.i].target ? '닫기' : '열기');
  else if (tg?.type === 'chair') msg = tg.busy ? '자리 있음' : (isTouch ? '🪑 앉기' : 'E 앉기');
  else if (controls.seated) msg = isTouch ? '🪑 또는 조이스틱: 일어나기' : 'E · C · Esc: 일어나기';
  crossEl.classList.toggle('on', !!tg && !(tg.type === 'chair' && tg.busy));
  hintEl.style.display = msg ? 'block' : 'none';
  if (msg) hintEl.textContent = msg;
  renderer.render(scene, camera);
});
