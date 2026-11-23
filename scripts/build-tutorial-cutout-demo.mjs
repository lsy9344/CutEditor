// 튜토리얼 ④ '내 사진 스티커' 단계의 시연 그림을 만듭니다(사람이 필요할 때 직접 돌리는 스크립트, 빌드에 연결하지 않음).
//
// 사용법
//   node scripts/build-tutorial-cutout-demo.mjs <원본 사진> <오린 PNG> [출력 폴더]
//   출력 폴더를 빼면 public/tutorial/에 cutout-demo.webp(반복 애니메이션)와 cutout-demo-still.png(정지, 마지막 결과 장면)를 씁니다.
//   ffmpeg(libwebp_anim 포함)와 ffprobe가 PATH에 있어야 합니다. 예: sudo apt install ffmpeg / brew install ffmpeg
//
// 지금 들어 있는 시연 사진(원본은 저장소에 넣지 않음)
//   https://www.pexels.com/photo/a-woman-in-pink-sweater-finger-pointing-11738260/
//   사진가 bangunstockproduction, Pexels License(https://www.pexels.com/license/): 무료 사용·변형 가능, 출처 표시 불필요.
//   내려받은 크기: https://images.pexels.com/photos/11738260/pexels-photo-11738260.jpeg?auto=compress&cs=tinysrgb&w=1600
//   오린 PNG는 이 앱의 '내 사진 스티커'(모두 오리기, 흰 테두리 켬)로 만들고 '이 스티커만 저장'으로 받은 그대로입니다.
//
// 매장 사진으로 바꾸는 방법
//   1. 앱에 사진을 넣고 '내 사진 스티커'로 오린 뒤, 뒤집거나 지우지 않은 채 '이 스티커만 저장'으로 PNG를 받습니다.
//   2. 앱에 넣은 원본 사진과 받은 PNG를 이 스크립트에 넣습니다. 스크립트가 PNG가 사진의 어디에서 오렸는지 스스로 찾습니다.
//   3. public/tutorial/의 두 파일을 확인하고 커밋합니다.
//
// 장면(12fps, 42장, 3.5초 반복): ① 칸에 사진 → ② 사람 테두리를 따라 선이 그어지며 오려짐 → ③ 배경이 빠지고 체크무늬(투명)
// 위에 사람만 → ④ 다른 꾸밈 캔버스 위에 스티커가 붙고 크기 손잡이가 보임 → ①로 짧게 겹쳐 돌아감. 글자는 넣지 않습니다.
// 인코딩은 반드시 libwebp_anim입니다(일반 libwebp는 장면 사이 중복을 못 줄여 열 배 넘게 커짐).
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const FPS = 12;
const TOTAL_FRAMES = 42;
// 화면 크기 186×132(말풍선 내용 폭 186px)를 2배로 만듭니다. src/ui/tutorialSteps.ts의 getTutorialDemoImage와 같아야 하며
// tests/ui/tutorialSteps.test.ts가 파일 크기를 확인합니다.
const WIDTH = 372;
const HEIGHT = 264;
// 앱 스타일: 검정 3px 테두리와 4px 오프셋 그림자(2배), 색은 src/components/components.css의 토큰 값
const BORDER = 6;
const SHADOW = 8;
const COLORS = {
  tooltip: '0xFFFFFF', // --linear-neutral-600(말풍선 바탕)
  ink: '0x000000',
  card: '0xFFE6A7', // --linear-accent-warning-bg
  cellLeft: '0xA2D2FF', // --linear-accent-info
  cellRight: '0x95D5B2', // --linear-accent-success-bg
};
// 투명 자리를 보여 주는 체크무늬의 밝은·어두운 회색 값(0~255)
const CHECKER_LIGHT = 255;
const CHECKER_DARK = 221;
const CHECKER_SIZE = 10;
// 장면 시각(장 번호). A=①~③, B=④, 끝에서 다시 ①로 겹칩니다. 선 긋기와 배경 빠짐은 장 번호로 계산해 경계가 흔들리지 않습니다.
const WIPE_START = 5;
const WIPE_FRAMES = 7;
const BACKGROUND_FADE_START = 14;
const BACKGROUND_FADE_FRAMES = 4;
const RESULT_START = 22; // A → B 겹침 시작
const LOOP_START = 38; // B → ① 겹침 시작. 마지막 장은 ①과 같아 반복 이음매가 튀지 않습니다.
const CROSSFADE_FRAMES = 3;
const STILL_FRAME = 34; // 정지 PNG로 쓰는 ④ 장면
const STICKER_LINE = 3; // ②의 오리는 선 굵기(px, 2배 기준)
const WORKING_MAX_SIDE = 2048; // src/photo/cutoutRender.ts CUTOUT_WORKING_MAX_SIDE: 오린 PNG는 이 크기의 작업 사진에서 잘립니다
const MATCH_MAX_DIFF = 16; // 사진과 PNG가 맞는지 판단하는 평균 화소 차이 한도(0~255)

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
  if (!/\blibwebp_anim\b/.test(encoders)) {
    fail('이 ffmpeg에는 libwebp_anim 인코더가 없습니다. libwebp를 켜고 빌드된 ffmpeg가 필요합니다.');
  }
};

