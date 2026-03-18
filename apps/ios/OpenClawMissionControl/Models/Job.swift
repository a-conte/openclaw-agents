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
    let templateId: String?
    let templateInputs: [String: String]
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
        templateId: "open_command_page",
        templateInputs: ["url": "http://localhost:3000/command"],
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
        templateId: String? = nil,
        templateInputs: [String: String] = [:],
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
        self.templateId = templateId
        self.templateInputs = templateInputs
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
        case templateId
        case templateInputs
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
        templateId = try container.decodeIfPresent(String.self, forKey: .templateId)
        templateInputs = try container.decodeIfPresent([String: String].self, forKey: .templateInputs) ?? [:]
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
    let durationMs: Int?
    let result: String?
    let error: String?
    let artifacts: [String: JSONValue]

    init(id: String, name: String, type: String, status: JobStepState, dangerous: Bool?, startedAt: Date?, completedAt: Date?, durationMs: Int? = nil, result: String?, error: String?, artifacts: [String: JSONValue] = [:]) {
        self.id = id
        self.name = name
        self.type = type
        self.status = status
        self.dangerous = dangerous
        self.startedAt = startedAt
        self.completedAt = completedAt
        self.durationMs = durationMs
        self.result = result
        self.error = error
        self.artifacts = artifacts
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
        durationMs = try container.decodeIfPresent(Int.self, forKey: .durationMs)
        if let stringResult = try? container.decodeIfPresent(String.self, forKey: .result) {
            result = stringResult
        } else if let jsonValue = try? container.decodeIfPresent(JSONValue.self, forKey: .result) {
            result = jsonValue.displayString
        } else {
            result = nil
        }
        error = try container.decodeIfPresent(String.self, forKey: .error)
        artifacts = try container.decodeIfPresent([String: JSONValue].self, forKey: .artifacts) ?? [:]
    }

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case type
        case status
        case dangerous
        case startedAt
        case completedAt
        case durationMs
        case result
        case error
        case artifacts
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
    var id: String { jobId ?? "\(attempt ?? 0)-\(status ?? "unknown")" }
    let jobId: String?
    let attempt: Int?
    let status: String?
    let mode: String?
    let resumeFromStepId: String?
    let completedAt: Date?
    let summary: String?
}

struct NotificationPreferences: Codable, Equatable {
    let dashboardPrimary: Bool
    let severityThreshold: String
    let channels: NotificationChannels
    let agentAllowlist: [String]
    let templateAllowlist: [String]
    let updatedAt: Date?
}

struct NotificationChannels: Codable, Equatable {
    let push: Bool
    let notes: Bool
    let imessage: Bool
    let mail_draft: Bool
}

struct NotificationDevice: Codable, Equatable, Identifiable {
    let id: String
    let name: String
    let platform: String
    let token: String?
    let registeredAt: Date?
    let lastSeenAt: Date?
}

struct NotificationEvent: Codable, Equatable, Identifiable {
    let id: String
    let jobId: String
    let status: String
    let severity: String
    let title: String
    let body: String
    let channels: [String]
    let createdAt: Date
    let targetAgent: String?
    let templateId: String?
    let summary: String?
    let dashboardPrimary: Bool?
}

struct JobTemplate: Codable, Equatable, Identifiable {
    let id: String
    let name: String
    let description: String
    let category: String?
    let builtIn: Bool?
    let favorite: Bool?
    let recommended: Bool?
    let artifactRetentionDays: Int?
    let version: Int?
    let createdAt: Date?
    let updatedAt: Date?
    let inputs: [JobTemplateInput]
    let workflowSpec: JSONValue?
}

struct JobTemplateInput: Codable, Equatable, Identifiable {
    var id: String { key }
    let key: String
    let label: String
    let description: String?
    let required: Bool?
    let defaultValue: String?
}

struct JobTemplateVersion: Codable, Equatable, Identifiable {
    var id: String { "\(version)-\(updatedAt?.timeIntervalSince1970 ?? 0)" }
    let version: Int
    let updatedAt: Date?
    let name: String?
    let description: String?
    let workflowSpec: JSONValue?
    let builtIn: Bool?
}

