from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

from .template_validator import validate_template


def load_template(path: str | Path) -> Dict[str, Any]:
    p = Path(path)
    with p.open("r", encoding="utf-8") as f:
        data = json.load(f)
    validate_template(data)
    return data

