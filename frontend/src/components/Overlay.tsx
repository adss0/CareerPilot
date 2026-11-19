// Draws its children at the end of <body>. For anything positioned against the window
// (dialogs, popovers, bars): inside a page, a page's entrance animation would briefly turn
// "fixed" into "relative to the page" and put them in the wrong place.
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export function Overlay({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
