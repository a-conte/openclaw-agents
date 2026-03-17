import SwiftUI

struct JobSubmitView: View {
    @ObservedObject var viewModel: DashboardViewModel
    @State private var prompt = ""
    @State private var selectedAgent = "main"
    @State private var isSubmitting = false

    private let agents = ["main", "mail", "docs", "research", "ai-research", "dev", "security"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Jobs")
                    .font(.largeTitle.bold())

                submitForm

                if !viewModel.jobs.isEmpty {
                    jobsList
                }
            }
            .padding(24)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .task {
            await viewModel.loadJobs()
        }
    }

    private var submitForm: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Submit Job")
                .font(.title2.bold())

            Picker("Agent", selection: $selectedAgent) {
                ForEach(agents, id: \.self) { agent in
                    Text(agent).tag(agent)
                }
            }
            .pickerStyle(.segmented)

            TextField("Prompt", text: $prompt, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(3...6)

            Button {
                Task {
                    isSubmitting = true
                    defer { isSubmitting = false }
                    await viewModel.submitJob(prompt: prompt, agent: selectedAgent)
                    prompt = ""
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
            .disabled(prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSubmitting)
        }
        .padding(18)
        .background(.background, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var jobsList: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Jobs")
                .font(.title2.bold())

            ForEach(viewModel.jobs) { job in
                JobCardView(job: job)
            }
        }
    }
}

private struct JobCardView: View {
    let job: Job

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(job.targetAgent)
                    .font(.headline)
                Spacer()
                Text(job.status.rawValue.capitalized)
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(statusColor.opacity(0.14), in: Capsule())
                    .foregroundStyle(statusColor)
            }

            Text(job.prompt)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(3)

            if let result = job.result {
                Text(result)
                    .font(.caption)
                    .foregroundStyle(.green)
                    .lineLimit(2)
            }

            if let error = job.error {
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
        switch job.status {
        case .queued: return .gray
        case .running: return .blue
        case .completed: return .green
        case .failed: return .red
        }
    }
}
