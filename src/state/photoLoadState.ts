export type PhotoImagesState =
  | { kind: "ready" }
  | { kind: "loading" }
  | { kind: "failed"; imageIds: string[] };

export const PHOTO_LOADING_SAVE_MESSAGE = "사진을 불러오는 중이에요. 잠시 후 저장해 주세요.";
export const PHOTO_FAILED_SAVE_MESSAGE = "사진 한 장을 불러오지 못했어요. 그 사진을 지우고 다시 넣어 주세요.";

export type LoadedPhotoImage<TImage> = {
  url: string;
  image: TImage | null;
};

// 현재 문서의 사진이 모두 지금 URL로 올라왔는지 한 가지 형태로 알린다.
// 같은 id라도 URL이 바뀌었으면 이전 로드 결과는 현재 사진의 결과로 치지 않는다.
export function getPhotoImagesState<TImage>(
  userImages: ReadonlyArray<{ id: string; url: string }>,
  loadedImages: ReadonlyMap<string, LoadedPhotoImage<TImage>>,
): PhotoImagesState {
  const failedImageIds: string[] = [];
  let isLoading = false;

  userImages.forEach((userImage) => {
    const loadedImage = loadedImages.get(userImage.id);

    if (!loadedImage || loadedImage.url !== userImage.url) {
      isLoading = true;
      return;
    }

    if (loadedImage.image === null) {
      failedImageIds.push(userImage.id);
    }
  });

  if (failedImageIds.length > 0) {
    return { kind: "failed", imageIds: failedImageIds };
  }

  return isLoading ? { kind: "loading" } : { kind: "ready" };
}

// 사진이 빠진 PNG를 만들지 않도록 저장을 막아야 하면 안내 문구를, 저장해도 되면 null을 돌려준다.
export function getPhotoSaveBlockMessage(state: PhotoImagesState): string | null {
  if (state.kind === "loading") {
    return PHOTO_LOADING_SAVE_MESSAGE;
  }

  if (state.kind === "failed") {
    return PHOTO_FAILED_SAVE_MESSAGE;
  }

  return null;
}

// 늦게 도착한 로드 콜백이 지금 문서의 같은 사진·같은 URL에 대한 것인지 확인한다.
export function isCurrentPhotoLoad(
  imageId: string,
  url: string,
  currentImageUrls: ReadonlyMap<string, string>,
): boolean {
  return currentImageUrls.get(imageId) === url;
}
