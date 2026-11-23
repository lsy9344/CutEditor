// 폰트 파일은 필요할 때만 받는다.
// register는 이름만 알려 주고(받지 않음), 화면 DOM이 그 폰트를 쓰거나 ensureLoaded를 부를 때 받는다.

export type FontFaceHandle = {
  status: string;
  load: () => Promise<unknown>;
};

export type FontSource = {
  name: string;
  path: string;
};

type FontLoaderDeps<TFace extends FontFaceHandle> = {
  createFace: (family: string, url: string) => TFace;
  addFace: (face: TFace) => void;
  removeFace: (face: TFace) => void;
};

export const createFontLoader = <TFace extends FontFaceHandle>({
  createFace,
  addFace,
  removeFace,
}: FontLoaderDeps<TFace>) => {
  const pathsByFamily = new Map<string, string>();
  const facesByFamily = new Map<string, TFace>();
  const loadsByFamily = new Map<string, Promise<void>>();

  const addNewFace = (family: string, path: string) => {
    const face = createFace(family, path);
    facesByFamily.set(family, face);
    addFace(face);
    return face;
  };

  const register = (fonts: FontSource[]) => {
    fonts.forEach(({ name, path }) => {
      if (facesByFamily.has(name)) return;

      pathsByFamily.set(name, path);
      addNewFace(name, path);
    });
  };

  const isReady = (family: string) => {
    const face = facesByFamily.get(family);
    if (!face) return true;
    return face.status === "loaded" || face.status === "error";
  };

  const loadOne = (family: string) => {
    const existingLoad = loadsByFamily.get(family);
    if (existingLoad) return existingLoad;

    let face = facesByFamily.get(family);
    const path = pathsByFamily.get(family);
    if (!face || !path) return Promise.resolve();

    // 실패한 FontFace는 다시 받을 수 없으므로(화면이 먼저 받다 실패한 경우 포함) 새로 만들어 다시 받는다.
    if (face.status === "error") {
      removeFace(face);
      face = addNewFace(family, path);
    }

    const load = face.load().then(
      () => undefined,
      (loadError: unknown) => {
        console.warn(`Failed to load font ${family}:`, loadError);
        // 다음 요청(다음 수정·저장) 때 다시 받도록 기다림을 지운다. 그때까지는 대체 폰트로 그린다.
        loadsByFamily.delete(family);
      },
    );
    loadsByFamily.set(family, load);
    return load;
  };

  // 실패해도 reject하지 않는다. 받지 못한 폰트는 대체 폰트로 그린다.
  const ensureLoaded = async (families: string[]) => {
    await Promise.all(Array.from(new Set(families), loadOne));
  };

  return { register, isReady, ensureLoaded };
};

export const fontLoader = createFontLoader<FontFace>({
  createFace: (family, url) => new FontFace(family, `url("${encodeURI(url)}")`),
  addFace: (face) => {
    document.fonts.add(face);
  },
  removeFace: (face) => {
    document.fonts.delete(face);
  },
});
