import { useEffect, useRef } from "react";

// Short marks next to each move, like annotated games use.
const QUALITY_MARKS = { best: "★", good: "", inaccuracy: "?!", mistake: "?", blunder: "??" };

function MoveCell({ move, review, isLast }) {
  if (!move) return <td />;
  const mark = review ? QUALITY_MARKS[review.quality] : "";
  return (
    <td className={isLast ? "last" : undefined}>
      {move.san}
      {mark && <span className={`mark ${review.quality}`} title={review.quality}>{mark}</span>}
    </td>
  );
}

export default function MoveHistory({ history, reviewFor }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [history.length]);

  const rows = [];
  for (let i = 0; i < history.length; i += 2) {
    rows.push({ number: i / 2 + 1, white: i, black: i + 1 });
  }

  return (
    <section className="panel history">
      <h2>Move history</h2>
      {history.length === 0 ? (
        <p className="empty">No moves yet.</p>
      ) : (
        <div className="history-scroll">
          <table>
            <tbody>
              {rows.map(({ number, white, black }) => (
                <tr key={number}>
                  <th scope="row">{number}.</th>
                  <MoveCell move={history[white]} review={reviewFor(white)} isLast={white === history.length - 1} />
                  <MoveCell move={history[black]} review={reviewFor(black)} isLast={black === history.length - 1} />
                </tr>
              ))}
            </tbody>
          </table>
          <div ref={endRef} />
        </div>
      )}
    </section>
  );
}
