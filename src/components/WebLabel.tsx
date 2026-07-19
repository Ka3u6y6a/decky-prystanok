import { ReactElement } from "react";
import { FaGlobe } from "./icons";

/** Label for buttons that open an external page — globe icon + text, shared style. */
export default function WebLabel({ children }: { children: string }): ReactElement {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
      }}
    >
      <FaGlobe style={{ flexShrink: 0, fontSize: "1em" }} />
      <span>{children}</span>
    </span>
  );
}
