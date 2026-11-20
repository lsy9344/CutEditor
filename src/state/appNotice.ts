import type { FrameType } from "../types/frame.ts";
import { CUTOUT_COPY } from "../photo/cutoutCopy.ts";

export type NoticeTone = "info" | "success" | "warning" | "error";
export type NoticeActionId = "close" | "keep-frame" | "change-frame" | "add-photos" | "save-anyway" | "retry-save";
export type NoticeAction = { id: NoticeActionId; label: string; isPrimary: boolean };
// 취소는 저장이 아니므로 장소에 없습니다(설계 D9).
export type SaveLocation =
  | "picked"
  | "downloads"
  | "downloads-after-picker-error"
  | "downloads-after-write-error"
  | "boothy";
export type AppNotice =
  // 빠질 사진 장수는 상태에 두지 않고 그릴 때마다 지금 사진 목록으로 셉니다(UX1-2).
  | { kind: "frame-change"; frameType: FrameType }
  | { kind: "empty-slots"; emptySlotCount: number }
  | { kind: "save-progress" }
  | { kind: "save-done"; location: SaveLocation; missingStickerCount: number }
  // isWaitingForPhotos: [다시 저장하기]를 눌렀을 때 사진이 아직 준비 중이었음(결정 F, 설계 4.5).
  | { kind: "save-failed"; hasPickedFile: boolean; isWaitingForPhotos: boolean };
export type InlineStatus =
  | { kind: "save-cancelled" }
  | { kind: "save-blocked"; message: string }
  | { kind: "import-failed" };
export type NoticeView = {
  title: string;
  lines: string[];
  tone: NoticeTone;
  actions: NoticeAction[];
  isBusy: boolean;
  closeActionId: NoticeActionId | null;
};
export type InlineStatusView = { tone: NoticeTone; lines: string[] };

// 완료 뒤 '다음에 할 일'은 매장 흐름을 사람이 확인한 뒤 채웁니다(설계 17.1 결정 4).
export const SAVE_DONE_NEXT_STEP: string | null = null;

const SAVE_LOCATION_LINES: Record<SaveLocation, string> = {
  picked: "고른 곳에 저장했어요.",
  downloads: "다운로드 폴더에 저장했어요.",
  "downloads-after-picker-error": "저장할 곳을 고르지 못해서 다운로드 폴더에 저장했어요.",
  "downloads-after-write-error": "대신 다운로드 폴더에 저장했어요.",
  boothy: "오늘 찍은 사진과 같은 곳에 저장했어요.",
};
// 고른 파일 열기·쓰기·닫기가 실패하면 창이 이미 비운 파일이 남을 수 있습니다. 지우지 않고 알리기만 합니다(설계 5.1, 확정 결정 N2).
const WRITE_ERROR_EMPTY_FILE_LINE = "고른 곳에는 빈 파일이 남았을 수 있어요.";

const FRAME_CHANGE_LAST_LINE = "바꾸고 나면 되돌리기로 지금 프레임에 돌아올 수 없어요.";
const CALL_STAFF_LINE = "계속 안 되면 직원을 불러 주세요.";
const PHOTO_WAITING_RETRY_LINE = "사진을 불러오는 중이에요. 잠시 뒤 다시 눌러 주세요.";

export const getNoticeView = (notice: AppNotice, droppedPhotoCount = 0): NoticeView => {
  switch (notice.kind) {
    case "frame-change": {
      const photoLines = droppedPhotoCount > 0
        ? [`새 프레임에 없는 칸의 사진 ${droppedPhotoCount}장은 빠져요.`, "나머지 사진과 글씨, 스티커는 그대로 있어요."]
        : ["사진과 글씨, 스티커는 그대로 있어요."];
      return {
        title: "프레임을 바꿀까요?",
        lines: [...photoLines, FRAME_CHANGE_LAST_LINE],
        tone: "warning",
        actions: [
          { id: "keep-frame", label: "그대로 두기", isPrimary: false },
          { id: "change-frame", label: "프레임 바꾸기", isPrimary: true },
        ],
        isBusy: false,
        closeActionId: "keep-frame",
      };
    }
    case "empty-slots":
      return {
        title: `빈 칸이 ${notice.emptySlotCount}개 있어요`,
        lines: ["빈 칸은 사진 없이 저장돼요."],
        tone: "warning",
        actions: [
          { id: "add-photos", label: "사진 더 넣기", isPrimary: false },
          { id: "save-anyway", label: "빈 칸 그대로 저장하기", isPrimary: true },
        ],
        isBusy: false,
        closeActionId: "add-photos",
      };
    case "save-progress":
      return { title: "저장 준비 중이에요", lines: ["잠시만 기다려 주세요."], tone: "info", actions: [], isBusy: true, closeActionId: null };
    case "save-done": {
      const isWriteError = notice.location === "downloads-after-write-error";
      const lines = [SAVE_LOCATION_LINES[notice.location]];
      if (isWriteError) lines.push(WRITE_ERROR_EMPTY_FILE_LINE);
      if (notice.missingStickerCount > 0) lines.push(CUTOUT_COPY.missingStickers(notice.missingStickerCount));
      if (SAVE_DONE_NEXT_STEP !== null) lines.push(SAVE_DONE_NEXT_STEP);
      return {
        title: isWriteError ? "고른 곳에 저장하지 못했어요" : "저장했어요",
        lines,
        tone: isWriteError ? "warning" : "success",
        actions: [{ id: "close", label: "닫기", isPrimary: true }],
        isBusy: false,
        closeActionId: "close",
      };
    }
    case "save-failed":
      return {
        title: "사진을 저장하지 못했어요",
        lines: [
          ...(notice.isWaitingForPhotos ? [PHOTO_WAITING_RETRY_LINE] : []),
          ...(notice.hasPickedFile
            ? ["고른 파일은 아직 비어 있어요.", "[다시 저장하기]를 누르면 같은 파일에 다시 저장해요.", CALL_STAFF_LINE]
            : ["[다시 저장하기]를 눌러 주세요.", CALL_STAFF_LINE]),
        ],
        tone: "error",
        actions: [
          { id: "close", label: "닫기", isPrimary: false },
          { id: "retry-save", label: "다시 저장하기", isPrimary: true },
        ],
        isBusy: false,
        closeActionId: "close",
      };
  }
};

export const getInlineStatusView = (status: InlineStatus): InlineStatusView => {
  switch (status.kind) {
    case "save-cancelled":
      return { tone: "info", lines: ["저장을 취소했어요."] };
    case "save-blocked":
      return { tone: "warning", lines: [status.message] };
    case "import-failed":
      // 호스트가 보낸 상세 문구는 손님에게 보이지 않고 콘솔에만 남깁니다(설계 4.4).
      return { tone: "error", lines: ["오늘 찍은 사진을 불러오지 못했어요.", "칸을 다시 눌러 주세요.", CALL_STAFF_LINE] };
  }
};

// 새 프레임의 칸에 남는 사진과 빠지는 사진을 나눕니다. 안내의 장수와 적용 결과가 같은 계산을 씁니다(UX1-2).
export const splitPhotosByFrame = <Photo extends { slotId: string }>({ photos, nextSlotIds }: { photos: Photo[]; nextSlotIds: string[] }): { kept: Photo[]; dropped: Photo[] } => {
  const nextSlotIdSet = new Set(nextSlotIds);
  return {
    kept: photos.filter((photo) => nextSlotIdSet.has(photo.slotId)),
    dropped: photos.filter((photo) => !nextSlotIdSet.has(photo.slotId)),
  };
};
