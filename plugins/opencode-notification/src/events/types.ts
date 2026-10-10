export type NormalizedEvent =
  | { kind: "busy"; sessionID: string }
  | { kind: "idle"; sessionID: string }
  | { kind: "error"; sessionID: string }
  | { kind: "blocker-opened"; sessionID: string; blockerID: string }
  | { kind: "blocker-closed"; sessionID: string; blockerID: string }
  | { kind: "deleted"; sessionID: string }
