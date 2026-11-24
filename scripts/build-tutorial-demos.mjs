// 튜토리얼 ①프레임 ②글씨 ③스티커 ④내 사진 스티커 단계와 오른쪽 편집 카드의 ⑤바닥 얼룩 지우기 ⑥사진 색 ⑦프레임 색
// 단계의 시연 그림을 만듭니다(사람이 필요할 때 직접 돌리는 스크립트, 빌드에 연결하지 않음).
//
// 사용법
//   node scripts/build-tutorial-demos.mjs <가족사진> <오린 아이 PNG> <전신 가족사진> [출력 폴더]
//   출력 폴더를 빼면 public/tutorial/에 단계마다 <단계>-demo.webp(반복 애니메이션)와 <단계>-demo-still.png(정지 한 장)를
//   씁니다. 단계는 frames, text, sticker, cutout, erase, color, frameColor입니다(14개 파일).
//   ffmpeg(libwebp_anim, drawtext 포함)와 ffprobe가 PATH에 있어야 합니다. 예: sudo apt install ffmpeg / brew install ffmpeg
//
// 지금 들어 있는 시연 사진(원본은 저장소에 넣지 않음)
//   가족사진(①~④): AI로 만든 실사풍 가족사진입니다(Codex image_gen, 2026-11-24 생성). 실존 인물이 아닙니다. 세로 9:16, 941×1672.
//   오린 아이 PNG는 이 앱의 '내 사진 스티커'에서 사람을 '눌러서 고르기'로 아이 얼굴을 눌러 만들고(흰 테두리 켬)
//   '이 스티커만 저장'으로 받은 그대로입니다.
//   전신 가족사진(⑤~⑦): AI로 만든 실사풍 전신 가족사진입니다(Codex image_gen, 2026-11-24 생성). 실존 인물이 아닙니다.
//   세로 9:16, 941×1672, 바닥이 깨끗한 사진입니다. ⑤의 얼룩은 이 스크립트가 그려 넣습니다(STAINS).
//
// 매장 사진으로 바꾸는 방법
//   1. 세로 9:16 사진을 고릅니다. 위쪽 1/3쯤은 글씨·스티커가 들어갈 단순한 여백이면 좋습니다.
//   2. 앱에 사진을 넣고 '내 사진 스티커'로 한 사람을 오린 뒤, 뒤집거나 지우지 않은 채 '이 스티커만 저장'으로 PNG를 받습니다.
//   3. 앱에 넣은 원본 사진과 받은 PNG를 이 스크립트에 넣습니다. 스크립트가 PNG가 사진의 어디에서 오렸는지 스스로 찾습니다.
//      ①의 아래 칸에 크게 넣는 얼굴도 그 자리(오린 사람의 얼굴 둘레)에서 잘라 냅니다.
//      ②의 글씨를 바꾸려면 아래 DEMO_TEXT를 고칩니다.
//   4. 전신 사진은 발 아래 바닥이 깨끗한 세로 9:16 사진을 씁니다. 발 앞 빈 바닥에 얼룩이 오도록 STAINS와 붓길
//      ERASE_STROKE를 옮기고(붓이 얼룩을 다 덮지 못하면 스크립트가 멈추고 알려 줌), ⑦의 두 칸에 넣을 자리는
//      FRAME_FILL_CROPS로 고릅니다.
//   5. public/tutorial/의 열네 파일을 눈으로 확인하고 커밋합니다(각 WebP 150KB, PNG 80KB 이하. 스크립트가 넣기 전에,
//      tests/ui/tutorialSteps.test.ts가 커밋 전에 확인). 열네 개가 다 만들어지고 한도 안일 때만 폴더를 바꿉니다.
//
// 그림 속 글자: ②의 DEMO_TEXT와, ⑤~⑦ 왼쪽 판의 앱 버튼 이름(얼룩/지우기, 따뜻하게, 자세히, 밝기, 선명하게, 색감,
// 따뜻함, 숫자 0·5·10·15·25·30, 프레임 색/바꾸기)입니다. 글꼴은 public/font/NotoSansKR-Light.ttf입니다. 파일의 이름 표
// (name ID 13)에 'SIL Open Font License, Version 1.1'이 적혀 있어 상업 이용과 그림으로 넣기가 됩니다. ♥(U+2665)도 이 글꼴에 있습니다.
//
// 만드는 방법: 장면 합성은 이 스크립트가 RGBA 화소로 직접 합니다(마우스 화살표의 이동·누름 물결·끌기·'톡'을 장마다 계산해야
// 해서 FFmpeg 필터 식으로는 지나치게 복잡해짐). FFmpeg는 사진·스티커 읽기와 크기 조정, 색 바꾸기(⑥), 글자 그리기, 인코딩을 맡습니다.
// 인코딩은 반드시 libwebp_anim입니다(일반 libwebp는 장면 사이 중복을 못 줄여 열 배 넘게 커짐). 손실 인코딩은 앞 장과 차이가
// 작은 8×8 칸을 그대로 두므로, 사진 전체가 여러 장에 걸쳐 조금씩 바뀌는 장면은 만들지 않습니다(네모 얼룩이 남음).
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
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
  selected: [255, 183, 3], // --linear-accent-warning(고른 칸 배치 카드)
  heart: [230, 57, 70], // --linear-accent-error(글씨의 ♥)
  thumbPhoto: [217, 217, 217], // 칸 배치의 빈 사진 칸
  white: [255, 255, 255],
};
const CHECKER_LIGHT = 255;
const CHECKER_DARK = 221;
const CHECKER_SIZE = 10;
const WORKING_MAX_SIDE = 2048; // src/photo/cutoutRender.ts CUTOUT_WORKING_MAX_SIDE: 오린 PNG는 이 크기의 작업 사진에서 잘립니다
// 파일 용량 한도(tests/ui/tutorialSteps.test.ts의 ANIMATION_MAX_BYTES·STILL_MAX_BYTES와 같음)
const ANIMATION_MAX_BYTES = 150 * 1024;
const STILL_MAX_BYTES = 80 * 1024;
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
// photoAlpha가 1보다 작으면 사진 뒤 체크무늬(투명)가 드러납니다.
const createPrintCard = (assets, { photoAlpha = 1 } = {}) => {
  const card = createImage(PRINT.width + BORDER * 2 + SHADOW, PRINT.height + BORDER * 2 + SHADOW);
  drawCard(card, 0, 0, PRINT.width, PRINT.height, COLORS.white);
  if (photoAlpha < 1) fillChecker(card, BORDER, BORDER, PRINT.width, PRINT.height);
  drawImage(card, assets.photo, BORDER, BORDER, { alpha: photoAlpha });
  return card;
};

