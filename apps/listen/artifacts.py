from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any


JOBS_DIR = Path(__file__).resolve().parent / "jobs"
BASE_DIR = JOBS_DIR / "artifacts"
ARCHIVED_BASE_DIR = JOBS_DIR / "archived-artifacts"
BASE_DIR.mkdir(parents=True, exist_ok=True)
ARCHIVED_BASE_DIR.mkdir(parents=True, exist_ok=True)


def _safe_step_id(step_id: str) -> str:
    return step_id.replace("/", "_")


def active_job_artifact_dir(job_id: str) -> Path:
    return BASE_DIR / job_id


def archived_job_artifact_dir(job_id: str) -> Path:
    return ARCHIVED_BASE_DIR / job_id


def create_job_artifact_dir(job_id: str) -> Path:
    path = active_job_artifact_dir(job_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def step_artifact_dir(job_id: str, step_id: str) -> Path:
    path = create_job_artifact_dir(job_id) / _safe_step_id(step_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _artifact_ref(path: Path, root: Path, *, preview: str | None = None, kind: str = "file") -> dict[str, Any]:
    return {
        "kind": kind,
        "relativePath": str(path.relative_to(root)),
        "path": str(path),
        "name": path.name,
        "size": path.stat().st_size if path.exists() else 0,
        "preview": preview,
    }


def write_text_artifact(job_id: str, step_id: str, name: str, content: str, *, preview: str | None = None) -> dict[str, Any]:
    path = step_artifact_dir(job_id, step_id) / name
    path.write_text(content, encoding="utf-8")
    return _artifact_ref(path, BASE_DIR, preview=preview, kind="text")


def write_json_artifact(job_id: str, step_id: str, name: str, payload: Any, *, preview: str | None = None) -> dict[str, Any]:
    path = step_artifact_dir(job_id, step_id) / name
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return _artifact_ref(path, BASE_DIR, preview=preview, kind="json")


def copy_file_artifact(job_id: str, step_id: str, source_path: str, *, output_name: str | None = None, preview: str | None = None) -> dict[str, Any] | None:
    source = Path(source_path)
    if not source.exists() or not source.is_file():
        return None
    target = step_artifact_dir(job_id, step_id) / (output_name or source.name)
    if source.resolve() != target.resolve():
        shutil.copy2(source, target)
    return {
        **_artifact_ref(target, BASE_DIR, preview=preview, kind="copied-file"),
        "sourcePath": str(source),
    }


def _existing_root(job_id: str, *, archived: bool = False) -> Path | None:
    preferred = archived_job_artifact_dir(job_id) if archived else active_job_artifact_dir(job_id)
    if preferred.exists():
        return preferred
    alternate = active_job_artifact_dir(job_id) if archived else archived_job_artifact_dir(job_id)
    if alternate.exists():
        return alternate
    return None


def list_job_artifacts(job_id: str, *, archived: bool = False) -> list[dict[str, Any]]:
    root = _existing_root(job_id, archived=archived)
    if root is None:
        return []
    base = ARCHIVED_BASE_DIR if root.is_relative_to(ARCHIVED_BASE_DIR) else BASE_DIR
    items: list[dict[str, Any]] = []
    for path in sorted(root.rglob("*")):
        if path.is_file():
            items.append(_artifact_ref(path, base))
    return items


def resolve_job_artifact(job_id: str, relative_path: str, *, archived: bool = False) -> Path | None:
    if not relative_path:
        return None
    roots = []
    preferred = _existing_root(job_id, archived=archived)
    if preferred is not None:
        roots.append(preferred)
    for root in (active_job_artifact_dir(job_id), archived_job_artifact_dir(job_id)):
        if root not in roots and root.exists():
            roots.append(root)
    for root in roots:
        base = ARCHIVED_BASE_DIR if root.is_relative_to(ARCHIVED_BASE_DIR) else BASE_DIR
        candidate = (base / relative_path).resolve()
        try:
            candidate.relative_to(root.resolve())
        except ValueError:
            continue
        if candidate.exists() and candidate.is_file():
            return candidate
    return None


def archive_job_artifacts(job_id: str) -> bool:
    source = active_job_artifact_dir(job_id)
    if not source.exists():
        return False
    target = archived_job_artifact_dir(job_id)
    if target.exists():
        shutil.rmtree(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(source), str(target))
    return True


def delete_job_artifacts(job_id: str, *, archived: bool | None = None) -> int:
    removed = 0
    roots: list[Path] = []
    if archived is None:
        roots = [active_job_artifact_dir(job_id), archived_job_artifact_dir(job_id)]
    elif archived:
        roots = [archived_job_artifact_dir(job_id)]
    else:
        roots = [active_job_artifact_dir(job_id)]
    for root in roots:
        if root.exists():
            shutil.rmtree(root)
            removed += 1
    return removed


def archive_all_active_artifacts() -> int:
    count = 0
    for path in sorted(BASE_DIR.iterdir()):
        if path.is_dir() and archive_job_artifacts(path.name):
            count += 1
    return count
