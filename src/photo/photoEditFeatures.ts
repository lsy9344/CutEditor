export type PhotoEditFeatures = {
  adjust: boolean;
  erase: boolean;
  cutout: boolean;
  cutoutSubjectChoice: boolean; // 내 사진 스티커 만들기 패널의 '사람'·'반려동물·물건' 두 칸
};

export const PHOTO_EDIT_FEATURES: PhotoEditFeatures = {
  adjust: true,
  erase: true,
  cutout: true,
  cutoutSubjectChoice: true,
};

export type PhotoEditSections = {
  showBox: boolean;
  showAdjust: boolean;
  showErase: boolean;
};

export function getPhotoEditSections(features: Pick<PhotoEditFeatures, "adjust" | "erase" | "cutout">): PhotoEditSections {
  return {
    showBox: features.adjust || features.erase,
    showAdjust: features.adjust,
    showErase: features.erase,
  };
}
