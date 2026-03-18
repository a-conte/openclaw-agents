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
    @State private var editingTemplate: EditableTemplateState?
    @State private var selectedTemplateDiff: JobTemplateDiff?
    @State private var compressDays = "7"
    @State private var pruneDays = "30"
    @State private var isCompressingArtifacts = false
    @State private var isPruningArtifacts = false
    @State private var restoringTemplateVersion: Int?
    @State private var showMetricsDetail = false
    @State private var showPolicyAdminDetail = false
    @State private var showArtifactAdminDetail = false
    @State private var showTemplateVersionsDetail = false
    @State private var notificationSeverityThreshold = "error"
    @State private var notificationsPushEnabled = true
    @State private var notificationsNotesEnabled = true
    @State private var notificationsImessageEnabled = false
    @State private var notificationsMailDraftEnabled = false
    @State private var isSavingNotificationPreferences = false

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
            await viewModel.startNotificationCenter()
            await viewModel.requestNotificationAuthorizationIfNeeded()
            initializeSelectedTemplateIfNeeded()
            syncNotificationPreferencesFromViewModel()
        }
        .onChange(of: viewModel.jobTemplates) { _, _ in
            initializeSelectedTemplateIfNeeded()
        }
        .onChange(of: viewModel.notificationPreferences) { _, _ in
            syncNotificationPreferencesFromViewModel()
        }
        .onChange(of: selectedTemplateId) { _, _ in
            if let template = selectedTemplate {
                seedTemplateInputs(for: template)
                Task { await viewModel.loadTemplateVersions(id: template.id) }
            }
        }
        .onChange(of: viewModel.notificationTargetJobId) { _, jobId in
            guard let jobId, !jobId.isEmpty else { return }
            if let job = currentJob(for: jobId) {
                showArchived = false
                selectedJob = job
                return
            }
            Task {
                await viewModel.loadJobs()
                showArchived = false
                selectedJob = currentJob(for: jobId)
            }
        }
        .sheet(item: $selectedJob) { job in
            JobDetailSheet(
                job: job,
                showArchived: showArchived,
                artifactURLBuilder: { jobId, relativePath in
                    viewModel.artifactURL(jobId: jobId, relativePath: relativePath)
                },
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
        .sheet(item: $editingTemplate) { state in
            TemplateEditorSheet(
                state: state,
                onSave: { draft, originalId in
                    await viewModel.saveTemplate(draft, existingId: originalId)
                    await viewModel.loadJobs()
                    if !draft.id.isEmpty {
                        selectedTemplateId = draft.id
                        await viewModel.loadTemplateVersions(id: draft.id)
                    }
                },
                onDelete: state.originalId == nil ? nil : {
                    guard let originalId = state.originalId else { return }
                    await viewModel.deleteTemplate(id: originalId)
                    if selectedTemplateId == originalId {
                        selectedTemplateId = viewModel.jobTemplates.first?.id ?? ""
                    }
                }
            )
        }
        .sheet(item: $selectedTemplateDiff) { diff in
            TemplateDiffSheet(diff: diff)
        }
        .sheet(isPresented: $showMetricsDetail) {
            MetricsDetailSheet(metrics: viewModel.jobMetrics)
        }
        .sheet(isPresented: $showPolicyAdminDetail) {
            PolicyAdminDetailSheet(policyAdmin: viewModel.policyAdmin)
        }
        .sheet(isPresented: $showArtifactAdminDetail) {
            ArtifactAdminDetailSheet(
                artifactAdmin: viewModel.artifactAdmin,
                compressDays: $compressDays,
                pruneDays: $pruneDays,
                isCompressingArtifacts: $isCompressingArtifacts,
                isPruningArtifacts: $isPruningArtifacts,
                onCompress: {
                    await viewModel.compressArtifacts(olderThanDays: Int(compressDays) ?? 7)
                },
                onPrune: {
                    await viewModel.pruneArtifacts(olderThanDays: Int(pruneDays) ?? 30)
                }
            )
        }
        .sheet(isPresented: $showTemplateVersionsDetail) {
            TemplateVersionsSheet(
                template: selectedTemplate,
                versions: viewModel.selectedTemplateVersions,
                restoringTemplateVersion: $restoringTemplateVersion,
                onCompare: { template, fromVersion, toVersion in
                    await viewModel.loadTemplateDiff(id: template.id, fromVersion: fromVersion, toVersion: toVersion)
                    selectedTemplateDiff = viewModel.selectedTemplateDiff
                },
                onRestore: { template, version in
                    await viewModel.restoreTemplate(id: template.id, version: version)
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

            if let notificationPreferences = viewModel.notificationPreferences {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Apple delivery")
                        .font(.caption.weight(.semibold))
                    Text(notificationPreferences.dashboardPrimary ? "Dashboard remains the primary Mission Control; iPad alerts are supplemental." : "Apple channels are elevated above the dashboard.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Picker("Severity threshold", selection: $notificationSeverityThreshold) {
                        Text("Info").tag("info")
                        Text("Warning").tag("warning")
                        Text("Error").tag("error")
                        Text("Critical").tag("critical")
                    }
                    .pickerStyle(.segmented)
                    Toggle("Enable local iPad alerts", isOn: $notificationsPushEnabled)
                    Toggle("Enable Apple Notes handoff templates", isOn: $notificationsNotesEnabled)
                    Toggle("Enable iMessage delivery routes", isOn: $notificationsImessageEnabled)
                    Toggle("Enable Mail draft delivery routes", isOn: $notificationsMailDraftEnabled)
                    Button {
                        Task {
                            isSavingNotificationPreferences = true
                            defer { isSavingNotificationPreferences = false }
                            let updated = NotificationPreferences(
                                dashboardPrimary: true,
                                severityThreshold: notificationSeverityThreshold,
                                channels: NotificationChannels(
                                    push: notificationsPushEnabled,
                                    notes: notificationsNotesEnabled,
                                    imessage: notificationsImessageEnabled,
                                    mail_draft: notificationsMailDraftEnabled
                                ),
                                agentAllowlist: notificationPreferences.agentAllowlist,
                                templateAllowlist: notificationPreferences.templateAllowlist,
                                templateRouting: notificationPreferences.templateRouting,
                                updatedAt: notificationPreferences.updatedAt
                            )
                            await viewModel.saveNotificationPreferences(updated)
                        }
                    } label: {
                        if isSavingNotificationPreferences {
                            ProgressView()
                        } else {
                            Text("Save Apple delivery settings")
                        }
                    }
                    .buttonStyle(.bordered)
                }
                .padding(12)
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            if !viewModel.notificationEvents.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Recent Apple alerts")
                        .font(.caption.weight(.semibold))
                    ForEach(viewModel.notificationEvents.prefix(3)) { event in
                        Button {
                            showArchived = false
                            selectedJob = currentJob(for: event.jobId)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(event.title)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.primary)
                                Text(event.body)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                Text(event.createdAt.formatted(date: .abbreviated, time: .shortened))
                                    .font(.caption2.monospacedDigit())
                                    .foregroundStyle(.tertiary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(12)
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

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

            if let policyAdmin = viewModel.policyAdmin {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Policy admin")
                        .font(.caption.weight(.semibold))
                    if let summary = policyAdmin.summary, !summary.isEmpty {
                        Text(summary)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    ForEach(policyAdmin.env.prefix(3)) { entry in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(entry.name)
                                .font(.caption2.weight(.semibold))
                            Text(entry.value.isEmpty ? "(empty)" : entry.value)
                                .font(.caption2.monospaced())
                                .foregroundStyle(.secondary)
                            Text(entry.description)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    Button("Open policy admin") {
                        showPolicyAdminDetail = true
                    }
                    .buttonStyle(.bordered)
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
                    HStack(spacing: 12) {
                        if let duration = metrics.jobs.medianCompletedDurationMs {
                            Text("Median: \(duration / 1000)s")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        if let duration = metrics.jobs.p95CompletedDurationMs {
                            Text("P95: \(duration / 1000)s")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    if !metrics.steps.topFailures.isEmpty {
                        metricList(
                            title: "Top step failures",
                            items: metrics.steps.topFailures.prefix(3).map { "\($0.name) · \($0.count)" }
                        )
                    }
                    if !metrics.policy.topBlockReasons.isEmpty {
                        metricList(
                            title: "Top policy blocks",
                            items: metrics.policy.topBlockReasons.prefix(3).map { "\($0.reason) · \($0.count)" }
                        )
                    }
                    if !metrics.longRunning.isEmpty {
                        metricList(
                            title: "Long-running jobs",
                            items: metrics.longRunning.prefix(3).map { item in
                                let label = item.templateId ?? item.workflow ?? item.mode ?? (item.jobId ?? "job")
                                let age = item.ageMs.map { "\($0 / 1000)s" } ?? "n/a"
                                return "\(label) · \(age)"
                            }
                        )
                    }
                    Button("Open metrics detail") {
                        showMetricsDetail = true
                    }
                    .buttonStyle(.bordered)
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
                    if let oldestArchivedAgeDays = artifactAdmin.oldestArchivedAgeDays {
                        Text("Oldest archived artifact set: \(Int(oldestArchivedAgeDays)) days")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    HStack(spacing: 8) {
                        TextField("Compress days", text: $compressDays)
                            .textFieldStyle(.roundedBorder)
                            .keyboardType(.numberPad)
                        Button {
                            Task {
                                isCompressingArtifacts = true
                                defer { isCompressingArtifacts = false }
                                await viewModel.compressArtifacts(olderThanDays: Int(compressDays) ?? 7)
                            }
                        } label: {
                            if isCompressingArtifacts {
                                ProgressView()
                            } else {
                                Text("Compress")
                            }
                        }
                        .buttonStyle(.bordered)
                        .disabled(isCompressingArtifacts)
                    }
                    HStack(spacing: 8) {
                        TextField("Prune days", text: $pruneDays)
                            .textFieldStyle(.roundedBorder)
                            .keyboardType(.numberPad)
                        Button(role: .destructive) {
                            Task {
                                isPruningArtifacts = true
                                defer { isPruningArtifacts = false }
                                await viewModel.pruneArtifacts(olderThanDays: Int(pruneDays) ?? 30)
                            }
                        } label: {
                            if isPruningArtifacts {
                                ProgressView()
                            } else {
                                Text("Prune")
                            }
                        }
                        .buttonStyle(.bordered)
                        .disabled(isPruningArtifacts)
                    }
                    Button("Open artifact admin") {
                        showArtifactAdminDetail = true
                    }
                    .buttonStyle(.bordered)
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

                        Text(templateMetaLine(template))
                            .font(.caption2)
                            .foregroundStyle(.secondary)

                        HStack(spacing: 10) {
                            Button("New Custom") {
                                editingTemplate = .blank()
                            }
                            .buttonStyle(.bordered)

                            Button("Clone") {
                                editingTemplate = .fromTemplate(template, clone: true)
                            }
                            .buttonStyle(.bordered)

                            if template.builtIn != true {
                                Button("Edit") {
                                    editingTemplate = .fromTemplate(template, clone: false)
                                }
                                .buttonStyle(.bordered)
                            }
                        }

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
                                Text("\(viewModel.selectedTemplateVersions.count) saved version(s)")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                Button("Open version history") {
                                    showTemplateVersionsDetail = true
                                }
                                .buttonStyle(.bordered)
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

    private func templateMetaLine(_ template: JobTemplate) -> String {
        var parts = ["Category: \(template.category ?? "custom")", "Version \(template.version ?? 1)"]
        if template.favorite == true {
            parts.append("favorite")
        }
        if template.recommended == true {
            parts.append("recommended")
        }
        if let retention = template.artifactRetentionDays {
            parts.append("\(retention)d retention")
        }
        return parts.joined(separator: " · ")
    }

    @ViewBuilder
    private func metricList(title: String, items: [String]) -> some View {
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.caption2.weight(.semibold))
                ForEach(items, id: \.self) { item in
                    Text("• \(item)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
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

    private func syncNotificationPreferencesFromViewModel() {
        guard let preferences = viewModel.notificationPreferences else { return }
        notificationSeverityThreshold = preferences.severityThreshold
        notificationsPushEnabled = preferences.channels.push
        notificationsNotesEnabled = preferences.channels.notes
        notificationsImessageEnabled = preferences.channels.imessage
        notificationsMailDraftEnabled = preferences.channels.mail_draft
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
    let artifactURLBuilder: (String, String) -> URL?
    let stopAction: (() -> Void)?
    let resumeFailedAction: (() -> Void)?
    let rerunAllAction: (() -> Void)?
    let resumeStepAction: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var selectedArtifact: ArtifactPreviewState?

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
                                        VStack(alignment: .leading, spacing: 8) {
                                            ForEach(step.artifacts.keys.sorted(), id: \.self) { key in
                                                artifactRow(key: key, value: step.artifacts[key])
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
            .sheet(item: $selectedArtifact) { artifact in
                ArtifactPreviewSheet(artifact: artifact)
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

    @ViewBuilder
    private func artifactRow(key: String, value: JSONValue?) -> some View {
        let summary = artifactSummary(value)
        let preview = artifactPreview(value)
        let target = artifactTarget(key: key, value: value)

        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(key)
                    .font(.caption2.weight(.semibold))
                Spacer()
                if let target {
                    Button(target.isImage ? "Preview" : "Open") {
                        selectedArtifact = target
                    }
                    .buttonStyle(.bordered)
                }
            }
            Text(summary)
                .font(.caption2)
                .foregroundStyle(.secondary)
            if let preview, !preview.isEmpty {
                Text(preview)
                    .font(.caption2.monospaced())
                    .foregroundStyle(.secondary)
                    .lineLimit(6)
                    .padding(.top, 2)
            }
        }
    }

    private func artifactTarget(key: String, value: JSONValue?) -> ArtifactPreviewState? {
        guard let value,
              case .object(let object) = value,
              case .string(let relativePath)? = object["relativePath"] else {
            return nil
        }
        let url = artifactURLBuilder(job.id, relativePath)
        let kind = object["kind"]?.displayString ?? "artifact"
        let previewText = object["preview"]?.displayString
        let lowerPath = relativePath.lowercased()
        let isImage = kind.hasPrefix("image") || lowerPath.hasSuffix(".png") || lowerPath.hasSuffix(".jpg") || lowerPath.hasSuffix(".jpeg") || lowerPath.hasSuffix(".gif") || lowerPath.hasSuffix(".webp")
        return ArtifactPreviewState(
            id: "\(job.id)-\(key)-\(relativePath)",
            title: key,
            subtitle: summaryLine(kind: kind, relativePath: relativePath),
            previewText: previewText,
            url: url,
            isImage: isImage
        )
    }

    private func summaryLine(kind: String, relativePath: String) -> String {
        [kind, relativePath].filter { !$0.isEmpty }.joined(separator: " · ")
    }
}

private struct MetricsDetailSheet: View {
    let metrics: JobMetrics?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    if let metrics {
                        detailSection("Summary") {
                            metricRow("Jobs", "\(metrics.jobs.total)")
                            metricRow("Active", "\(metrics.jobs.active)")
                            metricRow("Archived", "\(metrics.jobs.archived)")
                            metricRow("Blocked", "\(metrics.policy.blockedJobs)")
                            if let value = metrics.jobs.averageCompletedDurationMs { metricRow("Average", "\(value / 1000)s") }
                            if let value = metrics.jobs.medianCompletedDurationMs { metricRow("Median", "\(value / 1000)s") }
                            if let value = metrics.jobs.p95CompletedDurationMs { metricRow("P95", "\(value / 1000)s") }
                        }

                        if !metrics.templates.performance.isEmpty {
                            detailSection("Template Performance") {
                                ForEach(metrics.templates.performance.prefix(8)) { item in
                                    metricRow(item.templateId, "\(item.successRate)% · \(item.completed)/\(item.total)")
                                }
                            }
                        }

                        if !metrics.trends.isEmpty {
                            detailSection("Recent Trends") {
                                ForEach(metrics.trends.suffix(7)) { item in
                                    metricRow(item.date, "\(item.total) total · \(item.completed) ok · \(item.failed) failed · \(item.blocked) blocked")
                                }
                            }
                        }

                        if !metrics.steps.artifactVolume.isEmpty {
                            detailSection("Artifact Heavy Steps") {
                                ForEach(metrics.steps.artifactVolume.prefix(8)) { item in
                                    metricRow(item.name, "\(item.count) artifacts · \(item.bytes) bytes")
                                }
                            }
                        }

                        if !metrics.lineage.recentChains.isEmpty {
                            detailSection("Retry Lineage") {
                                ForEach(metrics.lineage.recentChains.prefix(8)) { chain in
                                    metricRow(chain.templateId ?? chain.rootJobId, "\(chain.attempts) attempts · latest \(chain.latestStatus ?? "unknown")")
                                    if let jobIds = chain.jobIds, !jobIds.isEmpty {
                                        Text(jobIds.joined(separator: " -> "))
                                            .font(.caption2.monospaced())
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                    } else {
                        ContentUnavailableView("No metrics", systemImage: "chart.bar", description: Text("Load jobs to populate automation metrics."))
                    }
                }
                .padding(24)
            }
            .navigationTitle("Metrics")
            .toolbar { Button("Done") { dismiss() } }
        }
    }

    @ViewBuilder
    private func detailSection(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.headline)
            content()
        }
        .padding(18)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    @ViewBuilder
    private func metricRow(_ title: String, _ value: String) -> some View {
        HStack(alignment: .top) {
            Text(title).font(.caption.weight(.semibold))
            Spacer()
            Text(value).font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.trailing)
        }
    }
}

private struct PolicyAdminDetailSheet: View {
    let policyAdmin: PolicyAdmin?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    if let policyAdmin {
                        if let summary = policyAdmin.summary, !summary.isEmpty {
                            Text(summary)
                                .font(.body)
                                .foregroundStyle(.secondary)
                        }
                        ForEach(policyAdmin.env) { entry in
                            VStack(alignment: .leading, spacing: 6) {
                                Text(entry.name).font(.headline)
                                Text(entry.value.isEmpty ? "(empty)" : entry.value)
                                    .font(.caption.monospaced())
                                    .foregroundStyle(.secondary)
                                Text(entry.description).font(.caption).foregroundStyle(.secondary)
                                if let example = entry.example, !example.isEmpty {
                                    Text("Example: \(example)")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding(18)
                            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                        }
                    } else {
                        ContentUnavailableView("No policy admin", systemImage: "shield", description: Text("Load jobs to inspect listen policy settings."))
                    }
                }
                .padding(24)
            }
            .navigationTitle("Policy Admin")
            .toolbar { Button("Done") { dismiss() } }
        }
    }
}

private struct ArtifactAdminDetailSheet: View {
    let artifactAdmin: ArtifactAdminSummary?
    @Binding var compressDays: String
    @Binding var pruneDays: String
    @Binding var isCompressingArtifacts: Bool
    @Binding var isPruningArtifacts: Bool
    let onCompress: () async -> Void
    let onPrune: () async -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    if let artifactAdmin {
                        VStack(alignment: .leading, spacing: 8) {
                            metricRow("Active jobs", "\(artifactAdmin.active.jobCount)")
                            metricRow("Active bytes", "\(artifactAdmin.active.bytes)")
                            metricRow("Archived jobs", "\(artifactAdmin.archived.jobCount)")
                            metricRow("Archived bytes", "\(artifactAdmin.archived.bytes)")
                            if let retention = artifactAdmin.retentionDays { metricRow("Retention", "\(retention) days") }
                            if let oldest = artifactAdmin.oldestArchivedAgeDays { metricRow("Oldest archived", "\(Int(oldest)) days") }
                        }
                        .padding(18)
                        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))

                        VStack(alignment: .leading, spacing: 12) {
                            Text("Compression").font(.headline)
                            HStack {
                                TextField("Days", text: $compressDays)
                                    .textFieldStyle(.roundedBorder)
                                    .keyboardType(.numberPad)
                                Button {
                                    Task {
                                        isCompressingArtifacts = true
                                        defer { isCompressingArtifacts = false }
                                        await onCompress()
                                    }
                                } label: {
                                    if isCompressingArtifacts { ProgressView() } else { Text("Compress Archived") }
                                }
                                .buttonStyle(.borderedProminent)
                            }
                        }
                        .padding(18)
                        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))

                        VStack(alignment: .leading, spacing: 12) {
                            Text("Prune").font(.headline)
                            HStack {
                                TextField("Days", text: $pruneDays)
                                    .textFieldStyle(.roundedBorder)
                                    .keyboardType(.numberPad)
                                Button(role: .destructive) {
                                    Task {
                                        isPruningArtifacts = true
                                        defer { isPruningArtifacts = false }
                                        await onPrune()
                                    }
                                } label: {
                                    if isPruningArtifacts { ProgressView() } else { Text("Prune Archived") }
                                }
                                .buttonStyle(.bordered)
                            }
                        }
                        .padding(18)
                        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    } else {
                        ContentUnavailableView("No artifact admin", systemImage: "shippingbox", description: Text("Load jobs to inspect artifact storage state."))
                    }
                }
                .padding(24)
            }
            .navigationTitle("Artifact Admin")
            .toolbar { Button("Done") { dismiss() } }
        }
    }

    @ViewBuilder
    private func metricRow(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title).font(.caption.weight(.semibold))
            Spacer()
            Text(value).font(.caption).foregroundStyle(.secondary)
        }
    }
}

private struct TemplateVersionsSheet: View {
    let template: JobTemplate?
    let versions: [JobTemplateVersion]
    @Binding var restoringTemplateVersion: Int?
    let onCompare: (JobTemplate, Int, Int) async -> Void
    let onRestore: (JobTemplate, Int) async -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if let template, !versions.isEmpty {
                        let ordered = Array(versions.reversed())
                        let latestVersion = ordered.first?.version
                        ForEach(ordered) { version in
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("v\(version.version)\(version.builtIn == true ? " · built-in" : "")")
                                            .font(.headline)
                                        if let updatedAt = version.updatedAt {
                                            Text(updatedAt.formatted(date: .abbreviated, time: .shortened))
                                                .font(.caption2)
                                                .foregroundStyle(.secondary)
                                        }
                                    }
                                    Spacer()
                                    if let latestVersion, version.version != latestVersion {
                                        Button("Compare") {
                                            Task { await onCompare(template, version.version, latestVersion) }
                                        }
                                        .buttonStyle(.bordered)
                                        if template.builtIn != true {
                                            Button {
                                                Task {
                                                    restoringTemplateVersion = version.version
                                                    defer { restoringTemplateVersion = nil }
                                                    await onRestore(template, version.version)
                                                }
                                            } label: {
                                                if restoringTemplateVersion == version.version { ProgressView() } else { Text("Restore") }
                                            }
                                            .buttonStyle(.bordered)
                                            .disabled(restoringTemplateVersion != nil)
                                        }
                                    }
                                }
                                if let description = version.description, !description.isEmpty {
                                    Text(description)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding(18)
                            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                        }
                    } else {
                        ContentUnavailableView("No versions", systemImage: "clock.arrow.circlepath", description: Text("Select a workflow template to inspect version history."))
                    }
                }
                .padding(24)
            }
            .navigationTitle("Template Versions")
            .toolbar { Button("Done") { dismiss() } }
        }
    }
}

