import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { TEACHER_SPOT, DESK_H } from './plan.js';
import { assetURL, hasAsset } from './assets.js';

// CC0 (Polygonal Mind 100Avatars) — CREDITS.md 참고
// 기본: VRoid 공식 CC0 애니풍 모델 (HairSample_Female / HairSample_Male) — 상의 색만 바꿔 다양화
const CAST_ANIME = [
  { file: 'HairSample_Female.vrm', desk: 2, height: 1.62, tops: '#ffffff' },
  { file: 'HairSample_Male.vrm', desk: 3, height: 1.72, tops: '#9aa3ad' },
  { file: 'HairSample_Female.vrm', desk: 6, height: 1.60, tops: '#b9c9e6' },
  { file: 'HairSample_Male.vrm', desk: 8, height: 1.74, tops: '#3a4560' },
  { file: 'HairSample_Female.vrm', desk: 9, height: 1.63, tops: '#e8d9bf' },
  { file: 'HairSample_Male.vrm', desk: 11, height: 1.70, tops: '#ffffff' },
  { file: 'HairSample_Female.vrm', desk: 14, height: 1.61, tops: '#c9c9cc' },
  { file: 'HairSample_Male.vrm', desk: 17, height: 1.71, tops: '#7d8f7a' },
  { file: 'HairSample_Male.vrm', teacher: true, height: 1.78, tops: '#2b3140', bottoms: '#3a3a40' },
];
// ?cast=lowpoly : Polygonal Mind 100Avatars (CC0) 로 교체
const CAST_LOWPOLY = [
  { file: 'Kate.vrm', desk: 2, height: 1.62 }, { file: 'Kyle.vrm', desk: 3, height: 1.72 },
  { file: 'Shiro.vrm', desk: 6, height: 1.60 }, { file: 'Pepo.vrm', desk: 8, height: 1.74 },
  { file: 'Lydia.vrm', desk: 9, height: 1.64 }, { file: 'Erika.vrm', desk: 11, height: 1.62 },
  { file: 'Samuela.vrm', desk: 14, height: 1.63 }, { file: 'Rose.vrm', desk: 17, height: 1.60 },
  { file: 'Bizdude.vrm', teacher: true, height: 1.76 },
];
// 단일 HTML 오프라인 빌드에는 애니 출연진만 내장 → lowpoly 파일이 없으면 기본 출연진으로
export const CAST = new URLSearchParams(location.search).get('cast') === 'lowpoly' && hasAsset('assets/vrm/' + CAST_LOWPOLY[0].file) ? CAST_LOWPOLY : CAST_ANIME;

const SEAT_TOP = 0.48; // 의자 좌판 상면
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

function bone(vrm, name) { return vrm.humanoid.getNormalizedBoneNode(name); }
function wpos(o, out = new THREE.Vector3()) { o.updateWorldMatrix(true, false); return o.getWorldPosition(out); }

// 뼈(bone)가 자식 방향으로 worldDir 을 가리키도록 회전 (월드 기준 최소 회전)
function aim(b, child, worldDir) {
  if (!b || !child) return;
  b.updateWorldMatrix(true, true);
  const p = wpos(b, _a.clone()), c = wpos(child, _b.clone());
  const cur = c.sub(p).normalize();
  const dq = new THREE.Quaternion().setFromUnitVectors(cur, worldDir.clone().normalize());
  const bw = b.getWorldQuaternion(new THREE.Quaternion());
  const target = dq.multiply(bw);
  const pw = b.parent.getWorldQuaternion(new THREE.Quaternion());
  b.quaternion.copy(pw.invert().multiply(target));
  b.updateWorldMatrix(false, true);
}

// 캐릭터 기준 방향 (그룹 회전 전: 정면 F, 위 U, 왼쪽 L)
function frame(vrm) {
  const lu = wpos(bone(vrm, 'leftUpperArm')), ru = wpos(bone(vrm, 'rightUpperArm'));
  const L = V(Math.sign(lu.x - ru.x) || 1, 0, 0);
  const U = V(0, 1, 0);
  const F = new THREE.Vector3().crossVectors(L, U).normalize(); // 왼쪽 × 위 = 정면
  return { F, U, L };
}
const comb = (fr, f, u, l) => fr.F.clone().multiplyScalar(f).add(fr.U.clone().multiplyScalar(u)).add(fr.L.clone().multiplyScalar(l)).normalize();

