import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export type OcularResult = {
  hirschbergMM: number | null;
  hirschbergPD: number | null;
  mrd1MM: number | null;
  hvidODpx: number | null;
  hvidOSpx: number | null;
  landmarks: any[];
  irisCenters: { od: { x: number; y: number }; os: { x: number; y: number } } | null;
  reflexPoints: { od: { x: number; y: number }; os: { x: number; y: number } } | null;
};

let landmarker: FaceLandmarker | null = null;

export async function loadFaceLandmarker(): Promise<FaceLandmarker | null> {
  if (typeof WebGLRenderingContext === 'undefined') return null;
  try {
    if ('serviceWorker' in navigator) {
      const sw = `self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.href.includes('mediapipe')||u.href.includes('wasm')){e.respondWith(caches.open('mediapipe').then(c=>c.match(e.request).then(r=>r||fetch(e.request).then(resp=>{c.put(e.request,resp.clone());return resp})))}});self.addEventListener('install',e=>self.skipWaiting());self.addEventListener('activate',e=>self.clients.claim());`;
      const blob = new Blob([sw], { type: 'application/javascript' });
      try { await navigator.serviceWorker.register(URL.createObjectURL(blob)); } catch {}
    }
    const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm');
    landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task' },
      numFaces: 1,
      runningMode: 'VIDEO',
      outputFaceBlendshapes: false
    });
    return landmarker;
  } catch {
    landmarker = null;
    return null;
  }
}

function getSize(source: ImageBitmap | HTMLVideoElement | HTMLCanvasElement) {
  if (source instanceof HTMLVideoElement) return { w: source.videoWidth || source.width, h: source.videoHeight || source.height };
  if (source instanceof HTMLCanvasElement) return { w: source.width, h: source.height };
  return { w: source.width, h: source.height };
}

function drawToCanvas(source: ImageBitmap | HTMLVideoElement | HTMLCanvasElement, w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.drawImage(source as any, 0, 0, w, h);
  return canvas;
}

function findBrightestInCircle(imgData: ImageData, cx: number, cy: number, radius: number) {
  const data = imgData.data;
  const w = imgData.width;
  const r2 = radius * radius;
  let best = -1;
  let bx = cx;
  let by = cy;
  const r = Math.max(0, Math.floor(radius));
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(w - 1, Math.ceil(cx + r));
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(imgData.height - 1, Math.ceil(cy + r)); y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r2) continue;
      const i = (y * w + x) * 4;
      const br = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (br > best) { best = br; bx = x; by = y; }
    }
  }
  return { x: bx, y: by };
}

export async function analyzeFrame(
  source: ImageBitmap | HTMLVideoElement | HTMLCanvasElement,
  lm?: FaceLandmarker,
  ts?: number
): Promise<OcularResult> {
  const detector = lm ?? landmarker;
  if (!detector) return { hirschbergMM: null, hirschbergPD: null, mrd1MM: null, hvidODpx: null, hvidOSpx: null, landmarks: [], irisCenters: null, reflexPoints: null };
  const { w, h } = getSize(source);
  if (!w || !h) return { hirschbergMM: null, hirschbergPD: null, mrd1MM: null, hvidODpx: null, hvidOSpx: null, landmarks: [], irisCenters: null, reflexPoints: null };
  let result;
  try {
    if (source instanceof HTMLVideoElement) {
      result = detector.detectForVideo(source, ts ?? performance.now());
    } else {
      const canvas = drawToCanvas(source, w, h);
      result = (detector as any).detectForImage ? (detector as any).detectForImage(canvas) : detector.detectForVideo(canvas, ts ?? performance.now());
    }
  } catch {
    return { hirschbergMM: null, hirschbergPD: null, mrd1MM: null, hvidODpx: null, hvidOSpx: null, landmarks: [], irisCenters: null, reflexPoints: null };
  }
  const lmArr = result.faceLandmarks?.[0] ?? [];
  if (!lmArr.length) return { hirschbergMM: null, hirschbergPD: null, mrd1MM: null, hvidODpx: null, hvidOSpx: null, landmarks: [], irisCenters: null, reflexPoints: null };
  const px = (i: number) => ({ x: lmArr[i].x * w, y: lmArr[i].y * h });
  const hvidODpx = Math.hypot(px(469).x - px(471).x, px(469).y - px(471).y);
  const hvidOSpx = Math.hypot(px(474).x - px(476).x, px(474).y - px(476).y);
  const meanHVID = (hvidODpx + hvidOSpx) / 2;
  if (meanHVID <= 0) return { hirschbergMM: null, hirschbergPD: null, mrd1MM: null, hvidODpx, hvidOSpx, landmarks: lmArr, irisCenters: null, reflexPoints: null };
  const mmPerPx = 11.7 / meanHVID;
  const odCenter = px(468);
  const osCenter = px(473);
  const mrd1OD = (odCenter.y - px(159).y) * mmPerPx;
  const mrd1OS = (osCenter.y - px(386).y) * mmPerPx;
  const mrd1MM = (mrd1OD + mrd1OS) / 2;
  const canvasImg = drawToCanvas(source, w, h);
  const ctx = canvasImg.getContext('2d');
  const imgData = ctx ? ctx.getImageData(0, 0, w, h) : null;
  let reflexPoints: { od: { x: number; y: number }; os: { x: number; y: number } } | null = null;
  let hirschbergMM: number | null = null;
  let hirschbergPD: number | null = null;
  if (imgData) {
    const radOD = 0.45 * hvidODpx;
    const radOS = 0.45 * hvidOSpx;
    const refOD = findBrightestInCircle(imgData, odCenter.x, odCenter.y, radOD);
    const refOS = findBrightestInCircle(imgData, osCenter.x, osCenter.y, radOS);
    reflexPoints = { od: refOD, os: refOS };
    const offsetPx = refOD.x - odCenter.x;
    const offsetMM = offsetPx * mmPerPx;
    hirschbergMM = offsetMM;
    hirschbergPD = offsetMM * 15;
  }
  return {
    hirschbergMM,
    hirschbergPD,
    mrd1MM,
    hvidODpx,
    hvidOSpx,
    landmarks: lmArr,
    irisCenters: { od: odCenter, os: osCenter },
    reflexPoints
  };
}
