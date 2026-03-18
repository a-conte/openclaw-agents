import SwiftUI

enum SidebarSection: String, CaseIterable, Identifiable {
    case agentStatus = "Agent Status"
    case tasks = "Tasks"
    case workflows = "Workflows"
    case jobs = "Jobs"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .agentStatus: return "bolt.horizontal.circle"
        case .tasks: return "checklist"
        case .workflows: return "point.3.connected.trianglepath.dotted"
        case .jobs: return "paperplane"
        }
    }
}

struct DashboardView: View {
    @ObservedObject var viewModel: DashboardViewModel
    @State private var selectedSection: SidebarSection? = .agentStatus

    var body: some View {
        NavigationSplitView {
            sidebar
        } detail: {
            detail
        }
        .task {
            if viewModel.snapshot == nil {
                await viewModel.start()
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .openNotificationJob)) { output in
            guard let jobId = output.object as? String else { return }
            selectedSection = .jobs
            viewModel.openJobFromNotification(jobId: jobId)
        }
    }

    private var sidebar: some View {
        List(selection: $selectedSection) {
            Section("Mission Control") {
                ForEach(SidebarSection.allCases) { section in
                    Label(section.rawValue, systemImage: section.icon)
                        .tag(section)
                }
            }

            Section("Status") {
                Text(viewModel.statusLine)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("OpenClaw")
    }

    @ViewBuilder
    private var detail: some View {
        switch selectedSection {
        case .tasks:
            TasksView(viewModel: viewModel)
        case .workflows:
            WorkflowsView(viewModel: viewModel)
        case .jobs:
            JobSubmitView(viewModel: viewModel)
        case .agentStatus, nil:
            agentStatusDetail
        }
    }

    private var agentStatusDetail: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header

                if let errorMessage = viewModel.errorMessage, viewModel.agents.isEmpty {
                    ContentUnavailableView("Snapshot unavailable", systemImage: "wifi.slash", description: Text(errorMessage))
                } else if viewModel.isLoading && viewModel.agents.isEmpty {
                    ProgressView("Loading Mission Control")
                        .frame(maxWidth: .infinity, minHeight: 240)
                } else {
                    if let errorMessage = viewModel.errorMessage {
                        staleSnapshotBanner(message: errorMessage)
                    }
                    countsSection
                    agentSection
                }
            }
            .padding(24)
        }
        .background(Color(uiColor: .systemGroupedBackground))
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Mission Control")
                .font(.largeTitle.bold())
            Text("An iPad-first operational shell optimized for quick recognition, low-latency refresh, and focused command awareness.")
                .font(.body)
                .foregroundStyle(.secondary)
        }
    }

    private var countsSection: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 12)], spacing: 12) {
            CountTile(label: "In Progress", value: viewModel.counts.inProgressTasks, icon: "arrow.triangle.2.circlepath", color: .blue)
            CountTile(label: "Stale Tasks", value: viewModel.counts.staleTasks, icon: "clock.badge.exclamationmark", color: .orange)
            CountTile(label: "Failed Runs", value: viewModel.counts.failedRuns, icon: "xmark.circle", color: .red)
            CountTile(label: "Quiet Agents", value: viewModel.counts.quietAgents, icon: "moon.zzz", color: .purple)
            CountTile(label: "Dirty Repos", value: viewModel.counts.dirtyRepos, icon: "externaldrive.badge.exclamationmark", color: .yellow)
            CountTile(label: "Radar", value: viewModel.counts.radarCount, icon: "antenna.radiowaves.left.and.right", color: .teal)
        }
    }

    private var agentSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Agents")
                .font(.title2.bold())

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 240), spacing: 16)], spacing: 16) {
                ForEach(viewModel.agents) { agent in
                    AgentCardView(agent: agent)
                }
            }
        }
    }

    private func staleSnapshotBanner(message: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
            VStack(alignment: .leading, spacing: 4) {
                Text("Showing cached snapshot")
                    .font(.headline)
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Retry") {
                Task {
                    await viewModel.retry()
                }
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(16)
        .background(Color.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

private struct AgentCardView: View {
    let agent: AgentSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(agent.displayName)
                    .font(.headline)
                Spacer()
                statusBadge
            }

            Text(agent.agentId)
                .font(.subheadline.monospaced())
                .foregroundStyle(.secondary)

            if let lastActivity = agent.lastActivity {
                Text(lastSeenText(for: lastActivity))
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                Text("No recent activity")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(borderColor, lineWidth: 1)
        )
    }

    private var statusBadge: some View {
        Text((agent.status?.rawValue ?? "unknown").uppercased())
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(badgeColor.opacity(0.14), in: Capsule())
            .foregroundStyle(badgeColor)
    }

    private var badgeColor: Color {
        switch agent.status {
        case .online:
            return .green
        case .warning:
            return .orange
        case .offline:
            return .red
        case nil:
            return .gray
        }
    }

    private var borderColor: Color {
        badgeColor.opacity(0.3)
    }

    private func lastSeenText(for milliseconds: TimeInterval) -> String {
        let date = Date(timeIntervalSince1970: milliseconds / 1000)
        return "Last activity \(date.formatted(date: .omitted, time: .shortened))"
    }
}

private struct CountTile: View {
    let label: String
    let value: Int
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(color)
            Text("\(value)")
                .font(.title.bold().monospacedDigit())
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(.background, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

#Preview {
    DashboardView(
        viewModel: DashboardViewModel(client: PreviewMissionControlClient())
    )
}
