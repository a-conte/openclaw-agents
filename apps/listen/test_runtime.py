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
