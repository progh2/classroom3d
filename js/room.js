import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  ROOM, DESKS, RESERVE19, DESK_H, CHAIR, TEACHER_DESK, BOARD, TV, COLUMN, DOORS, DOOR_H,
  DOOR_ZONES, WINDOWS, SILL, WIN_TOP, SWITCH_POS, EAST_GLASS, CORRIDOR, GLASSBOARDS, EAST_COLUMN, RAISE, PITS, LOCKER_SEGS, LOCKER_TOP,
} from './plan.js';
import * as TX from './textures.js';

const { W, D, H } = ROOM;
const WAIN = 1.0; // 목재 판넬(징두리) 높이

// 같은 재질의 박스를 모아서 하나의 메시로 합침 (모바일 draw call 절약)
class Batcher {
  // vcMat: 텍스처 없는 램버트 재질을 정점 색으로 바꿔 한 메시로 합침 (움직이는 묶음의 draw call 절약)
  constructor(vcMat = null) { this.buckets = new Map(); this.vcMat = vcMat; }
  // 임의 변환 행렬로 박스·원기둥 (책·연필·가방처럼 기울어진 소품)
  boxM(mat, sx, sy, sz, m4) { const g = new THREE.BoxGeometry(sx, sy, sz); g.applyMatrix4(m4); this.push(mat, g); }
  geoM(mat, g, m4) { g.applyMatrix4(m4); this.push(mat, g); }
  box(mat, sx, sy, sz, x, y, z, rotY = 0, rotX = 0) {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    if (rotX) g.rotateX(rotX);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    this.push(mat, g);
  }
  aabb(mat, x1, x2, y1, y2, z1, z2) { this.box(mat, x2 - x1, y2 - y1, z2 - z1, (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2); }
  cyl(mat, r, h, x, y, z, seg = 10, rx = 0, rz = 0) {
    const g = new THREE.CylinderGeometry(r, r, h, seg); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); g.translate(x, y, z); this.push(mat, g);
  }
  tube(mat, pts, r, seg = 4) {
    const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), false, 'centripetal');
    this.push(mat, new THREE.TubeGeometry(c, pts.length * 4, r, seg, false));
  }
  plane(mat, w, h, x, y, z, rotY = 0, rotX = 0) {
    const g = new THREE.PlaneGeometry(w, h); if (rotX) g.rotateX(rotX); if (rotY) g.rotateY(rotY); g.translate(x, y, z); this.push(mat, g);
  }
  push(mat, g) {
    if (g.index) g = g.toNonIndexed();
    if (this.vcMat && mat.isMeshLambertMaterial && !mat.map && !mat.transparent && !mat.vertexColors) {
      const n = g.attributes.position.count, c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { c[i * 3] = mat.color.r; c[i * 3 + 1] = mat.color.g; c[i * 3 + 2] = mat.color.b; }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3)); mat = this.vcMat;
    }
    if (!this.buckets.has(mat)) this.buckets.set(mat, []);
    this.buckets.get(mat).push(g);
  }
  build(parent, ox = 0, oz = 0) {   // ox, oz: 부모 그룹의 월드 위치 (그만큼 빼서 로컬 좌표로)
    for (const [mat, geos] of this.buckets) {
      const geo = mergeGeometries(geos, false); if (ox || oz) geo.translate(-ox, 0, -oz);
      const m = new THREE.Mesh(geo, mat);
      m.matrixAutoUpdate = false; m.updateMatrix();
      if (mat.transparent) m.renderOrder = 2;
      parent.add(m);
      geos.forEach(g => g.dispose());
    }
  }
}

