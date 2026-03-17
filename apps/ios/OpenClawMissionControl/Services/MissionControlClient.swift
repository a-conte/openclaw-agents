import Foundation

protocol MissionControlClient {
    func loadInitialSnapshot() async throws -> DashboardSnapshot
    func eventStream(since sequence: Int?) -> AsyncThrowingStream<MissionControlEventEnvelope, Error>
    func submitJob(prompt: String, agent: String) async throws -> Job
    func listJobs() async throws -> [Job]
    func listTasks() async throws -> [TaskItem]
    func listWorkflowRuns() async throws -> [WorkflowRun]
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

    func submitJob(prompt: String, agent: String) async throws -> Job {
        Job.preview
    }

    func listJobs() async throws -> [Job] {
        [Job.preview]
    }

    func listTasks() async throws -> [TaskItem] {
        []
    }

    func listWorkflowRuns() async throws -> [WorkflowRun] {
        []
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

    func submitJob(prompt: String, agent: String) async throws -> Job {
        throw ConfigurationError.missingBaseURL
    }

    func listJobs() async throws -> [Job] {
        throw ConfigurationError.missingBaseURL
    }

    func listTasks() async throws -> [TaskItem] {
        throw ConfigurationError.missingBaseURL
    }

    func listWorkflowRuns() async throws -> [WorkflowRun] {
        throw ConfigurationError.missingBaseURL
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

                    let (bytes, _) = try await session.bytes(from: url)
                    var currentEvent: String?
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
                            currentEvent = nil
                            currentData = nil
                        } else if line.hasPrefix("event: ") {
                            currentEvent = String(line.dropFirst(7))
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
}

    func submitJob(prompt: String, agent: String) async throws -> Job {
        let url = baseURL.appending(path: "/api/jobs")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body = ["prompt": prompt, "targetAgent": agent]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, _) = try await session.data(for: request)
        return try MissionControlJSON.makeDecoder().decode(Job.self, from: data)
    }

    func listJobs() async throws -> [Job] {
        let url = baseURL.appending(path: "/api/jobs")
        let (data, _) = try await session.data(from: url)
        return try MissionControlJSON.makeDecoder().decode([Job].self, from: data)
    }

    func listTasks() async throws -> [TaskItem] {
        let url = baseURL.appending(path: "/api/tasks")
        let (data, _) = try await session.data(from: url)
        return try MissionControlJSON.makeDecoder().decode([TaskItem].self, from: data)
    }

    func listWorkflowRuns() async throws -> [WorkflowRun] {
        let url = baseURL.appending(path: "/api/workflows/runs")
        let (data, _) = try await session.data(from: url)
        return try MissionControlJSON.makeDecoder().decode([WorkflowRun].self, from: data)
    }
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
    let createdAt: Date?
    let startedAt: Date?
    let completedAt: Date?
    let result: String?
    let error: String?

    var agentStatus: AgentStatus? {
        status.flatMap { AgentStatus(rawValue: $0) }
    }

    var jobStatus: JobStatus? {
        status.flatMap { JobStatus(rawValue: $0) }
    }

    var jobPriority: JobPriority? {
        priority.flatMap { JobPriority(rawValue: $0) }
    }

    func toJob() -> Job? {
        guard let id, let prompt, let targetAgent, let jobStatus, let jobPriority, let createdAt else { return nil }
        return Job(
            id: id,
            prompt: prompt,
            targetAgent: targetAgent,
            status: jobStatus,
            priority: jobPriority,
            createdAt: createdAt,
            startedAt: startedAt,
            completedAt: completedAt,
            result: result,
            error: error
        )
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
