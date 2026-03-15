import SwiftUI

@main
struct OpenClawMissionControlApp: App {
    @StateObject private var viewModel = DashboardViewModel(
        client: AppBootstrap.makeClient()
    )

    var body: some Scene {
        WindowGroup {
            DashboardView(viewModel: viewModel)
        }
    }
}

private enum AppBootstrap {
    static func makeClient() -> MissionControlClient {
        guard
            let rawValue = Bundle.main.object(forInfoDictionaryKey: "MissionControlBaseURL") as? String,
            let baseURL = URL(string: rawValue),
            !rawValue.isEmpty
        else {
            return UnconfiguredMissionControlClient()
        }

        return HTTPMissionControlClient(baseURL: baseURL)
    }
}
