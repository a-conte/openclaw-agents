from __future__ import annotations

import io
import json
import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch

import artifacts
import listen_server
import notifications
import workflow_templates


class ListenHttpSmokeTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self._stack = ExitStack()
        root = Path(self._tmp.name)
        jobs_dir = root / "jobs"
        archived_dir = jobs_dir / "archived"
        artifacts_dir = jobs_dir / "artifacts"
        archived_artifacts_dir = jobs_dir / "archived-artifacts"
        exports_dir = jobs_dir / "exports"
        compressed_dir = jobs_dir / "archived-artifacts-compressed"
        for path in (jobs_dir, archived_dir, artifacts_dir, archived_artifacts_dir, exports_dir, compressed_dir):
            path.mkdir(parents=True, exist_ok=True)
        self._stack.enter_context(patch.object(listen_server, "JOBS_DIR", jobs_dir))
        self._stack.enter_context(patch.object(listen_server, "ARCHIVED_DIR", archived_dir))
        self._stack.enter_context(patch.object(artifacts, "JOBS_DIR", jobs_dir))
        self._stack.enter_context(patch.object(artifacts, "BASE_DIR", artifacts_dir))
        self._stack.enter_context(patch.object(artifacts, "ARCHIVED_BASE_DIR", archived_artifacts_dir))
        self._stack.enter_context(patch.object(artifacts, "EXPORT_BASE_DIR", exports_dir))
        self._stack.enter_context(patch.object(artifacts, "COMPRESSED_ARCHIVE_DIR", compressed_dir))
        self._stack.enter_context(patch.object(notifications, "STATE_PATH", root / "notification-state.json"))
        self._stack.enter_context(patch.object(workflow_templates, "CUSTOM_TEMPLATES_PATH", root / "templates.json"))
        self._stack.enter_context(patch.object(listen_server, "spawn_worker"))
        self._stack.enter_context(patch.object(listen_server.Handler, "log_message", autospec=True))

    def tearDown(self) -> None:
        self._stack.close()
        self._tmp.cleanup()

    def _request(
        self,
        path: str,
        *,
        method: str = "GET",
        payload: dict[str, object] | None = None,
    ) -> tuple[int, object]:
        body = b"" if payload is None else json.dumps(payload).encode("utf-8")
        handler = listen_server.Handler.__new__(listen_server.Handler)
        handler.path = path
        handler.headers = {"Content-Length": str(len(body))}
        handler.rfile = io.BytesIO(body)
        handler.wfile = io.BytesIO()
        handler._status = None
        handler._response_headers = []

        def send_response(code: int, message: str | None = None) -> None:
            handler._status = code

        def send_header(name: str, value: str) -> None:
            handler._response_headers.append((name, value))

        handler.send_response = send_response
        handler.send_header = send_header
        handler.end_headers = lambda: None

        dispatch = {
            "GET": listen_server.Handler.do_GET,
            "POST": listen_server.Handler.do_POST,
            "PUT": listen_server.Handler.do_PUT,
            "DELETE": listen_server.Handler.do_DELETE,
        }
        dispatch[method](handler)
        response_body = handler.wfile.getvalue().decode("utf-8")
        return int(handler._status), json.loads(response_body) if response_body else None

    def test_job_endpoints_create_list_get_and_stop(self) -> None:
        status, created = self._request("/job", method="POST", payload={"mode": "note", "prompt": "smoke note"})
        self.assertEqual(status, 201)
        self.assertIsInstance(created, dict)
        job_id = str(created["job_id"])

        status, job = self._request(f"/job/{job_id}")
        self.assertEqual(status, 200)
        self.assertEqual(job["id"], job_id)
        self.assertEqual(job["mode"], "note")
        self.assertEqual(job["status"], "running")

        status, jobs_payload = self._request("/jobs")
        self.assertEqual(status, 200)
        self.assertEqual(len(jobs_payload["jobs"]), 1)
        self.assertEqual(jobs_payload["jobs"][0]["id"], job_id)

        status, stopped = self._request(f"/job/{job_id}", method="DELETE")
        self.assertEqual(status, 200)
        self.assertTrue(stopped["ok"])

        status, job = self._request(f"/job/{job_id}")
        self.assertEqual(status, 200)
        self.assertEqual(job["status"], "stopped")

    def test_shortcuts_and_metrics_endpoints_reflect_job_state(self) -> None:
        _, created = self._request("/job", method="POST", payload={"mode": "note", "prompt": "smoke note"})
        job_id = str(created["job_id"])
        self._request(f"/job/{job_id}", method="DELETE")

        status, latest_failed = self._request("/shortcuts/latest-failed")
        self.assertEqual(status, 200)
        self.assertEqual(latest_failed["job"]["id"], job_id)
        self.assertEqual(latest_failed["job"]["status"], "stopped")

        status, summary = self._request("/shortcuts/summary")
        self.assertEqual(status, 200)
        self.assertEqual(summary["latestFailedJob"]["id"], job_id)
        self.assertEqual(summary["jobs"]["total"], 1)

        status, metrics = self._request("/metrics")
        self.assertEqual(status, 200)
        self.assertEqual(metrics["jobs"]["total"], 1)
        self.assertEqual(metrics["jobs"]["statusCounts"]["stopped"], 1)

    def test_templates_and_agent_execute_routes_smoke(self) -> None:
        status, templates = self._request("/templates")
        self.assertEqual(status, 200)
        template_ids = {template["id"] for template in templates["templates"]}
        self.assertIn("open_command_page", template_ids)

        status, result = self._request(
            "/agent/execute",
            method="POST",
            payload={
                "wait": False,
                "job": {
                    "mode": "workflow",
                    "templateId": "open_command_page",
                    "targetAgent": "main",
                },
            },
        )
        self.assertEqual(status, 201)
        self.assertFalse(result["waited"])
        job_id = str(result["job_id"])

        status, job = self._request(f"/agent/job/{job_id}")
        self.assertEqual(status, 200)
        self.assertEqual(job["templateId"], "open_command_page")
        self.assertEqual(job["mode"], "workflow")

    def test_custom_template_lifecycle_routes_smoke(self) -> None:
        template_payload = {
            "id": "http-smoke-template",
            "name": "HTTP Smoke Template",
            "description": "Exercise template CRUD routes.",
            "workflowSpec": {"steps": [{"id": "note_1", "type": "note", "message": "hello"}]},
        }

        status, created = self._request("/templates", method="POST", payload=template_payload)
        self.assertEqual(status, 201)
        self.assertEqual(created["id"], "http-smoke-template")
        self.assertEqual(created["version"], 1)

        status, custom_templates = self._request("/templates/custom")
        self.assertEqual(status, 200)
        template_ids = {template["id"] for template in custom_templates["templates"]}
        self.assertIn("http-smoke-template", template_ids)

        status, versions = self._request("/templates/http-smoke-template/versions")
        self.assertEqual(status, 200)
        self.assertEqual(versions["versions"][0]["version"], 1)

        status, updated = self._request(
            "/agent/templates/http-smoke-template",
            method="PUT",
            payload={
                "name": "HTTP Smoke Template v2",
                "description": "Updated over agent alias route.",
                "workflowSpec": {"steps": [{"id": "note_1", "type": "note", "message": "updated"}]},
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(updated["id"], "http-smoke-template")
        self.assertEqual(updated["version"], 2)

        status, diff = self._request("/agent/templates/http-smoke-template/diff?from=1&to=2")
        self.assertEqual(status, 200)
        self.assertEqual(diff["templateId"], "http-smoke-template")
        self.assertEqual(diff["fromVersion"], 1)
        self.assertEqual(diff["toVersion"], 2)

        status, cloned = self._request(
            "/templates/http-smoke-template/clone",
            method="POST",
            payload={"id": "http-smoke-template-copy", "name": "HTTP Smoke Template Copy"},
        )
        self.assertEqual(status, 201)
        self.assertEqual(cloned["id"], "http-smoke-template-copy")

        status, restored = self._request(
            "/agent/templates/http-smoke-template/restore",
            method="POST",
            payload={"version": 1},
        )
        self.assertEqual(status, 200)
        self.assertEqual(restored["id"], "http-smoke-template")
        self.assertEqual(restored["version"], 3)

        status, deleted = self._request("/templates/http-smoke-template-copy", method="DELETE")
        self.assertEqual(status, 200)
        self.assertTrue(deleted["ok"])

    def test_notification_and_admin_routes_smoke(self) -> None:
        status, preferences = self._request("/notifications/preferences")
        self.assertEqual(status, 200)
        self.assertEqual(preferences["mode"], "focused")

        status, updated_preferences = self._request(
            "/notifications/preferences",
            method="POST",
            payload={
                "mode": "verbose",
                "channels": {"push": True, "notes": True},
                "templateAllowlist": ["open_command_page"],
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(updated_preferences["mode"], "verbose")
        self.assertTrue(updated_preferences["channels"]["notes"])
        self.assertEqual(updated_preferences["templateAllowlist"], ["open_command_page"])

        status, device = self._request(
            "/notifications/devices",
            method="POST",
            payload={"id": "ipad-1", "name": "Smoke iPad", "platform": "ios", "token": "abc123"},
        )
        self.assertEqual(status, 201)
        self.assertEqual(device["id"], "ipad-1")

        status, devices = self._request("/notifications/devices")
        self.assertEqual(status, 200)
        self.assertEqual(len(devices["devices"]), 1)
        self.assertEqual(devices["devices"][0]["id"], "ipad-1")

        status, events = self._request("/notifications/events?limit=5")
        self.assertEqual(status, 200)
        self.assertEqual(events["events"], [])

        status, policy = self._request("/policy")
        self.assertEqual(status, 200)
        self.assertIn("allowDangerous", policy)

        status, policy_admin = self._request("/policy/admin")
        self.assertEqual(status, 200)
        self.assertIn("env", policy_admin)
        self.assertIn("summary", policy_admin)

        status, artifacts_admin = self._request("/artifacts/admin")
        self.assertEqual(status, 200)
        self.assertIn("active", artifacts_admin)
        self.assertIn("retentionDays", artifacts_admin)

        status, cleared = self._request("/jobs/clear", method="POST")
        self.assertEqual(status, 200)
        self.assertEqual(cleared["archived"], 0)


if __name__ == "__main__":
    unittest.main()