private struct EditableTemplateState: Identifiable {
    let id: String
    let originalId: String?
    let draft: JobTemplateDraft

    static func blank() -> EditableTemplateState {
        EditableTemplateState(
            id: UUID().uuidString,
            originalId: nil,
            draft: JobTemplateDraft(
                id: "custom_template",
                name: "Custom Template",
                description: "New custom workflow template",
                category: "custom",
                favorite: false,
                recommended: false,
                artifactRetentionDays: 30,
                inputs: [],
                workflowSpec: .object([
                    "steps": .array([
                        .object([
                            "id": .string("step_1"),
                            "name": .string("First step"),
                            "type": .string("note"),
                            "message": .string("Describe this workflow"),
                        ]),
                    ]),
                ])
            )
        )
    }

    static func fromTemplate(_ template: JobTemplate, clone: Bool) -> EditableTemplateState {
        let sourceId = template.id
        let id = clone ? "\(sourceId)_copy" : sourceId
        let name = clone ? "\(template.name) Copy" : template.name
        return EditableTemplateState(
            id: UUID().uuidString,
            originalId: clone ? nil : sourceId,
            draft: JobTemplateDraft(
                id: id,
                name: name,
                description: template.description,
                category: template.category,
                favorite: template.favorite ?? false,
                recommended: clone ? false : (template.recommended ?? false),
                artifactRetentionDays: template.artifactRetentionDays,
                inputs: template.inputs,
                workflowSpec: template.workflowSpec ?? .object([:])
            )
        )
    }
}

