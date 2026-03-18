import Foundation

protocol MissionControlClient {
    func loadInitialSnapshot() async throws -> DashboardSnapshot
    func eventStream(since sequence: Int?) -> AsyncThrowingStream<MissionControlEventEnvelope, Error>
    func listJobTemplates() async throws -> [JobTemplate]
    func listTemplateVersions(id: String) async throws -> [JobTemplateVersion]
    func templateDiff(id: String, fromVersion: Int, toVersion: Int?) async throws -> JobTemplateDiff
    func createJobTemplate(_ draft: JobTemplateDraft) async throws -> JobTemplate
    func updateJobTemplate(id: String, draft: JobTemplateDraft) async throws -> JobTemplate
    func restoreJobTemplate(id: String, version: Int) async throws -> JobTemplate
    func deleteJobTemplate(id: String) async throws
    func submitJob(request: JobRequest) async throws -> Job
    func listJobs(archived: Bool) async throws -> [Job]
    func jobPolicy() async throws -> JobPolicy
    func jobPolicyAdmin() async throws -> PolicyAdmin
    func artifactAdmin() async throws -> ArtifactAdminSummary
    func pruneArtifacts(olderThanDays: Int) async throws -> ArtifactAdminActionResult
    func compressArtifacts(olderThanDays: Int) async throws -> ArtifactAdminActionResult
    func jobMetrics() async throws -> JobMetrics
    func stopJob(id: String) async throws
    func retryJob(id: String) async throws -> Job
    func resumeJob(id: String, mode: String, resumeFromStepId: String?) async throws -> Job
    func clearJobs() async throws
    func listTasks() async throws -> [TaskItem]
    func listWorkflowRuns() async throws -> [WorkflowRun]
    func artifactURL(jobId: String, relativePath: String) -> URL?
}

struct PreviewMissionControlClient: MissionControlClient {
    func loadInitialSnapshot() async throws -> DashboardSnapshot {
        DashboardSnapshot.preview
    }

