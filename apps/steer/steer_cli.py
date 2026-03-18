#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parent
VISION_HELPER = ROOT / "mac_vision.swift"
SNAPSHOT_DIR = Path("/tmp/steer-snapshots")


def fail(message: str, code: int = 1) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(code)


def run_cmd(args: list[str], *, check: bool = True, stdin: str | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, text=True, capture_output=True, check=check, input=stdin)


def run_cmd_no_check(args: list[str], *, stdin: str | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, text=True, capture_output=True, check=False, input=stdin)


def apple_script_quote(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


UI_ITEM_PREFIXES = [
    "application process",
    "progress indicator",
    "radio button",
    "pop up button",
    "static text",
    "splitter group",
    "scroll area",
    "tab group",
    "text field",
    "text area",
    "menu button",
    "UI element",
    "toolbar",
    "button",
    "group",
    "image",
    "window",
]

ROLE_PREFIXES = {
    "button": "B",
    "text field": "T",
    "text area": "T",
    "static text": "S",
    "image": "I",
    "checkbox": "C",
    "radio button": "R",
    "pop up button": "P",
    "slider": "SL",
    "link": "L",
    "menu item": "M",
    "menu bar item": "M",
    "tab button": "TB",
    "tab": "TB",
    "group": "E",
    "ui element": "E",
    "scroll area": "E",
    "toolbar": "E",
    "window": "W",
}


def ensure_snapshot_dir() -> None:
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)


def snapshot_path(snapshot_id: str) -> Path:
    return SNAPSHOT_DIR / f"{snapshot_id}.json"


def save_snapshot(payload: dict[str, object]) -> None:
    ensure_snapshot_dir()
    snapshot_path(str(payload["snapshotId"])).write_text(json.dumps(payload, indent=2), encoding="utf-8")


def load_snapshot(snapshot_id: str) -> dict[str, object]:
    path = snapshot_path(snapshot_id)
    if not path.exists():
        fail(f"Snapshot not found: {snapshot_id}")
    return json.loads(path.read_text(encoding="utf-8"))


def latest_snapshot() -> dict[str, object]:
    ensure_snapshot_dir()
    candidates = sorted(SNAPSHOT_DIR.glob("*.json"), key=lambda item: item.stat().st_mtime, reverse=True)
    if not candidates:
        fail("No steer snapshot available. Run `steer see` first.")
    return json.loads(candidates[0].read_text(encoding="utf-8"))


def osa(script: str) -> str:
    try:
        return run_cmd(["osascript", "-e", script]).stdout.strip()
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()
        if "-10827" in stderr:
            fail(
                "AppleScript access to System Events is unavailable in this context. "
                "Grant Automation/Accessibility permissions to your terminal and run outside restricted sandboxes."
            )
        if "-1719" in stderr:
            fail(
                "Assistive access is not granted for this terminal. "
                "Enable Accessibility for your terminal app in System Settings > Privacy & Security > Accessibility."
            )
        fail(stderr or "AppleScript command failed")


def osa_try(script: str) -> tuple[bool, str]:
    result = run_cmd_no_check(["osascript", "-e", script])
    if result.returncode == 0:
        return True, result.stdout.strip()
    return False, (result.stderr or "").strip()


def osa_lines(script: str) -> list[str]:
    out = osa(script)
    if not out:
        return []
    return [line for line in out.splitlines() if line.strip()]


def run_vision_helper(args: list[str]) -> dict[str, object]:
    if not VISION_HELPER.exists():
        fail(f"Vision helper is missing at {VISION_HELPER}")
    try:
        result = run_cmd(["swift", str(VISION_HELPER), *args])
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()
        fail(stderr or "Vision helper failed")
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        fail(f"Vision helper returned invalid JSON: {exc}")


def wait_until(timeout: float, interval: float, probe: Callable[[], dict[str, object]], timeout_message: str) -> dict[str, object]:
    deadline = time.time() + timeout
    last_result: dict[str, object] | None = None
    while True:
        last_result = probe()
        if last_result.get("matched"):
            return last_result
        if time.time() >= deadline:
            payload = {"ok": False, "matched": False, "timeout": timeout, "interval": interval}
            if last_result:
                payload["last"] = last_result
            fail(json.dumps({"error": timeout_message, **payload}))
        time.sleep(interval)


def cmd_apps() -> dict[str, object]:
    script = 'tell application "System Events" to get name of every process whose background only is false'
    frontmost = frontmost_app()
    items = []
    names = [name.strip() for name in osa(script).split(",") if name.strip()]
    for name in names:
        pid = app_pid(name)
        items.append({"name": name, "pid": pid, "frontmost": name == frontmost})
    return {"ok": True, "apps": items}


def cmd_screens() -> dict[str, object]:
    result = run_vision_helper(["screens"])
    result["ok"] = True
    return result


def get_screen(index: int) -> dict[str, object]:
    screens = cmd_screens().get("screens", [])
    if not isinstance(screens, list):
        fail("No screens available")
    for screen in screens:
        if int(screen.get("index", -1)) == index:
            return screen
    fail(f"Screen not found: {index}")


def translate_point_for_screen(x: float, y: float, screen: int | None) -> tuple[float, float]:
    if screen is None:
        return x, y
    target = get_screen(screen)
    return float(target["x"]) + x, float(target["y"]) + y


def parse_tuple_text(value: str) -> list[int]:
    parts = [part.strip().strip("{}") for part in value.split(",") if part.strip()]
    return [int(float(part)) for part in parts]


def parse_region(value: str | None) -> tuple[int, int, int, int] | None:
    if not value:
        return None
    parts = [part.strip() for part in value.split(",")]
    if len(parts) != 4:
        fail("--region must be x,y,width,height")
    try:
        x, y, width, height = [int(float(part)) for part in parts]
    except ValueError as exc:
        fail(f"invalid region: {exc}")
    if width <= 0 or height <= 0:
        fail("region width and height must be positive")
    return x, y, width, height


