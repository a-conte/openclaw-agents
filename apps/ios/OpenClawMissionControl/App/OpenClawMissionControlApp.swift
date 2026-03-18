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
        let rawValue = Bundle.main.object(forInfoDictionaryKey: "MissionControlBaseURL") as? String

        if
            let rawValue,
            !rawValue.isEmpty,
            let baseURL = URL(string: rawValue)
        {
            return HTTPMissionControlClient(baseURL: baseURL)
        }

#if DEBUG
        if let baseURL = URL(string: "http://localhost:3000") {
            return HTTPMissionControlClient(baseURL: baseURL)
        }
#endif

        return UnconfiguredMissionControlClient()
    }
}