struct JobTemplateDiff: Codable, Equatable, Identifiable {
    var id: String { "\(templateId)-\(fromVersion)-\(toVersion)" }
    let templateId: String
    let fromVersion: Int
    let toVersion: Int
    let from: JobTemplateVersion?
    let to: JobTemplateVersion?
    let diff: String
}

struct ArtifactAdminSummary: Codable, Equatable {
    struct Group: Codable, Equatable {
        let jobCount: Int
        let bytes: Int
        let jobs: [String]?
    }

    let active: Group
    let archived: Group
    let retentionDays: Int?
    let oldestArchivedAgeDays: Double?
}

struct ArtifactAdminActionResult: Codable, Equatable {
    let removedJobs: [String]
    let removedBytes: Int
    let compressedJobs: [String]
    let compressedBytes: Int
    let olderThanDays: Int?
}

struct JobMetrics: Codable, Equatable {
    struct Jobs: Codable, Equatable {
        let active: Int
        let archived: Int
        let total: Int
        let statusCounts: [String: Int]
        let modeCounts: [String: Int]
        let averageCompletedDurationMs: Int?
        let medianCompletedDurationMs: Int?
        let p95CompletedDurationMs: Int?
    }

    struct TemplateUsage: Codable, Equatable, Identifiable {
        var id: String { templateId }
        let templateId: String
        let count: Int
    }

    struct TemplatePerformance: Codable, Equatable, Identifiable {
        var id: String { templateId }
        let templateId: String
        let total: Int
        let completed: Int
        let failed: Int
        let successRate: Int
    }

    struct Templates: Codable, Equatable {
        let total: Int
        let custom: Int
        let usage: [TemplateUsage]
        let performance: [TemplatePerformance]
    }

    struct StepFailure: Codable, Equatable, Identifiable {
        var id: String { name }
        let name: String
        let count: Int
    }

    struct ArtifactVolume: Codable, Equatable, Identifiable {
        var id: String { name }
        let name: String
        let count: Int
        let bytes: Int
    }

    struct Steps: Codable, Equatable {
        let topFailures: [StepFailure]
        let artifactVolume: [ArtifactVolume]
    }

    struct PolicyBlock: Codable, Equatable, Identifiable {
        var id: String { reason }
        let reason: String
        let count: Int
    }

    struct Policy: Codable, Equatable {
        let blockedJobs: Int
        let topBlockReasons: [PolicyBlock]
    }

    struct LongRunning: Codable, Equatable, Identifiable {
        var id: String { self.jobId ?? "\(mode ?? "job")-\(ageMs ?? 0)" }
        let jobId: String?
        let mode: String?
        let templateId: String?
        let workflow: String?
        let ageMs: Int?

        private enum CodingKeys: String, CodingKey {
            case jobId = "id"
            case mode
            case templateId
            case workflow
            case ageMs
        }
    }

    struct Trend: Codable, Equatable, Identifiable {
        var id: String { date }
        let date: String
        let total: Int
        let completed: Int
        let failed: Int
        let blocked: Int
    }

    struct RetryChain: Codable, Equatable, Identifiable {
        var id: String { rootJobId }
        let rootJobId: String
        let attempts: Int
        let latestJobId: String?
        let latestStatus: String?
        let templateId: String?
        let updatedAt: String?
        let jobIds: [String]?
    }

    struct Lineage: Codable, Equatable {
        let recentChains: [RetryChain]
    }

    let jobs: Jobs
    let templates: Templates
    let steps: Steps
    let policy: Policy
    let longRunning: [LongRunning]
    let trends: [Trend]
    let lineage: Lineage
    let artifacts: ArtifactAdminSummary
}

struct PolicyAdmin: Codable, Equatable {
    struct Entry: Codable, Equatable, Identifiable {
        var id: String { name }
        let name: String
        let value: String
        let description: String
        let example: String?
    }

    let policy: JobPolicy
    let env: [Entry]
    let summary: String?
}
