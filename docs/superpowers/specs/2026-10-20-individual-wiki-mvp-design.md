# Individual Wiki MVP Design

## Status

Approved in product discussion on 2026-10-20. This document defines the product and architecture direction for the MVP. Implementation begins only after the implementation plan is reviewed.

## Product intent

Build a personal wiki for individuals who collect useful notes and ideas, organize them into pages, and want to find them again. The product should make writing and retrieval feel calm and clear, with a distinct design system of its own.

The first release proves the personal writing experience. Collaboration and real-time editing are later work.

## Target user and primary journey

The first audience is individuals maintaining reference knowledge. The primary journey is:

1. Create a page for a useful note or idea.
2. Organize it under a parent page when structure helps.
3. Write and rearrange blocks in the editor.
4. Return through navigation, recent pages, favorites, or search.
5. Archive a page when it is no longer active and restore it if needed.

## MVP scope

### Included

- A signed-in individual account with one private workspace.
- Nested pages, favorites, recent pages, search, archive, and restore.
- A block editor supporting paragraphs, headings, lists, checklists, quotes, dividers, and code blocks.
- Slash commands, keyboard shortcuts, block reorder, undo/redo, and autosave.
- Save states for saving, saved, and save failure, with retry.
- A custom visual system for navigation, editor controls, menus, dialogs, and forms, using accessible primitives where useful.
- Deterministic seed data, static checks, domain tests, and browser verification.

### Deferred

- Workspace membership, invitations, shared page access, and real-time collaboration.
- Databases, formulas, public publishing, offline sync, comments, and AI features.
- Journaling-specific or project-management workflows.

## Product and visual direction

The product direction is a personal wiki for reference knowledge. Its visual direction is calm editorial: clear typography, warm neutral surfaces, generous spacing, and a distinctive accent color. The layout should make page browsing straightforward while keeping the writing canvas central. Avoid making the interface dense or imitating physical paper.

The design system should define semantic color, type, spacing, border, and focus tokens, then expose shared components for navigation, buttons, menus, dialogs, and inputs. Editor styling should use these tokens so editor controls feel part of the same product.

## Architecture

### Stack

- Next.js App Router and strict TypeScript.
- PostgreSQL, Drizzle, and versioned SQL migrations.
- Accessible UI primitives with a custom token and component layer.
- BlockNote as the editor candidate, gated on a focused prototype of required interactions and styling.
- Vitest for domain logic and Playwright for browser journeys.

See [ADR 0001](../../adr/0001-mvp-application-stack.md) for rationale and the editor validation gate.

### Domain boundaries

Organize code around product domains. For the MVP, the core areas are account, private workspace, page, and search. Each domain owns its types, validation, commands, queries, and persistence access. UI components call domain operations and do not write database rows directly. Reads and mutations must be scoped to the signed-in user at the domain boundary.

Page hierarchy and metadata are persisted independently from editor content. Store editor content as versioned data behind an adapter so editor serialization does not become the page domain's public interface. Validate page and content inputs before persistence. Do not add real-time collaboration or CRDT data structures in this MVP.

See [ADR 0002](../../adr/0002-domain-boundaries-and-agent-verification.md) for rationale and enforcement principles.

### Data flow

Browser UI submits validated commands to server-side domain operations. Those operations establish the signed-in user, enforce ownership, validate the requested change, and persist through the domain's database access. Queries apply the same user scoping before returning page data. Search indexes page titles and supported block text for the signed-in user's active pages.

## Failure behavior

- Display saving, saved, and couldn't-save states.
- On save failure, preserve the current editor content and offer retry.
- If navigation would discard unsaved content, ask whether to stay or leave and state clearly if edits will be lost.
- Never silently discard unsaved content. Explain when a save is pending or has failed.
- Show clear empty, loading, and error states for page navigation and search.
- Archive is reversible through restore; archiving a page archives its descendants as a subtree, and restoring the root restores the subtree. Permanent deletion is outside the MVP.

## Verification and release criteria

The core browser journey must cover creating a page, nesting it, adding and reordering blocks, reloading, and finding the page through search. Domain checks cover hierarchy invariants, account ownership, and content validation. CI runs type checks, lint, and relevant tests.

The app must boot from a fresh checkout with documented commands and deterministic seed data. Agents need a reproducible browser flow and inspectable failures. Choose and record the authentication approach before implementing the account domain. Keep `AGENTS.md` concise; place detailed architecture and product rationale in linked documentation.

## Work decomposition

The work is divided into phases and subphases in the [MVP roadmap](../../roadmap/notion-clone-mvp.md). Each subphase should fit one focused session, have explicit exit criteria, and end with a handoff recording changes, verification, decisions, and unresolved risks.

Implementation starts after this spec is reviewed and an implementation plan is created and reviewed.
