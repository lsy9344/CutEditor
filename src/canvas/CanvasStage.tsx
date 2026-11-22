import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Group, Text, Line, Circle, Transformer } from "react-konva";
import Konva from "konva";
import type { Template } from "../state/types";
import type { FrameType, UserImage } from "../types/frame";
import { FRAME_LAYOUTS } from "../types/frame";
import type { AngleDraft } from "./keyboardShortcuts";
import { getNextTextTransformState } from "./textTransform";
import { getTextDimensions } from "./textTransform";
import {
  getAngleInputDegrees,
  getAngleInputValue,
  getCanvasEscapeAction,
  getCenterRotatedTransform,
  getCenterScaledTransform,
  getClampedKeyboardMove,
  getContainedImageSize,
  getNextImageSelection,
  getNudgedPosition,
  getScaleFromPercent,
  getScalePercent,
  getScaledTransform,
  getSelectedImageFromState,
  isActivationKey,
  isTabLeavingImages,
  KEYBOARD_MOVE_FAST_STEP,
  KEYBOARD_MOVE_STEP,
  KEYBOARD_ROTATE_STEP,
  KEYBOARD_SCALE_FACTOR,
} from "./keyboardShortcuts";
import {
  getStickerEditResetUpdates,
  hasStickerEditChanges,
} from "./stickerEdit";
import {
  createStickerTintFilter,
  getStickerTintMode,
} from "./stickerTint";
import { getAutoFitZoomChange, getEraseZoomView, getZoomToFit } from "./zoomSizing";
import { getReadableMarkColor } from "../utils/colorContrast";
import { getStickerAssetCandidates } from "../utils/stickerAssetCandidates";
import type { BrushStroke, PhotoEdits } from "../photo/photoEdits";
import { getCutoutImagesState } from "../photo/cutoutTypes";
import type { CutoutChanges, CutoutImagesState, CutoutSource } from "../photo/cutoutTypes";
import { hasCutoutWorkingCanvas } from "../photo/cutoutCache";
import { CUTOUT_COPY } from "../photo/cutoutCopy";
import { getCutoutBrushScreenRadius, stickerLocalToSourceUv, stickerStrokeToSourceStroke } from "../photo/cutoutGeometry";
import {
  applyPresetToEdits,
  isDefaultPhotoEdits,
  PHOTO_ADJUST_FIELDS,
  PHOTO_PRESETS,
  stepAdjustField,
} from "../photo/photoEdits";
import { getEditedPhotoCanvas, pruneEditedPhotoCanvases } from "../photo/photoRenderCache";
import { getPhotoEditSections, PHOTO_EDIT_FEATURES } from "../photo/photoEditFeatures";
import type { BrushSize, PhotoToolMode } from "../photo/photoTool";
import {
  BRUSH_SCREEN_RADIUS,
  BRUSH_SIZE_OPTIONS,
  BRUSH_CURSOR_FILL_COLOR,
  BRUSH_CURSOR_STROKE_COLOR,
  ERASE_PREVIEW_COLOR,
  getDefaultBrushSize,
  getLocalBrushRadius,
  getVisiblePhotoSpanWidth,
  isBrushPointerStart,
  toNormalizedStroke,
} from "../photo/photoTool";
import { getEraseModeFocusTarget } from "../state/modalFocus";
import type { EraseModeFocusTarget } from "../state/modalFocus";
import type { LoadedPhotoImage, PhotoImagesState } from "../state/photoLoadState";
import { getPhotoImagesState, isCurrentPhotoLoad } from "../state/photoLoadState";
import { getDecorImagesState, isFrameColorApplied } from "../state/decorImagesState";
import type { DecorImagesState, FrameColorResult, FrameLoad } from "../state/decorImagesState";
import { getSlotButtonLabel, getSlotLabel, getSwatchName } from "../state/editorLabels";
import type { StageDisplayTransform } from "../utils/stageExport";

// 끌기 대안(설계 8.2): 한 번 누를 때 20px씩 옮깁니다(방향키 Shift와 같은 값).
const MOVE_BUTTONS = [
  { label: '위로 옮기기', delta: { x: 0, y: -KEYBOARD_MOVE_FAST_STEP } },
  { label: '아래로 옮기기', delta: { x: 0, y: KEYBOARD_MOVE_FAST_STEP } },
  { label: '왼쪽으로 옮기기', delta: { x: -KEYBOARD_MOVE_FAST_STEP, y: 0 } },
  { label: '오른쪽으로 옮기기', delta: { x: KEYBOARD_MOVE_FAST_STEP, y: 0 } },
] as const;
const STICKER_TILT_STEP = 15; // 스티커 기울이기 각도(설계 8.2)
const DETAIL_BUTTON_STYLE = { minHeight: '32px', fontSize: '14px', padding: '0 8px' } as const;
const PHOTO_DETAIL_BUTTON_STYLE = { ...DETAIL_BUTTON_STYLE, minHeight: '44px' } as const;
const PHOTO_PANEL_BUTTON_STYLE = { minHeight: '44px', fontSize: '14px', border: 'var(--border-width) solid var(--linear-neutral-500)' } as const;

// 모바일에서 드래그 중에도 동일 노드가 터치 이벤트를 계속 받도록 유지한다.
Konva.hitOnDragEnabled = true;
Konva.capturePointerEventsEnabled = true;

export type CanvasHistoryControls = {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

export type CanvasPhotoEditProps = {
  workingMaxSide: number;
  compareHeld: boolean;
  onCompareHeldChange: (held: boolean) => void;
  onEditsChange: (imageId: string, edits: PhotoEdits) => void;
  onEraseStrokeAdd: (imageId: string, stroke: BrushStroke) => void;
  onApplyAdjustToAll: (sourceImageId: string) => void;
  toolMode: PhotoToolMode;
  onToolModeChange: (mode: PhotoToolMode) => void;
  brushSize: BrushSize;
  onBrushSizeChange: (size: BrushSize) => void;
};

export type CanvasCutoutEditProps = {
  errorMessage: string | null;
  onRegenerate: (stickerId: string, changes: CutoutChanges) => void;
  onPreloadPointModel: () => void;
};

export type CanvasStageProps = {
  template: Template | null;
  selection: string | null;
  selectedSlot: string | null;
  zoom: number;
  selectedFrame: FrameType | null;
  userImages: UserImage[];
  frameColor: string;
  historyControls: CanvasHistoryControls;
  photoEdit: CanvasPhotoEditProps;
  cutoutEdit: CanvasCutoutEditProps;
  // 준비 보고는 보고를 낸 Stage와 함께 보냅니다. 저장이 렌더할 Stage의 보고인지 알아보는 데 씁니다(UX3-1).
  onPhotoImagesStateChange: (state: PhotoImagesState, userImages: UserImage[], stage: Konva.Stage | null) => void;
  onCutoutImagesStateChange: (state: CutoutImagesState, stage: Konva.Stage | null) => void;
  onDecorImagesStateChange: (state: DecorImagesState, stage: Konva.Stage | null) => void; // 프레임 이미지·색 처리와 일반 스티커(UX4-2)
  isEditLocked: boolean;
  exportMode?: boolean; // 내보내기 시 UI 오버레이 숨김
  stageRefExternal?: React.RefObject<Konva.Stage | null>; // 외부에서 Stage 접근용
  stageDisplayRefExternal?: React.MutableRefObject<StageDisplayTransform | null>; // 마지막으로 커밋한 Stage 표시 변환(저장 뒤 복원용, 보정표 D-13)
  isMobilePortraitLayout?: boolean; // components.css의 휴대폰 세로 배치 미디어 조건 값(App이 change 이벤트로 따라감)
  isNarrowLandscapeLayout?: boolean; // 768px 이하 낮은 가로 편집 화면: 캔버스와 제어판을 가로로 놓음(App이 정함)
  texts?: Array<{
    id: string;
    text: string;
    x: number;
    y: number;
    boxWidth: number;
    fontSize: number;
    fontFamily: string;
    fontColor: string;
    isBold: boolean;
    isItalic: boolean;
    isVertical: boolean;
    textAlign: "left" | "center" | "right";
    rotation: number;
  }>;
  stickers?: Array<{
    id: string;
    src: string;
    x: number;
    y: number;
    width: number;
    height: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    flipX: boolean;
    flipY: boolean;
    tintColor: string | null;
    cutout?: CutoutSource;
  }>;
  onSelect?: (id: string | null) => void;
  onReselect?: (id: string) => void; // 이미 고른 글씨·스티커를 다시 누르거나 끌기 시작함(메뉴 맞추기)
  onSlotSelect?: (slotId: string | null) => void;
  onZoomChange?: (zoom: number) => void;
  onImageUpload?: (file: File, slotId: string) => void;
  onRequestImageImport?: (slotId: string) => boolean;
  onOpenFrameGallery?: () => void;
  onImageTransform?: (imageId: string, transform: Partial<UserImage>) => void;
  onFrameColorChange?: (color: string) => void;
  onTextMove?: (textId: string, x: number, y: number) => void;
  onTextUpdate?: (textId: string, updates: Partial<{
    text: string;
    x: number;
    y: number;
    boxWidth: number;
    fontSize: number;
    fontFamily: string;
    fontColor: string;
    isBold: boolean;
    isItalic: boolean;
    isVertical: boolean;
    textAlign: "left" | "center" | "right";
    rotation: number;
  }>) => void;
  onImageDelete?: (imageId: string) => void;
  onTextDelete?: (textId: string) => void;
  onStickerDelete?: (stickerId: string) => void;
  onStickerUpdate?: (stickerId: string, updates: Partial<{
    x: number;
    y: number;
    width: number;
    height: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    flipX: boolean;
    flipY: boolean;
    tintColor: string | null;
  }>) => void;
};

const VISUALLY_HIDDEN_STYLE: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  margin: '-1px',
  padding: 0,
  border: 0,
};
const SLOT_LIST_VISIBLE_STYLE: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '6px' };
// 되돌리기 줄 버튼의 좌우 안쪽 여백. 휴대폰 패널 안쪽 너비는 화면 너비 - 140px이고, 줄이 필요한 최소 너비는 142px + 6 x 여백입니다.
// 여백이 16px이면 378px보다 좁은 화면(320px 포함)에서 줄이 패널 안쪽보다 넓어 좌우로 삐져나옵니다(WCAG 1.4.10).
// 화면이 1px 좁아질 때 여백을 1/6px씩 줄이면 줄이 패널 안쪽보다 항상 12px 좁습니다. 390px 이상은 16px 그대로이고 320px에서 약 4px입니다.
// '되돌리기'는 minWidth: min-content로 한 단어 글자가 버튼 밖으로 나가지 않게 합니다.
const HISTORY_BUTTON_PADDING = '0 clamp(4px, calc(16px - (390px - 100vw) / 6), 16px)';

const toLegacyFrameFileName = (frameType: FrameType): string | null => {
  if (frameType === "1l") return "1_l";
  if (frameType === "1f") return "1_v";

  const parsed = frameType.match(/^(\d+)([a-z])(?:_(\d+))?$/i);
  if (!parsed) return null;

  const [, cutCount, orientation, variant] = parsed;
  const suffix = variant ? `_${variant}` : "";
  return `${cutCount}_${orientation.toLowerCase()}${suffix}`;
};

const buildFrameImageCandidates = (frameType: FrameType, primaryPath: string): string[] => {
  const candidates = new Set<string>([
    primaryPath,
    `/frame/${frameType}.png`,
  ]);

  const legacyFileName = toLegacyFrameFileName(frameType);
  if (legacyFileName) {
    candidates.add(`/frame/${legacyFileName}.png`);
  }

  return Array.from(candidates);
};

type EditedPhotoDisplay = {
  key: string;
  canvas: HTMLCanvasElement | null;
};

const getPhotoEditDisplayKey = (edits: PhotoEdits, workingMaxSide: number): string => (
  JSON.stringify({
    adjust: edits.adjust,
    erase: edits.erase,
    workingMaxSide,
  })
);

