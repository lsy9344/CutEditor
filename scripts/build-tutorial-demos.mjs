// 튜토리얼 ①프레임 ②글씨 ③스티커 ④내 사진 스티커 단계의 시연 그림을 만듭니다(사람이 필요할 때 직접 돌리는 스크립트,
// 빌드에 연결하지 않음).
//
// 사용법
//   node scripts/build-tutorial-demos.mjs <가족사진> <오린 아이 PNG> [출력 폴더]
//   출력 폴더를 빼면 public/tutorial/에 단계마다 <단계>-demo.webp(반복 애니메이션)와 <단계>-demo-still.png(정지, 꾸민 뒤의
//   결과 장면)를 씁니다. 단계는 frames, text, sticker, cutout입니다.
//   ffmpeg(libwebp_anim, drawtext 포함)와 ffprobe가 PATH에 있어야 합니다. 예: sudo apt install ffmpeg / brew install ffmpeg
//
// 지금 들어 있는 시연 사진(원본은 저장소에 넣지 않음)
//   AI로 만든 실사풍 가족사진입니다(Codex image_gen, 2026-11-24 생성). 실존 인물이 아닙니다. 세로 9:16, 941×1672.
//   오린 아이 PNG는 이 앱의 '내 사진 스티커'에서 사람을 '눌러서 고르기'로 아이 얼굴을 눌러 만들고(흰 테두리 켬)
//   '이 스티커만 저장'으로 받은 그대로입니다.
//
// 매장 사진으로 바꾸는 방법
//   1. 세로 9:16 사진을 고릅니다. 위쪽 1/3쯤은 글씨·스티커가 들어갈 단순한 여백이면 좋습니다.
//   2. 앱에 사진을 넣고 '내 사진 스티커'로 한 사람을 오린 뒤, 뒤집거나 지우지 않은 채 '이 스티커만 저장'으로 PNG를 받습니다.
//   3. 앱에 넣은 원본 사진과 받은 PNG를 이 스크립트에 넣습니다. 스크립트가 PNG가 사진의 어디에서 오렸는지 스스로 찾습니다.
//      ②의 글씨를 바꾸려면 아래 DEMO_TEXT를 고칩니다.
//   4. public/tutorial/의 여덟 파일을 눈으로 확인하고 커밋합니다(각 WebP 150KB, PNG 80KB 이하. tests/ui/tutorialSteps.test.ts가 확인).
//
// 그림 속 글자는 ②의 DEMO_TEXT 하나뿐입니다. 글꼴은 public/font/NotoSansKR-Light.ttf입니다. 파일의 이름 표(name ID 13)에
// 'SIL Open Font License, Version 1.1'이 적혀 있어 상업 이용과 그림으로 넣기가 됩니다. ♥(U+2665)도 이 글꼴에 있습니다.
//
// 만드는 방법: 장면 합성은 이 스크립트가 RGBA 화소로 직접 합니다(마우스 화살표의 이동·누름 물결·끌기·'톡'을 장마다 계산해야
// 해서 FFmpeg 필터 식으로는 지나치게 복잡해짐). FFmpeg는 사진·스티커 읽기와 크기 조정, 글자 그리기, 인코딩을 맡습니다.
// 인코딩은 반드시 libwebp_anim입니다(일반 libwebp는 장면 사이 중복을 못 줄여 열 배 넘게 커짐).
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const FONT_PATH = join(REPO, 'public', 'font', 'NotoSansKR-Light.ttf');
const STICKER_DIR = join(REPO, 'public', 'stickers');
const DEMO_TEXT = '하은이 다섯 살 ♥';

const FPS = 15;
// 화면 크기 186×196을 2배로 만듭니다. src/ui/tutorialSteps.ts의 getTutorialDemoImage와 같아야 하며
// tests/ui/tutorialSteps.test.ts가 파일 크기를 확인합니다. 아래 좌표는 모두 2배 기준 px입니다.
const WIDTH = 372;
const HEIGHT = 392;
// 앱 스타일: 검정 테두리와 오프셋 그림자, 색은 src/components/components.css의 토큰 값
const BORDER = 6;
const SHADOW = 8;
const ITEM_BORDER = 4;
const ITEM_SHADOW = 4;
const COLORS = {
  tooltip: [255, 255, 255], // --linear-neutral-600(말풍선 바탕)
  ink: [0, 0, 0],
  panel: [255, 249, 245], // --linear-neutral-700
  slot: [245, 235, 230], // --linear-neutral-900
  primary: [227, 213, 202], // --linear-primary-500(글씨 넣기 버튼)
  selected: [255, 183, 3], // --linear-accent-warning(고른 프레임)
  frame: [255, 155, 155], // --linear-accent-error-bg(씌우는 프레임)
  heart: [230, 57, 70], // --linear-accent-error(글씨의 ♥)
  thumbPhoto: [217, 217, 217], // 프레임 목록의 빈 사진 자리
  white: [255, 255, 255],
};
const CHECKER_LIGHT = 255;
const CHECKER_DARK = 221;
const CHECKER_SIZE = 10;
const WORKING_MAX_SIDE = 2048; // src/photo/cutoutRender.ts CUTOUT_WORKING_MAX_SIDE: 오린 PNG는 이 크기의 작업 사진에서 잘립니다
const MATCH_MAX_DIFF = 16; // 사진과 PNG가 맞는지 판단하는 평균 화소 차이 한도(0~255)

// 네 시연이 함께 쓰는 무대: 왼쪽 목록 패널 + 오른쪽 세로 9:16 인화지
const PRINT = { width: 200, height: 356 };
const PRINT_CARD = { x: WIDTH - 4 - SHADOW - (PRINT.width + BORDER * 2), y: 8 };
const PRINT_INNER = { x: PRINT_CARD.x + BORDER, y: PRINT_CARD.y + BORDER };
const PANEL_CARD = { x: 8, y: 8, width: PRINT_CARD.x - 16 - 8, height: PRINT.height + BORDER * 2 };
const PANEL_INNER = { x: PANEL_CARD.x + BORDER, y: PANEL_CARD.y + BORDER, width: PANEL_CARD.width - BORDER * 2, height: PANEL_CARD.height - BORDER * 2 };
const PANEL_CENTER_X = PANEL_INNER.x + PANEL_INNER.width / 2;
// 인화지 안쪽 좌표(0,0 = 사진 왼쪽 위)를 무대 좌표로
const onPrint = (x, y) => ({ x: PRINT_INNER.x + x, y: PRINT_INNER.y + y });
const CURSOR_REST = onPrint(172, 318); // 화살표가 쉬는 자리(반복 처음과 끝, 인화지 오른쪽 아래 구석)
const LOOP_FADE_FRAMES = 6; // 끝에서 처음 장면으로 겹쳐 돌아가는 장 수
const TOC_SCALES = [1.14, 1.2, 1.1, 1.03, 0.99, 1]; // 놓은 뒤 '톡'
const RIPPLE_FRAMES = 7;