private struct ArtifactPreviewState: Identifiable {
    let id: String
    let title: String
    let subtitle: String
    let previewText: String?
    let url: URL?
    let isImage: Bool
}

private struct ArtifactPreviewSheet: View {
    let artifact: ArtifactPreviewState
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(artifact.subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    if artifact.isImage, let url = artifact.url {
                        AsyncImage(url: url) { image in
                            image
                                .resizable()
                                .scaledToFit()
                                .frame(maxWidth: .infinity)
                                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        } placeholder: {
                            ProgressView()
                                .frame(maxWidth: .infinity, minHeight: 240)
                        }
                    }

                    if let previewText = artifact.previewText, !previewText.isEmpty {
                        Text(previewText)
                            .font(.body.monospaced())
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(16)
                            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }

                    if let url = artifact.url {
                        Link("Open Raw Artifact", destination: url)
                            .buttonStyle(.borderedProminent)
                    }
                }
                .padding(24)
            }
            .navigationTitle(artifact.title)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

private struct TemplateEditorSheet: View {
    let state: EditableTemplateState
    let onSave: (JobTemplateDraft, String?) async -> Void
    let onDelete: (() async -> Void)?
    @Environment(\.dismiss) private var dismiss

    @State private var id: String
    @State private var name: String
    @State private var description: String
    @State private var category: String
    @State private var favorite: Bool
    @State private var recommended: Bool
    @State private var artifactRetentionDays: String
    @State private var workflowSpecText: String
    @State private var errorMessage: String?
    @State private var isSaving = false
    @State private var isDeleting = false

