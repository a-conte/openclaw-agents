import Foundation

struct DashboardSnapshot: Codable, Equatable {
    var agents: [AgentSummary]
    var updatedAt: Date
    var sequence: Int?

    static let preview = DashboardSnapshot(
        agents: [
            AgentSummary(agentId: "main", name: "main", status: .online, lastActivity: Date().timeIntervalSince1970 * 1000),
            AgentSummary(agentId: "dev", name: "dev", status: .warning, lastActivity: Date().addingTimeInterval(-900).timeIntervalSince1970 * 1000),
            AgentSummary(agentId: "research", name: "research", status: .offline, lastActivity: Date().addingTimeInterval(-7200).timeIntervalSince1970 * 1000)
        ],
        updatedAt: Date(),
        sequence: 1
    )
}
