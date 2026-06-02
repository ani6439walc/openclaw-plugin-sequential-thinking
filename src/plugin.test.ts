import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registerSequentialThinkingPlugin } from "./plugin.js";

vi.mock("../api.js", () => ({
  logger: {
    debug: vi.fn(),
  },
}));

type HookHandler = (
  event: Record<string, unknown>,
  ctx: HookContext,
) => unknown;

interface HookContext {
  agentId?: string;
  modelId?: string;
  modelProviderId?: string;
  pluginConfig?: Record<string, unknown>;
  runId?: string;
  sessionKey?: string;
  toolCallId?: string;
  toolName?: string;
}

interface MockApi {
  pluginConfig: Record<string, unknown>;
  on: ReturnType<typeof vi.fn>;
  registerSessionExtension: ReturnType<typeof vi.fn>;
  registerTool: ReturnType<typeof vi.fn>;
  session: {
    state: {
      registerSessionExtension: ReturnType<typeof vi.fn>;
    };
  };
  _hooks: Record<string, HookHandler[]>;
  _emit: (
    hookName: string,
    event?: Record<string, unknown>,
    ctx?: HookContext,
  ) => Promise<unknown[]>;
}

function createMockApi(overrides: Partial<MockApi> = {}): MockApi {
  const hooks: Record<string, HookHandler[]> = {};
  const registerSessionExtension = vi.fn();

  return {
    pluginConfig: overrides.pluginConfig ?? {},
    on: vi.fn((event: string, handler: HookHandler) => {
      if (!hooks[event]) hooks[event] = [];
      hooks[event].push(handler);
    }),
    registerSessionExtension: vi.fn(),
    registerTool: vi.fn(),
    session: {
      state: {
        registerSessionExtension,
      },
    },
    _hooks: hooks,
    _emit: async (
      hookName: string,
      event: Record<string, unknown> = {},
      ctx: HookContext = {},
    ) => {
      const results: unknown[] = [];
      if (hooks[hookName]) {
        for (const handler of hooks[hookName]) {
          results.push(await handler(event, ctx));
        }
      }
      return results;
    },
    ...overrides,
  };
}

