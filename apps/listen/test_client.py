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


if __name__ == "__main__":
    unittest.main()