const drawPrintCard = (image, card, scale = 1) => {
  // 그림자를 뺀 테두리 상자의 가운데를 기준으로 키웁니다.
  const cx = PRINT_CARD.x + (PRINT.width + BORDER * 2) / 2;
  const cy = PRINT_CARD.y + (PRINT.height + BORDER * 2) / 2;
  drawScaled(image, card, cx + SHADOW / 2, cy + SHADOW / 2, scale);
};

const PRINT_CLIP = { x: PRINT_INNER.x, y: PRINT_INNER.y, width: PRINT.width, height: PRINT.height };

// ---- ① 프레임(칸 배치 고르기 + 빈 칸에 사진 넣기) ----

// 목록의 칸 배치 카드(위에서부터). 앱 ① 단계처럼 사진 몇 장으로 만들지 고르면 인화지가 그 빈 칸들로 바뀝니다.
const LAYOUTS = [{ rows: 1, cols: 1 }, { rows: 2, cols: 1 }, { rows: 2, cols: 2 }];
const PICKED_LAYOUT = 1; // 2칸
const PRINT_SLOT_PAD = 10; // 인화지 가장자리와 칸 사이
const PRINT_SLOT_GAP = 8; // 칸 사이

// 칸 배치를 width×height 안의 칸 상자 목록(왼쪽 위부터 줄 순서)으로 나눕니다.
const layoutSlots = ({ rows, cols }, width, height, pad, gap) => {
  const slotWidth = (width - pad * 2 - gap * (cols - 1)) / cols;
  const slotHeight = (height - pad * 2 - gap * (rows - 1)) / rows;
  return Array.from({ length: rows * cols }, (_, index) => ({
    x: pad + (index % cols) * (slotWidth + gap),
    y: pad + Math.floor(index / cols) * (slotHeight + gap),
    width: slotWidth,
    height: slotHeight,
  }));
};

// 고른 배치의 인화지 칸. 칸에 넣을 사진도 이 크기로 미리 잘라 둡니다(loadAssets).
const PRINT_SLOTS = layoutSlots(LAYOUTS[PICKED_LAYOUT], PRINT.width, PRINT.height, PRINT_SLOT_PAD, PRINT_SLOT_GAP);
const SLOT_FILL_SIZE = { width: Math.round(PRINT_SLOTS[0].width), height: Math.round(PRINT_SLOTS[0].height) };
// 인화지와 칸의 '톡'은 작게(최대 약 1.05배) 해서 인화지가 무대 밖으로, 칸이 인화지 테두리 밖으로 넘치지 않게 합니다.
const softTocScale = (frame, dropFrame) => 1 + (tocScale(frame, dropFrame) - 1) * 0.25;

const THUMB = { width: 52, height: 92 };
const thumbBox = (index) => {
  const outerHeight = THUMB.height + ITEM_BORDER * 2;
  const gap = (PANEL_INNER.height - outerHeight * LAYOUTS.length) / (LAYOUTS.length + 1);
  const x = Math.round(PANEL_CENTER_X - (THUMB.width + ITEM_BORDER * 2) / 2);
  const y = Math.round(PANEL_INNER.y + gap + index * (outerHeight + gap));
  return { x, y, center: { x: x + THUMB.width / 2 + ITEM_BORDER, y: y + outerHeight / 2 } };
};

// 앱 사이드바 카드처럼 흰 카드에 회색 빈 칸을 그린 썸네일. 고르면 노란 테를 두릅니다.
const createThumb = (layout, picked) => {
  const ring = 5;
  const thumb = createImage(THUMB.width + ITEM_BORDER * 2 + ITEM_SHADOW + ring * 2, THUMB.height + ITEM_BORDER * 2 + ITEM_SHADOW + ring * 2);
  if (picked) fillRect(thumb, 0, 0, THUMB.width + ITEM_BORDER * 2 + ring * 2, THUMB.height + ITEM_BORDER * 2 + ring * 2, COLORS.selected);
  drawCard(thumb, ring, ring, THUMB.width, THUMB.height, COLORS.white, { border: ITEM_BORDER, shadow: ITEM_SHADOW });
  for (const slot of layoutSlots(layout, THUMB.width, THUMB.height, 4, 3)) {
    fillRect(thumb, ring + ITEM_BORDER + slot.x, ring + ITEM_BORDER + slot.y, slot.width, slot.height, COLORS.thumbPhoto);
  }
  return { sprite: thumb, ring };
};

// 빈 인화지(아직 안 고름) 또는 고른 배치의 빈 칸이 있는 인화지
const createLayoutCard = (slots) => {
  const card = createImage(PRINT.width + BORDER * 2 + SHADOW, PRINT.height + BORDER * 2 + SHADOW);
  drawCard(card, 0, 0, PRINT.width, PRINT.height, COLORS.white);
  for (const slot of slots) fillRect(card, BORDER + slot.x, BORDER + slot.y, slot.width, slot.height, COLORS.thumbPhoto);
  return card;
};

