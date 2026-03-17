import SwiftUI

struct WorkflowsView: View {
    @ObservedObject var viewModel: DashboardViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Workflows")
                    .font(.largeTitle.bold())
                    .padding(.horizontal, 24)

                if viewModel.isLoading && viewModel.workflowRuns.isEmpty {
                    ProgressView("Loading workflows…")
                        .frame(maxWidth: .infinity, minHeight: 240)
                } else if viewModel.workflowRuns.isEmpty {
                    ContentUnavailableView("No workflow runs", systemImage: "point.3.connected.trianglepath.dotted", description: Text("Workflow runs will appear here."))
                } else {
                    LazyVStack(spacing: 12) {
                        ForEach(viewModel.workflowRuns) { run in
                            WorkflowRunRowView(run: run)
                        }
                    }
                    .padding(.horizontal, 24)
                }
            }
            .padding(.vertical, 24)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .task {
            await viewModel.loadWorkflowRuns()
        }
    }
}

private struct WorkflowRunRowView: View {
    let run: WorkflowRun

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(run.workflowName)
                    .font(.headline)
                Spacer()
                Text(run.status.rawValue.capitalized)
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(statusColor.opacity(0.14), in: Capsule())
                    .foregroundStyle(statusColor)
            }

            HStack {
                Label("Triggered by \(run.triggeredBy)", systemImage: "play.circle")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Text("\(run.steps.count) steps")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if let error = run.error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .lineLimit(2)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var statusColor: Color {
        switch run.status {
        case .running: return .blue
        case .completed: return .green
        case .failed: return .red
        case .pending: return .gray
        }
    }
}
