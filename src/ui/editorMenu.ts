// 왼쪽 레일·휴대폰 툴바 메뉴(설계 4장). "cutout"은 '내 사진 스티커'입니다.
export type EditorMenu = "frames" | "text" | "sticker" | "cutout";
// EditorPanel이 그리는 탭. 프레임은 SidebarLeft가 그립니다.
export type EditorPanelTab = Exclude<EditorMenu, "frames">;

// 데스크톱에서 열린 패널을 캔버스에서 고른 대상의 메뉴로 맞춥니다(설계 5.5).
// 닫힌 패널은 열지 않고, 프레임 패널과 빈 곳·사진 선택은 그대로 둡니다.
export const getMenuAfterSelect = ({
  openMenu,
  selectedMenu,
}: {
  openMenu: EditorMenu | null;
  selectedMenu: EditorPanelTab | null;
}): EditorMenu | null => {
  if (openMenu === null || openMenu === "frames" || selectedMenu === null) return openMenu;
  return selectedMenu;
};

// 캔버스에서 고른 대상의 메뉴입니다. 사진과 빈 곳은 null입니다(설계 5.5).
export const getSelectedMenu = ({
  id,
  texts,
  stickers,
}: {
  id: string | null;
  texts: { id: string }[];
  stickers: { id: string; cutout?: unknown }[];
}): EditorPanelTab | null => {
  if (id === null) return null;
  if (texts.some((text) => text.id === id)) return "text";
  const selectedSticker = stickers.find((sticker) => sticker.id === id);
  if (!selectedSticker) return null;
  return selectedSticker.cutout ? "cutout" : "sticker";
};

// 탭의 '이 스티커 지우기'가 지울 스티커입니다. 그 탭 종류의 스티커일 때만 돌려줍니다(계획 1.4 #1, Codex 필수 3).
export const getDeletableSticker = <S extends { id: string; cutout?: unknown }>({
  panelTab,
  selectedSticker,
}: {
  panelTab: "sticker" | "cutout";
  selectedSticker: S | undefined;
}): S | undefined => {
  if (!selectedSticker) return undefined;
  const isCutoutSticker = Boolean(selectedSticker.cutout);
  return isCutoutSticker === (panelTab === "cutout") ? selectedSticker : undefined;
};
