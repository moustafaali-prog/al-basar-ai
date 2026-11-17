/**
 * Client-side ophthalmic image quality + geometric normalization helpers.
 *
 * Everything in this module is pure Canvas / local math:
 * no network requests, no cloud APIs, no external npm dependencies.
 * It powers the "high-precision" capture gate (blur + glare), the HVID
 * normalization of the Hirschberg reflex offset, and the human-in-the-loop
 * visual audit HUD in `OcularBiometryStation.tsx`.
 */

/* ------------------------------------------------------------------ *
 * Canonical geometry
 * ------------------------------------------------------------------ */

/** Analysis frame used for every pixel operation (matches the alignment SVG). */
export const ANALYSIS_WIDTH = 600;
export const ANALYSIS_HEIGHT = 300;

/** Eye regions of interest inside the analysis frame. */
export const EYE_ROI = {
  OD: { cx: 210, cy: 150, rx: 98, ry: 58 },
  OS: { cx: 390, cy: 150, rx: 98, ry: 58 },
} as const;

export type EyeKey = keyof typeof EYE_ROI;

/** Pediatric reference horizontal visible iris diameter (mean for Iraqi school children). */
export const STANDARD_PEDIATRIC_HVID_MM = 11.7;

/** Framing fallback: the reference frame width in pixels when HVID cannot be measured. */
export const FALLBACK_HVID_PX = 60;

/** Physiological corneal angle-kappa offset that must be removed before differencing eyes. */
export const ANGLE_KAPPA_ADJUSTMENT_MM = 0.5;

/** Hirschberg conversion used by this model (approximate, not a definitive measurement). */
export const PRISM_DIOPTERS_PER_MM = 15;

/** Clinically admissible pediatric ranges enforced before a record can be committed. */
export const HIRSCHBERG_LIMITS = { min: 0, max: 3 } as const;
export const MRD1_LIMITS = { min: 0.5, max: 6 } as const;

/* ------------------------------------------------------------------ *
 * Quality-gate thresholds
 * ------------------------------------------------------------------ */

/** A pixel is considered hyper-saturated (specular glare) when all channels exceed this. */
export const SATURATION_THRESHOLD = 245;

/** Glare is confirmed when saturated pixels span more than this share of the pupil disc. */
export const GLARE_SPAN_THRESHOLD = 0.3;

/** Minimum normalized Laplacian variance (0..1 luminance) for an acceptably sharp frame. */
export const LAPLACIAN_VARIANCE_MIN = 0.0016;

/** Minimum normalized luminance standard deviation (flat / washed-out frame guard). */
export const CONTRAST_STD_MIN = 0.01;

/**
 * Canonical examiner-facing rejection copy.
 * Kept in this module so the quality gate and the audit UI can never drift.
 */
export const QUALITY_MESSAGE_BLUR = '⚠️ الصورة غير واضحة أو مهتزة — يرجى إعادة التصوير بثبات.';
export const QUALITY_MESSAGE_GLARE = '⚠️ يوجد انعكاس ضوئي (وهج) قوى يغطي الحدقة — غيّر زاوية التصوير.';

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export interface ImagePoint {
  x: number;
  y: number;
}

