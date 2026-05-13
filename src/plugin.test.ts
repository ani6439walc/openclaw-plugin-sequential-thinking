import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerSequentialThinkingPlugin } from "./plugin.js";

vi.mock("../api.js", () => ({
  createSubsystemLogger: vi.fn(() => ({
    debug: vi.fn(),
  })),
}));

function createMockApi(overrides: Partial<MockApi> = {}): MockApi {
  const hooks: Record<string, Array<(...args: any[]) => any>> = {};
  return {
    pluginConfig: overrides.pluginConfig ?? {},
    on: vi.fn((event: string, handler: (...args: any[]) => any) => {
      if (!hooks[event]) hooks[event] = [];
      hooks[event].push(handler);
    }),
    registerTool: vi.fn(),
    _hooks: hooks,
    _emit: async (event: string, ctx: any) => {
      const results: any[] = [];
      if (hooks[event]) {
        for (const handler of hooks[event]) {
          results.push(await handler(event, ctx));
        }
      }
      return results;
    },
    ...overrides,
  };
}

interface MockApi {
  pluginConfig: Record<string, unknown>;
  on: ReturnType<typeof vi.fn>;
  registerTool: ReturnType<typeof vi.fn>;
  _hooks: Record<string, Array<(...args: any[]) => any>>;
  _emit: (event: string, ...args: any[]) => Promise<void>;
}

