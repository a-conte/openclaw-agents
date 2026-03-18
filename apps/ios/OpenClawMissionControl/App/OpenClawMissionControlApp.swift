import SwiftUI
import UserNotifications

@main
struct OpenClawMissionControlApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var viewModel = DashboardViewModel(
        client: AppBootstrap.makeClient()
    )

    var body: some Scene {
        WindowGroup {
            DashboardView(viewModel: viewModel)
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .list, .sound])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        if let jobId = response.notification.request.content.userInfo["jobId"] as? String, !jobId.isEmpty {
            NotificationCenter.default.post(name: .openNotificationJob, object: jobId)
        }
        completionHandler()
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
