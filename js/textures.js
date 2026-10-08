import * as THREE from 'three';

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// 노출 천장 슬래브: 어두운 도장 콘크리트 + 거푸집 줄눈, 가장자리는 코브 간접조명이 비친 듯 밝게
export function soffitTexture(light = false) {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = light ? '#e3dccd' : '#4a4b4e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) { const a = Math.random() * 0.08; g.fillStyle = Math.random() < .5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 0.6})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 2); }
    g.strokeStyle = light ? 'rgba(0,0,0,.06)' : 'rgba(0,0,0,.18)'; g.lineWidth = 2;
    for (let x = 0; x < w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    const glow = light ? 'rgba(255,240,210,' : 'rgba(255,214,160,';
    for (const [x0, y0, x1, y1] of [[0, 0, 0, 40], [0, h, 0, h - 40], [0, 0, 40, 0], [w, 0, w - 40, 0]]) {
      const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, glow + (light ? '.55)' : '.35)')); gr.addColorStop(1, glow + '0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
  });
}

// 천장형 4방향 카세트 에어컨 패널 (아래에서 본 모습)
export function acCassetteTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#f6f6f4'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d6d6d2'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8);
    // 가운데 흡입 그릴
    g.fillStyle = '#e4e4e0'; g.fillRect(64, 64, 128, 128);
    g.strokeStyle = '#bdbdb8'; g.lineWidth = 2;
    for (let i = 70; i < 192; i += 8) { g.beginPath(); g.moveTo(i, 66); g.lineTo(i, 190); g.stroke(); }
    // 4방향 토출구(루버)
    g.fillStyle = '#4b4d50';
    g.fillRect(52, 22, 152, 18); g.fillRect(52, 216, 152, 18); g.fillRect(22, 52, 18, 152); g.fillRect(216, 52, 18, 152);
    g.fillStyle = '#d9d9d5';
    g.fillRect(52, 29, 152, 4); g.fillRect(52, 223, 152, 4); g.fillRect(29, 52, 4, 152); g.fillRect(223, 52, 4, 152);
  });
}

// 출입문 확보구역 슬래브 (회색 비닐 시트, 1 m 반복)
export function slabTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#7b7c79'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const v = 110 + Math.random() * 50 | 0; g.fillStyle = `rgba(${v},${v},${v - 4},0.35)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
  });
}

// 액세스플로어 600×600 타일
export function floorTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#9aa0a6'; g.fillRect(0, 0, w, h);
    // 카펫 타일 느낌의 노이즈
    for (let i = 0; i < 2600; i++) {
      const v = 140 + Math.random() * 30 | 0;
      g.fillStyle = `rgba(${v},${v + 4},${v + 8},0.35)`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    g.strokeStyle = '#6d7277'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1; g.strokeRect(4, 4, w - 8, h - 8);
  }, [11, 14]);
}

export function hatchTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#b9b2a6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(80,70,60,.35)'; g.lineWidth = 3;
    for (let i = -w; i < w * 2; i += 22) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); }
  }, [2, 2]);
}

export function ceilingTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#eceae4'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
    g.strokeStyle = '#c9c6bd'; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
  }, [11, 14]);
}

export function corkTexture() {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#b98a55'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) { g.fillStyle = Math.random() < .5 ? 'rgba(90,55,25,.35)' : 'rgba(240,200,150,.3)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    const notes = [['#fff8b0', 20, 18], ['#cde8ff', 80, 30], ['#ffd6e0', 150, 16], ['#ffffff', 200, 40], ['#d8f5c8', 40, 70], ['#ffffff', 120, 74]];
    for (const [c, x, y] of notes) { g.fillStyle = c; g.fillRect(x, y, 38, 44); g.fillStyle = 'rgba(0,0,0,.35)'; for (let k = 0; k < 4; k++) g.fillRect(x + 5, y + 8 + k * 8, 26 - k * 3, 2); g.fillStyle = '#d33'; g.beginPath(); g.arc(x + 19, y + 3, 3, 0, 7); g.fill(); }
  });
}

export function skyTexture() {
  return canvasTex(512, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.62, '#f2f2f2'); grd.addColorStop(1, '#d0d0d0');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // 건너편 건물/나무 실루엣 (색은 모드별 tint)
    g.fillStyle = 'rgba(120,120,120,.55)';
    let x = 0; while (x < w) { const bw = 30 + Math.random() * 70, bh = 30 + Math.random() * 70; g.fillRect(x, h - bh - 40, bw, bh + 40); x += bw + 4; }
    g.fillStyle = 'rgba(80,90,80,.7)';
    for (let i = 0; i < 26; i++) { g.beginPath(); g.arc(Math.random() * w, h - 30 + Math.random() * 10, 14 + Math.random() * 16, 0, 7); g.fill(); }
  });
}

