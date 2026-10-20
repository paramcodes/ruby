# Notion-style Workspace MVP Roadmap

## Purpose

Build a personal writing experience with a distinct design system first, then add sharing. Keep the architecture ready for collaboration without making real-time editing an MVP requirement.

## Starting direction

- App: Next.js App Router and strict TypeScript.
- Data: PostgreSQL with Drizzle and versioned SQL migrations.
- Editor: prototype BlockNote before committing; hide editor serialization behind an adapter and version stored documents.
- UI: custom design tokens and component APIs, using accessible primitives where useful.
- Verification: deterministic local seed data, static checks, domain tests, and Playwright browser flows.

Decision rationale is recorded in [ADR 0001: MVP application stack](../adr/0001-mvp-application-stack.md) and [ADR 0002: Domain boundaries and agent verification](../adr/0002-domain-boundaries-and-agent-verification.md). The BlockNote choice remains gated on the editor prototype described in Phase 4.2.

## MVP scope

- A signed-in individual account with one private workspace.
- Nested pages, favorites, recent pages, search, archive and restore.
- Block editing for paragraphs, headings, lists, checklists, quotes, dividers and code blocks.
- Slash commands, keyboard shortcuts, drag-to-reorder, undo/redo, autosave and reload persistence.
- A distinct design system for navigation, editor controls, menus, dialogs, and forms.

Defer databases, formulas, public publishing, offline sync, comments, AI features, and real-time collaboration.

## Phases and session-sized subphases

Each subphase is one focused session with a working, reviewable result. Split it if implementation crosses domain boundaries. End each session with a handoff: changes made, verification run and results, decisions made, and remaining risks.

### 0. Product definition — complete

- **0.1 Target user and journeys:** define the target user and prioritize MVP journeys.
- **0.2 Visual direction and editor principles:** define the product's visual direction and interaction principles.
- **Exit:** approved product and architecture direction recorded in the design spec and ADRs.

### 1. Project foundation

- **1.1 App and static checks:** set up Next.js, strict TypeScript, formatting, lint, and CI checks.
- **1.2 Local data:** add PostgreSQL, migrations, and deterministic seed data.
- **1.3 Agent verification:** add reproducible local boot and browser check commands.
- **Exit:** fresh checkout boots locally, loads seed data, and runs the same checks in CI.

### 2. Design system

- **2.1 Tokens:** define color, typography, spacing, borders, and focus states.
- **2.2 App primitives:** build reusable navigation, buttons, menus, dialogs, and inputs.
- **Exit:** app shell has a coherent visual identity and shared component APIs.

### 3. Domain and persistence

- **3.1 Domain model:** define account, private workspace, page, and block types and validation.
- **3.2 Page commands:** implement create, rename, move, archive, and restore.
- **3.3 Ownership boundary:** implement per-account access checks and tests at command/query boundaries.
- **Exit:** page behavior is typed and persisted; UI does not write directly to the database.

### 4. Personal writing flow

- **4.1 Workspace navigation:** build workspace navigation and page list.
- **4.2 Editor prototype:** validate BlockNote schema and styling against product requirements.
- **4.3 Editing and persistence:** implement editing, autosave, reload persistence, undo/redo, and keyboard basics.
- **4.4 Block interactions:** add slash commands, block reorder, and empty/loading/error states.
- **Exit:** user can create a page, write and rearrange blocks, reload, and find content intact.

### 5. MVP usability

- **5.1 Personal navigation:** add favorites and recent pages.
- **5.2 Search:** add page and workspace search.
- **Exit:** agreed individual MVP journeys work end to end, including user-scoped search.

### 6. Release hardening

- **6.1 Accessibility and responsive review:** check keyboard access, focus, and responsive layout.
- **6.2 Browser coverage:** add browser flows for high-risk journeys.
- **6.3 Contributor docs:** document local setup, architecture map, and concise `AGENTS.md` guidance.
- **Exit:** new contributor or agent can boot, change, and verify the app using documented commands.

## Later: sharing and real-time collaboration

After the personal editor, page model, adapter, and user-scoped access boundaries are stable, plan separate sessions for workspace membership, invitations, shared-page permissions, collaboration provider choice, update persistence and reconnect behavior, presence, and conflict handling.

## Session handoff packet

For each session, provide only:

1. The subphase and its exit criteria.
2. Relevant domain/design notes and existing interfaces.
3. Expected file or module ownership.
4. Commands that prove the result.
5. A concise handoff recording changes, verification, and unresolved decisions.

