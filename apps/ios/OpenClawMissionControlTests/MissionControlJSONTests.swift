import XCTest
@testable import OpenClawMissionControl

final class MissionControlJSONTests: XCTestCase {
    func testDecoderAcceptsFractionalSecondISO8601Dates() throws {
        let data = Data(
            """
            {
              "agents": [],
              "updatedAt": "2026-03-08T04:24:53.853Z",
              "sequence": 1
            }
            """.utf8
        )

        let snapshot = try MissionControlJSON.makeDecoder().decode(DashboardSnapshot.self, from: data)

        XCTAssertEqual(snapshot.sequence, 1)
    }

    func testDecoderAcceptsWholeSecondISO8601Dates() throws {
        let data = Data(
            """
            {
              "agents": [],
              "updatedAt": "2026-03-14T21:00:00Z",
              "sequence": 2
            }
            """.utf8
        )

        let snapshot = try MissionControlJSON.makeDecoder().decode(DashboardSnapshot.self, from: data)

        XCTAssertEqual(snapshot.sequence, 2)
    }
}
