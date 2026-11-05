import type { ReactNode } from "react";

export interface PageFrameProps {
  children: ReactNode;
}

/** The bordered, softly shadowed page frame that wraps every screen. */
export function PageFrame({ children }: PageFrameProps) {
  return <main className="page-frame">{children}</main>;
}
