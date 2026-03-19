from __future__ import annotations

import json
import time
import uuid
from pathlib import Path
from typing import Any


STATE_PATH = Path(__file__).resolve().parent / "notification-state.json"
_SEVERITY_RANK = {"info": 0, "warning": 1, "error": 2, "critical": 3}
_DEFAULT_CHANNELS = {"push": True, "notes": False, "imessage": False, "mail_draft": False}
_DEFAULT_COMPLETION_TEMPLATES = [
    "operator_handoff_note",
    "operator_handoff_bundle",
    "browser_recovery_handoff",
    "daemon_recovery_handoff",
    "repo_validation_handoff",
    "incident_capture",
    "incident_mail_handoff",
]
_DEFAULT_TEMPLATE_ROUTING = {
    "operator_handoff_note": {"channels": {"push": True, "notes": True, "imessage": False, "mail_draft": False}},
    "operator_handoff_bundle": {"channels": {"push": True, "notes": True, "imessage": False, "mail_draft": False}},
    "browser_recovery_handoff": {"channels": {"push": True, "notes": True, "imessage": False, "mail_draft": False}},
    "daemon_recovery_handoff": {"channels": {"push": True, "notes": True, "imessage": False, "mail_draft": False}},
    "repo_validation_handoff": {"channels": {"push": True, "notes": True, "imessage": False, "mail_draft": False}},
    "incident_capture": {"channels": {"push": True, "notes": True, "imessage": False, "mail_draft": False}},
    "incident_mail_handoff": {"channels": {"push": True, "notes": True, "imessage": False, "mail_draft": False}},
}


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _default_preferences() -> dict[str, Any]:
    return {
        "dashboardPrimary": True,
        "severityThreshold": "warning",
        "mode": "focused",
        "eventPolicy": {
            "failed": True,
            "stopped": True,
            "policyBlocked": True,
            "timedOut": True,
            "completedHandoffs": True,
            "completedGeneral": False,
        },
        "completionTemplateAllowlist": list(_DEFAULT_COMPLETION_TEMPLATES),
        "legacySignals": "dashboard_only",
        "channels": dict(_DEFAULT_CHANNELS),
        "agentAllowlist": [],
        "templateAllowlist": [],
        "templateRouting": {key: dict(value) for key, value in _DEFAULT_TEMPLATE_ROUTING.items()},
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


def _normalize_route(route: dict[str, Any] | None) -> dict[str, Any]:
    route = route if isinstance(route, dict) else {}
    route_channels = dict(_DEFAULT_CHANNELS)
    raw_channels = route.get("channels")
    if isinstance(raw_channels, dict):
        for name in route_channels:
            if name in raw_channels:
                route_channels[name] = bool(raw_channels[name])
    return {
        "channels": route_channels,
        "recipient": str(route.get("recipient") or "").strip() or None,
        "mailTo": str(route.get("mailTo") or "").strip() or None,
        "mailSubjectPrefix": str(route.get("mailSubjectPrefix") or "").strip() or None,
    }


def get_notification_preferences() -> dict[str, Any]:
    current = _load_state()["preferences"]
    if not isinstance(current, dict):
        return _default_preferences()
    normalized = dict(_default_preferences())
    normalized.update(current)
    if normalized.get("mode") not in {"focused", "verbose"}:
        normalized["mode"] = "focused"
    if normalized.get("legacySignals") not in {"dashboard_only", "include_in_operator_feed"}:
        normalized["legacySignals"] = "dashboard_only"
    channels = current.get("channels")
    if isinstance(channels, dict):
        merged_channels = dict(_DEFAULT_CHANNELS)
        for name in merged_channels:
            if name in channels:
                merged_channels[name] = bool(channels[name])
        normalized["channels"] = merged_channels
    current_policy = current.get("eventPolicy")
    merged_policy = dict(_default_preferences()["eventPolicy"])
    if isinstance(current_policy, dict):
        for name in merged_policy:
            if name in current_policy:
                merged_policy[name] = bool(current_policy[name])
    normalized["eventPolicy"] = merged_policy
    raw_completion_templates = current.get("completionTemplateAllowlist")
    if isinstance(raw_completion_templates, list):
        normalized["completionTemplateAllowlist"] = [
            str(item).strip() for item in raw_completion_templates if str(item).strip()
        ]
    else:
        normalized["completionTemplateAllowlist"] = list(_DEFAULT_COMPLETION_TEMPLATES)
    raw_routing = current.get("templateRouting")
    merged_routing = {key: _normalize_route(value) for key, value in _DEFAULT_TEMPLATE_ROUTING.items()}
    if isinstance(raw_routing, dict):
        for template_id, route in raw_routing.items():
            template_key = str(template_id).strip()
            if not template_key:
                continue
            merged_routing[template_key] = _normalize_route(route if isinstance(route, dict) else None)
    normalized["templateRouting"] = merged_routing
    return normalized


def update_notification_preferences(data: dict[str, Any]) -> dict[str, Any]:
    state = _load_state()
    current = get_notification_preferences()

    threshold = data.get("severityThreshold")
    if isinstance(threshold, str) and threshold in _SEVERITY_RANK:
        current["severityThreshold"] = threshold

    mode = data.get("mode")
    if isinstance(mode, str) and mode in {"focused", "verbose"}:
        current["mode"] = mode

    legacy_signals = data.get("legacySignals")
    if isinstance(legacy_signals, str) and legacy_signals in {"dashboard_only", "include_in_operator_feed"}:
        current["legacySignals"] = legacy_signals

    event_policy = data.get("eventPolicy")
    if isinstance(event_policy, dict):
        merged_policy = dict(current.get("eventPolicy") or _default_preferences()["eventPolicy"])
        for name in _default_preferences()["eventPolicy"]:
            if name in event_policy:
                merged_policy[name] = bool(event_policy[name])
        current["eventPolicy"] = merged_policy

    raw_completion_templates = data.get("completionTemplateAllowlist")
    if isinstance(raw_completion_templates, list):
        current["completionTemplateAllowlist"] = [
            str(item).strip() for item in raw_completion_templates if str(item).strip()
        ]

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

    raw_routing = data.get("templateRouting")
    if isinstance(raw_routing, dict):
        normalized_routing: dict[str, Any] = {
            key: _normalize_route(value) for key, value in _DEFAULT_TEMPLATE_ROUTING.items()
        }
        for template_id, route in raw_routing.items():
            template_key = str(template_id).strip()
            if not template_key or not isinstance(route, dict):
                continue
            normalized_routing[template_key] = _normalize_route(route)
        current["templateRouting"] = normalized_routing

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


def _route_for_template(preferences: dict[str, Any], template_id: str) -> dict[str, Any] | None:
    raw_routing = preferences.get("templateRouting")
    if not isinstance(raw_routing, dict) or not template_id:
        return None
    route = raw_routing.get(template_id)
    return route if isinstance(route, dict) else None


def emit_job_notification(job: dict[str, Any]) -> dict[str, Any] | None:
    preferences = get_notification_preferences()
    status = str(job.get("status") or "").strip()
    if not status:
        return None

    event_policy = preferences.get("eventPolicy")
    event_policy = event_policy if isinstance(event_policy, dict) else {}
    template_id = str(job.get("templateId") or "").strip()
    completion_templates = preferences.get("completionTemplateAllowlist")
    completion_templates = completion_templates if isinstance(completion_templates, list) else []
    is_handoff_completion = status == "completed" and template_id in completion_templates

    severity = "info"
    signal_class = "operator"
    if bool(job.get("timedOut")):
        if not bool(event_policy.get("timedOut", True)):
            return None
        severity = "critical"
        signal_class = "timeout"
    elif isinstance(job.get("policy"), dict) and job["policy"].get("allowed") is False:
        if not bool(event_policy.get("policyBlocked", True)):
            return None
        severity = "critical"
        signal_class = "policy_block"
    elif status in {"failed", "stopped"}:
        if not bool(event_policy.get(status, True)):
            return None
        severity = "error"
        signal_class = "failure"
    elif status == "completed":
        if is_handoff_completion:
            if not bool(event_policy.get("completedHandoffs", True)):
                return None
            severity = "warning"
            signal_class = "handoff_completion"
        else:
            if not bool(event_policy.get("completedGeneral", False)):
                return None
            severity = "info"
            signal_class = "completion"
    else:
        return None

    threshold = str(preferences.get("severityThreshold") or "error")
    if _SEVERITY_RANK.get(severity, 0) < _SEVERITY_RANK.get(threshold, 2):
        return None

    template_allowlist = preferences.get("templateAllowlist")
    if isinstance(template_allowlist, list) and template_allowlist and template_id not in template_allowlist:
        return None

    agent_allowlist = preferences.get("agentAllowlist")
    target_agent = str(job.get("targetAgent") or "").strip()
    if isinstance(agent_allowlist, list) and agent_allowlist and target_agent not in agent_allowlist:
        return None

    route = _route_for_template(preferences, template_id)
    if route and isinstance(route.get("channels"), dict):
        channels = [name for name, enabled in route["channels"].items() if bool(enabled)]
    else:
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
        "source": "automation_runtime",
        "signalClass": signal_class,
        "routing": route or None,
        "deliveries": [],
    }

    state = _load_state()
    events = state.get("events")
    if not isinstance(events, list):
        events = []
    events.append(event)
    state["events"] = events[-200:]
    _save_state(state)
    return event


def record_notification_delivery(
    event_id: str,
    channel: str,
    status: str,
    *,
    detail: str | None = None,
    target: str | None = None,
) -> dict[str, Any] | None:
    state = _load_state()
    events = state.get("events")
    if not isinstance(events, list):
        return None
    target_event: dict[str, Any] | None = None
    for item in events:
        if isinstance(item, dict) and str(item.get("id") or "") == event_id:
            target_event = item
            break
    if target_event is None:
        return None
    deliveries = target_event.get("deliveries")
    if not isinstance(deliveries, list):
        deliveries = []
        target_event["deliveries"] = deliveries
    payload: dict[str, Any] = {
        "channel": channel,
        "status": status,
        "at": now_iso(),
    }
    if detail:
        payload["detail"] = detail
    if target:
        payload["target"] = target
    deliveries.append(payload)
    _save_state(state)
    return payload
