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

    func submitJob(prompt: String, agent: String) async throws -> Job {
        Job.preview
    }

    func listJobs() async throws -> [Job] {
        []
    }

    func listTasks() async throws -> [TaskItem] {
        []
    }

    func listWorkflowRuns() async throws -> [WorkflowRun] {
        []
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
