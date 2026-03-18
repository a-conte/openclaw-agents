from __future__ import annotations

import unittest
from unittest.mock import patch

from client import ListenClient


class ListenClientTests(unittest.TestCase):
    def test_list_templates_returns_payload_templates(self) -> None:
        client = ListenClient()
        with patch.object(client, "_request", return_value={"templates": [{"id": "open_command_page"}]}):
            templates = client.list_templates()
        self.assertEqual(templates, [{"id": "open_command_page"}])

    def test_wait_for_job_returns_terminal_job(self) -> None:
        client = ListenClient()
        with patch.object(client, "get_job", side_effect=[{"id": "job-1", "status": "running"}, {"id": "job-1", "status": "completed"}]):
            job = client.wait_for_job("job-1", timeout=1, poll_interval=0)
        self.assertEqual(job["status"], "completed")

    def test_run_template_job_submits_then_waits(self) -> None:
        client = ListenClient()
        with (
            patch.object(client, "submit_template_job", return_value={"id": "job-2"}) as submit_mock,
            patch.object(client, "wait_for_job", return_value={"id": "job-2", "status": "completed"}) as wait_mock,
        ):
            job = client.run_template_job("open_command_page", template_inputs={"url": "http://localhost:3000/command"})
        submit_mock.assert_called_once()
        wait_mock.assert_called_once_with("job-2", timeout=300.0, poll_interval=1.0)
        self.assertEqual(job["id"], "job-2")

    def test_execute_job_posts_agent_execute_payload(self) -> None:
        client = ListenClient()
        with patch.object(client, "_request", return_value={"job_id": "job-3", "waited": False}) as request_mock:
            result = client.execute_job({"mode": "workflow", "templateId": "open_command_page"}, wait=False)
        request_mock.assert_called_once()
        self.assertEqual(result["job_id"], "job-3")

    def test_execute_template_uses_agent_execute_path(self) -> None:
        client = ListenClient()
        with patch.object(client, "execute_job", return_value={"job_id": "job-4"}) as execute_mock:
            result = client.execute_template("open_command_page", wait=True)
        execute_mock.assert_called_once()
        self.assertEqual(result["job_id"], "job-4")

    def test_wait_for_job_native_returns_job_payload(self) -> None:
        client = ListenClient()
        with patch.object(client, "_request", return_value={"job_id": "job-5", "job": {"id": "job-5", "status": "completed"}}):
            result = client.wait_for_job_native("job-5", timeout=10, poll_interval=0.5)
        self.assertEqual(result["id"], "job-5")

    def test_template_diff_requests_agent_diff_endpoint(self) -> None:
        client = ListenClient()
        with patch.object(client, "_request", return_value={"templateId": "open_command_page", "diff": "---"} ) as request_mock:
            result = client.template_diff("open_command_page", 1, 2)
        request_mock.assert_called_once_with("/agent/templates/open_command_page/diff?from=1&to=2")
        self.assertEqual(result["templateId"], "open_command_page")

    def test_create_template_uses_agent_templates_endpoint(self) -> None:
        client = ListenClient()
        payload = {"id": "custom-template", "name": "Custom", "description": "desc", "workflowSpec": {"steps": []}}
        with patch.object(client, "_request", return_value={"id": "custom-template"}) as request_mock:
            result = client.create_template(payload)
        request_mock.assert_called_once_with("/agent/templates", method="POST", payload=payload)
        self.assertEqual(result["id"], "custom-template")

    def test_clone_template_uses_agent_clone_endpoint(self) -> None:
        client = ListenClient()
        with patch.object(client, "_request", return_value={"id": "custom-template-copy"}) as request_mock:
            result = client.clone_template("custom-template", new_id="custom-template-copy", new_name="Copy")
        request_mock.assert_called_once_with(
            "/agent/templates/custom-template/clone",
            method="POST",
            payload={"id": "custom-template-copy", "name": "Copy"},
        )
        self.assertEqual(result["id"], "custom-template-copy")


if __name__ == "__main__":
    unittest.main()
