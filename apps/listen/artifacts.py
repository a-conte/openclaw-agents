from __future__ import annotations

import json
import os
import shutil
import time
import zipfile
from pathlib import Path
from typing import Any


JOBS_DIR = Path(__file__).resolve().parent / "jobs"
BASE_DIR = JOBS_DIR / "artifacts"
ARCHIVED_BASE_DIR = JOBS_DIR / "archived-artifacts"
EXPORT_BASE_DIR = JOBS_DIR / "exports"
COMPRESSED_ARCHIVE_DIR = JOBS_DIR / "archived-artifacts-compressed"
BASE_DIR.mkdir(parents=True, exist_ok=True)
ARCHIVED_BASE_DIR.mkdir(parents=True, exist_ok=True)
EXPORT_BASE_DIR.mkdir(parents=True, exist_ok=True)
COMPRESSED_ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)


def _safe_step_id(step_id: str) -> str:
    return step_id.replace("/", "_")


def active_job_artifact_dir(job_id: str) -> Path:
    return BASE_DIR / job_id


def archived_job_artifact_dir(job_id: str) -> Path:
    return ARCHIVED_BASE_DIR / job_id


def compressed_job_artifact_archive(job_id: str) -> Path:
    return COMPRESSED_ARCHIVE_DIR / f"{job_id}.zip"


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