def cmd_focus(app: str) -> dict[str, object]:
    osa(f'tell application "{app}" to activate')
    return {"ok": True, "app": app}


def frontmost_app() -> str:
    return osa('tell application "System Events" to get name of first process whose frontmost is true')


def app_pid(app: str) -> int | None:
    result = run_cmd(["pgrep", "-x", app], check=False)
    if result.returncode != 0 or not result.stdout.strip():
        return None
    first = result.stdout.strip().splitlines()[0].strip()
    return int(first) if first.isdigit() else None


def get_window_bounds(app: str) -> dict[str, object]:
    script = f'''
    tell application "System Events"
      tell process "{app}"
        if (count of windows) is 0 then error "No windows available"
        set w to front window
        set p to position of w
        set s to size of w
        return ((name of w as text) & tab & (item 1 of p as text) & tab & (item 2 of p as text) & tab & (item 1 of s as text) & tab & (item 2 of s as text))
      end tell
    end tell
    '''
    last_error = f"No windows available for {app}"
    for _ in range(5):
        ok, output = osa_try(script)
        if ok:
            parts = output.split("\t")
            if len(parts) >= 5:
                return {
                    "name": parts[0],
                    "x": int(float(parts[1])),
                    "y": int(float(parts[2])),
                    "width": int(float(parts[3])),
                    "height": int(float(parts[4])),
                }
        last_error = output or last_error
        time.sleep(0.2)
    fail(last_error)


def split_ui_items(contents: str) -> list[str]:
    return [item.strip() for item in contents.split(", ") if item.strip()]


def parse_ui_item(item: str) -> tuple[str | None, str | None, str]:
    for prefix in UI_ITEM_PREFIXES:
        marker = f"{prefix} "
        if not item.startswith(marker):
            continue
        rest = item[len(marker) :]
        if " of " not in rest:
            return prefix, rest, item
        name, tail = rest.split(" of ", 1)
        return prefix, name, f"{prefix} {name} of {tail}"
    return None, None, item


def normalize_ui_role(role: str | None) -> str | None:
    if not role:
        return None
    value = role.strip()
    if value.startswith("AX") and len(value) > 2:
        spaced = re.sub(r"(?<!^)([A-Z])", r" \1", value[2:]).lower()
        return spaced
    return value.lower()


def build_ui_elements(contents: str) -> list[dict[str, object]]:
    counters: dict[str, int] = defaultdict(int)
    elements: list[dict[str, object]] = []
    for item in split_ui_items(contents):
        parsed_role, parsed_name, raw = parse_ui_item(item)
        if not parsed_name:
            continue
        normalized_role = normalize_ui_role(parsed_role)
        prefix = ROLE_PREFIXES.get(normalized_role or "", "E")
        counters[prefix] += 1
        label = parsed_name.strip()
        elements.append(
            {
                "id": f"{prefix}{counters[prefix]}",
                "source": "ui",
                "role": parsed_role,
                "label": label,
                "value": None,
                "specifier": raw,
            }
        )
    return elements


def cmd_ui_dump(app: str) -> dict[str, object]:
    script = f'''
    tell application "System Events"
      tell process "{app}"
        return entire contents of window 1
      end tell
    end tell
    '''
    contents = osa(script)
    return {"ok": True, "app": app, "contents": contents}


def build_snapshot(
    app: str | None,
    screenshot: str,
    *,
    region: tuple[int, int, int, int] | None = None,
    window_info: dict[str, object] | None = None,
    screen_index: int | None = None,
) -> dict[str, object]:
    active_app = app or frontmost_app()
    ui_contents = ""
    ui_elements: list[dict[str, object]] = []
    ok, output = osa_try(
        f'''
        tell application "System Events"
          tell process "{active_app}"
            if (count of windows) is 0 then return ""
            return entire contents of window 1
          end tell
        end tell
        '''
    )
    if ok and output:
        ui_contents = output
        ui_elements = build_ui_elements(ui_contents)
    snapshot_id = uuid.uuid4().hex[:8]
    payload = {
        "ok": True,
        "snapshotId": snapshot_id,
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "app": active_app,
        "screenshot": screenshot,
        "screen": screen_index,
        "region": list(region) if region else None,
        "window": window_info,
        "elements": ui_elements,
        "uiContents": ui_contents,
    }
    save_snapshot(payload)
    return payload


def cmd_see(
    app: str | None,
    *,
    window: bool = False,
    region: tuple[int, int, int, int] | None = None,
    screen: int | None = None,
) -> dict[str, object]:
    if app:
        cmd_focus(app)
        time.sleep(0.6)
    path = Path("/tmp") / f"steer-{int(time.time() * 1000)}.png"
    capture_region = region
    window_info = None
    args = ["screencapture", "-x"]
    if screen is not None:
        target = get_screen(screen)
        if capture_region:
            x, y, width, height = capture_region
            capture_region = (int(target["x"]) + x, int(target["y"]) + y, width, height)
        elif window:
            if not app:
                fail("--window requires --app")
            window_info = get_window_bounds(app)
            capture_region = (
                int(window_info["x"]),
                int(window_info["y"]),
                int(window_info["width"]),
                int(window_info["height"]),
            )
        else:
            capture_region = (int(target["x"]), int(target["y"]), int(target["width"]), int(target["height"]))
    elif window:
        if not app:
            fail("--window requires --app")
        window_info = get_window_bounds(app)
        capture_region = (
            int(window_info["x"]),
            int(window_info["y"]),
            int(window_info["width"]),
            int(window_info["height"]),
        )
    if capture_region:
        x, y, width, height = capture_region
        args.extend(["-R", f"{x},{y},{width},{height}"])
    args.append(str(path))
    run_cmd(args)
    payload = build_snapshot(app, str(path), region=capture_region, window_info=window_info, screen_index=screen)
    payload["ok"] = True
    return payload


def clear_focused_text() -> None:
    osa('tell application "System Events" to keystroke "a" using {command down}')
    time.sleep(0.05)
    osa('tell application "System Events" to key code 51')


