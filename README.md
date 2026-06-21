# TechnoThatch Trivia Broadcast Engine

A highly professional, dual-screen, offline-first trivia game engine built for live hosting. Features a zero-UI broadcast display for the audience and a stress-free control dashboard for the host.

Developed by **TechnoThatch Software Solutions**.

## Features
* **Dual-Screen Architecture:** TV screen shows pure graphics; Laptop shows answers and controls.
* **Global CLI Wizard:** Configure everything from grid size to timer limits straight from the terminal.
* **Automated Buzzer:** Built-in countdown timer automatically triggers the "Time's Up" sound.
* **Google Sheets Sync:** Load all your trivia dynamically without editing code.
* **Custom Assets:** Upload your own logo and audio files during setup.

## 1. Installation

Requires [Node.js](https://nodejs.org/) installed on your machine.

Clone this repository, navigate to the folder in your terminal, and install it globally:

```bash
git clone [https://github.com/yourusername/technothatch-trivia.git](https://github.com/yourusername/technothatch-trivia.git)
cd technothatch-trivia
npm install -g .
```

Note: The `-g` flag binds the application to your system, allowing you to use the custom terminal commands below.

## 2. Configuration & Setup

Run the setup wizard:

```bash
trivia setup
```

Choose "Typical Trivia" for instant classic rules (6x5 grid, $200-$1000, Daily Doubles, 5s timer) or "Custom" to adjust everything.

### Setting Up Your Google Sheet

The wizard accepts a **simple format** where each row is one complete question:

| Category | Clue | Answer |
|----------|------|--------|
| History | This president was born in 1732 | Who is George Washington? |
| History | This document begins "We the People" | What is the Constitution? |
| Science | H2O is the chemical formula for this | What is water? |
| Pop Culture | This 90s band sang "Smells Like Teen Spirit" | What is Nirvana? |

**Rules:**
- **Row 1 must be:** `Category`, `Clue`, `Answer` (header row)
- Each row below = one question with its category, clue text, and answer text
- Add as many questions per category as you want (the wizard fills the grid in order)
- The wizard generates a `trivia-template.csv` file locally to use as a reference

**Alternative grid format** (classic Jeopardy-style):
- Row 1: Category names across columns
- Row 2: Clues for the first row of values
- Row 3: Answers for the first row of values
- Repeat clue/answer pairs for each value level

### Publishing Your Sheet

1. In Google Sheets: **File > Share > Publish to Web**
2. Choose: **Entire Document > Comma-separated values (.csv)**
3. Click **Publish**
4. Copy the URL and paste it into the wizard
   - Regular sheet URLs work too (auto-converted to CSV export)

### Round 2 (Double Round)

If you have Double Round enabled, the wizard will ask for a **separate URL** for Round 2 data. You can use a different sheet/tab in the same document. Press Enter to reuse the same sheet for both rounds.

### Custom Assets

During setup, you can optionally upload:
- **Logo:** A custom PNG or SVG to display on the broadcast screen.
- **Host Intro:** An MP3 recording for the opening sequence.
- **Time's Up:** A buzzer/chime MP3 for when time expires.
- **Daily Double:** A sound effect MP3 for Daily Double reveals.
- **Think Music:** A 30-second MP3 for the Final Showdown.
- **Applause:** An applause MP3 for the winner.

## 3. Adding Your Custom Announcer Audio

To make the game look and sound like a real broadcast, you must provide your own announcer voiceover for the opening title screen.

1. Navigate to the `/public/audio/` folder.
2. Delete the placeholder `host-intro.mp3` file.
3. Record an MP3 of someone saying: "This is Trivia Board! And now, the host of Trivia Board... [Your Name]!"
4. Save your new file in the folder and name it exactly `host-intro.mp3`.

## 4. Going Live (Broadcast Mode)

When you are ready to host your game, run:

```bash
trivia start
```

1. Open your web browser to `http://localhost:3333`.
2. Connect your laptop to your TV via HDMI.
3. **Extend Your Displays** (Do not mirror).
4. Open the **Broadcast View** (`http://localhost:3333/broadcast`) and drag it to the TV.
5. Click the broadcast screen once to initialize audio.
6. Open the **Host Dashboard** (`http://localhost:3333/dashboard`) on your laptop.
7. Press **Spacebar** on your dashboard to start the intro sequence!

## License

MIT
