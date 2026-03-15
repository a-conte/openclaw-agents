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
        // The event transport will be added alongside the canonical Mission Control
        // snapshot endpoint. Keep the seam aligned with the architecture now so the
        // iPad shell does not hard-code a polling-only client model.
        AsyncThrowingStream { continuation in
            continuation.finish()
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
    let name: String?
    let status: AgentStatus?
    let lastActivity: TimeInterval?
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
