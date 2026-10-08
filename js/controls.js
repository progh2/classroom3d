import * as THREE from 'three';
import { ROOM, PITS, RAISE, CORRIDOR, EAST_WALL_T, LOCKER_D } from './plan.js';

// 1인칭 이동: PointerLock + WASD/방향키 (데스크톱), 가상 조이스틱 + 드래그 시점 (터치)
export class FPControls {
  constructor(camera, dom, colliders, opts = {}) {
    this.camera = camera; this.dom = dom; this.colliders = colliders;
    this.eye = opts.eye ?? 1.6; this.radius = 0.22;
    this.standEye = 1.6; this.lowEye = 1.15; this.eyeTarget = this.eye;  // C: 웅크려 앉기(눈높이 1.15)
    this.crouched = false; this.seated = null;                           // seated: 앉은 의자 (이동 잠금)
    this.passages = []; this.dynColliders = [];                                                  // 열린 문 통로 (main.js가 갱신)
    this.onSeatedMove = null;
    this.yaw = opts.yaw ?? 0; this.pitch = opts.pitch ?? 0;
    this.pos = new THREE.Vector3(opts.x ?? 0, 0, opts.z ?? 0);
    this.fy = this.floorAt(this.pos.x, this.pos.z); // 현재 발 높이 (단차를 부드럽게 오르내림)
    this.keys = new Set(); this.locked = false;
    this.joy = { id: null, x: 0, y: 0, cx: 0, cy: 0 };
    this.look = { id: null, x: 0, y: 0, sx: 0, sy: 0, moved: false, t: 0 };
    this.onTap = null; this.onLockChange = null;
    camera.rotation.order = 'YXZ';
    this._bind();
    this.apply();
  }
  _bind() {
    const d = this.dom;
    document.addEventListener('keydown', e => { this.keys.add(e.code); if (e.code.startsWith('Arrow')) e.preventDefault(); });
    document.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === d; this.onLockChange?.(this.locked); });
    document.addEventListener('mousemove', e => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0022; this.pitch -= e.movementY * 0.0022; this.clampPitch();
    });
    const joyEl = document.getElementById('joy'), knob = document.getElementById('joyKnob');
    d.addEventListener('touchstart', e => {
      for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth * 0.45 && this.joy.id === null) {
          this.joy.id = t.identifier; this.joy.cx = t.clientX; this.joy.cy = t.clientY; this.joy.x = this.joy.y = 0;
          joyEl.style.left = (t.clientX - 65) + 'px'; joyEl.style.top = (t.clientY - 65) + 'px'; joyEl.style.bottom = 'auto';
        } else if (this.look.id === null) {
          Object.assign(this.look, { id: t.identifier, x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY, moved: false, t: e.timeStamp });
        }
      }
      e.preventDefault();
    }, { passive: false });
    d.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) {
          let dx = t.clientX - this.joy.cx, dy = t.clientY - this.joy.cy; const m = Math.hypot(dx, dy), R = 55;
          if (m > R) { dx *= R / m; dy *= R / m; }
          this.joy.x = dx / R; this.joy.y = dy / R;
          knob.style.transform = `translate(${dx}px,${dy}px)`;
        } else if (t.identifier === this.look.id) {
          const dx = t.clientX - this.look.x, dy = t.clientY - this.look.y;
          this.look.x = t.clientX; this.look.y = t.clientY;
          if (Math.hypot(t.clientX - this.look.sx, t.clientY - this.look.sy) > 8) this.look.moved = true;
          this.yaw -= dx * 0.005; this.pitch -= dy * 0.005; this.clampPitch();
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) {
          this.joy.id = null; this.joy.x = this.joy.y = 0; knob.style.transform = '';
          joyEl.style.left = ''; joyEl.style.top = ''; joyEl.style.bottom = '';
        } else if (t.identifier === this.look.id) {
          if (!this.look.moved && e.timeStamp - this.look.t < 450) this.onTap?.(t.clientX, t.clientY);
          this.look.id = null;
        }
      }
    };
    d.addEventListener('touchend', end); d.addEventListener('touchcancel', end);
  }
  lock() { if (this.dom.requestPointerLock) { try { const p = this.dom.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} } }
  clampPitch() { this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch)); }
  update(dt) {
    let f = 0, s = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) s += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) s -= 1;
    f -= this.joy.y; s += this.joy.x;
    if (this.seated) {                                    // 앉아 있는 동안 이동 잠금 (조이스틱을 크게 밀면 일어남)
      if (Math.hypot(this.joy.x, this.joy.y) > 0.6) this.onSeatedMove?.();
      f = s = 0;
    }
    const len = Math.hypot(f, s);
    if (len > 1) { f /= len; s /= len; }
    const speed = (k.has('ShiftLeft') || k.has('ShiftRight')) ? 3.0 : 1.6;
    if (len > 0.01) {
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      this.move((-sin * f + cos * s) * speed * dt, (-cos * f - sin * s) * speed * dt);
    }
    this.eye += (this.eyeTarget - this.eye) * Math.min(1, dt * 8);
    if (Math.abs(this.eyeTarget - this.eye) < 0.002) this.eye = this.eyeTarget;
    const tf = this.seated ? 0 : this.floorAt(this.pos.x, this.pos.z);
    this.fy += (tf - this.fy) * Math.min(1, dt * 9);
    if (Math.abs(tf - this.fy) < 0.002) this.fy = tf;
    this.apply();
  }
  // 액세스플로어(+0.2 → y 0) / 출입문 확보구역(슬래브, y -0.2)
  floorAt(x, z) {
    if (x > ROOM.W) return -RAISE;                       // 문 통로·복도 = 슬래브 레벨
    for (const d of PITS) if (x > d.x1 && x < d.x2 && z > d.z1 && z < d.z2) return -RAISE;
    return 0;
  }
  // 걸을 수 있는 영역: 교실 + 복도(양 끝 벽, 맞은편 창대 앞까지) + 열린 문 통로
  walkable(x, z) {
    const r = this.radius, C = CORRIDOR, cx1 = ROOM.W + EAST_WALL_T;
    if (x >= r && x <= ROOM.W - r && z >= r && z <= ROOM.D - r) return true;
    if (x >= cx1 + r && x <= C.x2 - 0.1 - r && z >= C.z1 + r && z <= C.z2 - r) return true;   // 복도 (사물함은 교실 쪽 벽 → room 충돌 상자, 맞은편 창대 0.1 m)
    for (const p of this.passages) if (x >= ROOM.W - r - 0.02 && x <= cx1 + r + 0.02 && z >= p.z1 + r && z <= p.z2 - r) return true;
    return false;
  }
  blocked(x, z) {
    const r = this.radius;
    if (!this.walkable(x, z)) return true;
    for (const c of this.colliders) if (x > c.x1 - r && x < c.x2 + r && z > c.z1 - r && z < c.z2 + r) return true;
    for (const c of this.dynColliders) if (x > c.x1 - r && x < c.x2 + r && z > c.z1 - r && z < c.z2 + r) return true;
    return false;
  }
  move(dx, dz) {
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.05) || 1;
    // 이미 무언가(예: 막 열린 문짝)에 겹쳐 있으면 걸을 수 있는 영역 안에서는 빠져나갈 수 있게
    const ok = (x, z) => this.blocked(this.pos.x, this.pos.z) ? this.walkable(x, z) : !this.blocked(x, z);
    for (let i = 0; i < steps; i++) {
      const nx = this.pos.x + dx / steps; if (ok(nx, this.pos.z)) this.pos.x = nx;
      const nz = this.pos.z + dz / steps; if (ok(this.pos.x, nz)) this.pos.z = nz;
    }
  }
  apply() {
    this.camera.position.set(this.pos.x, this.fy + this.eye, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
  set(x, z, yaw, pitch = 0, eye) { this.pos.set(x, 0, z); this.fy = this.floorAt(x, z); this.yaw = yaw; this.pitch = pitch; if (eye) this.eye = this.eyeTarget = eye; this.apply(); }
  // C: 웅크려 앉기 ↔ 서기
  toggleCrouch() { this.crouched = !this.crouched; this.eyeTarget = this.crouched ? this.lowEye : this.standEye; }
  // 의자에 앉기: 의자 위 학생 눈높이(올린 바닥 + 1.15 m), 책상·모니터·앞벽을 향함
  sit(chair) {
    this.seated = chair; this.crouched = false;
    this.pos.set(chair.x, 0, chair.z + 0.04); this.fy = 0;
    this.eyeTarget = this.lowEye; this.yaw = 0; this.pitch = -0.12;
    this.keys.clear(); this.apply();
  }
  // 일어나기: 의자 옆 빈 자리로
  stand() {
    const c = this.seated; if (!c) return;
    this.seated = null; this.eyeTarget = this.standEye;
    for (const [dx, dz] of [[0.5, 0], [-0.5, 0], [0, 0.55], [0.6, 0.3], [-0.6, 0.3]]) {
      if (!this.blocked(c.x + dx, c.z + dz)) { this.pos.set(c.x + dx, 0, c.z + dz); break; }
    }
    this.fy = this.floorAt(this.pos.x, this.pos.z); this.apply();
  }
}
