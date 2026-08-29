---
name: GitHub pull authentication
description: Environment-specific behavior when syncing this project with its GitHub remote.
---

The GitHub remote can reject Git CLI fetch/pull authentication even though the Replit GitHub connection is installed and the remote-tracking branch is available locally.

**Why:** The CLI credential bridge and the connected GitHub API authorization are separate paths, so a CLI authentication failure does not necessarily mean the repository or connection is unavailable.

**How to apply:** Check the remote-tracking ref and its parent relationship before attempting a more invasive recovery; preserve uncommitted work with a stash when integrating an incoming fast-forward.