export const CanvasStage: React.FC<CanvasStageProps> = ({
  selection,
  zoom,
  selectedFrame,
  selectedSlot,
  userImages,
  frameColor,
  historyControls,
  photoEdit,
  cutoutEdit,
  onPhotoImagesStateChange,
  onCutoutImagesStateChange,
  onDecorImagesStateChange,
  isEditLocked,
  exportMode = false,
  stageRefExternal,
  stageDisplayRefExternal,
  isMobilePortraitLayout = false,
  isNarrowLandscapeLayout = false,
  texts = [],
  stickers = [],
  onSelect,
  onReselect,
  onSlotSelect,
  onImageUpload,
  onRequestImageImport,
  onOpenFrameGallery,
  onImageTransform: onImageTransformProp,
  onFrameColorChange,
  onTextMove: onTextMoveProp,
  onTextUpdate: onTextUpdateProp,
  onZoomChange,
  onImageDelete,
  onTextDelete,
  onStickerDelete,
  onStickerUpdate: onStickerUpdateProp
}) => {
  // 모든 hook들을 먼저 호출 (조건부 렌더링 전에)
  const editLockedRef = useRef(isEditLocked);
  editLockedRef.current = isEditLocked; // 렌더 중에 대입: 잠금 커밋에서 없어지는 노드의 끝 이벤트도 잠금을 봄
  const onImageTransform: NonNullable<CanvasStageProps["onImageTransform"]> = (imageId, transform) => {
    if (editLockedRef.current) return; // 잠금 중 이동·종료 콜백은 문서를 바꾸지 않음
    onImageTransformProp?.(imageId, transform);
  };
  const onTextMove: NonNullable<CanvasStageProps["onTextMove"]> = (textId, x, y) => {
    if (editLockedRef.current) return;
    onTextMoveProp?.(textId, x, y);
  };
  const onTextUpdate: NonNullable<CanvasStageProps["onTextUpdate"]> = (textId, updates) => {
    if (editLockedRef.current) return;
    onTextUpdateProp?.(textId, updates);
  };
  const onStickerUpdate: NonNullable<CanvasStageProps["onStickerUpdate"]> = (stickerId, updates) => {
    if (editLockedRef.current) return;
    onStickerUpdateProp?.(stickerId, updates);
  };
  const stageRef = useRef<Konva.Stage | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageWrapperRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 컨테이너 측정 크기 (피드백 루프 방지용)
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  // 커스텀 컬러 팔레트 관련
  const [showCustomPalette, setShowCustomPalette] = useState(false);
  const [isFrameColorOpen, setIsFrameColorOpen] = useState(false); // 프레임 색은 기본으로 접어 둡니다
  const paletteCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const paletteAnchorRef = useRef<HTMLDivElement | null>(null);
  const customPickButtonRef = useRef<HTMLButtonElement | null>(null);
  // 어느 프레임용으로 읽었는지와 함께 둡니다. image가 null이면 모든 후보를 읽지 못한 것입니다. 프레임을 바꾼 직후에는 옛 프레임 결과를 쓰지 않습니다(UX4-2).
  const [frameLoad, setFrameLoad] = useState<{ frame: FrameType; image: HTMLImageElement | null } | null>(null);
  const isFrameLoadCurrent = frameLoad !== null && frameLoad.frame === selectedFrame;
  const frameImage = isFrameLoadCurrent ? frameLoad.image : null;
  const [loadedImages, setLoadedImages] = useState<Map<string, LoadedPhotoImage<HTMLImageElement>>>(new Map());
  const [loadedStickerImages, setLoadedStickerImages] = useState<Map<string, HTMLImageElement | null>>(new Map());
  const [failedStickerSources, setFailedStickerSources] = useState<Map<string, string>>(new Map()); // 스티커 id → 모든 후보를 읽지 못한 src
  const pendingImageLoadsRef = useRef<Map<string, { url: string; image: HTMLImageElement }>>(new Map());
  const userImageUrlsRef = useRef<Map<string, string>>(new Map());
  userImageUrlsRef.current = new Map(userImages.map((userImage) => [userImage.id, userImage.url] as const));
  // 색 처리 결과는 처리한 이미지·색과 함께 둡니다. 지금 이미지·색에 대한 결과일 때만 그립니다(UX4-2).
  const [processedFrame, setProcessedFrame] = useState<(FrameColorResult<HTMLImageElement> & { canvas: HTMLCanvasElement | null }) | null>(null);
  const processedFrameCanvas = isFrameColorApplied(processedFrame, frameImage, frameColor) ? processedFrame?.canvas ?? null : null;
  const [draggedSlotId, setDraggedSlotId] = useState<string | null>(null);
  const [isSlotListFocused, setIsSlotListFocused] = useState(false); // 칸 버튼 목록은 포커스가 안에 있을 때만 보입니다
  const currentSlotIdRef = useRef<string | null>(null);
  const stickerLoadSourcesRef = useRef<Map<string, string>>(new Map());
  const stickerImageRefs = useRef<Record<string, Konva.Image | null>>({});
  // 빠른 선택 스와치 색상 (외부 설정으로 오버라이드 가능)
  const [presetColors, setPresetColors] = useState<string[]>([
    '#FFFFFF', // White
    '#000000', // Black
    '#DCDCDC', // Light Gray.
    '#fe9fb3', // Deep Pink.
    '#ffe4c4', // Gold
    '#C8F7DC', // Mint.
    '#C6E2FF', // Light Blue.
    '#ffc1cc', // Rose Pink.
  ]);

  const frameLayout = selectedFrame ? FRAME_LAYOUTS[selectedFrame] : null;
  const selectedImage = getSelectedImageFromState({ selection, selectedSlot, userImages });
  const selectedImageId = selectedImage?.id ?? null;
  const [isAdjustDetailOpen, setIsAdjustDetailOpen] = useState(false);
  const [isPositionDetailOpen, setIsPositionDetailOpen] = useState(false);
  // 사진 지우기 붓 크기는 스티커 붓 크기(photoEdit.brushSize)와 따로 둡니다(SP-3).
  const [photoEraseBrushSize, setPhotoEraseBrushSize] = useState<BrushSize>("medium");
  // 지우기 모드에서 제어판이 받는 폭을 보통 상태와 같게 지킵니다(SP-8).
  const [erasePanelWidth, setErasePanelWidth] = useState<number | null>(null);
  const [erasePanelAvailableWidth, setErasePanelAvailableWidth] = useState<number | null>(null);
  const controlPanelRef = useRef<HTMLDivElement | null>(null);
  const activeBrushSize = photoEdit.toolMode === "erase-photo" ? photoEraseBrushSize : photoEdit.brushSize;
  const setActiveBrushSize = (size: BrushSize) => {
    if (photoEdit.toolMode === "erase-photo") setPhotoEraseBrushSize(size);
    else photoEdit.onBrushSizeChange(size);
  };
  const [isStickerDetailOpen, setIsStickerDetailOpen] = useState(false); // 스티커 '자세히'는 기본으로 접어 둡니다
  const [stickerAngleDraft, setStickerAngleDraft] = useState<AngleDraft | null>(null); // 각도 칸에 쓰는 중인 글자. 스티커 ID에 묶어 다른 스티커가 선택되면 버립니다(UX5-6)
  const [appliedToAllCount, setAppliedToAllCount] = useState<number | null>(null); // '모든 사진에 적용' 결과 표시
  const [editedPhotoDisplays, setEditedPhotoDisplays] = useState<Map<string, EditedPhotoDisplay>>(new Map());
  const editedPhotoDisplaysRef = useRef(editedPhotoDisplays);
  const userImagesRef = useRef(userImages);
  const loadedImagesRef = useRef(loadedImages);
  const workingMaxSideRef = useRef(photoEdit.workingMaxSide);
  const selectedImageIdRef = useRef<string | null>(selectedImageId);
  editedPhotoDisplaysRef.current = editedPhotoDisplays;
  userImagesRef.current = userImages;
  loadedImagesRef.current = loadedImages;
  workingMaxSideRef.current = photoEdit.workingMaxSide;
  selectedImageIdRef.current = selectedImageId;

  useEffect(() => {
    setIsAdjustDetailOpen(false);
    setIsPositionDetailOpen(false);
  }, [selectedImageId]);

  useEffect(() => {
    setAppliedToAllCount(null);
  }, [selectedImageId]);

  useEffect(() => {
    let cancelled = false;
    let frameId: number | null = null;

    const imagesById = new Map(userImages.map((userImage) => [userImage.id, userImage] as const));
    const nextDisplays = new Map(editedPhotoDisplaysRef.current);
    let displaysChanged = false;

    nextDisplays.forEach((_display, imageId) => {
      const currentImage = imagesById.get(imageId);
      if (!currentImage || isDefaultPhotoEdits(currentImage.edits)) {
        nextDisplays.delete(imageId);
        displaysChanged = true;
      }
    });

    if (displaysChanged) {
      editedPhotoDisplaysRef.current = nextDisplays;
      setEditedPhotoDisplays(nextDisplays);
    }

    const jobs: Array<{
      imageId: string;
      url: string;
      key: string;
    }> = [];

    userImages.forEach((userImage) => {
      if (isDefaultPhotoEdits(userImage.edits)) return;
      const loadedEntry = loadedImages.get(userImage.id);
      if (!loadedEntry?.image || loadedEntry.url !== userImage.url) return;
      const key = getPhotoEditDisplayKey(userImage.edits, photoEdit.workingMaxSide);
      if (nextDisplays.get(userImage.id)?.key === key) return;
      jobs.push({ imageId: userImage.id, url: userImage.url, key });
    });

    let jobIndex = 0;

    const scheduleNext = () => {
      if (cancelled || jobIndex >= jobs.length) return;
      frameId = requestAnimationFrame(processNext);
    };

    const processNext = () => {
      frameId = null;
      if (cancelled || jobIndex >= jobs.length) return;

      const job = jobs[jobIndex];
      jobIndex += 1;

      const currentImage = userImagesRef.current.find((userImage) => userImage.id === job.imageId);
      const currentLoaded = loadedImagesRef.current.get(job.imageId);
      if (
        !currentImage
        || currentImage.url !== job.url
        || !currentLoaded?.image
        || currentLoaded.url !== job.url
        || getPhotoEditDisplayKey(currentImage.edits, workingMaxSideRef.current) !== job.key
      ) {
        scheduleNext();
        return;
      }

      const canvas = getEditedPhotoCanvas(
        job.imageId,
        currentLoaded.image,
        currentImage.edits,
        workingMaxSideRef.current,
        currentImage.id === selectedImageIdRef.current,
      );

      if (!cancelled) {
        const latestImage = userImagesRef.current.find((userImage) => userImage.id === job.imageId);
        const latestLoaded = loadedImagesRef.current.get(job.imageId);
        const latestKey = latestImage
          ? getPhotoEditDisplayKey(latestImage.edits, workingMaxSideRef.current)
          : null;

        if (
          latestImage
          && latestImage.url === job.url
          && latestLoaded?.url === job.url
          && latestKey === job.key
        ) {
          const latestDisplays = new Map(editedPhotoDisplaysRef.current);
          latestDisplays.set(job.imageId, { key: job.key, canvas });
          editedPhotoDisplaysRef.current = latestDisplays;
          setEditedPhotoDisplays(latestDisplays);
        }
      }

      scheduleNext();
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, [userImages, loadedImages, photoEdit.workingMaxSide, selectedImageId]);

  const isEditedPhotoDisplayReady = useMemo(() => {
    for (const userImage of userImages) {
      if (isDefaultPhotoEdits(userImage.edits)) continue;
      const loadedEntry = loadedImages.get(userImage.id);
      if (!loadedEntry?.image || loadedEntry.url !== userImage.url) continue;
      const display = editedPhotoDisplays.get(userImage.id);
      if (!display || display.key !== getPhotoEditDisplayKey(userImage.edits, photoEdit.workingMaxSide)) {
        return false;
      }
    }
    return true;
  }, [userImages, loadedImages, editedPhotoDisplays, photoEdit.workingMaxSide]);

  const editedPhotoRenderFailureIds = useMemo(() => {
    const failedImageIds: string[] = [];

    userImages.forEach((userImage) => {
      if (isDefaultPhotoEdits(userImage.edits)) return;
      const loadedEntry = loadedImages.get(userImage.id);
      if (!loadedEntry?.image || loadedEntry.url !== userImage.url) return;
      const display = editedPhotoDisplays.get(userImage.id);
      if (!display || display.key !== getPhotoEditDisplayKey(userImage.edits, photoEdit.workingMaxSide)) return;
      if (display.canvas === null) failedImageIds.push(userImage.id);
    });

    return failedImageIds;
  }, [userImages, loadedImages, editedPhotoDisplays, photoEdit.workingMaxSide]);

  useEffect(() => {
    const editedPhotoIds = new Set(
      userImages
        .filter((userImage) => !isDefaultPhotoEdits(userImage.edits))
        .map((userImage) => userImage.id),
    );
    pruneEditedPhotoCanvases(new Set(userImages.map((userImage) => userImage.id)), selectedImageId, editedPhotoIds);
  }, [userImages, selectedImageId]);

  useEffect(() => () => pruneEditedPhotoCanvases(new Set(), null), []);

  const selectedText = selection ? texts.find((text) => text.id === selection) ?? null : null;
  const selectedSticker = selection ? stickers.find((sticker) => sticker.id === selection) ?? null : null;
  const photoEditSections = getPhotoEditSections(PHOTO_EDIT_FEATURES);
  const isPhotoEraseMode = Boolean(selectedImage) && photoEditSections.showErase && photoEdit.toolMode === "erase-photo";
  const hasEditedPhotos = userImages.some((image) => !isDefaultPhotoEdits(image.edits));
  const canResetStickerEdit = selectedSticker ? hasStickerEditChanges(selectedSticker) : false;
  const isCutoutCacheMissing = selectedSticker?.cutout ? !hasCutoutWorkingCanvas(selectedSticker.id) : false;
  // 공통 조작 높이: 누끼 다듬기 카드에서만 44, 일반 '스티커 편집' 카드는 지금처럼 32입니다(계획 4.1 #12).
  const stickerControlHeight = selectedSticker?.cutout ? '44px' : '32px';
  const stickerDetailButtonStyle = selectedSticker?.cutout ? PHOTO_DETAIL_BUTTON_STYLE : DETAIL_BUTTON_STYLE;
  const brushScreenRadius = photoEdit.toolMode === "erase-cutout" && selectedSticker?.cutout
    ? getCutoutBrushScreenRadius(BRUSH_SCREEN_RADIUS[activeBrushSize], selectedSticker, zoom)
    : BRUSH_SCREEN_RADIUS[activeBrushSize];
  // 칸 목록으로 골라 selection이 비어 있어도 사진 지우기 모드에서는 캔버스가 터치를 모두 받아야 획이 페이지 스크롤로 새지 않습니다.
  const isTouchManipulationActive = Boolean(selection) || isPhotoEraseMode;

  useEffect(() => {
    if (!photoEditSections.showBox && photoEdit.compareHeld) {
      photoEdit.onCompareHeldChange(false);
    }
  }, [photoEditSections.showBox, photoEdit.compareHeld, photoEdit.onCompareHeldChange]);

  useEffect(() => () => {
    photoEdit.onCompareHeldChange(false);
  }, [photoEdit.onCompareHeldChange]);

  type BrushDraft = {
    pointerId: number;
    mode: PhotoToolMode;
    targetId: string;
    overlay: Konva.Node;
    stagePoints: number[];
    localPoints: number[];
  };

  const brushLineRef = useRef<Konva.Line | null>(null);
  const brushDraftRef = useRef<BrushDraft | null>(null);
  const eraseStartButtonRef = useRef<HTMLButtonElement | null>(null);
  const eraseDoneButtonRef = useRef<HTMLButtonElement | null>(null);
  const eraseFocusTargetRef = useRef<EraseModeFocusTarget>("none");
  const brushCursorRef = useRef<Konva.Circle | null>(null);

  const drawBrushPreview = (points: number[]) => {
    brushLineRef.current?.points(points);
    brushLineRef.current?.getLayer()?.batchDraw();
  };

  const hideBrushCursor = () => {
    const brushCursor = brushCursorRef.current;
    if (!brushCursor || !brushCursor.visible()) return;
    brushCursor.visible(false);
    brushCursor.getLayer()?.batchDraw();
  };

  // 마우스로 칠하기 전에만 붓 원을 보입니다. 터치·펜과 칠하는 중에는 미리보기 선이 알려 줍니다(설계 8.4).
  const moveBrushCursor = (event: Konva.KonvaEventObject<PointerEvent>) => {
    if (event.evt.pointerType !== "mouse" || brushDraftRef.current) {
      hideBrushCursor();
      return;
    }
    const brushCursor = brushCursorRef.current;
    const pointerPosition = event.target.getStage()?.getRelativePointerPosition();
    if (!brushCursor || !pointerPosition) return;
    brushCursor.position(pointerPosition);
    brushCursor.visible(true);
    brushCursor.getLayer()?.batchDraw();
  };

  const cancelBrushStroke = () => {
    brushDraftRef.current = null;
    drawBrushPreview([]);
    hideBrushCursor();
  };

  const startBrushStroke = (event: Konva.KonvaEventObject<PointerEvent>, targetId: string) => {
    if (!isBrushPointerStart(event.evt.pointerType, event.evt.isPrimary, event.evt.button)) return;
    if (brushDraftRef.current) cancelBrushStroke();
    hideBrushCursor();
    const overlay = event.target;
    const local = overlay.getRelativePointerPosition();
    const stagePoint = overlay.getStage()?.getRelativePointerPosition();
    if (!local || !stagePoint) return;
    brushDraftRef.current = {
      pointerId: event.evt.pointerId,
      mode: photoEdit.toolMode,
      targetId,
      overlay,
      stagePoints: [stagePoint.x, stagePoint.y],
      localPoints: [local.x, local.y],
    };
    drawBrushPreview(brushDraftRef.current.stagePoints);
  };

  const moveBrushStroke = (event: Konva.KonvaEventObject<PointerEvent>) => {
    const draft = brushDraftRef.current;
    if (!draft || event.evt.pointerId !== draft.pointerId) return;
    const local = draft.overlay.getRelativePointerPosition();
    const stagePoint = draft.overlay.getStage()?.getRelativePointerPosition();
    if (!local || !stagePoint) return;
    draft.localPoints.push(local.x, local.y);
    draft.stagePoints.push(stagePoint.x, stagePoint.y);
    drawBrushPreview(draft.stagePoints);
  };

  const finishBrushStroke = (pointerId: number) => {
    const draft = brushDraftRef.current;
    if (!draft || draft.pointerId !== pointerId) return;
    cancelBrushStroke();
    if (draft.mode !== photoEdit.toolMode) return;
    const requestedScreenRadius = BRUSH_SCREEN_RADIUS[activeBrushSize];
    if (draft.mode === "erase-photo") {
      const targetImage = userImages.find((userImage) => userImage.id === draft.targetId);
      if (!targetImage) return;
      const localRadius = getLocalBrushRadius(requestedScreenRadius, draft.overlay.getAbsoluteScale().x);
      const stroke = toNormalizedStroke(draft.localPoints, draft.overlay.width(), draft.overlay.height(), localRadius);
      if (!stroke) return;
      photoEdit.onEraseStrokeAdd(targetImage.id, stroke);
    }
    if (draft.mode === "erase-cutout") {
      const targetSticker = stickers.find((sticker) => sticker.id === draft.targetId);
      if (!targetSticker?.cutout) return;
      // 미리보기 원과 같은 상한 반지름을 실제 픽셀 처리에도 쓴다.
      const localRadius = getLocalBrushRadius(
        getCutoutBrushScreenRadius(requestedScreenRadius, targetSticker, zoom),
        draft.overlay.getAbsoluteScale().x,
      );
      const stroke = stickerStrokeToSourceStroke(draft.localPoints, localRadius, { width: targetSticker.width, height: targetSticker.height }, targetSticker.cutout.crop, targetSticker.cutout.workingSize);
      if (!stroke) return;
      cutoutEdit.onRegenerate(targetSticker.id, { eraseStrokes: [...targetSticker.cutout.eraseStrokes, stroke] });
    }
  };

  const handleCutoutPick = (event: Konva.KonvaEventObject<PointerEvent>, sticker: { id: string; width: number; height: number; cutout?: CutoutSource }) => {
    if (!sticker.cutout) return;
    const local = event.target.getRelativePointerPosition();
    if (!local) return;
    const point = stickerLocalToSourceUv(local, { width: sticker.width, height: sticker.height }, sticker.cutout.crop, sticker.cutout.workingSize);
    if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return;
    photoEdit.onToolModeChange("none");
    cutoutEdit.onRegenerate(sticker.id, { target: { kind: "point", x: point.x, y: point.y } });
  };

  const finishBrushStrokeRef = useRef(finishBrushStroke);
  finishBrushStrokeRef.current = finishBrushStroke;
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const draft = brushDraftRef.current;
      if (!draft) return;
      if (draft.pointerId !== event.pointerId) {
        cancelBrushStroke(); // 두 번째 손가락
        return;
      }
      // 같은 id라도 새로 눌린 주 입력이면, 종료를 놓친 이전 임시 획을 버린다.
      if (isBrushPointerStart(event.pointerType, event.isPrimary, event.button)) cancelBrushStroke();
    };
    const onPointerUp = (event: PointerEvent) => finishBrushStrokeRef.current(event.pointerId);
    const onPointerCancel = (event: PointerEvent) => {
      if (brushDraftRef.current?.pointerId === event.pointerId) cancelBrushStroke();
    };
    const cancelBrushStrokeOnHidden = () => {
      if (document.visibilityState === "hidden") cancelBrushStroke();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("blur", cancelBrushStroke);
    document.addEventListener("visibilitychange", cancelBrushStrokeOnHidden);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("blur", cancelBrushStroke);
      document.removeEventListener("visibilitychange", cancelBrushStrokeOnHidden);
    };
  }, []);

  // 도구 모드나 선택이 바뀌면 진행 중 획을 취소합니다.
  // 획을 긋는 도중 Stage 크기·배율·위치가 바뀌어도(창 크기 변경 등) 그 획은 저장하지 않습니다(보정표 D-7). 저장된 획과 되돌리기 기록은 그대로입니다.
  // Stage 크기·배율·위치(stageWidth, stageHeight, stageView)는 zoom, 프레임 배치, 확대할 칸(모드, 고른 사진의 칸, 저장 중)에서만 계산됩니다.
  const selectedImageSlotId = selectedImage?.slotId ?? null;
  useEffect(() => {
    cancelBrushStroke();
  }, [photoEdit.toolMode, selection, zoom, frameLayout, isPhotoEraseMode, selectedImageSlotId, exportMode]);

  const renderBrushControls = (guideText: string) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <p style={{ margin: 0, fontSize: "14px", color: "var(--linear-neutral-50)" }}>{guideText}</p>
      <div role="group" aria-label="붓 크기" style={{ display: "flex", gap: "6px" }}>
        {BRUSH_SIZE_OPTIONS.map((option) => {
          const isBrushSelected = activeBrushSize === option.size;
          return (
            <button
              key={option.size}
              type="button"
              className="linear-button linear-button--secondary"
              aria-pressed={isBrushSelected}
              onClick={() => setActiveBrushSize(option.size)}
              style={{
                flex: 1,
                minWidth: "44px",
                minHeight: "44px",
                padding: "0 8px",
                fontSize: "14px",
                border: "var(--border-width) solid var(--linear-neutral-500)",
              }}
            >
              {isBrushSelected ? <span aria-hidden="true">✓ </span> : null}{option.label}
            </button>
          );
        })}
      </div>
      <button
        ref={eraseDoneButtonRef}
        type="button"
        className="linear-button linear-button--primary"
        onClick={(event) => {
          if (photoEdit.toolMode === "erase-photo") {
            eraseFocusTargetRef.current = getEraseModeFocusTarget({ change: "exit", isKeyboardFocused: event.detail === 0 });
          }
          photoEdit.onToolModeChange("none");
        }}
        style={{
          minHeight: "52px",
          fontSize: "16px",
          border: "var(--border-width) solid var(--linear-neutral-500)",
        }}
      >
        완료
      </button>
    </div>
  );

  // 제어판 안 어디에 포커스가 있어도 Esc로 지우기 모드를 끝냅니다(S-15). 창 단위 Esc 듣기(App 되돌리기, 글씨체 창)로 올라가지 않게 멈춥니다.
  const handleControlPanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || photoEdit.toolMode !== "erase-photo") return;
    event.preventDefault();
    event.stopPropagation();
    eraseFocusTargetRef.current = getEraseModeFocusTarget({ change: "exit", isKeyboardFocused: true });
    photoEdit.onToolModeChange("none");
  };

  const focusCanvasArea = useCallback(() => {
    stageWrapperRef.current?.focus({ preventScroll: true });
  }, []);

  const setStageCursor = useCallback((cursor: string) => {
    const stageContainer = stageRef.current?.container();
    if (stageContainer) {
      stageContainer.style.cursor = cursor;
    }
  }, []);

  // 지우기 모드에 키보드로 들어가고 나올 때, 다음 그리기 뒤 한 번만 포커스를 옮깁니다(설계 8.3, src/ui/EditorPanel.tsx 201-208 본보기).
  useLayoutEffect(() => {
    const focusTarget = eraseFocusTargetRef.current;
    if (focusTarget === "none") return;
    eraseFocusTargetRef.current = "none";
    if (focusTarget === "erase-done") eraseDoneButtonRef.current?.focus();
    else eraseStartButtonRef.current?.focus();
  });

  // 오버레이가 사라질 때는 onMouseLeave가 오지 않으므로, 모드가 끝나면 십자 커서를 되돌립니다(설계 8.4).
  useEffect(() => {
    if (photoEdit.toolMode !== "erase-photo") return;
    return () => setStageCursor("default");
  }, [photoEdit.toolMode, setStageCursor]);

  // 지우기 모드에서는 Stage 경계 안(오버레이, 칸 여백, 다른 칸)의 휠과 두 손가락 핀치가 사진 크기를 바꾸지 않게 합니다(SP-2).
  // Konva 이벤트는 대상 → 부모 순이라 Stage onWheel로는 사진 처리보다 늦습니다. 감싸개에서 capture 단계로 먼저 막습니다.
  useEffect(() => {
    const stageWrapper = stageWrapperRef.current;
    if (!stageWrapper || !isPhotoEraseMode) return;
    const blockStageGesture = (event: Event) => {
      if (event.type !== "wheel" && (event as TouchEvent).touches.length < 2) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const listenerOptions = { capture: true, passive: false };
    stageWrapper.addEventListener("wheel", blockStageGesture, listenerOptions);
    stageWrapper.addEventListener("touchstart", blockStageGesture, listenerOptions);
    stageWrapper.addEventListener("touchmove", blockStageGesture, listenerOptions);
    return () => {
      stageWrapper.removeEventListener("wheel", blockStageGesture, { capture: true });
      stageWrapper.removeEventListener("touchstart", blockStageGesture, { capture: true });
      stageWrapper.removeEventListener("touchmove", blockStageGesture, { capture: true });
    };
  }, [isPhotoEraseMode]);

  // 모드에서 거는 제어판 최소 폭이 지금 쓸 수 있는 폭을 넘지 않게, 창 크기가 바뀔 때마다 다시 잽니다(보정표 D-6).
  useEffect(() => {
    if (!isPhotoEraseMode) return;
    const measurePanelAvailableWidth = () => {
      const panelParent = controlPanelRef.current?.parentElement;
      setErasePanelAvailableWidth(panelParent ? panelParent.clientWidth : null);
    };
    measurePanelAvailableWidth();
    window.addEventListener("resize", measurePanelAvailableWidth);
    return () => {
      window.removeEventListener("resize", measurePanelAvailableWidth);
      setErasePanelAvailableWidth(null); // 다음 진입의 첫 그리기가 지난 값을 쓰지 않게 비웁니다.
    };
  }, [isPhotoEraseMode]);

  const selectImage = useCallback((imageId: string, slotId: string) => {
    if (selection === imageId && selectedSlot === slotId) {
      focusCanvasArea();
      return;
    }
    onSelect?.(imageId);
    onSlotSelect?.(slotId);
    focusCanvasArea();
  }, [focusCanvasArea, onSelect, onSlotSelect, selectedSlot, selection]);

  const selectSticker = useCallback((stickerId: string) => {
    if (selection === stickerId) {
      onReselect?.(stickerId);
      focusCanvasArea();
      return;
    }
    onSelect?.(stickerId);
    focusCanvasArea();
  }, [focusCanvasArea, onReselect, onSelect, selection]);

  const selectText = useCallback((textId: string) => {
    if (selection === textId) {
      onReselect?.(textId);
      focusCanvasArea();
      return;
    }
    onSelect?.(textId);
    focusCanvasArea();
  }, [focusCanvasArea, onReselect, onSelect, selection]);

  const clearCanvasSelection = useCallback(() => {
    onSelect?.(null);
    onSlotSelect?.(null);
    setStageCursor("default");
  }, [onSelect, onSlotSelect, setStageCursor]);

  const handleStagePointerDown = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage()) {
      focusCanvasArea();
      clearCanvasSelection();
    }
  }, [clearCanvasSelection, focusCanvasArea]);

  const getImageDisplayContext = useCallback((image: Pick<UserImage, "id" | "slotId">) => {
    if (!frameLayout) return null;

    const slot = frameLayout.slots.find((item) => item.id === image.slotId);
    if (!slot) return null;

    const loadedEntry = loadedImages.get(image.id);
    const currentUrl = userImageUrlsRef.current.get(image.id);
    if (!loadedEntry || !currentUrl || loadedEntry.url !== currentUrl || !(loadedEntry.image instanceof HTMLImageElement)) return null;
    const loadedImage = loadedEntry.image;

    return {
      slot,
      displaySize: getContainedImageSize(
        loadedImage.width,
        loadedImage.height,
        slot.width,
        slot.height,
      ),
    };
  }, [frameLayout, loadedImages]);

  // 텍스트 세로 배치 유틸리티 함수
  const formatVerticalText = (text: string, isVertical: boolean): string => {
    // 세로 배치일 때 기존 줄바꿈은 무시하거나 적절히 처리할 수 있지만, 여기서는 단순 문자 단위 분리
    return isVertical ? text.replace(/\n/g, ' ').split('').join('\n') : text;
  };

  // 팔레트 미리보기 상태 (항상 동일 훅 순서 유지를 위해 상단으로 이동)
  const [palettePreview, setPalettePreview] = useState<{
    visible: boolean;
    x: number;
    y: number;
    color: string;
  }>({ visible: false, x: 0, y: 0, color: '#FFFFFF' });

  // 프레임 이미지 로드 (캐시 우회 및 오류 처리)
  useEffect(() => {
    if (selectedFrame && frameLayout) {
      let cancelled = false;
      const sources = buildFrameImageCandidates(selectedFrame, frameLayout.imagePath);
      let currentSourceIndex = 0;

      const tryLoad = () => {
        if (cancelled) return;

        const source = sources[currentSourceIndex];
        if (!source) {
          console.warn(`[CanvasStage] 프레임 이미지를 불러오지 못했습니다: ${selectedFrame}`);
          setFrameLoad({ frame: selectedFrame, image: null });
          return;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (!cancelled) {
            setFrameLoad({ frame: selectedFrame, image: img });
          }
        };
        img.onerror = () => {
          currentSourceIndex += 1;
          tryLoad();
        };

        const bust = `${source}${source.includes("?") ? "&" : "?"}t=${Date.now()}`;
        img.src = bust;
      };

      setFrameLoad(null);
      tryLoad();

      return () => {
        cancelled = true;
      };
    } else {
      setFrameLoad(null);
    }
  }, [selectedFrame, frameLayout?.imagePath]);

  // 헥사 색상 -> RGB 변환
  const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const s = hex.replace('#', '');
    if (s.length === 3) {
      const r = parseInt(s[0] + s[0], 16);
      const g = parseInt(s[1] + s[1], 16);
      const b = parseInt(s[2] + s[2], 16);
      return { r, g, b };
    }
    if (s.length === 6) {
      const r = parseInt(s.slice(0, 2), 16);
      const g = parseInt(s.slice(2, 4), 16);
      const b = parseInt(s.slice(4, 6), 16);
      return { r, g, b };
    }
    return null;
  };

  // 프레임 이미지의 흰색 영역을 선택된 색으로 치환
  useEffect(() => {
    if (!frameImage) {
      setProcessedFrame(null);
      return;
    }
    // 색이 없거나 처리할 수 없으면 원본을 그리지만, 처리를 마친 것으로 기록해 저장이 기다리지 않게 합니다.
    const useOriginalFrame = () => setProcessedFrame({ image: frameImage, color: frameColor, canvas: null });
    if (!frameColor) {
      useOriginalFrame();
      return;
    }

    const rgb = hexToRgb(frameColor);
    if (!rgb) {
      useOriginalFrame();
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      useOriginalFrame();
      return;
    }

    // 원본 이미지 크기 기준으로 처리
    const w = frameImage.naturalWidth || frameImage.width;
    const h = frameImage.naturalHeight || frameImage.height;
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(frameImage, 0, 0, w, h);

    try {
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      // 임계값: 거의 흰색(밝은 영역)만 치환
      const whiteThreshold = 245; // 0~255
      const alphaThreshold = 10;  // 투명 픽셀은 무시

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a > alphaThreshold && r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold) {
          data[i] = rgb.r;
          data[i + 1] = rgb.g;
          data[i + 2] = rgb.b;
          // alpha는 유지
        }
      }

      ctx.putImageData(imageData, 0, 0);
      setProcessedFrame({ image: frameImage, color: frameColor, canvas });
    } catch {
      // CORS 또는 다른 이유로 접근 실패 시 원본 사용
      useOriginalFrame();
    }
  }, [frameImage, frameColor]);

  // 사용자 이미지 로드
  useEffect(() => {
    const activeImageUrls = new Map(userImages.map((userImage) => [userImage.id, userImage.url] as const));

    // 지금 문서에 없거나 URL이 바뀐 진행 중 로드만 버린다. 아직 활성인 다른 사진의 로드는 그대로 둔다.
    pendingImageLoadsRef.current.forEach((pendingLoad, imageId) => {
      if (activeImageUrls.get(imageId) === pendingLoad.url) return;
      pendingLoad.image.onload = null;
      pendingLoad.image.onerror = null;
      pendingImageLoadsRef.current.delete(imageId);
    });

    setLoadedImages((previous) => {
      let hasStale = false;
      const next = new Map(previous);
      next.forEach((loadedEntry, imageId) => {
        if (activeImageUrls.get(imageId) !== loadedEntry.url) {
          next.delete(imageId);
          hasStale = true;
        }
      });
      return hasStale ? next : previous;
    });

    userImages.forEach((userImage) => {
      if (loadedImages.get(userImage.id)?.url === userImage.url) return;
      if (pendingImageLoadsRef.current.get(userImage.id)?.url === userImage.url) return;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        pendingImageLoadsRef.current.delete(userImage.id);
        if (!isCurrentPhotoLoad(userImage.id, userImage.url, userImageUrlsRef.current)) return;
        setLoadedImages((previous) => new Map(previous).set(userImage.id, { url: userImage.url, image: img }));
      };
      img.onerror = () => {
        pendingImageLoadsRef.current.delete(userImage.id);
        if (!isCurrentPhotoLoad(userImage.id, userImage.url, userImageUrlsRef.current)) return;
        console.error(`Failed to load image: ${userImage.id}`);
        // 로딩 실패한 이미지도 Map에 null로 추가하여 무한 재시도 방지
        setLoadedImages((previous) => new Map(previous).set(userImage.id, { url: userImage.url, image: null }));
      };
      pendingImageLoadsRef.current.set(userImage.id, { url: userImage.url, image: img });
      img.src = userImage.url;
    });
  }, [userImages]);

  useEffect(() => () => {
    pendingImageLoadsRef.current.forEach((pendingLoad) => {
      pendingLoad.image.onload = null;
      pendingLoad.image.onerror = null;
    });
    pendingImageLoadsRef.current.clear();
  }, []);

  const basePhotoImagesState = getPhotoImagesState(userImages, loadedImages);
  const photoImagesState: PhotoImagesState = basePhotoImagesState.kind === "failed"
    ? basePhotoImagesState
    : editedPhotoRenderFailureIds.length > 0
      ? { kind: "failed", imageIds: editedPhotoRenderFailureIds }
      : basePhotoImagesState.kind === "ready" && !isEditedPhotoDisplayReady
        ? { kind: "loading" }
        : basePhotoImagesState;
  const photoImagesStateKey = photoImagesState.kind === "failed"
    ? `failed:${photoImagesState.imageIds.join(",")}`
    : photoImagesState.kind;

  useEffect(() => {
    onPhotoImagesStateChange(photoImagesState, userImages, stageRef.current);
  }, [onPhotoImagesStateChange, photoImagesStateKey, userImages]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const activeStickerIds = new Set(stickers.map((sticker) => sticker.id));

    Object.keys(stickerImageRefs.current).forEach((stickerId) => {
      if (!activeStickerIds.has(stickerId)) {
        delete stickerImageRefs.current[stickerId];
      }
    });

    setLoadedStickerImages((prev) => {
      const next = new Map<string, HTMLImageElement | null>();
      prev.forEach((image, stickerId) => {
        if (activeStickerIds.has(stickerId)) {
          next.set(stickerId, image);
        }
      });
      return next;
    });

    setFailedStickerSources((prev) => {
      const next = new Map(Array.from(prev).filter(([stickerId]) => activeStickerIds.has(stickerId)));
      return next.size === prev.size ? prev : next;
    });

    Array.from(stickerLoadSourcesRef.current.keys()).forEach((stickerId) => {
      if (!activeStickerIds.has(stickerId)) {
        stickerLoadSourcesRef.current.delete(stickerId);
      }
    });

    stickers.forEach((sticker) => {
      if (stickerLoadSourcesRef.current.get(sticker.id) === sticker.src) {
        return;
      }

      stickerLoadSourcesRef.current.set(sticker.id, sticker.src);
      setFailedStickerSources((prev) => {
        if (!prev.has(sticker.id)) return prev;
        const next = new Map(prev);
        next.delete(sticker.id);
        return next;
      });
      const candidates = getStickerAssetCandidates(sticker.src);
      let candidateIndex = 0;

      const tryLoadStickerImage = () => {
        const candidateSrc = candidates[candidateIndex];
        if (!candidateSrc) {
          if (stickerLoadSourcesRef.current.get(sticker.id) !== sticker.src) return;
          setLoadedStickerImages((prev) => new Map(prev).set(sticker.id, null));
          setFailedStickerSources((prev) => new Map(prev).set(sticker.id, sticker.src));
          return;
        }

        const image = new window.Image();
        image.crossOrigin = "anonymous";
        image.onload = () => {
          if (stickerLoadSourcesRef.current.get(sticker.id) !== sticker.src) return;
          setLoadedStickerImages((prev) => new Map(prev).set(sticker.id, image));
        };
        image.onerror = () => {
          candidateIndex += 1;
          tryLoadStickerImage();
        };
        image.src = candidateSrc;
      };

      tryLoadStickerImage();
    });
  }, [stickers]);

  const cutoutImagesState = getCutoutImagesState(stickers
    .filter((sticker) => sticker.cutout)
    .map((sticker) => ({
      id: sticker.id,
      src: sticker.src,
      loadedSrc: loadedStickerImages.get(sticker.id)?.src ?? null,
      failedSrc: failedStickerSources.get(sticker.id) ?? null,
    })));
  const cutoutImagesStateKey = cutoutImagesState.kind === "failed"
    ? `failed:${cutoutImagesState.stickerIds.join(",")}`
    : cutoutImagesState.kind;
  useEffect(() => {
    onCutoutImagesStateChange(cutoutImagesState, stageRef.current);
  }, [cutoutImagesStateKey, stickers]);

  // 프레임 이미지·색 처리와 일반 스티커(누끼가 아닌 것)가 그려질 준비가 됐는지 같은 방식으로 보고합니다(UX4-2).
  const frameLoadStatus: FrameLoad = !selectedFrame
    ? "none"
    : !isFrameLoadCurrent
      ? "loading"
      : frameLoad.image === null
        ? "failed"
        : "loaded";
  const decorImagesState = getDecorImagesState({
    frameLoad: frameLoadStatus,
    isFrameColorApplied: isFrameColorApplied(processedFrame, frameImage, frameColor),
    stickers: stickers
      .filter((sticker) => !sticker.cutout)
      .map((sticker) => ({
        isLoaded: Boolean(loadedStickerImages.get(sticker.id)),
        isFailed: failedStickerSources.get(sticker.id) === sticker.src,
      })),
  });
  const decorImagesStateKey = decorImagesState.kind === "ready"
    ? `ready:${decorImagesState.failedStickerCount}`
    : decorImagesState.kind;
  useEffect(() => {
    onDecorImagesStateChange(decorImagesState, stageRef.current);
  }, [decorImagesStateKey]);

  useEffect(() => {
    stickers.forEach((sticker) => {
      const node = stickerImageRefs.current[sticker.id];
      if (!node) return;

      if (sticker.tintColor) {
        node.cache();
      } else {
        node.clearCache();
      }
      node.getLayer()?.batchDraw();
    });
  }, [loadedStickerImages, stickers]);

  useEffect(() => {
    stickers.forEach((sticker) => {
      const node = stickerImageRefs.current[sticker.id];
      if (!node) return;

      const tr = node.getStage()?.findOne(`#transformer-${sticker.id}`) as Konva.Transformer | null;
      if (!tr) return;

      if (selection === sticker.id) {
        tr.nodes([node]);
      } else if (tr.nodes().length > 0) {
        tr.nodes([]);
      }
      tr.getLayer()?.batchDraw();
    });
  }, [loadedStickerImages, selection, stickers]);

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();

    if (!onImageUpload) return;

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    const slotId = currentSlotIdRef.current;

    if (imageFile && slotId) {
      onImageUpload(imageFile, slotId);
    }

    setDraggedSlotId(null);
    currentSlotIdRef.current = null;
  }, [onImageUpload]);

  // 슬롯 클릭 핸들러 (선택 상태 변경 및 파일 선택)
  const handleSlotClick = (slotId: string) => {
    // 슬롯 선택 상태 업데이트
    onSelect?.(null);
    onSlotSelect?.(slotId);
    focusCanvasArea();

    setDraggedSlotId(slotId);
    currentSlotIdRef.current = slotId; // ref에도 저장

    if (onRequestImageImport?.(slotId)) {
      return;
    }

    // 모바일/Safari에서도 사용자 제스처 내에서 동작하도록 즉시 트리거
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    const slotId = currentSlotIdRef.current; // ref에서 가져오기

    if (file && slotId && onImageUpload) {
      onImageUpload(file, slotId);
    }

    setDraggedSlotId(null);
    currentSlotIdRef.current = null; // ref 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 이미지 변형 핸들러
  const handleImageTransform = (
    imageId: string,
    newAttrs: { x?: number; y?: number; scaleX?: number; scaleY?: number; rotation?: number }
  ) => {
    if (!onImageTransform) return;
    const payload: Partial<UserImage> = {};
    if (typeof newAttrs.x === 'number' && Number.isFinite(newAttrs.x)) payload.x = newAttrs.x;
    if (typeof newAttrs.y === 'number' && Number.isFinite(newAttrs.y)) payload.y = newAttrs.y;
    if (typeof newAttrs.scaleX === 'number' && Number.isFinite(newAttrs.scaleX)) payload.scaleX = newAttrs.scaleX;
    if (typeof newAttrs.scaleY === 'number' && Number.isFinite(newAttrs.scaleY)) payload.scaleY = newAttrs.scaleY;
    if (typeof newAttrs.rotation === 'number' && Number.isFinite(newAttrs.rotation)) payload.rotation = newAttrs.rotation;
    // 변경이 없으면 호출 생략
    if (Object.keys(payload).length === 0) return;
    onImageTransform(imageId, payload);
  };

  const handleCanvasKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (exportMode || showCustomPalette || !frameLayout) return;

    const target = e.target as HTMLElement | null;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target?.isContentEditable
    ) {
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      if (getCanvasEscapeAction(photoEdit.toolMode) === "end-erase-mode") {
        photoEdit.onToolModeChange("none");
        return;
      }
      onSelect?.(null);
      onSlotSelect?.(null);
      return;
    }

    if (e.key === "Tab") {
      const slotOrder = frameLayout.slots.map((slot) => slot.id);
      const direction = e.shiftKey ? -1 : 1;
      // 마지막 사진(뒤로는 첫 사진)이면 preventDefault 없이 넘겨서 브라우저가 다음 요소로 포커스를 옮기게 합니다.
      if (isTabLeavingImages({ selection, selectedSlot, slotOrder, userImages, direction })) return;
      const nextSelection = getNextImageSelection({ selection, selectedSlot, slotOrder, userImages, direction });

      if (nextSelection) {
        e.preventDefault();
        selectImage(nextSelection.imageId, nextSelection.slotId);
      }
      return;
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      if (selectedText) {
        onTextDelete?.(selectedText.id);
        return;
      }
      if (selectedSticker) {
        onStickerDelete?.(selectedSticker.id);
        return;
      }
      if (!selectedImage) return;
      onImageDelete?.(selectedImage.id);
      return;
    }

    if (!selectedImage) return;

    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      handleImageTransform(selectedImage.id, getScaledTransform({
        image: selectedImage,
        scaleFactor: KEYBOARD_SCALE_FACTOR,
      }));
      return;
    }

    if (e.key === "-") {
      e.preventDefault();
      handleImageTransform(selectedImage.id, getScaledTransform({
        image: selectedImage,
        scaleFactor: 1 / KEYBOARD_SCALE_FACTOR,
      }));
      return;
    }

    if (e.key.toLowerCase() === "r") {
      e.preventDefault();
      const context = getImageDisplayContext(selectedImage);
      if (!context) return;
      handleImageTransform(selectedImage.id, getCenterRotatedTransform({
        image: selectedImage,
        displaySize: context.displaySize,
        deltaDegrees: e.shiftKey ? -KEYBOARD_ROTATE_STEP : KEYBOARD_ROTATE_STEP,
      }));
      return;
    }

    const movementByKey: Record<string, { x: number; y: number }> = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
    };

    const movement = movementByKey[e.key];
    if (!movement) return;

    e.preventDefault();
    const step = e.shiftKey ? KEYBOARD_MOVE_FAST_STEP : KEYBOARD_MOVE_STEP;
    const delta = {
      x: movement.x * step,
      y: movement.y * step,
    };

    if (selectedSticker) {
      onStickerUpdate?.(selectedSticker.id, getNudgedPosition({
        x: selectedSticker.x,
        y: selectedSticker.y,
        delta,
      }));
      return;
    }

    const context = getImageDisplayContext(selectedImage);
    if (!context) return;

    handleImageTransform(selectedImage.id, getClampedKeyboardMove({
      image: selectedImage,
      slot: context.slot,
      displaySize: context.displaySize,
      delta,
    }));
  }, [
    exportMode,
    frameLayout,
    getImageDisplayContext,
    handleImageTransform,
    onImageDelete,
    onSelect,
    onSlotSelect,
    onTextDelete,
    onStickerDelete,
    onStickerUpdate,
    photoEdit.onToolModeChange,
    photoEdit.toolMode,
    selectImage,
    selectedImage,
    selectedText,
    selectedSticker,
    selectedSlot,
    selection,
    showCustomPalette,
    userImages,
  ]);

  // 이미지 휠 줌 핸들러 (해당 슬롯/이미지에만 적용)
  const handleImageWheel = (
    e: Konva.KonvaEventObject<WheelEvent>,
    imageId: string,
    slot?: { x: number; y: number; width: number; height: number },
    displayWidth?: number,
    displayHeight?: number
  ) => {
    // 상위로 버블링되거나 페이지 스크롤 되지 않도록 차단
    e.evt.preventDefault();
    // Konva 이벤트 버블 차단
    (e as { cancelBubble?: boolean }).cancelBubble = true;

    const userImage = userImages.find(img => img.id === imageId);
    if (!userImage) return;

    // 휠 시 선택 동기화 (원본 PySide 동작 참고)
    onSelect?.(userImage.id);
    onSlotSelect?.(userImage.slotId);

    const scaleBy = 1.1;
    // 실제 노드 스케일을 우선 사용(상태-뷰 불일치 방지)
    let oldScale = Number.isFinite(userImage.scaleX) ? userImage.scaleX : 1;
    const deltaY = e.evt.deltaY;

    // deltaY NaN 체크
    if (isNaN(deltaY)) return;

    const newScale = deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

    // 스케일 제한 상한 제거 (하한만 유지하여 0 이하 방지)
    const clampedScale = Math.max(0.1, newScale);

    // 최종 NaN 체크
    if (isNaN(clampedScale)) return;

    // 스케일 적용 + 포인터 기준 위치 보정
    const nextTransform: Partial<UserImage> = { scaleX: clampedScale, scaleY: clampedScale };

    if (slot && displayWidth && displayHeight) {
      const targetNode = e.target as unknown as Konva.Node;
      // 실제 이미지 노드 찾기(배경 Rect에서 휠이 들어온 경우 대비)
      let imgNode: Konva.Image | null = null;
      if ((targetNode as Konva.Node & { className?: string }).className === 'Image') {
        imgNode = targetNode as unknown as Konva.Image;
      } else {
        const parent = (targetNode as Konva.Node & { getParent?: () => Konva.Container })?.getParent?.();
        const found = parent?.findOne('Image') as Konva.Image | undefined;
        if (found) imgNode = found;
      }
      if (!imgNode) return;

      const stage = imgNode.getStage();
      // 아래 포인터 → 캔버스 변환은 Stage 배율만 나누고 Stage 위치(stage.x/y)는 보지 않습니다.
      // Stage가 옮겨지는 사진 지우기 모드에서는 휠을 Stage 감싸개에서 먼저 막으므로 이 경로에 닿지 않습니다.
      // 휠 이벤트에서 getPointerPosition이 누락되는 경우가 있어, 이벤트 좌표로 보정
      let px: number | undefined;
      let py: number | undefined;
      if (stage && e.evt && typeof e.evt.clientX === 'number' && typeof e.evt.clientY === 'number') {
        try {
          const rect = stage.container().getBoundingClientRect();
          const stageScaleX = stage.scaleX() || 1;
          const stageScaleY = stage.scaleY() || 1;
          px = (e.evt.clientX - rect.left) / stageScaleX;
          py = (e.evt.clientY - rect.top) / stageScaleY;
        } catch {
          const pointer = stage.getPointerPosition();
          if (pointer) {
            const stageScaleX = stage.scaleX() || 1;
            const stageScaleY = stage.scaleY() || 1;
            px = pointer.x / stageScaleX;
            py = pointer.y / stageScaleY;
          }
        }
      } else if (stage) {
        const pointer = stage.getPointerPosition();
        if (pointer) {
          const stageScaleX = stage.scaleX() || 1;
          const stageScaleY = stage.scaleY() || 1;
          px = pointer.x / stageScaleX;
          py = pointer.y / stageScaleY;
        }
      }

      // 최신 노드 스케일을 기준(oldScale 보정)
      const nodeScale = Number.isFinite(imgNode.scaleX()) ? imgNode.scaleX() : oldScale;
      if (Number.isFinite(nodeScale)) oldScale = nodeScale;

      // 현재 노드 위치(무조건 유효값으로 보정)
      const imgX = Number.isFinite(imgNode.x()) ? imgNode.x() : slot.x;
      const imgY = Number.isFinite(imgNode.y()) ? imgNode.y() : slot.y;

      // 로컬 좌표(anchor): 포인터가 없으면 이미지 중앙 기준으로 고정
      const localX = px !== undefined ? (px - imgX) / oldScale : (displayWidth / 2);
      const localY = py !== undefined ? (py - imgY) / oldScale : (displayHeight / 2);

      // 새 스케일에서 포인터(또는 중앙) 고정되도록 원점 이동
      let newImgX = (px !== undefined ? px : (imgX + localX * oldScale)) - localX * clampedScale;
      let newImgY = (py !== undefined ? py : (imgY + localY * oldScale)) - localY * clampedScale;

      // 슬롯 경계로 위치 클램프 - X축과 Y축 모두 자유롭게 이동 허용
      const scaledW = displayWidth * clampedScale;
      const scaledH = displayHeight * clampedScale;

      // X축: 이미지가 슬롯 밖으로도 자유롭게 이동 허용
      const minX = slot.x - scaledW;
      const maxX = slot.x + slot.width;

      // Y축: X축과 동일하게 이미지가 슬롯 밖으로도 자유롭게 이동 허용
      const minY = slot.y - scaledH;
      const maxY = slot.y + slot.height;
      newImgX = Math.max(minX, Math.min(maxX, newImgX));
      newImgY = Math.max(minY, Math.min(maxY, newImgY));

      // 상태 저장용 상대 좌표로 변환 (항상 x/y 포함시켜 재렌더 시 튐 방지)
      const relX = newImgX - slot.x - (slot.width - displayWidth) / 2;
      const relY = newImgY - slot.y - (slot.height - displayHeight) / 2;
      if (!isNaN(relX)) nextTransform.x = relX;
      if (!isNaN(relY)) nextTransform.y = relY;
    }

    // 내부 핸들러 통해 상태 업데이트(유효 필드만 반영)
    handleImageTransform(imageId, nextTransform);
  };

  // ===== 모바일 핀치 줌 지원 =====
  const pinchRef = useRef<{
    imageId: string | null;
    initDistance: number;
    initScale: number;
    slot?: { x: number; y: number; width: number; height: number };
    displayWidth?: number;
    displayHeight?: number;
  } | null>(null);

  const getTouchDistance = (evt: TouchEvent) => {
    if (evt.touches.length < 2) return 0;
    const [t1, t2] = [evt.touches[0], evt.touches[1]];
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleImageTouchStart = useCallback((
    e: Konva.KonvaEventObject<TouchEvent>,
    imageId: string,
    slot?: { x: number; y: number; width: number; height: number },
    displayWidth?: number,
    displayHeight?: number
  ) => {
    const userImage = userImages.find((img) => img.id === imageId);
    if (!userImage) return;

    const isSelectedImage = selection === imageId;
    if (!isSelectedImage && e.evt.touches.length < 2) {
      pinchRef.current = null;
      return;
    }

    if (!isSelectedImage) {
      selectImage(userImage.id, userImage.slotId);
    }

    if (e.evt.touches.length < 2) {
      pinchRef.current = null;
      return;
    }

    e.evt.preventDefault();
    pinchRef.current = {
      imageId,
      initDistance: getTouchDistance(e.evt),
      initScale: Number.isFinite(userImage.scaleX) ? userImage.scaleX : 1,
      slot,
      displayWidth,
      displayHeight,
    };
  }, [selectImage, selection, userImages]);

  const handleImageTouchMove = useCallback((
    e: Konva.KonvaEventObject<TouchEvent>,
    imageId: string
  ) => {
    const state = pinchRef.current;
    if (!state || state.imageId !== imageId) return;
    if (e.evt.touches.length < 2) return;
    e.evt.preventDefault();

    const newDist = getTouchDistance(e.evt);
    if (!newDist || !state.initDistance) return;
    const scaleBy = newDist / state.initDistance;
    let nextScale = state.initScale * scaleBy;
    const minScale = Math.max(0.2, 1e-3);
    const maxScale = 10;
    nextScale = Math.max(minScale, Math.min(maxScale, nextScale));

    const transform: Partial<UserImage> = { scaleX: nextScale, scaleY: nextScale };

    // 손가락 화면 좌표는 거리 비율에만 쓰고, Stage 위치(stage.x/y)를 반영한 캔버스 좌표로는 바꾸지 않습니다.
    // Stage가 옮겨지는 사진 지우기 모드에서는 두 손가락 터치를 Stage 감싸개에서 먼저 막으므로 이 경로에 닿지 않습니다.
    // 슬롯 경계 보정 (이미지 위치는 유지하되 범위를 벗어나지 않도록 클램프)
    if (state.slot && state.displayWidth && state.displayHeight) {
      const node = e.target as unknown as Konva.Node;
      const imgX = Number.isFinite(node.x()) ? node.x() : state.slot.x;
      const imgY = Number.isFinite(node.y()) ? node.y() : state.slot.y;
      const scaledW = state.displayWidth * nextScale;
      const scaledH = state.displayHeight * nextScale;
      const minX = state.slot.x - scaledW;
      const maxX = state.slot.x + state.slot.width;
      const minY = state.slot.y - scaledH;
      const maxY = state.slot.y + state.slot.height;
      const clampedX = Math.max(minX, Math.min(maxX, imgX));
      const clampedY = Math.max(minY, Math.min(maxY, imgY));
      const relX = clampedX - state.slot.x - (state.slot.width - state.displayWidth) / 2;
      const relY = clampedY - state.slot.y - (state.slot.height - state.displayHeight) / 2;
      if (!isNaN(relX)) transform.x = relX;
      if (!isNaN(relY)) transform.y = relY;
    }

    handleImageTransform(imageId, transform);
  }, [handleImageTransform]);

  const handleImageTouchEnd = (e: Konva.KonvaEventObject<TouchEvent>) => {
    if (e.evt.touches.length < 2) {
      pinchRef.current = null;
    }
  };

  useLayoutEffect(() => {
    if (!isEditLocked) return;
    const stage = stageRef.current;
    stage?.find<Konva.Transformer>("Transformer").forEach((transformer) => transformer.stopTransform()); // 손잡이 조작
    stage?.find((node: Konva.Node) => node.isDragging()).forEach((node) => node.stopDrag()); // 끌기
    pinchRef.current = null; // 두 손가락 확대
    cancelBrushStroke(); // 붓 획(Phase 3)
  }, [isEditLocked]);

  // 이미지 드래그 이동 제한 핸들러
  const handleImageDragMove = (e: Konva.KonvaEventObject<DragEvent>, imageId: string, slot: { x: number; y: number; width: number; height: number }, displayWidth: number, displayHeight: number) => {
    const userImage = userImages.find(img => img.id === imageId);
    if (!userImage) return;

    const node = e.target;
    const currentX = node.x();
    const currentY = node.y();

    // NaN 체크
    if (isNaN(currentX) || isNaN(currentY)) return;

    // 즉시 갱신된 Konva 노드의 실제 스케일을 우선 사용 (휠 줌 직후 상태 반영 지연에 의한 튐 방지)
    const nodeScaleX = Number.isFinite((node as Konva.Node).scaleX()) ? (node as Konva.Node).scaleX() : (Number.isFinite(userImage.scaleX) ? userImage.scaleX : 1);
    const nodeScaleY = Number.isFinite((node as Konva.Node).scaleY()) ? (node as Konva.Node).scaleY() : (Number.isFinite(userImage.scaleY) ? userImage.scaleY : 1);
    const scaledWidth = displayWidth * nodeScaleX;
    const scaledHeight = displayHeight * nodeScaleY;

    // NaN 체크
    if (isNaN(scaledWidth) || isNaN(scaledHeight)) return;

    // 슬롯 밖으로 자유롭게 이미지 이동 허용 (X축과 Y축 동일하게)

    // X축: 이미지가 슬롯 밖으로도 자유롭게 이동 가능
    const minX = slot.x - scaledWidth;
    const maxX = slot.x + slot.width;

    // Y축: X축과 동일하게 이미지가 슬롯 밖으로도 자유롭게 이동 가능
    const minY = slot.y - scaledHeight;
    const maxY = slot.y + slot.height;

    // NaN 체크
    if (isNaN(minX) || isNaN(maxX) || isNaN(minY) || isNaN(maxY)) return;

    // 경계 제한 적용
    const clampedX = Math.max(minX, Math.min(maxX, currentX));
    const clampedY = Math.max(minY, Math.min(maxY, currentY));

    // 최종 NaN 체크
    if (!isNaN(clampedX)) {
      node.x(clampedX);
    }
    if (!isNaN(clampedY)) {
      node.y(clampedY);
    }
  };

  // 외부 팔레트 설정 로드 (배포자가 편집 가능)
  // 주의: 훅 순서를 안정화하기 위해 조건부 반환보다 위에서 호출
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/config/frame_palette.json', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        const arr = Array.isArray(json) ? json : Array.isArray((json as Record<string, unknown>)?.frameColors) ? (json as Record<string, unknown>).frameColors : null;
        if (!arr) return;
        const hexRe = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
        const normalized = (arr as unknown[]).filter((c) => typeof c === 'string' && hexRe.test(c as string)) as string[];
        if (!cancelled && normalized.length > 0) {
          setPresetColors(normalized.slice(0, 24)); // 최대 24개까지 허용
        }
      } catch (error) {
        // 네트워크/파싱 오류 시 기본값 유지
        console.warn('Failed to load frame palette config:', error);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // 커스텀 원형 팔레트 렌더링 (showCustomPalette 의존)
  // 주의: 훅 순서를 안정화하기 위해 조건부 반환보다 위에서 호출
  useEffect(() => {
    if (!showCustomPalette) return;
    const canvas = paletteCanvasRef.current;
    if (!canvas) return;
    const size = 160;
    const radius = size / 2 - 2; // padding for border
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(size, size);
    const data = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - size / 2;
        const dy = y - size / 2;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const idx = (y * size + x) * 4;
        if (dist <= radius) {
          let angle = Math.atan2(dy, dx); // -PI..PI
          if (angle < 0) angle += Math.PI * 2; // 0..2PI
          const h = (angle * 180) / Math.PI; // 0..360
          const s = Math.min(1, dist / radius);
          const v = 1; // 최대 명도
          const { r, g, b } = hsvToRgb(h, s, v);
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        } else {
          data[idx + 3] = 0;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    // 외곽선
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, radius + 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [showCustomPalette]);

  // 팔레트 외부 클릭 시 닫기
  // 주의: 훅 순서를 안정화하기 위해 조건부 반환보다 위에서 호출
  useEffect(() => {
    if (!showCustomPalette) return;
    const onDown = (e: MouseEvent) => {
      const anchor = paletteAnchorRef.current;
      const btn = customPickButtonRef.current;
      if (!anchor || !btn) return;
      if (!anchor.contains(e.target as Node) && !btn.contains(e.target as Node)) {
        setShowCustomPalette(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowCustomPalette(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [showCustomPalette]);

  useEffect(() => {
    const stageContainer = stageRef.current?.container();
    if (!stageContainer) return;

    const touchAction = isTouchManipulationActive ? 'none' : 'pan-x pan-y';
    stageContainer.style.touchAction = touchAction;

    const canvases = stageContainer.querySelectorAll("canvas");
    canvases.forEach((canvas) => {
      canvas.style.touchAction = touchAction;
      canvas.style.userSelect = "none";
      canvas.style.webkitUserSelect = "none";
    });

    if (!isTouchManipulationActive) {
      setStageCursor("default");
    }
  }, [isTouchManipulationActive, setStageCursor]);

  // 컨테이너 크기 측정 (Stage 콘텐츠 크기와 독립적으로 동작)
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const measureContainer = () => {
      const measuredWidth = Math.round(node.clientWidth || node.getBoundingClientRect().width);
      const measuredHeight = Math.round(node.clientHeight || node.getBoundingClientRect().height);

      if (measuredWidth > 100 && measuredHeight > 100) {
        setContainerSize({ width: measuredWidth, height: measuredHeight });
      }
    };

    measureContainer();

    // ResizeObserver로 너비 변화 감지 (사이드바 크기 변경 등)
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => measureContainer());
      observer.observe(node);
      // 부모도 관찰하여 레이아웃 변화 감지
      const parent = node.parentElement;
      if (parent) observer.observe(parent);
      return () => observer.disconnect();
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', measureContainer);
      return () => window.removeEventListener('resize', measureContainer);
    }
  }, []);

  // 측정된 컨테이너 크기 기반으로 zoom 자동 조정
  useEffect(() => {
    if (!frameLayout || !onZoomChange) return;
    if (!containerSize.width || !containerSize.height) return;
    const isMobileViewport = typeof window !== "undefined" && window.innerWidth <= 768;

    const fittedZoom = getZoomToFit({
      containerWidth: containerSize.width,
      containerHeight: containerSize.height,
      canvasWidth: frameLayout.canvasWidth,
      canvasHeight: frameLayout.canvasHeight,
      fitMode: isMobileViewport ? "width" : "contain",
    });

    // 저장 중(exportMode)에는 Stage 배율을 바꾸지 않습니다. 컨테이너 크기는 계속 기억하므로 저장이 끝나면 이 효과가 최신 크기로 한 번 맞춥니다(UX5-1).
    const nextZoom = getAutoFitZoomChange({ isSaving: exportMode, currentZoom: zoom, fittedZoom });
    if (nextZoom !== null) {
      onZoomChange(nextZoom);
    }
  }, [frameLayout, containerSize, onZoomChange, zoom, exportMode]);

  // 휴대폰 세로 CSS의 html scroll-padding-top이 읽도록 캔버스 높이를 문서 루트에도 둡니다(설계 10장, E-2 4).
  // 세로 블록 밖에는 이 변수를 읽는 규칙이 없어 화면 크기를 따지지 않습니다.
  useEffect(() => {
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--mobile-canvas-height', `${containerSize.height}px`);
    return () => { rootStyle.removeProperty('--mobile-canvas-height'); };
  }, [containerSize.height]);

  // 칸 버튼 목록은 숨겨진 동안 패널 가운데에 절대 위치로 놓여, 포커스가 들어오면 브라우저가 그 옛 자리로 스크롤합니다.
  // 휴대폰 세로에서는 목록이 제자리에 펼쳐진 뒤 버튼이 위쪽 캔버스 뒤로 사라지므로, 펼쳐진 뒤 그 버튼을 화면 안으로 다시 옮깁니다(2.4.11).
  useLayoutEffect(() => {
    if (!isSlotListFocused) return;
    const focusedElement = document.activeElement;
    if (focusedElement instanceof HTMLElement) focusedElement.scrollIntoView({ block: 'nearest' });
  }, [isSlotListFocused]);

  // Stage wrapper에 고정 크기를 설정하여 Stage 콘텐츠가 컨테이너를 확장하지 않도록 함
  const stageWidth = frameLayout ? Math.ceil(frameLayout.canvasWidth * zoom) : 0;
  const stageHeight = frameLayout ? Math.ceil(frameLayout.canvasHeight * zoom) : 0;
  const eraseSlot = frameLayout && isPhotoEraseMode && selectedImage && !exportMode
    ? frameLayout.slots.find((slot) => slot.id === selectedImage.slotId) ?? null
    : null;
  const stageView = getEraseZoomView({ isErasing: eraseSlot !== null, stageWidth, stageHeight, zoom, slot: eraseSlot });

  // 저장이 끝나면 App이 이 값을 한 묶음으로 Stage에 되돌립니다. Stage에 props가 적용된 같은 커밋에서 적습니다(보정표 D-13).
  useLayoutEffect(() => {
    if (!stageDisplayRefExternal) return;
    stageDisplayRefExternal.current = frameLayout
      ? { size: { width: stageWidth, height: stageHeight }, scale: { x: stageView.scale, y: stageView.scale }, position: { x: stageView.x, y: stageView.y } }
      : null;
  }, [stageDisplayRefExternal, frameLayout, stageWidth, stageHeight, stageView.scale, stageView.x, stageView.y]);

  // 프레임이 선택되지 않았을 때 메시지 표시
  if (!selectedFrame || !frameLayout) {
    return (
      <div className="linear-card linear-fade-in" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        textAlign: 'center'
      }}>
        <div>
          <p style={{
            color: 'var(--linear-secondary-400)',
            fontSize: 'var(--linear-text-lg)',
            fontWeight: 'var(--linear-font-medium)'
          }}>
            먼저 프레임을 골라 주세요
          </p>
          {onOpenFrameGallery && (
            <button
              type="button"
              className="linear-button linear-button--primary"
              onClick={onOpenFrameGallery}
              style={{ marginTop: '16px', minHeight: '44px', fontSize: '16px' }}
            >
              프레임 고르기
            </button>
          )}
        </div>
      </div>
    );
  }

  // 지우기 모드에 들어가면 보일 사진의 화면 폭(px) = 사진 가로 구간과 칸이 겹치는 폭 × 확대 배율. 회전은 무시합니다(설계 9.5, SP-9).
  // 사진이 아직 없으면 NaN → 작게
  const getErasePhotoScreenWidth = (image: UserImage): number => {
    const displayContext = getImageDisplayContext(image);
    if (!displayContext) return Number.NaN;
    const { slot, displaySize } = displayContext;
    const enteredView = getEraseZoomView({ isErasing: true, stageWidth, stageHeight, zoom, slot });
    const photoOffsetX = Number.isFinite(image.x) ? image.x : 0;
    const photoScaleX = Number.isFinite(image.scaleX) ? image.scaleX : 1;
    const visiblePhotoWidth = getVisiblePhotoSpanWidth({
      photoLeft: slot.x + (slot.width - displaySize.width) / 2 + photoOffsetX,
      photoWidth: displaySize.width * photoScaleX,
      slotLeft: slot.x,
      slotWidth: slot.width,
    });
    return visiblePhotoWidth * enteredView.scale;
  };
  const stageWrapperStyle: React.CSSProperties = {
    border: 'var(--border-width) dashed var(--linear-neutral-500)',
    borderRadius: '0px',
    boxSizing: 'content-box',
    overflow: 'hidden',
    position: 'relative',
    width: `${stageWidth}px`,
    height: `${stageHeight}px`,
    maxWidth: '100%',
    flexShrink: 0,
  };

  // HSV -> RGB 변환
  const hsvToRgb = (h: number, s: number, v: number) => {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r1 = 0, g1 = 0, b1 = 0;
    if (0 <= h && h < 60) { r1 = c; g1 = x; b1 = 0; }
    else if (60 <= h && h < 120) { r1 = x; g1 = c; b1 = 0; }
    else if (120 <= h && h < 180) { r1 = 0; g1 = c; b1 = x; }
    else if (180 <= h && h < 240) { r1 = 0; g1 = x; b1 = c; }
    else if (240 <= h && h < 300) { r1 = x; g1 = 0; b1 = c; }
    else { r1 = c; g1 = 0; b1 = x; }
    const r = Math.round((r1 + m) * 255);
    const g = Math.round((g1 + m) * 255);
    const b = Math.round((b1 + m) * 255);
    return { r, g, b };
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  };

  const getColorFromPosition = (canvas: HTMLCanvasElement, x: number, y: number) => {
    const size = canvas.width;
    const radius = size / 2 - 2;
    const dx = x - size / 2;
    const dy = y - size / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > radius) return null;
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += Math.PI * 2;
    const h = (angle * 180) / Math.PI;
    const s = Math.min(1, dist / radius);
    const v = 1;
    const { r, g, b } = hsvToRgb(h, s, v);
    return rgbToHex(r, g, b);
  };

  const handlePalettePick = (evt: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = paletteCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    const hex = getColorFromPosition(canvas, x, y);
    if (!hex) return;
    onFrameColorChange?.(hex);
    setShowCustomPalette(false);
  };

  const handlePaletteMove = (evt: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = paletteCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    const hex = getColorFromPosition(canvas, x, y);
    if (!hex) {
      setPalettePreview((p) => ({ ...p, visible: false }));
      return;
    }
    // 미리보기는 커서 바로 위에 약간 오프셋
    const offsetX = 14;
    const offsetY = -18;
    setPalettePreview({ visible: true, x: x + offsetX, y: y + offsetY, color: hex });
  };

  const handlePaletteLeave = () => {
    setPalettePreview((p) => ({ ...p, visible: false }));
  };

  const rotateSelectedImageBy = (deltaDegrees: number) => {
    if (!selectedImage) return;
    const context = getImageDisplayContext(selectedImage);
    if (!context) return;
    handleImageTransform(selectedImage.id, getCenterRotatedTransform({
      image: selectedImage,
      displaySize: context.displaySize,
      deltaDegrees,
    }));
  };

  const moveSelectedImageBy = (delta: { x: number; y: number }) => {
    if (!selectedImage) return;
    const context = getImageDisplayContext(selectedImage);
    if (!context) return;
    handleImageTransform(selectedImage.id, getClampedKeyboardMove({
      image: selectedImage,
      slot: context.slot,
      displaySize: context.displaySize,
      delta,
    }));
  };

  const moveSelectedStickerBy = (delta: { x: number; y: number }) => {
    if (!selectedSticker) return;
    onStickerUpdate?.(selectedSticker.id, getNudgedPosition({ x: selectedSticker.x, y: selectedSticker.y, delta }));
  };

  // 스티커는 왼쪽 위 기준으로 그려지므로 가운데를 지키는 계산을 씁니다(설계 7.1).
  const scaleSelectedStickerBy = (scaleFactor: number) => {
    if (!selectedSticker) return;
    onStickerUpdate?.(selectedSticker.id, getCenterScaledTransform({
      item: selectedSticker,
      size: { width: selectedSticker.width, height: selectedSticker.height },
      scaleFactor,
    }));
  };

  const rotateSelectedStickerBy = (deltaDegrees: number) => {
    if (!selectedSticker) return;
    onStickerUpdate?.(selectedSticker.id, getCenterRotatedTransform({
      image: selectedSticker,
      displaySize: { width: selectedSticker.width, height: selectedSticker.height },
      deltaDegrees,
    }));
  };

  return (
    <div
      className="linear-card linear-fade-in"
      style={{
        height: '100%',
        // sticky 자식이 문서 스크롤을 기준으로 붙도록 스크롤 컨테이너를 만들지 않는다.
        // clip을 지원하지 않는 브라우저는 기본값 hidden을 쓴다.
        overflow: 'var(--mobile-editor-card-overflow, hidden)',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        ['--mobile-canvas-height' as string]: `${containerSize.height}px`,
      } as React.CSSProperties}
    >
      <div
        className="canvas-stage-layout"
        style={isNarrowLandscapeLayout ? { flexDirection: 'row', alignItems: 'stretch' } : undefined}
      >
        <div
          ref={containerRef}
          className="canvas-stage-area"
        >
          <div
            ref={stageWrapperRef}
            style={stageWrapperStyle}
            tabIndex={0}
            role="application"
            data-focus-return="canvas"
            aria-label="캔버스 편집 영역"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onKeyDown={handleCanvasKeyDown}
          >
            <Stage
              ref={(node) => {
                stageRef.current = node;
                if (stageRefExternal) {
                  // 외부에서도 동일 참조를 사용할 수 있게 전달
                  (stageRefExternal as React.MutableRefObject<Konva.Stage | null>).current = node;
                }
              }}
              width={stageWidth}
              height={stageHeight}
              scaleX={stageView.scale}
              scaleY={stageView.scale}
              x={stageView.x}
              y={stageView.y}
              onMouseDown={handleStagePointerDown}
              onTouchStart={handleStagePointerDown}
              onPointerMove={moveBrushStroke}
              onClick={(e) => {
                if (e.target === e.target.getStage()) {
                  focusCanvasArea();
                  clearCanvasSelection();
                }
              }}
            >
              {/* 프레임 이미지 레이어 (사용자 이미지 아래에 배치) */}
              <Layer>
                {/* 배경: 프레임 이미지가 있으면 먼저 그려서 보이도록 함 */}
                {frameImage ? (
                  <KonvaImage
                    image={processedFrameCanvas ?? frameImage}
                    x={0}
                    y={0}
                    width={frameLayout.canvasWidth}
                    height={frameLayout.canvasHeight}
                    listening={false}
                  />
                ) : (
                  <Rect
                    x={0}
                    y={0}
                    width={frameLayout.canvasWidth}
                    height={frameLayout.canvasHeight}
                    fill="white"
                  />
                )}
              </Layer>

              {/* 사용자 이미지 레이어 (프레임 이미지 위에 배치) */}
              <Layer>
                {frameLayout.slots.map((slot) => {
                  const userImage = userImages.find(img => img.slotId === slot.id);
                  const loadedEntry = userImage ? loadedImages.get(userImage.id) : undefined;
                  const loadedImg = userImage && loadedEntry?.url === userImage.url ? loadedEntry.image : null;

                  if (userImage && loadedImg && loadedImg !== null) {
                    const isSelectedImage = selection === userImage.id;
                    const { width: displayWidth, height: displayHeight } = getContainedImageSize(
                      loadedImg.width,
                      loadedImg.height,
                      slot.width,
                      slot.height,
                    );

                    // NaN 방어: 사용자 변형 값 보정
                    const uX = Number.isFinite(userImage.x) ? userImage.x : 0;
                    const uY = Number.isFinite(userImage.y) ? userImage.y : 0;
                    const uScaleX = Number.isFinite(userImage.scaleX) ? userImage.scaleX : 1;
                    const uScaleY = Number.isFinite(userImage.scaleY) ? userImage.scaleY : 1;
                    const uRotation = Number.isFinite(userImage.rotation) ? userImage.rotation : 0;

                    // 중앙 정렬을 위한 오프셋 계산 (top-left 좌표)
                    const centerX = slot.x + (slot.width - displayWidth) / 2 + uX;
                    const centerY = slot.y + (slot.height - displayHeight) / 2 + uY;

                    return (
                      <Group
                        key={slot.id}
                        clipFunc={(ctx) => {
                          // 슬롯 영역으로 클리핑
                          ctx.rect(slot.x, slot.y, slot.width, slot.height);
                        }}
                      >
                        {/* 슬롯 내부 빈 영역의 휠/클릭 처리를 위한 백그라운드 캡처 (이미지 아래 배치) */}
                        <Rect
                          x={slot.x}
                          y={slot.y}
                          width={slot.width}
                          height={slot.height}
                          fill={'transparent'}
                          listening={true}
                          onWheel={(e) => handleImageWheel(e as unknown as Konva.KonvaEventObject<WheelEvent>, userImage.id, slot, displayWidth, displayHeight)}
                          onClick={() => {
                            selectImage(userImage.id, slot.id);
                          }}
                          onTap={() => {
                            // 모바일 탭에서도 동일 동작
                            selectImage(userImage.id, slot.id);
                          }}
                          onTouchStart={(e) => handleImageTouchStart(e as unknown as Konva.KonvaEventObject<TouchEvent>, userImage.id, slot, displayWidth, displayHeight)}
                          onTouchMove={(e) => handleImageTouchMove(e as unknown as Konva.KonvaEventObject<TouchEvent>, userImage.id)}
                          onTouchEnd={(e) => handleImageTouchEnd(e as unknown as Konva.KonvaEventObject<TouchEvent>)}
                        />
                        <KonvaImage
                          key={userImage.id}
                          image={photoEdit.compareHeld || isDefaultPhotoEdits(userImage.edits)
                            ? loadedImg
                            : (editedPhotoDisplays.get(userImage.id)?.canvas ?? loadedImg)}
                          x={centerX}
                          y={centerY}
                          width={displayWidth}
                          height={displayHeight}
                          scaleX={uScaleX}
                          scaleY={uScaleY}
                          rotation={uRotation}
                          draggable={!exportMode && isSelectedImage && photoEdit.toolMode === "none"}
                          _useStrictMode={isEditLocked}
                          onClick={() => {
                            selectImage(userImage.id, slot.id);
                          }}
                          onTap={() => {
                            selectImage(userImage.id, slot.id);
                          }}
                          onMouseEnter={() => {
                            setStageCursor(isSelectedImage ? "grab" : "pointer");
                          }}
                          onMouseLeave={() => {
                            setStageCursor("default");
                          }}
                          onDragStart={() => {
                            selectImage(userImage.id, slot.id);
                            setStageCursor("grabbing");
                          }}
                          onWheel={(e) => handleImageWheel(e, userImage.id, slot, displayWidth, displayHeight)}
                          onTouchStart={(e) => handleImageTouchStart(e as unknown as Konva.KonvaEventObject<TouchEvent>, userImage.id, slot, displayWidth, displayHeight)}
                          onTouchMove={(e) => handleImageTouchMove(e as unknown as Konva.KonvaEventObject<TouchEvent>, userImage.id)}
                          onTouchEnd={(e) => handleImageTouchEnd(e as unknown as Konva.KonvaEventObject<TouchEvent>)}
                          onDragMove={(e) => handleImageDragMove(e, userImage.id, slot, displayWidth, displayHeight)}
                          onDragEnd={(e) => {
                            setStageCursor("grab");
                            // 드래그 종료 시 최종 위치 계산 및 상태 업데이트
                            const finalX = e.target.x();
                            const finalY = e.target.y();

                            // NaN 체크
                            if (isNaN(finalX) || isNaN(finalY)) return;

                            const newX = finalX - slot.x - (slot.width - displayWidth) / 2;
                            const newY = finalY - slot.y - (slot.height - displayHeight) / 2;

                            // 최종 NaN 체크
                            if (!isNaN(newX) && !isNaN(newY)) {
                              handleImageTransform(userImage.id, { x: newX, y: newY });
                            }
                          }}
                          onTransformEnd={(e) => {
                            const node = e.target;
                            handleImageTransform(userImage.id, {
                              scaleX: node.scaleX(),
                              scaleY: node.scaleY(),
                              rotation: node.rotation()
                            });
                          }}
                        />
                        {userImage.id === selectedImageId && photoEdit.toolMode === "erase-photo" && (
                          <Rect
                            x={centerX}
                            y={centerY}
                            width={displayWidth}
                            height={displayHeight}
                            scaleX={uScaleX}
                            scaleY={uScaleY}
                            rotation={uRotation}
                            fill="transparent"
                            onPointerDown={(event) => startBrushStroke(event, userImage.id)}
                            onPointerMove={moveBrushCursor}
                            onMouseEnter={() => setStageCursor("crosshair")}
                            onMouseLeave={() => {
                              setStageCursor("default");
                              hideBrushCursor();
                            }}
                          />
                        )}
                      </Group>
                    );
                  }

                  return null;
                })}
              </Layer>

              {/* 가이드라인 레이어 (프레임 위에 표시) */}
              {!exportMode && (
                <Layer>
                  {/* 프레임 전체 중앙선 */}
                  {(() => {
                    const isHorizontal = Boolean(selectedFrame && /v$/.test(selectedFrame));
                    const centerX = frameLayout.canvasWidth / 2;
                    const centerY = frameLayout.canvasHeight / 2;

                    if (isHorizontal) {
                      // 가로 프레임: 가로 중앙에 세로선 그리기
                      return (
                        <Line
                          points={[centerX, 0, centerX, frameLayout.canvasHeight]}
                          stroke="rgba(128, 128, 128, 0.5)"
                          strokeWidth={1}
                          listening={false}
                        />
                      );
                    } else {
                      // 세로 프레임: 세로 중앙에 가로선 그리기
                      return (
                        <Line
                          points={[0, centerY, frameLayout.canvasWidth, centerY]}
                          stroke="rgba(128, 128, 128, 0.5)"
                          strokeWidth={1}
                          listening={false}
                        />
                      );
                    }
                  })()}

                  {/* 각 슬롯별 빨간색 십자선 */}
                  {frameLayout.slots.map((slot) => (
                    <Group key={`guide-${slot.id}`}>
                      {/* 가로선 - 슬롯의 세로 중앙을 가로지름 */}
                      <Line
                        points={[slot.x, slot.y + slot.height / 2, slot.x + slot.width, slot.y + slot.height / 2]}
                        stroke="red"
                        strokeWidth={0.5}
                        dash={[10, 20]}
                        listening={false}
                      />
                      {/* 세로선 - 슬롯의 가로 중앙을 가로지름 */}
                      <Line
                        points={[slot.x + slot.width / 2, slot.y, slot.x + slot.width / 2, slot.y + slot.height]}
                        stroke="red"
                        strokeWidth={0.5}
                        dash={[10, 20]}
                        listening={false}
                      />
                    </Group>
                  ))}
                </Layer>
              )}

              {/* 슬롯 인터랙션 레이어 */}
              <Layer>
                {frameLayout.slots.map((slot) => {
                  const userImage = userImages.find(img => img.slotId === slot.id);
                  const loadedEntry = userImage ? loadedImages.get(userImage.id) : undefined;
                  const hasImage = Boolean(userImage && loadedEntry && loadedEntry.url === userImage.url && loadedEntry.image);
                  const isSelected = selectedSlot === slot.id;

                  return (
                    <Group key={slot.id}>
                      {/* 슬롯 배경 (드롭 존) - 이미지가 있을 때는 투명하게 */}
                      <Rect
                        x={slot.x}
                        y={slot.y}
                        width={slot.width}
                        height={slot.height}
                        fill={exportMode ? 'transparent' : (hasImage ? 'transparent' : (draggedSlotId === slot.id ? 'rgba(0, 123, 255, 0.2)' : 'rgba(200, 200, 200, 0.3)'))}
                        stroke={exportMode ? 'transparent' : (hasImage ? 'transparent' : (isSelected ? 'transparent' : (draggedSlotId === slot.id ? '#007bff' : '#ccc')))}
                        strokeWidth={exportMode ? 0 : (isSelected ? 0 : 2)}
                        listening={!hasImage} // 이미지가 있을 때는 클릭 이벤트 비활성화
                        onMouseEnter={() => {
                          if (!hasImage) {
                            setDraggedSlotId(slot.id);
                            currentSlotIdRef.current = slot.id;
                          }
                        }}
                        onMouseLeave={() => {
                          if (!hasImage) {
                            setDraggedSlotId(null);
                          }
                        }}
                        onClick={() => {
                          if (!hasImage) {
                            handleSlotClick(slot.id);
                          }
                        }}
                        onTap={() => {
                          if (!hasImage) {
                            // 모바일 탭 시 파일 선택 실행
                            handleSlotClick(slot.id);
                          }
                        }}
                        onTouchStart={() => {
                          if (!hasImage) {
                            // 일부 브라우저(구형 iOS) 호환을 위한 폴백
                            currentSlotIdRef.current = slot.id;
                          }
                        }}
                      />

                      {/* 슬롯 선택 표시 (캔버스 점선 바탕과 확연히 구분되도록 안쪽으로 들여서 3D Neo-Brutalism 테두리 그리기) */}
                      {!exportMode && isSelected && (
                        <Group listening={false}>
                          {/* 1. 그림자 (검은색 테두리) - 우측 하단으로 오프셋 */}
                          <Rect
                            x={slot.x + 8}
                            y={slot.y + 8}
                            width={slot.width - 16}
                            height={slot.height - 16}
                            fill="transparent"
                            stroke="black"
                            strokeWidth={4}
                          />
                          {/* 2. 메인 박스 (흰색 바탕의 주황색 테두리) */}
                          <Rect
                            x={slot.x + 6}
                            y={slot.y + 6}
                            width={slot.width - 16}
                            height={slot.height - 16}
                            fill="transparent"
                            stroke="white"
                            strokeWidth={4}
                          />
                          <Rect
                            x={slot.x + 6}
                            y={slot.y + 6}
                            width={slot.width - 16}
                            height={slot.height - 16}
                            fill="transparent"
                            stroke="#ff6b35"
                            strokeWidth={2}
                          />
                          {/* 3. 모서리 앵커 (Neo-Brutalism 스타일) */}
                          {[
                            { x: slot.x + 6, y: slot.y + 6 },
                            { x: slot.x + slot.width - 10, y: slot.y + 6 },
                            { x: slot.x + 6, y: slot.y + slot.height - 10 },
                            { x: slot.x + slot.width - 10, y: slot.y + slot.height - 10 },
                          ].map((pos, i) => (
                            <Group key={i}>
                              <Rect
                                x={pos.x - 4}
                                y={pos.y - 4}
                                width={12}
                                height={12}
                                fill="black"
                              />
                              <Rect
                                x={pos.x - 6}
                                y={pos.y - 6}
                                width={12}
                                height={12}
                                fill="white"
                                stroke="#ff6b35"
                                strokeWidth={2}
                              />
                            </Group>
                          ))}
                        </Group>
                      )}

                      {/* 슬롯 레이블 */}
                      {!hasImage && !exportMode && (() => {
                        const labelText = getSlotLabel({
                          hasUserImage: Boolean(userImage),
                          loadFailed: Boolean(userImage && loadedEntry?.url === userImage.url && loadedEntry.image === null),
                        });
                        const labelWidth = Math.min(180, slot.width - 16);
                        const labelX = slot.x + (slot.width - labelWidth) / 2;
                        const labelY = slot.y + slot.height / 2 - 15;

                        return (
                          <Group listening={false}>
                            <Rect
                              x={labelX}
                              y={labelY}
                              width={labelWidth}
                              height={30}
                              fill="rgba(0, 0, 0, 0.7)"
                              cornerRadius={10}
                            />
                            <Text
                              x={labelX}
                              y={labelY}
                              width={labelWidth}
                              height={30}
                              text={labelText}
                              fontSize={14}
                              fill="white"
                              align="center"
                              verticalAlign="middle"
                            />
                          </Group>
                        );
                      })()}
                    </Group>
                  )
                })}
              </Layer>

              {/* 스티커 레이어 (텍스트 레이어 직전에 표시) */}
              <Layer listening={photoEdit.toolMode !== "erase-photo"}>
                {stickers.map((sticker) => {
                  const isSelected = selection === sticker.id;
                  const stickerImage = loadedStickerImages.get(sticker.id) ?? null;
                  const effectiveScaleX = sticker.scaleX * (sticker.flipX ? -1 : 1);
                  const effectiveScaleY = sticker.scaleY * (sticker.flipY ? -1 : 1);

                  const tintFilter = sticker.tintColor
                    ? createStickerTintFilter(sticker.tintColor, getStickerTintMode(sticker.src))
                    : undefined;

                  return (
                    <Group key={sticker.id}>
                      {stickerImage && (
                        <KonvaImage
                          ref={(node) => {
                            stickerImageRefs.current[sticker.id] = node;
                          }}
                          image={stickerImage}
                          x={sticker.x}
                          y={sticker.y}
                          width={sticker.width}
                          height={sticker.height}
                          scaleX={effectiveScaleX}
                          scaleY={effectiveScaleY}
                          offsetX={sticker.flipX ? sticker.width : 0}
                          offsetY={sticker.flipY ? sticker.height : 0}
                          rotation={sticker.rotation}
                          draggable={!exportMode && isSelected && photoEdit.toolMode === "none"}
                          _useStrictMode={isEditLocked}
                          onClick={() => selectSticker(sticker.id)}
                          onTap={() => selectSticker(sticker.id)}
                          onDragStart={() => selectSticker(sticker.id)}
                          onDragMove={(e) => {
                            onStickerUpdate?.(sticker.id, {
                              x: e.target.x(),
                              y: e.target.y()
                            });
                          }}
                          filters={tintFilter ? [tintFilter] : undefined}
                          onDragEnd={(e) => {
                            onStickerUpdate?.(sticker.id, {
                              x: e.target.x(),
                              y: e.target.y()
                            });
                          }}
                          onTransformEnd={() => {
                            const node = stickerImageRefs.current[sticker.id];
                            if (!node) return;

                            const rawScaleX = node.scaleX();
                            const rawScaleY = node.scaleY();
                            const appliedScaleX = Math.abs(rawScaleX) || 1;
                            const appliedScaleY = Math.abs(rawScaleY) || 1;
                            onStickerUpdate?.(sticker.id, {
                              x: node.x(),
                              y: node.y(),
                              scaleX: appliedScaleX,
                              scaleY: appliedScaleY,
                              rotation: node.rotation()
                            });
                            node.scaleX(sticker.flipX ? -appliedScaleX : appliedScaleX);
                            node.scaleY(sticker.flipY ? -appliedScaleY : appliedScaleY);
                          }}
                        />
                      )}
                      {isSelected && sticker.cutout && (photoEdit.toolMode === "pick-point" || photoEdit.toolMode === "erase-cutout") && (
                        <Rect
                          x={sticker.x}
                          y={sticker.y}
                          width={sticker.width}
                          height={sticker.height}
                          scaleX={effectiveScaleX}
                          scaleY={effectiveScaleY}
                          offsetX={sticker.flipX ? sticker.width : 0}
                          offsetY={sticker.flipY ? sticker.height : 0}
                          rotation={sticker.rotation}
                          fill="transparent"
                          onPointerDown={(event) => {
                            if (photoEdit.toolMode === "pick-point") {
                              handleCutoutPick(event, sticker);
                            } else {
                              startBrushStroke(event, sticker.id);
                            }
                          }}
                        />
                      )}
                      {isSelected && !exportMode && photoEdit.toolMode === "none" && (
                        <Transformer
                          id={`transformer-${sticker.id}`}
                          flipEnabled={false}
                          borderStroke="black"
                          borderStrokeWidth={3}
                          anchorSize={24}
                          anchorStroke="black"
                          anchorStrokeWidth={3}
                          anchorFill="white"
                          anchorCornerRadius={0}
                          boundBoxFunc={(oldBox, newBox) => {
                            if (newBox.width < 10 || newBox.height < 10) {
                              return oldBox;
                            }
                            return newBox;
                          }}
                        />
                      )}
                    </Group>
                  );
                })}
              </Layer>

              {/* 텍스트 레이어 (최상위에 표시) */}
              <Layer listening={photoEdit.toolMode === "none"}>
                {texts.map((textItem) => {
                  const isSelected = selection === textItem.id;

                  const TextNode = () => {
                    const textRef = useRef<Konva.Text | null>(null);

                    useEffect(() => {
                      if (isSelected && textRef.current) {
                        const tr = textRef.current.getStage()?.findOne(`#transformer-text-${textItem.id}`);
                        if (tr) {
                          (tr as Konva.Transformer).nodes([textRef.current]);
                          tr.getLayer()?.batchDraw();
                        }
                      }
                    }, [isSelected]);

                    const dimensions = getTextDimensions(
                      textItem.text,
                      textItem.fontSize,
                      textItem.fontFamily,
                      textItem.isBold,
                      textItem.isItalic,
                      textItem.isVertical
                    );
                    const renderedTextWidth = textItem.isVertical ? dimensions.width : textItem.boxWidth;

                    return (
                      <Group key={textItem.id}>
                        <Text
                          ref={textRef}
                          x={textItem.x}
                          y={textItem.y}
                          width={renderedTextWidth}
                          offsetX={renderedTextWidth / 2}
                          offsetY={dimensions.height / 2}
                          text={formatVerticalText(textItem.text, textItem.isVertical)}
                          fontSize={textItem.fontSize}
                          fontFamily={textItem.fontFamily}
                          fill={textItem.fontColor}
                          fontStyle={`${textItem.isItalic ? 'italic ' : ''}${textItem.isBold ? 'bold' : ''}`.trim() || 'normal'}
                          align={textItem.textAlign}
                          rotation={textItem.rotation}
                          wrap="none"
                          lineHeight={textItem.isVertical ? 1.2 : 1}
                          draggable={true}
                          onClick={() => selectText(textItem.id)}
                          onTap={() => selectText(textItem.id)}
                          onDragEnd={(e) => {
                            const newX = e.target.x();
                            const newY = e.target.y();
                            onTextMove?.(textItem.id, newX, newY);
                          }}
                          onTransformEnd={() => {
                            const node = textRef.current;
                            if (!node) return;

                            const nextState = getNextTextTransformState({
                              boxWidth: renderedTextWidth,
                              fontSize: textItem.fontSize,
                            }, {
                              x: node.x(),
                              y: node.y(),
                              rotation: node.rotation(),
                              width: node.width(),
                              scaleX: node.scaleX(),
                              scaleY: node.scaleY(),
                            });

                            onTextUpdate?.(textItem.id, nextState);
                            node.scaleX(1);
                            node.scaleY(1);
                          }}
                        />
                        {isSelected && !exportMode && (
                          <Transformer
                            id={`transformer-text-${textItem.id}`}
                            borderStroke="black"
                            borderStrokeWidth={3}
                            anchorSize={24}
                            anchorStroke="black"
                            anchorStrokeWidth={3}
                            anchorFill="white"
                            anchorCornerRadius={0}
                            keepRatio={true}
                            flipEnabled={false}
                            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                            boundBoxFunc={(oldBox, newBox) => {
                              if (newBox.width < 10 || newBox.height < 10) {
                                return oldBox;
                              }
                              return newBox;
                            }}
                          />
                        )}
                      </Group>
                    );
                  };

                  return <TextNode key={textItem.id} />;
                })}
              </Layer>

              {(photoEdit.toolMode === "erase-photo" || photoEdit.toolMode === "erase-cutout") && (
                <Layer listening={false}>
                  <Line
                    ref={brushLineRef}
                    points={[]}
                    stroke={ERASE_PREVIEW_COLOR}
                    strokeWidth={(2 * brushScreenRadius) / stageView.scale}
                    lineCap="round"
                    lineJoin="round"
                  />
                  <Circle
                    ref={brushCursorRef}
                    visible={false}
                    radius={brushScreenRadius / stageView.scale}
                    stroke={BRUSH_CURSOR_STROKE_COLOR}
                    strokeWidth={1.5 / stageView.scale}
                    fill={BRUSH_CURSOR_FILL_COLOR}
                    listening={false}
                  />
                </Layer>
              )}
            </Stage>
          </div>
        </div>

        <div
          ref={controlPanelRef}
          className="canvas-control-panel"
          onKeyDown={handleControlPanelKeyDown}
          style={{
            // 휴대폰 세로에서는 제어판을 스크롤 기준점에서 뺍니다. 그러지 않으면 '자세히'를 펼칠 때 문서가 밀려
            // 누른 버튼이 붙박이 캔버스 뒤로 들어갑니다(ST1-2).
            overflowAnchor: isMobilePortraitLayout ? 'none' : undefined,
            minWidth: isPhotoEraseMode && erasePanelWidth !== null ? `${Math.min(erasePanelWidth, erasePanelAvailableWidth ?? erasePanelWidth)}px` : undefined,
            // 768px 이하 낮은 가로: 768px 이하용 CSS(전체 폭·가로 줄바꿈)를 되돌려 세로 목록으로 두고, 캔버스 몫을 남깁니다(Codex 필수 5).
            ...(isNarrowLandscapeLayout ? { width: 'auto', maxWidth: '50%', flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch', justifyContent: 'flex-start' } : {}),
          }}
        >
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            <button
              type="button"
              className="linear-button linear-button--secondary"
              onClick={historyControls.onUndo}
              disabled={!historyControls.canUndo}
              style={{ flex: 1, minHeight: '44px', minWidth: 'min-content', padding: HISTORY_BUTTON_PADDING, fontSize: '14px', border: 'var(--border-width) solid var(--linear-neutral-500)', opacity: historyControls.canUndo ? 1 : 0.5 }}
              title="마지막 변경을 되돌립니다 (Ctrl+Z)"
            >
              되돌리기
            </button>
            <button
              type="button"
              className="linear-button linear-button--secondary"
              onClick={historyControls.onRedo}
              disabled={!historyControls.canRedo}
              style={{ flex: 1, minHeight: '44px', minWidth: '44px', padding: HISTORY_BUTTON_PADDING, fontSize: '14px', border: 'var(--border-width) solid var(--linear-neutral-500)', opacity: historyControls.canRedo ? 1 : 0.5 }}
              title="되돌린 변경을 다시 합니다 (Ctrl+Shift+Z)"
            >
              다시 하기
            </button>
            {photoEditSections.showBox && (
              <button
                type="button"
                className="linear-button linear-button--secondary"
                disabled={!hasEditedPhotos}
                onPointerDown={() => photoEdit.onCompareHeldChange(true)}
                onPointerUp={() => photoEdit.onCompareHeldChange(false)}
                onPointerLeave={() => photoEdit.onCompareHeldChange(false)}
                onPointerCancel={() => photoEdit.onCompareHeldChange(false)}
                onKeyDown={(event) => {
                  if (!isActivationKey(event.key)) return;
                  event.preventDefault();
                  if (event.repeat) return;
                  photoEdit.onCompareHeldChange(true);
                }}
                onKeyUp={(event) => {
                  if (!isActivationKey(event.key)) return;
                  event.preventDefault();
                  photoEdit.onCompareHeldChange(false);
                }}
                onBlur={() => photoEdit.onCompareHeldChange(false)}
                aria-pressed={photoEdit.compareHeld}
                aria-label="누르는 동안 원래 사진"
                title="누르는 동안 원래 사진"
                onContextMenu={(event) => event.preventDefault()}
                style={{
                  flex: 1.4,
                  minHeight: '44px',
                  minWidth: '44px',
                  padding: HISTORY_BUTTON_PADDING,
                  fontSize: '14px',
                  border: 'var(--border-width) solid var(--linear-neutral-500)',
                  opacity: hasEditedPhotos ? 1 : 0.5,
                  touchAction: 'none',
                  userSelect: 'none'
                }}
              >
                원래 사진
              </button>
            )}
          </div>
          {/* 칸 버튼 목록: 키보드로 들어오면 보이고, 마우스 손님에게는 숨깁니다(설계 7.4) */}
          <div
            role="group"
            aria-labelledby="slot-list-title"
            style={isSlotListFocused ? SLOT_LIST_VISIBLE_STYLE : VISUALLY_HIDDEN_STYLE}
            onFocus={() => setIsSlotListFocused(true)}
            onBlur={(event) => {
              if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
              setIsSlotListFocused(false);
            }}
          >
            <p id="slot-list-title" style={{ margin: 0, fontSize: '14px', color: 'var(--linear-neutral-50)' }}>칸에 사진 넣기</p>
            {frameLayout.slots.map((slot, slotIndex) => (
              <button
                key={slot.id}
                type="button"
                className="linear-button linear-button--secondary"
                onClick={() => handleSlotClick(slot.id)}
                style={{ minHeight: '44px', fontSize: '14px' }}
              >
                {getSlotButtonLabel(slotIndex, userImages.some((image) => image.slotId === slot.id))}
              </button>
            ))}
          </div>
          {isPhotoEraseMode && (
            <div
              className="linear-status--warning"
              role="group"
              aria-labelledby="erase-mode-title"
              style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', width: 0, minWidth: '100%', boxSizing: 'border-box' }}
            >
              <h4 id="erase-mode-title" style={{ margin: 0, fontSize: '16px', color: 'var(--linear-neutral-50)' }}>바닥 얼룩 지우는 중</h4>
              {renderBrushControls("얼룩을 손가락(마우스)으로 칠하세요. 손을 떼면 지워져요.")}
            </div>
          )}

          {!isPhotoEraseMode && (
            <>
              {selectedImage && photoEditSections.showErase && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', boxSizing: 'border-box' }}>
                  <button
                    ref={eraseStartButtonRef}
                    type="button"
                    className="linear-button linear-button--primary"
                    aria-describedby={selectedImage.edits.erase.length === 0 ? 'erase-start-guide' : undefined}
                    onClick={(event) => {
                      eraseFocusTargetRef.current = getEraseModeFocusTarget({ change: "enter", isKeyboardFocused: event.detail === 0 });
                      setShowCustomPalette(false);
                      setErasePanelWidth(controlPanelRef.current?.getBoundingClientRect().width ?? null);
                      setPhotoEraseBrushSize(getDefaultBrushSize(getErasePhotoScreenWidth(selectedImage)));
                      photoEdit.onToolModeChange("erase-photo");
                    }}
                    style={{ width: '100%', minHeight: '52px', gap: '8px', fontSize: '16px', border: 'var(--border-width) solid var(--linear-neutral-500)' }}
                  >
                    <svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 3l7 7-9 9-7-7z" />
                      <path d="M9 8l7 7" />
                      <path d="M3 22h18" />
                    </svg>
                    바닥 얼룩 지우기
                  </button>
                  {selectedImage.edits.erase.length === 0 && (
                    <p id="erase-start-guide" style={{ margin: 0, fontSize: '14px', color: 'var(--linear-neutral-50)' }}>이 버튼을 누른 뒤 얼룩을 칠하면 지워져요.</p>
                  )}
                </div>
              )}

              {selectedImage && photoEditSections.showAdjust && (
                <div
                  role="group"
                  aria-labelledby="photo-color-title"
                  style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', boxSizing: 'border-box', borderTop: '1px solid var(--linear-neutral-500)', paddingTop: '12px' }}
                >
                  <h4 id="photo-color-title" style={{ margin: 0, fontSize: '16px', color: 'var(--linear-neutral-50)' }}>사진 색</h4>
                  {isDefaultPhotoEdits(selectedImage.edits) && (
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--linear-neutral-50)' }}>
                      버튼을 누르면 바로 바뀌어요. [되돌리기]로 돌아갈 수 있어요.
                    </p>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {PHOTO_PRESETS.map((preset) => {
                      const isPresetSelected = selectedImage.edits.presetId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          className="linear-button linear-button--secondary"
                          aria-pressed={isPresetSelected}
                          onClick={() => photoEdit.onEditsChange(selectedImage.id, applyPresetToEdits(selectedImage.edits, preset.id))}
                          style={{ ...PHOTO_PANEL_BUTTON_STYLE, minWidth: '44px', padding: '0 8px' }}
                        >
                          {isPresetSelected ? <span aria-hidden="true">✓ </span> : null}{preset.label}
                        </button>
                      );
                    })}
                  </div>

                  {userImages.length >= 2 && (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <button
                        type="button"
                        className="linear-button linear-button--secondary"
                        onClick={() => {
                          photoEdit.onApplyAdjustToAll(selectedImage.id);
                          setAppliedToAllCount(userImages.length);
                        }}
                        style={PHOTO_PANEL_BUTTON_STYLE}
                      >
                        모든 사진에 적용
                      </button>
                      <div role="status">
                        {appliedToAllCount !== null && (
                          <p
                            className="linear-status--success"
                            style={{ margin: '10px 0 0', fontSize: '14px' }}
                          >
                            사진 {appliedToAllCount}장에 적용했어요
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    className="linear-button linear-button--secondary"
                    onClick={() => setIsAdjustDetailOpen(!isAdjustDetailOpen)}
                    aria-expanded={isAdjustDetailOpen}
                    style={PHOTO_PANEL_BUTTON_STYLE}
                  >
                    {isAdjustDetailOpen ? '접기' : '자세히'}
                  </button>

                  {isAdjustDetailOpen && PHOTO_ADJUST_FIELDS.map((field) => {
                    const adjustValue = selectedImage.edits.adjust[field.key];
                    return (
                      <div key={field.key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <p style={{ fontSize: '14px', width: '64px', margin: 0, color: 'var(--linear-secondary-300)' }}>{field.label}</p>
                        <button
                          type="button"
                          className="linear-button linear-button--secondary"
                          aria-label={`${field.label} 줄이기`}
                          disabled={adjustValue <= field.min}
                          onClick={() => photoEdit.onEditsChange(selectedImage.id, stepAdjustField(selectedImage.edits, field.key, -1))}
                          style={{ minWidth: '44px', ...PHOTO_PANEL_BUTTON_STYLE }}
                        >
                          −
                        </button>
                        <span style={{ minWidth: '28px', textAlign: 'center', fontSize: '14px', color: 'var(--linear-neutral-50)' }}>{adjustValue}</span>
                        <button
                          type="button"
                          className="linear-button linear-button--secondary"
                          aria-label={`${field.label} 늘리기`}
                          disabled={adjustValue >= field.max}
                          onClick={() => photoEdit.onEditsChange(selectedImage.id, stepAdjustField(selectedImage.edits, field.key, 1))}
                          style={{ minWidth: '44px', ...PHOTO_PANEL_BUTTON_STYLE }}
                        >
                          +
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedImage && (
                <div
                  role="group"
                  aria-labelledby="photo-position-title"
                  style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', boxSizing: 'border-box', borderTop: '1px solid var(--linear-neutral-500)', paddingTop: '12px' }}
                >
                  <h4 id="photo-position-title" style={{ margin: 0, fontSize: '16px', color: 'var(--linear-neutral-50)' }}>사진 크기와 위치</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <label htmlFor="photo-scale-input" style={{ color: 'var(--linear-neutral-50)', fontSize: '14px' }}>크기</label>
                    <input
                      id="photo-scale-input"
                      type="number"
                      className="linear-input"
                      value={getScalePercent(selectedImage.scaleX)}
                      onChange={(e) => {
                        const nextScale = getScaleFromPercent(parseFloat(e.target.value));
                        if (nextScale === null) return;
                        handleImageTransform(selectedImage.id, { scaleX: nextScale, scaleY: nextScale });
                      }}
                      min="10"
                      step="10"
                      style={{ width: '80px', fontSize: '14px', minHeight: '44px' }}
                      title="사진 크기(%)"
                    />
                    <span style={{ color: 'var(--linear-secondary-400)', fontSize: '14px' }}>%</span>
                    <button
                      type="button"
                      className="linear-button linear-button--secondary"
                      onClick={() => rotateSelectedImageBy(-90)}
                      style={{ minHeight: '44px', fontSize: '14px', padding: '0 12px' }}
                    >
                      왼쪽으로 돌리기
                    </button>
                    <button
                      type="button"
                      className="linear-button linear-button--secondary"
                      onClick={() => rotateSelectedImageBy(90)}
                      style={{ minHeight: '44px', fontSize: '14px', padding: '0 12px' }}
                    >
                      오른쪽으로 돌리기
                    </button>
                  </div>
                  <button
                    type="button"
                    className="linear-button linear-button--secondary"
                    onClick={() => setIsPositionDetailOpen(!isPositionDetailOpen)}
                    aria-expanded={isPositionDetailOpen}
                    style={PHOTO_PANEL_BUTTON_STYLE}
                  >
                    {isPositionDetailOpen ? '접기' : '자세히'}
                  </button>
                  {isPositionDetailOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <p style={{ margin: 0, fontSize: '14px', color: 'var(--linear-secondary-300)' }}>사진 옮기기</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {MOVE_BUTTONS.map((moveButton) => (
                          <button
                            key={moveButton.label}
                            type="button"
                            className="linear-button linear-button--secondary"
                            onClick={() => moveSelectedImageBy(moveButton.delta)}
                            style={PHOTO_DETAIL_BUTTON_STYLE}
                          >
                            {moveButton.label}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        <button
                          type="button"
                          className="linear-button linear-button--secondary"
                          onClick={() => rotateSelectedImageBy(-KEYBOARD_ROTATE_STEP)}
                          style={PHOTO_DETAIL_BUTTON_STYLE}
                        >
                          왼쪽으로 기울이기
                        </button>
                        <button
                          type="button"
                          className="linear-button linear-button--secondary"
                          onClick={() => rotateSelectedImageBy(KEYBOARD_ROTATE_STEP)}
                          style={PHOTO_DETAIL_BUTTON_STYLE}
                        >
                          오른쪽으로 기울이기
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

          {selectedFrame !== "1l" && (
            <div>
              <div ref={paletteAnchorRef} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <button
                    type="button"
                    className="linear-button linear-button--secondary"
                    aria-expanded={isFrameColorOpen}
                    onClick={() => {
                      setIsFrameColorOpen((open) => !open);
                      setShowCustomPalette(false);
                    }}
                    style={{ minHeight: '44px', fontSize: '14px' }}
                  >
                    프레임 색 바꾸기
                  </button>
                  {isFrameColorOpen && (
                    <button
                      ref={customPickButtonRef}
                      type="button"
                      className="linear-button linear-button--secondary"
                      style={{ height: 32, padding: '0 8px', fontSize: 14 }}
                      onClick={() => setShowCustomPalette((v) => !v)}
                      aria-expanded={showCustomPalette}
                    >
                      직접 선택
                    </button>
                  )}
                </div>
                {showCustomPalette && (
                  <div
                    className="linear-card"
                    style={{
                      marginTop: 6,
                      padding: 8,
                      border: 'var(--border-width) solid var(--linear-neutral-500)',
                      borderRadius: '0',
                      background: 'var(--linear-neutral-600)',
                      boxShadow: 'var(--shadow-lg)'
                    }}
                    role="group"
                    aria-label="원형 색상 팔레트"
                  >
                    <div style={{ position: 'relative' }}>
                      <canvas
                        ref={paletteCanvasRef}
                        onClick={handlePalettePick}
                        onMouseMove={handlePaletteMove}
                        onMouseLeave={handlePaletteLeave}
                        style={{
                          display: 'block',
                          width: 160,
                          height: 160,
                          cursor: 'crosshair',
                          borderRadius: '50%',
                        }}
                      />
                      {palettePreview.visible && (
                        <div
                          style={{
                            position: 'absolute',
                            left: palettePreview.x - 16,
                            top: palettePreview.y - 16,
                            width: 32,
                            height: 32,
                            borderRadius: '0',
                            background: palettePreview.color,
                            border: 'var(--border-width) solid var(--linear-neutral-500)',
                            boxShadow: 'var(--shadow-sm)',
                            pointerEvents: 'none',
                          }}
                          aria-hidden
                          title={palettePreview.color}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* 쉬운 팔레트: 외부 설정 기반 스와치 */}
              {isFrameColorOpen && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {presetColors.map((color) => {
                    const isSelected = color.toLowerCase() === frameColor.toLowerCase();
                    return (
                      <button
                        key={color}
                        type="button"
                        aria-label={getSwatchName(color)}
                        aria-pressed={isSelected}
                        className="linear-button linear-button--secondary"
                        onClick={() => onFrameColorChange?.(color)}
                        style={{
                          width: 32,
                          height: 32,
                          minHeight: 32,
                          borderRadius: '0',
                          padding: 0,
                          backgroundColor: color,
                          border: 'var(--border-width) solid var(--linear-neutral-500)',
                          boxShadow: 'var(--shadow-sm)',
                          flexShrink: 0,
                          color: getReadableMarkColor(color),
                          fontSize: '18px',
                          fontWeight: 900,
                          lineHeight: 1,
                        }}
                        title={getSwatchName(color)}
                      >
                        {isSelected ? <span aria-hidden="true">✓</span> : null}
                      </button>
                    );
                  })}
                </div>
              )}
              {/* 기본 컬러 인풋 제거: 커스텀 원형 팔레트 사용 */}
            </div>
          )}

          {/* 사진 빼기 버튼 */}
          {selectedImage && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '8px' }}>
              <button
                type="button"
                className="linear-button linear-button--secondary"
                onClick={() => onImageDelete?.(selectedImage.id)}
                style={{
                  minHeight: '44px',
                  padding: '0 12px',
                  fontSize: '14px',
                  backgroundColor: 'var(--linear-accent-error)',
                  color: 'var(--linear-accent-white)',
                  border: 'var(--border-width) solid var(--linear-neutral-500)'
                }}
              >
                이 사진 빼기
              </button>
            </div>
          )}
            </>
          )}

          {/* 선택된 스티커 편집 도구 */}
          {selectedSticker && (
            <div style={{
              border: 'var(--border-width) solid var(--linear-neutral-500)',
              padding: '12px',
              background: 'var(--linear-neutral-700)',
              marginTop: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <h4 style={{ margin: '0', fontSize: '14px', color: 'var(--linear-neutral-50)' }}>{selectedSticker.cutout ? CUTOUT_COPY.sectionTitle : '스티커 편집'}</h4>

              {selectedSticker.cutout && (() => {
                const cutoutToolButtonStyle = { ...PHOTO_PANEL_BUTTON_STYLE, opacity: isCutoutCacheMissing ? 0.5 : 1 };
                const outline = selectedSticker.cutout.outline;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {isCutoutCacheMissing && (
                      <p style={{ margin: 0, fontSize: '14px', color: 'var(--linear-secondary-300)' }}>{CUTOUT_COPY.cacheMissing}</p>
                    )}
                    {selectedSticker.cutout.target.kind === "everyone" ? (
                      <button
                        type="button"
                        className="linear-button linear-button--secondary"
                        onClick={() => {
                          cutoutEdit.onPreloadPointModel();
                          photoEdit.onToolModeChange("pick-point");
                        }}
                        disabled={isCutoutCacheMissing}
                        style={cutoutToolButtonStyle}
                      >
                        {CUTOUT_COPY.pickOne}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="linear-button linear-button--secondary"
                        onClick={() => cutoutEdit.onRegenerate(selectedSticker.id, { target: { kind: "everyone" } })}
                        disabled={isCutoutCacheMissing}
                        style={cutoutToolButtonStyle}
                      >
                        {CUTOUT_COPY.everyone}
                      </button>
                    )}
                    {photoEdit.toolMode === "pick-point" && (
                      <>
                        <p style={{ margin: 0, fontSize: '14px', color: 'var(--linear-secondary-300)' }}>{CUTOUT_COPY.pickGuide}</p>
                        <button
                          type="button"
                          className="linear-button linear-button--secondary"
                          onClick={() => photoEdit.onToolModeChange("none")}
                          disabled={isCutoutCacheMissing}
                          style={cutoutToolButtonStyle}
                        >
                          {CUTOUT_COPY.cancel}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className={`linear-button ${outline ? 'linear-button--primary' : 'linear-button--secondary'}`}
                      onClick={() => cutoutEdit.onRegenerate(selectedSticker.id, { outline: !outline })}
                      aria-pressed={outline}
                      disabled={isCutoutCacheMissing}
                      style={cutoutToolButtonStyle}
                    >
                      {outline ? <span aria-hidden="true">✓ </span> : null}
                      {CUTOUT_COPY.outline}
                    </button>
                    {photoEdit.toolMode !== "erase-cutout" ? (
                      <button
                        type="button"
                        className="linear-button linear-button--secondary"
                        onClick={() => photoEdit.onToolModeChange("erase-cutout")}
                        disabled={isCutoutCacheMissing}
                        style={cutoutToolButtonStyle}
                      >
                        {CUTOUT_COPY.eraser}
                      </button>
                    ) : renderBrushControls(CUTOUT_COPY.eraserGuide)}
                    <button
                      type="button"
                      className="linear-button linear-button--secondary"
                      onClick={() => cutoutEdit.onRegenerate(selectedSticker.id, { target: { kind: "everyone" }, outline: true, eraseStrokes: [] })}
                      disabled={isCutoutCacheMissing}
                      style={cutoutToolButtonStyle}
                    >
                      {CUTOUT_COPY.restart}
                    </button>
                    {cutoutEdit.errorMessage && (
                      <p
                        className="linear-status--warning"
                        style={{ margin: 0, fontSize: '14px' }}
                      >
                        {cutoutEdit.errorMessage}
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* 반전 버튼 */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className={`linear-button ${selectedSticker.flipX ? 'linear-button--primary' : 'linear-button--secondary'}`}
                  onClick={() => onStickerUpdate?.(selectedSticker.id, { flipX: !selectedSticker.flipX })}
                  aria-pressed={Boolean(selectedSticker.flipX)}
                  style={{
                    flex: 1,
                    minHeight: stickerControlHeight,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    minWidth: 0,
                    padding: '0 6px',
                    fontSize: '14px',
                    border: 'var(--border-width) solid var(--linear-neutral-500)',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="7 2 3 6 7 10" />
                    <polyline points="17 2 21 6 17 10" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                  </svg>
                  {selectedSticker.flipX ? <span aria-hidden="true">✓ </span> : null}
                  좌우 뒤집기
                </button>
                <button
                  type="button"
                  className={`linear-button ${selectedSticker.flipY ? 'linear-button--primary' : 'linear-button--secondary'}`}
                  onClick={() => onStickerUpdate?.(selectedSticker.id, { flipY: !selectedSticker.flipY })}
                  aria-pressed={Boolean(selectedSticker.flipY)}
                  style={{
                    flex: 1,
                    minHeight: stickerControlHeight,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    minWidth: 0,
                    padding: '0 6px',
                    fontSize: '14px',
                    border: 'var(--border-width) solid var(--linear-neutral-500)',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2 7 6 3 10 7" />
                    <polyline points="2 17 6 21 10 17" />
                    <line x1="6" y1="3" x2="6" y2="21" />
                  </svg>
                  {selectedSticker.flipY ? <span aria-hidden="true">✓ </span> : null}
                  위아래 뒤집기
                </button>
              </div>

              {/* 색상 틴트 */}
              {!selectedSticker.cutout && (
                <div>
                  <p style={{ fontSize: '14px', color: 'var(--linear-secondary-300)', margin: '0 0 4px 0' }}>색 바꾸기</p>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      type="color"
                      className="linear-input"
                      value={selectedSticker.tintColor ?? '#000000'}
                      onChange={(e) => onStickerUpdate?.(selectedSticker.id, { tintColor: e.target.value })}
                      style={{
                        width: '32px',
                        height: '32px',
                        padding: '2px',
                        border: 'var(--border-width) solid var(--linear-neutral-500)',
                        cursor: 'pointer',
                      }}
                      title="스티커 색 고르기"
                      aria-label="스티커 색 고르기"
                    />
                  </div>
                </div>
              )}

              <button
                type="button"
                className="linear-button linear-button--secondary"
                aria-expanded={isStickerDetailOpen}
                onClick={() => setIsStickerDetailOpen((open) => !open)}
                style={stickerDetailButtonStyle}
              >
                {isStickerDetailOpen ? '접기' : '자세히'}
              </button>
              {isStickerDetailOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <p style={{ margin: 0, fontSize: '14px', color: 'var(--linear-secondary-300)' }}>스티커 옮기기</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {MOVE_BUTTONS.map((moveButton) => (
                      <button
                        key={moveButton.label}
                        type="button"
                        className="linear-button linear-button--secondary"
                        onClick={() => moveSelectedStickerBy(moveButton.delta)}
                        style={stickerDetailButtonStyle}
                      >
                        {moveButton.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    <button
                      type="button"
                      className="linear-button linear-button--secondary"
                      onClick={() => scaleSelectedStickerBy(1 / KEYBOARD_SCALE_FACTOR)}
                      style={stickerDetailButtonStyle}
                    >
                      작게 하기
                    </button>
                    <button
                      type="button"
                      className="linear-button linear-button--secondary"
                      onClick={() => scaleSelectedStickerBy(KEYBOARD_SCALE_FACTOR)}
                      style={stickerDetailButtonStyle}
                    >
                      크게 하기
                    </button>
                    <button
                      type="button"
                      className="linear-button linear-button--secondary"
                      onClick={() => rotateSelectedStickerBy(-STICKER_TILT_STEP)}
                      style={stickerDetailButtonStyle}
                    >
                      왼쪽으로 기울이기
                    </button>
                    <button
                      type="button"
                      className="linear-button linear-button--secondary"
                      onClick={() => rotateSelectedStickerBy(STICKER_TILT_STEP)}
                      style={stickerDetailButtonStyle}
                    >
                      오른쪽으로 기울이기
                    </button>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
                    스티커 각도(°)
                    <input
                      type="number"
                      className="linear-input"
                      step="1"
                      value={getAngleInputValue({ draft: stickerAngleDraft, targetId: selectedSticker.id, rotation: selectedSticker.rotation })}
                      onChange={(event) => {
                        const degrees = getAngleInputDegrees(event.currentTarget.valueAsNumber);
                        setStickerAngleDraft({ targetId: selectedSticker.id, text: degrees === null ? event.currentTarget.value : String(degrees) }); // 보이는 값 = 적용한 값(UP-6)
                        if (degrees === null) return;
                        rotateSelectedStickerBy(degrees - selectedSticker.rotation);
                      }}
                      onBlur={() => setStickerAngleDraft(null)}
                      style={{ width: '88px', minHeight: stickerControlHeight, fontSize: '14px' }}
                    />
                  </label>
                  <button
                    type="button"
                    className="linear-button linear-button--secondary"
                    onClick={() => onStickerUpdate?.(selectedSticker.id, getStickerEditResetUpdates())}
                    disabled={!canResetStickerEdit}
                    style={{
                      height: stickerControlHeight,
                      fontSize: '14px',
                      border: 'var(--border-width) solid var(--linear-neutral-500)',
                      opacity: canResetStickerEdit ? 1 : 0.5,
                    }}
                  >
                    처음대로
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
    </div>
  );
};
