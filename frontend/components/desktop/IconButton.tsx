import { type ComponentType, type MouseEvent, type SVGProps, useRef } from "react";

interface IconButtonProps {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  onOpen: (e: MouseEvent) => void;
}

// A desktop or folder icon. Double-click with a mouse, as on XP. A click with
// detail 0 is Enter, Space or a screen reader, and a touch gets no double-click,
// so a tap opens on its click. Not on pointerup: the click that follows a tap
// would land on whatever the open put under the finger.
export function IconButton({ Icon, label, onOpen }: IconButtonProps) {
  const pointer = useRef("");
  return (
    <button
      type="button"
      className="xp-desktop-icon"
      onPointerDown={(e) => {
        pointer.current = e.pointerType;
      }}
      onDoubleClick={onOpen}
      onClick={(e) => (e.detail === 0 || pointer.current === "touch") && onOpen(e)}
    >
      <Icon width={40} height={40} />
      <span className="xp-desktop-icon-label">{label}</span>
    </button>
  );
}
