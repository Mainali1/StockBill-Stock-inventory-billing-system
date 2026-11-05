export interface AuthChannels {
  "app:getVersion": { in: void; out: { version: string } };
  "auth:status": {
    in: void;
    out: { hasUser: boolean; signedIn: boolean; username: string | null; shopName: string | null };
  };
  "auth:setup": {
    in: { shopName: string; username: string; password: string; confirmPassword: string };
    out: { username: string; shopName: string };
  };
  "auth:login": { in: { username: string; password: string }; out: { username: string; shopName: string } };
  "auth:logout": { in: void; out: void };
}