def cmd_type(text: str, into: str | None, clear: bool) -> dict[str, object]:
    clicked = None
    if into:
        clicked = resolve_and_activate_target(into)
        time.sleep(0.15)
    if clear:
        clear_focused_text()
        time.sleep(0.05)
    escaped = apple_script_quote(text)
    osa(f'tell application "System Events" to keystroke "{escaped}"')
    return {"ok": True, "typed": len(text), "into": clicked["id"] if clicked else None, "cleared": clear}


def cmd_hotkey(key: str, modifiers: list[str]) -> dict[str, object]:
    allowed = {"command", "control", "option", "shift"}
    mods = [m for m in modifiers if m in allowed]
    if mods:
        mod_text = ", ".join(f"{m} down" for m in mods)
        osa(f'tell application "System Events" to keystroke "{key}" using {{{mod_text}}}')
    else:
        osa(f'tell application "System Events" to keystroke "{key}"')
    return {"ok": True, "key": key, "modifiers": mods}


def cmd_open_url(url: str, app: str | None) -> dict[str, object]:
    if app:
        run_cmd(["open", "-a", app, url])
    else:
        run_cmd(["open", url])
    return {"ok": True, "url": url, "app": app}


def cmd_safari_current_url() -> dict[str, object]:
    url = osa('tell application "Safari" to get URL of front document')
    return {"ok": True, "app": "Safari", "url": url}


def cmd_safari_reload() -> dict[str, object]:
    osa('tell application "Safari" to activate')
    osa('tell application "System Events" to keystroke "r" using {command down}')
    return {"ok": True, "app": "Safari", "action": "reload"}


def cmd_safari_focus_location() -> dict[str, object]:
    osa('tell application "Safari" to activate')
    osa('tell application "System Events" to keystroke "l" using {command down}')
    return {"ok": True, "app": "Safari", "action": "focus-location"}


def cmd_safari_go_back() -> dict[str, object]:
    osa('tell application "Safari" to activate')
    osa('tell application "System Events" to key code 123 using {command down}')
    return {"ok": True, "app": "Safari", "action": "go-back"}


def cmd_safari_go_forward() -> dict[str, object]:
    osa('tell application "Safari" to activate')
    osa('tell application "System Events" to key code 124 using {command down}')
    return {"ok": True, "app": "Safari", "action": "go-forward"}


def cmd_safari_wait_url(url: str, contains: bool, timeout: float, interval: float) -> dict[str, object]:
    def probe() -> dict[str, object]:
        current = cmd_safari_current_url()
        current_url = str(current["url"])
        matched = url in current_url if contains else current_url == url
        return {
            "ok": True,
            "matched": matched,
            "app": "Safari",
            "url": current_url,
            "expected": url,
            "contains": contains,
        }

    return wait_until(timeout, interval, probe, f"Timed out waiting for Safari URL: {url}")


def ui_item_matches(item: str, name: str, contains: bool, role: str | None) -> tuple[str | None, str | None, str] | None:
    parsed_role, parsed_name, _ = parse_ui_item(item)
    if not parsed_name:
        return None
    if role and (parsed_role or "").lower() != normalize_ui_role(role):
        return None
    if contains:
        if name not in parsed_name:
            return None
    elif parsed_name != name:
        return None
    return parsed_role, parsed_name, item


def apple_script_specifier(item: str) -> str:
    item = re.sub(r" of application process .+$", "", item)
    parts = item.split(" of ")
    rendered = []
    for part in parts:
        role, name, _ = parse_ui_item(part)
        if not role or not name or name.isdigit():
            rendered.append(part)
            continue
        rendered.append(f'{role} "{apple_script_quote(name)}"')
    return " of ".join(rendered)


def cmd_ui_find(app: str, name: str, contains: bool, role: str | None) -> dict[str, object]:
    contents = str(cmd_ui_dump(app)["contents"])
    matches = []
    for item in split_ui_items(contents):
        match = ui_item_matches(item, name, contains, role)
        if not match:
            continue
        parsed_role, parsed_name, raw = match
        matches.append({"name": parsed_name, "role": parsed_role, "specifier": raw})
    return {"ok": True, "app": app, "matches": matches}


def cmd_ui_click(app: str, name: str, contains: bool, role: str | None) -> dict[str, object]:
    matches = cmd_ui_find(app, name, contains, role)["matches"]
    if not matches:
        fail("No matching UI element found")
    selected = matches[0]
    specifier = apple_script_specifier(str(selected["specifier"]))
    app_escaped = apple_script_quote(app)
    script = f'''
    tell application "{app_escaped}" to activate
    tell application "System Events"
      tell process "{app_escaped}"
        click {specifier}
        return "{apple_script_quote(str(selected["name"]))}" & tab & "{apple_script_quote(str(selected["role"]))}"
      end tell
    end tell
    '''
    result = osa(script).split("\t")
    return {
        "ok": True,
        "app": app,
        "clicked": {
            "name": result[0] if result else selected["name"],
            "role": result[1] if len(result) > 1 else selected["role"],
        },
    }


def cmd_ui_wait(app: str, name: str, contains: bool, role: str | None, timeout: float, interval: float) -> dict[str, object]:
    def probe() -> dict[str, object]:
        found = cmd_ui_find(app, name, contains, role)
        matches = found["matches"]
        return {
            "ok": True,
            "matched": bool(matches),
            "app": app,
            "name": name,
            "contains": contains,
            "role": role,
            "matches": matches,
        }

    return wait_until(timeout, interval, probe, f"Timed out waiting for UI element: {name}")


def find_snapshot_elements(query: str, exact: bool, snapshot_id: str | None) -> dict[str, object]:
    snapshot = load_snapshot(snapshot_id) if snapshot_id else latest_snapshot()
    needle = query.casefold()
    matches = []
    for element in snapshot.get("elements", []):
        label = str(element.get("label") or "")
        value = str(element.get("value") or "")
        haystacks = [label.casefold(), value.casefold()]
        matched = any(item == needle for item in haystacks) if exact else any(needle in item for item in haystacks)
        if matched:
            matches.append(element)
    return {"ok": True, "snapshotId": snapshot["snapshotId"], "query": query, "count": len(matches), "matches": matches}


