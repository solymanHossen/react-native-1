# Antigravity Agent Behavior & Safety Rules

## 1. Autonomous Execution
- Execute all code edits, file operations, dependency checks, local tests, builds, and diagnostic terminal commands automatically.
- Do not stop to ask for confirmation or approval for routine development tasks.

## 2. Git & Push Restrictions
- **`git push` Safeguard**: You must **NEVER** execute `git push` automatically.
  - Before running any `git push`, you **MUST explicitly ask the user for confirmation** and wait for their response.
  - Always summarize what branch, remote, and commit(s) are about to be pushed when asking for confirmation.
- Safe read-only and local git commands (`git status`, `git diff`, `git log`, `git add`, `git commit`, etc.) can be run autonomously without asking.
