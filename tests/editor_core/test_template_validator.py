import json
from pathlib import Path

import pytest

from editor_core.template_loader import load_template
from editor_core.template_validator import TemplateValidationError


def test_load_valid_public_template():
    path = Path("public/templates/4-hor.json")
    data = load_template(path)
    assert data["id"] == "4-hor"
    assert data["canvas"]["dpi"] == 600


def test_invalid_missing_key(tmp_path: Path):
    bad = {"id": "x", "name": "y"}  # canvas/overlay/slots/texts 빠짐
    p = tmp_path / "bad.json"
    p.write_text(json.dumps(bad), encoding="utf-8")
    with pytest.raises(TemplateValidationError):
        load_template(p)