def text_matches(candidate: str, query: str, contains: bool) -> bool:
    lhs = candidate.casefold()
    rhs = query.casefold()
    if contains and rhs in lhs:
        return True
    if not contains and lhs == rhs:
        return True

    def normalized(value: str) -> str:
        cleaned = value.casefold().replace("’", "'").replace("“", '"').replace("”", '"')
        cleaned = re.sub(r"[^a-z0-9]+", " ", cleaned)
        return " ".join(cleaned.split())

    lhs_norm = normalized(candidate)
    rhs_norm = normalized(query)
    if contains:
        return rhs_norm in lhs_norm
    return lhs_norm == rhs_norm


def cmd_click_coords(x: float, y: float, clicks: int, screen: int | None, button: str) -> dict[str, object]:
    tx, ty = translate_point_for_screen(x, y, screen)
    return run_vision_helper(["click", "--x", str(tx), "--y", str(ty), "--clicks", str(clicks), "--button", button])


def resolve_snapshot_target(target: str, snapshot_id: str | None) -> tuple[dict[str, object], dict[str, object]]:
    snapshot = load_snapshot(snapshot_id) if snapshot_id else latest_snapshot()
    elements = snapshot.get("elements", [])
    if not isinstance(elements, list):
        fail("Snapshot has no elements")
    for element in elements:
        if str(element.get("id")) == target:
            return snapshot, element
    matches = [element for element in elements if str(element.get("label") or "") == target]
    if matches:
        return snapshot, matches[0]
    fail(f"Snapshot target not found: {target}")


def resolve_and_activate_target(target: str, snapshot_id: str | None = None) -> dict[str, object]:
    snapshot, element = resolve_snapshot_target(target, snapshot_id)
    if snapshot.get("app"):
        cmd_focus(str(snapshot["app"]))
        time.sleep(0.15)
    if str(element.get("source")) == "ui":
        specifier = apple_script_specifier(str(element["specifier"]))
        app_name = apple_script_quote(str(snapshot["app"]))
        osa(
            f'''
            tell application "{app_name}" to activate
            tell application "System Events"
              tell process "{app_name}"
                click {specifier}
              end tell
            end tell
            '''
        )
        return element
    if str(element.get("source")) == "ocr":
        box = element.get("box", {})
        x = float(box.get("screenCenterX", box.get("centerX", 0.0)))
        y = float(box.get("screenCenterY", box.get("centerY", 0.0)))
        cmd_click_coords(x, y, 1, None, "left")
        return element
    fail(f"Unsupported snapshot element source: {element.get('source')}")


def cmd_click(
    x: float | None,
    y: float | None,
    clicks: int,
    *,
    screen: int | None = None,
    button: str = "left",
    target: str | None = None,
    snapshot_id: str | None = None,
) -> dict[str, object]:
    if target:
        element = resolve_and_activate_target(target, snapshot_id)
        return {"ok": True, "target": element}
    if x is None or y is None:
        fail("click requires --x/--y or --on")
    return cmd_click_coords(x, y, clicks, screen, button)


def cmd_drag(from_x: float, from_y: float, to_x: float, to_y: float, steps: int, screen: int | None) -> dict[str, object]:
    start_x, start_y = translate_point_for_screen(from_x, from_y, screen)
    end_x, end_y = translate_point_for_screen(to_x, to_y, screen)
    return run_vision_helper(
        [
            "drag",
            "--from-x",
            str(start_x),
            "--from-y",
            str(start_y),
            "--to-x",
            str(end_x),
            "--to-y",
            str(end_y),
            "--steps",
            str(steps),
        ]
    )


def cmd_scroll(direction: str, amount: int) -> dict[str, object]:
    return run_vision_helper(["scroll", "--direction", direction, "--amount", str(amount)])


def cmd_ocr(
    app: str | None,
    image: str | None,
    text: str | None,
    contains: bool,
    *,
    window: bool = False,
    region: tuple[int, int, int, int] | None = None,
    screen: int | None = None,
    store: bool = False,
) -> dict[str, object]:
    screenshot = None
    offset = [0.0, 0.0]
    if image:
        target_image = image
    else:
        capture = cmd_see(app, window=window, region=region, screen=screen)
        screenshot = capture["screenshot"]
        target_image = str(screenshot)
        if capture.get("region"):
            capture_region = list(capture["region"])
            offset = [float(capture_region[0]), float(capture_region[1])]
    result = run_vision_helper(["ocr", "--image", target_image])
    matches = result.get("matches", [])
    if text:
        matches = [match for match in matches if text_matches(str(match.get("text", "")), text, contains)]
    adjusted_matches = []
    counters: dict[str, int] = defaultdict(int)
    for match in matches:
        updated = dict(match)
        box = dict(updated.get("box", {}))
        box["screenLeft"] = float(box.get("left", 0.0)) + offset[0]
        box["screenTop"] = float(box.get("top", 0.0)) + offset[1]
        box["screenCenterX"] = float(box.get("centerX", 0.0)) + offset[0]
        box["screenCenterY"] = float(box.get("centerY", 0.0)) + offset[1]
        updated["box"] = box
        counters["S"] += 1
        updated["id"] = f"S{counters['S']}"
        updated["source"] = "ocr"
        adjusted_matches.append(updated)
    payload = {
        "ok": True,
        "app": app or result.get("app"),
        "image": result.get("image"),
        "width": result.get("width"),
        "height": result.get("height"),
        "matches": adjusted_matches,
    }
    if screenshot:
        payload["screenshot"] = screenshot
    if offset != [0.0, 0.0]:
        payload["offset"] = offset
    if store:
        snapshot_id = uuid.uuid4().hex[:8]
        snapshot = {
            "ok": True,
            "snapshotId": snapshot_id,
            "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "app": app or frontmost_app(),
            "screenshot": payload.get("screenshot") or payload.get("image"),
            "screen": screen,
            "region": payload.get("offset"),
            "window": None,
            "elements": [
                {
                    "id": match["id"],
                    "source": "ocr",
                    "role": "static text",
                    "label": match["text"],
                    "value": None,
                    "box": match["box"],
                }
                for match in adjusted_matches
            ],
            "uiContents": "",
        }
        save_snapshot(snapshot)
        payload["snapshotId"] = snapshot_id
    return payload