const buildFramesDemo = (assets) => {
  const total = 80;
  const pick = 14; // 2칸 카드를 누름
  const fills = [
    { press: 30, sprite: assets.frames.familySlot }, // 위 칸: 가족사진
    { press: 46, sprite: assets.frames.faceSlot }, // 아래 칸: 아이 얼굴 크게
  ];
  const card = thumbBox(PICKED_LAYOUT).center;
  const slotCenters = PRINT_SLOTS.map((slot) => onPrint(slot.x + slot.width / 2, slot.y + slot.height / 2));
  const keys = [
    [0, CURSOR_REST], [4, CURSOR_REST], [pick - 1, card], [pick + 2, card],
    [fills[0].press - 1, slotCenters[0]], [fills[0].press + 2, slotCenters[0]],
    [fills[1].press - 1, slotCenters[1]], [fills[1].press + 3, slotCenters[1]],
    [fills[1].press + 18, CURSOR_REST],
  ];
  const blankCard = createLayoutCard([]);
  const slotsCard = createLayoutCard(PRINT_SLOTS);
  const render = (frame, { cursor = true } = {}) => {
    const image = createStage();
    drawPanel(image);
    LAYOUTS.forEach((layout, index) => {
      const isPicked = index === PICKED_LAYOUT && frame >= pick;
      const { sprite, ring } = createThumb(layout, isPicked);
      const box = thumbBox(index);
      const scale = index === PICKED_LAYOUT ? tocScale(frame, pick) : 1;
      drawScaled(image, sprite, box.x - ring + sprite.width / 2, box.y - ring + sprite.height / 2, scale);
    });
    // 카드를 누르면 인화지가 그 배치의 빈 칸들로 바뀌며 '톡'
    const picked = frame >= pick + 1;
    drawPrintCard(image, picked ? slotsCard : blankCard, picked ? softTocScale(frame, pick + 1) : 1);
    // 빈 칸을 누르면 사진이 그 칸에 '톡' 들어갑니다.
    fills.forEach(({ press, sprite }, index) => {
      if (frame < press + 1) return;
      drawScaled(image, sprite, slotCenters[index].x, slotCenters[index].y, softTocScale(frame, press + 1));
    });
    if (cursor) {
      drawRipple(image, card, frame, pick);
      fills.forEach(({ press }, index) => drawRipple(image, slotCenters[index], frame, press));
      drawCursor(image, assets, pathAt(keys, frame));
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

// ---- 오른쪽 편집 카드: ⑤ 바닥 얼룩 지우기 ⑥ 사진 색 ⑦ 프레임 색 ----
// 세 시연은 전신 가족사진을 씁니다. 왼쪽 목록 자리에는 앱의 오른쪽 편집 카드를 닮은 패널과 그 안의 버튼을 그립니다.
// 그림 속 버튼 이름은 손님이 실제 화면에서 찾아야 하는 것만 넣습니다(얼룩 지우기, 따뜻하게, 자세히, 밝기·선명하게·색감·따뜻함,
// 프레임 색 바꾸기).

const LABEL_SIZE = 20; // 버튼 이름 글자 크기(2배 기준. 화면에서는 10px)
const VALUE_SIZE = 18; // ⑥ 보정 값 숫자
const CARD_BUTTON = { x: PANEL_INNER.x + 4, width: PANEL_INNER.width - 8 - ITEM_BORDER * 2 - ITEM_SHADOW }; // 패널 안 버튼(안쪽 폭)
const PRIMARY_FILL = COLORS.primary; // 앱의 linear-button--primary 바탕
const SECONDARY_FILL = COLORS.white; // 앱의 linear-button--secondary 바탕
const BRUSH_PREVIEW = { color: [255, 107, 53], alpha: 0.5 }; // src/photo/photoTool.ts ERASE_PREVIEW_COLOR

// box는 { x, y(테두리 바깥 왼쪽 위), width, height(안쪽) }입니다. 누른 동안은 그림자 자리로 내려앉습니다(앱 버튼의 눌림).
const drawButton = (image, box, fill, pressed = false) => {
  const shift = pressed ? ITEM_SHADOW : 0;
  drawCard(image, box.x + shift, box.y + shift, box.width, box.height, fill, { border: ITEM_BORDER, shadow: pressed ? 0 : ITEM_SHADOW });
  return { x: box.x + shift + ITEM_BORDER + box.width / 2, y: box.y + shift + ITEM_BORDER + box.height / 2 };
};
const buttonCenter = (box) => ({ x: box.x + ITEM_BORDER + box.width / 2, y: box.y + ITEM_BORDER + box.height / 2 });
const drawCentered = (image, sprite, cx, cy) => drawImage(image, sprite, Math.round(cx - sprite.width / 2), Math.round(cy - sprite.height / 2));

// 굵기 width의 꺾은선(가장자리 부드럽게)
const drawPolyline = (image, points, width, [r, g, b]) => {
  const reach = width / 2 + 1;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  for (let py = Math.floor(Math.min(...ys) - reach); py <= Math.ceil(Math.max(...ys) + reach); py += 1) {
    for (let px = Math.floor(Math.min(...xs) - reach); px <= Math.ceil(Math.max(...xs) + reach); px += 1) {
      let distance = Infinity;
      for (let index = 1; index < points.length; index += 1) {
        distance = Math.min(distance, distanceToSegment(px + 0.5, py + 0.5, points[index - 1], points[index]));
      }
      const coverage = clamp01(width / 2 + 0.5 - distance);
      if (coverage > 0) blendPixel(image, px, py, r, g, b, coverage);
    }
  }
};

// 같은 자리면 언제나 같은 값인 0~1 잡음(얼룩 결이 장마다 바뀌지 않게)
const hashNoise = (x, y, seed) => {
  let hash = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
};
const smoothNoise = (x, y, seed) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = lerp(hashNoise(ix, iy, seed), hashNoise(ix + 1, iy, seed), sx);
  const bottom = lerp(hashNoise(ix, iy + 1, seed), hashNoise(ix + 1, iy + 1, seed), sx);
  return lerp(top, bottom, sy);
};
const smoothstep = (edge0, edge1, value) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

// ---- ⑤ 바닥 얼룩 지우기 ----

// 깨끗한 바닥에 그려 넣는 얼룩(인화지 비율 좌표). 신발에 끌린 회색 긁힘 하나와 작은 자국 하나입니다.
// 매장 사진으로 바꾸면 발 앞 빈 바닥에 오도록 이 값과 ERASE_STROKE를 옮깁니다.
const STAINS = [
  { kind: 'scuff', x: 0.53, y: 0.845, length: 0.34, thickness: 0.026, angle: -9, darkness: 0.46, seed: 3 },
  { kind: 'spot', x: 0.24, y: 0.915, rx: 0.075, ry: 0.03, darkness: 0.34, seed: 7 },
];
const STAIN_TINT = [0.85, 1, 1.22]; // 흙 묻은 회갈색(빨강보다 파랑을 더 어둡게)
// 붓질(인화지 비율 좌표): 왼쪽 자국을 문지른 뒤 긁힘을 따라 오른쪽 위로 칠합니다.
const ERASE_STROKE = [[0.1, 0.915], [0.38, 0.915], [0.34, 0.862], [0.54, 0.846], [0.73, 0.825]];
const ERASE_BRUSH_RADIUS = 14;

// 얼룩 세기(0~1) 지도. 바닥 결과 그림자가 살도록 사진에 곱해 어둡게 합니다.
const createStainMap = () => {
  const map = new Float32Array(PRINT.width * PRINT.height);
  for (let py = 0; py < PRINT.height; py += 1) {
    for (let px = 0; px < PRINT.width; px += 1) {
      let strength = 0;
      for (const stain of STAINS) {
        const cx = stain.x * PRINT.width;
        const cy = stain.y * PRINT.height;
        const dx = px + 0.5 - cx;
        const dy = py + 0.5 - cy;
        const edgeNoise = smoothNoise(px / 5, py / 5, stain.seed) - 0.5;
        if (stain.kind === 'scuff') {
          const angle = (stain.angle * Math.PI) / 180;
          const along = dx * Math.cos(angle) + dy * Math.sin(angle);
          const across = -dx * Math.sin(angle) + dy * Math.cos(angle);
          const halfLength = (stain.length * PRINT.width) / 2;
          const halfThickness = (stain.thickness * PRINT.height) / 2 * (1 + 0.5 * (smoothNoise(along / 9, 0.5, stain.seed + 1) - 0.5));
          // 한쪽 끝(끌기 시작)이 진하고 다른 끝으로 가며 옅어지는 긁힘. 결을 따라 가는 줄무늬가 있습니다.
          const lengthFade = smoothstep(-halfLength, -halfLength * 0.7, along) * (1 - smoothstep(halfLength * 0.2, halfLength, along) * 0.75)
            * (1 - smoothstep(halfLength * 0.85, halfLength * 1.1, along));
          const acrossFade = 1 - smoothstep(halfThickness * 0.6, halfThickness * (1 + 0.4 * edgeNoise), Math.abs(across));
          const streaks = 0.4 + 0.6 * smoothNoise(along / 16, across / 1.2, stain.seed + 2);
          strength = Math.max(strength, stain.darkness * lengthFade * acrossFade * streaks);
        } else {
          const radius = Math.hypot(dx / (stain.rx * PRINT.width), dy / (stain.ry * PRINT.height));
          const blotch = 1 - smoothstep(0.35, 1 + edgeNoise * 0.6, radius);
          const mottle = 0.7 + 0.3 * smoothNoise(px / 3, py / 3, stain.seed + 3);
          strength = Math.max(strength, stain.darkness * blotch * mottle);
        }
      }
      map[py * PRINT.width + px] = strength;
    }
  }
  return map;
};

const applyStains = (photo, stainMap) => {
  const stained = copyImage(photo);
  for (let index = 0; index < stainMap.length; index += 1) {
    const strength = stainMap[index];
    if (strength <= 0) continue;
    for (let channel = 0; channel < 3; channel += 1) {
      stained.data[index * 4 + channel] = photo.data[index * 4 + channel] * (1 - Math.min(0.95, strength * STAIN_TINT[channel]));
    }
  }
  return stained;
};

// 붓이 지나간 자리(0~1). from→to 사이를 2px마다 둥근 붓으로 찍습니다.
const stampBrush = (mask, from, to) => {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 2));
  for (let step = 0; step <= steps; step += 1) {
    const cx = lerp(from.x, to.x, step / steps);
    const cy = lerp(from.y, to.y, step / steps);
    for (let py = Math.floor(cy - ERASE_BRUSH_RADIUS - 1); py <= Math.ceil(cy + ERASE_BRUSH_RADIUS + 1); py += 1) {
      for (let px = Math.floor(cx - ERASE_BRUSH_RADIUS - 1); px <= Math.ceil(cx + ERASE_BRUSH_RADIUS + 1); px += 1) {
        if (px < 0 || py < 0 || px >= PRINT.width || py >= PRINT.height) continue;
        const coverage = clamp01(ERASE_BRUSH_RADIUS + 0.5 - Math.hypot(px + 0.5 - cx, py + 0.5 - cy));
        const index = py * PRINT.width + px;
        mask[index] = Math.max(mask[index], coverage);
      }
    }
  }
};