    func eventStream(since sequence: Int?) -> AsyncThrowingStream<MissionControlEventEnvelope, Error> {
        AsyncThrowingStream { continuation in
            continuation.finish()
        }
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

    func templateDiff(id: String, fromVersion: Int, toVersion: Int?) async throws -> JobTemplateDiff {
        JobTemplateDiff(templateId: id, fromVersion: fromVersion, toVersion: toVersion ?? fromVersion, from: nil, to: nil, diff: "")
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

    func restoreJobTemplate(id: String, version: Int) async throws -> JobTemplate {
        try await createJobTemplate(
            JobTemplateDraft(
                id: id,
                name: "Restored",
                description: "Restored template",
                category: "custom",
                favorite: false,
                recommended: false,
                artifactRetentionDays: 30,
                inputs: [],
                workflowSpec: .object([:])
            )
        )
    }

    func deleteJobTemplate(id: String) async throws {
    }

    func listJobs(archived: Bool = false) async throws -> [Job] {
        [Job.preview]
    }

    func jobPolicy() async throws -> JobPolicy {
        Job.preview.policy ?? JobPolicy(allowed: true, reason: nil, allowDangerous: false, allowedSteerCommands: [], allowedDriveCommands: [], allowedWorkflows: [], version: 1)
    }

    func jobPolicyAdmin() async throws -> PolicyAdmin {
        PolicyAdmin(
            policy: JobPolicy(allowed: true, reason: nil, allowDangerous: false, allowedSteerCommands: [], allowedDriveCommands: [], allowedWorkflows: [], version: 1),
            env: [],
            summary: nil
        )
    }

    func artifactAdmin() async throws -> ArtifactAdminSummary {
        ArtifactAdminSummary(active: .init(jobCount: 0, bytes: 0, jobs: []), archived: .init(jobCount: 0, bytes: 0, jobs: []), retentionDays: 30, oldestArchivedAgeDays: nil)
    }

    func pruneArtifacts(olderThanDays: Int) async throws -> ArtifactAdminActionResult {
        ArtifactAdminActionResult(removedJobs: [], removedBytes: 0, compressedJobs: [], compressedBytes: 0, olderThanDays: olderThanDays)
    }

    func compressArtifacts(olderThanDays: Int) async throws -> ArtifactAdminActionResult {
        ArtifactAdminActionResult(removedJobs: [], removedBytes: 0, compressedJobs: [], compressedBytes: 0, olderThanDays: olderThanDays)
    }

    func jobMetrics() async throws -> JobMetrics {
        JobMetrics(
            jobs: .init(active: 0, archived: 0, total: 0, statusCounts: [:], modeCounts: [:], averageCompletedDurationMs: nil, medianCompletedDurationMs: nil, p95CompletedDurationMs: nil),
            templates: .init(total: 0, custom: 0, usage: [], performance: []),
            steps: .init(topFailures: [], artifactVolume: []),
            policy: .init(blockedJobs: 0, topBlockReasons: []),
            longRunning: [],
            trends: [],
            lineage: .init(recentChains: []),
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
}

struct UnconfiguredMissionControlClient: MissionControlClient {
    enum ConfigurationError: LocalizedError {
        case missingBaseURL

        var errorDescription: String? {
            switch self {
            case .missingBaseURL:
                return "Set MissionControlBaseURL in the app configuration to connect the iPad shell."
            }
        }
    }

    func loadInitialSnapshot() async throws -> DashboardSnapshot {
        throw ConfigurationError.missingBaseURL
    }

    func eventStream(since sequence: Int?) -> AsyncThrowingStream<MissionControlEventEnvelope, Error> {
        AsyncThrowingStream { continuation in
            continuation.finish(throwing: ConfigurationError.missingBaseURL)
        }
    }

    func submitJob(request: JobRequest) async throws -> Job {
        throw ConfigurationError.missingBaseURL
    }

    func listJobTemplates() async throws -> [JobTemplate] {
        throw ConfigurationError.missingBaseURL
    }

    func listTemplateVersions(id: String) async throws -> [JobTemplateVersion] {
        throw ConfigurationError.missingBaseURL
    }

    func templateDiff(id: String, fromVersion: Int, toVersion: Int?) async throws -> JobTemplateDiff {
        throw ConfigurationError.missingBaseURL
    }

    func createJobTemplate(_ draft: JobTemplateDraft) async throws -> JobTemplate {
        throw ConfigurationError.missingBaseURL
    }

    func updateJobTemplate(id: String, draft: JobTemplateDraft) async throws -> JobTemplate {
        throw ConfigurationError.missingBaseURL
    }

    func restoreJobTemplate(id: String, version: Int) async throws -> JobTemplate {
        throw ConfigurationError.missingBaseURL
    }

    func deleteJobTemplate(id: String) async throws {
        throw ConfigurationError.missingBaseURL
    }

    func listJobs(archived: Bool = false) async throws -> [Job] {
        throw ConfigurationError.missingBaseURL
    }

    func jobPolicy() async throws -> JobPolicy {
        throw ConfigurationError.missingBaseURL
    }

    func jobPolicyAdmin() async throws -> PolicyAdmin {
        throw ConfigurationError.missingBaseURL
    }

    func artifactAdmin() async throws -> ArtifactAdminSummary {
        throw ConfigurationError.missingBaseURL
    }

    func pruneArtifacts(olderThanDays: Int) async throws -> ArtifactAdminActionResult {
        throw ConfigurationError.missingBaseURL
    }

    func compressArtifacts(olderThanDays: Int) async throws -> ArtifactAdminActionResult {
        throw ConfigurationError.missingBaseURL
    }

    func jobMetrics() async throws -> JobMetrics {
        throw ConfigurationError.missingBaseURL
    }

    func stopJob(id: String) async throws {
        throw ConfigurationError.missingBaseURL
    }

    func retryJob(id: String) async throws -> Job {
        throw ConfigurationError.missingBaseURL
    }

    func resumeJob(id: String, mode: String, resumeFromStepId: String?) async throws -> Job {
        throw ConfigurationError.missingBaseURL
    }

    func clearJobs() async throws {
        throw ConfigurationError.missingBaseURL
    }

    func listTasks() async throws -> [TaskItem] {
        throw ConfigurationError.missingBaseURL
    }

    func listWorkflowRuns() async throws -> [WorkflowRun] {
        throw ConfigurationError.missingBaseURL
    }

    func artifactURL(jobId: String, relativePath: String) -> URL? {
        nil
    }
}

struct HTTPMissionControlClient: MissionControlClient {
    let baseURL: URL
    let session: URLSession = .shared

    func loadInitialSnapshot() async throws -> DashboardSnapshot {
        let url = baseURL.appending(path: "/api/mission-control/snapshot")
        let (data, _) = try await session.data(from: url)
        return try MissionControlJSON.makeDecoder().decode(DashboardSnapshot.self, from: data)
    }

    func eventStream(since sequence: Int?) -> AsyncThrowingStream<MissionControlEventEnvelope, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    var url = baseURL.appending(path: "/api/mission-control/events")
                    if let sequence {
                        url.append(queryItems: [URLQueryItem(name: "since", value: String(sequence))])
                    }
                    var request = URLRequest(url: url)
                    request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
                    request.timeoutInterval = .infinity

                    let (bytes, _) = try await session.bytes(for: request)
                    var currentData: String?

                    for try await line in bytes.lines {
                        if Task.isCancelled { break }

                        if line.isEmpty {
                            // Empty line = end of event
                            if let data = currentData {
                                if let jsonData = data.data(using: .utf8) {
                                    let envelope = try MissionControlJSON.makeDecoder()
                                        .decode(MissionControlEventEnvelope.self, from: jsonData)
                                    continuation.yield(envelope)
                                }
                            }
                            currentData = nil
                        } else if line.hasPrefix("data: ") {
                            currentData = String(line.dropFirst(6))
                        }
                    }
                    continuation.finish()
                } catch {
                    if !Task.isCancelled {
                        continuation.finish(throwing: error)
                    }
                }
            }
            continuation.onTermination = { _ in
                task.cancel()
            }
        }
    }