/** How the natural-resolution photo was mapped into the analysis frame. */
export interface AnalysisTransform {
  imgWidth: number;
  imgHeight: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface EyeLandmarks {
  eye: EyeKey;
  /** Detected pupil centre (analysis-frame pixels). */
  pupil: ImagePoint | null;
  /** Detected Purkinje / corneal reflex (analysis-frame pixels). */
  reflex: ImagePoint | null;
  /** Detected upper eyelid margin used for MRD₁ (analysis-frame pixels). */
  upperLid: ImagePoint | null;
  pupilRadiusPx: number | null;
  /** Raw pupil-to-reflex distance in pixels. */
  offsetPx: number | null;
  /** HVID measured in pixels (null when the standard framing fallback is used). */
  hvidPx: number | null;
  hvidSource: 'detected' | 'standard';
  /** Share of the pupil disc that is hyper-saturated (0..1). */
  saturatedPupilRatio: number;
  /** Confidence of the automatic pupil detection (0..1). */
  pupilConfidence: number;
}

export interface OcularFrameAnalysis {
  landmarks: Record<EyeKey, EyeLandmarks>;
  /** Normalized Laplacian variance over the eye band (0..1 luminance scale). */
  sharpness: number;
  /** Normalized luminance standard deviation over the eye band. */
  contrast: number;
  isBlurred: boolean;
  hasGlare: boolean;
  /** Worst saturated share across both pupils. */
  glareRatio: number;
  /** Millimetres per analysis pixel, derived from the (detected or standard) HVID. */
  mmPerPx: number;
  transform: AnalysisTransform;
}

export interface OcularRangeValidation {
  hirschbergMM: number;
  mrd1MM: number;
  issues: string[];
}

export interface NetHirschbergResult {
  /** Net inter-ocular asymmetry after removing the 0.5 mm physiological angle-kappa offset. */
  hirschbergAsymMm: number;
  /** Hirschberg_Prism_Diopters = Math.round(Hirschberg_Asym_mm * 15). */
  prismDiopters: number;
  odOffsetMm: number | null;
  osOffsetMm: number | null;
}

/* ------------------------------------------------------------------ *
 * Low-level pixel helpers
 * ------------------------------------------------------------------ */

const luminance = (r: number, g: number, b: number): number => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

const buildLuminanceMap = (data: Uint8ClampedArray, width: number, height: number): Float32Array => {
  const map = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    map[p] = luminance(data[i], data[i + 1], data[i + 2]);
  }
  return map;
};

/** Separable box blur used to suppress tiny specular highlights before detection. */
const boxBlur = (source: Float32Array, width: number, height: number, radius: number): Float32Array => {
  if (radius < 1) return source;
  const horizontal = new Float32Array(width * height);
  const output = new Float32Array(width * height);
  const window = radius * 2 + 1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const xx = x + k;
        if (xx < 0 || xx >= width) continue;
        sum += source[y * width + xx];
        count += 1;
      }
      horizontal[y * width + x] = sum / count;
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const yy = y + k;
        if (yy < 0 || yy >= height) continue;
        sum += horizontal[yy * width + x];
        count += 1;
      }
      output[y * width + x] = sum / count;
    }
  }

  return output;
};

/**
 * Variance of the 4-neighbour Laplacian over the eye band.
 * A low value means the frame is blurred (camera shake or defocus).
 */
