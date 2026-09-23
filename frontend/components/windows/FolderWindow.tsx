"use client";

import { useContext } from "react";

import { IconButton } from "@/components/desktop/IconButton";
import { DrillContext, NavigateContext } from "@/components/views/drill-link";
import { FolderIcon } from "@/components/xp/icons";
import { ICE_APPS, ICES_PATH } from "@/lib/desktop/ice-apps";

import "./folder.css";

// Explorer's large-icon view of the Ices folder. An app opens in place, so the
// window's Back returns here; Ctrl opens it in a window of its own.
export function FolderWindow() {
  const navigate = useContext(NavigateContext);
  const open = useContext(DrillContext);

  return (
    <div className="xp-explorer">
      <div className="xp-address">
        <span aria-hidden>Address</span>
        <span className="xp-address-field">
          <FolderIcon className="shrink-0" />
          <input aria-label="Address" readOnly value={ICES_PATH} />
        </span>
      </div>
      <ul className="xp-folder-icons" aria-label="Ices">
        {ICE_APPS.map(({ kind, label, Icon }) => (
          <li key={kind}>
            <IconButton
              Icon={Icon}
              label={label}
              onOpen={(e) => (navigate && !e.ctrlKey && !e.metaKey ? navigate({ kind }) : open({ kind }))}
            />
          </li>
        ))}
      </ul>
      <p className="xp-statusbar">{ICE_APPS.length} objects</p>
    </div>
  );
}
