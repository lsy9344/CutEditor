from __future__ import annotations

from typing import Any, Dict, List


REQUIRED_TEMPLATE_KEYS = {"id", "name", "canvas", "overlay", "slots", "texts"}
REQUIRED_CANVAS_KEYS = {
    "width_mm",
    "height_mm",
    "dpi",
    "bleed_mm",
    "safe_mm",
    "background",
}


class TemplateValidationError(ValueError):
    pass


def validate_template(data: Dict[str, Any]) -> None:
    """docs/TEMPLATE_SCHEMA.md 요약 스키마에 근거한 간이 검증.

    - 필수 키 존재
    - canvas.dpi = 600 고정
    - slots/texts 배열
    - 수치 필드는 0 이상(간단 체크)
    """

    missing = REQUIRED_TEMPLATE_KEYS - set(data.keys())
    if missing:
        raise TemplateValidationError(f"템플릿 키 누락: {sorted(missing)}")

    canvas = data.get("canvas")
    if not isinstance(canvas, dict):
        raise TemplateValidationError("canvas는 객체여야 합니다")

    missing_canvas = REQUIRED_CANVAS_KEYS - set(canvas.keys())
    if missing_canvas:
        raise TemplateValidationError(f"canvas 키 누락: {sorted(missing_canvas)}")

    dpi = canvas.get("dpi")
    if dpi != 600:
        raise TemplateValidationError("현재는 dpi=600만 지원합니다")

    for k in ("width_mm", "height_mm", "bleed_mm", "safe_mm"):
        v = canvas.get(k)
        if not isinstance(v, (int, float)) or v < 0:
            raise TemplateValidationError(f"canvas.{k}는 0 이상의 숫자여야 합니다")

    overlay = data.get("overlay")
    if not isinstance(overlay, str) or not overlay:
        raise TemplateValidationError("overlay는 비어있지 않은 문자열이어야 합니다")

    slots = data.get("slots")
    if not isinstance(slots, list):
        raise TemplateValidationError("slots는 배열이어야 합니다")

    for i, s in enumerate(slots):
        if not isinstance(s, dict):
            raise TemplateValidationError(f"slots[{i}]는 객체여야 합니다")
        for key in ("id", "x_mm", "y_mm", "w_mm", "h_mm", "rotation", "mode"):
            if key not in s:
                raise TemplateValidationError(f"slots[{i}].{key} 누락")

    texts = data.get("texts")
    if not isinstance(texts, list):
        raise TemplateValidationError("texts는 배열이어야 합니다")