function seatedPose(vrm, fr, legJointY, rnd) {
  const { F } = fr;
  const hips = bone(vrm, 'hips');
  // 다리 길이 측정
  const lup = wpos(bone(vrm, 'leftUpperLeg')), llo = wpos(bone(vrm, 'leftLowerLeg')), lft = wpos(bone(vrm, 'leftFoot'));
  const Lup = lup.distanceTo(llo), Llo = llo.distanceTo(lft);
  // 발목 높이 0.08 에 맞도록 정강이 기울기·허벅지 각도 결정
  const ankleY = 0.085;
  let shinTilt = 0.18; // 앞으로 기울기 (rad)
  let kneeY = ankleY + Llo * Math.cos(shinTilt);
  if (kneeY > legJointY + 0.12) { kneeY = legJointY + 0.12; shinTilt = Math.acos(Math.min(1, (kneeY - ankleY) / Llo)); }
  const dy = Math.max(-Lup * 0.6, Math.min(Lup * 0.6, kneeY - legJointY));
  const thighF = Math.sqrt(Math.max(0, Lup * Lup - dy * dy));
  for (const side of ['left', 'right']) {
    const s = side === 'left' ? 1 : -1;
    aim(bone(vrm, side + 'UpperLeg'), bone(vrm, side + 'LowerLeg'), comb(fr, thighF, dy, 0.07 * s * Lup));
    aim(bone(vrm, side + 'LowerLeg'), bone(vrm, side + 'Foot'), comb(fr, Math.sin(shinTilt), -Math.cos(shinTilt), 0.02 * s));
    const toes = bone(vrm, side + 'Toes');
    if (toes) aim(bone(vrm, side + 'Foot'), toes, comb(fr, 1, -0.15, 0));
  }
  // 상체: 살짝 앞으로
  const spine = bone(vrm, 'spine'), chest = bone(vrm, 'chest') || bone(vrm, 'upperChest');
  if (spine && chest) aim(spine, chest, comb(fr, 0.12 + rnd * 0.06, 1, 0));
  const neck = bone(vrm, 'neck'), head = bone(vrm, 'head');
  if (neck && head) aim(neck, head, comb(fr, 0.16, 1, 0));
  // 팔: 팔꿈치는 몸 옆, 전완은 키보드 쪽
  for (const side of ['left', 'right']) {
    const s = side === 'left' ? 1 : -1;
    aim(bone(vrm, side + 'UpperArm'), bone(vrm, side + 'LowerArm'), comb(fr, 0.42, -0.86, 0.2 * s));
    aim(bone(vrm, side + 'LowerArm'), bone(vrm, side + 'Hand'), comb(fr, 1, 0.12, -0.32 * s));
    const mid = bone(vrm, side + 'MiddleProximal');
    if (mid) aim(bone(vrm, side + 'Hand'), mid, comb(fr, 1, -0.25, -0.12 * s));
  }
}

function standingPose(vrm, fr) {
  for (const side of ['left', 'right']) {
    const s = side === 'left' ? 1 : -1;
    aim(bone(vrm, side + 'UpperArm'), bone(vrm, side + 'LowerArm'), comb(fr, 0.3, -0.95, 0.14 * s));
    aim(bone(vrm, side + 'LowerArm'), bone(vrm, side + 'Hand'), comb(fr, 1, -0.35, -0.12 * s));
    const mid = bone(vrm, side + 'MiddleProximal');
    if (mid) aim(bone(vrm, side + 'Hand'), mid, comb(fr, 1, -0.5, -0.05 * s));
  }
  const spine = bone(vrm, 'spine'), chest = bone(vrm, 'chest') || bone(vrm, 'upperChest');
  if (spine && chest) aim(spine, chest, comb(fr, 0.06, 1, 0));
}

