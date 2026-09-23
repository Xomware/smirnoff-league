import { type ReactNode, useId } from "react";

interface ChartCardProps {
  title: string;
  takeaway: string;
  note?: ReactNode;
  children: ReactNode;
}

export function ChartCard({ title, takeaway, note, children }: ChartCardProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="xp-dialog">
      <h3 id={id} className="xp-dialog-title">{title}</h3>
      <div className="grid gap-2 p-2">
        <p className="stats-takeaway">{takeaway}</p>
        {children}
        {note && <p className="text-xs">{note}</p>}
      </div>
    </section>
  );
}
