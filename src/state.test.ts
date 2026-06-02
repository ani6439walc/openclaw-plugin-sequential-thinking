import { describe, it, expect, beforeEach } from "vitest";
import { SessionStateManager } from "./state.js";

describe("SessionStateManager", () => {
  let manager: SessionStateManager;

  beforeEach(() => {
    manager = new SessionStateManager();
  });

  describe("registerToolCall + getOrCreateState", () => {
    it("registers a tool call and creates state for session", () => {
      manager.registerToolCall("session1", "t1");

      const state = manager.getOrCreateState("session1");
      expect(state).toBeDefined();
      expect(state.thoughtHistory).toEqual([]);
      expect(state.branches).toEqual({});
    });

    it("returns same state on multiple calls for same session", () => {
      const state1 = manager.getOrCreateState("session1");
      const state2 = manager.getOrCreateState("session1");

      expect(state1).toBe(state2);
    });
  });

  describe("getStateByToolCallId", () => {
    it("returns full RunState including thoughtHistory and branches", () => {
      manager.registerToolCall("session1", "t1");
      const state = manager.getStateByToolCallId("t1");

      expect(state).toBeDefined();
      expect(state).toHaveProperty("thoughtHistory");
      expect(state).toHaveProperty("branches");
      expect(Array.isArray(state!.thoughtHistory)).toBe(true);
      expect(typeof state!.branches).toBe("object");
    });

    it("returns undefined for unknown tool call id", () => {
      const state = manager.getStateByToolCallId("unknown");
      expect(state).toBeUndefined();
    });

    it("returns undefined after tool call mapping is removed", () => {
      manager.registerToolCall("session1", "t1");
      manager.removeToolCallMapping("t1");

      const state = manager.getStateByToolCallId("t1");
      expect(state).toBeUndefined();
    });
  });

  describe("removeToolCallMapping", () => {
    it("removes the mapping between tool call id and session key", () => {
      manager.registerToolCall("session1", "t1");
      expect(manager.getStateByToolCallId("t1")).toBeDefined();

      manager.removeToolCallMapping("t1");
      expect(manager.getStateByToolCallId("t1")).toBeUndefined();
    });

    it("does not affect other tool call mappings", () => {
      manager.registerToolCall("session1", "t1");
      manager.registerToolCall("session1", "t2");

      manager.removeToolCallMapping("t1");

      expect(manager.getStateByToolCallId("t2")).toBeDefined();
    });
  });

  describe("session isolation", () => {
    it("two sessions do not interfere with each other", () => {
      const state1 = manager.getOrCreateState("session1");
      state1.thoughtHistory.push({
        thought: "thought 1",
        thoughtNumber: 1,
        totalThoughts: 1,
        nextThoughtNeeded: false,
      });

      const state2 = manager.getOrCreateState("session2");
      state2.thoughtHistory.push({
        thought: "thought 2",
        thoughtNumber: 1,
        totalThoughts: 1,
        nextThoughtNeeded: false,
      });

      expect(manager.getOrCreateState("session1").thoughtHistory).toHaveLength(
        1,
      );
      expect(manager.getOrCreateState("session2").thoughtHistory).toHaveLength(
        1,
      );
      expect(
        manager.getOrCreateState("session1").thoughtHistory[0].thought,
      ).toBe("thought 1");
      expect(
        manager.getOrCreateState("session2").thoughtHistory[0].thought,
      ).toBe("thought 2");
    });
  });

  describe("purgeSessionState", () => {
    it("removes state for a session key", () => {
      manager.getOrCreateState("session1");
      expect(manager.hasState("session1")).toBe(true);

      manager.purgeSessionState("session1");
      expect(manager.hasState("session1")).toBe(false);
    });

    it("does not affect other sessions", () => {
      manager.getOrCreateState("session1");
      manager.getOrCreateState("session2");

      manager.purgeSessionState("session1");

      expect(manager.hasState("session1")).toBe(false);
      expect(manager.hasState("session2")).toBe(true);
    });
  });

  describe("hasState", () => {
    it("returns true for existing session", () => {
      manager.getOrCreateState("session1");
      expect(manager.hasState("session1")).toBe(true);
    });

    it("returns false for non-existing session", () => {
      expect(manager.hasState("unknown")).toBe(false);
    });
  });

  describe("stateCount", () => {
    it("returns number of managed sessions", () => {
      expect(manager.stateCount).toBe(0);

      manager.getOrCreateState("session1");
      expect(manager.stateCount).toBe(1);

      manager.getOrCreateState("session2");
      expect(manager.stateCount).toBe(2);

      manager.purgeSessionState("session1");
      expect(manager.stateCount).toBe(1);
    });
  });

  describe("getCleanupCallback", () => {
    it("callback purges all session states", () => {
      manager.getOrCreateState("session1");
      manager.getOrCreateState("session2");
      expect(manager.stateCount).toBe(2);

      const cleanup = manager.getCleanupCallback();
      cleanup("delete");

      expect(manager.stateCount).toBe(0);
    });
  });

  describe("reset", () => {
    it("clears all mappings and states", () => {
      manager.registerToolCall("session1", "t1");
      manager.registerToolCall("session2", "t2");
      manager.getOrCreateState("session3");

      expect(manager.stateCount).toBe(3);

      manager.reset();

      expect(manager.stateCount).toBe(0);
      expect(manager.getStateByToolCallId("t1")).toBeUndefined();
      expect(manager.getStateByToolCallId("t2")).toBeUndefined();
    });
  });
});
