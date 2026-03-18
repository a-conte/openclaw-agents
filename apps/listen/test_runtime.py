from __future__ import annotations

import json
import os
import tempfile
import time
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

import artifacts
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
        with tempfile.TemporaryDirectory() as tmp:
            base_dir = Path(tmp) / "artifacts"
            screenshot = Path(tmp) / "example.png"
            screenshot.write_text("fake-image", encoding="utf-8")
            with patch.object(artifacts, "BASE_DIR", base_dir):
                extracted = worker.extract_step_artifacts(
                    "job-1",
                    "step-1",
                    {
                        "ok": True,
                        "output": "hello",
                        "stdout": "world",
                        "exitCode": 0,
                        "screenshot": str(screenshot),
                        "matches": [{"text": "Reload this page", "confidence": 0.98, "box": {"screenCenterX": 123.456}}],
                    },
                )
        self.assertEqual(extracted["output"]["kind"], "text")
        self.assertEqual(extracted["output"]["preview"], "hello")
        self.assertEqual(extracted["stdout"]["preview"], "world")
        self.assertEqual(extracted["exitCode"], 0)
        self.assertEqual(extracted["screenshot"]["sourcePath"], str(screenshot))
        self.assertEqual(extracted["matches"]["kind"], "json")
        self.assertIn("Reload this page", extracted["matches"]["preview"])

    def test_archive_jobs_moves_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            jobs_dir = Path(tmp) / "jobs"
            jobs_dir.mkdir()
            archived_dir = jobs_dir / "archived"
            archived_dir.mkdir()
            artifacts_dir = jobs_dir / "artifacts"
            artifacts_dir.mkdir()
            archived_artifacts_dir = jobs_dir / "archived-artifacts"
            archived_artifacts_dir.mkdir()
            (jobs_dir / "job-1.json").write_text(json.dumps({"id": "job-1", "status": "completed"}), encoding="utf-8")
            (artifacts_dir / "job-1").mkdir()
            (artifacts_dir / "job-1" / "output.txt").write_text("hello", encoding="utf-8")
            with (
                patch.object(listen_server, "JOBS_DIR", jobs_dir),
                patch.object(listen_server, "ARCHIVED_DIR", archived_dir),
                patch.object(artifacts, "JOBS_DIR", jobs_dir),
                patch.object(artifacts, "BASE_DIR", artifacts_dir),
                patch.object(artifacts, "ARCHIVED_BASE_DIR", archived_artifacts_dir),
            ):
                archived = listen_server.archive_jobs()
            self.assertEqual(archived, 1)
            self.assertTrue((archived_dir / "job-1.json").exists())
            self.assertTrue((archived_artifacts_dir / "job-1" / "output.txt").exists())

    def test_bundle_job_artifacts_includes_job_json_and_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            jobs_dir = Path(tmp) / "jobs"
            jobs_dir.mkdir()
            artifacts_dir = jobs_dir / "artifacts"
            artifacts_dir.mkdir()
            exports_dir = jobs_dir / "exports"
            exports_dir.mkdir()
            (jobs_dir / "job-1.json").write_text(json.dumps({"id": "job-1", "status": "completed"}), encoding="utf-8")
            (artifacts_dir / "job-1").mkdir()
            (artifacts_dir / "job-1" / "output.txt").write_text("hello", encoding="utf-8")
            with (
                patch.object(artifacts, "JOBS_DIR", jobs_dir),
                patch.object(artifacts, "BASE_DIR", artifacts_dir),
                patch.object(artifacts, "EXPORT_BASE_DIR", exports_dir),
            ):
                bundle = artifacts.bundle_job_artifacts("job-1", kind="incident")
                bundle_path = artifacts.resolve_export_bundle("job-1", "incident")
            self.assertIsNotNone(bundle)
            self.assertIsNotNone(bundle_path)
            with zipfile.ZipFile(bundle_path) as archive:
                names = set(archive.namelist())
            self.assertIn("job-1.json", names)
            self.assertIn("artifacts/output.txt", names)

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

    def test_resolve_template_builds_operator_handoff_bundle(self) -> None:
        spec, _ = workflow_templates.resolve_template("operator_handoff_bundle", {"url": "http://localhost:3000/command"})
        self.assertEqual(spec["steps"][0]["type"], "steer")
        self.assertEqual(spec["steps"][-1]["command"], "textedit")

    def test_save_and_resolve_custom_template(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            custom_path = Path(tmp) / "templates.json"
            with patch.object(workflow_templates, "CUSTOM_TEMPLATES_PATH", custom_path):
                saved = workflow_templates.save_custom_template(
                    {
                        "id": "Ops Review",
                        "name": "Ops Review",
                        "description": "Custom workflow",
                        "category": "ops",
                        "workflowSpec": {
                            "steps": [
                                {"id": "note_1", "type": "note", "message": "hello"},
                            ]
                        },
                        "inputs": [{"key": "repo", "label": "Repo", "defaultValue": "/tmp/repo"}],
                    }
                )
                spec, inputs = workflow_templates.resolve_template("ops_review", {"repo": "/Users/test/repo"})
        self.assertEqual(saved["id"], "ops_review")
        self.assertEqual(spec["steps"][0]["type"], "note")
        self.assertEqual(inputs["repo"], "/Users/test/repo")

    def test_delete_custom_template_removes_saved_entry(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            custom_path = Path(tmp) / "templates.json"
            with patch.object(workflow_templates, "CUSTOM_TEMPLATES_PATH", custom_path):
                workflow_templates.save_custom_template(
                    {
                        "id": "cleanup_template",
                        "name": "Cleanup Template",
                        "description": "Custom workflow",
                        "workflowSpec": {"steps": [{"id": "note_1", "type": "note", "message": "done"}]},
                    }
                )
                deleted = workflow_templates.delete_custom_template("cleanup_template")
                template = workflow_templates.get_template("cleanup_template")
        self.assertTrue(deleted)
        self.assertIsNone(template)

    def test_save_custom_template_increments_version_and_history(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            custom_path = Path(tmp) / "templates.json"
            with patch.object(workflow_templates, "CUSTOM_TEMPLATES_PATH", custom_path):
                first = workflow_templates.save_custom_template(
                    {
                        "id": "versioned_template",
                        "name": "Versioned Template",
                        "description": "v1",
                        "workflowSpec": {"steps": [{"id": "note_1", "type": "note", "message": "v1"}]},
                    }
                )
                second = workflow_templates.save_custom_template(
                    {
                        "id": "versioned_template",
                        "name": "Versioned Template",
                        "description": "v2",
                        "workflowSpec": {"steps": [{"id": "note_1", "type": "note", "message": "v2"}]},
                    }
                )
                versions = workflow_templates.list_template_versions("versioned_template")
        self.assertEqual(first["version"], 1)
        self.assertEqual(second["version"], 2)
        self.assertEqual(len(versions), 2)
        self.assertEqual(versions[0]["version"], 1)
        self.assertEqual(versions[1]["version"], 2)

    def test_clone_custom_template_copies_favorite_but_clears_recommended(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            custom_path = Path(tmp) / "templates.json"
            with patch.object(workflow_templates, "CUSTOM_TEMPLATES_PATH", custom_path):
                cloned = workflow_templates.clone_custom_template("open_command_page", "open_command_page_clone", "Open Command Page Clone")
        self.assertEqual(cloned["id"], "open_command_page_clone")
        self.assertEqual(cloned["name"], "Open Command Page Clone")
        self.assertFalse(cloned["recommended"])
        self.assertFalse(cloned["builtIn"])

    def test_restore_template_version_creates_new_latest_version(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            custom_path = Path(tmp) / "templates.json"
            with patch.object(workflow_templates, "CUSTOM_TEMPLATES_PATH", custom_path):
                workflow_templates.save_custom_template(
                    {
                        "id": "restorable",
                        "name": "Restorable",
                        "description": "v1",
                        "workflowSpec": {"steps": [{"id": "note_1", "type": "note", "message": "v1"}]},
                    }
                )
                workflow_templates.save_custom_template(
                    {
                        "id": "restorable",
                        "name": "Restorable",
                        "description": "v2",
                        "workflowSpec": {"steps": [{"id": "note_1", "type": "note", "message": "v2"}]},
                    }
                )
                restored = workflow_templates.restore_template_version("restorable", 1)
                versions = workflow_templates.list_template_versions("restorable")
        self.assertEqual(restored["version"], 3)
        self.assertEqual(restored["description"], "v1")
        self.assertEqual(len(versions), 3)
        self.assertEqual(versions[-1]["version"], 3)

    def test_diff_template_versions_reports_changes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            custom_path = Path(tmp) / "templates.json"
            with patch.object(workflow_templates, "CUSTOM_TEMPLATES_PATH", custom_path):
                workflow_templates.save_custom_template(
                    {
                        "id": "diffable",
                        "name": "Diffable",
                        "description": "v1",
                        "workflowSpec": {"steps": [{"id": "note_1", "type": "note", "message": "v1"}]},
                    }
                )
                workflow_templates.save_custom_template(
                    {
                        "id": "diffable",
                        "name": "Diffable",
                        "description": "v2",
                        "workflowSpec": {"steps": [{"id": "note_1", "type": "note", "message": "v2"}]},
                    }
                )
                diff = workflow_templates.diff_template_versions("diffable", 1, 2)
        self.assertEqual(diff["fromVersion"], 1)
        self.assertEqual(diff["toVersion"], 2)
        self.assertIn("v1", diff["diff"])
        self.assertIn("v2", diff["diff"])

    def test_normalize_template_inputs_requires_required_values(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            custom_path = Path(tmp) / "templates.json"
            with patch.object(workflow_templates, "CUSTOM_TEMPLATES_PATH", custom_path):
                workflow_templates.save_custom_template(
                    {
                        "id": "required_template",
                        "name": "Required Template",
                        "description": "Requires input",
                        "workflowSpec": {"steps": [{"id": "note_1", "type": "note", "message": "ok"}]},
                        "inputs": [{"key": "repo", "label": "Repo", "required": True, "defaultValue": ""}],
                    }
                )
                with self.assertRaisesRegex(ValueError, "Missing required template input: repo"):
                    workflow_templates.resolve_template("required_template", {})

    def test_repo_release_readiness_template_expands_to_four_steps(self) -> None:
        spec, inputs = workflow_templates.resolve_template(
            "repo_release_readiness",
            {"repoPath": "/tmp/repo", "testCommand": "npm test", "buildCommand": "npm run build"},
        )
        self.assertEqual(inputs["repoPath"], "/tmp/repo")
        self.assertEqual(len(spec["steps"]), 4)
        self.assertEqual(spec["steps"][0]["id"], "repo_release_branch")
        self.assertEqual(spec["steps"][-1]["type"], "agent")

    def test_browser_login_snapshot_requires_expected_text(self) -> None:
        with self.assertRaisesRegex(ValueError, "Missing required template input: expectedText"):
            workflow_templates.resolve_template("browser_login_snapshot", {"url": "https://example.com/login"})

    def test_repo_change_review_expands_to_review_summary(self) -> None:
        spec, inputs = workflow_templates.resolve_template(
            "repo_change_review",
            {"repoPath": "/tmp/repo", "testCommand": "npm test"},
        )
        self.assertEqual(inputs["repoPath"], "/tmp/repo")
        self.assertEqual(len(spec["steps"]), 4)
        self.assertEqual(spec["steps"][0]["id"], "repo_change_status")
        self.assertEqual(spec["steps"][-1]["type"], "agent")

    def test_dashboard_policy_audit_fetches_policy_and_metrics(self) -> None:
        spec, _ = workflow_templates.resolve_template(
            "dashboard_policy_audit",
            {"url": "http://localhost:3000/command", "policyUrl": "http://localhost:3000/api/jobs/policy/admin", "metricsUrl": "http://localhost:3000/api/jobs/metrics"},
        )
        self.assertEqual(spec["steps"][2]["id"], "fetch_policy_admin")
        self.assertEqual(spec["steps"][3]["id"], "fetch_metrics_admin")
        self.assertEqual(spec["steps"][-1]["command"], "ocr")

    def test_browser_recovery_handoff_defaults_to_recovery_ui_wait(self) -> None:
        spec, _ = workflow_templates.resolve_template(
            "browser_recovery_handoff",
            {"url": "http://localhost:3000/command"},
        )
        self.assertEqual(spec["steps"][1]["id"], "wait_browser_handoff")
        self.assertEqual(spec["steps"][1]["args"][0], "ui")
        self.assertEqual(spec["steps"][-1]["command"], "textedit")

    def test_daemon_recovery_handoff_requires_restart_inputs(self) -> None:
        with self.assertRaisesRegex(ValueError, "Missing required template input: restartCommand"):
            workflow_templates.resolve_template("daemon_recovery_handoff", {})

    def test_prune_archived_artifacts_uses_template_retention_override(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            jobs_dir = Path(tmp) / "jobs"
            jobs_dir.mkdir()
            archived_jobs_dir = jobs_dir / "archived"
            archived_jobs_dir.mkdir()
            archived_artifacts_dir = jobs_dir / "archived-artifacts"
            archived_artifacts_dir.mkdir()
            target = archived_artifacts_dir / "job-1"
            target.mkdir()
            (target / "output.txt").write_text("hello", encoding="utf-8")
            (archived_jobs_dir / "job-1.json").write_text(
                json.dumps({"id": "job-1", "templateId": "incident_capture"}),
                encoding="utf-8",
            )
            old_time = max(0, int(time.time() - (40 * 24 * 60 * 60)))
            os.utime(target, (old_time, old_time))
            with patch.object(artifacts, "JOBS_DIR", jobs_dir), patch.object(artifacts, "ARCHIVED_BASE_DIR", archived_artifacts_dir):
                result = artifacts.prune_archived_artifacts(30)
            self.assertEqual(result["removedJobs"], [])

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

    def test_collect_job_metrics_summarizes_jobs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            jobs_dir = Path(tmp) / "jobs"
            jobs_dir.mkdir()
            archived_dir = jobs_dir / "archived"
            archived_dir.mkdir()
            (jobs_dir / "job-running.json").write_text(
                json.dumps(
                    {
                        "id": "job-running",
                        "mode": "workflow",
                        "status": "running",
                        "templateId": "open_command_page",
                        "createdAt": "2026-03-18T00:00:00Z",
                        "startedAt": "2026-03-18T00:00:00Z",
                    }
                ),
                encoding="utf-8",
            )
            (archived_dir / "job-complete.json").write_text(
                json.dumps(
                    {
                        "id": "job-complete",
                        "mode": "workflow",
                        "status": "completed",
                        "templateId": "repo_status_check",
                        "createdAt": "2026-03-18T00:00:00Z",
                        "startedAt": "2026-03-18T00:00:00Z",
                        "completedAt": "2026-03-18T00:00:05Z",
                        "stepStatus": [{"id": "step_1", "name": "Run test", "status": "failed"}],
                    }
                ),
                encoding="utf-8",
            )
            with patch.object(listen_server, "JOBS_DIR", jobs_dir), patch.object(listen_server, "ARCHIVED_DIR", archived_dir):
                metrics = listen_server.collect_job_metrics()
        self.assertEqual(metrics["jobs"]["total"], 2)
        self.assertEqual(metrics["jobs"]["statusCounts"]["running"], 1)
        self.assertEqual(metrics["jobs"]["statusCounts"]["completed"], 1)
        self.assertIsNotNone(metrics["jobs"]["medianCompletedDurationMs"])
        self.assertIsNotNone(metrics["jobs"]["p95CompletedDurationMs"])
        self.assertTrue(metrics["templates"]["usage"])
        self.assertTrue(metrics["templates"]["performance"])
        self.assertTrue(metrics["trends"])
        self.assertTrue(metrics["steps"]["topFailures"])
        self.assertIn("artifactVolume", metrics["steps"])
        self.assertIn("recentChains", metrics["lineage"])


if __name__ == "__main__":
    unittest.main()
