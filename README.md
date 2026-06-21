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

Whenever you want to set up a new game or change your board layout, run:

```bash
trivia setup
```

The TechnoThatch CLI wizard will launch. You can choose "Typical Trivia" to instantly apply official TV show rules (6x5 grid, standard values, standard Daily Doubles), or choose "Custom" to manually adjust rows, columns, and timers.

### Connecting Your Data

The setup wizard will ask for a Google Sheets link.

1. Create your trivia board using Google Sheets.
2. Ensure your sheet is set to "Anyone with the link can view".
3. Paste your standard Google Sheets URL into the CLI prompt. The engine automatically converts it to the correct CSV export format.

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
