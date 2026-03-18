import SwiftUI

struct JobSubmitView: View {
    @ObservedObject var viewModel: DashboardViewModel
    @State private var prompt = ""
    @State private var selectedAgent = "main"
    @State private var selectedMode: JobMode = .agent
    @State private var command = ""
    @State private var workflow = "safari_open_command_page"
    @State private var rawArgs = ""
    @State private var showArchived = false
    @State private var isSubmitting = false
    @State private var isClearing = false

    private let agents = ["main", "mail", "docs", "research", "ai-research", "dev", "security"]
    private let workflows = [
        "safari_open_command_page",
        "safari_recover_localhost_command",
        "safari_wait_and_click_ui",
        "textedit_new_set_text",
        "notes_create"
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Automation Jobs")
                    .font(.largeTitle.bold())

                submitForm

                Toggle("Show archived jobs", isOn: $showArchived)
                    .toggleStyle(.switch)

                jobsList
            }
            .padding(24)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .task {
            await viewModel.loadJobs()
            await viewModel.loadArchivedJobs()
        }
    }

    private var submitForm: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Submit Job")
                .font(.title2.bold())

            Picker("Mode", selection: $selectedMode) {
                ForEach(JobMode.allCases, id: \.self) { mode in
                    Text(mode.rawValue.capitalized).tag(mode)
                }
            }
            .pickerStyle(.segmented)

            if selectedMode == .agent {
                Picker("Agent", selection: $selectedAgent) {
                    ForEach(agents, id: \.self) { agent in
                        Text(agent).tag(agent)
                    }
                }
                .pickerStyle(.segmented)
            }

            switch selectedMode {
            case .agent, .shell, .note:
                TextField("Prompt", text: $prompt, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(3...6)
            case .steer, .drive:
                TextField("Command", text: $command)
                    .textFieldStyle(.roundedBorder)
                TextField("Args (comma separated)", text: $rawArgs, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(2...4)
            case .workflow:
                Picker("Workflow", selection: $workflow) {
                    ForEach(workflows, id: \.self) { item in
                        Text(item).tag(item)
                    }
                }
                .pickerStyle(.menu)
                TextField("Args (comma separated)", text: $rawArgs, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(2...4)
            }

            HStack(spacing: 12) {
                Button {
                    Task {
                        isSubmitting = true
                        defer { isSubmitting = false }
                        await viewModel.submitJob(request: buildRequest())
                        prompt = ""
                        command = ""
                        rawArgs = ""
                    }
                } label: {
                    if isSubmitting {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Submit")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(!canSubmit || isSubmitting)

                Button {
                    Task {
                        isClearing = true
                        defer { isClearing = false }
                        await viewModel.clearJobs()
                    }
                } label: {
                    if isClearing {
                        ProgressView()
                    } else {
                        Text("Archive")
                    }
                }
                .buttonStyle(.bordered)
                .disabled(isClearing)
            }
        }
        .padding(18)
        .background(.background, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var jobsList: some View {
        let items = showArchived ? viewModel.archivedJobs : viewModel.jobs

        return VStack(alignment: .leading, spacing: 12) {
            Text(showArchived ? "Archived Jobs" : "Recent Jobs")
                .font(.title2.bold())

            if items.isEmpty {
                ContentUnavailableView(showArchived ? "No archived jobs" : "No jobs", systemImage: "tray", description: Text("Submitted automation jobs will appear here."))
            } else {
                ForEach(items) { job in
                    JobCardView(
                        job: job,
                        stopAction: showArchived || job.status != .running ? nil : {
                            _ = Task<Void, Never> { await viewModel.stopJob(id: job.id) }
                        },
                        retryAction: job.status == .failed || job.status == .stopped ? {
                            _ = Task<Void, Never> { await viewModel.retryJob(id: job.id) }
                        } : nil
                    )
                }
            }
        }
    }

    private var canSubmit: Bool {
        switch selectedMode {
        case .agent, .shell, .note:
            return !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        case .steer, .drive:
            return !command.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        case .workflow:
            return !workflow.isEmpty
        }
    }

    private func buildRequest() -> JobRequest {
        JobRequest(
            prompt: prompt.trimmingCharacters(in: .whitespacesAndNewlines),
            mode: selectedMode.rawValue,
            targetAgent: selectedAgent,
            command: command.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : command.trimmingCharacters(in: .whitespacesAndNewlines),
            workflow: workflow.isEmpty ? nil : workflow,
            workflowSpec: nil,
            args: rawArgs.split(separator: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty },
            thinking: nil,
            local: false
        )
    }
}

private struct JobCardView: View {
    let job: Job
    let stopAction: (() -> Void)?
    let retryAction: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.headline)
                    Text(job.targetAgent)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text(job.status.rawValue.capitalized)
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(statusColor.opacity(0.14), in: Capsule())
                    .foregroundStyle(statusColor)
            }

            if !job.prompt.isEmpty {
                Text(job.prompt)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
            }

            if let summary = job.summary, !summary.isEmpty {
                Text(summary)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if let result = job.result, !result.isEmpty {
                Text(result)
                    .font(.caption)
                    .foregroundStyle(.green)
                    .lineLimit(4)
            }

            if let error = job.error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .lineLimit(4)
            }

            if !job.updates.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(job.updates.suffix(3)) { update in
                        Text("• \(update.message)")
                            .font(.caption2)
                            .foregroundStyle(update.level == .error ? .red : .secondary)
                    }
                }
            }

            if !job.stepStatus.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(job.stepStatus.suffix(4)) { step in
                        Text("• \(step.name) · \(step.status.rawValue)")
                            .font(.caption2)
                            .foregroundStyle(step.status == .failed ? .red : .secondary)
                    }
                }
            }

            if let policy = job.policy, !policy.allowed, let reason = policy.reason {
                Text(reason)
                    .font(.caption)
                    .foregroundStyle(.orange)
            }

            HStack {
                if let stopAction {
                    Button("Stop", action: stopAction)
                        .buttonStyle(.bordered)
                }
                if let retryAction, job.status == .failed || job.status == .stopped {
                    Button("Retry", action: retryAction)
                        .buttonStyle(.borderedProminent)
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var title: String {
        if let workflow = job.workflow, !workflow.isEmpty {
            return workflow
        }
        if let command = job.command, !command.isEmpty {
            return "\(job.mode?.rawValue.capitalized ?? "Job"): \(command)"
        }
        return job.mode?.rawValue.capitalized ?? "Job"
    }

    private var statusColor: Color {
        switch job.status {
        case .queued: return .gray
        case .running: return .blue
        case .completed: return .green
        case .failed: return .red
        case .stopped: return .orange
        }
    }
}