export const computeLaplacianVariance = (
  map: Float32Array,
  width: number,
  height: number,
): number => {
  const x0 = EYE_ROI.OD.cx - EYE_ROI.OD.rx - 8;
  const x1 = EYE_ROI.OS.cx + EYE_ROI.OS.rx + 8;
  const y0 = EYE_ROI.OD.cy - EYE_ROI.OD.ry - 8;
  const y1 = EYE_ROI.OD.cy + EYE_ROI.OD.ry + 8;

  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = Math.max(1, y0); y <= Math.min(height - 2, y1); y += 1) {
    for (let x = Math.max(1, x0); x <= Math.min(width - 2, x1); x += 1) {
      const index = y * width + x;
      const lap = 4 * map[index] - map[index - 1] - map[index + 1] - map[index - width] - map[index + width];
      sum += lap;
      sumSq += lap * lap;
      count += 1;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  return Math.max(0, sumSq / count - mean * mean);
};

/** Normalized luminance standard deviation over the eye band (flat-frame guard). */
export const computeLuminanceStdDev = (
  map: Float32Array,
  width: number,
  height: number,
): number => {
  const x0 = EYE_ROI.OD.cx - EYE_ROI.OD.rx - 8;
  const x1 = EYE_ROI.OS.cx + EYE_ROI.OS.rx + 8;
  const y0 = EYE_ROI.OD.cy - EYE_ROI.OD.ry - 8;
  const y1 = EYE_ROI.OD.cy + EYE_ROI.OD.ry + 8;

  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = Math.max(0, y0); y <= Math.min(height - 1, y1); y += 1) {
    for (let x = Math.max(0, x0); x <= Math.min(width - 1, x1); x += 1) {
      const value = map[y * width + x];
      sum += value;
      sumSq += value * value;
      count += 1;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return Math.sqrt(Math.max(0, sumSq / count - mean * mean));
};

const insideEllipse = (x: number, y: number, roi: { cx: number; cy: number; rx: number; ry: number }): boolean => {
  const dx = (x - roi.cx) / roi.rx;
  const dy = (y - roi.cy) / roi.ry;
  return dx * dx + dy * dy <= 1;
};

const distance = (a: ImagePoint, b: ImagePoint): number => Math.hypot(a.x - b.x, a.y - b.y);

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

interface DarkComponent {
  area: number;
  cx: number;
  cy: number;
}

/**
 * 8-connected component of dark pixels that contains the darkest pixel of the
 * eye ROI. Isolating one component keeps eyelashes, brows and temple shadows
 * from dragging the pupil centroid off the true pupil.
 */
const collectDarkComponent = (
  map: Float32Array,
  width: number,
  height: number,
  roi: { cx: number; cy: number; rx: number; ry: number },
  threshold: number,
  seedX: number,
  seedY: number,
): DarkComponent => {
  const x0 = Math.max(0, roi.cx - roi.rx);
  const x1 = Math.min(width - 1, roi.cx + roi.rx);
  const y0 = Math.max(0, roi.cy - roi.ry);
  const y1 = Math.min(height - 1, roi.cy + roi.ry);
  const localWidth = x1 - x0 + 1;
  const localHeight = y1 - y0 + 1;

  if (
    localWidth <= 0 || localHeight <= 0
    || seedX < x0 || seedX > x1 || seedY < y0 || seedY > y1
    || map[seedY * width + seedX] > threshold
  ) {
    return { area: 0, cx: seedX, cy: seedY };
  }

  const visited = new Uint8Array(localWidth * localHeight);
  const queue = new Int32Array(localWidth * localHeight);
  const start = (seedY - y0) * localWidth + (seedX - x0);
  visited[start] = 1;
  queue[0] = start;

  let head = 0;
  let tail = 1;
  let area = 0;
  let sumX = 0;
  let sumY = 0;
  let sumWeight = 0;

  while (head < tail) {
    const localIndex = queue[head];
    head += 1;
    const x = x0 + (localIndex % localWidth);
    const y = y0 + Math.floor(localIndex / localWidth);
    const luminance = map[y * width + x];
    const weight = Math.max(0.001, threshold - luminance);

    area += 1;
    sumX += x * weight;
    sumY += y * weight;
    sumWeight += weight;

    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
        if (!insideEllipse(nx, ny, roi)) continue;
        const neighborLocal = (ny - y0) * localWidth + (nx - x0);
        if (visited[neighborLocal]) continue;
        if (map[ny * width + nx] > threshold) continue;
        visited[neighborLocal] = 1;
        queue[tail] = neighborLocal;
        tail += 1;
      }
    }
  }

  return area > 0
    ? { area, cx: sumX / sumWeight, cy: sumY / sumWeight }
    : { area: 0, cx: seedX, cy: seedY };
};

/**
 * Horizontal visible iris diameter, averaged over several rows through the
 * pupil. Each limbus edge is the strongest iris→sclera gradient, which is
 * immune to the small specular reflex sitting inside the iris.
 */