const ERASE_BUTTON = { x: CARD_BUTTON.x, y: PANEL_INNER.y + 16, width: CARD_BUTTON.width, height: 112 };

// 얼룩 지우기 버튼: 앱과 같은 지우개 그림과 이름. 칠하는 동안은 노란 바탕(앱의 '지우는 중' 표시)입니다.
const drawEraseButton = (image, assets, { pressed, active }) => {
  const center = drawButton(image, ERASE_BUTTON, active ? COLORS.selected : PRIMARY_FILL, pressed);
  const icon = { x: center.x - 18, y: center.y - 50, scale: 1.5 }; // 앱 버튼 svg(24×24)를 1.5배
  const at = ([x, y]) => [icon.x + x * icon.scale, icon.y + y * icon.scale];
  drawPolyline(image, [[14, 3], [21, 10], [12, 19], [5, 12], [14, 3]].map(at), 3.4, COLORS.ink);
  drawPolyline(image, [[9, 8], [16, 15]].map(at), 3.4, COLORS.ink);
  drawPolyline(image, [[3, 22], [21, 22]].map(at), 3.4, COLORS.ink);
  const [first, second] = assets.card.labels.erase;
  drawCentered(image, first, center.x, center.y + 8);
  drawCentered(image, second, center.x, center.y + 34);
};

