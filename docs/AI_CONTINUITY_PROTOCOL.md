# AI Continuity Protocol

## Persistence-first rule
The repository is the durable source of truth for project evolution. Conversation history, local workspaces, accounts, machines, and specific AI sessions are temporary and must never be required to resume development.

Any meaningful evolution — code, architecture, business decisions, contracts, fixes, discoveries, blockers, or operational state — must be materialized in Git.

## Required lifecycle
1. Read the repository context before changing the project.
2. Implement and validate the change.
3. Update the relevant context, architecture, status, or handoff documentation.
4. Commit the complete evolution to Git.
5. Push or open a pull request when repository workflow requires it.
6. Leave a clear handoff when work remains incomplete.

A task is not considered durably complete merely because it worked inside an AI session or local workspace.

## Continuity test
Another AI or developer must be able to clone the repository, read its materialized context, understand the current state, and continue without relying on this conversation.
