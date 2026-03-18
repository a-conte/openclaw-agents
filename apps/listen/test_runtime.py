from __future__ import annotations

import json
import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import listen_server
import worker
import workflow_templates


class ListenRuntimeTests(unittest.TestCase):
    def test_validate_job_request_blocks_policy_restricted_drive_command(self) -> None:
        with patch.dict(os.environ, {"OPENCLAW_LISTEN_ALLOW_DANGEROUS": "false"}, clear=False):
            error = listen_server.validate_job_request(
                {
                    "mode": "drive",
                    "command": "proc",
                    "args": ["kill", "123"],
                }
            )
        self.assertIn("requires OPENCLAW_LISTEN_ALLOW_DANGEROUS=true", error or "")

    def test_deep_resolve_replaces_step_placeholders(self) -> None:
        resolved = worker.deep_resolve(
            {
                "prompt": "Agent saw {{steps.first.result.value}}",
                "args": ["{{steps.second.result.answer}}"],
            },
            {
                "steps": {
                    "first": {"result": {"value": "hello"}},
                    "second": {"result": {"answer": "world"}},
                }
            },
        )
        self.assertEqual(resolved["prompt"], "Agent saw hello")
        self.assertEqual(resolved["args"], ["world"])

    def test_wait_step_times_out_with_last_result(self) -> None:
        job = {"id": "job-1", "session": "listen-job-1", "updates": [], "stepStatus": []}
        result = worker.execute_step(
            {
                "type": "wait",
                "timeoutSeconds": 0.02,
                "intervalSeconds": 0.001,
                "until": {"path": "matched", "equals": True},
                "run": {"type": "note", "id": "noop", "message": "waiting"},
            },
            job,
            {"steps": {}},
        )
        self.assertFalse(result["ok"])
        self.assertTrue(result["timedOut"])
        self.assertIn("result", result)

    def test_extract_step_artifacts_keeps_compact_structured_fields(self) -> None:
        artifacts = worker.extract_step_artifacts(
            {
                "ok": True,
                "output": "hello",
                "stdout": "world",
                "exitCode": 0,
                "screenshot": "/tmp/example.png",
                "matches": [{"text": "Reload this page", "confidence": 0.98, "box": {"screenCenterX": 123.456}}],
            }
        )
        self.assertEqual(artifacts["output"], "hello")
        self.assertEqual(artifacts["stdout"], "world")
        self.assertEqual(artifacts["exitCode"], 0)
        self.assertEqual(artifacts["screenshot"], "/tmp/example.png")
        self.assertEqual(artifacts["matches"][0]["text"], "Reload this page")

    def test_validate_job_request_accepts_known_template_id(self) -> None:
        error = listen_server.validate_job_request(
            {
                "mode": "workflow",
                "templateId": "open_command_page",
            }
        )
        self.assertIsNone(error)

    def test_resolve_template_builds_browser_snapshot_review(self) -> None:
        spec, inputs = workflow_templates.resolve_template("browser_snapshot_review", {"url": "http://localhost:3000/command"})
        self.assertEqual(inputs["url"], "http://localhost:3000/command")
        self.assertEqual(spec["steps"][0]["type"], "steer")
        self.assertEqual(spec["steps"][-1]["command"], "ocr")

    def test_recover_orphaned_jobs_marks_running_jobs_failed(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            jobs_dir = Path(tmp)
            archived_dir = jobs_dir / "archived"
            archived_dir.mkdir()
            payload = {
                "id": "abc123",
                "status": "running",
                "createdAt": "2026-03-17T00:00:00Z",
                "updatedAt": "2026-03-17T00:00:00Z",
            }
            (jobs_dir / "abc123.json").write_text(json.dumps(payload), encoding="utf-8")
            with patch.object(listen_server, "JOBS_DIR", jobs_dir), patch.object(listen_server, "ARCHIVED_DIR", archived_dir):
                listen_server.recover_orphaned_jobs()
            recovered = json.loads((jobs_dir / "abc123.json").read_text(encoding="utf-8"))
            self.assertEqual(recovered["status"], "failed")
            self.assertIn("startup recovery", recovered["summary"])


if __name__ == "__main__":
    unittest.main()