const buildEraseDemo = (assets) => {
  const { stained, clean, stainMap } = assets.card.erase;
  const press = 12;
  const paintStart = press + 12; // 첫 붓 자리에 닿는 장
  const strokePoints = ERASE_STROKE.map(([x, y]) => onPrint(x * PRINT.width, y * PRINT.height));
  const strokeFrames = 4; // 붓 자리 사이에 걸리는 장 수
  const paintEnd = paintStart + (strokePoints.length - 1) * strokeFrames; // 손을 떼는 장
  const healFrames = 4; // 칠한 자리가 깨끗한 바닥으로 바뀌는 장 수
  const total = paintEnd + healFrames + 30;
  const button = buttonCenter(ERASE_BUTTON);
  const strokeKeys = strokePoints.map((point, index) => [paintStart + index * strokeFrames, point]);
  const keys = [[0, CURSOR_REST], [3, CURSOR_REST], [press - 1, button], [press + 2, button], ...strokeKeys, [paintEnd + 6, strokePoints[strokePoints.length - 1]], [paintEnd + 20, CURSOR_REST]];
  // 장마다 그때까지 칠한 자리(인화지 좌표). 붓은 화살표 끝을 따라갑니다.
  const masks = [];
  const mask = new Float32Array(PRINT.width * PRINT.height);
  for (let frame = paintStart; frame <= paintEnd; frame += 1) {
    const from = pathAt(keys, Math.max(paintStart, frame - 1));
    const to = pathAt(keys, frame);
    stampBrush(mask, { x: from.x - PRINT_INNER.x, y: from.y - PRINT_INNER.y }, { x: to.x - PRINT_INNER.x, y: to.y - PRINT_INNER.y });
    masks[frame] = Float32Array.from(mask);
  }
  // 붓이 얼룩을 다 덮어야 손을 뗀 뒤 얼룩이 남지 않습니다.
  const missed = [];
  stainMap.forEach((strength, index) => { if (strength > 0.02 && mask[index] < 0.99) missed.push([index % PRINT.width, Math.floor(index / PRINT.width)]); });
  if (missed.length > 0) {
    const xs = missed.map(([x]) => x);
    const ys = missed.map(([, y]) => y);
    fail(`⑤ 붓질이 얼룩 ${missed.length}화소(인화지 x ${Math.min(...xs)}~${Math.max(...xs)}, y ${Math.min(...ys)}~${Math.max(...ys)})를 덮지 못합니다. ERASE_STROKE나 STAINS를 고쳐 주세요.`);
  }
  const maskAt = (frame) => masks[Math.min(frame, paintEnd)] ?? null;
  const render = (frame, { cursor = true } = {}) => {
    const image = createStage();
    drawPanel(image);
    const isPainting = frame >= press + 1 && frame <= paintEnd + 1;
    drawEraseButton(image, assets, { pressed: frame >= press && frame < press + 3, active: isPainting });
    // 칠한 자리는 반투명 붓 색으로 보이고, 손을 떼면 그 자리가 깨끗한 바닥으로 돌아옵니다.
    const photo = copyImage(stained);
    const painted = frame >= paintStart ? maskAt(frame) : null;
    if (painted) {
      const heal = progress(frame, paintEnd + 1, healFrames);
      for (let index = 0; index < painted.length; index += 1) {
        const coverage = painted[index];
        if (coverage <= 0) continue;
        const offset = index * 4;
        const x = index % PRINT.width;
        const y = Math.floor(index / PRINT.width);
        if (heal > 0) {
          for (let channel = 0; channel < 3; channel += 1) {
            photo.data[offset + channel] = lerp(stained.data[offset + channel], clean.data[offset + channel], coverage * heal);
          }
        }
        blendPixel(photo, x, y, ...BRUSH_PREVIEW.color, BRUSH_PREVIEW.alpha * coverage * (1 - heal));
      }
    }
    const card = createImage(PRINT.width + BORDER * 2 + SHADOW, PRINT.height + BORDER * 2 + SHADOW);
    drawCard(card, 0, 0, PRINT.width, PRINT.height, COLORS.white);
    drawImage(card, photo, BORDER, BORDER);
    drawPrintCard(image, card);
    if (cursor) {
      drawRipple(image, button, frame, press);
      drawRipple(image, strokePoints[0], frame, paintStart);
      drawCursor(image, assets, pathAt(keys, frame));
    }
    return image;
  };
  // 정지 그림: 칠하는 도중(왼쪽 자국은 칠했고 오른쪽 긁힘은 아직 남음). 깨끗해진 결과만으로는 무엇을 했는지 보이지 않고,
  // 다 칠한 장은 얼룩이 붓 색에 가려 보이지 않습니다.
  const stillFrame = paintStart + 3 * strokeFrames; // 붓이 긁힘 가운데(ERASE_STROKE 네 번째 점)에 온 장
  return { total, render, cursorRestFrame: keys[keys.length - 1][0], still: render(stillFrame, { cursor: false }) };
};

// ---- ⑥ 사진 색 ----

// 앱의 '따뜻하게' 묶음(밝기 5, 색감 10, 따뜻함 30)과 밝기 +10씩을 작게 봐도 분명히 보이게 FFmpeg 필터로 사진에 씁니다.
const COLOR_FILTERS = {
  warm: 'colorbalance=rs=0.12:gs=0.03:bs=-0.12:rm=0.10:gm=0.02:bm=-0.10:rh=0.05:bh=-0.06,eq=saturation=1.25:brightness=0.02',
  brighter: ',eq=brightness=0.05:gamma=1.05', // 밝기 + 한 번마다 덧붙임
};
const COLOR_ROWS = [
  { key: 'brightness', label: '밝기', values: [5, 15, 25] },
  { key: 'contrast', label: '선명하게', values: [0] },
  { key: 'saturation', label: '색감', values: [10] },
  { key: 'warmth', label: '따뜻함', values: [30] },
];
const PRESET_BUTTON = { x: CARD_BUTTON.x, y: PANEL_INNER.y + 6, width: CARD_BUTTON.width, height: 30 };
const DETAIL_BUTTON = { x: CARD_BUTTON.x, y: PRESET_BUTTON.y + 46, width: CARD_BUTTON.width, height: 30 };
const ROW_TOP = DETAIL_BUTTON.y + 50;
const ROW_HEIGHT = 60;
const STEP_BUTTON = { width: 22, height: 22 };
const rowButtons = (index) => {
  const y = ROW_TOP + index * ROW_HEIGHT + 24;
  return {
    minus: { x: CARD_BUTTON.x, y, ...STEP_BUTTON },
    plus: { x: CARD_BUTTON.x + CARD_BUTTON.width + ITEM_BORDER * 2 - STEP_BUTTON.width - ITEM_BORDER * 2, y, ...STEP_BUTTON },
  };
};

const drawStepButton = (image, box, sign, pressed) => {
  const center = drawButton(image, box, SECONDARY_FILL, pressed);
  fillRect(image, center.x - 7, center.y - 1.5, 14, 3, COLORS.ink);
  if (sign === '+') fillRect(image, center.x - 1.5, center.y - 7, 3, 14, COLORS.ink);
};

