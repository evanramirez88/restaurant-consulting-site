# Claude Code Instructions for restaurant-consulting-site

## CRITICAL: Git Workflow Requirements

### Before Starting Work
1. **ALWAYS** run `git status` to check for uncommitted changes
2. **ALWAYS** run `git pull origin main` to sync with remote
3. If uncommitted changes exist, commit them first or stash them

### During Work
- Commit frequently (every 30-60 minutes of work or after each feature)
- Use descriptive commit messages
- Stage changes incrementally, not all at once at the end

### After Completing Work
1. **REQUIRED**: Run `git status` to verify all changes are tracked
2. **REQUIRED**: Run `git add -A && git commit` with descriptive message
3. **REQUIRED**: Run `git push origin main` to sync to GitHub
4. **VERIFY**: Check GitHub to confirm push succeeded

### Commit Message Format
```
[Component] Brief description

## Changes
- Bullet point changes

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

## Project Structure
- **GitHub Repo**: https://github.com/evanramirez88/restaurant-consulting-site
- **Local Path**: C:\Users\evanr\projects\restaurant-consulting-site
- **Deploy**: Cloudflare Pages (auto-deploy on push to main)

## DO NOT
- Leave uncommitted changes when ending a session
- Work on files without checking git status first
- Assume changes are saved if not pushed to GitHub
- Create new files without adding them to git

## On Session End
Output the following:
```
GIT_STATUS_CHECK:
- Uncommitted files: [count]
- Unpushed commits: [count]
- Last push: [timestamp]
```

If any uncommitted or unpushed work exists, **COMMIT AND PUSH BEFORE ENDING**.