    func submitJob(request payload: JobRequest) async throws -> Job {
        let url = baseURL.appending(path: "/api/jobs")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(payload)
        let (data, _) = try await session.data(for: request)
        return try MissionControlJSON.makeDecoder().decode(Job.self, from: data)
    }

    func listJobTemplates() async throws -> [JobTemplate] {
        let url = baseURL.appending(path: "/api/jobs/templates")
        let (data, _) = try await session.data(from: url)
        return try MissionControlJSON.makeDecoder().decode([JobTemplate].self, from: data)
    }

    func listTemplateVersions(id: String) async throws -> [JobTemplateVersion] {
        let url = baseURL.appending(path: "/api/jobs/templates/\(id)/versions")
        let (data, _) = try await session.data(from: url)
        return try MissionControlJSON.makeDecoder().decode([JobTemplateVersion].self, from: data)
    }

    func templateDiff(id: String, fromVersion: Int, toVersion: Int?) async throws -> JobTemplateDiff {
        var url = baseURL.appending(path: "/api/jobs/templates/\(id)/diff")
        var items = [URLQueryItem(name: "from", value: String(fromVersion))]
        if let toVersion {
            items.append(URLQueryItem(name: "to", value: String(toVersion)))
        }
        url.append(queryItems: items)
        let (data, _) = try await session.data(from: url)
        return try MissionControlJSON.makeDecoder().decode(JobTemplateDiff.self, from: data)
    }

    func createJobTemplate(_ draft: JobTemplateDraft) async throws -> JobTemplate {
        let url = baseURL.appending(path: "/api/jobs/templates")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(draft)
        let (data, _) = try await session.data(for: request)
        return try MissionControlJSON.makeDecoder().decode(JobTemplate.self, from: data)
    }

    func updateJobTemplate(id: String, draft: JobTemplateDraft) async throws -> JobTemplate {
        let url = baseURL.appending(path: "/api/jobs/templates/\(id)")
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(draft)
        let (data, _) = try await session.data(for: request)
        return try MissionControlJSON.makeDecoder().decode(JobTemplate.self, from: data)
    }

