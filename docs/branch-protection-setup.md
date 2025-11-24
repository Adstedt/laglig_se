# Branch Protection Rules Setup

This document explains how to configure GitHub branch protection rules to enforce CI checks before merging.

## Steps to Configure Branch Protection

1. **Navigate to Repository Settings**
   - Go to your GitHub repository
   - Click on **Settings** → **Branches**

2. **Add Branch Protection Rule**
   - Click **Add rule** or **Add branch protection rule**
   - Branch name pattern: `master` (or `main` if you switch to main branch)

3. **Configure Protection Settings**

   Enable the following options:

   ### Required Checks
   - ✅ **Require status checks to pass before merging**
     - ✅ **Require branches to be up to date before merging**
     - Select the following required status checks:
       - `lint-and-typecheck` (from ci.yml)
       - `test` (from ci.yml)
       - `Run E2E Tests` (from preview-e2e.yml)

   ### Pull Request Requirements
   - ✅ **Require a pull request before merging**
     - Number of required approvals: 1 (adjust based on team size)
     - ✅ **Dismiss stale pull request approvals when new commits are pushed**

   ### Other Recommended Settings
   - ✅ **Require conversation resolution before merging**
   - ✅ **Do not allow bypassing the above settings** (unless you're solo)
   - ✅ **Require linear history** (prevents merge commits, enforces rebase or squash)

4. **Save Changes**
   - Click **Create** or **Save changes**

## What This Protects Against

With these rules enabled:

1. **No broken code in master**: All code must pass lint, typecheck, and tests
2. **E2E tests must pass**: Preview deployments are tested before merge
3. **Code review required**: At least one approval needed (if configured)
4. **Clean git history**: Linear history prevents messy merge commits

## Testing the Protection

1. Create a new branch: `git checkout -b test-branch-protection`
2. Make a change and push: `git push origin test-branch-protection`
3. Open a PR on GitHub
4. Try to merge without CI passing - it should be blocked
5. Wait for CI to pass (or fix issues if it fails)
6. Merge once all checks are green

## Bypassing Protection (Emergency Use Only)

If you're the repository owner, you can bypass protection rules in emergencies:

- Uncheck "Do not allow bypassing the above settings"
- Or temporarily disable the rule
- **Remember to re-enable after the emergency fix!**

## CI Workflows Reference

- **ci.yml**: Runs lint, typecheck, prettier, and unit tests on every PR
- **preview-e2e.yml**: Runs E2E tests against Vercel preview deployments
- Both must pass before merging is allowed
