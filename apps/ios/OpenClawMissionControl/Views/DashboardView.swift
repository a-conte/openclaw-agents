import SwiftUI

struct DashboardView: View {
    @ObservedObject var viewModel: DashboardViewModel

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
    }

    private var sidebar: some View {
        List {
            Section("Mission Control") {
                Label("Agent Status", systemImage: "bolt.horizontal.circle")
                Label("Tasks", systemImage: "checklist")
                Label("Workflows", systemImage: "point.3.connected.trianglepath.dotted")
                Label("System Health", systemImage: "heart.text.square")
            }

            Section("Status") {
                Text(viewModel.statusLine)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("OpenClaw")
    }

    private var detail: some View {
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

#Preview {
    DashboardView(
        viewModel: DashboardViewModel(client: PreviewMissionControlClient())
    )
}
