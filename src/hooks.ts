import type {
  PluginHookAfterToolCallEvent,
  PluginHookAgentEndEvent,
  PluginHookAgentContext,
  PluginHookBeforeAgentReplyEvent,
  PluginHookBeforePromptBuildEvent,
  PluginHookBeforeToolCallEvent,
  PluginHookMessageContext,
  PluginHookMessageSendingEvent,
  PluginHookToolContext,
} from "openclaw/plugin-sdk/types";
import { logger } from "../api.js";
import { resolveConfig, type SequentialThinkingConfig } from "./config.js";
import { StateManagement } from "./state.js";
import { PREFER_SEQUENTIAL_THINKING_CONTEXT } from "./tool-metadata.js";

type HookConfigContext = {
  pluginConfig?: Record<string, unknown>;
};

type HookHandlerDeps = {
  manager: StateManagement;
  registrationConfig: SequentialThinkingConfig;
  toolName: string;
};

export function createHookHandlers(deps: HookHandlerDeps) {
  const { manager, registrationConfig, toolName } = deps;

  async function onBeforePromptBuild(
    event: PluginHookBeforePromptBuildEvent,
    ctx: PluginHookAgentContext,
  ) {
    return buildPromptInjectionResult(event, ctx, registrationConfig);
  }

  async function onBeforeToolCall(
    event: PluginHookBeforeToolCallEvent,
    ctx: PluginHookToolContext,
  ) {
    if (ctx.sessionKey && event.toolName === toolName && event.toolCallId) {
      manager.registerToolCall(ctx.sessionKey, event.toolCallId);
      logger.debug(
        `before_tool_call registered ${toolName} state for session ${ctx.sessionKey}`,
      );
    }
    return;
  }

  async function onAfterToolCall(
    event: PluginHookAfterToolCallEvent,
    _ctx: PluginHookToolContext,
  ) {
    if (event.toolName === toolName && event.toolCallId) {
      manager.removeToolCallMapping(event.toolCallId);
      logger.debug(
        `after_tool_call removed ${toolName} mapping for ${event.toolCallId}`,
      );
    }
  }

  const onMessageSending = createSessionPurgeHandler<
    PluginHookMessageSendingEvent,
    PluginHookMessageContext
  >(manager, toolName, "message_sending");
  const onBeforeAgentReply = createSessionPurgeHandler<
    PluginHookBeforeAgentReplyEvent,
    PluginHookAgentContext
  >(manager, toolName, "before_agent_reply");
  const onAgentEnd = createSessionPurgeHandler<
    PluginHookAgentEndEvent,
    PluginHookAgentContext
  >(manager, toolName, "agent_end");

  return Object.freeze({
    onBeforePromptBuild,
    onBeforeToolCall,
    onAfterToolCall,
    onMessageSending,
    onBeforeAgentReply,
    onAgentEnd,
  });
}

function buildPromptInjectionResult(
  event: PluginHookBeforePromptBuildEvent,
  ctx: PluginHookAgentContext,
  registrationConfig: SequentialThinkingConfig,
) {
  void event.prompt;
  void event.messages;

  const config = resolveHookConfig(ctx, registrationConfig);
  if (!config.models || config.models.length === 0 || !ctx.modelId) {
    return undefined;
  }

  const fullModelName = ctx.modelProviderId
    ? `${ctx.modelProviderId}/${ctx.modelId}`
    : ctx.modelId;
  const isTargetModel = config.models.some((model) =>
    fullModelName.includes(model),
  );

  if (!isTargetModel) {
    return undefined;
  }

  logger.debug(`injecting appendSystemContext for model ${fullModelName}`);
  return {
    appendSystemContext: PREFER_SEQUENTIAL_THINKING_CONTEXT,
  };
}

function resolveHookConfig(
  ctx: PluginHookAgentContext,
  registrationConfig: SequentialThinkingConfig,
): SequentialThinkingConfig {
  const hookConfig = (ctx as HookConfigContext).pluginConfig;
  return hookConfig ? resolveConfig(hookConfig) : registrationConfig;
}

function purgeSessionState(
  manager: StateManagement,
  sessionKey: string | undefined,
  hookName: string,
  toolName: string,
): void {
  if (!sessionKey) {
    return;
  }
  manager.purgeSessionState(sessionKey);
  logger.debug(`${hookName} purged ${toolName} state for ${sessionKey}`);
}

function createSessionPurgeHandler<
  TEvent,
  TContext extends { sessionKey?: string },
>(manager: StateManagement, toolName: string, hookName: string) {
  return async (_event: TEvent, ctx: TContext): Promise<void> => {
    purgeSessionState(manager, ctx.sessionKey, hookName, toolName);
  };
}