class DemoBuildError extends Error {}

const fail = (message) => {
  throw new DemoBuildError(message);
};

const run = (command, args, options = {}) => execFileSync(command, args, { maxBuffer: 256 * 1024 * 1024, ...options });

const checkFfmpeg = () => {
  for (const tool of ['ffmpeg', 'ffprobe']) {
    const probe = spawnSync(tool, ['-version'], { encoding: 'utf8' });
    if (probe.error || probe.status !== 0) {
      fail(`${tool}를 찾지 못했습니다. ffmpeg를 설치한 뒤 다시 돌려 주세요(예: sudo apt install ffmpeg, brew install ffmpeg).`);
    }
  }
  const encoders = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' }).stdout ?? '';
  if (!/\blibwebp_anim\b/.test(encoders)) fail('이 ffmpeg에는 libwebp_anim 인코더가 없습니다. libwebp를 켜고 빌드된 ffmpeg가 필요합니다.');
  const filters = spawnSync('ffmpeg', ['-hide_banner', '-filters'], { encoding: 'utf8' }).stdout ?? '';
  if (!/\bdrawtext\b/.test(filters)) fail('이 ffmpeg에는 drawtext 필터가 없습니다. libfreetype을 켜고 빌드된 ffmpeg가 필요합니다.');
};

const readSize = (path) => {
  const output = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path], { encoding: 'utf8' });
  const [width, height] = output.trim().split(',').map(Number);
  if (!width || !height) fail(`그림 크기를 읽지 못했습니다: ${path}`);
  return { width, height };
};

// 그림 파일을 정해진 크기의 RGBA 화소로 읽습니다. filter를 주면 크기 조정 대신 그 필터를 씁니다.
const readRgba = (path, width, height, filter = `scale=${width}:${height}:flags=lanczos`) => {
  const data = run('ffmpeg', ['-v', 'error', '-i', path, '-vf', `${filter},format=rgba`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']);
  if (data.length !== width * height * 4) fail(`그림을 읽지 못했습니다: ${path}`);
  return { width, height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };
};

// ---- 오린 PNG가 사진의 어디에서 잘렸는지 찾기 ----

// 앱이 오릴 때 쓰는 작업 사진 크기(긴 변 2048 이하)
const getWorkingSize = ({ width, height }) => {
  const longSide = Math.max(width, height);
  if (longSide <= WORKING_MAX_SIDE) return { width, height };
  const scale = WORKING_MAX_SIDE / longSide;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
};

// 오린 PNG의 불투명한 안쪽 화소(흰 테두리 제외)를 고릅니다. 많으면 고르게 줄입니다.
const pickStickerPoints = ({ data, width, height }, limit) => {
  const points = [];
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const isWhite = data[offset] >= 250 && data[offset + 1] >= 250 && data[offset + 2] >= 250;
    if (data[offset + 3] === 255 && !isWhite) points.push(index);
  }
  const step = Math.max(1, Math.ceil(points.length / limit));
  return points.filter((_, order) => order % step === 0).map((index) => ({
    x: index % width,
    y: Math.floor(index / width),
    color: [data[index * 4], data[index * 4 + 1], data[index * 4 + 2]],
  }));
};

const meanDifference = (photo, points, dx, dy, limit) => {
  let sum = 0;
  const budget = limit * points.length * 3;
  for (const { x, y, color } of points) {
    const offset = ((y + dy) * photo.width + (x + dx)) * 4;
    sum += Math.abs(photo.data[offset] - color[0]) + Math.abs(photo.data[offset + 1] - color[1]) + Math.abs(photo.data[offset + 2] - color[2]);
    if (sum > budget) return Infinity;
  }
  return sum / (points.length * 3);
};

const searchOffset = (photo, points, stickerSize, range) => {
  let best = { dx: 0, dy: 0, difference: Infinity };
  const xMax = Math.min(range.x1, photo.width - stickerSize.width);
  const yMax = Math.min(range.y1, photo.height - stickerSize.height);
  for (let dy = Math.max(0, range.y0); dy <= yMax; dy += 1) {
    for (let dx = Math.max(0, range.x0); dx <= xMax; dx += 1) {
      const difference = meanDifference(photo, points, dx, dy, best.difference);
      if (difference < best.difference) best = { dx, dy, difference };
    }
  }
  return best;
};

// 1/4 크기로 훑고 원래 크기에서 다듬습니다.
const locateSticker = (photoPath, cutoutPath, working, sticker) => {
  const coarse = 4;
  const smallPhoto = { width: Math.round(working.width / coarse), height: Math.round(working.height / coarse) };
  const smallSticker = { width: Math.round(sticker.width / coarse), height: Math.round(sticker.height / coarse) };
  const coarsePoints = pickStickerPoints(readRgba(cutoutPath, smallSticker.width, smallSticker.height, `scale=${smallSticker.width}:${smallSticker.height}:flags=area`), 3000);
  if (coarsePoints.length < 50) fail('오린 PNG에 불투명한 부분이 거의 없습니다.');
  const first = searchOffset(readRgba(photoPath, smallPhoto.width, smallPhoto.height, `scale=${smallPhoto.width}:${smallPhoto.height}:flags=area`), coarsePoints, smallSticker, { x0: 0, y0: 0, x1: Infinity, y1: Infinity });
  const finePoints = pickStickerPoints(readRgba(cutoutPath, sticker.width, sticker.height, `scale=${sticker.width}:${sticker.height}:flags=area`), 20000);
  const reach = coarse * 2;
  const fine = searchOffset(readRgba(photoPath, working.width, working.height, `scale=${working.width}:${working.height}:flags=area`), finePoints, sticker, {
    x0: first.dx * coarse - reach, x1: first.dx * coarse + reach, y0: first.dy * coarse - reach, y1: first.dy * coarse + reach,
  });
  if (fine.difference > MATCH_MAX_DIFF) {
    fail(`오린 PNG가 이 사진에서 나온 것 같지 않습니다(평균 차이 ${fine.difference.toFixed(1)}). 같은 사진을 뒤집거나 고치지 않고 오렸는지 확인해 주세요.`);
  }
  return { x: fine.dx, y: fine.dy, difference: fine.difference };
};

// ---- 화소 그리기 ----

const createImage = (width, height, color = null) => {
  const image = { width, height, data: new Uint8ClampedArray(width * height * 4) };
  if (color) fillRect(image, 0, 0, width, height, color);
  return image;
};

const copyImage = (image) => ({ width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) });

