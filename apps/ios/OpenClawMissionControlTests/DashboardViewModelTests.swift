import XCTest
@testable import OpenClawMissionControl

final class DashboardViewModelTests: XCTestCase {
    @MainActor
    func testCleanEmptyStreamDoesNotMarkViewModelDegraded() async {
        let finished = expectation(description: "event stream finished")
        let viewModel = DashboardViewModel(client: EmptyStreamClient(onTermination: {
            finished.fulfill()
        }))

        await viewModel.start()
        await fulfillment(of: [finished], timeout: 1.0)

        XCTAssertNil(viewModel.errorMessage)
        XCTAssertEqual(viewModel.agents.count, 1)
        XCTAssertEqual(viewModel.counts.inProgressTasks, 3)
    }
}

private struct EmptyStreamClient: MissionControlClient {
    let onTermination: @Sendable () -> Void

    func loadInitialSnapshot() async throws -> DashboardSnapshot {
        DashboardSnapshot(
            agents: [AgentSummary(agentId: "main", name: "main", status: .online, lastActivity: nil)],
            generatedAt: Date(),
            sequence: 1,
            counts: MissionControlCounts(
                quietAgents: 0, staleTasks: 0, failedRuns: 0,
                inProgressTasks: 3, dirtyRepos: 0, radarCount: 0
            )
        )
    }

    func submitJob(request: JobRequest) async throws -> Job {
        Job.preview
    }

    func listJobTemplates() async throws -> [JobTemplate] {
        []
    }

    func listTemplateVersions(id: String) async throws -> [JobTemplateVersion] {
        []
    }

    func createJobTemplate(_ draft: JobTemplateDraft) async throws -> JobTemplate {
        JobTemplate(
            id: draft.id,
            name: draft.name,
            description: draft.description,
            category: draft.category,
            builtIn: false,
            favorite: draft.favorite,
            recommended: draft.recommended,
            artifactRetentionDays: draft.artifactRetentionDays,
            version: 1,
            createdAt: Date(),
            updatedAt: Date(),
            inputs: draft.inputs,
            workflowSpec: draft.workflowSpec
        )
    }

    func updateJobTemplate(id: String, draft: JobTemplateDraft) async throws -> JobTemplate {
        try await createJobTemplate(draft)
    }

    func deleteJobTemplate(id: String) async throws {
    }

    func listJobs(archived: Bool) async throws -> [Job] {
        []
    }

    func jobPolicy() async throws -> JobPolicy {
        JobPolicy(allowed: true, reason: nil, allowDangerous: false, allowedSteerCommands: [], allowedDriveCommands: [], allowedWorkflows: [], version: 1)
    }

    func jobPolicyAdmin() async throws -> PolicyAdmin {
        PolicyAdmin(policy: try await jobPolicy(), env: [], summary: nil)
    }

    func artifactAdmin() async throws -> ArtifactAdminSummary {
        ArtifactAdminSummary(active: .init(jobCount: 0, bytes: 0, jobs: []), archived: .init(jobCount: 0, bytes: 0, jobs: []), retentionDays: 30, oldestArchivedAgeDays: nil)
    }

    func jobMetrics() async throws -> JobMetrics {
        JobMetrics(
            jobs: .init(active: 0, archived: 0, total: 0, statusCounts: [:], modeCounts: [:], averageCompletedDurationMs: nil),
            templates: .init(total: 0, custom: 0, usage: []),
            steps: .init(topFailures: []),
            policy: .init(blockedJobs: 0, topBlockReasons: []),
            longRunning: [],
            artifacts: try await artifactAdmin()
        )
    }

    func stopJob(id: String) async throws {
    }

    func retryJob(id: String) async throws -> Job {
        Job.preview
    }

    func resumeJob(id: String, mode: String, resumeFromStepId: String?) async throws -> Job {
        Job.preview
    }

    func clearJobs() async throws {
    }

    func listTasks() async throws -> [TaskItem] {
        []
    }

    func listWorkflowRuns() async throws -> [WorkflowRun] {
        []
    }

    func artifactURL(jobId: String, relativePath: String) -> URL? {
        nil
    }

    func eventStream(since sequence: Int?) -> AsyncThrowingStream<MissionControlEventEnvelope, Error> {
        AsyncThrowingStream { continuation in
            continuation.onTermination = { _ in
                onTermination()
            }
            continuation.finish()
        }
    }
}