export function labelTexture(text, { w = 128, h = 64, bg = '#ffffff', fg = '#222', font = 'bold 40px sans-serif' } = {}) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2);
  });
}

export function dashedTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#d6336c'; g.lineWidth = 5; g.setLineDash([12, 9]); g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#d6336c'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.fillText('19', w / 2, h / 2 - 2);
    g.font = 'bold 18px sans-serif'; g.fillText('예비', w / 2, h / 2 + 26);
  });
}

export function switchTexture() {
  return canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#f7f5ef'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#bbb'; g.lineWidth = 2; g.strokeRect(2, 2, w - 4, h - 4);
    for (let i = 0; i < 2; i++) { g.fillStyle = '#e4e0d6'; g.fillRect(14, 16 + i * 52, 36, 44); g.strokeStyle = '#999'; g.strokeRect(14, 16 + i * 52, 36, 44); g.fillStyle = '#e95420'; g.fillRect(28, 20 + i * 52, 8, 4); }
  });
}

// 밝은 목재 벽 패널 (세로 이음매)
export function woodPanelTexture(repeatX = 1, repeatY = 1) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e3c69a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const y = Math.random() * h; g.strokeStyle = `rgba(${150 + Math.random() * 40 | 0},${115 + Math.random() * 30 | 0},80,${0.08 + Math.random() * 0.1})`;
      g.lineWidth = 1 + Math.random() * 2; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * .3, y + 6, w * .6, y - 6, w, y + 2); g.stroke();
    }
    g.fillStyle = 'rgba(120,90,55,.45)'; g.fillRect(0, 0, 2, h); g.fillRect(w - 2, 0, 2, h);
  }, [repeatX, repeatY]);
}
export function lightWoodTexture() {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#e6d3b3'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { const y = Math.random() * h; g.strokeStyle = `rgba(170,130,85,${0.06 + Math.random() * 0.08})`; g.lineWidth = 1 + Math.random() * 1.5; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * .4, y + 3, w * .7, y - 3, w, y); g.stroke(); }
  });
}
// 주황 타공 플라스틱 의자
export function perforatedTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#e8743b'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7a3415';
    for (let y = 10; y < h; y += 16) for (let x = (y / 16 % 2) * 8 + 8; x < w; x += 16) { g.beginPath(); g.ellipse(x, y, 5, 3, 0, 0, 7); g.fill(); }
  });
}
export function wireMeshTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.clearRect(0, 0, 64, 64);
  g.strokeStyle = '#5a5e64'; g.lineWidth = 3;
  for (let i = 0; i <= 64; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 2); return t;
}
export function nightSkyTexture() {
  return canvasTex(512, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#02040c'); grd.addColorStop(0.7, '#0a1430'); grd.addColorStop(1, '#141c34');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    let x = 0;
    while (x < w) {
      const bw = 30 + Math.random() * 70, bh = 30 + Math.random() * 80, by = h - bh - 40;
      g.fillStyle = '#060912'; g.fillRect(x, by, bw, bh + 40);
      for (let wy = by + 6; wy < h - 40; wy += 9) for (let wx = x + 4; wx < x + bw - 4; wx += 8)
        if (Math.random() < 0.28) { g.fillStyle = Math.random() < .7 ? 'rgba(255,214,140,.9)' : 'rgba(190,220,255,.85)'; g.fillRect(wx, wy, 4, 4); }
      x += bw + 4;
    }
    for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(255,190,110,.9)'; g.beginPath(); g.arc(Math.random() * w, h - 26 + Math.random() * 6, 2, 0, 7); g.fill(); }
  });
}
export function clockTexture() {
  return canvasTex(128, 128, (g, w) => {
    const c = w / 2; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(c, c, 60, 0, 7); g.fill();
    g.lineWidth = 6; g.strokeStyle = '#222'; g.stroke();
    g.fillStyle = '#222'; g.font = 'bold 20px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI * 2; if (i % 3 === 0) g.fillText(String(i), c + Math.sin(a) * 44, c - Math.cos(a) * 44); else g.fillRect(c + Math.sin(a) * 47 - 2, c - Math.cos(a) * 47 - 2, 4, 4); }
    const hand = (a, l, wd) => { g.lineWidth = wd; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.sin(a) * l, c - Math.cos(a) * l); g.stroke(); };
    hand((10 + 24 / 60) / 12 * Math.PI * 2, 28, 5); hand(24 / 60 * Math.PI * 2, 40, 3);
  });
}
export function flagTexture() {
  return canvasTex(192, 128, (g, w, h) => {
    g.fillStyle = '#8a6a45'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(8, 8, w - 16, h - 16);
    const cx = w / 2, cy = h / 2, r = 22;
    g.fillStyle = '#c60c30'; g.beginPath(); g.arc(cx, cy, r, Math.PI, 0); g.fill();
    g.fillStyle = '#003478'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI); g.fill();
    g.fillStyle = '#c60c30'; g.beginPath(); g.arc(cx - r / 2, cy, r / 2, 0, 7); g.fill();
    g.fillStyle = '#003478'; g.beginPath(); g.arc(cx + r / 2, cy, r / 2, 0, 7); g.fill();
    g.fillStyle = '#111';
    const tri = (x, y, rot) => { g.save(); g.translate(x, y); g.rotate(rot); for (let k = -1; k <= 1; k++) g.fillRect(-8, k * 5 - 1.5, 16, 3); g.restore(); };
    tri(cx - 52, cy - 30, -0.98); tri(cx + 52, cy + 30, -0.98); tri(cx + 52, cy - 30, 0.98); tri(cx - 52, cy + 30, 0.98);
  });
}
export function curtainTexture() {
  return canvasTex(128, 64, (g, w, h) => {
    for (let x = 0; x < w; x++) { const v = 150 + Math.sin(x / w * Math.PI * 10) * 28 | 0; g.fillStyle = `rgb(${v},${v},${v - 4})`; g.fillRect(x, 0, 1, h); }
  });
}
export function corridorWallTexture() {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#f1efe9'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#cdb38c'; g.fillRect(0, h * 0.62, w, h * 0.38);
    g.fillStyle = '#9b8466'; g.fillRect(0, h * 0.62, w, 3);
    g.fillStyle = '#b9c7d6'; g.fillRect(w * 0.15, h * 0.12, w * 0.25, h * 0.38); g.fillRect(w * 0.6, h * 0.12, w * 0.25, h * 0.38); // 맞은편 교실 창
    g.strokeStyle = '#eee'; g.lineWidth = 4; g.strokeRect(w * 0.15, h * 0.12, w * 0.25, h * 0.38); g.strokeRect(w * 0.6, h * 0.12, w * 0.25, h * 0.38);
  }, [3, 1]);
}
// 미니PC 윗면: 검은 유광 + 전원 버튼
export function miniPcFaceTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2a2c30'); gr.addColorStop(0.45, '#0c0d0f'); gr.addColorStop(1, '#050506');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#8b8f95'; g.lineWidth = 2; g.beginPath(); g.arc(22, h - 22, 6, 0, 7); g.stroke();
  });
}

