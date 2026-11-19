export type PhotoImagesState =
  | { kind: "ready" }
  | { kind: "loading" }
  | { kind: "failed"; imageIds: string[] };

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

// 늦게 도착한 로드 콜백이 지금 문서의 같은 사진·같은 URL에 대한 것인지 확인한다.
export function isCurrentPhotoLoad(
  imageId: string,
  url: string,
  currentImageUrls: ReadonlyMap<string, string>,
): boolean {
  return currentImageUrls.get(imageId) === url;
}