export async function loadCast(scene, chairs, base, onProgress, camera) {
  const loader = new GLTFLoader();
  loader.register(p => new VRMLoaderPlugin(p));
  const actors = [];
  let done = 0;
  const jobs = CAST.map(async (c, i) => {
    let gltf;
    try { gltf = await loader.loadAsync(assetURL(base + c.file)); }
    catch (e) { console.warn('VRM load failed', c.file, e); onProgress(++done, CAST.length, c.file); return; }
    const vrm = gltf.userData.vrm;
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    VRMUtils.rotateVRM0(vrm); // VRM0 → +Z 정면
    vrm.scene.traverse(o => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        const tint = /Tops/i.test(m.name) ? c.tops : /Bottoms/i.test(m.name) ? c.bottoms : null;
        if (!tint) continue;
        const col = new THREE.Color(tint);
        if (m.color) m.color.copy(col);
        if (m.shadeColorFactor) m.shadeColorFactor.copy(col).multiplyScalar(0.72);
      }
    });

    const g = new THREE.Group(); g.name = 'actor_' + c.file; g.add(vrm.scene); scene.add(g);
    // 키 맞추기 (머리 뼈 높이 기준)
    g.updateMatrixWorld(true);
    const headY = wpos(bone(vrm, 'head')).y;
    const s = c.height / (headY * 1.12);
    g.scale.setScalar(s); g.updateMatrixWorld(true);
    const fr = frame(vrm);
    const rnd = (i * 0.37) % 1;

    if (c.teacher) {
      standingPose(vrm, fr);
      g.rotation.y = fr.F.z > 0 ? 0 : Math.PI; // 남쪽(학생 쪽) 바라봄
      g.position.set(TEACHER_SPOT.x, 0, TEACHER_SPOT.z);
      g.updateMatrixWorld(true);
      // 발바닥을 바닥에
      const fy = Math.min(wpos(bone(vrm, 'leftFoot')).y, wpos(bone(vrm, 'rightFoot')).y);
      g.position.y += 0.08 - fy;
      if (vrm.lookAt && camera) vrm.lookAt.target = camera;
    } else {
      const ch = chairs.find(x => x.n === c.desk);
      const legJointY = SEAT_TOP + 0.075;
      // 고관절 높이 기준 배치 (포즈 전 고관절~힙 오프셋 측정)
      const hip0 = wpos(bone(vrm, 'hips')), lj0 = wpos(bone(vrm, 'leftUpperLeg'));
      const hipAboveJoint = hip0.y - lj0.y;
      // 일단 원점에서 포즈 (그룹 회전 0, 높이는 목표 높이로)
      g.position.set(0, 0, 0); g.updateMatrixWorld(true);
      g.position.y = legJointY + hipAboveJoint - hip0.y; g.updateMatrixWorld(true);
      seatedPose(vrm, fr, legJointY, rnd);
      // 북쪽(-z)을 보도록 회전 후 의자 위치로
      g.rotation.y = fr.F.z > 0 ? Math.PI : 0;
      g.updateMatrixWorld(true);
      const hp = wpos(bone(vrm, 'hips'));
      g.position.x += ch.x - hp.x;
      g.position.z += (ch.z + 0.02) - hp.z;
      g.updateMatrixWorld(true);
    }
    // 아이들(호흡·고개) 기준값 저장
    const idle = {};
    for (const n of ['spine', 'chest', 'neck', 'head']) { const b = bone(vrm, n); if (b) idle[n] = b.quaternion.clone(); }
    vrm.update(0);
    vrm.springBoneManager?.reset?.();
    actors.push({ vrm, group: g, cfg: c, idle, phase: i * 1.7, teacher: !!c.teacher });
    onProgress(++done, CAST.length, c.file);
  });
  await Promise.all(jobs);
  return actors;
}

const _e = new THREE.Euler();
export function updateActors(actors, t, dt) {
  for (const a of actors) {
    const { vrm, idle, phase } = a;
    const br = Math.sin(t * 1.6 + phase) * 0.012;
    if (idle.chest) bone(vrm, 'chest').quaternion.copy(idle.chest).multiply(_q.setFromEuler(_e.set(-br, 0, 0)));
    else if (idle.spine) bone(vrm, 'spine').quaternion.copy(idle.spine).multiply(_q.setFromEuler(_e.set(-br, 0, 0)));
    if (idle.head) {
      const yaw = a.teacher ? Math.sin(t * 0.35 + phase) * 0.35 : Math.sin(t * 0.23 + phase) * 0.06 + Math.sin(t * 0.9 + phase * 2) * 0.015;
      const pitch = a.teacher ? 0.02 : Math.sin(t * 0.31 + phase) * 0.03;
      bone(vrm, 'head').quaternion.copy(idle.head).multiply(_q.setFromEuler(_e.set(pitch, yaw, 0)));
    }
    vrm.update(dt);
  }
}

export function actorColliders(actors) {
  return actors.filter(a => a.teacher).map(a => ({ x1: a.group.position.x - 0.25, x2: a.group.position.x + 0.25, z1: a.group.position.z - 0.22, z2: a.group.position.z + 0.22 }));
}
