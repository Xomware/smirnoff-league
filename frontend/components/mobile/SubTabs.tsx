import type { PageKind, SubPage } from "@/lib/sections";

interface SubTabsProps {
  label: string;
  pages: SubPage[];
  current: PageKind;
  onPick: (page: SubPage) => void;
}

// A section's pages as a grid, every one in view: three across, or two when
// that leaves no row with a lone page.
export function SubTabs({ label, pages, current, onPick }: SubTabsProps) {
  return (
    <nav aria-label={label} className="m-subtabs" data-cols={pages.length % 3 === 0 || pages.length > 4 ? 3 : 2}>
      {pages.map((page) => (
        <button
          key={page.kind}
          type="button"
          className="m-subtab"
          aria-current={page.kind === current ? "page" : undefined}
          onClick={() => onPick(page)}
        >
          <span className="m-subtab-label">{page.short ?? page.label}</span>
        </button>
      ))}
    </nav>
  );
}
