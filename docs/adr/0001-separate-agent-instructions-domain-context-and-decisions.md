# Separate agent instructions, domain context, and decisions

This project keeps `AGENTS.md`, `CONTEXT.md`, and `docs/adr/` separate because they answer different questions: `AGENTS.md` tells AI agents how to work in the repository, `CONTEXT.md` defines the domain language, and ADRs record decisions that would be surprising without context. We chose this split to keep agent instructions short while preserving terminology and decision history in documents designed for those jobs.
