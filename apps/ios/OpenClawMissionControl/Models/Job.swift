import Foundation

struct Job: Codable, Identifiable, Equatable {
    let id: String
    let prompt: String
    let targetAgent: String
    let status: JobStatus
    let priority: JobPriority?
    let mode: JobMode?
    let command: String?
    let workflow: String?
    let args: [String]?
    let createdAt: Date
    var startedAt: Date?
    var completedAt: Date?
    var result: String?
    var error: String?
    var summary: String?
    var updates: [JobUpdate]

    static let preview = Job(
        id: "job-preview-1",
        prompt: "",
        targetAgent: "main",
        status: .completed,
        priority: nil,
        mode: .workflow,
        command: nil,
        workflow: "safari_open_command_page",
        args: [],
        createdAt: Date(),
        startedAt: Date(),
        completedAt: Date(),
        result: "{\"ok\":true}",
        summary: "Workflow safari_open_command_page completed",
        updates: [JobUpdate(at: Date(), message: "Opened command page in Safari")]
    )

    init(
        id: String,
        prompt: String,
        targetAgent: String,
        status: JobStatus,
        priority: JobPriority?,
        mode: JobMode?,
        command: String?,
        workflow: String?,
        args: [String]?,
        createdAt: Date,
        startedAt: Date? = nil,
        completedAt: Date? = nil,
        result: String? = nil,
        error: String? = nil,
        summary: String? = nil,
        updates: [JobUpdate] = []
    ) {
        self.id = id
        self.prompt = prompt
        self.targetAgent = targetAgent
        self.status = status
        self.priority = priority
        self.mode = mode
        self.command = command
        self.workflow = workflow
        self.args = args
        self.createdAt = createdAt
        self.startedAt = startedAt
        self.completedAt = completedAt
        self.result = result
        self.error = error
        self.summary = summary
        self.updates = updates
    }

    enum CodingKeys: String, CodingKey {
        case id
        case prompt
        case targetAgent
        case status
        case priority
        case mode
        case command
        case workflow
        case args
        case createdAt
        case startedAt
        case completedAt
        case result
        case error
        case summary
        case updates
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        prompt = try container.decode(String.self, forKey: .prompt)
        targetAgent = try container.decode(String.self, forKey: .targetAgent)
        status = try container.decode(JobStatus.self, forKey: .status)
        priority = try container.decodeIfPresent(JobPriority.self, forKey: .priority)
        mode = try container.decodeIfPresent(JobMode.self, forKey: .mode)
        command = try container.decodeIfPresent(String.self, forKey: .command)
        workflow = try container.decodeIfPresent(String.self, forKey: .workflow)
        args = try container.decodeIfPresent([String].self, forKey: .args)
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        startedAt = try container.decodeIfPresent(Date.self, forKey: .startedAt)
        completedAt = try container.decodeIfPresent(Date.self, forKey: .completedAt)
        if let stringResult = try? container.decodeIfPresent(String.self, forKey: .result) {
            result = stringResult
        } else if let jsonValue = try? container.decodeIfPresent(JSONValue.self, forKey: .result) {
            result = jsonValue.displayString
        } else {
            result = nil
        }
        error = try container.decodeIfPresent(String.self, forKey: .error)
        summary = try container.decodeIfPresent(String.self, forKey: .summary)
        updates = try container.decodeIfPresent([JobUpdate].self, forKey: .updates) ?? []
    }
}

enum JobStatus: String, Codable, Equatable {
    case queued
    case running
    case completed
    case failed
    case stopped
}

enum JobPriority: String, Codable, Equatable {
    case normal
    case high
    case urgent
}

enum JobMode: String, Codable, Equatable, CaseIterable {
    case agent
    case shell
    case steer
    case drive
    case workflow
    case note
}

struct JobUpdate: Codable, Equatable, Identifiable {
    var id: String { "\(at.timeIntervalSince1970)-\(message)" }
    let at: Date
    let message: String
}