const measureHvid = (
  map: Float32Array,
  width: number,
  height: number,
  roi: { cx: number; cy: number; rx: number; ry: number },
  pupil: ImagePoint,
  pupilRadiusPx: number,
  minLum: number,
  maxLum: number,
): number | null => {
  const dynamicRange = maxLum - minLum;
  const minDistance = Math.max(6, pupilRadiusPx * 1.25);
  const maxDistance = Math.min(roi.rx * 1.02, 88);
  const samples: number[] = [];

  // Robust iris level: median of an annulus just outside the pupil edge.
  const irisSamples: number[] = [];
  for (const dy of [-2, 0, 2]) {
    const row = Math.round(pupil.y + dy);
    if (row < 1 || row >= height - 1) continue;
    for (const side of [-1, 1] as const) {
      for (let d = pupilRadiusPx * 1.3; d <= pupilRadiusPx * 1.7; d += 1) {
        const x = Math.round(pupil.x + side * d);
        if (x < 1 || x >= width - 1) continue;
        if (!insideEllipse(x, row, roi)) continue;
        irisSamples.push(map[row * width + x]);
      }
    }
  }
  const irisLevel = median(irisSamples) ?? minLum + dynamicRange * 0.35;
  const scleraLevel = Math.max(irisLevel + 0.05, maxLum);
  const edgeMidpoint = (irisLevel + scleraLevel) / 2;

  const findLimbus = (row: number, step: 1 | -1): number | null => {
    let previous = map[row * width + Math.round(pupil.x + step * minDistance)];
    for (let dist = minDistance + 1; dist <= maxDistance; dist += 1) {
      const x = Math.round(pupil.x + step * dist);
      if (x < 1 || x >= width - 1) break;
      const value = map[row * width + x];
      if (value >= edgeMidpoint && previous < edgeMidpoint) {
        const next1 = map[row * width + x + step];
        const next2 = map[row * width + x + step * 2];
        if (next1 >= edgeMidpoint && next2 >= edgeMidpoint) {
          // Sub-pixel linear interpolation across the blurred limbus step.
          const t = (edgeMidpoint - previous) / Math.max(1e-6, value - previous);
          return x - step + t * step;
        }
      }
      previous = value;
    }
    return null;
  };

  for (const dy of [0, -2, 2, -4, 4]) {
    const row = Math.round(pupil.y + dy);
    if (row < 1 || row >= height - 1) continue;
    const leftEdge = findLimbus(row, -1);
    const rightEdge = findLimbus(row, 1);
    if (leftEdge === null || rightEdge === null) continue;
    const measured = rightEdge - leftEdge;
    if (
      measured >= Math.max(24, pupilRadiusPx * 1.8)
      && measured <= Math.min(170, roi.rx * 2 * 0.98)
    ) {
      samples.push(measured);
    }
  }

  return median(samples);
};

/**
 * Purkinje (corneal light reflex) localization.
 * The search is constrained to the iris disc so eyelid/sclera highlights can
 * never be mistaken for the reflex, and the winning blob is refined with a
 * luminance-weighted centroid for sub-pixel Hirschberg stability.
 */
const findCornealReflex = (
  map: Float32Array,
  data: Uint8ClampedArray,
  width: number,
  height: number,
  roi: { cx: number; cy: number; rx: number; ry: number },
  pupil: ImagePoint,
  pupilRadiusPx: number,
  hvidPx: number | null,
  minLum: number,
  maxLum: number,
): ImagePoint | null => {
  const dynamicRange = maxLum - minLum;
  if (dynamicRange < 0.1) return null;

  const irisRadius = Math.min(
    roi.rx * 0.95,
    Math.max((hvidPx ?? pupilRadiusPx * 2.4) / 2, pupilRadiusPx * 1.05),
  );
  // A 3 mm Hirschberg deviation is ≈ 24 analysis px; capping the search keeps
  // sclera / limbus highlights out of the candidate set even for large pupils.
  const searchRadius = Math.max(6, Math.min(irisRadius * 0.92, 34));
  const searchRadiusSq = searchRadius * searchRadius;
  const minSpecular = minLum + dynamicRange * 0.7;

  let peakScore = -Infinity;
  let peakX = pupil.x;
  let peakY = pupil.y;
  let peakLum = 0;

  for (let y = Math.max(0, Math.floor(pupil.y - searchRadius)); y <= Math.min(height - 1, Math.ceil(pupil.y + searchRadius)); y += 1) {
    for (let x = Math.max(0, Math.floor(pupil.x - searchRadius)); x <= Math.min(width - 1, Math.ceil(pupil.x + searchRadius)); x += 1) {
      const dx = x - pupil.x;
      const dy = y - pupil.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq > searchRadiusSq) continue;

      const luminance = map[y * width + x];
      if (luminance < minSpecular) continue;

      const index = (y * width + x) * 4;
      const whiteness = Math.min(data[index], data[index + 1], data[index + 2]) / 255;
      if (whiteness < 0.72) continue;

      // Prefer the brightest, whitest pixel and only gently penalise distance
      // so a physiologic kappa offset is not pulled back to the pupil centre.
      const score = luminance + whiteness * 0.08 - (distanceSq / searchRadiusSq) * 0.03;
      if (score > peakScore) {
        peakScore = score;
        peakX = x;
        peakY = y;
        peakLum = luminance;
      }
    }
  }

  if (!Number.isFinite(peakScore)) return null;

  const refineThreshold = Math.max(minLum + dynamicRange * 0.6, peakLum * 0.72);
  let sumWeight = 0;
  let sumX = 0;
  let sumY = 0;
  const refineRadius = 4;

  for (let y = Math.max(0, peakY - refineRadius); y <= Math.min(height - 1, peakY + refineRadius); y += 1) {
    for (let x = Math.max(0, peakX - refineRadius); x <= Math.min(width - 1, peakX + refineRadius); x += 1) {
      if (Math.hypot(x - peakX, y - peakY) > refineRadius + 0.5) continue;
      const luminance = map[y * width + x];
      if (luminance < refineThreshold) continue;
      const weight = (luminance - refineThreshold + 0.02) ** 2;
      sumWeight += weight;
      sumX += x * weight;
      sumY += y * weight;
    }
  }

  return sumWeight > 0
    ? { x: sumX / sumWeight, y: sumY / sumWeight }
    : { x: peakX, y: peakY };
};


