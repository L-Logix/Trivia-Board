# Contributing to Trivia Broadcast Engine

Thanks for your interest in contributing! This project is distributed under the **GNU GPL v3** — by submitting changes, you agree that your contributions will be licensed under the same terms.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Guidelines](#coding-guidelines)
- [Pull Request Process](#pull-request-process)
- [Feature Requests](#feature-requests)
- [Bug Reports](#bug-reports)

## Code of Conduct

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold its standards.

## Getting Started

1. Fork the repository
2. Clone your fork: `gh repo clone your-username/Trivia-Board`
3. Install dependencies: `npm install`
4. Run setup: `npm run setup`
5. Start the server: `npm start`

## Development Setup

- **Node.js 18+** required
- No build step — plain HTML/CSS/JS served by Express
- Socket.IO handles all real-time communication
- Open `http://localhost:3333/broadcast` and `http://localhost:3333/dashboard` in two browser windows

### Quick Verification

```bash
npm start
# Server starts on port 3333
```

Open both URLs above, click Initialize Audio on the broadcast view, then press Start on the dashboard.

## Project Structure

```
src/
  cli/
    setup.js     — Interactive config wizard
    start.js     — Server launcher
  server/
    index.js            — Express + Socket.IO setup
    socket-handlers.js  — All game event handlers
    game-state.js       — Canonical game state + logic
public/
  broadcast.html / .js / .css  — Audience-facing display (zero UI)
  dashboard.html / .js / .css  — Host controls
  editor.html                  — Content editor
  stats.html                   — Post-game stats
  helper-*.html                — Secondary dashboards
config.json                    — Game content + settings
```

## Coding Guidelines

### Language & Style

- **JavaScript (ES6+)** — no transpilers, no TypeScript
- Use `var` consistently (not `let`/`const`) to match existing code
- Semicolons are **required**
- Single quotes for strings
- 2-space indentation

### Conventions

- **Event-driven**: all game mutations go through Socket.IO events
- **Game state is authoritative**: the server (`game-state.js`) is the single source of truth; clients only reflect state
- **Socket handlers** go in `socket-handlers.js`; add a new `socket.on(...)` for new events
- **Socket events** use kebab-case names (e.g., `championship-reveal-step`)
- **CSS**: BEM-like naming, avoid deep nesting, use CSS Grid/Flexbox for layout
- **Accessibility**: broadcast view should work as a full-screen display; dashboard should be usable via keyboard

### Audio

- Files placed in `public/audio/` as `.mp3`
- Pre-warmed on first user click (played at volume 0, then paused)
- `boardfill` audio pre-decoded via `AudioContext.decodeAudioData` for zero-latency playback

### Testing

There is no formal test framework yet. Please verify your changes by:
1. Starting the server
2. Opening broadcast + dashboard
3. Running through a full game flow (Round 1 → Round 2 → Championship)
4. Checking the browser console for errors

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes, keeping commits atomic and messages concise
3. Update `README.md` if your change adds or modifies a feature
4. Update the LOC count in `README.md` if lines changed significantly
5. Run through the verification flow above
6. Open a PR against `main` with a clear description of what it does and why

### PR Checklist

- [ ] No syntax errors (`node --check` on all modified `.js` files)
- [ ] config.json is valid JSON after any changes
- [ ] Broadcast and dashboard views load without console errors
- [ ] Game flow works end-to-end

## Feature Requests

Open a [GitHub Issue](https://github.com/L-Logix/Trivia-Board/issues/new) with the `enhancement` label. Describe the feature, why it's useful, and any implementation ideas.

## Bug Reports

Open a [GitHub Issue](https://github.com/L-Logix/Trivia-Board/issues/new) with:

- Steps to reproduce
- Expected vs actual behavior
- Browser/OS versions
- Console errors (if any)
- config.json (with sensitive content redacted)

## Getting Help

- Open a [GitHub Discussion](https://github.com/L-Logix/Trivia-Board/discussions)
- Check the [README](README.md) for setup and game flow documentation
