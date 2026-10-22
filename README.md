# CUNYTechPrepC12

A chess game built with Python and Pygame for CUNY Tech Prep, Cohort 12.

## Project Goal

We're building a chess coach: a bot that finds the best move in any position and gives the player feedback on their own moves. After each move, the coach will:

- **Recommend the best move** for the current position.
- **Suggest a better piece to move** when moving a different piece would have improved the player's position more.
- **Flag mistakes** when a piece was moved to a weak or losing square.
- **Explain why** in plain language, for example "this leaves your knight undefended" or "this gives up control of the center."

The bot's decisions and explanations will draw on chess datasets such as game databases, opening theory, and annotated positions.

> **Status:** The board and GUI are done. The coaching bot is planned but not implemented yet.

## Group Members

| Name | Role |
| --- | --- |
| Argurjana (Ari) Olloni | Group Manager |
| Ludwin Tenezaca | Member |
| Islam Asous | Member |
| Maisha Tasnim Chowdhury | Member |

## Getting Started

### Requirements

- Python 3
- [Pygame](https://www.pygame.org/)

```bash
pip install pygame
```

### Running the Game

```bash
cd chess
python3 gui.py
```

### Running the Website

Requires [Node.js](https://nodejs.org/) 20 or newer.

```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173. The coach panel calls a backend on port 8000. Until that backend exists, the coach shows as offline, but the board and move history still work.

## Controls

| Input | Action |
| --- | --- |
| Click a piece, then a square | Move the piece |
| `U` | Undo |
| `R` | Reset |
| `F` | Flip board |

## Project Structure

```
chess/
├── board.py   # Board state and move logic
└── gui.py     # Pygame interface
backend/       # coaching API (not started yet)
frontend/      # React website
└── src/
    ├── App.jsx                     # game state, connects the panels
    ├── api.js                      # calls to the backend
    └── components/
        ├── Board.jsx               # clickable board
        ├── PromotionPicker.jsx     # choose a piece when a pawn promotes
        ├── CoachChat.jsx           # coach messages, chat box, Hint button
        └── MoveHistory.jsx         # numbered list of the game's moves
```
