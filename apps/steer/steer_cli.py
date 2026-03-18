#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path


def fail(message: str, code: int = 1) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(code)


def run_cmd(args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, text=True, capture_output=True, check=check)


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


def osa_lines(script: str) -> list[str]:
    out = osa(script)
    if not out:
        return []
    return [line for line in out.splitlines() if line.strip()]


def cmd_apps() -> dict[str, object]:
    script = 'tell application "System Events" to get name of every process whose background only is false'
    frontmost = frontmost_app()
    items = []
    names = [name.strip() for name in osa(script).split(",") if name.strip()]
    for name in names:
        pid = app_pid(name)
        items.append({"name": name, "pid": pid, "frontmost": name == frontmost})
    return {"ok": True, "apps": items}


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


def cmd_see(app: str | None) -> dict[str, object]:
    if app:
        cmd_focus(app)
        time.sleep(0.3)
    path = Path(tempfile.gettempdir()) / f"steer-{int(time.time() * 1000)}.png"
    run_cmd(["screencapture", "-x", str(path)])
    return {"ok": True, "app": frontmost_app(), "screenshot": str(path)}


def cmd_type(text: str) -> dict[str, object]:
    escaped = apple_script_quote(text)
    osa(f'tell application "System Events" to keystroke "{escaped}"')
    return {"ok": True, "typed": len(text)}


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
    contents = cmd_ui_dump(app)["contents"]
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


def cmd_window_list(app: str) -> dict[str, object]:
    script = f'''
    tell application "System Events"
      tell process "{app}"
        set outLines to {{}}
        repeat with w in windows
          set end of outLines to ((name of w as text) & tab & (position of w as text) & tab & (size of w as text))
        end repeat
        return outLines as text
      end tell
    end tell
    '''
    windows = []
    for line in osa_lines(script):
        parts = line.split("\t")
        if len(parts) < 3:
            continue
        windows.append({"name": parts[0], "position": parts[1], "size": parts[2]})
    return {"ok": True, "app": app, "windows": windows}


def cmd_window_set(app: str, x: int, y: int, width: int, height: int) -> dict[str, object]:
    script = f'''
    tell application "{app}" to activate
    tell application "System Events"
      tell process "{app}"
        if (count of windows) is 0 then error "No windows available"
        set position of front window to {{{x}, {y}}}
        set size of front window to {{{width}, {height}}}
      end tell
    end tell
    '''
    osa(script)
    return {"ok": True, "app": app, "position": [x, y], "size": [width, height]}


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

    focus = sub.add_parser("focus")
    focus.add_argument("--app", required=True)
    focus.add_argument("--json", action="store_true")

    see = sub.add_parser("see")
    see.add_argument("--app")
    see.add_argument("--json", action="store_true")

    type_cmd = sub.add_parser("type")
    type_cmd.add_argument("text")
    type_cmd.add_argument("--json", action="store_true")

    hotkey = sub.add_parser("hotkey")
    hotkey.add_argument("--key", required=True)
    hotkey.add_argument("--modifiers", default="")
    hotkey.add_argument("--json", action="store_true")

    open_url = sub.add_parser("open-url")
    open_url.add_argument("--url", required=True)
    open_url.add_argument("--app")
    open_url.add_argument("--json", action="store_true")

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

    window = sub.add_parser("window")
    window_sub = window.add_subparsers(dest="window_command", required=True)
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

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    if args.command == "apps":
        print_result(cmd_apps(), args.json)
        return
    if args.command == "focus":
        print_result(cmd_focus(args.app), args.json)
        return
    if args.command == "see":
        print_result(cmd_see(args.app), args.json)
        return
    if args.command == "type":
        print_result(cmd_type(args.text), args.json)
        return
    if args.command == "hotkey":
        modifiers = [m.strip() for m in args.modifiers.split(",") if m.strip()]
        print_result(cmd_hotkey(args.key, modifiers), args.json)
        return
    if args.command == "open-url":
        print_result(cmd_open_url(args.url, args.app), args.json)
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


if __name__ == "__main__":
    main()
