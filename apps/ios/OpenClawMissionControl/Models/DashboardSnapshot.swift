import Foundation

struct DashboardSnapshot: Codable, Equatable {
    var agents: [AgentSummary]
    var generatedAt: Date
    var sequence: Int
    var counts: MissionControlCounts

    static let preview = DashboardSnapshot(
        agents: [
            AgentSummary(agentId: "main", name: "main", status: .online, lastActivity: Date().timeIntervalSince1970 * 1000),
            AgentSummary(agentId: "dev", name: "dev", status: .warning, lastActivity: Date().addingTimeInterval(-900).timeIntervalSince1970 * 1000),
            AgentSummary(agentId: "research", name: "research", status: .offline, lastActivity: Date().addingTimeInterval(-7200).timeIntervalSince1970 * 1000)
        ],
        generatedAt: Date(),
        sequence: 1,
        counts: MissionControlCounts(
            quietAgents: 1, staleTasks: 0, failedRuns: 2,
            inProgressTasks: 3, dirtyRepos: 1, radarCount: 4
        )
    )
}
