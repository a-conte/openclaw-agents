import Foundation

struct Job: Codable, Identifiable, Equatable {
    let id: String
    let prompt: String
    let targetAgent: String
    let status: JobStatus
    let priority: JobPriority
    let createdAt: Date
    var startedAt: Date?
    var completedAt: Date?
    var result: String?
    var error: String?

    static let preview = Job(
        id: "job-preview-1",
        prompt: "Check mail for urgent items",
        targetAgent: "mail",
        status: .completed,
        priority: .normal,
        createdAt: Date(),
        startedAt: Date(),
        completedAt: Date(),
        result: "No urgent items found."
    )
}

enum JobStatus: String, Codable, Equatable {
    case queued
    case running
    case completed
    case failed
}

enum JobPriority: String, Codable, Equatable {
    case normal
    case high
    case urgent
}
