---
name: GitHub sync authentication and divergence recovery
description: Environment-specific behavior when syncing this project with its GitHub remote, and how to push when local and remote main have diverged.
---

The GitHub remote can reject Git CLI fetch/pull/push authentication ("Invalid
username or token. Password authentication is not supported") even though
the Replit GitHub connection is installed/authorized and cached
remote-tracking refs (`github/main`) resolve fine locally.

**Why:** The CLI credential bridge and the connected GitHub API authorization
are separate paths, so a CLI authentication failure does not mean the
connection or repo is unavailable — only that `git fetch`/`git push` over
HTTPS can't use it directly.

**How to apply:**
- Do the read-side work locally first: cached `github/main` objects are
  often already present, so `git log`/`git rebase` against `github/main`
  can work even when a live `git fetch` fails.
- Get the true current remote SHA via the GitHub connection's Octokit client
  (`client.rest.git.getRef({ owner, repo, ref: 'heads/main' })`), not by
  trusting the stale local `github/main` pointer.
- If local `main` has unpushed commits AND remote `main` has advanced with
  commits local doesn't have (real divergence, not just a stale pointer),
  `git rebase github/main main` locally (git objects are usually present)
  rather than force-pushing over the remote's work.
- To publish when CLI push auth is broken: use the Octokit **Git Data API**
  directly — diff the two commits' file lists, `createBlob` each
  changed/added file (base64 for binary, utf-8 for text), `createTree` with
  `base_tree` set to the current remote tree, `createCommit` with
  `parents: [remoteSha]`, then `updateRef` (fast-forward, `force: false`).
  This squashes the pushed local commits into one remote commit — that's
  fine when only content parity matters, not per-commit history.
- After an API-based push like this, the new remote commit SHA won't exist
  as a local git object (it was synthesized server-side with different
  commit metadata), so `git update-ref`/`git reset` to it will fail with
  "nonexistent object". That's expected — just verify content parity via
  `git rev-parse HEAD^{tree}` matching the tree passed to `createTree`, and
  leave local `main` where it is; don't waste time chasing exact SHA
  equality between local and remote after a synthesized push.

Connector write bursts can trigger a temporary Replit Cloudflare block even
while GitHub reads continue to work. The failure is an HTML "Sorry, you have
been blocked" response from replit.com, not a GitHub authentication error.

**Why:** Repeated blob uploads through both `proxyFetch` and the connector's
Octokit client hit the same Replit-side transport protection.

**How to apply:** Stop retrying once the Cloudflare page appears; preserve the
local merge and resume the write later. Reauthorizing GitHub does not fix this
case because authenticated reads still succeed.
