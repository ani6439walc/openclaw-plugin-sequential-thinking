import { RunState } from "./tool.js";

export class SessionStateManager {
  private sessionKeyByToolCallId: Map<string, string>;
  private stateBySessionKey: Map<string, RunState>;

  constructor() {
    this.sessionKeyByToolCallId = new Map();
    this.stateBySessionKey = new Map();
  }

  registerToolCall(toolCallId: string, sessionKey: string): void {
    this.sessionKeyByToolCallId.set(toolCallId, sessionKey);
    this.getOrCreateState(sessionKey);
  }

  getOrCreateState(sessionKey: string): RunState {
    if (!this.stateBySessionKey.has(sessionKey)) {
      this.stateBySessionKey.set(sessionKey, {
        thoughtHistory: [],
        branches: {},
      });
    }
    return this.stateBySessionKey.get(sessionKey)!;
  }

  removeToolCallMapping(toolCallId: string): void {
    this.sessionKeyByToolCallId.delete(toolCallId);
  }

  getStateByToolCallId(toolCallId: string): RunState | undefined {
    const sessionKey = this.sessionKeyByToolCallId.get(toolCallId);
    if (!sessionKey) return undefined;
    return this.stateBySessionKey.get(sessionKey);
  }

  purgeSessionState(sessionKey: string): void {
    this.stateBySessionKey.delete(sessionKey);
  }

  hasState(sessionKey: string): boolean {
    return this.stateBySessionKey.has(sessionKey);
  }

  get stateCount(): number {
    return this.stateBySessionKey.size;
  }

  getCleanupCallback(): (
    action: "disable" | "reset" | "delete" | "restart",
  ) => void {
    return () => {
      for (const [key] of this.stateBySessionKey) {
        this.purgeSessionState(key);
      }
    };
  }

  reset(): void {
    this.sessionKeyByToolCallId.clear();
    this.stateBySessionKey.clear();
  }
}
