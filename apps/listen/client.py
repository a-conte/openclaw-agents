from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from typing import Any


TERMINAL_JOB_STATUSES = {"completed", "failed", "stopped"}


class ListenClient:
    def __init__(self, base_url: str = "http://127.0.0.1:7600") -> None:
        self.base_url = base_url.rstrip("/")

    def _request(self, path: str, *, method: str = "GET", payload: dict[str, Any] | None = None) -> Any:
        headers = {"Content-Type": "application/json"}
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(f"{self.base_url}{path}", data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request) as response:
                body = response.read().decode("utf-8")
                return json.loads(body) if body else None
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8") if exc.fp is not None else ""
            raise RuntimeError(detail or f"listen request failed with status {exc.code}") from exc

    def submit_job(self, payload: dict[str, Any]) -> dict[str, Any]:
        created = self._request("/job", method="POST", payload=payload)
        job_id = str(created.get("job_id") or "")
        if not job_id:
            raise RuntimeError("listen did not return a job_id")
        return self.get_job(job_id)

    def execute_template(
        self,
        template_id: str,
        *,
        template_inputs: dict[str, str] | None = None,
        target_agent: str = "main",
        wait: bool = False,
        timeout: float = 300.0,
        poll_interval: float = 1.0,
    ) -> dict[str, Any]:
        return self.execute_job(
            {
                "mode": "workflow",
                "templateId": template_id,
                "templateInputs": template_inputs or {},
                "targetAgent": target_agent,
            },
            wait=wait,
            timeout=timeout,
            poll_interval=poll_interval,
        )

    def submit_template_job(
        self,
        template_id: str,
        *,
        template_inputs: dict[str, str] | None = None,
        target_agent: str = "main",
    ) -> dict[str, Any]:
        return self.submit_job(
            {
                "mode": "workflow",
                "templateId": template_id,
                "templateInputs": template_inputs or {},
                "targetAgent": target_agent,
            }
        )

    def execute_job(
        self,
        payload: dict[str, Any],
        *,
        wait: bool = False,
        timeout: float = 300.0,
        poll_interval: float = 1.0,
    ) -> dict[str, Any]:
        result = self._request(
            "/agent/execute",
            method="POST",
            payload={
                "wait": wait,
                "timeout": timeout,
                "pollInterval": poll_interval,
                "job": payload,
            },
        )
        if wait:
            job = result.get("job")
            if isinstance(job, dict):
                return job
        return result

    def submit_workflow_spec(
        self,
        workflow_spec: dict[str, Any],
        *,
        target_agent: str = "main",
    ) -> dict[str, Any]:
        return self.submit_job(
            {
                "mode": "workflow",
                "workflowSpec": workflow_spec,
                "targetAgent": target_agent,
            }
        )

    def get_job(self, job_id: str) -> dict[str, Any]:
        return self._request(f"/job/{job_id}")

    def inspect_job(self, job_id: str) -> dict[str, Any]:
        return self._request(f"/agent/job/{job_id}")

    def wait_for_job(self, job_id: str, *, timeout: float = 300.0, poll_interval: float = 1.0) -> dict[str, Any]:
        deadline = time.time() + timeout
        while True:
            job = self.get_job(job_id)
            if str(job.get("status") or "") in TERMINAL_JOB_STATUSES:
                return job
            if time.time() >= deadline:
                raise TimeoutError(f"timed out waiting for job {job_id}")
            time.sleep(poll_interval)

    def wait_for_job_native(self, job_id: str, *, timeout: float = 300.0, poll_interval: float = 1.0) -> dict[str, Any]:
        payload = self._request(
            f"/agent/job/{job_id}/wait",
            method="POST",
            payload={"timeout": timeout, "pollInterval": poll_interval},
        )
        job = payload.get("job") if isinstance(payload, dict) else None
        if not isinstance(job, dict):
            raise RuntimeError("listen agent wait did not return a job payload")
        return job

    def retry_job(self, job_id: str, *, mode: str = "resume_failed", resume_from_step_id: str | None = None) -> dict[str, Any]:
        payload = {"mode": mode}
        if resume_from_step_id:
            payload["resumeFromStepId"] = resume_from_step_id
        result = self._request(f"/agent/job/{job_id}/retry", method="POST", payload=payload)
        job = result.get("job") if isinstance(result, dict) else None
        if isinstance(job, dict):
            return job
        next_job_id = str(result.get("job_id") or "") if isinstance(result, dict) else ""
        if next_job_id:
            return self.inspect_job(next_job_id)
        raise RuntimeError("listen agent retry did not return a job")

    def run_template_job(
        self,
        template_id: str,
        *,
        template_inputs: dict[str, str] | None = None,
        target_agent: str = "main",
        timeout: float = 300.0,
        poll_interval: float = 1.0,
    ) -> dict[str, Any]:
        job = self.submit_template_job(template_id, template_inputs=template_inputs, target_agent=target_agent)
        return self.wait_for_job(str(job["id"]), timeout=timeout, poll_interval=poll_interval)

    def list_templates(self) -> list[dict[str, Any]]:
        payload = self._request("/templates")
        return payload.get("templates", []) if isinstance(payload, dict) else []

    def agent_templates(self) -> list[dict[str, Any]]:
        payload = self._request("/agent/templates")
        return payload.get("templates", []) if isinstance(payload, dict) else []

    def template_versions(self, template_id: str) -> list[dict[str, Any]]:
        payload = self._request(f"/templates/{template_id}/versions")
        return payload.get("versions", []) if isinstance(payload, dict) else []

    def template_diff(self, template_id: str, from_version: int, to_version: int | None = None) -> dict[str, Any]:
        path = f"/agent/templates/{template_id}/diff?from={int(from_version)}"
        if to_version is not None:
            path += f"&to={int(to_version)}"
        return self._request(path)

    def job_artifacts(self, job_id: str) -> list[dict[str, Any]]:
        payload = self._request(f"/agent/job/{job_id}/artifacts")
        return payload.get("artifacts", []) if isinstance(payload, dict) else []

    def artifact_admin(self) -> dict[str, Any]:
        return self._request("/artifacts/admin")

    def metrics(self) -> dict[str, Any]:
        return self._request("/metrics")

    def policy_admin(self) -> dict[str, Any]:
        return self._request("/policy/admin")
