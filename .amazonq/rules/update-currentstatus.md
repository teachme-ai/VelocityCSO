# currentstatus.md Update Rule

## When to apply
Apply this rule whenever you commit code to the repository — after every `git commit` or `git push`.

## CRITICAL: How to apply
Do NOT create a separate chore commit for currentstatus.md.
Instead, update currentstatus.md FIRST, then include it in the SAME git commit as the code changes.
The workflow is:
1. Make code changes
2. Update currentstatus.md
3. `git add <changed files> currentstatus.md`
4. `git commit -m "..."`
5. `git push`

## What to do
After every commit, overwrite `/Users/khalidirfan/projects/Business Agent /currentstatus.md` with an updated version that includes:

### 1. Header
- Last updated date (today)
- Last commit hash (the one just made)
- Branch name
- Deployment target

### 2. Recent Commits section
Prepend the new commit to the top of the Recent Commits list with:
- Commit hash
- Commit message
- **Why:** one sentence explaining the problem that was being solved
- **What changed:** bullet list of files modified and what each change does

### 3. Active Bugs / Known Issues table
- Add any new bugs discovered during this work session
- Mark any bugs as resolved if the commit fixes them
- Keep severity (P0/P1/P2) and status (Open/Fixed/Deferred) accurate

### 4. Build Status tables
- Mark any build sheet items as ✅ Done if this commit completes them
- Leave ❌ Pending for anything not yet done
- Never remove items — only change their status

### 5. Verification Scenarios table
- Update Last Run, Passing, Failing columns if a test scenario was run
- Add new assertion IDs if new assertions were added to the scenarios doc

## Format rules
- Keep the file under 200 lines — summarise older commits if the list grows long
- Use the exact same markdown table format as the existing file
- Never remove the Architecture Notes section
- Commit hash format: backtick-wrapped 7-char short hash e.g. `c97015c`

## Example trigger phrases
Any of these should trigger a currentstatus.md update:
- "commit and push"
- "git commit"
- "git push"
- After any `executeBash` call that runs `git commit`