def cmd_ocr_click(
    app: str | None,
    text: str,
    contains: bool,
    clicks: int,
    *,
    window: bool = False,
    region: tuple[int, int, int, int] | None = None,
    screen: int | None = None,
) -> dict[str, object]:
    result = cmd_ocr(app, None, text, contains, window=window, region=region, screen=screen)
    matches = result.get("matches", [])
    if not matches:
        fail("No OCR text match found")
    match = matches[0]
    box = match.get("box", {})
    x = float(box.get("screenCenterX", box.get("centerX", 0.0)))
    y = float(box.get("screenCenterY", box.get("centerY", 0.0)))
    click_result = cmd_click_coords(x, y, clicks, None, "left")
    return {
        "ok": True,
        "app": app,
        "image": result.get("image"),
        "match": match,
        "click": click_result,
    }


def cmd_ocr_wait(
    app: str | None,
    image: str | None,
    text: str,
    contains: bool,
    timeout: float,
    interval: float,
    *,
    window: bool = False,
    region: tuple[int, int, int, int] | None = None,
    screen: int | None = None,
) -> dict[str, object]:
    def probe() -> dict[str, object]:
        result = cmd_ocr(app, image, text, contains, window=window, region=region, screen=screen)
        matches = result.get("matches", [])
        return {
            "ok": True,
            "matched": bool(matches),
            "app": app,
            "text": text,
            "contains": contains,
            "matches": matches,
            "image": result.get("image"),
            "screenshot": result.get("screenshot"),
        }

    return wait_until(timeout, interval, probe, f"Timed out waiting for OCR text: {text}")


def cmd_window_list(app: str) -> dict[str, object]:
    script = f'''
    tell application "System Events"
      tell process "{app}"
        set outLines to {{}}
        repeat with w in windows
          set p to position of w
          set s to size of w
          set minimizedFlag to false
          try
            set minimizedFlag to value of attribute "AXMinimized" of w
          end try
          set end of outLines to ((name of w as text) & tab & (item 1 of p as text) & tab & (item 2 of p as text) & tab & (item 1 of s as text) & tab & (item 2 of s as text) & tab & (minimizedFlag as text))
        end repeat
        return outLines as text
      end tell
    end tell
    '''
    windows = []
    for line in osa_lines(script):
        parts = line.split("\t")
        if len(parts) < 6:
            continue
        windows.append(
            {
                "name": parts[0],
                "x": int(float(parts[1])),
                "y": int(float(parts[2])),
                "width": int(float(parts[3])),
                "height": int(float(parts[4])),
                "minimized": parts[5].strip().lower() == "true",
            }
        )
    return {"ok": True, "app": app, "windows": windows}


def cmd_window_move(app: str, x: int, y: int) -> dict[str, object]:
    osa(
        f'''
        tell application "{app}" to activate
        tell application "System Events"
          tell process "{app}"
            if (count of windows) is 0 then error "No windows available"
            set position of front window to {{{x}, {y}}}
          end tell
        end tell
        '''
    )
    return {"ok": True, "app": app, "position": [x, y]}


def cmd_window_resize(app: str, width: int, height: int) -> dict[str, object]:
    osa(
        f'''
        tell application "{app}" to activate
        tell application "System Events"
          tell process "{app}"
            if (count of windows) is 0 then error "No windows available"
            set size of front window to {{{width}, {height}}}
          end tell
        end tell
        '''
    )
    return {"ok": True, "app": app, "size": [width, height]}


def cmd_window_set(app: str, x: int, y: int, width: int, height: int) -> dict[str, object]:
    cmd_window_move(app, x, y)
    cmd_window_resize(app, width, height)
    return {"ok": True, "app": app, "position": [x, y], "size": [width, height]}


def cmd_window_minimize(app: str, flag: bool) -> dict[str, object]:
    osa(
        f'''
        tell application "{app}" to activate
        tell application "System Events"
          tell process "{app}"
            if (count of windows) is 0 then error "No windows available"
            set value of attribute "AXMinimized" of front window to {str(flag).lower()}
          end tell
        end tell
        '''
    )
    return {"ok": True, "app": app, "minimized": flag}


def cmd_window_fullscreen(app: str) -> dict[str, object]:
    osa(
        f'''
        tell application "{app}" to activate
        tell application "System Events"
          tell process "{app}"
            if (count of windows) is 0 then error "No windows available"
            try
              set currentState to value of attribute "AXFullScreen" of front window
              set value of attribute "AXFullScreen" of front window to (not currentState)
            on error
              click value of attribute "AXZoomButton" of front window
            end try
          end tell
        end tell
        '''
    )
    return {"ok": True, "app": app, "action": "fullscreen-toggle"}


def cmd_window_close(app: str) -> dict[str, object]:
    osa(
        f'''
        tell application "{app}" to activate
        tell application "System Events"
          tell process "{app}"
            if (count of windows) is 0 then error "No windows available"
            click value of attribute "AXCloseButton" of front window
          end tell
        end tell
        '''
    )
    return {"ok": True, "app": app, "action": "close"}


def cmd_clipboard_read(image: bool) -> dict[str, object]:
    if image:
        payload = run_vision_helper(["clipboard-read-image"])
        payload["ok"] = True
        return payload
    result = run_cmd(["pbpaste"], check=False)
    return {"ok": True, "type": "text", "text": result.stdout}


def cmd_clipboard_write(text: str | None, image: str | None) -> dict[str, object]:
    if image:
        payload = run_vision_helper(["clipboard-write-image", "--image", image])
        payload["ok"] = True
        return payload
    run_cmd(["pbcopy"], stdin=text or "")
    return {"ok": True, "type": "text", "written": len(text or "")}