/* ------------------------------------------------------------------ *
 * Per-eye landmark detection
 * ------------------------------------------------------------------ */

const detectEyeLandmarks = (
  blurred: Float32Array,
  data: Uint8ClampedArray,
  width: number,
  height: number,
  eye: EyeKey,
): EyeLandmarks => {
  const roi = EYE_ROI[eye];

  // --- Luminance extrema and the darkest-pixel seed -----------------------
  let minLum = 1;
  let maxLum = 0;
  let seedX: number = roi.cx;
  let seedY: number = roi.cy;

  for (let y = Math.max(0, roi.cy - roi.ry); y <= Math.min(height - 1, roi.cy + roi.ry); y += 1) {
    for (let x = Math.max(0, roi.cx - roi.rx); x <= Math.min(width - 1, roi.cx + roi.rx); x += 1) {
      if (!insideEllipse(x, y, roi)) continue;
      const value = blurred[y * width + x];
      if (value < minLum) {
        minLum = value;
        seedX = x;
        seedY = y;
      }
      if (value > maxLum) maxLum = value;
    }
  }

  const dynamicRange = maxLum - minLum;

  // --- Pupil: one connected dark component containing the darkest pixel ---
  const darkThreshold = minLum + dynamicRange * 0.2;
  const component = collectDarkComponent(blurred, width, height, roi, darkThreshold, seedX, seedY);
  const pupilDetected = dynamicRange >= 0.06 && component.area >= 14;
  const pupil: ImagePoint | null = pupilDetected
    ? { x: component.cx, y: component.cy }
    : null;
  const pupilRadiusPx = pupilDetected
    ? Math.min(60, Math.max(3, Math.sqrt(component.area / Math.PI)))
    : null;

  // --- HVID first: it bounds the iris disc used for reflex localization ---
  const hvidPx = pupilDetected && pupil && pupilRadiusPx
    ? measureHvid(blurred, width, height, roi, pupil, pupilRadiusPx, minLum, maxLum)
    : null;

  // --- Corneal reflex (Purkinje): brightest specular blob inside the iris --
  const reflex = pupilDetected && pupil && pupilRadiusPx
    ? findCornealReflex(blurred, data, width, height, roi, pupil, pupilRadiusPx, hvidPx, minLum, maxLum)
    : null;

  // --- Specular glare inside the pupil disc -------------------------------
  let pupilPixels = 0;
  let saturatedPixels = 0;
  if (pupil && pupilRadiusPx) {
    const radius = pupilRadiusPx * 1.15;
    const radiusSq = radius * radius;
    for (let y = Math.max(0, Math.floor(pupil.y - radius)); y <= Math.min(height - 1, Math.ceil(pupil.y + radius)); y += 1) {
      for (let x = Math.max(0, Math.floor(pupil.x - radius)); x <= Math.min(width - 1, Math.ceil(pupil.x + radius)); x += 1) {
        const dx = x - pupil.x;
        const dy = y - pupil.y;
        if (dx * dx + dy * dy > radiusSq) continue;
        pupilPixels += 1;
        const index = (y * width + x) * 4;
        if (data[index] > SATURATION_THRESHOLD && data[index + 1] > SATURATION_THRESHOLD && data[index + 2] > SATURATION_THRESHOLD) {
          saturatedPixels += 1;
        }
      }
    }
  }
  const saturatedPupilRatio = pupilPixels > 0 ? saturatedPixels / pupilPixels : 0;

  // --- Upper lid margin for MRD₁ ------------------------------------------
  let upperLid: ImagePoint | null = null;
  if (pupilDetected && pupil && pupilRadiusPx) {
    const start = Math.max(1, Math.round(pupil.y - pupilRadiusPx * 3.4));
    const end = Math.min(height - 2, Math.round(pupil.y - pupilRadiusPx * 0.35));
    const columns = [-2, -1, 0, 1, 2]
      .map((offset) => Math.round(pupil.x) + offset)
      .filter((x) => x >= 1 && x < width - 1);
    let bestGradient = 0;
    let bestY = -1;
    for (let y = start; y <= end; y += 1) {
      let gradient = 0;
      for (const x of columns) {
        gradient += Math.abs(blurred[(y + 1) * width + x] - blurred[(y - 1) * width + x]);
      }
      if (columns.length > 0) gradient /= columns.length;
      if (gradient > bestGradient) {
        bestGradient = gradient;
        bestY = y;
      }
    }
    if (bestY > 0 && bestGradient >= 0.016) {
      upperLid = { x: pupil.x, y: bestY };
    }
  }

  const offsetPx = pupil && reflex ? distance(pupil, reflex) : null;

  return {
    eye,
    pupil,
    reflex,
    upperLid,
    pupilRadiusPx,
    offsetPx,
    hvidPx,
    hvidSource: hvidPx ? 'detected' : 'standard',
    saturatedPupilRatio,
    pupilConfidence: pupilDetected ? Math.min(1, component.area / 220) : 0,
  };
};

