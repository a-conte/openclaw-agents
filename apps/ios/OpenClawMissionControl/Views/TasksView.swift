import SwiftUI

struct TasksView: View {
    @ObservedObject var viewModel: DashboardViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Tasks")
                    .font(.largeTitle.bold())
                    .padding(.horizontal, 24)

                if viewModel.isLoading && viewModel.tasks.isEmpty {
                    ProgressView("Loading tasks…")
                        .frame(maxWidth: .infinity, minHeight: 240)
                } else if viewModel.tasks.isEmpty {
                    ContentUnavailableView("No tasks", systemImage: "checklist", description: Text("Tasks will appear here once loaded."))
                } else {
                    LazyVStack(spacing: 12) {
                        ForEach(viewModel.tasks) { task in
                            TaskRowView(task: task)
                        }
                    }
                    .padding(.horizontal, 24)
                }
            }
            .padding(.vertical, 24)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .task {
            await viewModel.loadTasks()
        }
    }
}

private struct TaskRowView: View {
    let task: TaskItem

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(task.title)
                    .font(.headline)
                Spacer()
                Text(task.status.rawValue.replacingOccurrences(of: "_", with: " ").capitalized)
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(statusColor.opacity(0.14), in: Capsule())
                    .foregroundStyle(statusColor)
            }

            if !task.description.isEmpty {
                Text(task.description)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            HStack {
                Label(task.priority.rawValue.capitalized, systemImage: "flag")
                    .font(.caption)
                    .foregroundStyle(priorityColor)
                if let agentId = task.agentId {
                    Label(agentId, systemImage: "person")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var statusColor: Color {
        switch task.status {
        case .inProgress: return .blue
        case .review: return .purple
        case .done: return .green
        case .todo: return .orange
        case .backlog: return .gray
        }
    }

    private var priorityColor: Color {
        switch task.priority {
        case .urgent: return .red
        case .high: return .orange
        case .medium: return .yellow
        case .low: return .gray
        }
    }
}
