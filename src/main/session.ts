export interface Session {
  userId: number;
  username: string;
}

let currentSession: Session | null = null;

export function getSession(): Session | null {
  return currentSession;
}

export function setSession(session: Session): void {
  currentSession = session;
}

export function clearSession(): void {
  currentSession = null;
}