// 한 화소에 색을 덮습니다(source-over). 바탕이 투명할 수 있는 스프라이트에도 맞게 알파를 합칩니다.
const blendPixel = (image, x, y, r, g, b, alpha) => {
  if (alpha <= 0 || x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const offset = (y * image.width + x) * 4;
  const data = image.data;
  const baseAlpha = data[offset + 3] / 255;
  const outAlpha = alpha + baseAlpha * (1 - alpha);
  if (outAlpha <= 0) return;
  const keep = (baseAlpha * (1 - alpha)) / outAlpha;
  const add = alpha / outAlpha;
  data[offset] = r * add + data[offset] * keep;
  data[offset + 1] = g * add + data[offset + 1] * keep;
  data[offset + 2] = b * add + data[offset + 2] * keep;
  data[offset + 3] = outAlpha * 255;
};

function fillRect(image, x, y, width, height, [r, g, b]) {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(image.width, Math.round(x + width));
  const y1 = Math.min(image.height, Math.round(y + height));
  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) blendPixel(image, px, py, r, g, b, 1);
  }
}

// 앱의 상자 모양: 오프셋 그림자 → 검정 테두리 → 안쪽 색. (x, y)는 테두리 바깥 왼쪽 위입니다.
const drawCard = (image, x, y, innerWidth, innerHeight, fill, { border = BORDER, shadow = SHADOW } = {}) => {
  const outerWidth = innerWidth + border * 2;
  const outerHeight = innerHeight + border * 2;
  if (shadow > 0) fillRect(image, x + shadow, y + shadow, outerWidth, outerHeight, COLORS.ink);
  fillRect(image, x, y, outerWidth, outerHeight, COLORS.ink);
  fillRect(image, x + border, y + border, innerWidth, innerHeight, fill);
};

const fillChecker = (image, x, y, width, height, originX = x, originY = y) => {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      const value = (Math.floor((px - originX) / CHECKER_SIZE) + Math.floor((py - originY) / CHECKER_SIZE)) % 2 ? CHECKER_DARK : CHECKER_LIGHT;
      blendPixel(image, px, py, value, value, value, 1);
    }
  }
};

// 스프라이트를 (x, y)에 그대로 그립니다. clip은 그릴 수 있는 무대 영역, rowLimit는 위에서부터 보일 줄 수입니다.
const drawImage = (target, sprite, x, y, { alpha = 1, clip = null, rowLimit = sprite.height } = {}) => {
  const left = Math.round(x);
  const top = Math.round(y);
  for (let sy = 0; sy < Math.min(sprite.height, rowLimit); sy += 1) {
    const ty = top + sy;
    if (clip && (ty < clip.y || ty >= clip.y + clip.height)) continue;
    for (let sx = 0; sx < sprite.width; sx += 1) {
      const tx = left + sx;
      if (clip && (tx < clip.x || tx >= clip.x + clip.width)) continue;
      const offset = (sy * sprite.width + sx) * 4;
      const a = (sprite.data[offset + 3] / 255) * alpha;
      if (a > 0) blendPixel(target, tx, ty, sprite.data[offset], sprite.data[offset + 1], sprite.data[offset + 2], a);
    }
  }
};

// 스프라이트를 가운데 (cx, cy)에 scale배로 그립니다(쌍선형, 미리 곱한 알파로 가장자리가 어두워지지 않게).
const drawScaled = (target, sprite, cx, cy, scale) => {
  if (Math.abs(scale - 1) < 1e-6) {
    drawImage(target, sprite, cx - sprite.width / 2, cy - sprite.height / 2);
    return;
  }
  const width = sprite.width * scale;
  const height = sprite.height * scale;
  const x0 = Math.floor(cx - width / 2);
  const y0 = Math.floor(cy - height / 2);
  const x1 = Math.ceil(cx + width / 2);
  const y1 = Math.ceil(cy + height / 2);
  const sample = (sx, sy, channel) => sprite.data[(sy * sprite.width + sx) * 4 + channel];
  for (let ty = y0; ty < y1; ty += 1) {
    for (let tx = x0; tx < x1; tx += 1) {
      const fx = (tx + 0.5 - (cx - width / 2)) / scale - 0.5;
      const fy = (ty + 0.5 - (cy - height / 2)) / scale - 0.5;
      if (fx < -0.5 || fy < -0.5 || fx > sprite.width - 0.5 || fy > sprite.height - 0.5) continue;
      const ix = Math.max(0, Math.min(sprite.width - 2, Math.floor(fx)));
      const iy = Math.max(0, Math.min(sprite.height - 2, Math.floor(fy)));
      const wx = Math.max(0, Math.min(1, fx - ix));
      const wy = Math.max(0, Math.min(1, fy - iy));
      const corners = [[ix, iy, (1 - wx) * (1 - wy)], [ix + 1, iy, wx * (1 - wy)], [ix, iy + 1, (1 - wx) * wy], [ix + 1, iy + 1, wx * wy]];
      let a = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      for (const [sx, sy, weight] of corners) {
        const pa = (sample(sx, sy, 3) / 255) * weight;
        a += pa;
        r += sample(sx, sy, 0) * pa;
        g += sample(sx, sy, 1) * pa;
        b += sample(sx, sy, 2) * pa;
      }
      if (a > 0) blendPixel(target, tx, ty, r / a, g / a, b / a, a);
    }
  }
};

// 가장자리를 부드럽게 칠한 원 고리(누름 물결)
const drawRing = (image, cx, cy, radius, thickness, [r, g, b], alpha) => {
  const reach = Math.ceil(radius + thickness);
  for (let py = Math.floor(cy - reach); py <= Math.ceil(cy + reach); py += 1) {
    for (let px = Math.floor(cx - reach); px <= Math.ceil(cx + reach); px += 1) {
      const distance = Math.hypot(px + 0.5 - cx, py + 0.5 - cy);
      const coverage = Math.max(0, Math.min(1, thickness / 2 + 0.5 - Math.abs(distance - radius)));
      if (coverage > 0) blendPixel(image, px, py, r, g, b, coverage * alpha);
    }
  }
};

const mixImages = (from, to, amount) => {
  const out = copyImage(from);
  for (let index = 0; index < out.data.length; index += 1) out.data[index] = from.data[index] * (1 - amount) + to.data[index] * amount;
  return out;
};

// ---- 마우스 화살표 ----

// 흔한 화살표 모양(1배 기준 점). 흰 몸통에 검정 테두리이고 끝이 (0, 0)입니다. 끄는 동안에도 모양을 바꾸지 않습니다.
const CURSOR_POINTS = [[0, 0], [0, 16.5], [4, 12.8], [6.8, 19], [9.6, 17.8], [6.9, 11.8], [11.8, 11.8]];
const CURSOR_SCALE = 2.3;
const CURSOR_LINE = 2.6;

