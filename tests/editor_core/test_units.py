from editor_core.units import mm_to_px, px_to_mm


def test_mm_px_roundtrip():
    dpi = 600
    for mm in [0, 1, 5, 10, 150.0]:
        px = mm_to_px(mm, dpi)
        mm2 = px_to_mm(px, dpi)
        assert abs(mm - mm2) < 1e-9


def test_known_values():
    dpi = 600
    # docs: px = mm / 25.4 * dpi
    assert abs(mm_to_px(25.4, dpi) - 600) < 1e-9
    assert abs(px_to_mm(600, dpi) - 25.4) < 1e-9

