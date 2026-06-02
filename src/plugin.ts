import { type OpenClawPluginApi, logger } from "../api.js";
import { resolveConfig } from "./config.js";
import { createHookHandlers } from "./hooks.js";
import { TOOL_PARAMETER_SCHEMA } from "./schema.js";
import { SessionStateManager } from "./state.js";
import { TOOL_DESCRIPTION } from "./tool-metadata.js";
import {
  SequentialThinkingTool,
  type ThoughtData,
  type RunState,
} from "./tool.js";

const TOOL_NAME = "sequential_thinking";
const STATE_NAMESPACE = "sequential_thinking_state";

type SessionExtensionRegistration = Parameters<
  OpenClawPluginApi["session"]["state"]["registerSessionExtension"]
>[0];

export function registerSequentialThinkingPlugin(api: OpenClawPluginApi): void {
  const registrationConfig = resolveConfig(api.pluginConfig ?? {});
  const manager = new SessionStateManager();
  const toolInstance = new SequentialThinkingTool(
    registrationConfig.thoughtLogging,
  );

  api.registerTool({
    name: TOOL_NAME,
    label: "Sequential Thinking",
    description: TOOL_DESCRIPTION,
    parameters: TOOL_PARAMETER_SCHEMA,
    executionMode: "sequential",
    execute: async (toolCallId, params: ThoughtData, _signal, _onUpdate) => {
      const existingState = manager.getStateByToolCallId(toolCallId);
      const state: RunState =
        existingState ??
        ({
          thoughtHistory: [],
          branches: {},
        } satisfies RunState);

      const input: ThoughtData = {
        thought: params.thought,
        thoughtNumber: params.thoughtNumber,
        totalThoughts: params.totalThoughts,
        nextThoughtNeeded: params.nextThoughtNeeded,
        isRevision: params.isRevision,
        revisesThought: params.revisesThought,
        branchFromThought: params.branchFromThought,
        branchId: params.branchId,
        needsMoreThoughts: params.needsMoreThoughts,
      };

      const result = toolInstance.processThought(input, state);
      if (result.isError) {
        throw new Error(result.text);
      }

      const details = JSON.parse(result.text);
      return {
        content: [{ type: "text", text: result.text }],
        details,
      };
    },
  });

  api.session.state.registerSessionExtension(createSessionExtension(manager));

  const handlers = createHookHandlers({
    manager,
    registrationConfig,
    toolName: TOOL_NAME,
  });

  api.on("before_prompt_build", handlers.onBeforePromptBuild);
  api.on("before_tool_call", handlers.onBeforeToolCall);
  api.on("after_tool_call", handlers.onAfterToolCall);
  api.on("message_sending", handlers.onMessageSending);
  api.on("before_agent_reply", handlers.onBeforeAgentReply);
  api.on("agent_end", handlers.onAgentEnd);
}

function createSessionExtension(
  manager: SessionStateManager,
): SessionExtensionRegistration {
  return {
    namespace: STATE_NAMESPACE,
    description: "SequentialThinking tool state",
    cleanup: (ctx) => manager.getCleanupCallback()(ctx.reason),
  };
}
