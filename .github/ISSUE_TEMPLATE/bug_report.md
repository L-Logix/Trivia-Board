---
name: Bug Report
about: Report a bug to help improve the Trivia Broadcast Engine
title: ''
labels: bug, needs triage
assignees: ''
---

## Summary

A clear and concise description of what the bug is.

## Steps to Reproduce

Exact steps to reproduce the behavior:

1. Start the server: `trivia start` (or `node bin/trivia.js start`)
2. Open broadcast view at `http://localhost:3333/broadcast`
3. Open dashboard at `http://localhost:3333/dashboard`
4. Click on `...`
5. Observe the error

## Expected Behavior

What you expected to happen instead of what actually happened.

## Actual Behavior

What actually happened. Include error messages, unexpected UI behavior, or incorrect scoring.

## Screenshots / Recordings

If applicable, add screenshots, screen recordings, or server console logs to help explain the problem.

## Environment

- **OS:** [e.g. Windows 11, macOS 15, Ubuntu 24.04]
- **Node.js version:** [e.g. 18.20, 22.14 - run `node --version`]
- **Browser (for UI issues):** [e.g. Chrome 130, Firefox 132]
- **Install method:** [e.g. git clone + npm install, global npm install]
- **Config:** Run `trivia setup --print` (if available) or attach your `config.json` (redact any personal paths)

## Console Errors

Paste any browser console errors or server terminal output:

```
...
```

## Additional Context

- Does this happen every time or intermittently?
- Does it only happen with a specific config (e.g. child-host mode, specific bonus clue count)?
- Has it ever worked before? If so, what changed?