def cmd_textedit_new(text: str | None) -> dict[str, object]:
    body = apple_script_quote(text or "")
    script = f'''
    tell application "TextEdit"
      activate
      set docRef to make new document
      set text of docRef to "{body}"
    end tell
    '''
    osa(script)
    return {"ok": True, "app": "TextEdit"}


def cmd_textedit_set(text: str) -> dict[str, object]:
    body = apple_script_quote(text)
    script = f'''
    tell application "TextEdit"
      activate
      if not (exists document 1) then
        make new document
      end if
      set text of document 1 to "{body}"
    end tell
    '''
    osa(script)
    return {"ok": True, "app": "TextEdit"}


def cmd_notes_create(title: str, body: str) -> dict[str, object]:
    title_escaped = apple_script_quote(title)
    body_escaped = apple_script_quote(body)
    script = f'''
    tell application "Notes"
      activate
      tell account "iCloud"
        if not (exists folder "Notes") then
          make new folder with properties {{name:"Notes"}}
        end if
        tell folder "Notes"
          make new note with properties {{name:"{title_escaped}", body:"{body_escaped}"}}
        end tell
      end tell
    end tell
    '''
    osa(script)
    return {"ok": True, "app": "Notes", "title": title}


def cmd_messages_send(recipient: str, text: str) -> dict[str, object]:
    recipient_escaped = apple_script_quote(recipient)
    text_escaped = apple_script_quote(text)
    script = f'''
    tell application "Messages"
      activate
      set targetService to 1st service whose service type = iMessage
      set targetBuddy to buddy "{recipient_escaped}" of targetService
      send "{text_escaped}" to targetBuddy
    end tell
    '''
    osa(script)
    return {"ok": True, "app": "Messages", "recipient": recipient}


def cmd_mail_draft(to: str, subject: str, body: str) -> dict[str, object]:
    to_escaped = apple_script_quote(to)
    subject_escaped = apple_script_quote(subject)
    body_escaped = apple_script_quote(body)
    script = f'''
    tell application "Mail"
      activate
      set draftMessage to make new outgoing message with properties {{subject:"{subject_escaped}", content:"{body_escaped}" & return & return}}
      tell draftMessage
        make new to recipient at end of to recipients with properties {{address:"{to_escaped}"}}
        set visible to true
      end tell
    end tell
    '''
    osa(script)
    return {"ok": True, "app": "Mail", "to": to, "subject": subject}


