import Foundation

protocol MissionControlClient {
    func loadInitialSnapshot() async throws -> DashboardSnapshot
    func eventStream(since sequence: Int?) -> AsyncThrowingStream<MissionControlEventEnvelope, Error>
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
    let status: AgentStatus?
    let lastActivity: TimeInterval?
    // snapshot.invalidated fields
    let reason: String?
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
