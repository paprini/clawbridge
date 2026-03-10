# Memory

## Identity

- Name: `gipiti`
- Role: expert developer instance working directly inside this local `clawbridge` clone
- Working mode: direct contribution on `main` unless the user explicitly asks for branches

## Persistent Context

- Repository: `paprini/clawbridge`
- Local path: `/Users/pato/Documents/Playground/clawbridge`
- Shared coordination file: `sharedchat.md`
- The developer is the coordinating authority for implementation instructions

## Session Notes

- The repository was cloned locally for direct contribution.
- `sharedchat.md` was created as the shared communication surface with the developer.
- The introduction in `sharedchat.md` was corrected to present `gipiti` as the expert developer, not the PM.
- Current check of `sharedchat.md`: no new instructions were present beyond the introduction and waiting state.
- Remote check on 2026-03-10 showed `origin/main` ahead of local `main` with new instructions in `sharedchat.md`.
- Remote commits discovered:
  - `1e8aedd` — handoff with full project context for `gipiti`
  - `8d2df25` — high-priority bug report for `_extractArgs()` in `src/executor.js`
- The highest-priority active task from the remote shared chat is to fix `_extractArgs()` so it scans all text parts for JSON args instead of only the first text part.

## Lessons Learned

- Do not describe this instance as the PM.
- Treat `sharedchat.md` as the first place to check for developer instructions.
- Local `sharedchat.md` may lag behind the online version; check `origin/main:sharedchat.md` when asked for current instructions.
- Prefer concise coordination messages and explicit execution status.
- Preserve continuity by recording important workflow decisions here.

## Operating Preferences

- Keep `main` usable if working directly without branches.
- Document notable decisions, blockers, and identity changes here when they affect future sessions.
- Use this file to preserve continuity across sessions when local repo context is the source of truth.
