# OpenClaw Mission Control iOS

Native SwiftUI shell for the iPad-first Mission Control experience.

## Current Scope

This initial scaffold focuses on:

- an iPad-oriented SwiftUI shell
- a contract-aligned `AgentSummary` model
- a snapshot-plus-events client seam aligned with the Mission Control architecture
- a source-first project layout that can be generated into an Xcode project later

It does **not** yet include:

- authenticated networking
- full App Store-ready API coverage
- true APNs-backed push notifications
- iPhone-specific layouts

What it now does include:

- template and job administration that supplements the dashboard
- local iPad alert plumbing backed by `listen` notification events
- Apple Notes-aware workflow visibility and handoff support

## Layout

- `project.yml`: XcodeGen project spec for generating the app project later
- `OpenClawMissionControl/App`: app entrypoint
- `OpenClawMissionControl/Models`: contract-aligned native models
- `OpenClawMissionControl/Services`: networking and snapshot-loading seams
- `OpenClawMissionControl/ViewModels`: app state and orchestration
- `OpenClawMissionControl/Views`: first Mission Control shell UI

## Contract Alignment

The initial native model mirrors `AgentSummaryContract` from `@openclaw/contracts`:

- `agentId`
- `name`
- `status`
- `lastActivity`

This keeps the iPad shell aligned with the shared contracts package even before automated Swift code generation exists.

## Client Architecture

The native shell is scaffolded around the same reconciliation model described in the architecture spec:

1. load an initial dashboard snapshot
2. subscribe to a Mission Control event stream
3. apply incremental updates when available
4. refetch when the snapshot is invalidated

The live app expects a future canonical backend surface such as:

- `/api/mission-control/snapshot`
- `/api/mission-control/events`

It intentionally does not use the dashboard's fallback-prone directory-discovery agent route as its source of truth.

## Generating An Xcode Project

This repo does not assume Xcode or XcodeGen is installed in every environment. When the local macOS toolchain is ready:

1. install Xcode
2. install XcodeGen
3. run `xcodegen generate --spec apps/ios/project.yml`
4. open the generated `.xcodeproj`

Until then, this folder serves as the native source scaffold and architecture anchor for future iPad work.