// 복도 학생 사물함 앞면 (폭 0.4 m 한 칸 = 2단 문, 환기 슬릿·손잡이·이름표)
export function lockerTexture() {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#9aa3ad'; g.fillRect(0, 0, w, h);
    for (const [y0, y1] of [[4, h / 2 - 2], [h / 2 + 2, h - 4]]) {
      g.fillStyle = '#dfe4ea'; g.fillRect(4, y0, w - 8, y1 - y0);
      g.strokeStyle = '#b5bcc4'; g.lineWidth = 2; g.strokeRect(5, y0 + 1, w - 10, y1 - y0 - 2);
      g.fillStyle = '#aab2bb'; for (let i = 0; i < 4; i++) g.fillRect(24, y0 + 12 + i * 7, 48, 3);   // 환기 슬릿
      g.fillStyle = '#ffffff'; g.fillRect(24, y0 + 46, 40, 14); g.strokeStyle = '#c3c8ce'; g.strokeRect(24, y0 + 46, 40, 14); // 이름표
      g.fillStyle = '#4a4f56'; g.fillRect(w - 26, y0 + (y1 - y0) / 2 - 14, 8, 28);                 // 손잡이
      g.fillStyle = '#2f3338'; g.beginPath(); g.arc(w - 40, y0 + (y1 - y0) / 2, 4, 0, 7); g.fill(); // 열쇠 구멍 (손잡이 옆)
    }
  }, [1, 1]);
}
// 아이보리 평판 벽 패널 (세로 이음매)
export function creamPanelTexture(rx = 1) {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#ece5d3'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(0,0,0,.025)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = 'rgba(120,110,90,.55)'; g.fillRect(0, 0, 2, h);
    g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(2, 0, 1, h);
  }, [rx, 1]);
}
export function dellLogoTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#141518'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9ccd1'; g.lineWidth = 3; g.beginPath(); g.arc(32, 32, 27, 0, 7); g.stroke();
    g.fillStyle = '#d4d7dc'; g.font = 'bold 15px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('DELL', 32, 33);
  });
}

