import { describe, it, expect, beforeEach } from "vitest";
import { CompositeStateManagement } from "./composite-state-management.js";
import { ThoughtData } from "./tool.js";

describe("CompositeStateManagement", () => {
  let manager: CompositeStateManagement;

  beforeEach(() => {
    manager = new CompositeStateManagement();
  });

  it("should create a new instance", () => {
    expect(manager).toBeInstanceOf(CompositeStateManagement);
  });

  it("should register tool calls and associate them with session keys", () => {
    manager.registerToolCall("session1", "tool1");

    // Check that the tool call is registered
    const state = manager.getStateByToolCallId("tool1");
    expect(state).toBeDefined();
    expect(state?.thoughtHistory).toEqual([]);
    expect(state?.branches).toEqual({});
  });

  it("should get or create state for a session", () => {
    const state = manager.getOrCreateState("session1");
    expect(state).toBeDefined();
    expect(state.thoughtHistory).toEqual([]);
    expect(state.branches).toEqual({});

    // Add some data to the state
    const thought: ThoughtData = {
      thought: "Test thought",
      thoughtNumber: 1,
      totalThoughts: 1,
      nextThoughtNeeded: false,
    };

    manager.addThought("session1", thought);

    const updatedState = manager.getOrCreateState("session1");
    expect(updatedState.thoughtHistory).toHaveLength(1);
    expect(updatedState.thoughtHistory[0].thought).toBe("Test thought");
  });

  it("should handle branch operations", () => {
    const thoughts: ThoughtData[] = [
      {
        thought: "Branch thought",
        thoughtNumber: 1,
        totalThoughts: 1,
        nextThoughtNeeded: false,
      },
    ];

    manager.addBranch("session1", "branch1", thoughts);

    const state = manager.getOrCreateState("session1");
    expect(state.branches["branch1"]).toBeDefined();
    expect(state.branches["branch1"]).toHaveLength(1);
    expect(state.branches["branch1"][0].thought).toBe("Branch thought");

    const branchIds = manager.getBranchIds("session1");
    expect(branchIds).toContain("branch1");
  });

  it("should purge session state correctly", () => {
    // Add some state
    manager.registerToolCall("session1", "tool1");
    const thought: ThoughtData = {
      thought: "Test thought",
      thoughtNumber: 1,
      totalThoughts: 1,
      nextThoughtNeeded: false,
    };
    manager.addThought("session1", thought);

    // Verify state exists
    expect(manager.hasState("session1")).toBe(true);
    expect(manager.getOrCreateState("session1").thoughtHistory).toHaveLength(1);

    // Purge the session
    manager.purgeSessionState("session1");

    // Verify state is cleared
    expect(manager.hasState("session1")).toBe(false);
    const newState = manager.getOrCreateState("session1");
    expect(newState.thoughtHistory).toEqual([]);
    expect(newState.branches).toEqual({});
  });

  it("should track state count", () => {
    expect(manager.stateCount).toBe(0);

    manager.getOrCreateState("session1");
    expect(manager.stateCount).toBe(1);

    manager.getOrCreateState("session2");
    expect(manager.stateCount).toBe(2);

    manager.purgeSessionState("session1");
    expect(manager.stateCount).toBe(1);
  });

  it("should handle tool call mapping removal", () => {
    manager.registerToolCall("session1", "tool1");
    expect(manager.getStateByToolCallId("tool1")).toBeDefined();

    manager.removeToolCallMapping("tool1");
    expect(manager.getStateByToolCallId("tool1")).toBeUndefined();
  });

  it("should provide cleanup callback", () => {
    // Add some state and tool call mappings
    manager.registerToolCall("session1", "tool1");
    const thought: ThoughtData = {
      thought: "Test thought",
      thoughtNumber: 1,
      totalThoughts: 1,
      nextThoughtNeeded: false,
    };
    manager.addThought("session1", thought);
    expect(manager.stateCount).toBe(1);
    expect(manager.getStateByToolCallId("tool1")).toBeDefined();

    // Execute cleanup
    const cleanupFn = manager.getCleanupCallback();
    cleanupFn("reset");

    // State should be cleared
    expect(manager.stateCount).toBe(0);
    expect(manager.getStateByToolCallId("tool1")).toBeUndefined();
  });

  it("should reset all state correctly", () => {
    // Add some state and tool call mappings
    manager.registerToolCall("session1", "tool1");
    manager.registerToolCall("session2", "tool2");
    const thought1: ThoughtData = {
      thought: "Test thought 1",
      thoughtNumber: 1,
      totalThoughts: 1,
      nextThoughtNeeded: false,
    };
    const thought2: ThoughtData = {
      thought: "Test thought 2",
      thoughtNumber: 1,
      totalThoughts: 1,
      nextThoughtNeeded: false,
    };
    manager.addThought("session1", thought1);
    manager.addThought("session2", thought2);

    // Verify state exists
    expect(manager.stateCount).toBe(2);
    expect(manager.getStateByToolCallId("tool1")).toBeDefined();
    expect(manager.getStateByToolCallId("tool2")).toBeDefined();

    // Execute reset
    manager.reset();

    // All state should be cleared
    expect(manager.stateCount).toBe(0);
    expect(manager.getStateByToolCallId("tool1")).toBeUndefined();
    expect(manager.getStateByToolCallId("tool2")).toBeUndefined();
  });

  it("should return a shallow copy of thought history that prevents array mutations", () => {
    const thought: ThoughtData = {
      thought: "Test thought",
      thoughtNumber: 1,
      totalThoughts: 1,
      nextThoughtNeeded: false,
    };
    manager.addThought("session1", thought);

    const history = manager.getThoughtHistory("session1");
    expect(history).toHaveLength(1);
    expect(history[0].thought).toBe("Test thought");

    // Modifying the returned array shouldn't affect internal state
    history.push({
      thought: "Added externally",
      thoughtNumber: 2,
      totalThoughts: 2,
      nextThoughtNeeded: false,
    });

    // The internal state should remain unchanged
    const internalHistory = manager.getThoughtHistory("session1");
    expect(internalHistory).toHaveLength(1);
    expect(internalHistory[0].thought).toBe("Test thought");
  });
});