const readSize = (path) => {
  const output = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path], { encoding: 'utf8' });
  const [width, height] = output.trim().split(',').map(Number);
  if (!width || !height) fail(`그림 크기를 읽지 못했습니다: ${path}`);
  return { width, height };
};

const readRgba = (path, width, height) => run('ffmpeg', [
  '-v', 'error', '-i', path, '-vf', `scale=${width}:${height}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-',
]);

// 앱이 오릴 때 쓰는 작업 사진 크기(긴 변 2048 이하)
const getWorkingSize = ({ width, height }) => {
  const longSide = Math.max(width, height);
  if (longSide <= WORKING_MAX_SIDE) return { width, height };
  const scale = WORKING_MAX_SIDE / longSide;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
};

// 오린 PNG의 불투명한 안쪽 화소(흰 테두리 제외)를 고릅니다. 많으면 고르게 줄입니다.
const pickStickerPoints = (rgba, width, height, limit) => {
  const points = [];
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const isWhite = rgba[offset] >= 250 && rgba[offset + 1] >= 250 && rgba[offset + 2] >= 250;
    if (rgba[offset + 3] === 255 && !isWhite) points.push(index);
  }
  const step = Math.max(1, Math.ceil(points.length / limit));
  return points.filter((_, order) => order % step === 0).map((index) => ({
    x: index % width,
    y: Math.floor(index / width),
    color: [rgba[index * 4], rgba[index * 4 + 1], rgba[index * 4 + 2]],
  }));
};

const meanDifference = (photo, photoWidth, points, dx, dy, limit) => {
  let sum = 0;
  const budget = limit * points.length * 3;
  for (const { x, y, color } of points) {
    const offset = ((y + dy) * photoWidth + (x + dx)) * 4;
    sum += Math.abs(photo[offset] - color[0]) + Math.abs(photo[offset + 1] - color[1]) + Math.abs(photo[offset + 2] - color[2]);
    if (sum > budget) return Infinity;
  }
  return sum / (points.length * 3);
};

const searchOffset = (photo, photoSize, points, stickerSize, range) => {
  let best = { dx: 0, dy: 0, difference: Infinity };
  const xMax = Math.min(range.x1, photoSize.width - stickerSize.width);
  const yMax = Math.min(range.y1, photoSize.height - stickerSize.height);
  for (let dy = Math.max(0, range.y0); dy <= yMax; dy += 1) {
    for (let dx = Math.max(0, range.x0); dx <= xMax; dx += 1) {
      const difference = meanDifference(photo, photoSize.width, points, dx, dy, best.difference);
      if (difference < best.difference) best = { dx, dy, difference };
    }
  }
  return best;
};

// 오린 PNG가 작업 사진의 어디에서 잘렸는지 찾습니다(1/4 크기로 훑고 원래 크기에서 다듬음).
const locateSticker = (photoPath, cutoutPath, working, sticker) => {
  const coarse = 4;
  const smallPhoto = { width: Math.round(working.width / coarse), height: Math.round(working.height / coarse) };
  const smallSticker = { width: Math.round(sticker.width / coarse), height: Math.round(sticker.height / coarse) };
  const coarsePoints = pickStickerPoints(readRgba(cutoutPath, smallSticker.width, smallSticker.height), smallSticker.width, smallSticker.height, 3000);
  if (coarsePoints.length < 50) fail('오린 PNG에 불투명한 부분이 거의 없습니다.');
  const first = searchOffset(readRgba(photoPath, smallPhoto.width, smallPhoto.height), smallPhoto, coarsePoints, smallSticker, { x0: 0, y0: 0, x1: Infinity, y1: Infinity });
  const finePoints = pickStickerPoints(readRgba(cutoutPath, sticker.width, sticker.height), sticker.width, sticker.height, 20000);
  const reach = coarse * 2;
  const fine = searchOffset(readRgba(photoPath, working.width, working.height), working, finePoints, sticker, {
    x0: first.dx * coarse - reach, x1: first.dx * coarse + reach, y0: first.dy * coarse - reach, y1: first.dy * coarse + reach,
  });
  if (fine.difference > MATCH_MAX_DIFF) {
    fail(`오린 PNG가 이 사진에서 나온 것 같지 않습니다(평균 차이 ${fine.difference.toFixed(1)}). 같은 사진을 뒤집거나 고치지 않고 오렸는지 확인해 주세요.`);
  }
  return { x: fine.dx, y: fine.dy, difference: fine.difference };
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// 모든 장면이 같은 자리의 카드(검정 테두리·오프셋 그림자)를 씁니다.
const CARD = {
  x: 12,
  y: 8,
  innerWidth: WIDTH - 12 * 2 - SHADOW - BORDER * 2,
  innerHeight: HEIGHT - 8 * 2 - SHADOW - BORDER * 2,
};

// ①~③ 칸(카드 안쪽 전체): 사진을 칸에 맞춰 사람이 가운데 오게 자릅니다.
const getCellLayout = (working, sticker, at) => {
  const cellWidth = CARD.innerWidth;
  const cellHeight = CARD.innerHeight;
  let scale = Math.min((cellHeight * 0.96) / sticker.height, (cellWidth * 0.96) / sticker.width);
  scale = Math.max(scale, cellWidth / working.width, cellHeight / working.height);
  const photoWidth = Math.round(working.width * scale);
  const photoHeight = Math.round(working.height * scale);
  const cropX = Math.round(clamp((at.x + sticker.width / 2) * scale - cellWidth / 2, 0, photoWidth - cellWidth));
  const cropY = Math.round(clamp((at.y + sticker.height / 2) * scale - cellHeight / 2, 0, photoHeight - cellHeight));
  return {
    cellWidth, cellHeight, photoWidth, photoHeight, cropX, cropY,
    stickerWidth: Math.round(sticker.width * scale),
    stickerHeight: Math.round(sticker.height * scale),
    stickerX: Math.round(at.x * scale) - cropX,
    stickerY: Math.round(at.y * scale) - cropY,
  };
};

// ④ 꾸밈 캔버스: 노란 바탕에 두 칸, 오른쪽 칸 위에 스티커와 손잡이
const getResultLayout = (sticker) => {
  const gap = 12;
  const cellWidth = Math.floor((CARD.innerWidth - gap * 3) / 2);
  const cellHeight = CARD.innerHeight - gap * 2;
  const cellY = CARD.y + BORDER + gap;
  const leftCellX = CARD.x + BORDER + gap;
  const rightCellX = leftCellX + cellWidth + gap;
  // 스티커는 두 칸 사이에 걸쳐 크게 붙입니다(칸 위에 따로 붙은 것이 보이게).
  const stickerHeight = Math.round(cellHeight * 0.94);
  const stickerWidth = Math.min(Math.round((sticker.width * stickerHeight) / sticker.height), cellWidth * 2);
  const stickerX = Math.round(rightCellX - gap / 2 - stickerWidth * 0.4);
  const stickerY = Math.round(cellY + (cellHeight - stickerHeight) / 2);
  return { cellWidth, cellHeight, cellY, leftCellX, rightCellX, stickerWidth, stickerHeight, stickerX, stickerY };
};

// 검정 테두리 + 오프셋 그림자 상자(앱의 카드 모양)
const drawCard = (fill) => [
  `drawbox=x=${CARD.x + SHADOW}:y=${CARD.y + SHADOW}:w=${CARD.innerWidth + BORDER * 2}:h=${CARD.innerHeight + BORDER * 2}:color=${COLORS.ink}:t=fill`,
  `drawbox=x=${CARD.x}:y=${CARD.y}:w=${CARD.innerWidth + BORDER * 2}:h=${CARD.innerHeight + BORDER * 2}:color=${COLORS.ink}:t=fill`,
  `drawbox=x=${CARD.x + BORDER}:y=${CARD.y + BORDER}:w=${CARD.innerWidth}:h=${CARD.innerHeight}:color=${fill}:t=fill`,
].join(',');

const seconds = (frames) => (frames / FPS).toFixed(6);

const buildFilterGraph = (cell, result) => {
  const durationA = seconds(RESULT_START + CROSSFADE_FRAMES);
  const durationB = seconds(LOOP_START + CROSSFADE_FRAMES - RESULT_START);
  // C는 겹침보다 넉넉히 길게 두고 trim이 TOTAL_FRAMES에서 자릅니다(마지막 장은 온전한 ①).
  const durationC = seconds(CROSSFADE_FRAMES + 4);
  // N은 장 번호(0부터). 시각(T) 대신 써서 반올림으로 경계 장이 바뀌지 않게 합니다.
  const wipe = `clip((N-${WIPE_START})/${WIPE_FRAMES},0,1)`;
  const backgroundFade = `fade=t=out:s=${BACKGROUND_FADE_START}:n=${BACKGROUND_FADE_FRAMES}:alpha=1`;
  const pad = STICKER_LINE + 1;
  const handle = 12;
  const box = { x: result.stickerX - 4, y: result.stickerY - 4, w: result.stickerWidth + 8, h: result.stickerHeight + 8 };
  const handles = [[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]]
    .flatMap(([x, y]) => [
      `drawbox=x=${x - handle / 2}:y=${y - handle / 2}:w=${handle}:h=${handle}:color=${COLORS.ink}:t=fill`,
      `drawbox=x=${x - handle / 2 + 3}:y=${y - handle / 2 + 3}:w=${handle - 6}:h=${handle - 6}:color=white:t=fill`,
    ]).join(',');
  const checker = `if(mod(floor(X/${CHECKER_SIZE})+floor(Y/${CHECKER_SIZE}),2),${CHECKER_DARK},${CHECKER_LIGHT})`;
  return [
    // 사진: 칸 크기로 자르고 ③에서 투명하게 사라짐. C(①로 돌아가기)에도 씁니다.
    `[0:v]scale=${cell.photoWidth}:${cell.photoHeight}:flags=lanczos,crop=${cell.cellWidth}:${cell.cellHeight}:${cell.cropX}:${cell.cropY},format=rgba,split=2[photoA][photoC]`,
    `[photoA]${backgroundFade}[photoFading]`,
    // 스티커: ①~③ 칸 크기와 ④ 크기
    `[1:v]format=rgba,split=2[stickerSource][stickerResultSource]`,
    `[stickerSource]scale=${cell.stickerWidth}:${cell.stickerHeight}:flags=lanczos,pad=w=iw+${pad * 2}:h=ih+${pad * 2}:x=${pad}:y=${pad}:color=black@0,split=2[stickerCell][stickerMask]`,
    `[stickerResultSource]scale=${result.stickerWidth}:${result.stickerHeight}:flags=lanczos[stickerResult]`,
    // ② 오리는 선: 스티커 모양을 STICKER_LINE만큼 넓힌 검정 판, 위에서 아래로 그어지고 ③에서 사라짐
    `[stickerMask]alphaextract,boxblur=luma_radius=${STICKER_LINE}:luma_power=1,lut=c0='if(gt(val,24),255,0)'[lineAlpha]`,
    `color=c=${COLORS.ink}:s=${cell.stickerWidth + pad * 2}x${cell.stickerHeight + pad * 2}:r=${FPS}:d=${durationA},format=rgba[lineColor]`,
    `[lineColor][lineAlpha]alphamerge,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(Y,H*${wipe}),alpha(X,Y),0)',${backgroundFade}[line]`,
    `[stickerCell]geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(Y,H*${wipe}),alpha(X,Y),0)'[stickerWiped]`,
    // 칸 안: 체크무늬(투명) → 사진 → 선 → 스티커
    `color=c=white:s=${cell.cellWidth}x${cell.cellHeight}:r=${FPS}:d=${durationA},format=rgba,geq=r='${checker}':g='${checker}':b='${checker}':a=255[checker]`,
    `[checker][photoFading]overlay=shortest=1:format=auto[cellPhoto]`,
    `[cellPhoto][line]overlay=x=${cell.stickerX - pad}:y=${cell.stickerY - pad}:shortest=1:format=auto[cellLine]`,
    `[cellLine][stickerWiped]overlay=x=${cell.stickerX - pad}:y=${cell.stickerY - pad}:shortest=1:format=auto[cellA]`,
    `color=c=${COLORS.tooltip}:s=${WIDTH}x${HEIGHT}:r=${FPS}:d=${durationA},format=rgba,${drawCard(COLORS.tooltip)}[cardA]`,
    `[cardA][cellA]overlay=x=${CARD.x + BORDER}:y=${CARD.y + BORDER}:shortest=1:format=auto,format=rgba,settb=1/${FPS}[sceneA]`,
    // ④ 결과
    `color=c=${COLORS.tooltip}:s=${WIDTH}x${HEIGHT}:r=${FPS}:d=${durationB},format=rgba,${drawCard(COLORS.card)},`
      + `drawbox=x=${result.leftCellX - 4}:y=${result.cellY - 4}:w=${result.cellWidth + 8}:h=${result.cellHeight + 8}:color=${COLORS.ink}:t=fill,`
      + `drawbox=x=${result.leftCellX}:y=${result.cellY}:w=${result.cellWidth}:h=${result.cellHeight}:color=${COLORS.cellLeft}:t=fill,`
      + `drawbox=x=${result.rightCellX - 4}:y=${result.cellY - 4}:w=${result.cellWidth + 8}:h=${result.cellHeight + 8}:color=${COLORS.ink}:t=fill,`
      + `drawbox=x=${result.rightCellX}:y=${result.cellY}:w=${result.cellWidth}:h=${result.cellHeight}:color=${COLORS.cellRight}:t=fill[resultCard]`,
    `[resultCard][stickerResult]overlay=x=${result.stickerX}:y=${result.stickerY}:shortest=1:format=auto,`
      + `drawbox=x=${box.x}:y=${box.y}:w=${box.w}:h=${box.h}:color=${COLORS.ink}:t=3,${handles},format=rgba,settb=1/${FPS}[sceneB]`,
    // ①로 돌아가는 장면(사진만 든 칸)
    `color=c=${COLORS.tooltip}:s=${WIDTH}x${HEIGHT}:r=${FPS}:d=${durationC},format=rgba,${drawCard(COLORS.tooltip)}[cardC]`,
    `[cardC][photoC]overlay=x=${CARD.x + BORDER}:y=${CARD.y + BORDER}:shortest=1:format=auto,format=rgba,settb=1/${FPS}[sceneC]`,
    // 짧은 겹침 전환으로 잇기
    `[sceneA][sceneB]xfade=transition=fade:duration=${seconds(CROSSFADE_FRAMES)}:offset=${seconds(RESULT_START)}[sceneAB]`,
    `[sceneAB][sceneC]xfade=transition=fade:duration=${seconds(CROSSFADE_FRAMES)}:offset=${seconds(LOOP_START)},trim=end_frame=${TOTAL_FRAMES},split=2[all][stillSource]`,
    `[all]format=yuv420p[anim]`,
    // 정지 PNG: ④ 한 장을 256색으로 줄여 저장
    `[stillSource]select='eq(n\\,${STILL_FRAME})',split=2[stillA][stillB]`,
    `[stillA]palettegen=max_colors=256:stats_mode=full[palette]`,
    `[stillB][palette]paletteuse=dither=sierra2_4a[still]`,
  ].join(';\n');
};