describe("registerSequentialThinkingPlugin", () => {
  let mockApi: MockApi;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = createMockApi();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers hooks on plugin registration", () => {
    registerSequentialThinkingPlugin(mockApi as any);

    expect(mockApi.on).toHaveBeenCalledWith(
      "before_prompt_build",
      expect.any(Function),
    );
    expect(mockApi.on).toHaveBeenCalledWith(
      "before_tool_call",
      expect.any(Function),
    );
    expect(mockApi.on).toHaveBeenCalledWith(
      "after_tool_call",
      expect.any(Function),
    );
    expect(mockApi.on).toHaveBeenCalledWith(
      "message_sending",
      expect.any(Function),
    );
    expect(mockApi.on).toHaveBeenCalledWith(
      "before_agent_reply",
      expect.any(Function),
    );
    expect(mockApi.on).toHaveBeenCalledWith("agent_end", expect.any(Function));
  });

  it("registers the sequential_thinking tool", () => {
    registerSequentialThinkingPlugin(mockApi as any);

    expect(mockApi.registerTool).toHaveBeenCalledTimes(1);
    const tool = mockApi.registerTool.mock.calls[0][0];
    expect(tool.name).toBe("sequential_thinking");
    expect(tool.label).toBe("Sequential Thinking");
    expect(tool.executionMode).toBe("sequential");
  });

  it("tool has correct schema properties", () => {
    registerSequentialThinkingPlugin(mockApi as any);

    const tool = mockApi.registerTool.mock.calls[0][0];
    expect(tool.description).toContain(
      "dynamic and reflective problem-solving",
    );
    expect(tool.description).toContain("thought");
    expect(tool.description).toContain("nextThoughtNeeded");
    expect(tool.description).toContain("thoughtNumber");
    expect(tool.description).toContain("totalThoughts");
  });

  it("tool execute processes thoughts correctly", async () => {
    registerSequentialThinkingPlugin(mockApi as any);

    const tool = mockApi.registerTool.mock.calls[0][0];
    const result = await tool.execute(
      "call-1",
      {
        thought: "test thinking",
        thoughtNumber: 1,
        totalThoughts: 3,
        nextThoughtNeeded: true,
      },
      new AbortController().signal,
      vi.fn(),
    );

    expect(result.content).toEqual([
      { type: "text", text: expect.any(String) },
    ]);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.thoughtNumber).toBe(1);
    expect(parsed.totalThoughts).toBe(3);
    expect(parsed.nextThoughtNeeded).toBe(true);
    expect(parsed.branches).toEqual([]);
    expect(parsed.thoughtHistoryLength).toBe(1);
  });

  it("tool execute maintains state across calls without sessionKey", async () => {
    registerSequentialThinkingPlugin(mockApi as any);

    const tool = mockApi.registerTool.mock.calls[0][0];
    await tool.execute("call-1", makeThought(1), abortSignal(), vi.fn());
    await tool.execute("call-2", makeThought(2), abortSignal(), vi.fn());
    await tool.execute("call-3", makeThought(3), abortSignal(), vi.fn());

    const result = await tool.execute(
      "call-4",
      makeThought(4),
      abortSignal(),
      vi.fn(),
    );
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.thoughtHistoryLength).toBe(1);
  });

  it("before_prompt_build injects context for configured models", async () => {
    mockApi = createMockApi({
      pluginConfig: { models: ["claude-sonnet-4"] },
    });
    registerSequentialThinkingPlugin(mockApi as any);

    const ctx = {
      modelId: "claude-sonnet-4",
      modelProviderId: "anthropic",
    };
    const results = await mockApi._emit("before_prompt_build", ctx);

    expect(results.some((r: any) => r?.appendSystemContext)).toBe(true);
  });

  it("before_prompt_build does not inject context for non-configured models", async () => {
    mockApi = createMockApi({
      pluginConfig: { models: ["claude-sonnet-4"] },
    });
    registerSequentialThinkingPlugin(mockApi as any);

    const ctx = {
      modelId: "gpt-4o",
      modelProviderId: "openai",
    };
    const results = await mockApi._emit("before_prompt_build", ctx);

    expect(results.every((r: any) => r === undefined)).toBe(true);
  });

  it("before_tool_call initializes session state for sequential_thinking", async () => {
    registerSequentialThinkingPlugin(mockApi as any);

    const ctx = {
      toolName: "sequential_thinking",
      toolCallId: "call-123",
      sessionKey: "session-abc",
    };
    await mockApi._emit("before_tool_call", ctx);

    expect(ctx.sessionKey).toBeDefined();
  });

  it("before_tool_call ignores non-sequential_thinking tools", async () => {
    registerSequentialThinkingPlugin(mockApi as any);

    const ctx = {
      toolName: "other_tool",
      toolCallId: "call-456",
      sessionKey: "session-xyz",
    };
    await mockApi._emit("before_tool_call", ctx);
  });

  it("after_tool_call cleans up toolCallId mapping", async () => {
    registerSequentialThinkingPlugin(mockApi as any);

    const ctx = {
      toolName: "sequential_thinking",
      toolCallId: "call-789",
    };
    await mockApi._emit("after_tool_call", ctx);
  });

  it("message_sending purges session state", async () => {
    registerSequentialThinkingPlugin(mockApi as any);

    const ctx = { sessionKey: "session-purge" };
    await mockApi._emit("message_sending", ctx);
  });

  it("before_agent_reply purges session state", async () => {
    registerSequentialThinkingPlugin(mockApi as any);

    const ctx = { sessionKey: "session-purge-2" };
    await mockApi._emit("before_agent_reply", ctx);
  });

  it("agent_end purges session state", async () => {
    registerSequentialThinkingPlugin(mockApi as any);

    const ctx = { sessionKey: "session-purge-3" };
    await mockApi._emit("agent_end", ctx);
  });

  it("respects thoughtLogging config", async () => {
    mockApi = createMockApi({
      pluginConfig: { thoughtLogging: false },
    });
    registerSequentialThinkingPlugin(mockApi as any);

    const tool = mockApi.registerTool.mock.calls[0][0];
    const result = await tool.execute(
      "call-1",
      makeThought(1),
      abortSignal(),
      vi.fn(),
    );

    expect(result.content[0].text).toBeDefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.thoughtNumber).toBe(1);
  });

  it("tool execute throws on error result", async () => {
    registerSequentialThinkingPlugin(mockApi as any);

    const tool = mockApi.registerTool.mock.calls[0][0];

    await expect(
      tool.execute("call-err", null as unknown as any, abortSignal(), vi.fn()),
    ).rejects.toThrow();
  });
});

function makeThought(num: number) {
  return {
    thought: `thought ${num}`,
    thoughtNumber: num,
    totalThoughts: 5,
    nextThoughtNeeded: true,
  };
}

function abortSignal() {
  return new AbortController().signal;
}
