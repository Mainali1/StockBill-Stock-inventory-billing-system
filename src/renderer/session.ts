import { createContext, useContext } from "react";

export interface SessionControls {
  /** Tells the app shell that the owner has signed out, so it stops treating the session as active. */
  markSignedOut: () => void;
}

export const SessionContext = createContext<SessionControls | null>(null);

/** Returns the session controls, or null when a component is rendered outside the app shell (in tests). */
export function useSession(): SessionControls | null {
  return useContext(SessionContext);
}