const distanceToSegment = (px, py, [ax, ay], [bx, by]) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

const isInsidePolygon = (px, py, points) => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const createCursorSprite = () => {
  const pad = 3;
  const points = CURSOR_POINTS.map(([x, y]) => [x * CURSOR_SCALE + pad, y * CURSOR_SCALE + pad]);
  const width = Math.ceil(Math.max(...points.map(([x]) => x)) + pad * 2);
  const height = Math.ceil(Math.max(...points.map(([, y]) => y)) + pad * 2);
  const sprite = createImage(width, height);
  const samples = 4;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let ink = 0;
      let paper = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) / samples;
          const py = y + (sy + 0.5) / samples;
          const edge = Math.min(...points.map((point, index) => distanceToSegment(px, py, point, points[(index + 1) % points.length])));
          if (isInsidePolygon(px, py, points)) {
            if (edge < CURSOR_LINE) ink += 1;
            else paper += 1;
          } else if (edge < 1) {
            ink += 1;
          }
        }
      }
      const total = samples * samples;
      const alpha = (ink + paper) / total;
      if (alpha === 0) continue;
      const value = (paper / (ink + paper)) * 255;
      const offset = (y * width + x) * 4;
      sprite.data.set([value, value, value, alpha * 255], offset);
    }
  }
  return { sprite, tip: { x: pad, y: pad } };
};

// ---- 시간표 ----

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const lerpPoint = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
const progress = (frame, start, length) => clamp01((frame - start) / length);

// 화살표 경로: [장 번호, 점] 목록 사이를 부드럽게 옮깁니다.
const pathAt = (keys, frame) => {
  if (frame <= keys[0][0]) return keys[0][1];
  for (let index = 1; index < keys.length; index += 1) {
    const [end, to] = keys[index];
    const [start, from] = keys[index - 1];
    if (frame <= end) return lerpPoint(from, to, ease(progress(frame, start, end - start)));
  }
  return keys[keys.length - 1][1];
};

const tocScale = (frame, dropFrame) => {
  const index = frame - dropFrame;
  return index >= 0 && index < TOC_SCALES.length ? TOC_SCALES[index] : 1;
};

// 누른 장부터 작은 동그라미 물결이 퍼지며 옅어집니다.
const drawRipple = (image, point, frame, pressFrame) => {
  const index = frame - pressFrame;
  if (index < 0 || index >= RIPPLE_FRAMES) return;
  const t = index / RIPPLE_FRAMES;
  drawRing(image, point.x, point.y, 8 + 26 * t, 5, COLORS.ink, 0.85 * (1 - t));
  if (index < 3) drawRing(image, point.x, point.y, 4, 8, COLORS.ink, 0.5 * (1 - index / 3));
};

const drawCursor = (image, assets, point) => drawImage(image, assets.cursor.sprite, point.x - assets.cursor.tip.x, point.y - assets.cursor.tip.y);

// ---- 무대 ----

const createStage = () => createImage(WIDTH, HEIGHT, COLORS.tooltip);

const drawPanel = (image) => drawCard(image, PANEL_CARD.x, PANEL_CARD.y, PANEL_INNER.width, PANEL_INNER.height, COLORS.panel);

// 인화지 카드(테두리·그림자 포함)를 따로 그려 '톡'에 맞춰 키웠다 줄일 수 있게 합니다.
// photoAlpha가 1보다 작으면 사진 뒤 체크무늬(투명)가 드러납니다. decorate는 인화지 안쪽 좌표로 꾸밈을 그립니다.
const createPrintCard = (assets, { photoAlpha = 1, overlay = null } = {}) => {
  const card = createImage(PRINT.width + BORDER * 2 + SHADOW, PRINT.height + BORDER * 2 + SHADOW);
  drawCard(card, 0, 0, PRINT.width, PRINT.height, COLORS.white);
  if (photoAlpha < 1) fillChecker(card, BORDER, BORDER, PRINT.width, PRINT.height);
  drawImage(card, assets.photo, BORDER, BORDER, { alpha: photoAlpha });
  if (overlay) drawImage(card, overlay, BORDER, BORDER);
  return card;
};

const drawPrintCard = (image, card, scale = 1) => {
  // 그림자를 뺀 테두리 상자의 가운데를 기준으로 키웁니다.
  const cx = PRINT_CARD.x + (PRINT.width + BORDER * 2) / 2;
  const cy = PRINT_CARD.y + (PRINT.height + BORDER * 2) / 2;
  drawScaled(image, card, cx + SHADOW / 2, cy + SHADOW / 2, scale);
};

const PRINT_CLIP = { x: PRINT_INNER.x, y: PRINT_INNER.y, width: PRINT.width, height: PRINT.height };

// ---- ① 프레임 ----

// 인화지 위에 씌우는 프레임 세 가지(목록 순서). scale은 인화지 크기 대비 배율이며 목록 썸네일도 같은 그림을 줄여 씁니다.
const FRAME_STYLES = ['white', 'pink', 'film'];
const PICKED_FRAME = 1;

const drawFrameStyle = (image, style, x, y, width, height) => {
  const scale = width / PRINT.width;
  if (style === 'white') {
    fillRect(image, x, y, width, 12 * scale, COLORS.white);
    fillRect(image, x, y + height - 40 * scale, width, 40 * scale, COLORS.white);
    fillRect(image, x, y, 12 * scale, height, COLORS.white);
    fillRect(image, x + width - 12 * scale, y, 12 * scale, height, COLORS.white);
    return;
  }
  if (style === 'pink') {
    const band = 16 * scale;
    fillRect(image, x, y, width, band, COLORS.frame);
    fillRect(image, x, y + height - band, width, band, COLORS.frame);
    fillRect(image, x, y, band, height, COLORS.frame);
    fillRect(image, x + width - band, y, band, height, COLORS.frame);
    const line = Math.max(1, 3 * scale);
    fillRect(image, x + band, y + band, width - band * 2, line, COLORS.white);
    fillRect(image, x + band, y + height - band - line, width - band * 2, line, COLORS.white);
    fillRect(image, x + band, y + band, line, height - band * 2, COLORS.white);
    fillRect(image, x + width - band - line, y + band, line, height - band * 2, COLORS.white);
    // 네 모서리의 흰 점
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      fillRect(image, x + band / 2 - 3 * scale + dx * (width - band), y + band / 2 - 3 * scale + dy * (height - band), 6 * scale, 6 * scale, COLORS.white);
    }
    return;
  }
  // 필름: 양옆 검정 띠에 흰 구멍
  const side = 22 * scale;
  fillRect(image, x, y, side, height, COLORS.ink);
  fillRect(image, x + width - side, y, side, height, COLORS.ink);
  fillRect(image, x, y, width, 10 * scale, COLORS.ink);
  fillRect(image, x, y + height - 10 * scale, width, 10 * scale, COLORS.ink);
  for (let hole = 0; hole < 12; hole += 1) {
    const hy = y + (14 + hole * 28) * scale;
    fillRect(image, x + 7 * scale, hy, 8 * scale, 12 * scale, COLORS.white);
    fillRect(image, x + width - 15 * scale, hy, 8 * scale, 12 * scale, COLORS.white);
  }
};

