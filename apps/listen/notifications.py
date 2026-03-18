from __future__ import annotations

import json
import time
import uuid
from pathlib import Path
from typing import Any


STATE_PATH = Path(__file__).resolve().parent / "notification-state.json"
_SEVERITY_RANK = {"info": 0, "warning": 1, "error": 2, "critical": 3}
_DEFAULT_CHANNELS = {"push": True, "notes": True, "imessage": False, "mail_draft": False}


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _default_preferences() -> dict[str, Any]:
    return {
        "dashboardPrimary": True,
        "severityThreshold": "error",
        "channels": dict(_DEFAULT_CHANNELS),
        "agentAllowlist": [],
        "templateAllowlist": [],
        "updatedAt": now_iso(),
    }


def _default_state() -> dict[str, Any]:
    return {"preferences": _default_preferences(), "devices": [], "events": []}


def _load_state() -> dict[str, Any]:
    if not STATE_PATH.exists():
        return _default_state()
    try:
        payload = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return _default_state()
    if not isinstance(payload, dict):
        return _default_state()
    state = _default_state()
    state.update(payload)
    if not isinstance(state.get("preferences"), dict):
        state["preferences"] = _default_preferences()
    if not isinstance(state.get("devices"), list):
        state["devices"] = []
    if not isinstance(state.get("events"), list):
        state["events"] = []
    return state


def _save_state(state: dict[str, Any]) -> None:
    STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")


def get_notification_preferences() -> dict[str, Any]:
    return _load_state()["preferences"]


def update_notification_preferences(data: dict[str, Any]) -> dict[str, Any]:
    state = _load_state()
    current = state["preferences"]
    if not isinstance(current, dict):
        current = _default_preferences()

    threshold = data.get("severityThreshold")
    if isinstance(threshold, str) and threshold in _SEVERITY_RANK:
        current["severityThreshold"] = threshold

    channels = data.get("channels")
    if isinstance(channels, dict):
        merged_channels = dict(_DEFAULT_CHANNELS)
        for name in merged_channels:
            if name in channels:
                merged_channels[name] = bool(channels[name])
        current["channels"] = merged_channels

    for key in ("agentAllowlist", "templateAllowlist"):
        raw = data.get(key)
        if isinstance(raw, list):
            current[key] = [str(item).strip() for item in raw if str(item).strip()]

    if "dashboardPrimary" in data:
        current["dashboardPrimary"] = bool(data.get("dashboardPrimary"))

    current["updatedAt"] = now_iso()
    state["preferences"] = current
    _save_state(state)
    return current


def list_notification_devices() -> list[dict[str, Any]]:
    state = _load_state()
    devices = state.get("devices")
    return devices if isinstance(devices, list) else []


def register_notification_device(data: dict[str, Any]) -> dict[str, Any]:
    state = _load_state()
    devices = list_notification_devices()
    device_id = str(data.get("id") or "").strip() or uuid.uuid4().hex
    token = str(data.get("token") or "").strip() or None
    entry = {
        "id": device_id,
        "name": str(data.get("name") or "Mission Control iPad").strip() or "Mission Control iPad",
        "platform": str(data.get("platform") or "ios").strip() or "ios",
        "token": token,
        "registeredAt": now_iso(),
        "lastSeenAt": now_iso(),
    }
    existing = next((index for index, item in enumerate(devices) if isinstance(item, dict) and item.get("id") == device_id), None)
    if existing is None:
        devices.append(entry)
    else:
        previous = devices[existing]
        if isinstance(previous, dict) and previous.get("registeredAt"):
            entry["registeredAt"] = previous["registeredAt"]
        devices[existing] = entry
    state["devices"] = devices[-25:]
    _save_state(state)
    return entry


def list_notification_events(limit: int = 25) -> list[dict[str, Any]]:
    state = _load_state()
    events = state.get("events")
    if not isinstance(events, list):
        return []
    return list(reversed(events[-max(limit, 1):]))


def _channels_for_event(preferences: dict[str, Any]) -> list[str]:
    channels = preferences.get("channels")
    if not isinstance(channels, dict):
        return []
    return [name for name, enabled in channels.items() if bool(enabled)]


def emit_job_notification(job: dict[str, Any]) -> dict[str, Any] | None:
    preferences = get_notification_preferences()
    status = str(job.get("status") or "").strip()
    if not status:
        return None

    severity = "info"
    if bool(job.get("timedOut")):
        severity = "critical"
    elif isinstance(job.get("policy"), dict) and job["policy"].get("allowed") is False:
        severity = "critical"
    elif status in {"failed", "stopped"}:
        severity = "error"
    elif status == "completed":
        severity = "info"
    else:
        return None

    threshold = str(preferences.get("severityThreshold") or "error")
    if _SEVERITY_RANK.get(severity, 0) < _SEVERITY_RANK.get(threshold, 2):
        return None

    template_allowlist = preferences.get("templateAllowlist")
    template_id = str(job.get("templateId") or "").strip()
    if isinstance(template_allowlist, list) and template_allowlist and template_id not in template_allowlist:
        return None

    agent_allowlist = preferences.get("agentAllowlist")
    target_agent = str(job.get("targetAgent") or "").strip()
    if isinstance(agent_allowlist, list) and agent_allowlist and target_agent not in agent_allowlist:
        return None

    channels = _channels_for_event(preferences)
    summary = str(job.get("summary") or "").strip()
    error = str(job.get("error") or "").strip()
    title_target = template_id or str(job.get("workflow") or "").strip() or str(job.get("mode") or "job")
    title = f"{title_target} {status}"
    body = error or summary or f"Job {job.get('id')} changed to {status}."
    event = {
        "id": uuid.uuid4().hex[:12],
        "jobId": str(job.get("id") or ""),
        "status": status,
        "severity": severity,
        "title": title,
        "body": body,
        "channels": channels,
        "createdAt": now_iso(),
        "targetAgent": target_agent or None,
        "templateId": template_id or None,
        "summary": summary or None,
        "dashboardPrimary": bool(preferences.get("dashboardPrimary", True)),
    }

    state = _load_state()
    events = state.get("events")
    if not isinstance(events, list):
        events = []
    events.append(event)
    state["events"] = events[-200:]
    _save_state(state)
    return event
