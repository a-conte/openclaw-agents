import Foundation

struct MissionControlCounts: Codable, Equatable {
    let quietAgents: Int
    let staleTasks: Int
    let failedRuns: Int
    let inProgressTasks: Int
    let dirtyRepos: Int
    let radarCount: Int

    static let zero = MissionControlCounts(
        quietAgents: 0, staleTasks: 0, failedRuns: 0,
        inProgressTasks: 0, dirtyRepos: 0, radarCount: 0
    )
}