const THUMB = { width: 52, height: 92 };
const thumbBox = (index) => {
  const outerHeight = THUMB.height + ITEM_BORDER * 2;
  const gap = (PANEL_INNER.height - outerHeight * FRAME_STYLES.length) / (FRAME_STYLES.length + 1);
  const x = Math.round(PANEL_CENTER_X - (THUMB.width + ITEM_BORDER * 2) / 2);
  const y = Math.round(PANEL_INNER.y + gap + index * (outerHeight + gap));
  return { x, y, center: { x: x + THUMB.width / 2 + ITEM_BORDER, y: y + outerHeight / 2 } };
};

const createThumb = (style, picked) => {
  const ring = 5;
  const thumb = createImage(THUMB.width + ITEM_BORDER * 2 + ITEM_SHADOW + ring * 2, THUMB.height + ITEM_BORDER * 2 + ITEM_SHADOW + ring * 2);
  if (picked) fillRect(thumb, 0, 0, THUMB.width + ITEM_BORDER * 2 + ring * 2, THUMB.height + ITEM_BORDER * 2 + ring * 2, COLORS.selected);
  drawCard(thumb, ring, ring, THUMB.width, THUMB.height, COLORS.thumbPhoto, { border: ITEM_BORDER, shadow: ITEM_SHADOW });
  drawFrameStyle(thumb, style, ring + ITEM_BORDER, ring + ITEM_BORDER, THUMB.width, THUMB.height);
  return { sprite: thumb, ring };
};

const buildFramesDemo = (assets) => {
  const total = 75;
  const press = 16;
  const target = thumbBox(PICKED_FRAME).center;
  const keys = [[0, CURSOR_REST], [4, CURSOR_REST], [press - 1, target], [press + 22, target], [press + 36, CURSOR_REST]];
  const overlay = createImage(PRINT.width, PRINT.height);
  drawFrameStyle(overlay, FRAME_STYLES[PICKED_FRAME], 0, 0, PRINT.width, PRINT.height);
  const plainCard = createPrintCard(assets);
  const framedCard = createPrintCard(assets, { overlay });
  const render = (frame, { cursor = true } = {}) => {
    const image = createStage();
    drawPanel(image);
    FRAME_STYLES.forEach((style, index) => {
      const isPicked = index === PICKED_FRAME && frame >= press;
      const { sprite, ring } = createThumb(style, isPicked);
      const box = thumbBox(index);
      const scale = index === PICKED_FRAME ? tocScale(frame, press) : 1;
      drawScaled(image, sprite, box.x - ring + sprite.width / 2, box.y - ring + sprite.height / 2, scale);
    });
    // 누르면 프레임이 인화지에 씌워지며 인화지가 '톡'
    drawPrintCard(image, frame >= press + 1 ? framedCard : plainCard, frame >= press + 1 ? tocScale(frame, press + 1) : 1);
    if (cursor) {
      const point = pathAt(keys, frame);
      drawRipple(image, target, frame, press);
      drawCursor(image, assets, point);
    }
    return image;
  };
  return { total, render, cursorRestFrame: keys[keys.length - 1][0], still: render(total - LOOP_FADE_FRAMES - 1, { cursor: false }) };
};

// ---- ② 글씨 ----

const TEXT_BUTTON = { width: 88, height: 60 };
const textButtonBox = () => ({
  x: Math.round(PANEL_CENTER_X - (TEXT_BUTTON.width + ITEM_BORDER * 2) / 2),
  y: PANEL_INNER.y + 110,
});
const SWATCHES = [COLORS.ink, COLORS.heart, COLORS.white];

const drawTextPanel = (image, pressed) => {
  drawPanel(image);
  const box = textButtonBox();
  // 누른 동안은 그림자 자리로 내려앉습니다(앱 버튼의 눌림).
  const shift = pressed ? ITEM_SHADOW : 0;
  drawCard(image, box.x + shift, box.y + shift, TEXT_BUTTON.width, TEXT_BUTTON.height, COLORS.primary, { border: ITEM_BORDER, shadow: pressed ? 0 : ITEM_SHADOW });
  // T 모양 그림(글씨 넣기)
  const cx = box.x + shift + ITEM_BORDER + TEXT_BUTTON.width / 2;
  const top = box.y + shift + ITEM_BORDER + 12;
  fillRect(image, cx - 18, top, 36, 8, COLORS.ink);
  fillRect(image, cx - 4, top, 8, 36, COLORS.ink);
  // 글씨 색 고르기 칸
  const size = 22;
  const gap = 8;
  const rowWidth = SWATCHES.length * (size + ITEM_BORDER) + (SWATCHES.length - 1) * gap;
  SWATCHES.forEach((color, index) => {
    drawCard(image, PANEL_CENTER_X - rowWidth / 2 + index * (size + ITEM_BORDER + gap), box.y + TEXT_BUTTON.height + 40, size - ITEM_BORDER, size - ITEM_BORDER, color, { border: ITEM_BORDER, shadow: 0 });
  });
};

const buildTextDemo = (assets) => {
  const total = 90;
  const press = 15;
  const typeStart = press + 3;
  const typeFrames = 2; // 한 글자에 걸리는 장 수
  const box = textButtonBox();
  const button = { x: box.x + ITEM_BORDER + TEXT_BUTTON.width / 2, y: box.y + ITEM_BORDER + TEXT_BUTTON.height / 2 };
  const { prefixes } = assets.text;
  const typeEnd = typeStart + prefixes.length * typeFrames;
  const textStart = onPrint(PRINT.width / 2, PRINT.height / 2); // 앱처럼 가운데에 들어갑니다
  const textEnd = onPrint(PRINT.width / 2, 46); // 위쪽 여백
  const grab = typeEnd + 6;
  const drop = grab + 16;
  const keys = [[0, CURSOR_REST], [3, CURSOR_REST], [press - 1, button], [typeEnd - 4, button], [grab - 1, textStart], [drop, textEnd], [drop + 10, textEnd], [drop + 23, CURSOR_REST]];
  const render = (frame, { cursor = true } = {}) => {
    const image = createStage();
    drawTextPanel(image, frame >= press && frame < press + 3);
    drawPrintCard(image, assets.plainCard);
    const shown = Math.min(prefixes.length, Math.floor((frame - typeStart) / typeFrames) + 1);
    if (frame >= typeStart && shown > 0) {
      const sprite = prefixes[shown - 1];
      const at = frame <= grab ? textStart : lerpPoint(textStart, textEnd, ease(progress(frame, grab, drop - grab)));
      // 타이핑 동안 글씨 왼쪽 끝을 고정해 글자가 오른쪽으로 늘어납니다.
      drawScaled(image, sprite, at.x, at.y, tocScale(frame, drop));
    }
    if (cursor) {
      drawRipple(image, button, frame, press);
      drawRipple(image, textStart, frame, grab);
      drawCursor(image, assets, pathAt(keys, frame));
    }
    return image;
  };
  return { total, render, cursorRestFrame: keys[keys.length - 1][0], still: render(total - LOOP_FADE_FRAMES - 1, { cursor: false }) };
};