// 멀티탭(전면): 흰 몸체 + 한국형 둥근 콘센트 4구 + 빨간 스위치
export function powerStripTexture() {
  return canvasTex(256, 48, (g, w, h) => {
    g.fillStyle = '#f2f2ef'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9c9c4'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
    g.fillStyle = '#d8262c'; g.fillRect(10, 14, 22, 20); g.fillStyle = '#ff8a8a'; g.fillRect(13, 16, 16, 5);
    for (let i = 0; i < 4; i++) {
      const cx = 66 + i * 50, cy = h / 2;
      g.fillStyle = '#e2e2dd'; g.beginPath(); g.arc(cx, cy, 17, 0, 7); g.fill(); g.strokeStyle = '#b8b8b2'; g.stroke();
      g.fillStyle = '#3a3a3a'; g.beginPath(); g.arc(cx - 7, cy, 3.6, 0, 7); g.arc(cx + 7, cy, 3.6, 0, 7); g.fill();
      g.fillStyle = '#9a9a94'; g.fillRect(cx - 2, cy - 16, 4, 4); g.fillRect(cx - 2, cy + 12, 4, 4);   // 접지 클립
    }
  });
}
// 펼친 책 한 면 (본문 줄 + 그림 상자 + 쪽 번호), 가운데(제본) 쪽 그림자
export function bookPageTexture(seed = 1) {
  let s = seed * 9301 + 49297; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return canvasTex(256, 192, (g, w, h) => {
    g.fillStyle = '#fbf9f2'; g.fillRect(0, 0, w, h);
    for (const [x0, flip] of [[0, false], [w / 2, true]]) {
      g.fillStyle = '#2b2b2b'; g.fillRect(x0 + 14, 12, 60 + r() * 30, 6);
      const fig = r() < 0.6, fy = 30 + (r() * 60 | 0);
      for (let y = 28; y < h - 18; y += 7) {
        if (fig && y > fy && y < fy + 44) continue;
        g.fillStyle = 'rgba(60,60,60,.55)'; g.fillRect(x0 + 14, y, w / 2 - 28 - (r() < 0.15 ? r() * 40 : 0), 2.4);
      }
      if (fig) { g.fillStyle = ['#bcd6ef', '#f3d3a8', '#cfe8c5'][r() * 3 | 0]; g.fillRect(x0 + 22, fy + 4, w / 2 - 44, 36); g.strokeStyle = '#8a9aa8'; g.strokeRect(x0 + 22, fy + 4, w / 2 - 44, 36); }
      g.fillStyle = '#777'; g.font = '9px sans-serif'; g.fillText(String(20 + (seed * 2 % 180) + (flip ? 1 : 0)), flip ? x0 + w / 2 - 22 : x0 + 12, h - 6);
    }
    const sh = g.createLinearGradient(w / 2 - 18, 0, w / 2 + 18, 0);
    sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(0.5, 'rgba(0,0,0,.22)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh; g.fillRect(w / 2 - 18, 0, 36, h);
  });
}
// 노트북 화면 (문서 편집 화면)
export function laptopScreenTexture() {
  return canvasTex(256, 160, (g, w, h) => {
    g.fillStyle = '#e9edf2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2b5797'; g.fillRect(0, 0, w, 16); g.fillStyle = '#f5f7fa'; g.fillRect(0, 16, w, 14);
    g.fillStyle = '#ffffff'; g.fillRect(48, 36, w - 96, h - 40);
    g.fillStyle = '#333'; g.fillRect(60, 46, 90, 6);
    for (let y = 60; y < h - 10; y += 8) { g.fillStyle = 'rgba(70,70,70,.6)'; g.fillRect(60, y, w - 120 - (y % 24 === 0 ? 40 : 0), 2.5); }
  });
}
// 공기청정기 앞 위쪽 표시창: 파란 링 + 미세먼지 수치
export function purifierDisplayTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#16181c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#3f8cff'; g.lineWidth = 7; g.beginPath(); g.arc(w / 2, 54, 34, 0, 7); g.stroke();
    g.fillStyle = '#d9ecff'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.fillText('12', w / 2, 62);
    g.font = 'bold 13px sans-serif'; g.fillStyle = '#7fb4ff'; g.fillText('PM2.5 좋음', w / 2, 112);
  });
}
// 아이패드 뒷면/가장자리가 보이는 케이스 색 (충전함 안) — 단색이라 텍스처 없음