    func restoreJobTemplate(id: String, version: Int) async throws -> JobTemplate {
        let url = baseURL.appending(path: "/api/jobs/templates/\(id)/restore")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["version": version])
        let (data, _) = try await session.data(for: request)
        return try MissionControlJSON.makeDecoder().decode(JobTemplate.self, from: data)
    }

    func deleteJobTemplate(id: String) async throws {
        let url = baseURL.appending(path: "/api/jobs/templates/\(id)")
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        _ = try await session.data(for: request)
    }

    func listJobs(archived: Bool = false) async throws -> [Job] {
        var url = baseURL.appending(path: "/api/jobs")
        if archived {
            url.append(queryItems: [URLQueryItem(name: "archived", value: "true")])
        }
        let (data, _) = try await session.data(from: url)
        return try MissionControlJSON.makeDecoder().decode([Job].self, from: data)
    }

    func jobPolicy() async throws -> JobPolicy {
        let url = baseURL.appending(path: "/api/jobs/policy")
        let (data, _) = try await session.data(from: url)
        return try MissionControlJSON.makeDecoder().decode(JobPolicy.self, from: data)
    }

    func jobPolicyAdmin() async throws -> PolicyAdmin {
        let url = baseURL.appending(path: "/api/jobs/policy/admin")
        let (data, _) = try await session.data(from: url)
        return try MissionControlJSON.makeDecoder().decode(PolicyAdmin.self, from: data)
    }

    func artifactAdmin() async throws -> ArtifactAdminSummary {
        let url = baseURL.appending(path: "/api/jobs/artifacts/admin")
        let (data, _) = try await session.data(from: url)
        return try MissionControlJSON.makeDecoder().decode(ArtifactAdminSummary.self, from: data)
    }

    func pruneArtifacts(olderThanDays: Int) async throws -> ArtifactAdminActionResult {
        let url = baseURL.appending(path: "/api/jobs/artifacts/prune")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["olderThanDays": olderThanDays])
        let (data, _) = try await session.data(for: request)
        return try MissionControlJSON.makeDecoder().decode(ArtifactAdminActionResult.self, from: data)
    }

    func compressArtifacts(olderThanDays: Int) async throws -> ArtifactAdminActionResult {
        let url = baseURL.appending(path: "/api/jobs/artifacts/compress")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["olderThanDays": olderThanDays])
        let (data, _) = try await session.data(for: request)
        return try MissionControlJSON.makeDecoder().decode(ArtifactAdminActionResult.self, from: data)
    }

    func jobMetrics() async throws -> JobMetrics {
        let url = baseURL.appending(path: "/api/jobs/metrics")
        let (data, _) = try await session.data(from: url)
        return try MissionControlJSON.makeDecoder().decode(JobMetrics.self, from: data)
    }

    func stopJob(id: String) async throws {
        let url = baseURL.appending(path: "/api/jobs/\(id)")
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        _ = try await session.data(for: request)
    }

    func retryJob(id: String) async throws -> Job {
        let url = baseURL.appending(path: "/api/jobs/\(id)/retry")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        let (data, _) = try await session.data(for: request)
        return try MissionControlJSON.makeDecoder().decode(Job.self, from: data)
    }

    func resumeJob(id: String, mode: String, resumeFromStepId: String?) async throws -> Job {
        let url = baseURL.appending(path: "/api/jobs/\(id)/retry")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(JobResumeRequest(mode: mode, resumeFromStepId: resumeFromStepId))
        let (data, _) = try await session.data(for: request)
        return try MissionControlJSON.makeDecoder().decode(Job.self, from: data)
    }

    func clearJobs() async throws {
        let url = baseURL.appending(path: "/api/jobs/clear")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        _ = try await session.data(for: request)
    }

    func listTasks() async throws -> [TaskItem] {
        let url = baseURL.appending(path: "/api/tasks")
        let (data, _) = try await session.data(from: url)
        return try MissionControlJSON.makeDecoder().decode([TaskItem].self, from: data)
    }

    func listWorkflowRuns() async throws -> [WorkflowRun] {
        let url = baseURL.appending(path: "/api/workflows/runs")
        let (data, _) = try await session.data(from: url)
        let response = try MissionControlJSON.makeDecoder().decode(WorkflowRunsResponse.self, from: data)
        return response.runs
    }

    func artifactURL(jobId: String, relativePath: String) -> URL? {
        guard var components = URLComponents(url: baseURL.appending(path: "/api/jobs/\(jobId)/artifact"), resolvingAgainstBaseURL: false) else {
            return nil
        }
        components.queryItems = [URLQueryItem(name: "path", value: relativePath)]
        return components.url
    }
}

