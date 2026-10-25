# Hackathon Push Instructions

How Joanna and Tomketal work on this repo without stepping on each other.

## Branches

- `main` — the live project. Never commit directly to it.
- `joanna-ux` — Joanna's branch (UX / interface work).
- `tomketal` — Tomketal's branch (backend work).

Each person works only on their own branch. Changes reach `main` through a Pull Request.

## Daily workflow

### 1. Start of day — pull latest from main

Always do this before you start working, so you have the other person's latest changes.

```bash
git checkout joanna-ux          # make sure you're on your branch
git pull origin main            # pull latest main into your branch
```

(Tomketal runs the same thing but with `git checkout tomketal`.)

If git says "Already up to date" — great, nothing new.
If git opens a merge commit message in the editor — just save and close it (`:wq` in vim, or `Ctrl+X` then `Y` in nano).
If git says there's a **conflict** — stop and ask for help.

### 2. While working — save often

```bash
git add .
git commit -m "short description of what changed"
git push
```

You can commit and push as many times as you want. It only affects your own branch.

### 3. When your work is ready for main — open a Pull Request

1. Go to https://github.com/Tomketal/TokenMetal
2. Click **Pull requests** → **New pull request**
3. Base: `main` ← Compare: `joanna-ux` (or `tomketal`)
4. Write a short title + description of what the PR does
5. Click **Create pull request**
6. The other person reviews it, then clicks **Merge pull request**

Once merged, the changes are on `main` and the other person should `git pull origin main` into their own branch to stay in sync.

## Rules

- **Never push directly to `main`.** Always go through your own branch + PR.
- **Pull from `main` at the start of every work session.** This is the single habit that prevents conflicts.
- **One PR per logical change.** Don't let a branch sit for weeks with 50 unrelated changes — merge small and often.
- **If you change something that affects the other person's code** (e.g., an API response shape, a shared type), tell them before you open the PR.

## Who owns what

- **Joanna (`joanna-ux`)**: `app/` (pages, layouts, components), `components/`, styles, anything visual.
- **Tomketal (`tomketal`)**: `lib/trading`, `lib/recommendations`, `lib/positions`, `app/api/` (backend routes).

Overlap is fine — just coordinate when it happens.

## Quick reference

| Situation | Command |
|---|---|
| Switch to your branch | `git checkout joanna-ux` |
| Pull latest main into your branch | `git pull origin main` |
| See what you changed | `git status` |
| Save your work | `git add . && git commit -m "message"` |
| Send your work to GitHub | `git push` |
| See which branch you're on | `git branch` |

## If something goes wrong

- **"I committed to the wrong branch"** → don't push, ask for help.
- **"I have a merge conflict"** → don't force anything, ask for help.
- **"I pushed something I shouldn't have"** → don't try to delete it, ask for help.

When in doubt: stop, don't force, ask.