def _compressed_artifact_ref(job_id: str, relative_path: str, size: int) -> dict[str, Any]:
    return {
        "kind": "compressed-file",
        "relativePath": relative_path,
        "path": str(compressed_job_artifact_archive(job_id)),
        "name": Path(relative_path).name,
        "size": size,
        "preview": None,
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
        archive_path = compressed_job_artifact_archive(job_id)
        if archived and archive_path.exists():
            with zipfile.ZipFile(archive_path) as archive:
                return [
                    _compressed_artifact_ref(job_id, info.filename, info.file_size)
                    for info in archive.infolist()
                    if not info.is_dir()
                ]
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


def read_compressed_job_artifact(job_id: str, relative_path: str) -> bytes | None:
    archive_path = compressed_job_artifact_archive(job_id)
    if not archive_path.exists() or not relative_path:
        return None
    with zipfile.ZipFile(archive_path) as archive:
        try:
            return archive.read(relative_path)
        except KeyError:
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


def _job_json_path(job_id: str, *, archived: bool = False) -> Path | None:
    preferred = (JOBS_DIR / "archived" / f"{job_id}.json") if archived else (JOBS_DIR / f"{job_id}.json")
    if preferred.exists():
        return preferred
    alternate = (JOBS_DIR / f"{job_id}.json") if archived else (JOBS_DIR / "archived" / f"{job_id}.json")
    if alternate.exists():
        return alternate
    return None


def _export_bundle_path(job_id: str, kind: str) -> Path:
    safe_kind = kind.replace("/", "_").replace(" ", "_")
    return EXPORT_BASE_DIR / f"{job_id}-{safe_kind}.zip"


def bundle_job_artifacts(job_id: str, *, archived: bool = False, kind: str = "bundle") -> dict[str, Any] | None:
    root = _existing_root(job_id, archived=archived)
    job_json = _job_json_path(job_id, archived=archived)
    compressed_archive = compressed_job_artifact_archive(job_id) if archived else None
    if root is None and job_json is None and (compressed_archive is None or not compressed_archive.exists()):
        return None
    bundle_path = _export_bundle_path(job_id, kind)
    bundle_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(bundle_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        if root is not None:
            for path in sorted(root.rglob("*")):
                if path.is_file():
                    archive.write(path, arcname=str(Path("artifacts") / path.relative_to(root)))
        elif compressed_archive is not None and compressed_archive.exists():
            archive.write(compressed_archive, arcname=f"{job_id}-archived-artifacts.zip")
        if job_json is not None and job_json.exists():
            archive.write(job_json, arcname=f"{job_id}.json")
    return _artifact_ref(bundle_path, EXPORT_BASE_DIR, kind="bundle", preview=f"{kind} for {job_id}")


def resolve_export_bundle(job_id: str, kind: str = "bundle") -> Path | None:
    path = _export_bundle_path(job_id, kind)
    if path.exists() and path.is_file():
        return path
    return None


def _retention_days_for_job(job_id: str, default_days: int) -> int:
    job_path = _job_json_path(job_id, archived=True) or _job_json_path(job_id, archived=False)
    if job_path is None or not job_path.exists():
        return default_days
    try:
        job = json.loads(job_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default_days
    template_id = str(job.get("templateId") or "").strip()
    if not template_id:
        return default_days
    try:
        from workflow_templates import get_template
        template = get_template(template_id)
    except Exception:
        template = None
    if not isinstance(template, dict):
        return default_days
    retention = template.get("artifactRetentionDays")
    if isinstance(retention, int) and retention >= 0:
        return retention
    return default_days


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


def _dir_size(path: Path) -> int:
    total = 0
    for item in path.rglob("*"):
        if item.is_file():
            total += item.stat().st_size
    return total


def artifact_summary() -> dict[str, Any]:
    active_jobs = sorted(path.name for path in BASE_DIR.iterdir() if path.is_dir()) if BASE_DIR.exists() else []
    archived_jobs = sorted(path.name for path in ARCHIVED_BASE_DIR.iterdir() if path.is_dir()) if ARCHIVED_BASE_DIR.exists() else []
    oldest_archived_mtime = min(
        (path.stat().st_mtime for path in ARCHIVED_BASE_DIR.iterdir() if path.is_dir()),
        default=None,
    ) if ARCHIVED_BASE_DIR.exists() else None
    oldest_archived_age_days = None
    if oldest_archived_mtime is not None:
        oldest_archived_age_days = round(max(0.0, (time.time() - oldest_archived_mtime) / (24 * 60 * 60)), 1)
    return {
        "active": {
            "jobCount": len(active_jobs),
            "bytes": _dir_size(BASE_DIR),
            "jobs": active_jobs[:50],
        },
        "archived": {
            "jobCount": len(archived_jobs),
            "bytes": _dir_size(ARCHIVED_BASE_DIR),
            "jobs": archived_jobs[:50],
        },
        "compressed": {
            "bundleCount": len(list(COMPRESSED_ARCHIVE_DIR.glob("*.zip"))) if COMPRESSED_ARCHIVE_DIR.exists() else 0,
            "bytes": _dir_size(COMPRESSED_ARCHIVE_DIR),
        },
        "exports": {
            "bundleCount": len(list(EXPORT_BASE_DIR.glob("*.zip"))) if EXPORT_BASE_DIR.exists() else 0,
            "bytes": _dir_size(EXPORT_BASE_DIR),
        },
        "retentionDays": int(os.environ.get("OPENCLAW_LISTEN_ARTIFACT_RETENTION_DAYS", "30").strip() or "30"),
        "oldestArchivedAgeDays": oldest_archived_age_days,
    }


def prune_archived_artifacts(older_than_days: int) -> dict[str, Any]:
    if older_than_days < 0:
        raise ValueError("older_than_days must be non-negative")
    removed_jobs: list[str] = []
    removed_bytes = 0
    if not ARCHIVED_BASE_DIR.exists():
        return {"removedJobs": removed_jobs, "removedBytes": removed_bytes}
    for path in sorted(ARCHIVED_BASE_DIR.iterdir()):
        if not path.is_dir():
            continue
        try:
            mtime = path.stat().st_mtime
        except FileNotFoundError:
            continue
        effective_days = _retention_days_for_job(path.name, older_than_days)
        cutoff = time.time() - (effective_days * 24 * 60 * 60)
        if mtime > cutoff:
            continue
        removed_bytes += _dir_size(path)
        removed_jobs.append(path.name)
        shutil.rmtree(path, ignore_errors=True)
    return {"removedJobs": removed_jobs, "removedBytes": removed_bytes, "olderThanDays": older_than_days}


def compress_archived_artifacts(older_than_days: int) -> dict[str, Any]:
    if older_than_days < 0:
        raise ValueError("older_than_days must be non-negative")
    compressed_jobs: list[str] = []
    compressed_bytes = 0
    if not ARCHIVED_BASE_DIR.exists():
        return {"compressedJobs": compressed_jobs, "compressedBytes": compressed_bytes, "olderThanDays": older_than_days}
    for path in sorted(ARCHIVED_BASE_DIR.iterdir()):
        if not path.is_dir():
            continue
        try:
            mtime = path.stat().st_mtime
        except FileNotFoundError:
            continue
        cutoff = time.time() - (older_than_days * 24 * 60 * 60)
        if mtime > cutoff:
            continue
        archive_path = compressed_job_artifact_archive(path.name)
        archive_path.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for item in sorted(path.rglob("*")):
                if item.is_file():
                    archive.write(item, arcname=str(item.relative_to(path)))
        compressed_bytes += archive_path.stat().st_size if archive_path.exists() else 0
        compressed_jobs.append(path.name)
        shutil.rmtree(path, ignore_errors=True)
    return {"compressedJobs": compressed_jobs, "compressedBytes": compressed_bytes, "olderThanDays": older_than_days}
