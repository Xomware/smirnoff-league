"use client";

export const LINE_ICONS = {
  home: "M3 11l9-7 9 7v9H3z",
  games: "M3 12a9 6 0 1 0 18 0a9 6 0 1 0-18 0M8 12h8M10 10v4M14 10v4",
  ices: "M10 2h4v4l2 3v12a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l2-3z",
  league: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8",
  menu: "M4 7h16M4 12h16M4 17h16",
  search: "M4 11a7 7 0 1 0 14 0a7 7 0 1 0-14 0M20 20l-3.5-3.5",
  back: "M15 5l-7 7 7 7",
};

interface LineIconProps {
  d: string;
  size?: number;
}

export function LineIcon({ d, size = 22 }: LineIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