export function buildRoom(scene, screenTex) {
  const root = new THREE.Group(); root.name = 'room'; scene.add(root);
  const bt = new Batcher();
  const colliders = [];
  const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });

  const M = {
    white: lam('#f3f1ec'), whiteN: lam('#f0eee8'),
    wood: lam('#ffffff', { map: TX.woodPanelTexture(1, 1) }),
    rail: lam('#a07a4e'), base: lam('#7a5c3c'),
    winFrame: lam('#f6f6f3'), curtain: lam('#ffffff', { map: TX.curtainTexture() }), curtainRail: lam('#c9c9c9'),
    deskTop: lam('#f5f5f3'), edge: lam('#c9ccd0'), teacherTop: lam('#f5f5f3'),
    steel: lam('#b4b8bd'), steelDark: lam('#7d8288'),
    black: lam('#141518'), dark: lam('#2a2c31'),
    seat: lam('#ffffff', { map: TX.perforatedTexture() }),
    wire: new THREE.MeshLambertMaterial({ map: TX.wireMeshTexture(), alphaTest: 0.4, side: THREE.DoubleSide }),
    door: lam('#c9b08a'), doorFrame: lam('#8d7457'), column: lam('#f1efe9'), key: lam('#d8d8d8'),
    metal: lam('#a3a8ae'), pcFace: new THREE.MeshPhongMaterial({ map: TX.miniPcFaceTexture(), shininess: 90, specular: '#666666' }), cable: lam('#1c1d20'), tie: lam('#33363b'), alu: lam('#c3c7cc'), dellBack: lam('#ffffff', { map: TX.dellLogoTexture() }), silver: lam('#d3d5d8'), glassBoard: lam('#fbfcfd', { emissive: '#1a1c1e' }), gbEdge: lam('#d5dadf'),
  };

  // ── 바닥: 액세스플로어(슬래브 +200, 600 격자) — 출입문 확보구역은 바닥판 없음(슬래브 레벨 y=-0.2) ──
  // 바닥 외곽선: 동쪽 벽 모서리의 단차 구역(앞·뒷문)을 잘라낸 다각형 (벽에 붙은 구멍은 삼각분할이 깨지므로 외곽선으로 처리)
  const fp = [[0, 0]];
  const front = PITS.find(p => p.z1 <= 0 && p.x2 >= W), rear = PITS.find(p => p.z2 >= D && p.x2 >= W);
  if (front) fp.push([front.x1, 0], [front.x1, front.z2], [W, front.z2]); else fp.push([W, 0]);
  if (rear) fp.push([W, rear.z1], [rear.x1, rear.z1], [rear.x1, D]); else fp.push([W, D]);
  fp.push([0, D]);
  const fshape = new THREE.Shape(fp.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const z of PITS) if (z !== front && z !== rear) fshape.holes.push(new THREE.Path([new THREE.Vector2(z.x1, -z.z1), new THREE.Vector2(z.x1, -z.z2), new THREE.Vector2(z.x2, -z.z2), new THREE.Vector2(z.x2, -z.z1)]));
  const ftex = TX.floorTexture(); ftex.repeat.set(1 / 0.6, 1 / 0.6);
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(fshape), new THREE.MeshLambertMaterial({ map: ftex }));
  floor.rotation.x = -Math.PI / 2; root.add(floor);
  M.slab = lam('#c9c6be'); M.nosing = lam('#b9bdc2'); M.tread = lam('#e2b23a');
  for (const z of PITS) {
    // 슬래브 바닥 (비닐 마감)
    const p = new THREE.Mesh(new THREE.PlaneGeometry(z.x2 - z.x1, z.z2 - z.z1), lam('#ffffff', { map: TX.slabTexture() }));
    p.rotation.x = -Math.PI / 2; p.position.set((z.x1 + z.x2) / 2, -RAISE, (z.z1 + z.z2) / 2); root.add(p);
    // 단차 옆면 (액세스플로어 측면 마감) + 알루미늄 노싱 + 노란 논슬립 띠
    const edges = [];  // [x1,x2,z1,z2] 바닥 쪽 경계선
    if (z.x1 > 0) edges.push(['x', z.x1, z.z1, z.z2, -1]);
    if (z.z1 > 0) edges.push(['z', z.z1, z.x1, z.x2, -1]);
    if (z.z2 < D) edges.push(['z', z.z2, z.x1, z.x2, 1]);
    // 슬래브까지 내려가는 벽 마감 (북/남 벽, 동쪽 벽의 문 옆 부분)
    if (z.z1 <= 0) { bt.aabb(M.white, z.x1, z.x2, -RAISE, 0, -0.02, 0); bt.aabb(M.base, z.x1, z.x2, -RAISE, -RAISE + 0.08, 0, 0.012); }
    if (z.z2 >= D) { bt.aabb(M.white, z.x1, z.x2, -RAISE, 0, D, D + 0.02); bt.aabb(M.base, z.x1, z.x2, -RAISE, -RAISE + 0.08, D - 0.012, D); }
    if (z.x2 >= W) for (const d of DOORS) {
      if (d.z1 > z.z1 && d.z1 < z.z2) bt.aabb(M.white, W, W + 0.02, -RAISE, 0, z.z1, d.z1 - 0.05);
      if (d.z2 > z.z1 && d.z2 < z.z2) bt.aabb(M.white, W, W + 0.02, -RAISE, 0, d.z2 + 0.05, z.z2);
    }
    for (const [ax, v, a, b, sgn] of edges) {
      const t = 0.012, nw = 0.04;   // 옆면 두께, 노싱 폭
      if (ax === 'x') {
        bt.aabb(M.slab, v - t, v, -RAISE, -0.01, a, b);
        bt.aabb(M.nosing, v - nw, v + 0.006, -0.012, 0.004, a, b);
        bt.aabb(M.tread, v - nw + 0.006, v - 0.004, 0.004, 0.006, a, b);
      } else {
        const o = sgn > 0 ? [v, v + t] : [v - t, v];
        bt.aabb(M.slab, a, b, -RAISE, -0.01, o[0], o[1]);
        const n = sgn > 0 ? [v - 0.006, v + nw] : [v - nw, v + 0.006];
        bt.aabb(M.nosing, a, b, -0.012, 0.004, n[0], n[1]);
        const tr = sgn > 0 ? [v + 0.004, v + nw - 0.006] : [v - nw + 0.006, v - 0.004];
        bt.aabb(M.tread, a, b, 0.004, 0.006, tr[0], tr[1]);
      }
    }
  }
  const r19 = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.6), new THREE.MeshBasicMaterial({ map: TX.dashedTexture(), transparent: true, depthWrite: false }));
  r19.rotation.x = -Math.PI / 2; r19.position.set((RESERVE19.x1 + RESERVE19.x2) / 2, 0.004, (RESERVE19.z1 + RESERVE19.z2) / 2); root.add(r19);
  bt.aabb(M.metal, RESERVE19.x1 + 0.155, RESERVE19.x1 + 0.285, 0, 0.006, RESERVE19.z1 + 0.135, RESERVE19.z1 + 0.265);

  // ── 천장: 노출 천장(가운데 우물 천장) + 매입 다운라이트가 있는 흰 둘레 천장 (참고 사진 83fc…) ──
  //   우물(트레이) 안: 어두운 노출 슬래브·보·덕트, 평행한 긴 LED 바 조명(줄 매달기), 천장형 카세트 에어컨 1대
  const lightCeil = new URLSearchParams(location.search).get('ceiling') !== 'dark'; // 기본: 사진처럼 밝은 크림색 노출 천장, ?ceiling=dark → 어두운 노출 천장
  const TR = { x1: 0.8, x2: 5.8, z1: 1.0, z2: 7.6 }, TD = 0.38, SY = H + TD;           // 트레이 범위·깊이, 노출 슬래브 높이
  M.ceil = lam('#f2f1ed');
  const soffitMat = lam('#ffffff', { map: TX.soffitTexture(lightCeil) });
  M.exposed = lam(lightCeil ? '#ddd6c8' : '#55575b');      // 노출 덕트 (천장과 같은 계열 도장)
  M.beam = lam(lightCeil ? '#e4dccd' : '#47484b');
  M.barBody = lam('#ececea'); M.acBody = lam('#f4f4f2'); M.pipe = lam('#f0efea'); M.wireH = lam('#9a9ea3');
  const ceilPart = (x1, x2, z1, z2, y, mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), mat); m.rotation.x = Math.PI / 2; m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2); root.add(m); };
  ceilPart(0, W, 0, TR.z1, H, M.ceil); ceilPart(0, W, TR.z2, D, H, M.ceil);
  ceilPart(0, TR.x1, TR.z1, TR.z2, H, M.ceil); ceilPart(TR.x2, W, TR.z1, TR.z2, H, M.ceil);
  ceilPart(TR.x1, TR.x2, TR.z1, TR.z2, SY, soffitMat);
  // 트레이 옆면(흰 판) + 상단 간접조명(코브) 띠
  const coveMat = new THREE.MeshBasicMaterial({ color: '#8a8478' });
  const coveGeos = [], cw = 0.07;
  bt.aabb(M.ceil, TR.x1, TR.x2, H - 0.002, SY, TR.z1 - 0.02, TR.z1); bt.aabb(M.ceil, TR.x1, TR.x2, H - 0.002, SY, TR.z2, TR.z2 + 0.02);
  bt.aabb(M.ceil, TR.x1 - 0.02, TR.x1, H - 0.002, SY, TR.z1, TR.z2); bt.aabb(M.ceil, TR.x2, TR.x2 + 0.02, H - 0.002, SY, TR.z1, TR.z2);
  { const add = (w, x, z, ry) => { const g = new THREE.PlaneGeometry(w, cw); g.rotateY(ry); g.translate(x, SY - cw / 2 - 0.01, z); coveGeos.push(g); };
    add(TR.x2 - TR.x1, (TR.x1 + TR.x2) / 2, TR.z1 + 0.001, 0); add(TR.x2 - TR.x1, (TR.x1 + TR.x2) / 2, TR.z2 - 0.001, Math.PI);
    add(TR.z2 - TR.z1, TR.x1 + 0.001, (TR.z1 + TR.z2) / 2, Math.PI / 2); add(TR.z2 - TR.z1, TR.x2 - 0.001, (TR.z1 + TR.z2) / 2, -Math.PI / 2); }
  root.add(new THREE.Mesh(mergeGeometries(coveGeos), coveMat));
  // 노출 구조·설비: 기둥 열 위 보, 원형 덕트 2줄, 에어컨 냉매 배관
  bt.aabb(M.beam, TR.x1, TR.x2, SY - 0.12, SY, COLUMN.z1, COLUMN.z2);
  for (const dx of [1.2, 5.4]) {
    bt.cyl(M.exposed, 0.08, TR.z2 - TR.z1 - 0.1, dx, H + 0.15, (TR.z1 + TR.z2) / 2, 14, Math.PI / 2);
    for (let z = TR.z1 + 0.6; z < TR.z2; z += 1.4) { bt.cyl(M.exposed, 0.088, 0.03, dx, H + 0.15, z, 14, Math.PI / 2); bt.cyl(M.wireH, 0.004, SY - H - 0.23, dx, (H + 0.23 + SY) / 2, z, 4); }
  }
  // LED 바 조명: 동서 방향(앞벽과 평행)으로 길게 이어진 바 6줄, 와이어로 매달림
  const panelMat = new THREE.MeshBasicMaterial({ color: '#d9d8d2' });
  const panelGeos = [];
  const BAR_ZS = [1.55, 2.5, 3.45, 4.95, 5.9, 6.85], BX1 = TR.x1 + 0.15, BX2 = TR.x2 - 0.15, BY = H - 0.03;
  for (const z of BAR_ZS) {
    bt.aabb(M.barBody, BX1, BX2, BY, BY + 0.05, z - 0.03, z + 0.03);
    const g = new THREE.BoxGeometry(BX2 - BX1 - 0.02, 0.008, 0.046); g.translate((BX1 + BX2) / 2, BY - 0.002, z); panelGeos.push(g);
    for (const wx of [BX1 + 0.3, (BX1 + BX2) / 2, BX2 - 0.3]) bt.cyl(M.wireH, 0.0025, SY - BY - 0.05, wx, (BY + 0.05 + SY) / 2, z, 4);
  }
  const panels = new THREE.Mesh(mergeGeometries(panelGeos), panelMat); root.add(panels);
  const lightXs = [BX1 + (BX2 - BX1) * 0.25, BX1 + (BX2 - BX1) * 0.75], lightZs = BAR_ZS;
  // 천장형 카세트 에어컨 1대: 우물 가운데, 기둥 열 보 아래, LED 바 사이 넓은 줄(Z 3.75~4.65)
  const acFace = new THREE.MeshLambertMaterial({ map: TX.acCassetteTexture() });
  { // 에어컨 1대: 노출 천장 우물 가운데, 기둥 열 보 바로 아래
    const ax = (TR.x1 + TR.x2) / 2, az = (COLUMN.z1 + COLUMN.z2) / 2;
    bt.aabb(M.acBody, ax - 0.42, ax + 0.42, H - 0.03, H + 0.24, az - 0.42, az + 0.42);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), acFace); f.rotation.x = Math.PI / 2; f.position.set(ax, H - 0.031, az); root.add(f);
    bt.aabb(M.acBody, ax - 0.45, ax + 0.45, H - 0.03, H - 0.0, az - 0.45, az + 0.45);
    for (const [sx, sz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) bt.cyl(M.wireH, 0.005, SY - 0.12 - H - 0.24, ax + sx, (H + 0.24 + SY - 0.12) / 2, az + sz, 4);
    // 냉매·배수 배관: 보 아래를 따라 동쪽(복도)으로
    for (const [dz, r] of [[-0.06, 0.02], [0.0, 0.015], [0.06, 0.012]]) bt.cyl(M.pipe, r, TR.x2 - ax, (ax + TR.x2) / 2, SY - 0.12 - 0.022, az + dz, 8, 0, Math.PI / 2);
  }
  // 둘레 흰 천장: 작은 원형 매입 다운라이트
  const dlMat = new THREE.MeshBasicMaterial({ color: '#d8d8d4' });
  const dlGeos = [];
  const dl = (x, z) => { const g = new THREE.CircleGeometry(0.055, 16); g.rotateX(Math.PI / 2); g.translate(x, H - 0.003, z); dlGeos.push(g); bt.cyl(M.alu, 0.068, 0.004, x, H - 0.002, z, 16); };
  for (let x = 0.6; x < W; x += 1.35) { dl(x, 0.5); dl(x, 8.0); }
  for (let z = 1.9; z < 7.4; z += 1.35) { dl(0.42, z); dl(6.18, z); }
  root.add(new THREE.Mesh(mergeGeometries(dlGeos), dlMat));

  const T = 0.2;
  // ── 북벽(앞벽): 목재 판넬 2.3m까지 + 위 흰 벽 ──
  const FRONT_WOOD = 2.3;
  bt.aabb(M.whiteN, -T, W + T, FRONT_WOOD, H, -T, 0);
  bt.aabb(M.white, -T, W + T, 0, FRONT_WOOD, -T, -0.02);
  const fw = new THREE.Mesh(new THREE.PlaneGeometry(W, FRONT_WOOD), lam('#ffffff', { map: TX.woodPanelTexture(11, 2) }));
  fw.position.set(W / 2, FRONT_WOOD / 2, -0.001); root.add(fw);
  bt.aabb(M.rail, 0, W, FRONT_WOOD - 0.01, FRONT_WOOD + 0.04, 0, 0.02);
  bt.aabb(M.base, 0, W, 0, 0.08, 0, 0.012);
  // 유리칠판 (전자칠판·TV 양옆)
  for (const gb of GLASSBOARDS) {
    bt.aabb(M.glassBoard, gb.x1, gb.x2, 0.85, 2.12, 0.005, 0.02);
    bt.aabb(M.gbEdge, gb.x1 + 0.03, gb.x2 - 0.03, 0.84, 0.86, 0.02, 0.07); // 펜 트레이
  }
  // 태극기 액자 + 벽시계 (앞벽 위)
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.28), new THREE.MeshLambertMaterial({ map: TX.flagTexture() }));
  flag.position.set(3.3, 2.5, 0.012); root.add(flag);
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.15, 32), new THREE.MeshLambertMaterial({ map: TX.clockTexture() }));
  clock.position.set(5.9, 2.48, 0.03); root.add(clock);
  bt.cyl(M.dark, 0.158, 0.03, 5.9, 2.48, 0.015, 32, Math.PI / 2);

  // ── 남벽: 목재 징두리 + 흰 벽 + 게시판 ──
  bt.aabb(M.white, -T, W + T, 0, H, D, D + T);
  const sw_ = new THREE.Mesh(new THREE.PlaneGeometry(W, WAIN), lam('#ffffff', { map: TX.woodPanelTexture(11, 1) }));
  sw_.rotation.y = Math.PI; sw_.position.set(W / 2, WAIN / 2, D - 0.001); root.add(sw_);
  bt.aabb(M.rail, 0, W, WAIN - 0.01, WAIN + 0.04, D - 0.02, D);
  bt.aabb(M.base, 0, W, 0, 0.08, D - 0.012, D);
  const cork = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshLambertMaterial({ map: TX.corkTexture() }));
  cork.position.set(3.0, 1.68, D - 0.03); cork.rotation.y = Math.PI; root.add(cork);
  bt.aabb(M.doorFrame, 0.88, 5.12, 1.13, 2.23, D - 0.028, D);

  // ── 서쪽 창 벽: 목재 징두리(창대 아래) + 흰 창틀 + 회색 커튼 ──
  bt.aabb(M.white, -T, 0, 0, SILL, 0, D);
  bt.aabb(M.white, -T, 0, WIN_TOP, H, 0, D);
  const ww = new THREE.Mesh(new THREE.PlaneGeometry(D, SILL), lam('#ffffff', { map: TX.woodPanelTexture(14, 1.5) }));
  ww.rotation.y = Math.PI / 2; ww.position.set(0.001, SILL / 2, D / 2); root.add(ww);
  bt.aabb(M.base, 0, 0.012, 0, 0.08, 0, COLUMN.z1); bt.aabb(M.base, 0, 0.012, 0, 0.08, COLUMN.z2, D);
  let wz = 0;
  for (const w of WINDOWS) { bt.aabb(M.white, -T, 0, SILL, WIN_TOP, wz, w.z1); wz = w.z2; }
  bt.aabb(M.white, -T, 0, SILL, WIN_TOP, wz, D);
  const glassMat = new THREE.MeshBasicMaterial({ color: '#d8ecff', transparent: true, opacity: 0.1, depthWrite: false });
  for (const w of WINDOWS) {
    bt.aabb(M.rail, -0.02, 0.07, SILL - 0.03, SILL, w.z1, w.z2); // 창대(목재)
    bt.aabb(M.winFrame, -0.1, -0.03, WIN_TOP - 0.06, WIN_TOP, w.z1, w.z2);
    bt.aabb(M.winFrame, -0.1, -0.03, SILL, SILL + 0.06, w.z1, w.z2);
    const pw = (w.z2 - w.z1) / w.panes;
    for (let i = 0; i <= w.panes; i++) bt.aabb(M.winFrame, -0.1, -0.03, SILL, WIN_TOP, w.z1 + i * pw - 0.035, w.z1 + i * pw + 0.035);
    // 창대를 0.6 m 올려 창 높이가 0.9 m가 됨 → 가로 중간살(무목) 없이 미서기 2짝의 맞닿는 세로살만
    for (let i = 0; i < w.panes; i++) bt.aabb(M.winFrame, -0.08, -0.05, SILL, WIN_TOP, w.z1 + (i + 0.5) * pw - 0.02, w.z1 + (i + 0.5) * pw + 0.02);
    // 창 안전 난간: 가로 손잡이 봉 (은색) + 받침 — 창대 위 0.22 m
    const HR = SILL + 0.22;
    bt.aabb(M.alu, 0.035, 0.065, HR, HR + 0.03, w.z1 + 0.05, w.z2 - 0.05);
    for (let i = 0; i <= w.panes; i++) { const bz = Math.min(Math.max(w.z1 + i * pw, w.z1 + 0.08), w.z2 - 0.08); bt.aabb(M.alu, -0.03, 0.05, HR + 0.005, HR + 0.025, bz - 0.012, bz + 0.012); }
    const g = new THREE.Mesh(new THREE.PlaneGeometry(w.z2 - w.z1, WIN_TOP - SILL), glassMat);
    g.rotation.y = Math.PI / 2; g.position.set(-0.065, (SILL + WIN_TOP) / 2, (w.z1 + w.z2) / 2); g.renderOrder = 2; root.add(g);
    // 커튼: 창 구간 양 끝에 모아 둔 회색 커튼 + 레일
    bt.aabb(M.curtainRail, 0.05, 0.08, WIN_TOP + 0.05, WIN_TOP + 0.08, w.z1 - 0.15, w.z2 + 0.15);
    for (const [c1, c2] of [[w.z1 - 0.12, w.z1 + 0.28], [w.z2 - 0.28, w.z2 + 0.12]]) {
      const cb0 = SILL - 0.15;   // 커튼 아랫단: 창대보다 15 cm 아래
      bt.box(M.curtain, 0.12, WIN_TOP + 0.05 - cb0, c2 - c1, 0.12, (WIN_TOP + 0.05 + cb0) / 2, (c1 + c2) / 2);
    }
  }
  const skyMat = new THREE.MeshBasicMaterial({ map: TX.skyTexture(), color: '#bcd8f5' });
  const skyDay = skyMat.map, skyNight = TX.nightSkyTexture();
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), skyMat);
  sky.rotation.y = Math.PI / 2; sky.position.set(-2.5, 1.6, D / 2); root.add(sky);
  bt.aabb(M.column, COLUMN.x1, COLUMN.x2, 0, H, COLUMN.z1, COLUMN.z2);
  colliders.push({ x1: COLUMN.x1, x2: COLUMN.x2, z1: COLUMN.z1, z2: COLUMN.z2 });

  // ── 동쪽 복도 벽: 1.4 m까지 아이보리 평판 + 알루미늄 깊은 틀의 내부 창 + 흰 상부 벽, 알루미늄 유리문 ──
  const EX = W, ET = 0.14, GL = EAST_GLASS.low, GT = EAST_GLASS.top;
  const solidSegs = [[0, DOORS[0].z1], [DOORS[0].z2, DOORS[1].z1], [DOORS[1].z2, D]];
  for (const [z1, z2] of solidSegs) {
    bt.aabb(M.white, EX, EX + ET, 0, GL, z1, z2);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(z2 - z1, GL), lam('#ffffff', { map: TX.creamPanelTexture(Math.max(1, Math.round((z2 - z1) / 0.6))) }));
    p.rotation.y = -Math.PI / 2; p.position.set(EX - 0.001, GL / 2, (z1 + z2) / 2); root.add(p);
    bt.aabb(M.base, EX - 0.012, EX, 0, 0.08, z1, z2);
  }
  let pz = DOORS[0].z2;
  for (const [z1, z2] of EAST_GLASS.wins) { bt.aabb(M.white, EX, EX + ET, GL, H, pz, z1); pz = z2; }
  bt.aabb(M.white, EX, EX + ET, GL, H, pz, DOORS[1].z1);
  bt.aabb(M.white, EX, EX + ET, GL, H, 0, DOORS[0].z1); bt.aabb(M.white, EX, EX + ET, GL, H, DOORS[1].z2, D);
  for (const [z1, z2] of EAST_GLASS.wins) {
    bt.aabb(M.white, EX, EX + ET, GT, H, z1, z2);
    const f = 0.035, fx1 = EX - 0.015, fx2 = EX + ET + 0.005;       // 얇은 알루미늄 틀
    bt.aabb(M.alu, fx1, fx2, GL, GL + f, z1, z2); bt.aabb(M.alu, fx1, fx2, GT - f, GT, z1, z2);
    bt.aabb(M.alu, fx1, fx2, GL, GT, z1, z1 + f); bt.aabb(M.alu, fx1, fx2, GL, GT, z2 - f, z2);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(z2 - z1 - 2 * f, GT - GL - 2 * f), glassMat);
    gl.rotation.y = -Math.PI / 2; gl.position.set(EX + 0.08, (GL + GT) / 2, (z1 + z2) / 2); gl.renderOrder = 2; root.add(gl);
  }
  // 가운데 구조 기둥 (서쪽 기둥과 같은 Y3,900~4,500, 같은 마감) — 통유리를 고정 유리 2장으로 나눔
  { const c = EAST_COLUMN;
    bt.aabb(M.column, c.x1, EX + ET + 0.08, 0, H, c.z1, c.z2);
    bt.aabb(M.base, c.x1 - 0.012, c.x1, 0, 0.08, c.z1, c.z2);
    for (const [r1, r2] of [[c.z1 - 0.012, c.z1], [c.z2, c.z2 + 0.012]]) bt.aabb(M.steelDark, c.x1 + 0.02, EX - 0.0005, 0, H, r1, r2); // 기둥 양옆 줄눈(그림자선)
    colliders.push({ x1: c.x1, x2: W, z1: c.z1, z2: c.z2 }); }
  // 알루미늄 문틀 + 여닫이 유리문 — 문은 슬래브 레벨(y=-0.2)에 놓임, 높이 DOOR_H는 슬래브 기준
  const DB = -RAISE, DT = DOOR_H - RAISE;
  const doors = [];
  for (const d of DOORS) {
    bt.aabb(M.slab, EX, EX + ET + 0.01, DB - 0.01, DB, d.z1 - 0.05, d.z2 + 0.05);   // 문턱 (슬래브)
    bt.aabb(M.white, EX, EX + ET, DT + 0.05, H, d.z1, d.z2);
    bt.aabb(M.alu, EX - 0.03, EX + ET + 0.01, DB, DT + 0.05, d.z1 - 0.05, d.z1);
    bt.aabb(M.alu, EX - 0.03, EX + ET + 0.01, DB, DT + 0.05, d.z2, d.z2 + 0.05);
    bt.aabb(M.alu, EX - 0.03, EX + ET + 0.01, DT, DT + 0.05, d.z1, d.z2);
    // 여닫이 유리문: 교실 안쪽으로, 가까운 끝 벽 쪽으로 열림.
    //   앞문 = 앞벽(북) 쪽 경첩 → 열면 앞벽에 붙음 / 뒷문 = 뒷벽(남) 쪽 경첩 → 열면 뒷벽에 붙음. 애니메이션은 main.js
    const front = d.name === '앞문', s_ = 0.07, th = 0.04, dw = d.z2 - d.z1 - 0.01;
    const hingeZ = front ? d.z1 + 0.005 : d.z2 - 0.005, sz = front ? 1 : -1;  // 경첩 위치, 문짝이 뻗는 방향(z)
    const leaf = new THREE.Group(); leaf.name = 'door_' + d.name;
    leaf.position.set(EX + th / 2 + 0.003, 0, hingeZ);
    const lb = new Batcher();
    const L = (y1, y2, a1, a2, mat = M.alu, x1 = -th / 2, x2 = th / 2) => lb.aabb(mat, x1, x2, y1, y2, Math.min(sz * a1, sz * a2), Math.max(sz * a1, sz * a2));
    L(DB + 0.005, DB + 0.9, 0, dw);              // 아래 판
    L(DT - s_, DT - 0.005, 0, dw);               // 위 틀
    L(DB + 0.9, DT - s_, 0, s_);                 // 경첩 쪽 세로 틀
    L(DB + 0.9, DT - s_, dw - s_, dw);           // 손잡이 쪽 세로 틀
    L(DB + 0.9, DB + 0.95, 0, dw);
    for (const hy of [DB + 0.25, DT - 0.3]) lb.cyl(M.steelDark, 0.012, 0.1, 0, hy, 0, 8);   // 경첩
    const hz = dw - 0.08;                        // 레버 손잡이 (양면)
    L(DB + 0.98, DB + 1.0, hz - 0.12, hz, M.steelDark, -th / 2 - 0.05, -th / 2 - 0.03); L(DB + 0.97, DB + 1.01, hz - 0.01, hz + 0.01, M.steelDark, -th / 2 - 0.05, -th / 2);
    L(DB + 0.98, DB + 1.0, hz - 0.12, hz, M.steelDark, th / 2 + 0.03, th / 2 + 0.05); L(DB + 0.97, DB + 1.01, hz - 0.01, hz + 0.01, M.steelDark, th / 2, th / 2 + 0.05);
    lb.build(leaf);
    const dg = new THREE.Mesh(new THREE.PlaneGeometry(dw - 2 * s_, DT - s_ - DB - 0.95), glassMat);
    dg.rotation.y = -Math.PI / 2; dg.position.set(0, (DB + 0.95 + DT - s_) / 2, sz * dw / 2); dg.renderOrder = 2; leaf.add(dg);
    const invis = () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
    const lhit = new THREE.Mesh(new THREE.BoxGeometry(0.1, DT - DB, dw), invis());   // 열린 문짝을 조준해도 닫기
    lhit.position.set(0, (DB + DT) / 2, sz * dw / 2); lhit.userData.door = doors.length; leaf.add(lhit);
    root.add(leaf);
    const dhit = new THREE.Mesh(new THREE.BoxGeometry(ET + 0.12, DT - DB, d.z2 - d.z1), invis());
    dhit.position.set(EX + ET / 2 + 0.01, (DB + DT) / 2, (d.z1 + d.z2) / 2); dhit.userData.door = doors.length; root.add(dhit);
    // 열렸을 때 각도: 문짝 방향(0,0,sz)을 교실 안쪽(-x)으로 → 앞문 -90°, 뒷문 +90°
    doors.push({ name: d.name, z1: d.z1, z2: d.z2, leaf, hit: dhit, leafHit: lhit, openAngle: front ? -Math.PI / 2 : Math.PI / 2,
      openBox: { x1: EX - dw - 0.02, x2: EX, z1: hingeZ - 0.05, z2: hingeZ + 0.05 }, t: 0, target: 0 });
    const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1), new THREE.MeshBasicMaterial({ map: TX.labelTexture(d.name, { w: 128, h: 48, bg: '#3d4249', fg: '#fff', font: 'bold 30px sans-serif' }) }));
    lbl.position.set(EX - 0.035, DT + 0.2, (d.z1 + d.z2) / 2); lbl.rotation.y = -Math.PI / 2; root.add(lbl);
  }
  // 복도 쪽: 교실 벽 아래(복도 바닥 슬래브 레벨까지) + 교실 앞뒤로 이어지는 복도 벽 + 기둥 복도 쪽 돌출부
  { const segs = [[0, DOORS[0].z1 - 0.05], [DOORS[0].z2 + 0.05, DOORS[1].z1 - 0.05], [DOORS[1].z2 + 0.05, D]];
    for (const [z1, z2] of segs) bt.aabb(M.white, EX, EX + ET, -RAISE, 0, z1, z2);
    bt.aabb(M.white, EX - 0.2, EX + ET, -RAISE, H, CORRIDOR.z1, 0); bt.aabb(M.white, EX - 0.2, EX + ET, -RAISE, H, D, CORRIDOR.z2);
    bt.aabb(M.column, EX + ET, EX + ET + 0.08, -RAISE, 0, EAST_COLUMN.z1, EAST_COLUMN.z2);
    colliders.push({ x1: EX + ET, x2: EX + ET + 0.08, z1: EAST_COLUMN.z1, z2: EAST_COLUMN.z2 }); }
  // 복도 (통창 너머): MeshBasic + 모드별 밝기
  const corridorMats = [];
  const cb = (o) => { const m = new THREE.MeshBasicMaterial(o); m.userData.base = new THREE.Color(o.color || '#ffffff'); corridorMats.push(m); return m; };
  {
    const C = CORRIDOR, cx1 = EX + ET, len = C.z2 - C.z1, cz = (C.z1 + C.z2) / 2;
    const cf = new THREE.Mesh(new THREE.PlaneGeometry(C.x2 - cx1, len), cb({ color: '#c9c5bb', map: TX.floorTexture() }));
    cf.material.map = cf.material.map.clone(); cf.material.map.repeat.set(4, 18); cf.material.map.needsUpdate = true;
    cf.rotation.x = -Math.PI / 2; cf.position.set((cx1 + C.x2) / 2, -RAISE, cz); root.add(cf);
    // 복도 맞은편(동쪽 끝) 외벽: 바깥 창 (사물함은 정정에 따라 교실 쪽 벽으로 옮김)
    const FX = C.x2, WS = 1.0, WTOP = 2.3, LD = 0.45, LTOP = 0.85;   // 창대·창 위 높이, 사물함 깊이·윗면 높이
    const cwall = cb({ color: '#efede7' }), cframe = cb({ color: '#f6f6f3' }), csill = cb({ color: '#b9a27f' });
    const wallPlane = (z1, z2, y1, y2, mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(z2 - z1, y2 - y1), mat); m.rotation.y = -Math.PI / 2; m.position.set(FX, (y1 + y2) / 2, (z1 + z2) / 2); root.add(m); };
    wallPlane(C.z1, C.z2, -RAISE, WS, cwall); wallPlane(C.z1, C.z2, WTOP, H, cwall);
    const wz1 = C.z1 + 0.4, wz2 = C.z2 - 0.4, nw = 6, ww = (wz2 - wz1) / nw;
    wallPlane(C.z1, wz1, WS, WTOP, cwall); wallPlane(wz2, C.z2, WS, WTOP, cwall);
    for (let i = 0; i < nw; i++) {                      // 창 6칸 (각 칸 미서기 2짝)
      const a = wz1 + i * ww, b = a + ww;
      bt.aabb(cframe, FX - 0.06, FX, WS, WS + 0.05, a, b); bt.aabb(cframe, FX - 0.06, FX, WTOP - 0.05, WTOP, a, b);
      bt.aabb(cframe, FX - 0.06, FX, WS, WTOP, a, a + 0.05); bt.aabb(cframe, FX - 0.06, FX, WS, WTOP, b - 0.05, b);
      bt.aabb(cframe, FX - 0.05, FX - 0.02, WS, WTOP, (a + b) / 2 - 0.02, (a + b) / 2 + 0.02);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(b - a - 0.1, WTOP - WS - 0.1), glassMat); gl.rotation.y = -Math.PI / 2; gl.position.set(FX - 0.03, (WS + WTOP) / 2, (a + b) / 2); gl.renderOrder = 2; root.add(gl);
    }
    bt.aabb(csill, FX - 0.1, FX, WS - 0.02, WS, wz1, wz2);   // 창대
    const osky = new THREE.Mesh(new THREE.PlaneGeometry(30, 7), skyMat); osky.rotation.y = -Math.PI / 2; osky.position.set(FX + 4, 1.4, cz); root.add(osky);
    // 학생 사물함 (2단, 폭 0.4 m): 교실 쪽 복도 벽(아이보리 패널·유리 아래)에 붙어 복도(동쪽)를 향함.
    //   윗면은 유리 창대보다 낮고, 앞문·뒷문 앞과 가운데 기둥 앞은 비움 (plan.js LOCKER_SEGS)
    const lx = cx1, lxf = cx1 + LD, LB = -RAISE;
    const lbody = cb({ color: '#c7cbd0' }), ltop = cb({ color: '#d9dcdf' });
    for (const sg of LOCKER_SEGS) {
      const ltex = TX.lockerTexture(); ltex.repeat.set(sg.n, 1);
      const lfH = LOCKER_TOP - (LB + 0.06);
      const lf = new THREE.Mesh(new THREE.PlaneGeometry(sg.z2 - sg.z1, lfH), cb({ color: '#ffffff', map: ltex }));
      lf.rotation.y = Math.PI / 2; lf.position.set(lxf + 0.001, (LB + 0.06 + LOCKER_TOP) / 2, (sg.z1 + sg.z2) / 2); root.add(lf);
      bt.aabb(lbody, lx, lxf, LB, LB + 0.06, sg.z1, sg.z2);                                        // 받침
      bt.aabb(ltop, lx, lxf + 0.01, LOCKER_TOP, LOCKER_TOP + 0.02, sg.z1 - 0.01, sg.z2 + 0.01);    // 상판
      bt.aabb(lbody, lx, lxf, LB, LOCKER_TOP, sg.z1 - 0.02, sg.z1); bt.aabb(lbody, lx, lxf, LB, LOCKER_TOP, sg.z2, sg.z2 + 0.02); // 옆판
      colliders.push({ x1: lx, x2: lxf, z1: sg.z1 - 0.02, z2: sg.z2 + 0.02 });
    }
    const cc = new THREE.Mesh(new THREE.PlaneGeometry(C.x2 - cx1, len), cb({ color: '#e8e6e0' }));
    cc.rotation.x = Math.PI / 2; cc.position.set((cx1 + C.x2) / 2, H, cz); root.add(cc);
    for (const z of [C.z1, C.z2]) {
      const e = new THREE.Mesh(new THREE.PlaneGeometry(C.x2 - cx1, H + RAISE), cb({ color: '#d9d6cf' }));
      e.position.set((cx1 + C.x2) / 2, (H - RAISE) / 2, z); if (z > cz) e.rotation.y = Math.PI; root.add(e);
    }
    // 복도 천장등
    const cl = cb({ color: '#ffffff' });
    for (let z = C.z1 + 1; z < C.z2; z += 2.4) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 1.2), cl); l.rotation.x = Math.PI / 2; l.position.set((cx1 + C.x2) / 2, H - 0.01, z); root.add(l); }
    cl.userData.isLamp = true;
  }

  // ── 화면 재질 (unlit → 저녁에도 또렷) ──
  const scrMat = {};
  for (const [k, t] of Object.entries(screenTex)) scrMat[k] = new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
  const screenGeos = {};
  const addScreen = (key, w, h, x, y, z, rotY) => {
    const g = new THREE.PlaneGeometry(w, h); if (rotY) g.rotateY(rotY); g.translate(x, y, z);
    (screenGeos[key] ||= []).push(g);
  };

  // ── 북벽 장비: 왼쪽 전자칠판, 오른쪽 TV (중심 높이 1.45 가정) ──
  const eqY = 1.45;
  {
    const cx = (TV.x1 + TV.x2) / 2;
    bt.aabb(M.black, TV.x1, TV.x2, eqY - 0.56, eqY + 0.56, 0.035, 0.095);
    bt.aabb(M.dark, cx - 0.3, cx + 0.3, eqY - 0.25, eqY + 0.25, 0, 0.035);
    addScreen('tv', 1.89, 1.063, cx, eqY, 0.0965, 0);
    const bx = (BOARD.x1 + BOARD.x2) / 2;
    bt.aabb(M.dark, BOARD.x1, BOARD.x2, eqY - 0.585, eqY + 0.585, 0.02, 0.1);
    bt.aabb(M.dark, bx - 0.4, bx + 0.4, eqY - 0.63, eqY - 0.585, 0.02, 0.1);
    addScreen('board', 1.904, 1.071, bx, eqY, 0.1015, 0);
    colliders.push({ x1: 0, x2: W, z1: -1, z2: 0.1 });
    const lb = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.06), new THREE.MeshBasicMaterial({ map: TX.labelTexture('86" 전자칠판', { w: 256, h: 44, bg: '#2c2e33', fg: '#ddd', font: 'bold 26px sans-serif' }) }));
    lb.position.set(bx, eqY - 0.61, 0.1012); root.add(lb);
  }

  // ── 학생 책상(옆면 개방, 회색 철제 프레임 + 흰 상판 + 깊은 와이어 바스켓 + 앞 가림판·멀티탭 + 오른쪽 가방 고리) ──
  const studentScreens = ['s1', 's2', 's3', 's4'];
  const chairs = [], chairHits = [];
  const vcMat = lam('#ffffff', { vertexColors: true });
  M.panel = lam('#a9adb3'); M.stripBody = lam('#f2f2ef'); M.plug = lam('#e9e9e4');
  M.paper = lam('#f7f4ea'); M.pencil = lam('#f2c230'); M.pencilWood = lam('#e8c99a'); M.graphite = lam('#3a3a3a'); M.eraser = lam('#e98a8a');
  M.pen = lam('#2b4ea2'); M.penBlack = lam('#1d1e22'); M.laptop = lam('#b9bdc3'); M.laptopKeys = lam('#2c2e33');
  const stripMat = lam('#ffffff', { map: TX.powerStripTexture() });
  const pageMats = [1, 2, 3].map(k => lam('#ffffff', { map: TX.bookPageTexture(k) }));
  const coverMats = ['#2f5d8a', '#b0413e', '#3d7a4f', '#e0a43a', '#6a4c93'].map(c => lam(c));
  const lapScrMat = new THREE.MeshBasicMaterial({ map: TX.laptopScreenTexture(), toneMapped: false });
  const BAG = ['#24365c', '#1e1f23', '#7b2733', '#2f6f6a', '#8a8f96', '#b9a17e', '#5f7fb0', '#4f5a3a', '#d26a3c', '#3b3f6b'].map(c => lam(c));
  M.bagTrim = lam('#16171a');
  const NO_BAG = new Set([4, 8, 12, 16, 10, 15]);   // 4열은 동쪽 벽과 5 cm라 가방 못 검, 10·15는 비워 둠 (대부분 책상에만)
  const LAPTOP = new Set([3, 11, 13]);              // 일반 수업 모드에서 노트북 + 충전기(멀티탭에 꽂힘)
  const labOnly = new THREE.Group(); labOnly.name = 'labOnly'; root.add(labOnly);       // 실습실 모드: 책상 위 키보드·마우스
  const genOnly = new THREE.Group(); genOnly.name = 'genOnly'; genOnly.visible = false; root.add(genOnly); // 일반 수업 모드: 바스켓 속 키보드, 책, 필기구, 노트북
  const labB = new Batcher(), genB = new Batcher();
  const monArms = [];
  const _m = new THREE.Matrix4(), _r = new THREE.Matrix4();
  // 로컬 변환 m4 = 이동(x,y,z) · 회전Y(ry) · 회전X(rx) · 회전Z(rz)
  const T4 = (x, y, z, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().makeTranslation(x, y, z)
    .multiply(_r.makeRotationY(ry)).multiply(new THREE.Matrix4().makeRotationX(rx)).multiply(new THREE.Matrix4().makeRotationZ(rz));
  const rnd = (n, k) => { const v = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
  for (const d of DESKS) {
    const cx = (d.x1 + d.x2) / 2;
    deskFrame(bt, M, d.x1, d.x2, d.z1, d.z2, DESK_H);
    // 앞(북쪽) 짧은 가림판 (모데스티 패널) — 아래 기둥 사이, 상판 테두리 밑
    bt.aabb(M.panel, d.x1 + 0.075, d.x2 - 0.075, 0.40, DESK_H - 0.075, d.z1 + 0.028, d.z1 + 0.04);
    // 와이어 바스켓 서랍 (상판 아래 앞쪽, 깊이 14 cm)
    const bx1 = cx - 0.25, bx2 = cx + 0.25, bz1 = d.z1 + 0.05, bz2 = d.z1 + 0.36, by1 = DESK_H - 0.175, by2 = DESK_H - 0.035;
    bt.aabb(M.wire, bx1, bx2, by1, by1 + 0.004, bz1, bz2);
    bt.plane(M.wire, bx2 - bx1, by2 - by1, cx, (by1 + by2) / 2, bz2);
    bt.plane(M.wire, bx2 - bx1, by2 - by1, cx, (by1 + by2) / 2, bz1);
    bt.plane(M.wire, bz2 - bz1, by2 - by1, bx1, (by1 + by2) / 2, (bz1 + bz2) / 2, Math.PI / 2);
    bt.plane(M.wire, bz2 - bz1, by2 - by1, bx2, (by1 + by2) / 2, (bz1 + bz2) / 2, Math.PI / 2);
    bt.aabb(M.steel, bx1 - 0.01, bx1, by2 - 0.01, by2, bz1, bz2); bt.aabb(M.steel, bx2, bx2 + 0.01, by2 - 0.01, by2, bz1, bz2); // 레일
    bt.aabb(M.steel, bx1, bx2, by1, by1 + 0.008, bz2 - 0.004, bz2 + 0.004); bt.aabb(M.steel, bx1, bx2, by2 - 0.008, by2, bz2 - 0.004, bz2 + 0.004); // 테두리 철사
    bt.aabb(M.steelDark, cx - 0.06, cx + 0.06, by2 - 0.05, by2 - 0.03, bz2, bz2 + 0.015); // 손잡이
    // 멀티탭: 가림판 학생 쪽(남쪽) 면, 바스켓 아래 — 콘센트 4구 + 스위치, 전원선은 바닥 콘센트 박스로
    const fx = d.x1 + 0.2, fz = d.z1 + 0.2;
    const sx1 = cx - 0.16, sx2 = cx + 0.11, sy1 = 0.45, sy2 = 0.50, sz1 = d.z1 + 0.04, sz2 = d.z1 + 0.072;
    bt.aabb(M.stripBody, sx1, sx2, sy1, sy2, sz1, sz2);
    bt.plane(stripMat, sx2 - sx1 - 0.004, sy2 - sy1 - 0.004, (sx1 + sx2) / 2, (sy1 + sy2) / 2, sz2 + 0.0008);
    bt.tube(M.cable, [[sx1, 0.47, sz1 + 0.016], [sx1 - 0.03, 0.45, sz1 + 0.03], [fx + 0.03, 0.16, fz - 0.05], [fx + 0.05, 0.012, fz + 0.02]], 0.0035);
    const sock = i => sx1 + (66 + i * 50) / 256 * (sx2 - sx1);
    if (d.n % 3 === 1) {   // 몇 자리는 휴대폰 충전기가 꽂혀 있음 (전원 어댑터 + 짧게 늘어진 선)
      const px_ = sock(0); bt.aabb(M.plug, px_ - 0.022, px_ + 0.022, 0.452, 0.498, sz2, sz2 + 0.03);
      bt.tube(M.cable, [[px_, 0.46, sz2 + 0.03], [px_ + 0.01, 0.38, sz2 + 0.05], [px_ + 0.04, 0.33, sz2 + 0.03]], 0.0022);
    }
    // ── Dell 27" 모니터 + 검정 폴형 싱글 암 (북서 모서리 C-클램프, 폴 ~45 cm) + 미니PC (VESA 판 옆, 같은 높이) ──
    //   정정(t1007): 모니터 아래 끝이 상판 위 8 cm. 일반 수업 모드에서는 폴(축)을 중심으로 왼쪽으로 돌림 →
    //   암 A(폴 기준 회전) 그룹 + 팔꿈치 관절 기준 B 그룹(모니터·VESA·미니PC·케이블)으로 나눠 움직임
    const mY = DESK_H + 0.08 + 0.1825, mz = d.z1 + 0.19;   // 화면 중심 높이, 화면 앞면 z
    const back = mz - 0.03;
    const vy = mY - 0.045, vx = cx - 0.045, px = cx + 0.055;
    const ax = d.x1 + 0.04, az = d.z1 + 0.035, ay = vy, vz = back - 0.09;
    const jx = ax + (vx - ax) * 0.55, jz = az;
    const bA = new Batcher(vcMat), bB = new Batcher(vcMat);
    bB.aabb(M.black, cx - 0.3075, cx + 0.3075, mY - 0.1825, mY + 0.1825, back, mz);
    bB.aabb(M.black, cx - 0.2, cx + 0.2, mY - 0.13, mY + 0.11, back - 0.018, back);           // 뒷면 볼록부
    bB.plane(M.dellBack, 0.06, 0.06, cx, mY + 0.06, back - 0.0185, Math.PI);                   // DELL 로고 (뒷면 중앙)
    // 참고 사진(ref/minipc_vesa_ref.png): 뒤에서 볼 때 미니PC는 가운데 왼쪽(동쪽), 은색 VESA 판 + 틸트 브래킷은 가운데 오른쪽(서쪽, 폴 쪽), 같은 높이
    bB.aabb(M.silver, vx - 0.055, vx + 0.055, vy - 0.055, vy + 0.055, back - 0.023, back - 0.018);
    bB.aabb(M.silver, vx - 0.075, vx - 0.055, vy - 0.012, vy + 0.012, back - 0.022, back - 0.018);
    bB.aabb(M.silver, vx + 0.055, vx + 0.07, vy - 0.012, vy + 0.012, back - 0.022, back - 0.018);
    for (const [sx, sy] of [[-0.045, -0.045], [-0.045, 0.045], [0.045, -0.045], [0.045, 0.045]]) bB.cyl(M.steelDark, 0.005, 0.006, vx + sx, vy + sy, back - 0.025, 6, Math.PI / 2);
    bB.aabb(M.silver, px - 0.0625, px + 0.0625, vy - 0.0625, vy + 0.0625, back - 0.064, back - 0.024); // 미니PC 알루미늄 테두리
    bB.plane(M.pcFace, 0.115, 0.115, px, vy, back - 0.0645, Math.PI);
    for (const [sy, h] of [[0.03, 0.012], [0.017, 0.008], [0.005, 0.008], [-0.012, 0.008], [-0.035, 0.014]]) bB.aabb(M.black, px + 0.0625, px + 0.064, vy + sy - h / 2, vy + sy + h / 2, back - 0.052, back - 0.036);
    bB.tube(M.cable, [[px + 0.065, vy + 0.03, back - 0.044], [px + 0.082, vy + 0.02, back - 0.046], [px + 0.09, vy - 0.06, back - 0.035], [cx + 0.1, mY - 0.131, back - 0.008]], 0.0038); // 짧은 HDMI
    // 폴 + C-클램프 (고정)
    const cz1 = d.z1 - 0.022, cz2 = d.z1 + 0.075, top = DESK_H, und = DESK_H - 0.025;
    bt.aabb(M.black, ax - 0.032, ax + 0.032, top, top + 0.014, cz1, cz2);
    bt.aabb(M.black, ax - 0.032, ax + 0.032, und - 0.075, top + 0.014, cz1, cz1 + 0.02);
    bt.aabb(M.black, ax - 0.032, ax + 0.032, und - 0.075, und - 0.06, cz1, cz2);
    bt.cyl(M.steelDark, 0.007, 0.06, ax, und - 0.03, az + 0.015, 8);
    bt.aabb(M.dark, ax - 0.022, ax + 0.022, und - 0.006, und, az - 0.007, az + 0.037);
    bt.cyl(M.black, 0.018, 0.012, ax, und - 0.09, az + 0.015, 10);
    bt.box(M.black, 0.06, 0.01, 0.012, ax, und - 0.09, az + 0.015);
    bt.cyl(M.black, 0.018, 0.45, ax, DESK_H + 0.225, az, 12);
    bt.cyl(M.black, 0.021, 0.012, ax, DESK_H + 0.455, az, 12);
    // 수평 2관절 암: 폴 칼라·첫 마디·팔꿈치(A) → 둘째 마디·틸트 브래킷(B)
    const seg = (b, x1, z1, x2, z2) => b.box(M.black, Math.hypot(x2 - x1, z2 - z1) + 0.04, 0.035, 0.045, (x1 + x2) / 2, ay, (z1 + z2) / 2, -Math.atan2(z2 - z1, x2 - x1));
    bA.cyl(M.black, 0.03, 0.05, ax, ay, az, 12);
    seg(bA, ax, az, jx, jz); bA.cyl(M.black, 0.026, 0.05, jx, ay, jz, 12);
    seg(bB, jx, jz, vx, vz);
    bB.aabb(M.silver, vx - 0.028, vx + 0.028, ay - 0.045, ay + 0.045, back - 0.05, back - 0.023);
    bB.cyl(M.silver, 0.016, 0.07, vx, ay, back - 0.062, 12);
    bB.cyl(M.steelDark, 0.009, 0.075, vx, ay, back - 0.062, 8, 0, Math.PI / 2);
    bB.aabb(M.black, vx - 0.024, vx + 0.024, ay - 0.022, ay + 0.022, vz - 0.02, back - 0.07);
    // 케이블: 미니PC 옆 포트 2가닥 + 모니터 전원 → 둘째 마디 아래(B) → 팔꿈치 관절 속 → 첫 마디 아래(A) → 폴 칼라 속 →
    //   폴 뒤(고정) → 상판 앞 모서리 → 클램프 아래 묶음 → 가림판 바깥으로 내려가 바닥 콘센트 박스
    const J = [jx, ay - 0.02, jz], P = [ax, ay - 0.02, az];
    const pathB = [[px - 0.01, vy - 0.07, back - 0.05], [vx, ay - 0.065, vz + 0.012], [(jx + vx) / 2, ay - 0.035, (jz + vz) / 2], J];
    const pathA = [J, [(ax + jx) / 2, ay - 0.035, az + 0.004], P];
    const pathS = [P, [ax + 0.03, ay - 0.07, az - 0.002], [ax + 0.024, DESK_H + 0.09, az - 0.006], [ax + 0.05, DESK_H + 0.025, d.z1 + 0.004],
      [ax + 0.052, DESK_H - 0.02, d.z1 - 0.014], [ax + 0.052, und - 0.12, d.z1 - 0.014], [ax + 0.06, 0.34, d.z1 - 0.012], [ax + 0.08, 0.2, d.z1 + 0.06], [fx, 0.07, fz - 0.03], [fx, 0.012, fz]];
    const starts = [[px + 0.065, vy - 0.012, back - 0.044], [px + 0.065, vy - 0.035, back - 0.044], [cx + 0.12, mY - 0.131, back - 0.01]];
    const offs = [[0, 0, 0], [0.006, 0.002, 0.003], [-0.002, 0.004, 0.006]];
    const off = (pts, o) => pts.map(([x, y, z]) => [x + o[0], y + o[1], z + o[2]]);
    starts.forEach((st, i) => {
      bB.tube(M.cable, [st, ...off(pathB, offs[i])], 0.0032);
      bA.tube(M.cable, off(pathA, offs[i]), 0.0032);
      const sp = off(pathS, offs[i]); sp[sp.length - 1] = [fx + offs[i][0] * 2, 0.012, fz + offs[i][2] * 2];
      bt.tube(M.cable, sp, 0.0032);
    });
    // 키보드·마우스 USB 케이블: 미니PC 옆 USB 포트 → 모니터 뒤·암 아래(B·A, 위 묶음과 함께) → 폴을 따라 내려와 → 폴 밑동(공통 이음점)
    //   → 실습실 모드: 상판 위로 키보드·마우스 뒤까지 / 일반 수업 모드: 상판 남쪽 끝으로 넘어가 늘어졌다가 바스켓 앞 테두리를 넘어 서랍 속 키보드·마우스로
    const kb = by1 + 0.004;
    const JB = [ax + 0.026, DESK_H + 0.022, az + 0.02];   // 폴 밑동 (클램프 위 턱 위)
    const usbs = [[px + 0.065, vy + 0.005, back - 0.044], [px + 0.065, vy + 0.017, back - 0.044]];   // 키보드, 마우스
    const koffs = [[0.003, -0.004, -0.005], [-0.005, -0.003, 0.0]];
    usbs.forEach((st, i) => {
      const o = koffs[i];
      bB.tube(M.cable, [st, ...off(pathB, o)], 0.0026);
      bA.tube(M.cable, off(pathA, o), 0.0026);
      bt.tube(M.cable, [...off([P, [ax + 0.03, ay - 0.07, az - 0.002], [ax + 0.024, DESK_H + 0.09, az - 0.006]], o), JB.map((v, k) => v + o[k])], 0.0026);
      const jb = JB.map((v, k) => v + o[k]), lift = [ax + 0.05 + o[0], DESK_H + 0.004, az + 0.085 + o[2]];
      const labEnd = i === 0
        ? [[cx - 0.2, DESK_H + 0.004, d.z1 + 0.285], [cx - 0.15, DESK_H + 0.01, d.z1 + 0.298]]
        : [[cx - 0.05, DESK_H + 0.004, d.z1 + 0.275], [cx + 0.24, DESK_H + 0.004, d.z1 + 0.295], [cx + 0.3, DESK_H + 0.012, d.z1 + 0.33]];
      labB.tube(M.cable, [jb, lift, ...labEnd], 0.0026);
      const droop = [[d.x1 + 0.07 + o[0], DESK_H + 0.004, d.z1 + 0.45], [d.x1 + 0.11 + o[0], DESK_H + 0.004, d.z2 - 0.01], [d.x1 + 0.13 + o[0], DESK_H - 0.012, d.z2 + 0.012],
        [d.x1 + 0.15 + o[0], 0.6 - i * 0.03, d.z2 + 0.03], [d.x1 + 0.17 + o[0], 0.68, d.z1 + 0.40], [bx1 + 0.03 + o[0], 0.709, bz2 + 0.004], [bx1 + 0.03 + o[0], 0.66, bz2 - 0.03]];
      const genEnd = i === 0
        ? [[bx1 + 0.02, kb + 0.006, d.z1 + 0.28], [bx1 + 0.02, kb + 0.006, d.z1 + 0.19], [cx - 0.15, kb + 0.012, d.z1 + 0.198]]
        : [[bx1 + 0.03, kb + 0.006, d.z1 + 0.24], [bx1 + 0.04, kb + 0.006, d.z1 + 0.06], [cx + 0.11, kb + 0.012, d.z1 + 0.068]];
      genB.tube(M.cable, [jb, lift, ...droop, ...genEnd], 0.0026);
    });
    { const [x, y, z] = pathB[2]; bB.box(M.tie, 0.024, 0.014, 0.024, x + 0.003, y, z + 0.004); }       // 벨크로 케이블 타이
    for (const k of [2, 5]) { const [x, y, z] = pathS[k]; bt.box(M.tie, 0.024, 0.014, 0.024, x + 0.003, y, z + 0.004); }
    bt.aabb(M.alu, fx - 0.11, fx + 0.11, 0, 0.006, fz - 0.11, fz + 0.11);   // 바닥 콘센트 박스 (전원·LAN) + 브러시 그로밋
    bt.aabb(M.black, fx - 0.07, fx + 0.07, 0.006, 0.01, fz - 0.025, fz + 0.025);
    bt.aabb(M.dark, fx - 0.09, fx - 0.03, 0.006, 0.012, fz + 0.045, fz + 0.09);
    const gA = new THREE.Group(); gA.name = 'monArmA_' + d.n; gA.position.set(ax, 0, az); root.add(gA);
    const gB = new THREE.Group(); gB.name = 'monArmB_' + d.n; gB.position.set(jx - ax, 0, jz - az); gA.add(gB);
    bA.build(gA, ax, az); bB.build(gB, jx, jz);
    const sg = new THREE.PlaneGeometry(0.598, 0.336); sg.translate(cx - jx, mY + 0.005, mz + 0.001 - jz);
    { const sm = new THREE.Mesh(sg, scrMat[studentScreens[(d.n - 1) % 4]]); sm.name = 'screens_' + studentScreens[(d.n - 1) % 4] + '_' + d.n; gB.add(sm); }
    monArms.push({ n: d.n, a: gA, b: gB });
    // 키보드·마우스: 실습실 모드 = 책상 위 / 일반 수업 모드 = 바스켓 서랍 안
    labB.aabb(M.dark, cx - 0.22, cx + 0.22, DESK_H, DESK_H + 0.018, d.z1 + 0.30, d.z1 + 0.44);
    labB.aabb(M.key, cx - 0.21, cx + 0.21, DESK_H + 0.018, DESK_H + 0.022, d.z1 + 0.31, d.z1 + 0.43);
    labB.aabb(M.dark, cx + 0.27, cx + 0.33, DESK_H, DESK_H + 0.03, d.z1 + 0.33, d.z1 + 0.43);
    genB.aabb(M.dark, cx - 0.22, cx + 0.22, kb, kb + 0.018, d.z1 + 0.20, d.z1 + 0.34);
    genB.aabb(M.key, cx - 0.21, cx + 0.21, kb + 0.018, kb + 0.022, d.z1 + 0.21, d.z1 + 0.33);
    genB.aabb(M.dark, cx + 0.08, cx + 0.14, kb, kb + 0.03, d.z1 + 0.07, d.z1 + 0.17);
    // 일반 수업 모드: 펼친 책 (자리마다 위치·각도·표지색 조금씩 다름) + 연필/펜 몇 자리, 노트북 2~3 자리
    if (LAPTOP.has(d.n)) {
      const lx = cx + 0.04, lz = d.z1 + 0.37, ly = DESK_H, hz = lz - 0.11, tilt = -0.32;
      genB.aabb(M.laptop, lx - 0.16, lx + 0.16, ly, ly + 0.016, hz, hz + 0.22);
      genB.aabb(M.laptopKeys, lx - 0.14, lx + 0.14, ly + 0.016, ly + 0.0175, hz + 0.02, hz + 0.12);
      genB.aabb(M.laptopKeys, lx - 0.045, lx + 0.045, ly + 0.016, ly + 0.0175, hz + 0.14, hz + 0.2);
      genB.boxM(M.laptop, 0.32, 0.21, 0.007, T4(lx, ly + 0.016, hz).multiply(new THREE.Matrix4().makeRotationX(tilt)).multiply(new THREE.Matrix4().makeTranslation(0, 0.105, 0)));
      const sm = T4(lx, ly + 0.016, hz).multiply(new THREE.Matrix4().makeRotationX(tilt)).multiply(new THREE.Matrix4().makeTranslation(0, 0.107, 0.0038));
      genB.geoM(lapScrMat, new THREE.PlaneGeometry(0.29, 0.18), sm);
      // 충전기: 멀티탭 4번 구에 꽂힌 플러그 → 책상 오른쪽 옆으로 올라와 노트북 오른쪽 포트
      const q = sock(3);
      genB.aabb(M.plug, q - 0.02, q + 0.02, 0.453, 0.497, sz2, sz2 + 0.028);
      genB.tube(M.cable, [[q, 0.475, sz2 + 0.028], [q + 0.04, 0.42, sz2 + 0.1], [d.x2 - 0.06, 0.5, d.z1 + 0.45], [d.x2 + 0.02, 0.66, d.z1 + 0.53], [d.x2 + 0.012, DESK_H + 0.008, d.z1 + 0.53], [d.x2 - 0.03, DESK_H + 0.005, d.z1 + 0.5], [lx + 0.163, ly + 0.008, d.z1 + 0.42]], 0.003);
    } else {
      const ry = (rnd(d.n, 1) - 0.5) * 0.24, bxc = cx + (rnd(d.n, 2) - 0.5) * 0.08, bzc = d.z1 + 0.40 + (rnd(d.n, 3) - 0.5) * 0.05;
      const B4 = T4(bxc, DESK_H, bzc, ry), W_ = 0.2, Dp = 0.27;
      genB.boxM(coverMats[d.n % coverMats.length], 2 * W_ + 0.012, 0.004, Dp + 0.012, B4.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.002, 0)));
      for (const sgn of [-1, 1]) {   // 양쪽 페이지 묶음: 가운데(제본)로 살짝 기울어진 V자
        const pm = B4.clone().multiply(T4(sgn * W_ / 2, 0.012, 0, 0, 0, sgn * 0.05));
        genB.boxM(M.paper, W_ - 0.004, 0.014, Dp - 0.004, pm.clone());
        const g = new THREE.PlaneGeometry(W_ - 0.006, Dp - 0.008); g.rotateX(-Math.PI / 2);
        const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, sgn < 0 ? uv.getX(i) * 0.5 : 0.5 + uv.getX(i) * 0.5);
        genB.geoM(pageMats[d.n % 3], g, pm.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.0072, 0)));
      }
      const tool = d.n % 4;   // 0: 연필, 1: 파란 펜, 2: 없음, 3: 연필 + 검정 펜
      const lay = (mat, len, r, x, z, yaw, seg = 6) => genB.geoM(mat, new THREE.CylinderGeometry(r, r, len, seg), T4(x, DESK_H + r, z, yaw, 0, Math.PI / 2));
      const px0 = bxc + 0.25, pz0 = bzc + (rnd(d.n, 4) - 0.5) * 0.08, pyaw = 0.3 + rnd(d.n, 5) * 0.9;
      if (tool === 0 || tool === 3) {
        lay(M.pencil, 0.15, 0.0038, px0, pz0, pyaw);
        const dx = Math.cos(pyaw) * 0.085, dz = -Math.sin(pyaw) * 0.085;
        genB.geoM(M.pencilWood, new THREE.ConeGeometry(0.0038, 0.02, 6), T4(px0 + dx, DESK_H + 0.0038, pz0 + dz, pyaw, 0, -Math.PI / 2));
        lay(M.eraser, 0.012, 0.0039, px0 - Math.cos(pyaw) * 0.081, pz0 + Math.sin(pyaw) * 0.081, pyaw);
      }
      if (tool === 1 || tool === 3) lay(tool === 1 ? M.pen : M.penBlack, 0.14, 0.0045, px0 + 0.03, pz0 + 0.05, pyaw + 0.5, 10);
    }
    // 오른쪽(동쪽) 옆: 가방 고리 + 책가방 (대부분의 책상, 색 다양)
    const hz = d.z1 + 0.33;
    bt.aabb(M.steelDark, d.x2 - 0.03, d.x2 + 0.028, DESK_H - 0.072, DESK_H - 0.062, hz - 0.008, hz + 0.008);
    bt.aabb(M.steelDark, d.x2 + 0.02, d.x2 + 0.028, DESK_H - 0.072, DESK_H - 0.048, hz - 0.008, hz + 0.008);
    if (!NO_BAG.has(d.n)) {
      const bm = BAG[d.n % BAG.length], bxm = d.x2 + 0.05, yT = DESK_H - 0.125, yB = 0.2, bw = 0.29, bd = 0.12;
      const yaw = (rnd(d.n, 6) - 0.5) * 0.16;
      const G = T4(bxm, 0, hz, yaw);
      const at = (x, y, z) => G.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, z));
      bt.boxM(bm, bd, yT - 0.06 - yB, bw, at(0, (yT - 0.06 + yB) / 2, 0));                       // 몸통
      bt.geoM(bm, new THREE.CylinderGeometry(bw / 2, bw / 2, bd, 18, 1, false, 0, Math.PI), at(0, yT - 0.06, 0).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)).multiply(new THREE.Matrix4().makeScale(0.42, 1, 1))); // 둥근 윗부분
      bt.boxM(bm, 0.045, 0.16, 0.22, at(bd / 2 + 0.02, yB + 0.1, 0));                              // 앞주머니
      bt.boxM(M.bagTrim, 0.004, 0.006, 0.2, at(bd / 2 + 0.043, yB + 0.17, 0));                      // 지퍼선
      bt.boxM(M.bagTrim, 0.004, 0.006, bw - 0.03, at(bd / 2 + 0.001, yT - 0.08, 0));
      for (const sz of [-0.08, 0.08]) bt.boxM(M.bagTrim, 0.012, yT - yB - 0.12, 0.04, at(-bd / 2 - 0.006, (yT + yB) / 2 - 0.02, sz)); // 어깨끈 (책상 쪽)
      const tp = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(G);
      bt.tube(M.bagTrim, [tp(0, yT - 0.035, -0.035), tp(-0.03, DESK_H - 0.05, -0.01), tp(-0.03, DESK_H - 0.05, 0.01), tp(0, yT - 0.035, 0.035)].map(v => [v.x, v.y, v.z]), 0.006); // 손잡이 고리
      colliders.push({ x1: d.x2, x2: d.x2 + 0.13, z1: hz - 0.16, z2: hz + 0.16 });
    }
    const num = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.06), new THREE.MeshBasicMaterial({ map: TX.labelTexture(String(d.n), { w: 64, h: 32, font: 'bold 24px sans-serif' }) }));
    num.rotation.x = -Math.PI / 2; num.position.set(d.x2 - 0.09, DESK_H + 0.001, d.z2 - 0.05); root.add(num);
    colliders.push({ x1: d.x1, x2: d.x2, z1: d.z1, z2: d.z2 });
    const chz = d.z2 + 0.29;
    const chairRec = { n: d.n, x: cx, z: chz };
    chairs.push(chairRec);
    const ch = new THREE.Mesh(new THREE.BoxGeometry(CHAIR + 0.04, 0.9, CHAIR + 0.04), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }));
    ch.position.set(cx, 0.45, chz); ch.userData.chair = chairRec; chairHits.push(ch); root.add(ch);
    makeChair(bt, M, cx, chz);
    colliders.push({ x1: cx - CHAIR / 2, x2: cx + CHAIR / 2, z1: chz - CHAIR / 2, z2: chz + CHAIR / 2 });
  }
  labB.build(labOnly); genB.build(genOnly);
  // 19번 예비 자리 의자 없음

  // ── 교사 스탠딩 책상 (H1,000) + 27" 모니터 2대 — '교탁 가운데' 스위치로 앞 가운데까지 이동하는 그룹 ──
  const teachG = new THREE.Group(); teachG.name = 'teacherDesk'; root.add(teachG);
  const teachCol = { x1: TEACHER_DESK.x1, x2: TEACHER_DESK.x2, z1: TEACHER_DESK.z1, z2: TEACHER_DESK.z2 };
  {
    const t = TEACHER_DESK, cx = (t.x1 + t.x2) / 2, tb = new Batcher();
    deskFrame(tb, M, t.x1, t.x2, t.z1, t.z2, t.h);
    const mY = t.h + 0.12 + 0.1825, mz = t.z2 - 0.14;
    [cx - 0.325, cx + 0.325].forEach((mx, i) => {
      tb.aabb(M.black, mx - 0.3075, mx + 0.3075, mY - 0.1825, mY + 0.1825, mz, mz + 0.025);
      tb.aabb(M.dark, mx - 0.03, mx + 0.03, t.h, mY, mz + 0.03, mz + 0.06);
      tb.aabb(M.dark, mx - 0.11, mx + 0.11, t.h, t.h + 0.012, mz - 0.02, mz + 0.12);
      const g = new THREE.PlaneGeometry(0.598, 0.336); g.rotateY(Math.PI); g.translate(mx, mY + 0.005, mz - 0.001);
      const tm = new THREE.Mesh(g, scrMat[i === 0 ? 't1' : 't2']); tm.name = 'screens_' + (i === 0 ? 't1' : 't2'); teachG.add(tm);
      tb.plane(M.dellBack, 0.06, 0.06, mx, mY + 0.08, mz + 0.026, 0);
    });
    tb.aabb(M.dark, cx - 0.22, cx + 0.22, t.h, t.h + 0.018, t.z1 + 0.08, t.z1 + 0.22);
    tb.aabb(M.key, cx - 0.21, cx + 0.21, t.h + 0.018, t.h + 0.022, t.z1 + 0.09, t.z1 + 0.21);
    tb.aabb(M.dark, cx + 0.3, cx + 0.36, t.h, t.h + 0.03, t.z1 + 0.1, t.z1 + 0.2);
    tb.build(teachG);
    colliders.push(teachCol);
  }

  // ── 뒤쪽 창가(서쪽) 구석: 공기청정기 + 아이패드 24대 충전보관함 (17번 책상 의자·예비 자리와 떨어짐) ──
  {
    M.cab = lam('#d9dcdf'); M.cabDark = lam('#6d737a'); M.ipad = [lam('#3a3d44'), lam('#2f4766'), lam('#5b6068')]; M.purifier = lam('#f4f4f1');
    const C = { x1: 0.46, x2: 1.26, z1: 7.92, z2: 8.38, y1: 0.07, y2: 1.03 }, tk = 0.02, cxm = (C.x1 + C.x2) / 2;
    for (const [x, z] of [[C.x1 + 0.06, C.z1 + 0.06], [C.x2 - 0.06, C.z1 + 0.06], [C.x1 + 0.06, C.z2 - 0.06], [C.x2 - 0.06, C.z2 - 0.06]]) {
      bt.cyl(M.black, 0.03, 0.025, x, 0.03, z, 12, 0, Math.PI / 2); bt.aabb(M.cabDark, x - 0.02, x + 0.02, 0.045, C.y1, z - 0.02, z + 0.02);   // 바퀴
    }
    bt.aabb(M.cab, C.x1, C.x2, C.y1, C.y1 + tk, C.z1, C.z2); bt.aabb(M.cab, C.x1, C.x2, C.y2 - tk, C.y2, C.z1, C.z2);   // 바닥·윗판
    bt.aabb(M.cab, C.x1, C.x1 + tk, C.y1, C.y2, C.z1, C.z2); bt.aabb(M.cab, C.x2 - tk, C.x2, C.y1, C.y2, C.z1, C.z2);   // 옆판
    bt.aabb(M.cab, C.x1, C.x2, C.y1, C.y2, C.z2 - tk, C.z2);                                                        // 뒤판
    const rows = [[0.13, 0.45], [0.51, 0.83]], ix1 = C.x1 + tk, ix2 = C.x2 - tk, n = 12, sw_ = (ix2 - ix1) / n;
    const ledG = [], ledO = [];
    rows.forEach(([r1, r2], ri) => {
      bt.aabb(M.cab, ix1, ix2, r1 - 0.02, r1, C.z1 + 0.03, C.z2 - tk);                                            // 선반
      for (let i = 0; i <= n; i++) bt.aabb(M.cabDark, ix1 + i * sw_ - 0.0015, ix1 + i * sw_ + 0.0015, r1, r1 + 0.2, C.z1 + 0.1, C.z2 - tk - 0.02); // 칸막이
      for (let i = 0; i < n; i++) {
        const k = ri * n + i, x = ix1 + (i + 0.5) * sw_, empty = [5, 13, 18, 22].includes(k);
        if (!empty) bt.aabb(M.ipad[k % 3], x - 0.0045, x + 0.0045, r1 + 0.005, r1 + 0.253, C.z1 + 0.12, C.z1 + 0.3 + (k % 2) * 0.005);
        const lg = new THREE.PlaneGeometry(0.008, 0.008); lg.rotateY(Math.PI); lg.translate(x, r1 - 0.01, C.z1 + 0.029); (empty ? null : (k % 5 === 2 ? ledO : ledG))?.push(lg);
        if (!empty) bt.cyl(M.key, 0.0015, 0.08, x, r1 + 0.005, C.z1 + 0.33, 4, Math.PI / 2);   // 충전 케이블
      }
    });
    root.add(new THREE.Mesh(mergeGeometries(ledG), new THREE.MeshBasicMaterial({ color: '#39e36b' })));
    root.add(new THREE.Mesh(mergeGeometries(ledO), new THREE.MeshBasicMaterial({ color: '#ffae2b' })));
    bt.aabb(M.cab, ix1, ix2, 0.86, 0.88, C.z1 + 0.03, C.z2 - tk);
    // 앞문 2짝: 철제 틀 + 투명 아크릴 (안의 아이패드가 보임) + 손잡이·자물쇠, 맨 위 충전부 패널
    const acr = new THREE.MeshBasicMaterial({ color: '#dfeefa', transparent: true, opacity: 0.16, depthWrite: false });
    const fz = C.z1 - 0.012, mid = cxm;
    for (const [a, b] of [[C.x1, mid - 0.002], [mid + 0.002, C.x2]]) {
      bt.aabb(M.cab, a, b, C.y1, C.y1 + 0.05, fz, C.z1); bt.aabb(M.cab, a, b, 0.84, 0.88, fz, C.z1);
      bt.aabb(M.cab, a, a + 0.04, C.y1, 0.88, fz, C.z1); bt.aabb(M.cab, b - 0.04, b, C.y1, 0.88, fz, C.z1);
      bt.aabb(M.cab, a, b, 0.46, 0.5, fz, C.z1);
      for (const [y1, y2] of [[C.y1 + 0.05, 0.46], [0.5, 0.84]]) { const g = new THREE.Mesh(new THREE.PlaneGeometry(b - a - 0.08, y2 - y1), acr); g.rotation.y = Math.PI; g.position.set((a + b) / 2, (y1 + y2) / 2, fz + 0.004); g.renderOrder = 2; root.add(g); }
    }
    for (const sgn of [-1, 1]) bt.aabb(M.cabDark, mid + sgn * 0.03 - 0.008, mid + sgn * 0.03 + 0.008, 0.55, 0.7, fz - 0.025, fz);   // 손잡이
    bt.cyl(M.silver, 0.012, 0.012, mid + 0.07, 0.62, fz - 0.004, 12, Math.PI / 2);                                           // 자물쇠
    bt.aabb(M.cab, C.x1, C.x2, 0.88, C.y2, fz, C.z1);
    for (let i = 0; i < 9; i++) bt.aabb(M.cabDark, C.x1 + 0.4 + i * 0.035, C.x1 + 0.42 + i * 0.035, 0.91, 1.0, fz - 0.001, fz);       // 통풍 슬릿
    const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.06), new THREE.MeshBasicMaterial({ map: TX.labelTexture('iPad 충전보관함 24', { w: 256, h: 54, bg: '#2f3a48', fg: '#fff', font: 'bold 24px sans-serif' }) }));
    lbl.rotation.y = Math.PI; lbl.position.set(C.x1 + 0.2, 0.955, fz - 0.002); root.add(lbl);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.01), new THREE.MeshBasicMaterial({ color: '#39e36b' })); pl.rotation.y = Math.PI; pl.position.set(C.x2 - 0.06, 0.955, fz - 0.002); root.add(pl);
    colliders.push({ x1: C.x1, x2: C.x2, z1: C.z1 - 0.04, z2: D });
    // 공기청정기: 창가 구석, 앞면이 교실 쪽(북쪽)
    const P = { x1: 0.06, x2: 0.4, z1: 7.98, z2: 8.3, h: 0.78 }, pcx = (P.x1 + P.x2) / 2;
    bt.aabb(M.dark, P.x1 + 0.02, P.x2 - 0.02, 0, 0.03, P.z1 + 0.02, P.z2 - 0.02);
    bt.aabb(M.purifier, P.x1, P.x2, 0.03, P.h, P.z1, P.z2);
    bt.aabb(M.purifier, P.x1 + 0.015, P.x2 - 0.015, P.h, P.h + 0.015, P.z1 + 0.015, P.z2 - 0.015);
    bt.aabb(M.cabDark, P.x1 + 0.04, P.x2 - 0.04, P.h + 0.015, P.h + 0.017, P.z1 + 0.04, P.z2 - 0.04);       // 윗면 토출구
    for (let i = 0; i < 7; i++) bt.aabb(M.purifier, P.x1 + 0.04, P.x2 - 0.04, P.h + 0.017, P.h + 0.019, P.z1 + 0.06 + i * 0.033, P.z1 + 0.07 + i * 0.033);
    for (const sx of [P.x1 - 0.001, P.x2]) for (let i = 0; i < 14; i++) bt.aabb(M.edge, sx, sx + 0.001, 0.1, 0.6, P.z1 + 0.04 + i * 0.018, P.z1 + 0.047 + i * 0.018); // 옆면 흡입구
    bt.aabb(M.edge, P.x1 + 0.01, P.x2 - 0.01, 0.598, 0.602, P.z1 - 0.002, P.z1);                                // 앞 패널 이음선
    const dsp = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), new THREE.MeshBasicMaterial({ map: TX.purifierDisplayTexture(), toneMapped: false }));
    dsp.rotation.y = Math.PI; dsp.position.set(pcx, 0.68, P.z1 - 0.002); root.add(dsp);
    colliders.push({ x1: 0, x2: P.x2, z1: P.z1, z2: D });
  }

  // ── 스위치 판 (앞문 옆 벽, 위에서부터): 조명 · 교탁 가운데 · 일반 수업 ──
  const invisM = () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
  const switches = [];
  const makeSwitch = (key, label, dy, lw) => {
    const g = new THREE.Group(); g.name = 'switch_' + key;
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.13, 0.08), new THREE.MeshLambertMaterial({ map: TX.switchTexture() })));
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: '#444' }));
    led.position.set(-0.009, 0.08, 0); g.add(led);
    const lb = new THREE.Mesh(new THREE.PlaneGeometry(lw, 0.05), new THREE.MeshBasicMaterial({ map: TX.labelTexture(label, { w: Math.round(lw * 800), h: 40, bg: '#3d4249', fg: '#fff', font: 'bold 26px sans-serif' }) }));
    lb.rotation.y = -Math.PI / 2; lb.position.set(-0.009, 0.11, 0); g.add(lb);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.25, 0.3), invisM());
    hit.position.y = 0.025; hit.userData.switch = key; g.add(hit);
    g.position.set(SWITCH_POS.x - 0.008, SWITCH_POS.y + dy, SWITCH_POS.z);
    root.add(g); switches.push({ key, hit, led });
  };
  makeSwitch('light', '조명', 0, 0.16);
  makeSwitch('teach', '교탁 가운데', -0.27, 0.24);
  makeSwitch('general', '일반 수업', -0.54, 0.22);

  for (const [k, geos] of Object.entries(screenGeos)) {
    const m = new THREE.Mesh(mergeGeometries(geos), scrMat[k]); m.name = 'screens_' + k; root.add(m);
  }
  bt.build(root);

  const studentScrMats = studentScreens.map(k => scrMat[k]);
  return { root, colliders, chairs, chairHits, doors, panels, panelMat, coveMat, dlMat, skyMat, skyDay, skyNight, glassMat, corridorMats,
    switches, switchHit: switches[0].hit, switchLed: switches[0].led, lightXs, lightZs,
    monArms, labOnly, genOnly, studentScrMats, teach: { group: teachG, col: teachCol, base: { ...teachCol }, dx: W / 2 - (TEACHER_DESK.x1 + TEACHER_DESK.x2) / 2 } };
}

