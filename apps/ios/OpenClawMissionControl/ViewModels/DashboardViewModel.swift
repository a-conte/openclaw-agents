import Foundation

@MainActor
final class DashboardViewModel: ObservableObject {
    @Published private(set) var snapshot: DashboardSnapshot?
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?

    private let client: MissionControlClient
    private var eventsTask: Task<Void, Never>?

    init(client: MissionControlClient) {
        self.client = client
    }

    deinit {
        eventsTask?.cancel()
    }

    func start() async {
        await refreshSnapshotAndRestartStream()
    }

    func retry() async {
        await refreshSnapshotAndRestartStream()
    }

    private func refreshSnapshotAndRestartStream() async {
        if await loadInitialSnapshot() {
            startEventLoop()
        }
    }

    @discardableResult
    private func loadInitialSnapshot() async -> Bool {
        isLoading = true
        defer { isLoading = false }

        do {
            snapshot = try await client.loadInitialSnapshot()
            errorMessage = nil
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    private func startEventLoop() {
        eventsTask?.cancel()
        let currentSequence = snapshot?.sequence

        eventsTask = Task {
            var receivedEvent = false
            do {
                for try await event in client.eventStream(since: currentSequence) {
                    receivedEvent = true
                    apply(event)
                }
                if !Task.isCancelled && receivedEvent {
                    errorMessage = "Live updates disconnected. Showing cached snapshot until a fresh connection succeeds."
                }
            } catch {
                if !Task.isCancelled {
                    errorMessage = error.localizedDescription
                }
            }
        }
    }

    private func apply(_ event: MissionControlEventEnvelope) {
        if let currentSequence = snapshot?.sequence {
            if event.sequence <= currentSequence || event.sequence > currentSequence + 1 {
                Task { await refreshSnapshotAndRestartStream() }
                return
            }
        }

        switch event.eventType {
        case "snapshot.invalidated":
            Task { await refreshSnapshotAndRestartStream() }
        case "agent.updated":
            guard var snapshot else { return }
            if let index = snapshot.agents.firstIndex(where: { $0.agentId == event.entityId }) {
                let existing = snapshot.agents[index]
                snapshot.agents[index] = AgentSummary(
                    agentId: existing.agentId,
                    name: event.payload.name ?? existing.name,
                    status: event.payload.status ?? existing.status,
                    lastActivity: event.payload.lastActivity ?? existing.lastActivity
                )
            } else {
                snapshot.agents.append(
                    AgentSummary(
                        agentId: event.entityId,
                        name: event.payload.name,
                        status: event.payload.status,
                        lastActivity: event.payload.lastActivity
                    )
                )
            }
            snapshot.updatedAt = event.emittedAt
            snapshot.sequence = event.sequence
            self.snapshot = snapshot
        default:
            break
        }
    }

    var agents: [AgentSummary] {
        snapshot?.agents ?? []
    }

    var statusLine: String {
        guard let snapshot else { return "Waiting for snapshot" }
        return "Updated \(snapshot.updatedAt.formatted(date: .omitted, time: .shortened))"
    }
}