describe("registerSequentialThinkingPlugin", () => {
  let mockApi: MockApi;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = createMockApi();
  });

  afterEach(() => {
    cleanupRegisteredSessionState(mockApi);
    vi.restoreAllMocks();
  });

  it("registers SDK hooks on plugin registration", () => {
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

  it("registers session cleanup through the grouped SDK API", () => {
    registerSequentialThinkingPlugin(mockApi as any);

    expect(
      mockApi.session.state.registerSessionExtension,
    ).toHaveBeenCalledTimes(1);
    expect(mockApi.registerSessionExtension).not.toHaveBeenCalled();

    const extension =
      mockApi.session.state.registerSessionExtension.mock.calls[0][0];
    expect(extension.namespace).toBe("sequential_thinking_state");
    expect(extension.cleanup).toEqual(expect.any(Function));
  });

  it("registers the sequential_thinking tool", () => {
    registerSequentialThinkingPlugin(mockApi as any);

    expect(mockApi.registerTool).toHaveBeenCalledTimes(1);
    const tool = mockApi.registerTool.mock.calls[0][0];
    expect(tool.name).toBe("sequential_thinking");
    expect(tool.label).toBe("Sequential Thinking");
    expect(tool.executionMode).toBe("sequential");
  });

  it("tool has schema properties aligned with runtime validation", () => {
    registerSequentialThinkingPlugin(mockApi as any);

    const tool = mockApi.registerTool.mock.calls[0][0];
    expect(tool.description).toContain(
      "dynamic and reflective problem-solving",
    );
    expect(tool.parameters.additionalProperties).toBe(false);
    expect(tool.parameters.properties.thoughtNumber.type).toBe("integer");
    expect(tool.parameters.properties.thoughtNumber.minimum).toBe(1);
    expect(tool.parameters.properties.totalThoughts.type).toBe("integer");
    expect(tool.parameters.properties.totalThoughts.minimum).toBe(1);
    expect(tool.parameters.properties.revisesThought.type).toBe("integer");
    expect(tool.parameters.properties.branchFromThought.type).toBe("integer");
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

  it("isolates state by SDK session and removes only tool-call mapping after execution", async () => {
    registerSequentialThinkingPlugin(mockApi as any);

    const tool = mockApi.registerTool.mock.calls[0][0];
    await emitToolLifecycleStart(mockApi, "call-1", "session-a");
    await tool.execute("call-1", makeThought(1), abortSignal(), vi.fn());
    await mockApi._emit(
      "after_tool_call",
      {
        toolName: "sequential_thinking",
        params: makeThought(1),
        toolCallId: "call-1",
      },
      {
        toolName: "sequential_thinking",
        toolCallId: "call-1",
        sessionKey: "session-a",
      },
    );

    await emitToolLifecycleStart(mockApi, "call-2", "session-a");
    const secondResult = await tool.execute(
      "call-2",
      makeThought(2),
      abortSignal(),
      vi.fn(),
    );
    expect(JSON.parse(secondResult.content[0].text).thoughtHistoryLength).toBe(
      2,
    );

    await emitToolLifecycleStart(mockApi, "call-3", "session-b");
    const otherSessionResult = await tool.execute(
      "call-3",
      makeThought(1),
      abortSignal(),
      vi.fn(),
    );
    expect(
      JSON.parse(otherSessionResult.content[0].text).thoughtHistoryLength,
    ).toBe(1);
  });

  it("preserves session state if plugin registration is recreated mid-run", async () => {
    registerSequentialThinkingPlugin(mockApi as any);

    const tool = mockApi.registerTool.mock.calls[0][0];
    await emitToolLifecycleStart(
      mockApi,
      "call-reregister-1",
      "session-reregister",
    );
    await tool.execute(
      "call-reregister-1",
      makeThought(1),
      abortSignal(),
      vi.fn(),
    );
    await mockApi._emit(
      "after_tool_call",
      {
        toolName: "sequential_thinking",
        params: makeThought(1),
        toolCallId: "call-reregister-1",
      },
      {
        toolName: "sequential_thinking",
        toolCallId: "call-reregister-1",
        sessionKey: "session-reregister",
      },
    );

    const reloadedApi = createMockApi();
    registerSequentialThinkingPlugin(reloadedApi as any);

    const reloadedTool = reloadedApi.registerTool.mock.calls[0][0];
    await emitToolLifecycleStart(
      reloadedApi,
      "call-reregister-2",
      "session-reregister",
    );
    const secondResult = await reloadedTool.execute(
      "call-reregister-2",
      makeThought(2),
      abortSignal(),
      vi.fn(),
    );

    expect(JSON.parse(secondResult.content[0].text).thoughtHistoryLength).toBe(
      2,
    );

    await reloadedApi._emit(
      "message_sending",
      eventForHook("message_sending"),
      {
        sessionKey: "session-reregister",
      },
    );
  });

  it("falls back to per-call state when no session mapping exists", async () => {
    registerSequentialThinkingPlugin(mockApi as any);

    const tool = mockApi.registerTool.mock.calls[0][0];
    await tool.execute("call-1", makeThought(1), abortSignal(), vi.fn());
    await tool.execute("call-2", makeThought(2), abortSignal(), vi.fn());

    const result = await tool.execute(
      "call-3",
      makeThought(3),
      abortSignal(),
      vi.fn(),
    );
    expect(JSON.parse(result.content[0].text).thoughtHistoryLength).toBe(1);
  });

  it("before_prompt_build injects context for configured models from hook context", async () => {
    registerSequentialThinkingPlugin(mockApi as any);

    const results = await mockApi._emit(
      "before_prompt_build",
      { prompt: "plan this", messages: [] },
      {
        modelId: "claude-sonnet-4",
        modelProviderId: "anthropic",
        pluginConfig: { models: ["claude-sonnet-4"] },
      },
    );

    expect(results.some((r: any) => r?.appendSystemContext)).toBe(true);
  });

  it("before_prompt_build falls back to registration config", async () => {
    mockApi = createMockApi({
      pluginConfig: { models: ["claude-sonnet-4"] },
    });
    registerSequentialThinkingPlugin(mockApi as any);

    const results = await mockApi._emit(
      "before_prompt_build",
      { prompt: "plan this", messages: [] },
      { modelId: "claude-sonnet-4", modelProviderId: "anthropic" },
    );

    expect(results.some((r: any) => r?.appendSystemContext)).toBe(true);
  });

  it("before_prompt_build does not inject context for non-configured models", async () => {
    mockApi = createMockApi({
      pluginConfig: { models: ["claude-sonnet-4"] },
    });
    registerSequentialThinkingPlugin(mockApi as any);

    const results = await mockApi._emit(
      "before_prompt_build",
      { prompt: "plan this", messages: [] },
      { modelId: "gpt-4o", modelProviderId: "openai" },
    );

    expect(results.every((r: any) => r === undefined)).toBe(true);
  });

  it("before_tool_call ignores non-sequential_thinking tools", async () => {
    registerSequentialThinkingPlugin(mockApi as any);

    await mockApi._emit(
      "before_tool_call",
      { toolName: "other_tool", params: {}, toolCallId: "call-456" },
      {
        toolName: "other_tool",
        toolCallId: "call-456",
        sessionKey: "session-xyz",
      },
    );
  });

  it("message_sending purges session state", async () => {
    await expectSessionPurgeFromHook(mockApi, "message_sending");
  });

  it("before_agent_reply purges session state", async () => {
    await expectSessionPurgeFromHook(mockApi, "before_agent_reply");
  });

  it("agent_end purges session state", async () => {
    await expectSessionPurgeFromHook(mockApi, "agent_end");
  });

  it("session extension cleanup purges all session state", async () => {
    registerSequentialThinkingPlugin(mockApi as any);
    const tool = mockApi.registerTool.mock.calls[0][0];

    await emitToolLifecycleStart(mockApi, "call-1", "session-a");
    await tool.execute("call-1", makeThought(1), abortSignal(), vi.fn());

    const extension =
      mockApi.session.state.registerSessionExtension.mock.calls[0][0];
    extension.cleanup({ reason: "reset" });

    await emitToolLifecycleStart(mockApi, "call-2", "session-a");
    const result = await tool.execute(
      "call-2",
      makeThought(2),
      abortSignal(),
      vi.fn(),
    );
    expect(JSON.parse(result.content[0].text).thoughtHistoryLength).toBe(1);
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

async function emitToolLifecycleStart(
  api: MockApi,
  toolCallId: string,
  sessionKey: string,
) {
  await api._emit(
    "before_tool_call",
    { toolName: "sequential_thinking", params: makeThought(1), toolCallId },
    { toolName: "sequential_thinking", toolCallId, sessionKey },
  );
}

async function expectSessionPurgeFromHook(api: MockApi, hookName: string) {
  registerSequentialThinkingPlugin(api as any);
  const tool = api.registerTool.mock.calls[0][0];

  await emitToolLifecycleStart(api, "call-1", "session-purge");
  await tool.execute("call-1", makeThought(1), abortSignal(), vi.fn());
  await emitToolLifecycleStart(api, "call-2", "session-purge");
  const beforePurge = await tool.execute(
    "call-2",
    makeThought(2),
    abortSignal(),
    vi.fn(),
  );
  expect(JSON.parse(beforePurge.content[0].text).thoughtHistoryLength).toBe(2);

  await api._emit(hookName, eventForHook(hookName), {
    sessionKey: "session-purge",
    runId: "run-1",
  });

  await emitToolLifecycleStart(api, "call-3", "session-purge");
  const afterPurge = await tool.execute(
    "call-3",
    makeThought(3),
    abortSignal(),
    vi.fn(),
  );
  expect(JSON.parse(afterPurge.content[0].text).thoughtHistoryLength).toBe(1);
}

function eventForHook(hookName: string): Record<string, unknown> {
  if (hookName === "message_sending") {
    return { to: "user", content: "reply" };
  }
  if (hookName === "before_agent_reply") {
    return { cleanedBody: "reply" };
  }
  return { runId: "run-1", messages: [], success: true };
}

function cleanupRegisteredSessionState(api: MockApi | undefined) {
  const extension =
    api?.session.state.registerSessionExtension.mock.calls.at(-1)?.[0];
  extension?.cleanup?.({ reason: "reset" });
}

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