/* ------------------------------------------------------------------ *
 * Frame analysis
 * ------------------------------------------------------------------ */

/** Draws the photo into the canonical analysis frame and returns the mapping used. */
export const buildAnalysisFrame = (image: HTMLImageElement): {
  canvas: HTMLCanvasElement;
  transform: AnalysisTransform;
} => {
  const canvas = document.createElement('canvas');
  canvas.width = ANALYSIS_WIDTH;
  canvas.height = ANALYSIS_HEIGHT;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('تعذر تجهيز إطار التحليل للصورة.');
  }

  const imgWidth = image.naturalWidth || image.width || ANALYSIS_WIDTH;
  const imgHeight = image.naturalHeight || image.height || ANALYSIS_HEIGHT;
  const scale = Math.min(ANALYSIS_WIDTH / imgWidth, ANALYSIS_HEIGHT / imgHeight);
  const drawWidth = imgWidth * scale;
  const drawHeight = imgHeight * scale;
  const offsetX = (ANALYSIS_WIDTH - drawWidth) / 2;
  const offsetY = (ANALYSIS_HEIGHT - drawHeight) / 2;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

  return {
    canvas,
    transform: { imgWidth, imgHeight, scale, offsetX, offsetY },
  };
};

/**
 * Full client-side analysis of a captured/uploaded eye photo:
 * sharpness gate, glare gate, per-eye landmarks and the HVID scale factor.
 */
