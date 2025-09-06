from __future__ import annotations

MM_PER_INCH = 25.4


def mm_to_px(mm: float, dpi: float) -> float:
    """mm → px 변환. 반올림은 호출자가 결정한다."""
    return (mm / MM_PER_INCH) * dpi


def px_to_mm(px: float, dpi: float) -> float:
    """px → mm 변환."""
    return (px * MM_PER_INCH) / dpi

