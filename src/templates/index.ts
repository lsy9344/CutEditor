// 템플릿 로더/간이 검증기 (런타임 체크)
// 실제 앱에서는 빌드타임 스키마 검증(JSON Schema) 또는 TS 기반 정적 검증을 권장

import type { Template } from "../state/types";

export const requiredKeys: (keyof Template)[] = [
  "id",
  "name",
  "canvas",
  "overlay",
  "slots",
  "texts",
];

export const loadTemplate = async (path: string): Promise<Template> => {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`템플릿 로드 실패: ${path}`);
  const data = (await res.json()) as Template;
  validateTemplate(data);
  return data;
};

export const validateTemplate = (tpl: Template): void => {
  for (const k of requiredKeys) {
    if (!(k in tpl)) throw new Error(`템플릿 키 누락: ${String(k)}`);
  }
  if (tpl.canvas.dpi !== 600) {
    throw new Error("현재는 600 DPI만 지원합니다");
  }
  if (!Array.isArray(tpl.slots) || !Array.isArray(tpl.texts)) {
    throw new Error("slots/texts는 배열이어야 합니다");
  }
};