export const analyzeOcularFrame = (image: HTMLImageElement): OcularFrameAnalysis => {
  const { canvas, transform } = buildAnalysisFrame(image);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('تعذر قراءة الصورة للتحليل.');
  const imageData = ctx.getImageData(0, 0, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);
  const raw = buildLuminanceMap(imageData.data, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);
  const blurred = boxBlur(raw, ANALYSIS_WIDTH, ANALYSIS_HEIGHT, 2);

  const sharpness = computeLaplacianVariance(blurred, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);
  const contrast = computeLuminanceStdDev(blurred, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);

  const landmarks = {
    OD: detectEyeLandmarks(blurred, imageData.data, ANALYSIS_WIDTH, ANALYSIS_HEIGHT, 'OD'),
    OS: detectEyeLandmarks(blurred, imageData.data, ANALYSIS_WIDTH, ANALYSIS_HEIGHT, 'OS'),
  };

  const glareRatio = Math.max(landmarks.OD.saturatedPupilRatio, landmarks.OS.saturatedPupilRatio);

  // HVID scale: use the measured iris diameter when both eyes agree, otherwise
  // fall back to the canonical framing reference so the workflow never stalls.
  const detected = [landmarks.OD.hvidPx, landmarks.OS.hvidPx].filter((v): v is number => typeof v === 'number');
  let hvidReference: number | null = null;
  if (detected.length === 2) {
    const [a, b] = detected;
    if (Math.abs(a - b) <= Math.max(12, a * 0.25)) hvidReference = (a + b) / 2;
  } else if (detected.length === 1) {
    hvidReference = detected[0];
  }
  const hvidPx = hvidReference ?? FALLBACK_HVID_PX;

  if (hvidReference) {
    landmarks.OD.hvidPx = hvidReference;
    landmarks.OS.hvidPx = hvidReference;
    landmarks.OD.hvidSource = 'detected';
    landmarks.OS.hvidSource = 'detected';
  }

  const isBlurred = sharpness < LAPLACIAN_VARIANCE_MIN || contrast < CONTRAST_STD_MIN;
  const hasGlare = glareRatio > GLARE_SPAN_THRESHOLD;

  return {
    landmarks,
    sharpness,
    contrast,
    isBlurred,
    hasGlare,
    glareRatio,
    mmPerPx: STANDARD_PEDIATRIC_HVID_MM / hvidPx,
    transform,
  };
};

/* ------------------------------------------------------------------ *
 * Geometric normalization
 * ------------------------------------------------------------------ */

/**
 * Net inter-ocular reflex asymmetry.
 * Each eye's measured reflex decentration is corrected by the physiological
 * 0.5 mm angle-kappa offset before the two eyes are differenced.
 */
export const computeNetHirschberg = (
  landmarks: Record<EyeKey, EyeLandmarks>,
  mmPerPx: number,
): NetHirschbergResult => {
  const odPx = landmarks.OD.offsetPx;
  const osPx = landmarks.OS.offsetPx;
  const odOffsetMm = odPx === null ? null : odPx * mmPerPx;
  const osOffsetMm = osPx === null ? null : osPx * mmPerPx;

  const adjustedOd = odOffsetMm === null ? null : Math.max(0, odOffsetMm - ANGLE_KAPPA_ADJUSTMENT_MM);
  const adjustedOs = osOffsetMm === null ? null : Math.max(0, osOffsetMm - ANGLE_KAPPA_ADJUSTMENT_MM);

  let asym: number | null = null;
  if (adjustedOd !== null && adjustedOs !== null) {
    asym = Math.abs(adjustedOd - adjustedOs);
  } else if (adjustedOd !== null) {
    asym = adjustedOd;
  } else if (adjustedOs !== null) {
    asym = adjustedOs;
  }

  const hirschbergAsymMm = asym === null ? 0 : asym;

  return {
    hirschbergAsymMm,
    prismDiopters: Math.round(hirschbergAsymMm * PRISM_DIOPTERS_PER_MM),
    odOffsetMm,
    osOffsetMm,
  };
};

/** MRD₁ estimate from the pupil margin to the detected lower lid margin. */
export const computeMRD1FromLandmarks = (
  landmarks: EyeLandmarks,
  mmPerPx: number,
): number | null => {
  if (!landmarks.upperLid || !landmarks.reflex) return null;
  // MRD₁ = corneal light reflex → upper eyelid margin (validated later).
  const gapPx = landmarks.reflex.y - landmarks.upperLid.y;
  return gapPx * mmPerPx;
};

