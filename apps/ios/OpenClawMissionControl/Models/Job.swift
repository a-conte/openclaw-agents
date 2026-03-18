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
    let workflowSpec: JSONValue?
    let args: [String]?
    let createdAt: Date
    var startedAt: Date?
    var completedAt: Date?
    var result: String?
    var error: String?
    var summary: String?
    var updates: [JobUpdate]
    var stepStatus: [JobStepStatus]
    var currentStepId: String?
    var timedOut: Bool
    var attempt: Int
    var retryOf: String?
    var retryMode: String?
    var resumeFromStepId: String?
    var history: [JobAttempt]
    var policy: JobPolicy?

    static let preview = Job(
        id: "job-preview-1",
        prompt: "",
        targetAgent: "main",
        status: .completed,
        priority: nil,
        mode: .workflow,
        command: nil,
        workflow: "safari_open_command_page",
        workflowSpec: nil,
        args: [],
        createdAt: Date(),
        startedAt: Date(),
        completedAt: Date(),
        result: "{\"ok\":true}",
        summary: "Workflow safari_open_command_page completed",
        updates: [JobUpdate(at: Date(), message: "Opened command page in Safari")],
        stepStatus: [JobStepStatus(id: "open", name: "Open command page", type: "steer", status: .completed, dangerous: false, startedAt: Date(), completedAt: Date(), result: "{\"ok\":true}", error: nil)],
        currentStepId: nil,
        timedOut: false,
        attempt: 1,
        retryOf: nil,
        retryMode: nil,
        resumeFromStepId: nil,
        history: [],
        policy: JobPolicy(allowed: true, reason: nil, allowDangerous: false, allowedSteerCommands: [], allowedDriveCommands: [], allowedWorkflows: [], version: 1)
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
        workflowSpec: JSONValue?,
        args: [String]?,
        createdAt: Date,
        startedAt: Date? = nil,
        completedAt: Date? = nil,
        result: String? = nil,
        error: String? = nil,
        summary: String? = nil,
        updates: [JobUpdate] = [],
        stepStatus: [JobStepStatus] = [],
        currentStepId: String? = nil,
        timedOut: Bool = false,
        attempt: Int = 1,
        retryOf: String? = nil,
        retryMode: String? = nil,
        resumeFromStepId: String? = nil,
        history: [JobAttempt] = [],
        policy: JobPolicy? = nil
    ) {
        self.id = id
        self.prompt = prompt
        self.targetAgent = targetAgent
        self.status = status
        self.priority = priority
        self.mode = mode
        self.command = command
        self.workflow = workflow
        self.workflowSpec = workflowSpec
        self.args = args
        self.createdAt = createdAt
        self.startedAt = startedAt
        self.completedAt = completedAt
        self.result = result
        self.error = error
        self.summary = summary
        self.updates = updates
        self.stepStatus = stepStatus
        self.currentStepId = currentStepId
        self.timedOut = timedOut
        self.attempt = attempt
        self.retryOf = retryOf
        self.retryMode = retryMode
        self.resumeFromStepId = resumeFromStepId
        self.history = history
        self.policy = policy
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
        case workflowSpec
        case args
        case createdAt
        case startedAt
        case completedAt
        case result
        case error
        case summary
        case updates
        case stepStatus
        case currentStepId
        case timedOut
        case attempt
        case retryOf
        case retryMode
        case resumeFromStepId
        case history
        case policy
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
        workflowSpec = try container.decodeIfPresent(JSONValue.self, forKey: .workflowSpec)
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
        stepStatus = try container.decodeIfPresent([JobStepStatus].self, forKey: .stepStatus) ?? []
        currentStepId = try container.decodeIfPresent(String.self, forKey: .currentStepId)
        timedOut = try container.decodeIfPresent(Bool.self, forKey: .timedOut) ?? false
        attempt = try container.decodeIfPresent(Int.self, forKey: .attempt) ?? 1
        retryOf = try container.decodeIfPresent(String.self, forKey: .retryOf)
        retryMode = try container.decodeIfPresent(String.self, forKey: .retryMode)
        resumeFromStepId = try container.decodeIfPresent(String.self, forKey: .resumeFromStepId)
        history = try container.decodeIfPresent([JobAttempt].self, forKey: .history) ?? []
        policy = try container.decodeIfPresent(JobPolicy.self, forKey: .policy)
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
    let level: JobUpdateLevel?
    let stepId: String?

    init(at: Date, message: String, level: JobUpdateLevel? = nil, stepId: String? = nil) {
        self.at = at
        self.message = message
        self.level = level
        self.stepId = stepId
    }
}

enum JobUpdateLevel: String, Codable, Equatable {
    case info
    case error
}

enum JobStepState: String, Codable, Equatable {
    case pending
    case running
    case completed
    case failed
    case skipped
}

struct JobStepStatus: Codable, Equatable, Identifiable {
    let id: String
    let name: String
    let type: String
    let status: JobStepState
    let dangerous: Bool?
    let startedAt: Date?
    let completedAt: Date?
    let result: String?
    let error: String?

    init(id: String, name: String, type: String, status: JobStepState, dangerous: Bool?, startedAt: Date?, completedAt: Date?, result: String?, error: String?) {
        self.id = id
        self.name = name
        self.type = type
        self.status = status
        self.dangerous = dangerous
        self.startedAt = startedAt
        self.completedAt = completedAt
        self.result = result
        self.error = error
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        type = try container.decode(String.self, forKey: .type)
        status = try container.decode(JobStepState.self, forKey: .status)
        dangerous = try container.decodeIfPresent(Bool.self, forKey: .dangerous)
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
    }
}

struct JobPolicy: Codable, Equatable {
    let allowed: Bool
    let reason: String?
    let allowDangerous: Bool?
    let allowedSteerCommands: [String]?
    let allowedDriveCommands: [String]?
    let allowedWorkflows: [String]?
    let version: Int?
}

struct JobAttempt: Codable, Equatable, Identifiable {
    var id: String { jobId ?? "\(attempt)-\(status ?? "unknown")" }
    let jobId: String?
    let attempt: Int?
    let status: String?
    let mode: String?
    let resumeFromStepId: String?
    let completedAt: Date?
    let summary: String?
}
