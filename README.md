<div align="center">

# Trivia Broadcast Engine

**v1.0.0** — A professional dual-screen trivia game engine for live hosting

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![npm](https://img.shields.io/badge/npm-v10-blue)](https://npmjs.com/)
[![Platform](https://img.shields.io/badge/platform-windows%20%7C%20macOS%20%7C%20linux-lightgrey)]()
[![PRs](https://img.shields.io/badge/PRs-welcome-blue)]()
[![Maintenance](https://img.shields.io/badge/maintained-yes-brightgreen)]()
[![GitHub stars](https://img.shields.io/github/stars/L-Logix/Trivia-Board?style=social)]()
[![GitHub issues](https://img.shields.io/github/issues/L-Logix/Trivia-Board)]()
[![GitHub last commit](https://img.shields.io/github/last-commit/L-Logix/Trivia-Board)]()
[![GitHub release](https://img.shields.io/github/v/release/L-Logix/Trivia-Board)]()
[![WebSocket](https://img.shields.io/badge/WebSocket-Socket.IO-black)]()
[![Express](https://img.shields.io/badge/Express-v4-blue)]()
[![CSS3](https://img.shields.io/badge/CSS3-Grid%20%7C%20Flexbox-blue)]()
[![JavaScript](https://img.shields.io/badge/JS-ES6+-yellow)]()
[![Accessibility](https://img.shields.io/badge/a11y-friendly-brightgreen)]()
[![Contributions](https://img.shields.io/badge/contributions-open-blue)]()
[![Code size](https://img.shields.io/github/languages/code-size/L-Logix/Trivia-Board)]()
[![Top language](https://img.shields.io/github/languages/top/L-Logix/Trivia-Board)]()
[![GitHub repo size](https://img.shields.io/github/repo-size/L-Logix/Trivia-Board)]()

---

**Fully customizable** — terminology, logo, audio, visuals, and rules. No trademarked content included.

</div>

## Overview

Built for live hosted trivia events. A zero-UI broadcast display drives the audience screen (projector/TV), while a feature-rich dashboard gives the host full control over every aspect of the game.

| View | URL | Purpose |
|------|-----|---------|
| **Broadcast** | `/broadcast` | Audience-facing display (full-screen, no UI) |
| **Dashboard** | `/dashboard` | Host controls (grid, scoring, reveals) |
| **Scoring Helper** | `/helper-scoring` | Secondary scoring controls |
| **Board Helper** | `/helper-board` | Secondary board controls |

## Features

- **Dual-screen architecture** — separate broadcast view and host dashboard
- **3-round format** — Round 1, Round 2 (double values), Championship (Final)
- **Bonus Clues** — configurable per-round with full wager flow
- **Per-category reveal** — full-screen cover → flip animation for each category
- **Custom branding** — logo, promo image, intro video, all labels configurable
- **Custom audio** — intro, timer, bonus clue, think music, applause, correct/incorrect
- **Auto timer** — configurable per-clue countdown with TIME'S UP overlay
- **Responsive board** — scales to any screen size / aspect ratio
- **Network accessible** — other devices can reach dashboard/helpers on the LAN
- **Revealed cell editing** — double-click values, right-click toggle bonus clue
- **Show/hide answers** — host controls answer visibility per clue

## Installation

Requires **Node.js 18+**.

```bash
gh repo clone L-Logix/Trivia-Board
cd Trivia-Board
npm install
```

## Setup

```bash
trivia setup
```

The setup wizard walks you through:
1. Grid dimensions (columns × rows)
2. Point values for each row
3. Number of bonus clues per round
4. Timer duration
5. Round 1 data (CSV file or Google Sheets URL)
6. Round 2 data (optional)
7. Championship data (optional)
8. Player names
9. Custom terminology (Bonus Clue / Championship labels)
10. Custom assets (logo, promo image, intro video, audio files)

### CSV Format

Each row is one question with three columns:

| Category | Clue | Answer |
|----------|------|--------|
| History | This president was born in 1732 | Who is George Washington? |

Row 1 must be the header row: `Category, Clue, Answer`.

## Running

```bash
trivia start
```

Opens on port **3333**. Open `http://localhost:3333` in your browser, or use the LAN address printed in the terminal for other devices.

### Quick Start

1. Open **Broadcast** (`/broadcast`) on your TV/projector — click to initialize audio
2. Open **Dashboard** (`/dashboard`) on your host laptop
3. Press **SPACEBAR** or click **START** on the dashboard to begin

### Game Flow

1. **Intro** — video or logo animation plays → automatically advances to board
2. **Board phase** — categories are covered; click each category cell to reveal (individual cover → name animation) or use REVEAL CATEGORIES for bulk reveal
3. **Populate Board** — price cover drops, cells flip in with board-fill sound
4. **Select clues** — click any cell to open it
5. **Bonus Clues** — when found, broadcast shows animation + sound; host selects player + wager, then reveals the clue and starts the timer
6. **Answer** — host reveals answer, marks correct/incorrect (bonus wager auto-applied)
7. **Round 2** — same flow with doubled values
8. **Championship** — final question with wager and think music; host reveals results then shows winner with outro music

## Asset Files

Place custom files in `public/`:

| File | Location | Purpose |
|------|----------|---------|
| `audio/host-intro.mp3` | Intro theme | Plays during logo animation |
| `audio/times-up.mp3` | Time's up | When timer expires |
| `audio/daily-double.mp3` | Bonus clue | When bonus clue is activated |
| `audio/final-think.mp3` | Think music | During championship thinking phase |
| `audio/applause.mp3` | Applause | End of game |
| `audio/board-fill.mp3` | Board fill | When cells populate |
| `audio/correct.mp3` | Correct | Correct answer |
| `audio/incorrect.mp3` | Incorrect | Incorrect answer |
| `audio/outro.mp3` | Outro | End credits |
| `video/intro.mp4` | Intro video | Full-screen intro (optional) |
| `img/logo.*` | Logo | Custom logo (PNG/SVG) |
| `img/promo.*` | Promo | Background image (optional) |

## Architecture

```
src/
  cli/
    setup.js    — Interactive configuration wizard
    start.js    — Server launcher
  server/
    index.js    — Express + Socket.IO setup
    socket-handlers.js — All game event handlers
    game-state.js      — Game state management
public/
  broadcast.html — Audience display
  dashboard.html  — Host dashboard
  helper-scoring.html — Secondary scoring page
  helper-board.html   — Secondary board page
  css/
    broadcast.css
    dashboard.css
  js/
    broadcast.js
    dashboard.js
    socket-client.js
```