// 옆면이 열린 책상: 다리 4개 + 상판 아래 테두리 프레임
function deskFrame(bt, M, x1, x2, z1, z2, h) {
  bt.aabb(M.deskTop, x1, x2, h - 0.025, h, z1, z2);
  bt.aabb(M.edge, x1, x2, h - 0.025, h, z2 - 0.002, z2 + 0.002);
  const L = 0.04, i = 0.025, fy = h - 0.025;
  for (const [lx, lz] of [[x1 + i, z1 + i], [x2 - i - L, z1 + i], [x1 + i, z2 - i - L], [x2 - i - L, z2 - i - L]])
    bt.aabb(M.steel, lx, lx + L, 0, fy, lz, lz + L);
  bt.aabb(M.steel, x1 + i, x2 - i, fy - 0.05, fy, z1 + i, z1 + i + 0.02);   // 앞 테두리
  bt.aabb(M.steel, x1 + i, x2 - i, fy - 0.05, fy, z2 - i - 0.02, z2 - i);   // 뒤 테두리
  bt.aabb(M.steel, x1 + i, x1 + i + 0.02, fy - 0.05, fy, z1 + i, z2 - i);   // 옆 테두리
  bt.aabb(M.steel, x2 - i - 0.02, x2 - i, fy - 0.05, fy, z1 + i, z2 - i);
  bt.aabb(M.steelDark, x1 + i, x1 + i + L, 0, 0.012, z1 + i - 0.01, z2 - i + 0.01); // 바닥 받침
  bt.aabb(M.steelDark, x2 - i - L, x2 - i, 0, 0.012, z1 + i - 0.01, z2 - i + 0.01);
}