// ---- ③ 스티커 ----

// 목록에 보일 스티커(public/stickers). 첫째(주황 별)를 끌어다 붙입니다. 하늘색 바탕에서 잘 보이는 색입니다.
const STICKER_FILES = ['1s_11ss', '1s_1ss', '1s_18ss', '1s_22ss', '1s_7ss', '1s_41ss', '1s', '1s_5ss'];
const STICKER_CELL = 44;
const STICKER_ICON = 44;
const STICKER_DROP = 84; // 인화지에 붙인 별 크기
const stickerCellBox = (index) => {
  const columns = 2;
  const outer = STICKER_CELL + ITEM_BORDER * 2;
  const gapX = (PANEL_INNER.width - outer * columns) / (columns + 1);
  const rows = Math.ceil(STICKER_FILES.length / columns);
  const gapY = (PANEL_INNER.height - outer * rows) / (rows + 1);
  const x = Math.round(PANEL_INNER.x + gapX + (index % columns) * (outer + gapX));
  const y = Math.round(PANEL_INNER.y + gapY + Math.floor(index / columns) * (outer + gapY));
  return { x, y, center: { x: x + outer / 2, y: y + outer / 2 } };
};

const buildStickerDemo = (assets) => {
  const total = 75;
  const grab = 14;
  const drop = grab + 18;
  const from = stickerCellBox(0).center;
  const to = onPrint(146, 58); // 위쪽 여백 오른쪽
  const keys = [[0, CURSOR_REST], [3, CURSOR_REST], [grab - 1, from], [grab + 1, from], [drop, to], [drop + 12, to], [drop + 28, CURSOR_REST]];
  const render = (frame, { cursor = true } = {}) => {
    const image = createStage();
    drawPanel(image);
    STICKER_FILES.forEach((_, index) => {
      const box = stickerCellBox(index);
      drawCard(image, box.x, box.y, STICKER_CELL, STICKER_CELL, COLORS.white, { border: ITEM_BORDER, shadow: ITEM_SHADOW });
      drawScaled(image, assets.stickers[index], box.center.x, box.center.y, 1);
    });
    drawPrintCard(image, assets.plainCard);
    if (frame >= grab) {
      // 집으면 목록 칸에서 떨어져 화살표를 따라오고, 오는 동안 붙일 크기로 커집니다.
      const t = ease(progress(frame, grab, drop - grab));
      const at = lerpPoint(from, to, t);
      const size = lerp(STICKER_ICON, STICKER_DROP, t);
      drawScaled(image, assets.stickerLarge, at.x, at.y, (size / STICKER_DROP) * tocScale(frame, drop));
    }
    if (cursor) {
      drawRipple(image, from, frame, grab);
      drawCursor(image, assets, pathAt(keys, frame));
    }
    return image;
  };
  return { total, render, cursorRestFrame: keys[keys.length - 1][0], still: render(total - LOOP_FADE_FRAMES - 1, { cursor: false }) };
};

// ---- ④ 내 사진 스티커 ----

const SLOT = { width: 92, height: 190 };
const slotBox = () => ({
  x: Math.round(PANEL_CENTER_X - (SLOT.width + ITEM_BORDER * 2) / 2),
  y: Math.round(PANEL_INNER.y + (PANEL_INNER.height - SLOT.height - ITEM_BORDER * 2) / 2),
});
const KID_SLOT_HEIGHT = 170;
const KID_DROP_HEIGHT = 132;
// 사진 전체가 바뀌는 장은 용량이 커서 가족사진으로 돌아오는 겹침은 짧게 둡니다.
const FADE_BACK_FRAMES = 3;

// 오리는 선: 아이 모양을 3px 넓힌 띠
const createOutlineSprite = (kid) => {
  const line = createImage(kid.width, kid.height);
  const radius = 3;
  const solid = (x, y) => x >= 0 && y >= 0 && x < kid.width && y < kid.height && kid.data[(y * kid.width + x) * 4 + 3] > 128;
  for (let y = 0; y < kid.height; y += 1) {
    for (let x = 0; x < kid.width; x += 1) {
      if (solid(x, y)) continue;
      let near = false;
      for (let dy = -radius; dy <= radius && !near; dy += 1) {
        for (let dx = -radius; dx <= radius && !near; dx += 1) near = dx * dx + dy * dy <= radius * radius && solid(x + dx, y + dy);
      }
      if (near) line.data.set([0, 0, 0, 255], (y * kid.width + x) * 4);
    }
  }
  return line;
};

const drawHandles = (image, center, sprite) => {
  const box = { x: Math.round(center.x - sprite.width / 2) - 4, y: Math.round(center.y - sprite.height / 2) - 4, width: sprite.width + 8, height: sprite.height + 8 };
  const line = 2;
  fillRect(image, box.x, box.y, box.width, line, COLORS.ink);
  fillRect(image, box.x, box.y + box.height - line, box.width, line, COLORS.ink);
  fillRect(image, box.x, box.y, line, box.height, COLORS.ink);
  fillRect(image, box.x + box.width - line, box.y, line, box.height, COLORS.ink);
  const handle = 12;
  for (const [x, y] of [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]]) {
    fillRect(image, x - handle / 2, y - handle / 2, handle, handle, COLORS.ink);
    fillRect(image, x - handle / 2 + 3, y - handle / 2 + 3, handle - 6, handle - 6, COLORS.white);
  }
};