const main = () => {
  const [photoArg, cutoutArg, outArg] = process.argv.slice(2);
  if (!photoArg || !cutoutArg) {
    fail('사용법: node scripts/build-tutorial-cutout-demo.mjs <원본 사진> <오린 PNG> [출력 폴더]');
  }
  const photoPath = resolve(photoArg);
  const cutoutPath = resolve(cutoutArg);
  const outDir = resolve(outArg ?? join(process.cwd(), 'public', 'tutorial'));
  checkFfmpeg();

  const working = getWorkingSize(readSize(photoPath));
  const sticker = readSize(cutoutPath);
  if (sticker.width > working.width || sticker.height > working.height) {
    fail('오린 PNG가 사진보다 큽니다. 같은 사진에서 오린 PNG인지 확인해 주세요.');
  }
  const at = locateSticker(photoPath, cutoutPath, working, sticker);
  console.log(`오린 PNG 위치: 작업 사진(${working.width}×${working.height})의 (${at.x}, ${at.y}), 평균 차이 ${at.difference.toFixed(1)}`);

  const cell = getCellLayout(working, sticker, at);
  const result = getResultLayout(sticker);
  mkdirSync(outDir, { recursive: true });
  const animPath = join(outDir, 'cutout-demo.webp');
  const stillPath = join(outDir, 'cutout-demo-still.png');
  const inputSeconds = seconds(TOTAL_FRAMES + 12);
  run('ffmpeg', [
    '-v', 'error', '-y',
    '-loop', '1', '-framerate', String(FPS), '-t', inputSeconds, '-i', photoPath,
    '-loop', '1', '-framerate', String(FPS), '-t', inputSeconds, '-i', cutoutPath,
    '-filter_complex', buildFilterGraph(cell, result),
    '-map', '[anim]', '-an', '-c:v', 'libwebp_anim', '-lossless', '0', '-quality', '72', '-preset', 'picture',
    '-compression_level', '6', '-loop', '0', '-fps_mode', 'passthrough', '-map_metadata', '-1', animPath,
    '-map', '[still]', '-frames:v', '1', '-update', '1', '-map_metadata', '-1', stillPath,
  ], { stdio: ['ignore', 'inherit', 'inherit'] });

  console.log(`${animPath} ${statSync(animPath).size} B`);
  console.log(`${stillPath} ${statSync(stillPath).size} B`);
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