// 주황 타공 플라스틱 좌판·등판 + 회색 철제 다리 (사진 참고)
function makeChair(bt, M, x, z) {
  const sh = 0.45;
  bt.aabb(M.seat, x - 0.22, x + 0.22, sh, sh + 0.03, z - 0.21, z + 0.21);
  bt.box(M.seat, 0.42, 0.27, 0.02, x, sh + 0.36, z + 0.225, 0, -0.12);  // 등판 (남쪽, 약간 뒤로)
  for (const sx of [-0.18, 0.18]) {
    bt.aabb(M.steel, x + sx - 0.012, x + sx + 0.012, sh - 0.02, sh + 0.24, z + 0.2, z + 0.222); // 등판 지지대
    bt.cyl(M.steel, 0.012, 0.47, x + sx * 1.05, sh / 2, z - 0.18, 8);
    bt.cyl(M.steel, 0.012, 0.47, x + sx * 1.05, sh / 2, z + 0.19, 8);
    bt.aabb(M.steel, x + sx * 1.05 - 0.01, x + sx * 1.05 + 0.01, 0.12, 0.14, z - 0.18, z + 0.19); // 옆 가로대
  }
  bt.aabb(M.steel, x - 0.2, x + 0.2, sh - 0.03, sh, z - 0.19, z - 0.17);
}