const buildCutoutDemo = (assets) => {
  const total = 78;
  const tap = 9; // 아이를 눌러 고름
  const wipeStart = tap + 1;
  const wipeFrames = 7;
  const fadeStart = wipeStart + wipeFrames;
  const fadeFrames = 3;
  const flyStart = fadeStart + fadeFrames + 4; // 오린 아이가 결과 자리로
  const flyFrames = 7;
  const grab = flyStart + flyFrames + 8;
  const drop = grab + 14;
  const { kidPrint, kidOutline, kidPosition, kidLarge } = assets.cutout;
  const kidCenterOnPrint = { x: PRINT_INNER.x + kidPosition.x + kidPrint.width / 2, y: PRINT_INNER.y + kidPosition.y + kidPrint.height / 2 };
  const face = { x: kidCenterOnPrint.x, y: PRINT_INNER.y + kidPosition.y + kidPrint.height * 0.17 };
  const slot = slotBox();
  const slotCenter = { x: slot.x + ITEM_BORDER + SLOT.width / 2, y: slot.y + ITEM_BORDER + SLOT.height / 2 };
  const dropCenter = onPrint(PRINT.width / 2, 12 + KID_DROP_HEIGHT / 2); // 위쪽 여백
  const slotScale = KID_SLOT_HEIGHT / kidLarge.height;
  const dropScale = KID_DROP_HEIGHT / kidLarge.height;
  const printScale = kidPrint.height / kidLarge.height;
  const keys = [[0, CURSOR_REST], [1, CURSOR_REST], [tap - 1, face], [flyStart + 2, face], [grab - 1, slotCenter], [drop, dropCenter], [drop + 8, dropCenter], [drop + 18, CURSOR_REST]];
  const render = (frame, { cursor = true } = {}) => {
    const image = createStage();
    drawPanel(image);
    drawCard(image, slot.x, slot.y, SLOT.width, SLOT.height, COLORS.slot, { border: ITEM_BORDER, shadow: ITEM_SHADOW });
    // 배경이 빠졌다가(체크무늬) 아이가 결과 자리로 간 뒤 다시 가족사진으로 돌아옵니다.
    const fadeOut = progress(frame, fadeStart, fadeFrames);
    const fadeBack = progress(frame, flyStart, FADE_BACK_FRAMES);
    const photoAlpha = 1 - fadeOut + fadeBack;
    drawPrintCard(image, photoAlpha >= 1 ? assets.plainCard : createPrintCard(assets, { photoAlpha: clamp01(photoAlpha) }));
    // 테두리가 위에서 아래로 그어지며 아이가 오려집니다.
    if (frame >= wipeStart && frame < flyStart) {
      const rows = Math.ceil(kidPrint.height * progress(frame + 1, wipeStart, wipeFrames));
      const lineAlpha = 1 - progress(frame, fadeStart, fadeFrames);
      const x = PRINT_INNER.x + kidPosition.x;
      const y = PRINT_INNER.y + kidPosition.y;
      if (lineAlpha > 0) drawImage(image, kidOutline, x, y, { clip: PRINT_CLIP, rowLimit: rows, alpha: lineAlpha });
      drawImage(image, kidPrint, x, y, { clip: PRINT_CLIP, rowLimit: rows });
    }
    if (frame >= flyStart) {
      let center;
      let scale;
      if (frame < grab) {
        const t = ease(progress(frame, flyStart, flyFrames));
        center = lerpPoint(kidCenterOnPrint, slotCenter, t);
        scale = lerp(printScale, slotScale, t);
      } else {
        const t = ease(progress(frame, grab, drop - grab));
        center = lerpPoint(slotCenter, dropCenter, t);
        scale = lerp(slotScale, dropScale, t) * tocScale(frame, drop);
      }
      drawScaled(image, kidLarge, center.x, center.y, scale);
      if (frame >= drop + 1) drawHandles(image, dropCenter, { width: kidLarge.width * dropScale, height: KID_DROP_HEIGHT });
    }
    if (cursor) {
      drawRipple(image, face, frame, tap);
      drawRipple(image, slotCenter, frame, grab);
      drawCursor(image, assets, pathAt(keys, frame));
    }
    return image;
  };
  return { total, render, cursorRestFrame: keys[keys.length - 1][0], still: render(total - LOOP_FADE_FRAMES - 1, { cursor: false }) };
};

// ---- 재료 읽기 ----

// 글씨를 한 글자씩 늘려 가며 그린 그림들. 모두 같은 크기이고 글씨 전체가 가운데 오도록 왼쪽 끝이 같습니다.
const renderTextPrefixes = (workDir) => {
  const characters = Array.from(DEMO_TEXT);
  const size = { width: 200, height: 44 };
  const fontSize = 23;
  const fontFile = FONT_PATH.replace(/:/g, '\\:');
  const renderPrefix = (text, index) => {
    const textPath = join(workDir, `text-${index}.txt`);
    writeFileSync(textPath, text);
    const data = run('ffmpeg', [
      '-v', 'error', '-f', 'lavfi', '-i', `color=c=black@0:s=${size.width}x${size.height},format=rgba`,
      // 흰 테두리를 먼저 그리고 그 위에 검정 글씨(테두리 1px로 굵게)를 그려 사진 어디에서든 읽히게 합니다.
      '-vf', [['white', 4], ['black', 1]].map(([color, border]) => `drawtext=fontfile=${fontFile}:textfile=${textPath}:fontsize=${fontSize}`
        + `:fontcolor=${color}:borderw=${border}:bordercolor=${color}:x=6:y=(h-${fontSize})/2-2`).join(','),
      '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-',
    ]);
    return { ...size, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };
  };
  // 글씨(흰 테두리 포함)가 칠해진 가장 왼쪽·오른쪽 열
  const inkColumns = (image) => {
    let left = image.width;
    let right = -1;
    for (let index = 0; index < image.width * image.height; index += 1) {
      if (image.data[index * 4 + 3] === 0) continue;
      left = Math.min(left, index % image.width);
      right = Math.max(right, index % image.width);
    }
    return { left, right };
  };
  const prefixes = characters.map((_, index) => renderPrefix(characters.slice(0, index + 1).join(''), index));
  const full = inkColumns(prefixes[prefixes.length - 1]);
  if (full.left <= 0 || full.right >= size.width - 1) fail('글씨가 그림 폭보다 깁니다. DEMO_TEXT를 줄여 주세요.');
  // ♥(마지막 글자)는 검정 부분만 빨갛게 칠합니다. ♥ 앞까지 그린 그림의 오른쪽 끝 뒤가 ♥입니다.
  const heartLeft = characters.length > 1 && characters[characters.length - 1] === '♥' ? inkColumns(prefixes[prefixes.length - 2]).right + 1 : Infinity;
  // 글씨 전체가 그림 가운데 오게 모든 그림을 같은 만큼 옮깁니다(타이핑 동안 왼쪽 끝이 고정됨).
  const shift = Math.round(size.width / 2 - (full.left + full.right + 1) / 2);
  return prefixes.map((image) => {
    const centered = createImage(size.width, size.height);
    for (let y = 0; y < size.height; y += 1) {
      for (let x = 0; x < size.width; x += 1) {
        const offset = (y * size.width + x) * 4;
        const alpha = image.data[offset + 3];
        const tx = x + shift;
        if (alpha === 0 || tx < 0 || tx >= size.width) continue;
        let rgb = [image.data[offset], image.data[offset + 1], image.data[offset + 2]];
        if (x >= heartLeft) {
          const lightness = rgb[0] / 255; // 흰 테두리와 검정 글씨 사이의 회색 값
          rgb = COLORS.heart.map((value) => value * (1 - lightness) + 255 * lightness);
        }
        centered.data.set([...rgb, alpha], (y * size.width + tx) * 4);
      }
    }
    return centered;
  });
};