def print_result(data: dict[str, object], as_json: bool) -> None:
    if as_json:
        print(json.dumps(data, indent=2))
    else:
        print(json.dumps(data, indent=2))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="steer", description="macOS automation for OpenClaw")
    sub = parser.add_subparsers(dest="command", required=True)

    apps = sub.add_parser("apps")
    apps.add_argument("--json", action="store_true")

    screens = sub.add_parser("screens")
    screens.add_argument("--json", action="store_true")

    focus = sub.add_parser("focus")
    focus.add_argument("--app", required=True)
    focus.add_argument("--json", action="store_true")

    see = sub.add_parser("see")
    see.add_argument("--app")
    see.add_argument("--window", action="store_true")
    see.add_argument("--region")
    see.add_argument("--screen", type=int)
    see.add_argument("--json", action="store_true")

    find = sub.add_parser("find")
    find.add_argument("query")
    find.add_argument("--snapshot")
    find.add_argument("--exact", action="store_true")
    find.add_argument("--json", action="store_true")

    type_cmd = sub.add_parser("type")
    type_cmd.add_argument("text")
    type_cmd.add_argument("--into")
    type_cmd.add_argument("--clear", action="store_true")
    type_cmd.add_argument("--json", action="store_true")

    hotkey = sub.add_parser("hotkey")
    hotkey.add_argument("--key", required=True)
    hotkey.add_argument("--modifiers", default="")
    hotkey.add_argument("--json", action="store_true")

    open_url = sub.add_parser("open-url")
    open_url.add_argument("--url", required=True)
    open_url.add_argument("--app")
    open_url.add_argument("--json", action="store_true")

    click = sub.add_parser("click")
    click.add_argument("--x", type=float)
    click.add_argument("--y", type=float)
    click.add_argument("--on")
    click.add_argument("--snapshot")
    click.add_argument("--clicks", type=int, default=1)
    click.add_argument("--double", action="store_true")
    click.add_argument("--right", action="store_true")
    click.add_argument("--screen", type=int)
    click.add_argument("--json", action="store_true")

    drag = sub.add_parser("drag")
    drag.add_argument("--from-x", type=float, required=True)
    drag.add_argument("--from-y", type=float, required=True)
    drag.add_argument("--to-x", type=float, required=True)
    drag.add_argument("--to-y", type=float, required=True)
    drag.add_argument("--steps", type=int, default=24)
    drag.add_argument("--screen", type=int)
    drag.add_argument("--json", action="store_true")

    scroll = sub.add_parser("scroll")
    scroll.add_argument("direction", choices=["up", "down", "left", "right"])
    scroll.add_argument("amount", type=int)
    scroll.add_argument("--json", action="store_true")

    ocr = sub.add_parser("ocr")
    ocr.add_argument("--app")
    ocr.add_argument("--image")
    ocr.add_argument("--text")
    ocr.add_argument("--contains", action="store_true")
    ocr.add_argument("--window", action="store_true")
    ocr.add_argument("--region")
    ocr.add_argument("--screen", type=int)
    ocr.add_argument("--store", action="store_true")
    ocr.add_argument("--json", action="store_true")

    ocr_click = sub.add_parser("ocr-click")
    ocr_click.add_argument("--app")
    ocr_click.add_argument("--text", required=True)
    ocr_click.add_argument("--contains", action="store_true")
    ocr_click.add_argument("--clicks", type=int, default=1)
    ocr_click.add_argument("--window", action="store_true")
    ocr_click.add_argument("--region")
    ocr_click.add_argument("--screen", type=int)
    ocr_click.add_argument("--json", action="store_true")

    wait_cmd = sub.add_parser("wait")
    wait_sub = wait_cmd.add_subparsers(dest="wait_command", required=True)

    wait_text = wait_sub.add_parser("text")
    wait_text.add_argument("--app")
    wait_text.add_argument("--image")
    wait_text.add_argument("--text", required=True)
    wait_text.add_argument("--contains", action="store_true")
    wait_text.add_argument("--window", action="store_true")
    wait_text.add_argument("--region")
    wait_text.add_argument("--screen", type=int)
    wait_text.add_argument("--timeout", type=float, default=10.0)
    wait_text.add_argument("--interval", type=float, default=0.75)
    wait_text.add_argument("--json", action="store_true")

    wait_ui = wait_sub.add_parser("ui")
    wait_ui.add_argument("--app", required=True)
    wait_ui.add_argument("--name", required=True)
    wait_ui.add_argument("--contains", action="store_true")
    wait_ui.add_argument("--role")
    wait_ui.add_argument("--timeout", type=float, default=10.0)
    wait_ui.add_argument("--interval", type=float, default=0.75)
    wait_ui.add_argument("--json", action="store_true")

    wait_url = wait_sub.add_parser("url")
    wait_url.add_argument("--url", required=True)
    wait_url.add_argument("--contains", action="store_true")
    wait_url.add_argument("--timeout", type=float, default=10.0)
    wait_url.add_argument("--interval", type=float, default=0.75)
    wait_url.add_argument("--json", action="store_true")

    safari = sub.add_parser("safari")
    safari_sub = safari.add_subparsers(dest="safari_command", required=True)
    safari_current_url = safari_sub.add_parser("current-url")
    safari_current_url.add_argument("--json", action="store_true")
    safari_reload = safari_sub.add_parser("reload")
    safari_reload.add_argument("--json", action="store_true")
    safari_focus_location = safari_sub.add_parser("focus-location")
    safari_focus_location.add_argument("--json", action="store_true")
    safari_go_back = safari_sub.add_parser("go-back")
    safari_go_back.add_argument("--json", action="store_true")
    safari_go_forward = safari_sub.add_parser("go-forward")
    safari_go_forward.add_argument("--json", action="store_true")

    ui = sub.add_parser("ui")
    ui_sub = ui.add_subparsers(dest="ui_command", required=True)
    ui_dump = ui_sub.add_parser("dump")
    ui_dump.add_argument("--app", required=True)
    ui_dump.add_argument("--json", action="store_true")
    ui_find = ui_sub.add_parser("find")
    ui_find.add_argument("--app", required=True)
    ui_find.add_argument("--name", required=True)
    ui_find.add_argument("--contains", action="store_true")
    ui_find.add_argument("--role")
    ui_find.add_argument("--json", action="store_true")
    ui_click = ui_sub.add_parser("click")
    ui_click.add_argument("--app", required=True)
    ui_click.add_argument("--name", required=True)
    ui_click.add_argument("--contains", action="store_true")
    ui_click.add_argument("--role")
    ui_click.add_argument("--json", action="store_true")

    window_cmd = sub.add_parser("window")
    window_sub = window_cmd.add_subparsers(dest="window_command", required=True)
    window_list = window_sub.add_parser("list")
    window_list.add_argument("--app", required=True)
    window_list.add_argument("--json", action="store_true")
    window_set = window_sub.add_parser("set")
    window_set.add_argument("--app", required=True)
    window_set.add_argument("--x", type=int, required=True)
    window_set.add_argument("--y", type=int, required=True)
    window_set.add_argument("--width", type=int, required=True)
    window_set.add_argument("--height", type=int, required=True)
    window_set.add_argument("--json", action="store_true")
    window_move = window_sub.add_parser("move")
    window_move.add_argument("--app", required=True)
    window_move.add_argument("--x", type=int, required=True)
    window_move.add_argument("--y", type=int, required=True)
    window_move.add_argument("--json", action="store_true")
    window_resize = window_sub.add_parser("resize")
    window_resize.add_argument("--app", required=True)
    window_resize.add_argument("--width", type=int, required=True)
    window_resize.add_argument("--height", type=int, required=True)
    window_resize.add_argument("--json", action="store_true")
    window_minimize = window_sub.add_parser("minimize")
    window_minimize.add_argument("--app", required=True)
    window_minimize.add_argument("--restore", action="store_true")
    window_minimize.add_argument("--json", action="store_true")
    window_fullscreen = window_sub.add_parser("fullscreen")
    window_fullscreen.add_argument("--app", required=True)
    window_fullscreen.add_argument("--json", action="store_true")
    window_close = window_sub.add_parser("close")
    window_close.add_argument("--app", required=True)
    window_close.add_argument("--json", action="store_true")

    clipboard = sub.add_parser("clipboard")
    clipboard_sub = clipboard.add_subparsers(dest="clipboard_command", required=True)
    clipboard_read = clipboard_sub.add_parser("read")
    clipboard_read.add_argument("--image", action="store_true")
    clipboard_read.add_argument("--json", action="store_true")
    clipboard_write = clipboard_sub.add_parser("write")
    clipboard_write.add_argument("--text")
    clipboard_write.add_argument("--image")
    clipboard_write.add_argument("--json", action="store_true")

    textedit = sub.add_parser("textedit")
    textedit_sub = textedit.add_subparsers(dest="textedit_command", required=True)
    textedit_new = textedit_sub.add_parser("new")
    textedit_new.add_argument("--text")
    textedit_new.add_argument("--json", action="store_true")
    textedit_set = textedit_sub.add_parser("set-text")
    textedit_set.add_argument("--text", required=True)
    textedit_set.add_argument("--json", action="store_true")

    notes = sub.add_parser("notes")
    notes_sub = notes.add_subparsers(dest="notes_command", required=True)
    notes_create = notes_sub.add_parser("create")
    notes_create.add_argument("--title", required=True)
    notes_create.add_argument("--body", required=True)
    notes_create.add_argument("--json", action="store_true")

    messages = sub.add_parser("messages")
    messages_sub = messages.add_subparsers(dest="messages_command", required=True)
    messages_send = messages_sub.add_parser("send")
    messages_send.add_argument("--recipient", required=True)
    messages_send.add_argument("--text", required=True)
    messages_send.add_argument("--json", action="store_true")

    mail = sub.add_parser("mail")
    mail_sub = mail.add_subparsers(dest="mail_command", required=True)
    mail_draft = mail_sub.add_parser("draft")
    mail_draft.add_argument("--to", required=True)
    mail_draft.add_argument("--subject", required=True)
    mail_draft.add_argument("--body", required=True)
    mail_draft.add_argument("--json", action="store_true")

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "apps":
        print_result(cmd_apps(), args.json)
        return
    if args.command == "screens":
        print_result(cmd_screens(), args.json)
        return
    if args.command == "focus":
        print_result(cmd_focus(args.app), args.json)
        return
    if args.command == "see":
        print_result(cmd_see(args.app, window=args.window, region=parse_region(args.region), screen=args.screen), args.json)
        return
    if args.command == "find":
        print_result(find_snapshot_elements(args.query, args.exact, args.snapshot), args.json)
        return
    if args.command == "type":
        print_result(cmd_type(args.text, args.into, args.clear), args.json)
        return
    if args.command == "hotkey":
        modifiers = [item.strip() for item in args.modifiers.split(",") if item.strip()]
        print_result(cmd_hotkey(args.key, modifiers), args.json)
        return
    if args.command == "open-url":
        print_result(cmd_open_url(args.url, args.app), args.json)
        return
    if args.command == "click":
        clicks = 2 if args.double else args.clicks
        button = "right" if args.right else "left"
        print_result(cmd_click(args.x, args.y, clicks, screen=args.screen, button=button, target=args.on, snapshot_id=args.snapshot), args.json)
        return
    if args.command == "drag":
        print_result(cmd_drag(args.from_x, args.from_y, args.to_x, args.to_y, args.steps, args.screen), args.json)
        return
    if args.command == "scroll":
        print_result(cmd_scroll(args.direction, args.amount), args.json)
        return
    if args.command == "ocr":
        print_result(
            cmd_ocr(args.app, args.image, args.text, args.contains, window=args.window, region=parse_region(args.region), screen=args.screen, store=args.store),
            args.json,
        )
        return
    if args.command == "ocr-click":
        print_result(
            cmd_ocr_click(args.app, args.text, args.contains, args.clicks, window=args.window, region=parse_region(args.region), screen=args.screen),
            args.json,
        )
        return
    if args.command == "wait":
        if args.wait_command == "text":
            print_result(
                cmd_ocr_wait(
                    args.app,
                    args.image,
                    args.text,
                    args.contains,
                    args.timeout,
                    args.interval,
                    window=args.window,
                    region=parse_region(args.region),
                    screen=args.screen,
                ),
                args.json,
            )
            return
        if args.wait_command == "ui":
            print_result(cmd_ui_wait(args.app, args.name, args.contains, args.role, args.timeout, args.interval), args.json)
            return
        if args.wait_command == "url":
            print_result(cmd_safari_wait_url(args.url, args.contains, args.timeout, args.interval), args.json)
            return
    if args.command == "safari":
        if args.safari_command == "current-url":
            print_result(cmd_safari_current_url(), args.json)
            return
        if args.safari_command == "reload":
            print_result(cmd_safari_reload(), args.json)
            return
        if args.safari_command == "focus-location":
            print_result(cmd_safari_focus_location(), args.json)
            return
        if args.safari_command == "go-back":
            print_result(cmd_safari_go_back(), args.json)
            return
        if args.safari_command == "go-forward":
            print_result(cmd_safari_go_forward(), args.json)
            return
    if args.command == "ui":
        if args.ui_command == "dump":
            print_result(cmd_ui_dump(args.app), args.json)
            return
        if args.ui_command == "find":
            print_result(cmd_ui_find(args.app, args.name, args.contains, args.role), args.json)
            return
        if args.ui_command == "click":
            print_result(cmd_ui_click(args.app, args.name, args.contains, args.role), args.json)
            return
    if args.command == "window":
        if args.window_command == "list":
            print_result(cmd_window_list(args.app), args.json)
            return
        if args.window_command == "set":
            print_result(cmd_window_set(args.app, args.x, args.y, args.width, args.height), args.json)
            return
        if args.window_command == "move":
            print_result(cmd_window_move(args.app, args.x, args.y), args.json)
            return
        if args.window_command == "resize":
            print_result(cmd_window_resize(args.app, args.width, args.height), args.json)
            return
        if args.window_command == "minimize":
            print_result(cmd_window_minimize(args.app, not args.restore), args.json)
            return
        if args.window_command == "fullscreen":
            print_result(cmd_window_fullscreen(args.app), args.json)
            return
        if args.window_command == "close":
            print_result(cmd_window_close(args.app), args.json)
            return
    if args.command == "clipboard":
        if args.clipboard_command == "read":
            print_result(cmd_clipboard_read(args.image), args.json)
            return
        if args.clipboard_command == "write":
            print_result(cmd_clipboard_write(args.text, args.image), args.json)
            return
    if args.command == "textedit":
        if args.textedit_command == "new":
            print_result(cmd_textedit_new(args.text), args.json)
            return
        if args.textedit_command == "set-text":
            print_result(cmd_textedit_set(args.text), args.json)
            return
    if args.command == "notes":
        if args.notes_command == "create":
            print_result(cmd_notes_create(args.title, args.body), args.json)
            return
    if args.command == "messages":
        if args.messages_command == "send":
            print_result(cmd_messages_send(args.recipient, args.text), args.json)
            return
    if args.command == "mail":
        if args.mail_command == "draft":
            print_result(cmd_mail_draft(args.to, args.subject, args.body), args.json)
            return


if __name__ == "__main__":
    main()
