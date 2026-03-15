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
    }
}

private struct EmptyStreamClient: MissionControlClient {
    let onTermination: @Sendable () -> Void

    func loadInitialSnapshot() async throws -> DashboardSnapshot {
        DashboardSnapshot(
            agents: [AgentSummary(agentId: "main", name: "main", status: .online, lastActivity: nil)],
            updatedAt: Date(),
            sequence: 1
        )
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