    init(state: EditableTemplateState, onSave: @escaping (JobTemplateDraft, String?) async -> Void, onDelete: (() async -> Void)? = nil) {
        self.state = state
        self.onSave = onSave
        self.onDelete = onDelete
        _id = State(initialValue: state.draft.id)
        _name = State(initialValue: state.draft.name)
        _description = State(initialValue: state.draft.description)
        _category = State(initialValue: state.draft.category ?? "custom")
        _favorite = State(initialValue: state.draft.favorite)
        _recommended = State(initialValue: state.draft.recommended)
        _artifactRetentionDays = State(initialValue: state.draft.artifactRetentionDays.map(String.init) ?? "")
        _workflowSpecText = State(initialValue: state.draft.workflowSpec.displayString)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Template") {
                    TextField("ID", text: $id)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    TextField("Name", text: $name)
                    TextField("Description", text: $description, axis: .vertical)
                        .lineLimit(2...5)
                    TextField("Category", text: $category)
                    TextField("Artifact retention days", text: $artifactRetentionDays)
                        .keyboardType(.numberPad)
                    Toggle("Favorite", isOn: $favorite)
                    Toggle("Recommended", isOn: $recommended)
                }

                Section("Workflow JSON") {
                    TextEditor(text: $workflowSpecText)
                        .font(.body.monospaced())
                        .frame(minHeight: 220)
                }

