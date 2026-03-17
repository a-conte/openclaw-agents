import Foundation

struct TaskItem: Codable, Identifiable, Equatable {
    let id: String
    let title: String
    let description: String
    let status: TaskItemStatus
    let priority: TaskItemPriority
    let agentId: String?
    let labels: [String]
    let projectId: String?
    let dueDate: Date?
    let order: Int
    let createdAt: Date
    let updatedAt: Date
}

enum TaskItemStatus: String, Codable, Equatable {
    case backlog
    case todo
    case inProgress = "in_progress"
    case review
    case done
}

enum TaskItemPriority: String, Codable, Equatable {
    case urgent
    case high
    case medium
    case low
}
