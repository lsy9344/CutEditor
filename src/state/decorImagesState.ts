// 프레임 이미지와 일반 스티커 이미지가 캔버스에 그려질 준비가 됐는지 한 가지 형태로 알립니다(UX4-2).
// 사진·누끼의 준비 보고(PhotoImagesState, CutoutImagesState)와 같은 방식으로 저장 준비 판단에 들어갑니다.
export type DecorImagesState =
  | { kind: "ready"; failedStickerCount: number } // failedStickerCount: 읽기를 모든 후보에서 실패해 그려지지 않는 일반 스티커 수(UX5-4)
  | { kind: "loading" }
  | { kind: "failed" }; // 프레임 이미지를 모든 후보에서 읽지 못함. 기다려도 풀리지 않습니다

// none: 프레임을 고르지 않음, loading: 지금 고른 프레임을 아직 못 읽음, loaded: 읽음, failed: 모든 후보를 읽지 못함
export type FrameLoad = "none" | "loading" | "loaded" | "failed";

export type DecorImagesInput = {
  frameLoad: FrameLoad;
  isFrameColorApplied: boolean; // 읽은 프레임에 지금 프레임 색 처리를 마쳤는지
  stickers: ReadonlyArray<{ isLoaded: boolean; isFailed: boolean }>; // 누끼가 아닌 일반 스티커
};

// 프레임이 임시 흰 배경이거나 색 처리 전이면 저장 PNG의 프레임이 틀립니다. 일반 스티커는 이미지가 없으면 그려지지 않습니다.
// 읽지 못한 일반 스티커는 누끼 스티커 실패처럼 저장을 막지 않습니다(기다려도 그려지지 않으므로 기다릴 것이 없음). 대신 수를 알려 저장 결과 안내에 보입니다.
export function getDecorImagesState({ frameLoad, isFrameColorApplied, stickers }: DecorImagesInput): DecorImagesState {
  if (frameLoad === "failed") return { kind: "failed" };
  if (frameLoad === "loading") return { kind: "loading" };
  if (frameLoad === "loaded" && !isFrameColorApplied) return { kind: "loading" };
  if (stickers.some((sticker) => !sticker.isLoaded && !sticker.isFailed)) return { kind: "loading" };
  return { kind: "ready", failedStickerCount: stickers.filter((sticker) => sticker.isFailed).length };
}

export type FrameColorResult<TImage> = { image: TImage | null; color: string };

// 색 처리 결과가 지금 프레임 이미지와 지금 색에 대한 것일 때만 적용된 것으로 봅니다.
// 프레임이나 색이 바뀐 직후에는 옛 결과가 남아 있어도 적용 전입니다.
export const isFrameColorApplied = <TImage>(
  result: FrameColorResult<TImage> | null,
  frameImage: TImage | null,
  frameColor: string,
): boolean => frameImage !== null && result !== null && result.image === frameImage && result.color === frameColor;