private struct WorkflowRunsResponse: Codable {
    let runs: [WorkflowRun]
}

struct MissionControlEventEnvelope: Codable, Equatable {
    let eventId: String
    let sequence: Int
    let eventType: String
    let entityId: String
    let emittedAt: Date
    let payload: MissionControlEventPayload
}

struct MissionControlEventPayload: Codable, Equatable {
    // agent.updated fields
    let agentId: String?
    let name: String?
    let status: String?
    let lastActivity: TimeInterval?
    // snapshot.invalidated fields
    let reason: String?
    // job.updated fields
    let id: String?
    let prompt: String?
    let targetAgent: String?
    let priority: String?
    let mode: String?
    let command: String?
    let workflow: String?
    let workflowSpec: JSONValue?
    let templateId: String?
    let templateInputs: [String: String]?
    let args: [String]?
    let createdAt: Date?
    let startedAt: Date?
    let completedAt: Date?
    let result: JSONValue?
    let error: String?
    let summary: String?
    let updates: [JobUpdate]?
    let stepStatus: [JobStepStatus]?
    let currentStepId: String?
    let timedOut: Bool?
    let attempt: Int?
    let retryOf: String?
    let retryMode: String?
    let resumeFromStepId: String?
    let history: [JobAttempt]?
    let policy: JobPolicy?

    var agentStatus: AgentStatus? {
        status.flatMap { AgentStatus(rawValue: $0) }
    }

    var jobStatus: JobStatus? {
        status.flatMap { JobStatus(rawValue: $0) }
    }

    var jobPriority: JobPriority? {
        priority.flatMap { JobPriority(rawValue: $0) }
    }

    var jobMode: JobMode? {
        mode.flatMap { JobMode(rawValue: $0) }
    }

    func toJob() -> Job? {
        guard let id, let prompt, let targetAgent, let jobStatus, let createdAt else { return nil }
        return Job(
            id: id,
            prompt: prompt,
            targetAgent: targetAgent,
            status: jobStatus,
            priority: jobPriority,
            mode: jobMode,
            command: command,
            workflow: workflow,
            workflowSpec: workflowSpec,
            templateId: templateId,
            templateInputs: templateInputs ?? [:],
            args: args,
            createdAt: createdAt,
            startedAt: startedAt,
            completedAt: completedAt,
            result: result?.displayString,
            error: error,
            summary: summary,
            updates: updates ?? [],
            stepStatus: stepStatus ?? [],
            currentStepId: currentStepId,
            timedOut: timedOut ?? false,
            attempt: attempt ?? 1,
            retryOf: retryOf,
            retryMode: retryMode,
            resumeFromStepId: resumeFromStepId,
            history: history ?? [],
            policy: policy
        )
    }
}

struct JobRequest: Codable {
    let prompt: String
    let mode: String
    let targetAgent: String
    let command: String?
    let workflow: String?
    let workflowSpec: JSONValue?
    let templateId: String?
    let templateInputs: [String: String]?
    let args: [String]
    let thinking: String?
    let local: Bool
}

struct JobTemplateDraft: Codable, Equatable {
    let id: String
    let name: String
    let description: String
    let category: String?
    let favorite: Bool
    let recommended: Bool
    let artifactRetentionDays: Int?
    let inputs: [JobTemplateInput]
    let workflowSpec: JSONValue
}

private struct JobResumeRequest: Codable {
    let mode: String
    let resumeFromStepId: String?
}

enum JSONValue: Codable, Equatable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }

    var displayString: String {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            return String(value)
        case .bool(let value):
            return value ? "true" : "false"
        case .null:
            return ""
        case .object, .array:
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            guard let data = try? encoder.encode(self), let text = String(data: data, encoding: .utf8) else {
                return ""
            }
            return text
        }
    }
}

enum MissionControlJSON {
    static func makeDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)

            if let date = ISO8601DateFormatter.full.date(from: value) ?? ISO8601DateFormatter.basic.date(from: value) {
                return date
            }

            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported date format: \(value)")
        }
        return decoder
    }
}

private extension ISO8601DateFormatter {
    static let full: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static let basic: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
}