const readSticker = (name, size) => readRgba(join(STICKER_DIR, `${name}.png`), size, size,
  `scale=${size}:${size}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=black@0`);

const loadAssets = (photoPath, cutoutPath, workDir) => {
  const natural = readSize(photoPath);
  const working = getWorkingSize(natural);
  const sticker = readSize(cutoutPath);
  if (sticker.width > working.width || sticker.height > working.height) fail('오린 PNG가 사진보다 큽니다. 같은 사진에서 오린 PNG인지 확인해 주세요.');
  const at = locateSticker(photoPath, cutoutPath, working, sticker);
  console.log(`오린 PNG 위치: 작업 사진(${working.width}×${working.height})의 (${at.x}, ${at.y}), 평균 차이 ${at.difference.toFixed(1)}`);

  // 사진을 인화지(9:16)에 꽉 차게 맞추고 가운데를 자릅니다.
  const scale = Math.max(PRINT.width / working.width, PRINT.height / working.height);
  const scaledWidth = Math.round(working.width * scale);
  const scaledHeight = Math.round(working.height * scale);
  const cropX = Math.round((scaledWidth - PRINT.width) / 2);
  const cropY = Math.round((scaledHeight - PRINT.height) / 2);
  const photo = readRgba(photoPath, PRINT.width, PRINT.height, `scale=${scaledWidth}:${scaledHeight}:flags=lanczos,crop=${PRINT.width}:${PRINT.height}:${cropX}:${cropY}`);
  const kidPrint = readRgba(cutoutPath, Math.round(sticker.width * scale), Math.round(sticker.height * scale));
  const kidPosition = { x: Math.round(at.x * scale) - cropX, y: Math.round(at.y * scale) - cropY };
  // 결과 자리와 붙일 때 쓰는 큰 그림(가장 큰 쓰임인 결과 자리 높이에 맞춤)
  const largeHeight = KID_SLOT_HEIGHT;
  const kidLarge = readRgba(cutoutPath, Math.round((sticker.width * largeHeight) / sticker.height), largeHeight);

  const assets = {
    photo,
    cursor: createCursorSprite(),
    text: { prefixes: renderTextPrefixes(workDir) },
    stickers: STICKER_FILES.map((name) => readSticker(name, STICKER_ICON)),
    stickerLarge: readSticker(STICKER_FILES[0], STICKER_DROP),
    cutout: { kidPrint, kidOutline: createOutlineSprite(kidPrint), kidPosition, kidLarge },
  };
  assets.plainCard = createPrintCard(assets);
  return assets;
};

// ---- 인코딩 ----

const encodeDemo = (name, demo, outDir) => {
  const loopStart = demo.total - LOOP_FADE_FRAMES;
  // 겹쳐 돌아가는 동안 화살표가 아직 움직이면 두 자리에 겹쳐 보이므로, 그 전에 쉬는 자리에 와 있어야 합니다.
  if (demo.cursorRestFrame > loopStart - 1) fail(`${name}: 화살표가 ${demo.cursorRestFrame}장에야 쉬는 자리에 옵니다(${loopStart - 1}장까지 와야 함).`);
  const first = demo.render(0);
  const last = demo.render(loopStart - 1);
  const frames = [];
  for (let frame = 0; frame < demo.total; frame += 1) {
    // 끝에서는 결과 장면이 처음 장면으로 겹쳐 돌아가 반복 이음매가 튀지 않습니다.
    const image = frame < loopStart ? demo.render(frame) : mixImages(last, first, (frame - loopStart + 1) / (LOOP_FADE_FRAMES + 1));
    frames.push(Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength));
  }
  const animPath = join(outDir, `${name}-demo.webp`);
  const stillPath = join(outDir, `${name}-demo-still.png`);
  run('ffmpeg', [
    '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${WIDTH}x${HEIGHT}`, '-r', String(FPS), '-i', '-',
    '-an', '-pix_fmt', 'yuv420p', '-c:v', 'libwebp_anim', '-lossless', '0', '-quality', '65', '-preset', 'picture',
    '-compression_level', '6', '-loop', '0', '-map_metadata', '-1', animPath,
  ], { input: Buffer.concat(frames), stdio: ['pipe', 'inherit', 'inherit'] });
  // 정지 PNG: 꾸민 뒤의 결과 장면 한 장을 256색으로 줄여 저장
  run('ffmpeg', [
    '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${WIDTH}x${HEIGHT}`, '-i', '-',
    '-vf', 'format=rgb24,split=2[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a',
    '-frames:v', '1', '-update', '1', '-map_metadata', '-1', stillPath,
  ], { input: Buffer.from(demo.still.data.buffer, demo.still.data.byteOffset, demo.still.data.byteLength), stdio: ['pipe', 'inherit', 'inherit'] });
  console.log(`${animPath} ${statSync(animPath).size} B (${demo.total}장, ${(demo.total / FPS).toFixed(2)}초)`);
  console.log(`${stillPath} ${statSync(stillPath).size} B`);
};

const main = () => {
  const [photoArg, cutoutArg, outArg] = process.argv.slice(2);
  if (!photoArg || !cutoutArg) fail('사용법: node scripts/build-tutorial-demos.mjs <가족사진> <오린 아이 PNG> [출력 폴더]');
  const photoPath = resolve(photoArg);
  const cutoutPath = resolve(cutoutArg);
  const outDir = resolve(outArg ?? join(REPO, 'public', 'tutorial'));
  checkFfmpeg();
  const workDir = mkdtempSync(join(tmpdir(), 'tutorial-demos-'));
  try {
    const assets = loadAssets(photoPath, cutoutPath, workDir);
    mkdirSync(outDir, { recursive: true });
    encodeDemo('frames', buildFramesDemo(assets), outDir);
    encodeDemo('text', buildTextDemo(assets), outDir);
    encodeDemo('sticker', buildStickerDemo(assets), outDir);
    encodeDemo('cutout', buildCutoutDemo(assets), outDir);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
};

try {
  main();
} catch (error) {
  if (error instanceof DemoBuildError) {
    console.error(error.message);
  } else {
    // ffmpeg·ffprobe가 실패하면 그 오류 출력이 위에 이미 찍혀 있습니다.
    console.error('시연 그림을 만들지 못했습니다:', error.message);
  }
  process.exitCode = 1;
}
