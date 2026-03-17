import Foundation

struct WorkflowRun: Codable, Identifiable, Equatable {
    let id: String
    let workflowName: String
    let status: WorkflowRunStatus
    let steps: [WorkflowRunStep]
    let startedAt: Date
    var completedAt: Date?
    var error: String?
    let triggeredBy: String
}

enum WorkflowRunStatus: String, Codable, Equatable {
    case pending
    case running
    case completed
    case failed
}

struct WorkflowRunStep: Codable, Equatable {
    let stepIndex: Int
    let agent: String
    let action: String
    let status: String
    var startedAt: Date?
    var completedAt: Date?
    var output: String?
    var error: String?
}