                if let errorMessage, !errorMessage.isEmpty {
                    Section {
                        Text(errorMessage)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(state.originalId == nil ? "Template Editor" : "Edit Template")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    if let onDelete {
                        Button("Delete", role: .destructive) {
                            Task {
                                isDeleting = true
                                await onDelete()
                                isDeleting = false
                                dismiss()
                            }
                        }
                        .disabled(isDeleting || isSaving)
                    }
                    Button(isSaving ? "Saving…" : "Save") {
                        save()
                    }
                    .disabled(isSaving)
                }
            }
        }
    }

    private func save() {
        guard let workflowData = workflowSpecText.data(using: .utf8) else {
            errorMessage = "Workflow JSON is not valid UTF-8."
            return
        }
        let decoder = JSONDecoder()
        guard let workflowSpec = try? decoder.decode(JSONValue.self, from: workflowData) else {
            errorMessage = "Workflow JSON is invalid."
            return
        }
        let trimmedId = id.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedDescription = description.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedId.isEmpty, !trimmedName.isEmpty, !trimmedDescription.isEmpty else {
            errorMessage = "ID, name, and description are required."
            return
        }
        errorMessage = nil
        let retention = Int(artifactRetentionDays.trimmingCharacters(in: .whitespacesAndNewlines))
        let draft = JobTemplateDraft(
            id: trimmedId,
            name: trimmedName,
            description: trimmedDescription,
            category: category.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "custom" : category.trimmingCharacters(in: .whitespacesAndNewlines),
            favorite: favorite,
            recommended: recommended,
            artifactRetentionDays: retention,
            inputs: state.draft.inputs,
            workflowSpec: workflowSpec
        )
        Task {
            isSaving = true
            await onSave(draft, state.originalId)
            isSaving = false
            dismiss()
        }
    }
}

private struct TemplateDiffSheet: View {
    let diff: JobTemplateDiff
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("v\(diff.fromVersion) → v\(diff.toVersion)")
                        .font(.headline)
                    Text(diff.diff.isEmpty ? "No textual diff available." : diff.diff)
                        .font(.body.monospaced())
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(16)
                        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                .padding(24)
            }
            .navigationTitle(diff.templateId)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
