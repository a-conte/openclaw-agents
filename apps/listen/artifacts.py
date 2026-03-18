from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parent / "jobs" / "artifacts"
BASE_DIR.mkdir(parents=True, exist_ok=True)


def job_artifact_dir(job_id: str) -> Path:
    path = BASE_DIR / job_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def step_artifact_dir(job_id: str, step_id: str) -> Path:
    safe_step = step_id.replace("/", "_")
    path = job_artifact_dir(job_id) / safe_step
    path.mkdir(parents=True, exist_ok=True)
    return path


def _artifact_ref(path: Path, *, preview: str | None = None, kind: str = "file") -> dict[str, Any]:
    return {
        "kind": kind,
        "relativePath": str(path.relative_to(BASE_DIR)),
        "path": str(path),
        "name": path.name,
        "size": path.stat().st_size if path.exists() else 0,
        "preview": preview,
    }


def write_text_artifact(job_id: str, step_id: str, name: str, content: str, *, preview: str | None = None) -> dict[str, Any]:
    path = step_artifact_dir(job_id, step_id) / name
    path.write_text(content, encoding="utf-8")
    return _artifact_ref(path, preview=preview, kind="text")


def write_json_artifact(job_id: str, step_id: str, name: str, payload: Any, *, preview: str | None = None) -> dict[str, Any]:
    path = step_artifact_dir(job_id, step_id) / name
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return _artifact_ref(path, preview=preview, kind="json")


def copy_file_artifact(job_id: str, step_id: str, source_path: str, *, output_name: str | None = None, preview: str | None = None) -> dict[str, Any] | None:
    source = Path(source_path)
    if not source.exists() or not source.is_file():
        return None
    target = step_artifact_dir(job_id, step_id) / (output_name or source.name)
    if source.resolve() != target.resolve():
        shutil.copy2(source, target)
    return {
        **_artifact_ref(target, preview=preview, kind="copied-file"),
        "sourcePath": str(source),
    }


def list_job_artifacts(job_id: str) -> list[dict[str, Any]]:
    root = job_artifact_dir(job_id)
    items: list[dict[str, Any]] = []
    for path in sorted(root.rglob("*")):
        if path.is_file():
            items.append(_artifact_ref(path))
    return items


def resolve_job_artifact(job_id: str, relative_path: str) -> Path | None:
    if not relative_path:
        return None
    root = job_artifact_dir(job_id).resolve()
    candidate = (BASE_DIR / relative_path).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        return None
    return candidate if candidate.exists() and candidate.is_file() else None
