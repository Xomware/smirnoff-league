import "./board.css";

interface BoardHeadProps {
  labels: string[];
  // Columns before this index hold text; the rest are right-aligned numbers.
  numbersFrom?: number;
}

export function BoardHead({ labels, numbersFrom = 2 }: BoardHeadProps) {
  return (
    <div className="board-head" aria-hidden="true">
      {labels.map((l, i) => (
        <span key={i} className={i >= numbersFrom ? "board-num" : undefined}>
          {l}
        </span>
      ))}
    </div>
  );
}
