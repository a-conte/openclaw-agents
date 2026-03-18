import Foundation

@MainActor
final class DashboardViewModel: ObservableObject {
    @Published private(set) var snapshot: DashboardSnapshot?
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published private(set) var jobs: [Job] = []
    @Published private(set) var tasks: [TaskItem] = []
    @Published private(set) var workflowRuns: [WorkflowRun] = []
    @Published private(set) var archivedJobs: [Job] = []

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
                    status: event.payload.agentStatus ?? existing.status,
                    lastActivity: event.payload.lastActivity ?? existing.lastActivity
                )
            }
            snapshot.generatedAt = event.emittedAt
            snapshot.sequence = event.sequence
            self.snapshot = snapshot
        case "job.updated":
            if let job = event.payload.toJob() {
                if let index = jobs.firstIndex(where: { $0.id == job.id }) {
                    jobs[index] = job
                } else {
                    jobs.insert(job, at: 0)
                }
            }
            if var snapshot {
                snapshot.sequence = event.sequence
                self.snapshot = snapshot
            }
        default:
            break
        }
    }

    var agents: [AgentSummary] {
        snapshot?.agents ?? []
    }

    var counts: MissionControlCounts {
        snapshot?.counts ?? .zero
    }

    var statusLine: String {
        guard let snapshot else { return "Waiting for snapshot" }
        return "Updated \(snapshot.generatedAt.formatted(date: .omitted, time: .shortened))"
    }

    func loadJobs() async {
        do {
            jobs = try await client.listJobs(archived: false)
        } catch {
            if !Task.isCancelled {
                errorMessage = error.localizedDescription
            }
        }
    }

    func loadArchivedJobs() async {
        do {
            archivedJobs = try await client.listJobs(archived: true)
        } catch {
            if !Task.isCancelled {
                errorMessage = error.localizedDescription
            }
        }
    }

    func loadTasks() async {
        do {
            tasks = try await client.listTasks()
        } catch {
            if !Task.isCancelled {
                errorMessage = error.localizedDescription
            }
        }
    }

    func loadWorkflowRuns() async {
        do {
            workflowRuns = try await client.listWorkflowRuns()
        } catch {
            if !Task.isCancelled {
                errorMessage = error.localizedDescription
            }
        }
    }

    func submitJob(request: JobRequest) async {
        do {
            let job = try await client.submitJob(request: request)
            jobs.insert(job, at: 0)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func stopJob(id: String) async {
        do {
            try await client.stopJob(id: id)
            await loadJobs()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func clearJobs() async {
        do {
            try await client.clearJobs()
            await loadJobs()
            await loadArchivedJobs()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
