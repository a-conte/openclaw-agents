import XCTest
@testable import OpenClawMissionControl

final class MissionControlJSONTests: XCTestCase {
    func testDecoderAcceptsFractionalSecondISO8601Dates() throws {
        let data = Data(
            """
            {
              "agents": [],
              "generatedAt": "2026-03-08T04:24:53.853Z",
              "sequence": 1,
              "counts": {
                "quietAgents": 0, "staleTasks": 0, "failedRuns": 0,
                "inProgressTasks": 0, "dirtyRepos": 0, "radarCount": 0
              }
            }
            """.utf8
        )

        let snapshot = try MissionControlJSON.makeDecoder().decode(DashboardSnapshot.self, from: data)

        XCTAssertEqual(snapshot.sequence, 1)
        XCTAssertEqual(snapshot.counts, .zero)
    }

    func testDecoderAcceptsWholeSecondISO8601Dates() throws {
        let data = Data(
            """
            {
              "agents": [],
              "generatedAt": "2026-03-14T21:00:00Z",
              "sequence": 2,
              "counts": {
                "quietAgents": 1, "staleTasks": 2, "failedRuns": 1,
                "inProgressTasks": 3, "dirtyRepos": 1, "radarCount": 4
              }
            }
            """.utf8
        )

        let snapshot = try MissionControlJSON.makeDecoder().decode(DashboardSnapshot.self, from: data)

        XCTAssertEqual(snapshot.sequence, 2)
        XCTAssertEqual(snapshot.counts.failedRuns, 1)
    }

    func testDecoderAcceptsFullSnapshotPayload() throws {
        let data = Data(
            """
            {
              "sequence": 42,
              "generatedAt": "2026-03-15T04:00:00.000Z",
              "agents": [
                {
                  "agentId": "main",
                  "name": "main",
                  "status": "online",
                  "lastActivity": 1742011200000
                }
              ],
              "counts": {
                "quietAgents": 1,
                "staleTasks": 0,
                "failedRuns": 2,
                "inProgressTasks": 3,
                "dirtyRepos": 1,
                "radarCount": 4
              }
            }
            """.utf8
        )

        let snapshot = try MissionControlJSON.makeDecoder().decode(DashboardSnapshot.self, from: data)

        XCTAssertEqual(snapshot.sequence, 42)
        XCTAssertEqual(snapshot.agents.count, 1)
        XCTAssertEqual(snapshot.agents[0].agentId, "main")
        XCTAssertEqual(snapshot.agents[0].status, .online)
        XCTAssertEqual(snapshot.counts.inProgressTasks, 3)
    }

    func testDecoderAcceptsAgentUpdatedEventEnvelope() throws {
        let data = Data(
            """
            {
              "eventId": "evt-10",
              "sequence": 10,
              "eventType": "agent.updated",
              "entityId": "main",
              "emittedAt": "2026-03-15T04:00:00.000Z",
              "payload": {
                "agentId": "main",
                "name": "main",
                "status": "online",
                "lastActivity": 1742011200000
              }
            }
            """.utf8
        )

        let envelope = try MissionControlJSON.makeDecoder().decode(MissionControlEventEnvelope.self, from: data)

        XCTAssertEqual(envelope.eventType, "agent.updated")
        XCTAssertEqual(envelope.payload.agentId, "main")
        XCTAssertEqual(envelope.payload.status, .online)
    }

    func testDecoderAcceptsSnapshotInvalidatedEventEnvelope() throws {
        let data = Data(
            """
            {
              "eventId": "evt-11",
              "sequence": 11,
              "eventType": "snapshot.invalidated",
              "entityId": "mission-control",
              "emittedAt": "2026-03-15T04:01:00.000Z",
              "payload": {
                "reason": "counts-changed"
              }
            }
            """.utf8
        )

        let envelope = try MissionControlJSON.makeDecoder().decode(MissionControlEventEnvelope.self, from: data)

        XCTAssertEqual(envelope.eventType, "snapshot.invalidated")
        XCTAssertEqual(envelope.payload.reason, "counts-changed")
    }
}
