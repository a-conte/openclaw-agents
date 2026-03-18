import SwiftUI

struct JobSubmitView: View {
    @ObservedObject var viewModel: DashboardViewModel
    @State private var prompt = ""
    @State private var selectedAgent = "main"
    @State private var selectedMode: JobMode = .agent
    @State private var command = ""
    @State private var rawArgs = ""
    @State private var showArchived = false
    @State private var isSubmitting = false
    @State private var isClearing = false
    @State private var selectedTemplateId = ""
    @State private var templateInputs: [String: String] = [:]
    @State private var selectedJob: Job?

    private let agents = ["main", "mail", "docs", "research", "ai-research", "dev", "security"]

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
            initializeSelectedTemplateIfNeeded()
        }
        .onChange(of: viewModel.jobTemplates) { _, _ in
            initializeSelectedTemplateIfNeeded()
        }
        .onChange(of: selectedTemplateId) { _, _ in
            if let template = selectedTemplate {
                seedTemplateInputs(for: template)
                Task { await viewModel.loadTemplateVersions(id: template.id) }
            }
        }
        .sheet(item: $selectedJob) { job in
            JobDetailSheet(
                job: job,
                showArchived: showArchived,
                stopAction: showArchived || job.status != .running ? nil : {
                    _ = Task<Void, Never> {
                        await viewModel.stopJob(id: job.id)
                        await viewModel.loadJobs()
                        selectedJob = currentJob(for: job.id)
                    }
                },
                resumeFailedAction: job.status == .failed || job.status == .stopped ? {
                    _ = Task<Void, Never> {
                        await viewModel.resumeJob(id: job.id, mode: "resume_failed")
                        await viewModel.loadJobs()
                        selectedJob = currentJob(for: job.id)
                    }
                } : nil,
                rerunAllAction: job.status == .failed || job.status == .stopped ? {
                    _ = Task<Void, Never> {
                        await viewModel.resumeJob(id: job.id, mode: "rerun_all")
                        await viewModel.loadJobs()
                        selectedJob = currentJob(for: job.id)
                    }
                } : nil,
                resumeStepAction: { stepId in
                    _ = Task<Void, Never> {
                        await viewModel.resumeJob(id: job.id, mode: "resume_from", resumeFromStepId: stepId)
                        await viewModel.loadJobs()
                        selectedJob = currentJob(for: job.id)
                    }
                }
            )
        }
    }

    private var selectedTemplate: JobTemplate? {
        viewModel.jobTemplates.first(where: { $0.id == selectedTemplateId })
    }

    private var submitForm: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Submit Job")
                .font(.title2.bold())

            if let policy = viewModel.jobPolicy {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Remote policy")
                        .font(.caption.weight(.semibold))
                    Text(policy.allowDangerous == true ? "Dangerous actions enabled" : "Dangerous actions blocked by default")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text("Change `OPENCLAW_LISTEN_ALLOW_DANGEROUS` or the allowlist env vars on the listen server to widen access.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .padding(12)
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            if let metrics = viewModel.jobMetrics {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Observability")
                        .font(.caption.weight(.semibold))
                    Text("Jobs: \(metrics.jobs.total) · Active: \(metrics.jobs.active) · Blocked: \(metrics.policy.blockedJobs)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let duration = metrics.jobs.averageCompletedDurationMs {
                        Text("Average completed duration: \(duration / 1000)s")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(12)
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            if let artifactAdmin = viewModel.artifactAdmin {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Artifact store")
                        .font(.caption.weight(.semibold))
                    Text("Active: \(artifactAdmin.active.jobCount) jobs · Archived: \(artifactAdmin.archived.jobCount) jobs")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let retentionDays = artifactAdmin.retentionDays {
                        Text("Retention target: \(retentionDays) days")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(12)
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

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
                if viewModel.jobTemplates.isEmpty {
                    Text("No workflow templates available.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    Picker("Template", selection: $selectedTemplateId) {
                        ForEach(viewModel.jobTemplates) { template in
                            Text(template.name).tag(template.id)
                        }
                    }
                    .pickerStyle(.menu)

                    if let template = selectedTemplate {
                        Text(template.description)
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        Text("Category: \(template.category ?? "custom") · Version \(template.version ?? 1)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)

                        ForEach(template.inputs) { input in
                            VStack(alignment: .leading, spacing: 6) {
                                Text(input.label)
                                    .font(.caption.weight(.semibold))
                                TextField(input.defaultValue ?? input.label, text: Binding(
                                    get: { templateInputs[input.key] ?? input.defaultValue ?? "" },
                                    set: { templateInputs[input.key] = $0 }
                                ), axis: .vertical)
                                .textFieldStyle(.roundedBorder)
                                .lineLimit(1...3)
                                if let description = input.description, !description.isEmpty {
                                    Text(description)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }

                        if !viewModel.selectedTemplateVersions.isEmpty {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Template Versions")
                                    .font(.caption.weight(.semibold))
                                ForEach(Array(viewModel.selectedTemplateVersions.reversed())) { version in
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("v\(version.version)\(version.builtIn == true ? " · built-in" : "")")
                                            .font(.caption)
                                        if let updatedAt = version.updatedAt {
                                            Text(updatedAt.formatted(date: .abbreviated, time: .shortened))
                                                .font(.caption2)
                                                .foregroundStyle(.secondary)
                                        }
                                    }
                                    .padding(.vertical, 2)
                                }
                            }
                            .padding(.top, 4)
                        }
                    }
                }
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
                        if let template = selectedTemplate {
                            seedTemplateInputs(for: template)
                        }
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
                    Button {
                        selectedJob = job
                    } label: {
                        JobCardView(
                            job: job,
                            stopAction: showArchived || job.status != .running ? nil : {
                                _ = Task<Void, Never> { await viewModel.stopJob(id: job.id) }
                            },
                            retryAction: job.status == .failed || job.status == .stopped ? {
                                _ = Task<Void, Never> { await viewModel.resumeJob(id: job.id, mode: "resume_failed") }
                            } : nil
                        )
                    }
                    .buttonStyle(.plain)
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
            return selectedTemplate != nil
        }
    }

    private func initializeSelectedTemplateIfNeeded() {
        if selectedTemplateId.isEmpty, let first = viewModel.jobTemplates.first {
            selectedTemplateId = first.id
            seedTemplateInputs(for: first)
        }
    }

    private func seedTemplateInputs(for template: JobTemplate) {
        var seeded: [String: String] = [:]
        for input in template.inputs {
            seeded[input.key] = templateInputs[input.key] ?? input.defaultValue ?? ""
        }
        templateInputs = seeded
    }

    private func currentJob(for id: String) -> Job? {
        let source = showArchived ? viewModel.archivedJobs : viewModel.jobs
        return source.first(where: { $0.id == id })
    }

    private func buildRequest() -> JobRequest {
        JobRequest(
            prompt: prompt.trimmingCharacters(in: .whitespacesAndNewlines),
            mode: selectedMode.rawValue,
            targetAgent: selectedAgent,
            command: command.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : command.trimmingCharacters(in: .whitespacesAndNewlines),
            workflow: nil,
            workflowSpec: nil,
            templateId: selectedMode == .workflow ? selectedTemplate?.id : nil,
            templateInputs: selectedMode == .workflow ? templateInputs : nil,
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

            if let summary = job.summary, !summary.isEmpty {
                Text(summary)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
            }

            Text("Attempt \(job.attempt)")
                .font(.caption2)
                .foregroundStyle(.secondary)

            if let templateId = job.templateId, !templateId.isEmpty {
                Text("Template: \(templateId)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            if !job.stepStatus.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(job.stepStatus.suffix(3)) { step in
                        Text("• \(step.name) · \(step.status.rawValue)")
                            .font(.caption2)
                            .foregroundStyle(step.status == .failed ? .red : .secondary)
                    }
                }
            }

            HStack {
                if let stopAction {
                    Button("Stop", action: stopAction)
                        .buttonStyle(.bordered)
                }
                if let retryAction, job.status == .failed || job.status == .stopped {
                    Button("Resume Failed", action: retryAction)
                        .buttonStyle(.borderedProminent)
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var title: String {
        if let templateId = job.templateId, !templateId.isEmpty {
            return templateId
        }
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

private struct JobDetailSheet: View {
    let job: Job
    let showArchived: Bool
    let stopAction: (() -> Void)?
    let resumeFailedAction: (() -> Void)?
    let rerunAllAction: (() -> Void)?
    let resumeStepAction: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(job.templateId ?? job.workflow ?? job.command ?? job.mode?.rawValue.capitalized ?? "Job")
                            .font(.title.bold())
                        Text("Attempt \(job.attempt)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        if let summary = job.summary, !summary.isEmpty {
                            Text(summary)
                                .font(.body)
                                .foregroundStyle(.secondary)
                        }
                    }

                    if let error = job.error {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }

                    if !job.templateInputs.isEmpty {
                        detailCard(title: "Template Inputs") {
                            VStack(alignment: .leading, spacing: 6) {
                                ForEach(job.templateInputs.keys.sorted(), id: \.self) { key in
                                    Text("\(key): \(job.templateInputs[key] ?? "")")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }

                    detailCard(title: "Attempt History") {
                        if job.history.isEmpty {
                            Text("No prior attempts recorded.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        } else {
                            VStack(alignment: .leading, spacing: 6) {
                                ForEach(job.history) { attempt in
                                    Text("#\(attempt.attempt ?? 0) · \(attempt.status ?? "unknown")\(attempt.resumeFromStepId.map { " · from \($0)" } ?? "")")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }

                    detailCard(title: "Steps") {
                        VStack(alignment: .leading, spacing: 12) {
                            ForEach(job.stepStatus) { step in
                                VStack(alignment: .leading, spacing: 8) {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(step.name)
                                                .font(.headline)
                                            Text(stepMetaLine(step))
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }
                                        Spacer()
                                        if (job.status == .failed || job.status == .stopped) && !showArchived {
                                            Button("Resume Here") {
                                                resumeStepAction(step.id)
                                            }
                                            .buttonStyle(.bordered)
                                        }
                                    }
                                    if let result = step.result, !result.isEmpty {
                                        Text(result)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                    if let error = step.error {
                                        Text(error)
                                            .font(.caption)
                                            .foregroundStyle(.red)
                                    }
                                    if !step.artifacts.isEmpty {
                                        VStack(alignment: .leading, spacing: 4) {
                                            ForEach(step.artifacts.keys.sorted(), id: \.self) { key in
                                                VStack(alignment: .leading, spacing: 2) {
                                                    Text(key)
                                                        .font(.caption2.weight(.semibold))
                                                    Text(artifactSummary(step.artifacts[key]))
                                                        .font(.caption2)
                                                        .foregroundStyle(.secondary)
                                                    if let preview = artifactPreview(step.artifacts[key]), !preview.isEmpty {
                                                        Text(preview)
                                                            .font(.caption2.monospaced())
                                                            .foregroundStyle(.secondary)
                                                            .lineLimit(6)
                                                            .padding(.top, 2)
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                .padding(14)
                                .background(.background, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                            }
                        }
                    }

                    if !job.updates.isEmpty {
                        detailCard(title: "Recent Updates") {
                            VStack(alignment: .leading, spacing: 4) {
                                ForEach(job.updates.suffix(10)) { update in
                                    Text("• \(update.message)")
                                        .font(.caption)
                                        .foregroundStyle(update.level == .error ? .red : .secondary)
                                }
                            }
                        }
                    }
                }
                .padding(24)
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Job Detail")
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    if let stopAction {
                        Button("Stop", action: stopAction)
                    }
                    if let resumeFailedAction {
                        Button("Resume Failed", action: resumeFailedAction)
                    }
                    if let rerunAllAction {
                        Button("Rerun All", action: rerunAllAction)
                    }
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }

    private func detailCard<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.headline)
            content()
        }
        .padding(18)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func stepMetaLine(_ step: JobStepStatus) -> String {
        var parts = ["\(step.type) · \(step.status.rawValue)"]
        if let durationMs = step.durationMs {
            parts.append(durationText(durationMs))
        }
        return parts.joined(separator: " · ")
    }

    private func durationText(_ durationMs: Int) -> String {
        if durationMs < 1000 {
            return "\(durationMs)ms"
        }
        let seconds = Double(durationMs) / 1000
        if seconds < 60 {
            return String(format: "%.1fs", seconds)
        }
        return String(format: "%.1fm", seconds / 60)
    }

    private func artifactSummary(_ value: JSONValue?) -> String {
        guard let value else { return "" }
        if case .object(let object) = value,
           case .string(let relativePath)? = object["relativePath"] {
            let kind = object["kind"]?.displayString ?? "artifact"
            let size = object["size"]?.displayString
            return [relativePath, kind, size.map { "\($0) bytes" }].compactMap { item in
                guard let item, !item.isEmpty else { return nil }
                return item
            }.joined(separator: " · ")
        }
        return value.displayString
    }

    private func artifactPreview(_ value: JSONValue?) -> String? {
        guard let value else { return nil }
        if case .object(let object) = value {
            let preview = object["preview"]?.displayString
            return preview?.isEmpty == false ? preview : nil
        }
        return nil
    }
}
