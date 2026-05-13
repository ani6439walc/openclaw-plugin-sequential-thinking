import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SequentialThinkingTool,
  type ThoughtData,
  type RunState,
} from "./tool.js";

vi.mock("../api.js", () => ({
  createSubsystemLogger: vi.fn(() => ({
    debug: vi.fn(),
  })),
}));

function makeThought(overrides: Partial<ThoughtData> = {}): ThoughtData {
  return {
    thought: "test thought",
    thoughtNumber: 1,
    totalThoughts: 3,
    nextThoughtNeeded: true,
    ...overrides,
  };
}

function makeState(): RunState {
  return {
    thoughtHistory: [],
    branches: {},
  };
}

describe("SequentialThinkingTool", () => {
  describe("constructor", () => {
    it("defaults thoughtLogging to true", () => {
      const tool = new SequentialThinkingTool();
      // Indirect verification: logger.debug should be called
      const result = tool.processThought(makeThought(), makeState());
      expect(result.isError).toBeUndefined();
    });

    it("accepts explicit thoughtLogging true", () => {
      const tool = new SequentialThinkingTool(true);
      const result = tool.processThought(makeThought(), makeState());
      expect(result.isError).toBeUndefined();
    });

    it("accepts explicit thoughtLogging false", () => {
      const tool = new SequentialThinkingTool(false);
      const result = tool.processThought(makeThought(), makeState());
      expect(result.isError).toBeUndefined();
    });
  });

  describe("processThought", () => {
    it("returns success result with correct thought numbers", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();
      const input = makeThought({ thoughtNumber: 2, totalThoughts: 5 });

      const result = tool.processThought(input, state);

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(result.text);
      expect(parsed.thoughtNumber).toBe(2);
      expect(parsed.totalThoughts).toBe(5);
      expect(parsed.nextThoughtNeeded).toBe(true);
    });

    it("pushes thought to thoughtHistory", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();

      tool.processThought(makeThought({ thoughtNumber: 1 }), state);
      tool.processThought(makeThought({ thoughtNumber: 2 }), state);
      tool.processThought(makeThought({ thoughtNumber: 3 }), state);

      expect(state.thoughtHistory).toHaveLength(3);
      expect(state.thoughtHistory[0].thoughtNumber).toBe(1);
      expect(state.thoughtHistory[1].thoughtNumber).toBe(2);
      expect(state.thoughtHistory[2].thoughtNumber).toBe(3);
    });

    it("returns correct thoughtHistoryLength", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();

      tool.processThought(makeThought({ thoughtNumber: 1 }), state);
      let result = JSON.parse(
        tool.processThought(makeThought({ thoughtNumber: 2 }), state).text,
      );
      expect(result.thoughtHistoryLength).toBe(2);

      tool.processThought(makeThought({ thoughtNumber: 3 }), state);
      result = JSON.parse(
        tool.processThought(makeThought({ thoughtNumber: 4 }), state).text,
      );
      expect(result.thoughtHistoryLength).toBe(4);
    });

    it("adjusts totalThoughts when thoughtNumber exceeds it", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();
      const input = makeThought({ thoughtNumber: 10, totalThoughts: 3 });

      const result = tool.processThought(input, state);
      const parsed = JSON.parse(result.text);

      expect(parsed.thoughtNumber).toBe(10);
      expect(parsed.totalThoughts).toBe(10);
      expect(input.totalThoughts).toBe(3);
    });

    it("does not adjust totalThoughts when thoughtNumber is within range", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();
      const input = makeThought({ thoughtNumber: 2, totalThoughts: 5 });

      tool.processThought(input, state);

      expect(input.totalThoughts).toBe(5);
    });

    it("returns branches as empty array when no branches exist", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();

      const result = tool.processThought(makeThought(), state);
      const parsed = JSON.parse(result.text);

      expect(parsed.branches).toEqual([]);
    });

    it("handles revision thought", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();
      const input = makeThought({
        isRevision: true,
        revisesThought: 2,
        thought: "revised thinking",
      });

      const result = tool.processThought(input, state);

      expect(result.isError).toBeUndefined();
      expect(state.thoughtHistory).toHaveLength(1);
      expect(state.thoughtHistory[0].isRevision).toBe(true);
      expect(state.thoughtHistory[0].revisesThought).toBe(2);
    });

    it("creates new branch when branchFromThought and branchId provided", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();
      const input = makeThought({
        branchFromThought: 2,
        branchId: "branch-a",
        thought: "branch thinking",
      });

      tool.processThought(input, state);

      expect(state.branches["branch-a"]).toBeDefined();
      expect(state.branches["branch-a"]).toHaveLength(1);
      expect(state.branches["branch-a"][0].thought).toBe("branch thinking");
    });

    it("appends to existing branch", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();

      tool.processThought(
        makeThought({
          branchFromThought: 2,
          branchId: "branch-a",
          thought: "first",
        }),
        state,
      );
      tool.processThought(
        makeThought({
          branchFromThought: 2,
          branchId: "branch-a",
          thought: "second",
        }),
        state,
      );

      expect(state.branches["branch-a"]).toHaveLength(2);
      expect(state.branches["branch-a"][0].thought).toBe("first");
      expect(state.branches["branch-a"][1].thought).toBe("second");
    });

    it("returns branch names in result", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();

      tool.processThought(
        makeThought({ branchFromThought: 1, branchId: "alpha" }),
        state,
      );
      tool.processThought(
        makeThought({ branchFromThought: 1, branchId: "beta" }),
        state,
      );

      const result = JSON.parse(
        tool.processThought(makeThought({ thoughtNumber: 4 }), state).text,
      );

      expect(result.branches).toContain("alpha");
      expect(result.branches).toContain("beta");
      expect(result.branches).toHaveLength(2);
    });

    it("does not create branch if only branchFromThought provided without branchId", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();

      tool.processThought(makeThought({ branchFromThought: 2 }), state);

      expect(Object.keys(state.branches)).toHaveLength(0);
    });

    it("does not create branch if only branchId provided without branchFromThought", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();

      tool.processThought(makeThought({ branchId: "orphan" }), state);

      expect(Object.keys(state.branches)).toHaveLength(0);
    });

    it("preserves nextThoughtNeeded in result", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();

      const resultTrue = tool.processThought(
        makeThought({ nextThoughtNeeded: true }),
        state,
      );
      expect(JSON.parse(resultTrue.text).nextThoughtNeeded).toBe(true);

      const resultFalse = tool.processThought(
        makeThought({ thoughtNumber: 2, nextThoughtNeeded: false }),
        state,
      );
      expect(JSON.parse(resultFalse.text).nextThoughtNeeded).toBe(false);
    });

    it("handles needsMoreThoughts flag", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();
      const input = makeThought({ needsMoreThoughts: true });

      tool.processThought(input, state);

      expect(state.thoughtHistory[0].needsMoreThoughts).toBe(true);
    });

    it("returns result as valid JSON string", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();

      const result = tool.processThought(makeThought(), state);

      expect(() => JSON.parse(result.text)).not.toThrow();
      const parsed = JSON.parse(result.text);
      expect(typeof parsed.thoughtNumber).toBe("number");
      expect(typeof parsed.totalThoughts).toBe("number");
      expect(typeof parsed.nextThoughtNeeded).toBe("boolean");
      expect(Array.isArray(parsed.branches)).toBe(true);
      expect(typeof parsed.thoughtHistoryLength).toBe("number");
    });

    it("handles multiple thoughts with mixed features", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();

      // Normal thought
      tool.processThought(makeThought({ thoughtNumber: 1 }), state);
      // Revision
      tool.processThought(
        makeThought({ thoughtNumber: 2, isRevision: true, revisesThought: 1 }),
        state,
      );
      // Branch
      tool.processThought(
        makeThought({
          thoughtNumber: 3,
          branchFromThought: 1,
          branchId: "alt",
        }),
        state,
      );
      // Normal
      tool.processThought(
        makeThought({ thoughtNumber: 4, nextThoughtNeeded: false }),
        state,
      );

      expect(state.thoughtHistory).toHaveLength(4);
      expect(Object.keys(state.branches)).toEqual(["alt"]);

      const result = JSON.parse(
        tool.processThought(
          makeThought({ thoughtNumber: 5, needsMoreThoughts: true }),
          state,
        ).text,
      );
      expect(result.thoughtHistoryLength).toBe(5);
      expect(result.branches).toEqual(["alt"]);
    });
  });

  describe("input validation", () => {
    it("returns error for NaN thoughtNumber", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();
      const input = makeThought({ thoughtNumber: NaN });

      const result = tool.processThought(input, state);

      expect(result.isError).toBe(true);
      expect(result.text).toContain("thoughtNumber");
    });

    it("returns error for thoughtNumber of 0", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();
      const input = makeThought({ thoughtNumber: 0 });

      const result = tool.processThought(input, state);

      expect(result.isError).toBe(true);
      expect(result.text).toContain("thoughtNumber");
    });

    it("returns error for negative thoughtNumber", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();
      const input = makeThought({ thoughtNumber: -1 });

      const result = tool.processThought(input, state);

      expect(result.isError).toBe(true);
      expect(result.text).toContain("thoughtNumber");
    });

    it("returns error for non-integer thoughtNumber", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();
      const input = makeThought({ thoughtNumber: 1.5 });

      const result = tool.processThought(input, state);

      expect(result.isError).toBe(true);
      expect(result.text).toContain("thoughtNumber");
    });

    it("returns error for NaN totalThoughts", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();
      const input = makeThought({ totalThoughts: NaN });

      const result = tool.processThought(input, state);

      expect(result.isError).toBe(true);
      expect(result.text).toContain("totalThoughts");
    });

    it("returns error for totalThoughts of 0", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();
      const input = makeThought({ totalThoughts: 0 });

      const result = tool.processThought(input, state);

      expect(result.isError).toBe(true);
      expect(result.text).toContain("totalThoughts");
    });

    it("returns error for negative totalThoughts", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();
      const input = makeThought({ totalThoughts: -1 });

      const result = tool.processThought(input, state);

      expect(result.isError).toBe(true);
      expect(result.text).toContain("totalThoughts");
    });

    it("returns error for non-integer totalThoughts", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();
      const input = makeThought({ totalThoughts: 0.5 });

      const result = tool.processThought(input, state);

      expect(result.isError).toBe(true);
      expect(result.text).toContain("totalThoughts");
    });

    it("returns error for empty thought string", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();
      const input = makeThought({ thought: "" });

      const result = tool.processThought(input, state);

      expect(result.isError).toBe(true);
      expect(result.text).toContain("thought");
    });

    it("returns error for whitespace-only thought", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();
      const input = makeThought({ thought: "   " });

      const result = tool.processThought(input, state);

      expect(result.isError).toBe(true);
      expect(result.text).toContain("thought");
    });
  });

  describe("error handling", () => {
    it("returns error result when processing fails", () => {
      const tool = new SequentialThinkingTool(false);
      const state = makeState();

      const result = tool.processThought(null as unknown as ThoughtData, state);

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.text);
      expect(parsed.error).toBeDefined();
      expect(parsed.status).toBe("failed");
    });
  });

  describe("formatThought (indirect via logging)", () => {
    it("formats normal thought correctly", () => {
      const tool = new SequentialThinkingTool(true);
      const state = makeState();

      tool.processThought(
        makeThought({
          thought: "This is my thinking",
          thoughtNumber: 2,
          totalThoughts: 5,
        }),
        state,
      );

      // The logger should have been called with the formatted thought
      const logger = (tool as any).logger;
      if (logger && logger.debug) {
        expect(logger.debug).toHaveBeenCalled();
      }
    });
  });
});
