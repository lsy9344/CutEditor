export type PhotoEditFeatures = {
  adjust: boolean;
  erase: boolean;
  cutout: boolean;
};

export const PHOTO_EDIT_FEATURES: PhotoEditFeatures = {
  adjust: true,
  erase: true,
  cutout: true,
};

export type PhotoEditSections = {
  showBox: boolean;
  showAdjust: boolean;
  showErase: boolean;
};

export function getPhotoEditSections(features: PhotoEditFeatures): PhotoEditSections {
  return {
    showBox: features.adjust || features.erase,
    showAdjust: features.adjust,
    showErase: features.erase,
  };
}
