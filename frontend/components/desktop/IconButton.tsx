import type { ComponentType, MouseEvent, SVGProps } from "react";

interface IconButtonProps {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  onOpen: (e: MouseEvent) => void;
}

// A desktop or folder icon. Double-click with a mouse, as on XP. A click with
// detail 0 is Enter, Space or a screen reader, and a touch gets no double-click at all.
export function IconButton({ Icon, label, onOpen }: IconButtonProps) {
  return (
    <button
      type="button"
      className="xp-desktop-icon"
      onDoubleClick={onOpen}
      onClick={(e) => e.detail === 0 && onOpen(e)}
      onPointerUp={(e) => e.pointerType === "touch" && onOpen(e)}
    >
      <Icon width={40} height={40} />
      <span className="xp-desktop-icon-label">{label}</span>
    </button>
  );
}