const buildColorDemo = (assets) => {
  const { photos, labels } = assets.card.color;
  const presetPress = 12;
  const detailPress = presetPress + 16;
  const plusPresses = [detailPress + 16, detailPress + 26];
  const total = plusPresses[1] + 32;
  const preset = buttonCenter(PRESET_BUTTON);
  const detail = buttonCenter(DETAIL_BUTTON);
  const plus = buttonCenter(rowButtons(0).plus);
  const keys = [
    [0, CURSOR_REST], [3, CURSOR_REST], [presetPress - 1, preset], [presetPress + 3, preset],
    [detailPress - 1, detail], [detailPress + 3, detail], [plusPresses[0] - 1, plus], [plusPresses[1] + 4, plus],
    [plusPresses[1] + 20, CURSOR_REST],
  ];
  const isPressed = (frame, pressFrame) => frame >= pressFrame && frame < pressFrame + 3;
  // 지금 사진: 원본 → 따뜻하게 → 밝기 +1 → 밝기 +2. 누른 다음 장에 한 번에 바뀝니다.
  // (사진 전체가 몇 장에 걸쳐 조금씩 바뀌면 libwebp_anim이 차이가 작은 8×8 칸을 앞 장 그대로 두어 네모 얼룩이 남습니다.)
  const photoAt = (frame) => photos[[presetPress, ...plusPresses].filter((pressFrame) => frame > pressFrame).length];
  const render = (frame, { cursor = true } = {}) => {
    const image = createStage();
    drawPanel(image);
    const isWarm = frame > presetPress;
    const presetCenter = drawButton(image, PRESET_BUTTON, isWarm ? COLORS.selected : SECONDARY_FILL, isPressed(frame, presetPress));
    drawCentered(image, labels.preset, presetCenter.x, presetCenter.y);
    const detailCenter = drawButton(image, DETAIL_BUTTON, SECONDARY_FILL, isPressed(frame, detailPress));
    drawCentered(image, labels.detail, detailCenter.x, detailCenter.y);
    // '자세히'를 누르면 네 줄이 위에서부터 차례로 펼쳐집니다.
    COLOR_ROWS.forEach((row, index) => {
      if (frame < detailPress + 1 + index) return;
      const top = ROW_TOP + index * ROW_HEIGHT;
      drawImage(image, labels.rows[index], CARD_BUTTON.x + 2, top);
      const buttons = rowButtons(index);
      const plusCount = index === 0 ? plusPresses.filter((pressFrame) => frame > pressFrame).length : 0;
      drawStepButton(image, buttons.minus, '-', false);
      drawStepButton(image, buttons.plus, '+', index === 0 && plusPresses.some((pressFrame) => isPressed(frame, pressFrame)));
      const value = labels.values[row.key][plusCount];
      const middle = (buttonCenter(buttons.minus).x + buttonCenter(buttons.plus).x) / 2;
      drawCentered(image, value, middle, buttonCenter(buttons.minus).y);
    });
    const card = createImage(PRINT.width + BORDER * 2 + SHADOW, PRINT.height + BORDER * 2 + SHADOW);
    drawCard(card, 0, 0, PRINT.width, PRINT.height, COLORS.white);
    drawImage(card, photoAt(frame), BORDER, BORDER);
    drawPrintCard(image, card);
    if (cursor) {
      drawRipple(image, preset, frame, presetPress);
      drawRipple(image, detail, frame, detailPress);
      plusPresses.forEach((pressFrame) => drawRipple(image, plus, frame, pressFrame));
      drawCursor(image, assets, pathAt(keys, frame));
    }
    return image;
  };
  // 반복 이음매도 같은 까닭으로 짧게 겹칩니다(한 장마다 차이가 커야 칸이 남지 않음).
  const loopFadeFrames = 2;
  return { total, loopFadeFrames, render, cursorRestFrame: keys[keys.length - 1][0], still: render(total - loopFadeFrames - 1, { cursor: false }) };
};

// ---- ⑦ 프레임 색 ----

// 앱의 기본 프레임 색 목록(public/config/frame_palette.json)과 같은 순서입니다. 흰색에서 분홍, 민트를 차례로 누릅니다.
const FRAME_SWATCHES = ['#FFFFFF', '#000000', '#DCDCDC', '#fe9fb3', '#ffe4c4', '#C8F7DC', '#C6E2FF', '#ffc1cc'];
const FRAME_PICKS = [3, 5]; // 분홍, 민트
const hexToRgb = (hex) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
const FRAME_COLOR_BUTTON = { x: CARD_BUTTON.x, y: PANEL_INNER.y + 10, width: CARD_BUTTON.width, height: 58 };
const SWATCH = 30; // 안쪽 크기
const swatchBox = (index) => {
  const outer = SWATCH + ITEM_BORDER * 2;
  const gap = 12;
  const left = Math.round(PANEL_CENTER_X - (outer * 2 + gap) / 2);
  return { x: left + (index % 2) * (outer + gap), y: FRAME_COLOR_BUTTON.y + 96 + Math.floor(index / 2) * (outer + gap), width: SWATCH, height: SWATCH };
};
// 2칸 프레임: 칸 사이와 둘레로 프레임 바탕색이 보입니다.
const FRAME_SLOT_PAD = 12;
const FRAME_SLOTS = layoutSlots({ rows: 2, cols: 1 }, PRINT.width, PRINT.height, FRAME_SLOT_PAD, 10);
const FRAME_SLOT_SIZE = { width: Math.round(FRAME_SLOTS[0].width), height: Math.round(FRAME_SLOTS[0].height) };

const createFramedCard = (fills, color) => {
  const card = createImage(PRINT.width + BORDER * 2 + SHADOW, PRINT.height + BORDER * 2 + SHADOW);
  drawCard(card, 0, 0, PRINT.width, PRINT.height, color);
  FRAME_SLOTS.forEach((slot, index) => drawImage(card, fills[index], BORDER + Math.round(slot.x), BORDER + Math.round(slot.y)));
  return card;
};

