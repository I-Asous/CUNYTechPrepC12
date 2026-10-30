# CUNYTechPrepC12

A chess game built with Python and Pygame for CUNY Tech Prep, Cohort 12.

## Project Goal

We're building a chess coach: a bot that finds the best move in any position and gives the player feedback on their own moves. After each move, the coach will:

- **Recommend the best move** for the current position.
- **Suggest a better piece to move** when moving a different piece would have improved the player's position more.
- **Flag mistakes** when a piece was moved to a weak or losing square.
- **Explain why** in plain language, for example "this leaves your knight undefended" or "this gives up control of the center."

The bot's decisions and explanations will draw on chess datasets such as game databases, opening theory, and annotated positions.

> **Status:** The website and the coach work. The coach grades moves with Stockfish, explains them with rule-based descriptions and the datasets below, and answers chat questions by keyword matching (no AI model calls yet).

## Group Members

| Name | Role |
| --- | --- |
| Argurjana (Ari) Olloni | Group Manager |
| Ludwin Tenezaca | Member |
| Islam Asous | Member |
| Maisha Tasnim Chowdhury | Member |

## Tech Stack

**Frontend** (`frontend/`)

| Tool | Used for |
| --- | --- |
| [React](https://react.dev/) 19 | The website's UI |
| [Vite](https://vite.dev/) 8 | Dev server and build; forwards `/api` requests (including WebSockets) to the backend |
| [chess.js](https://github.com/jhlywa/chess.js) | Move rules for the classic board in the browser |
| [Three.js](https://threejs.org/) 0.186 | The rotatable 3D board |
| Web Workers | Run the 3D chess bot off the main thread |
| Google Fonts (Fredoka, Nunito) | Typography |

**Backend** (`backend/`)

| Tool | Used for |
| --- | --- |
| Python 3 + [FastAPI](https://fastapi.tiangolo.com/) | The coaching API and online game rooms |
| [Uvicorn](https://www.uvicorn.org/) | Runs the API server, including WebSockets for online games and chat |
| [python-chess](https://python-chess.readthedocs.io/) | Move rules, board analysis and talking to Stockfish |
| [Stockfish](https://stockfishchess.org/) | Chess engine behind move grading, hints and the classic bots |
| SQLite | Local copy of the chess datasets |
| [zstandard](https://github.com/indygreg/python-zstandard) | Reading the compressed Lichess data files |

**Data:** the Lichess [opening names](https://github.com/lichess-org/chess-openings), [puzzle database](https://database.lichess.org/#puzzles), [evaluations database](https://database.lichess.org/#evals) and [masters explorer API](https://lichess.org/api#tag/Opening-Explorer). See [Datasets](#datasets).

**Original prototype** (`chess/`): Python with [Pygame](https://www.pygame.org/).

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

Then open http://localhost:5173. The coach panel calls the backend on port 8000. If the backend isn't running, the coach shows as offline, but the board and move history still work.

### Running the Backend

Requires [Stockfish](https://stockfishchess.org/download/) (on macOS: `brew install stockfish`). If it isn't on your PATH, set `STOCKFISH_PATH` to its location.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m app.data.build        # downloads and loads the datasets (see below)
uvicorn app.main:app --reload --port 8000
```

## Practice Bots

Pick an opponent and a color in the Opponent panel, then press Start game. The coach reviews your moves, not the bot's. Undo takes back your last move and the bot's reply.

| Bot | Rating (rough) | How it plays |
| --- | --- | --- |
| Penny | ~400 | Random moves, grabs captures |
| Rookie Ray | ~800 | Picks from Stockfish's top 8 moves, often not the best |
| Casual Cal | ~1100 | Picks from Stockfish's top 5, usually a good one |
| Club Player Clara | ~1500 | Stockfish limited to 1500 Elo |
| Bookworm Bea | ~1800 | Follows opening theory from the openings dataset, then Stockfish at 1800 Elo |
| Master Max | ~2200 | Stockfish limited to 2200 Elo |
| Stockfish | ~3200 | Full strength |

Bots are defined in `backend/app/bots.py`. Stockfish can't play below about 1320 Elo, so the weakest bots choose randomly among its top moves instead.

## 3D Chess

The **🧊 3D Chess** tab has two three-dimensional variants, played against a bot in a rotatable 3D view (drag to spin, scroll to zoom). The "How to play" panel explains how each piece moves.

| Variant | Board | About |
| --- | --- | --- |
| Raumschach | 5×5×5 | The classic space chess by Ferdinand Maack (1907). Adds the Unicorn, which moves through the corners of the cubes. |
| Skyscraper | 8×8×3 | Our own variant: the normal chess army on three stacked boards, White on the bottom and Black on the top. |

Raumschach's pawn rules have several historical versions. We use the commonly played one: pawns move one step forward or one level toward the enemy, capture one step diagonally in those directions, and promote on the far corner row (E5 for White, A1 for Black). Neither variant has castling or en passant.

Stockfish only plays normal chess, so the 3D variants have their own rules engine and bot in `frontend/src/chess3d/`. The bot searches a few moves ahead in a Web Worker so the page stays smooth. There are three levels: Shelly 🐌 (easy), Otto 🐙 (medium) and Zorp 🛸 (hard). Coach Hoot doesn't cover 3D games.

## Playing a Friend Online

Pick the **Friend** card, choose your color and press Let's play. You get a link (and a short code) to send to a friend. When they open it and enter a name, the game starts. Moves and chat sync live over a WebSocket, and anyone else who opens the link can watch and chat.

- The server checks every move, so the game can't be cheated by editing the page.
- Refreshing the page reconnects you to your seat.
- After the game, either player can start a rematch with colors swapped.
- Coach Hoot sits out games against people, so there are no hints mid-game.
- Games live in the backend's memory, so they disappear when it restarts. There are no accounts yet; players just pick a display name.

## Datasets

The coach's feedback draws on these sources. `python -m app.data.build` loads them into `backend/data/chess_data.sqlite`, which is about 1 GB and isn't committed.

| Dataset | Source | What the coach uses it for |
| --- | --- | --- |
| Openings | [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) | Naming the opening and telling when a player leaves known theory |
| Puzzles | [Lichess puzzle database](https://database.lichess.org/#puzzles) | Spotting tactics (forks, pins, hanging pieces) and explaining them in plain language |
| Evaluations | [Lichess evaluations database](https://database.lichess.org/#evals) | Precomputed Stockfish analysis for common early-game positions |
| Masters | [Lichess masters explorer](https://lichess.org/api#tag/Opening-Explorer) | How often strong players chose each move |

The full puzzle and evaluation files are large, so the build keeps a subset: puzzles with at least 80 popularity and 1,000 plays, and evaluations for positions with 26 or more pieces taken from the first 5 million records. `python -m app.data.build --help` lists the options for keeping more.

The masters explorer needs a free Lichess API token. Create one at https://lichess.org/account/oauth/token (no permissions needed) and set it as `LICHESS_TOKEN` before starting the backend. Without it, the other datasets still work.

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
backend/
└── app/
    ├── main.py, routes.py, schemas.py  # FastAPI app and endpoints
    ├── coach.py                        # grades moves, piece hints, best-move hints
    ├── chatbot.py                      # answers chat questions by topic
    ├── bots.py                         # practice opponents
    ├── rooms.py                        # online games between people, with chat
    ├── explain.py                      # plain-language reasons a move is good or bad
    ├── engine.py                       # Stockfish wrapper
    └── data/                           # one module per dataset, plus build.py to load them
frontend/      # React website
└── src/
    ├── App.jsx                     # bot games, and switching to an online game
    ├── api.js                      # calls to the backend
    ├── useRoom.js                  # live connection to an online game
    ├── chessUtils.js               # small helpers shared by both kinds of game
    ├── chess3d/
    │   ├── variants.js             # 3D boards, setups and rules text
    │   ├── engine.js               # 3D move rules, check and game end
    │   ├── bot.js, bot.worker.js   # the 3D bot, run off the main thread
    │   ├── Board3D.jsx             # Three.js view
    │   └── Chess3D.jsx             # the 3D chess page
    └── components/
        ├── Board.jsx               # clickable board
        ├── PromotionPicker.jsx     # choose a piece when a pawn promotes
        ├── CoachChat.jsx           # coach messages, chat box, Hint button
        ├── MoveHistory.jsx         # numbered list of the game's moves
        ├── BotPicker.jsx           # choose an opponent and color
        ├── OnlineGame.jsx          # a game against a friend
        ├── GameChat.jsx            # chat between players
        └── InvitePanel.jsx         # invite link and who's in the game
```
