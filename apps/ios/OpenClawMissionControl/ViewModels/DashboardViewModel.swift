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
    @Published private(set) var jobPolicy: JobPolicy?
    @Published private(set) var policyAdmin: PolicyAdmin?
    @Published private(set) var jobTemplates: [JobTemplate] = []
    @Published private(set) var selectedTemplateVersions: [JobTemplateVersion] = []
    @Published private(set) var selectedTemplateDiff: JobTemplateDiff?
    @Published private(set) var artifactAdmin: ArtifactAdminSummary?
    @Published private(set) var jobMetrics: JobMetrics?

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
            await refreshAdminDataIfNeeded()
            if jobTemplates.isEmpty {
                jobTemplates = (try? await client.listJobTemplates()) ?? []
            }
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

    func retryJob(id: String) async {
        do {
            let job = try await client.retryJob(id: id)
            jobs.insert(job, at: 0)
            await loadJobs()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func resumeJob(id: String, mode: String, resumeFromStepId: String? = nil) async {
        do {
            let job = try await client.resumeJob(id: id, mode: mode, resumeFromStepId: resumeFromStepId)
            jobs.insert(job, at: 0)
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
            await refreshAdminData(force: true)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadTemplateVersions(id: String) async {
        do {
            selectedTemplateVersions = try await client.listTemplateVersions(id: id)
            selectedTemplateDiff = nil
        } catch {
            if !Task.isCancelled {
                errorMessage = error.localizedDescription
            }
        }
    }

    func loadTemplateDiff(id: String, fromVersion: Int, toVersion: Int? = nil) async {
        do {
            selectedTemplateDiff = try await client.templateDiff(id: id, fromVersion: fromVersion, toVersion: toVersion)
        } catch {
            if !Task.isCancelled {
                errorMessage = error.localizedDescription
            }
        }
    }

    func saveTemplate(_ draft: JobTemplateDraft, existingId: String? = nil) async {
        do {
            if let existingId, !existingId.isEmpty {
                _ = try await client.updateJobTemplate(id: existingId, draft: draft)
            } else {
                _ = try await client.createJobTemplate(draft)
            }
            jobTemplates = (try? await client.listJobTemplates()) ?? jobTemplates
            if !draft.id.isEmpty {
                selectedTemplateVersions = (try? await client.listTemplateVersions(id: draft.id)) ?? []
                selectedTemplateDiff = nil
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func restoreTemplate(id: String, version: Int) async {
        do {
            _ = try await client.restoreJobTemplate(id: id, version: version)
            jobTemplates = (try? await client.listJobTemplates()) ?? jobTemplates
            selectedTemplateVersions = (try? await client.listTemplateVersions(id: id)) ?? selectedTemplateVersions
            selectedTemplateDiff = nil
            await refreshAdminData(force: true)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteTemplate(id: String) async {
        do {
            try await client.deleteJobTemplate(id: id)
            jobTemplates = (try? await client.listJobTemplates()) ?? jobTemplates.filter { $0.id != id }
            selectedTemplateVersions = []
            selectedTemplateDiff = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func pruneArtifacts(olderThanDays: Int) async {
        do {
            _ = try await client.pruneArtifacts(olderThanDays: olderThanDays)
            await refreshAdminData(force: true)
            await loadArchivedJobs()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func compressArtifacts(olderThanDays: Int) async {
        do {
            _ = try await client.compressArtifacts(olderThanDays: olderThanDays)
            await refreshAdminData(force: true)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func artifactURL(jobId: String, relativePath: String) -> URL? {
        client.artifactURL(jobId: jobId, relativePath: relativePath)
    }

    private func refreshAdminDataIfNeeded() async {
        if jobPolicy == nil || policyAdmin == nil || artifactAdmin == nil || jobMetrics == nil {
            await refreshAdminData(force: false)
        }
    }

    private func refreshAdminData(force: Bool) async {
        if force || jobPolicy == nil {
            jobPolicy = try? await client.jobPolicy()
        }
        if force || policyAdmin == nil {
            policyAdmin = try? await client.jobPolicyAdmin()
        }
        if force || artifactAdmin == nil {
            artifactAdmin = try? await client.artifactAdmin()
        }
        if force || jobMetrics == nil {
            jobMetrics = try? await client.jobMetrics()
        }
    }
}
