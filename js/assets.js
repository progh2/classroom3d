// 에셋 경로 해석: 단일 HTML(오프라인, file://) 빌드에서는 <script type="text/plain" data-asset="경로"> 안에
// base64로 내장된 파일을 꺼내 쓰고, 일반 폴더 버전에서는 원래 상대 경로를 그대로 씀.
const cache = new Map();
const tag = p => document.querySelector(`script[data-asset="${p}"]`);
export const isEmbedded = () => !!document.querySelector('script[data-asset]');
export const hasAsset = p => !isEmbedded() || !!tag(p) || cache.has(p);
export function assetURL(p) {
  if (cache.has(p)) return cache.get(p);
  const el = tag(p);
  if (!el) return p;
  const b64 = el.textContent.replace(/\s+/g, '');
  let url;
  if (p.endsWith('.png')) url = 'data:image/png;base64,' + b64;          // 이미지: data URL (file://에서도 캔버스 오염 없음)
  else {                                                                  // VRM(GLB): Blob URL → fetch 가능
    const bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    url = URL.createObjectURL(new Blob([u8], { type: 'model/gltf-binary' }));
  }
  el.remove();
  cache.set(p, url);
  return url;
}