const buildFrameColorDemo = (assets) => {
  const { fills, labels } = assets.card.frameColor;
  const press = 12;
  const picks = [press + 16, press + 30];
  const total = picks[1] + 32;
  const button = buttonCenter(FRAME_COLOR_BUTTON);
  const swatchCenters = FRAME_PICKS.map((index) => buttonCenter(swatchBox(index)));
  const keys = [
    [0, CURSOR_REST], [3, CURSOR_REST], [press - 1, button], [press + 3, button],
    [picks[0] - 1, swatchCenters[0]], [picks[0] + 3, swatchCenters[0]], [picks[1] - 1, swatchCenters[1]], [picks[1] + 4, swatchCenters[1]],
    [picks[1] + 20, CURSOR_REST],
  ];
  const cards = [0, ...FRAME_PICKS].map((index) => createFramedCard(fills, hexToRgb(FRAME_SWATCHES[index])));
  const render = (frame, { cursor = true } = {}) => {
    const image = createStage();
    drawPanel(image);
    const center = drawButton(image, FRAME_COLOR_BUTTON, SECONDARY_FILL, frame >= press && frame < press + 3);
    drawCentered(image, labels[0], center.x, center.y - 13);
    drawCentered(image, labels[1], center.x, center.y + 13);
    const picked = picks.filter((pickFrame) => frame >= pickFrame).length; // 0: 흰색, 1: 분홍, 2: 민트
    const selectedIndex = [0, ...FRAME_PICKS][picked];
    // 버튼을 누르면 색 칸이 '톡' 나타납니다. 고른 칸에는 앱처럼 ✓가 있습니다.
    if (frame >= press + 1) {
      FRAME_SWATCHES.forEach((hex, index) => {
        const box = swatchBox(index);
        const color = hexToRgb(hex);
        const swatch = createImage(SWATCH + ITEM_BORDER * 2 + ITEM_SHADOW, SWATCH + ITEM_BORDER * 2 + ITEM_SHADOW);
        drawCard(swatch, 0, 0, SWATCH, SWATCH, color, { border: ITEM_BORDER, shadow: ITEM_SHADOW });
        if (index === selectedIndex) {
          const mark = color.reduce((sum, value) => sum + value, 0) < 300 ? COLORS.white : COLORS.ink;
          drawPolyline(swatch, [[11, 20], [17, 26], [27, 13]], 4, mark);
        }
        const pickOrder = FRAME_PICKS.indexOf(index);
        const scale = tocScale(frame, press + 1) * (pickOrder >= 0 ? tocScale(frame, picks[pickOrder]) : 1);
        drawScaled(image, swatch, box.x + swatch.width / 2, box.y + swatch.height / 2, scale);
      });
    }
    drawPrintCard(image, cards[picked]);
    if (cursor) {
      drawRipple(image, button, frame, press);
      picks.forEach((pickFrame, index) => drawRipple(image, swatchCenters[index], frame, pickFrame));
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

// ①의 칸에 넣을 두 사진: 가족사진을 칸에 꽉 차게, 오린 사람의 얼굴 둘레를 크게. at은 작업 사진에서 오린 PNG의 자리입니다.
const createSlotFills = (photoPath, working, sticker, at) => {
  const { width, height } = SLOT_FILL_SIZE;
  const toWorking = `scale=${working.width}:${working.height}:flags=area`;
  const faceY = at.y + sticker.height * 0.17; // 오린 사람의 얼굴 높이(④의 화살표 자리와 같은 비율)
  const clampCrop = (start, size, limit) => Math.round(Math.max(0, Math.min(limit - size, start)));
  // 가족사진: 칸을 꽉 채우게 키우고, 얼굴들이 칸 가운데쯤 오게 위아래를 자릅니다.
  const scale = Math.max(width / working.width, height / working.height);
  const scaledWidth = Math.round(working.width * scale);
  const scaledHeight = Math.round(working.height * scale);
  const familyX = clampCrop((scaledWidth - width) / 2, width, scaledWidth);
  const familyY = clampCrop(faceY * scale - height * 0.55, height, scaledHeight);
  const familySlot = readRgba(photoPath, width, height, `${toWorking},scale=${scaledWidth}:${scaledHeight}:flags=lanczos,crop=${width}:${height}:${familyX}:${familyY}`);
  // 얼굴 크게: 오린 사람 폭의 0.8만큼을 칸 비율로 잘라 얼굴이 가운데보다 조금 위에 오게 합니다.
  const cropWidth = Math.round(Math.min(working.width, sticker.width * 0.8));
  const cropHeight = Math.round(Math.min(working.height, (cropWidth * height) / width));
  const faceX = clampCrop(at.x + sticker.width / 2 - cropWidth / 2, cropWidth, working.width);
  const faceTop = clampCrop(faceY - cropHeight * 0.42, cropHeight, working.height);
  const faceSlot = readRgba(photoPath, width, height, `${toWorking},crop=${cropWidth}:${cropHeight}:${faceX}:${faceTop},scale=${width}:${height}:flags=lanczos`);
  return { familySlot, faceSlot };
};

// 버튼 이름 그림: 검정 글자(테두리 1px로 굵게)를 잉크가 있는 만큼만 잘라 냅니다.
const createLabelRenderer = (workDir) => {
  let count = 0;
  const fontFile = FONT_PATH.replace(/:/g, '\\:');
  return (text, fontSize) => {
    count += 1;
    const textPath = join(workDir, `label-${count}.txt`);
    writeFileSync(textPath, text);
    const width = Math.ceil(fontSize * (Array.from(text).length + 2));
    const height = fontSize * 2;
    const data = run('ffmpeg', [
      '-v', 'error', '-f', 'lavfi', '-i', `color=c=black@0:s=${width}x${height},format=rgba`,
      '-vf', `drawtext=fontfile=${fontFile}:textfile=${textPath}:fontsize=${fontSize}:fontcolor=black:borderw=1:bordercolor=black:x=${fontSize}:y=(h-${fontSize})/2`,
      '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-',
    ]);
    const image = { width, height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };
    let left = width;
    let right = -1;
    let top = height;
    let bottom = -1;
    for (let index = 0; index < width * height; index += 1) {
      if (image.data[index * 4 + 3] === 0) continue;
      const x = index % width;
      const y = Math.floor(index / width);
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
    if (right < 0 || left === 0 || right === width - 1) fail(`버튼 이름을 그리지 못했습니다: ${text}`);
    const label = createImage(right - left + 1, bottom - top + 1);
    for (let y = top; y <= bottom; y += 1) {
      label.data.set(image.data.subarray((y * width + left) * 4, (y * width + right + 1) * 4), (y - top) * label.width * 4);
    }
    return label;
  };
};

// ⑦ 두 칸에 넣을 전신 사진 부분(사진 비율 좌표: 가운데 x·y와 폭). 위 칸은 세 사람의 얼굴과 윗몸, 아래 칸은 아이입니다.
// 매장 사진으로 바꾸면 이 값을 그 사진의 사람 자리에 맞춥니다.
const FRAME_FILL_CROPS = [{ x: 0.5, y: 0.28, width: 0.75 }, { x: 0.49, y: 0.37, width: 0.36 }];

// ⑤~⑦ 재료: 인화지에 꽉 찬 전신 사진(⑤ 얼룩을 그려 넣은 것과 깨끗한 것, ⑥ 색을 바꾼 것들), ⑦ 칸 사진, 버튼 이름
const loadCardAssets = (fullbodyPath, renderLabel) => {
  const natural = readSize(fullbodyPath);
  const scale = Math.max(PRINT.width / natural.width, PRINT.height / natural.height);
  const scaledWidth = Math.round(natural.width * scale);
  const scaledHeight = Math.round(natural.height * scale);
  const cover = `scale=${scaledWidth}:${scaledHeight}:flags=lanczos,crop=${PRINT.width}:${PRINT.height}:${Math.round((scaledWidth - PRINT.width) / 2)}:${Math.round((scaledHeight - PRINT.height) / 2)}`;
  const readPrint = (filter = '') => readRgba(fullbodyPath, PRINT.width, PRINT.height, `${cover}${filter}`);
  const clean = readPrint();
  const stainMap = createStainMap();
  const photos = [clean, ...[0, 1, 2].map((brighter) => readPrint(`,${COLOR_FILTERS.warm}${COLOR_FILTERS.brighter.repeat(brighter)}`))];
  const fills = FRAME_FILL_CROPS.map((crop) => {
    const cropWidth = Math.round(natural.width * crop.width);
    const cropHeight = Math.round((cropWidth * FRAME_SLOT_SIZE.height) / FRAME_SLOT_SIZE.width);
    const x = Math.round(Math.max(0, Math.min(natural.width - cropWidth, natural.width * crop.x - cropWidth / 2)));
    const y = Math.round(Math.max(0, Math.min(natural.height - cropHeight, natural.height * crop.y - cropHeight / 2)));
    return readRgba(fullbodyPath, FRAME_SLOT_SIZE.width, FRAME_SLOT_SIZE.height, `crop=${cropWidth}:${cropHeight}:${x}:${y},scale=${FRAME_SLOT_SIZE.width}:${FRAME_SLOT_SIZE.height}:flags=lanczos`);
  });
  const values = Object.fromEntries(COLOR_ROWS.map((row) => [row.key, row.values.map((value) => renderLabel(String(value), VALUE_SIZE))]));
  return {
    erase: { clean, stainMap, stained: applyStains(clean, stainMap) },
    color: {
      photos,
      labels: { preset: renderLabel('따뜻하게', LABEL_SIZE), detail: renderLabel('자세히', LABEL_SIZE), rows: COLOR_ROWS.map((row) => renderLabel(row.label, LABEL_SIZE)), values },
    },
    frameColor: { fills, labels: [renderLabel('프레임 색', LABEL_SIZE), renderLabel('바꾸기', LABEL_SIZE)] },
    labels: { erase: [renderLabel('얼룩', LABEL_SIZE), renderLabel('지우기', LABEL_SIZE)] },
  };
};

const loadAssets = (photoPath, cutoutPath, fullbodyPath, workDir) => {
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
  const frames = createSlotFills(photoPath, working, sticker, at);

  const assets = {
    photo,
    cursor: createCursorSprite(),
    text: { prefixes: renderTextPrefixes(workDir) },
    stickers: STICKER_FILES.map((name) => readSticker(name, STICKER_ICON)),
    stickerLarge: readSticker(STICKER_FILES[0], STICKER_DROP),
    cutout: { kidPrint, kidOutline: createOutlineSprite(kidPrint), kidPosition, kidLarge },
    frames,
    card: loadCardAssets(fullbodyPath, createLabelRenderer(workDir)),
  };
  assets.plainCard = createPrintCard(assets);
  return assets;
};

// ---- 인코딩 ----

const encodeDemo = (name, demo, outDir) => {
  const loopFadeFrames = demo.loopFadeFrames ?? LOOP_FADE_FRAMES;
  const loopStart = demo.total - loopFadeFrames;
  // 겹쳐 돌아가는 동안 화살표가 아직 움직이면 두 자리에 겹쳐 보이므로, 그 전에 쉬는 자리에 와 있어야 합니다.
  if (demo.cursorRestFrame > loopStart - 1) fail(`${name}: 화살표가 ${demo.cursorRestFrame}장에야 쉬는 자리에 옵니다(${loopStart - 1}장까지 와야 함).`);
  const first = demo.render(0);
  const last = demo.render(loopStart - 1);
  const frames = [];
  for (let frame = 0; frame < demo.total; frame += 1) {
    // 끝에서는 결과 장면이 처음 장면으로 겹쳐 돌아가 반복 이음매가 튀지 않습니다.
    const image = frame < loopStart ? demo.render(frame) : mixImages(last, first, (frame - loopStart + 1) / (loopFadeFrames + 1));
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
  console.log(`${name}-demo.webp ${statSync(animPath).size} B (${demo.total}장, ${(demo.total / FPS).toFixed(2)}초)`);
  console.log(`${name}-demo-still.png ${statSync(stillPath).size} B`);
  return [{ path: animPath, maxBytes: ANIMATION_MAX_BYTES }, { path: stillPath, maxBytes: STILL_MAX_BYTES }];
};

// 열네 파일이 모두 만들어지고 용량 한도 안일 때만 출력 폴더에 한꺼번에 넣습니다. 하나라도 실패하면 기존 파일을 그대로 둡니다.
const publishDemos = (files, outDir) => {
  const oversized = files.filter(({ path, maxBytes }) => statSync(path).size > maxBytes);
  if (oversized.length > 0) {
    fail(`용량 한도를 넘어 ${outDir}를 바꾸지 않았습니다: ${oversized.map(({ path, maxBytes }) => `${basename(path)} ${statSync(path).size} B(한도 ${maxBytes} B)`).join(', ')}`);
  }
  mkdirSync(outDir, { recursive: true });
  for (const { path } of files) copyFileSync(path, join(outDir, basename(path)));
  console.log(`${outDir}에 ${files.length}개 파일을 넣었습니다.`);
};

const main = () => {
  const [photoArg, cutoutArg, fullbodyArg, outArg] = process.argv.slice(2);
  if (!photoArg || !cutoutArg || !fullbodyArg) fail('사용법: node scripts/build-tutorial-demos.mjs <가족사진> <오린 아이 PNG> <전신 가족사진> [출력 폴더]');
  const photoPath = resolve(photoArg);
  const cutoutPath = resolve(cutoutArg);
  const fullbodyPath = resolve(fullbodyArg);
  const outDir = resolve(outArg ?? join(REPO, 'public', 'tutorial'));
  checkFfmpeg();
  const workDir = mkdtempSync(join(tmpdir(), 'tutorial-demos-'));
  try {
    const assets = loadAssets(photoPath, cutoutPath, fullbodyPath, workDir);
    // 먼저 임시 폴더에 열네 개를 모두 만들고, 다 되면 출력 폴더에 넣습니다.
    const stagingDir = join(workDir, 'demos');
    mkdirSync(stagingDir);
    const files = [
      ...encodeDemo('frames', buildFramesDemo(assets), stagingDir),
      ...encodeDemo('text', buildTextDemo(assets), stagingDir),
      ...encodeDemo('sticker', buildStickerDemo(assets), stagingDir),
      ...encodeDemo('cutout', buildCutoutDemo(assets), stagingDir),
      ...encodeDemo('erase', buildEraseDemo(assets), stagingDir),
      ...encodeDemo('color', buildColorDemo(assets), stagingDir),
      ...encodeDemo('frameColor', buildFrameColorDemo(assets), stagingDir),
    ];
    publishDemos(files, outDir);
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
