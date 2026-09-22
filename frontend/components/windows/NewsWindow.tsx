"use client";

import { InfoIcon } from "@/components/xp/icons";
import { useDesktop } from "@/lib/desktop/desktop-context";

export function NewsWindow() {
  const { dispatch } = useDesktop();
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 gap-3">
        <InfoIcon width={32} height={32} className="shrink-0" />
        <div>
          <p className="font-bold">Welcome to the Smirnoff League!</p>
          <p className="mt-2">Fill every slot, start players who play, and stay off the Ice Watch.</p>
        </div>
      </div>
      <button
        type="button"
        className="xp-button mt-2 self-end px-8"
        onClick={() => dispatch({ type: "close", id: "news" })}
      >
        OK
      </button>
    </div>
  );
}
