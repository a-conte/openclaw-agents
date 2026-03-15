import Foundation

enum AgentStatus: String, Codable, CaseIterable {
    case online
    case warning
    case offline
}

// Mirrors the shared AgentSummaryContract fields for the first iPad shell.
struct AgentSummary: Identifiable, Codable, Hashable {
    let agentId: String
    let name: String?
    let status: AgentStatus?
    let lastActivity: TimeInterval?

    var id: String { agentId }
    var displayName: String { name ?? agentId }
}
