const FILES = "abcdefgh";

// Solid glyphs for both colors; CSS outlines the white ones. The ︎
// variation selector stops browsers from drawing the pawn as an emoji.
const GLYPHS = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };

// Every square in display order, top-left first.
function displaySquares(flipped) {
  const squares = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const r = flipped ? 7 - row : row;
      const c = flipped ? 7 - col : col;
      squares.push({ name: `${FILES[c]}${8 - r}`, row: r, col: c, displayRow: row, displayCol: col });
    }
  }
  return squares;
}

export default function Board({ board, flipped, selected, targets, lastMove, checkSquare, onSquareClick }) {
  return (
    <div className="board" role="grid" aria-label="Chess board">
      {displaySquares(flipped).map(({ name, row, col, displayRow, displayCol }) => {
        const piece = board[row][col];
        const target = targets.get(name);
        const classes = [
          "square",
          (row + col) % 2 === 0 ? "light" : "dark",
          name === selected && "selected",
          lastMove && (name === lastMove.from || name === lastMove.to) && "last-move",
          lastMove && name === lastMove.to && "landed",
          name === checkSquare && "in-check",
          target && (target.capture ? "target-capture" : "target"),
        ].filter(Boolean).join(" ");

        return (
          <button key={name} className={classes} onClick={() => onSquareClick(name)}
                  aria-label={piece ? `${name} ${piece.color === "w" ? "white" : "black"} ${piece.type}` : name}>
            {displayCol === 0 && <span className="coord rank">{name[1]}</span>}
            {displayRow === 7 && <span className="coord file">{name[0]}</span>}
            {piece && (
              <span className={`piece ${piece.color === "w" ? "white" : "black"}`}>
                {GLYPHS[piece.type]}{"︎"}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export { GLYPHS };