/** Clamp + flag ocular values that leave the admissible pediatric ranges. */
export const validateOcularRanges = (
  hirschbergMM: number,
  mrd1MM: number,
): OcularRangeValidation => {
  const issues: string[] = [];

  let safeHirschberg = hirschbergMM;
  if (!Number.isFinite(safeHirschberg) || safeHirschberg < HIRSCHBERG_LIMITS.min || safeHirschberg > HIRSCHBERG_LIMITS.max) {
    safeHirschberg = Math.min(HIRSCHBERG_LIMITS.max, Math.max(HIRSCHBERG_LIMITS.min, Number.isFinite(hirschbergMM) ? hirschbergMM : 0));
    issues.push(`قيمة Hirschberg خارج النطاق السريري المسموح (${HIRSCHBERG_LIMITS.min}–${HIRSCHBERG_LIMITS.max} مم)؛ عُدّلت تلقائياً إلى ${safeHirschberg.toFixed(2)} مم.`);
  }

  let safeMrd1 = mrd1MM;
  if (!Number.isFinite(safeMrd1) || safeMrd1 < MRD1_LIMITS.min || safeMrd1 > MRD1_LIMITS.max) {
    safeMrd1 = Math.min(MRD1_LIMITS.max, Math.max(MRD1_LIMITS.min, Number.isFinite(mrd1MM) ? mrd1MM : MRD1_LIMITS.min));
    issues.push(`قيمة MRD₁ خارج النطاق السريري المسموح (${MRD1_LIMITS.min}–${MRD1_LIMITS.max} مم)؛ عُدّلت تلقائياً إلى ${safeMrd1.toFixed(1)} مم.`);
  }

  return { hirschbergMM: +safeHirschberg.toFixed(2), mrd1MM: +safeMrd1.toFixed(1), issues };
};

/* ------------------------------------------------------------------ *
 * Coordinate mapping helpers for the visual audit HUD
 * ------------------------------------------------------------------ */

export const analysisToNatural = (point: ImagePoint, t: AnalysisTransform): ImagePoint => ({
  x: (point.x - t.offsetX) / t.scale,
  y: (point.y - t.offsetY) / t.scale,
});

export const naturalToAnalysis = (point: ImagePoint, t: AnalysisTransform): ImagePoint => ({
  x: point.x * t.scale + t.offsetX,
  y: point.y * t.scale + t.offsetY,
});

/**
 * The preview stage renders the photo with `object-fit: contain`, so the
 * natural→screen mapping uses the same fit model as the analysis frame.
 */
export const naturalToScreen = (
  point: ImagePoint,
  t: AnalysisTransform,
  boxWidth: number,
  boxHeight: number,
): ImagePoint => {
  const scale = Math.min(boxWidth / t.imgWidth, boxHeight / t.imgHeight);
  return {
    x: point.x * scale + (boxWidth - t.imgWidth * scale) / 2,
    y: point.y * scale + (boxHeight - t.imgHeight * scale) / 2,
  };
};

export const screenToNatural = (
  x: number,
  y: number,
  t: AnalysisTransform,
  boxWidth: number,
  boxHeight: number,
): ImagePoint => {
  const scale = Math.min(boxWidth / t.imgWidth, boxHeight / t.imgHeight);
  return {
    x: (x - (boxWidth - t.imgWidth * scale) / 2) / scale,
    y: (y - (boxHeight - t.imgHeight * scale) / 2) / scale,
  };
};

/** Returns the eye whose region contains the analysis-frame point (nearest wins). */
export const eyeAtAnalysisPoint = (point: ImagePoint): EyeKey | null => {
  const score = (eye: EyeKey) => {
    const roi = EYE_ROI[eye];
    const dx = (point.x - roi.cx) / roi.rx;
    const dy = (point.y - roi.cy) / roi.ry;
    return dx * dx + dy * dy;
  };
  const odScore = score('OD');
  const osScore = score('OS');
  if (odScore > 1.6 && osScore > 1.6) return null;
  return odScore <= osScore ? 'OD' : 'OS';
};
