import { SessionStateManager } from "./state.js";
import { Type } from "typebox";
import {
  createSubsystemLogger,
  type OpenClawPluginApi,
  type AnyAgentTool,
} from "../api.js";
import { resolveConfig } from "./config.js";
import {
  SequentialThinkingTool,
  type ThoughtData,
  type RunState,
} from "./tool.js";

const ParametersSchema = Type.Object(
  {
    thought: Type.String({ description: "Your current thinking step" }),
    nextThoughtNeeded: Type.Boolean({
      description: "Whether another thought step is needed",
    }),
    thoughtNumber: Type.Number({
      description: "Current thought number (numeric value, e.g., 1, 2, 3)",
    }),
    totalThoughts: Type.Number({
      description:
        "Estimated total thoughts needed (numeric value, e.g., 5, 10)",
    }),
    isRevision: Type.Optional(
      Type.Boolean({ description: "Whether this revises previous thinking" }),
    ),
    revisesThought: Type.Optional(
      Type.Number({
        description: "Which thought is being reconsidered",
      }),
    ),
    branchFromThought: Type.Optional(
      Type.Number({
        description: "Branching point thought number",
      }),
    ),
    branchId: Type.Optional(Type.String({ description: "Branch identifier" })),
    needsMoreThoughts: Type.Optional(
      Type.Boolean({ description: "If more thoughts are needed" }),
    ),
  },
  { additionalProperties: false },
);

// Session state manager instance (replaces module-level Maps)
const manager = new SessionStateManager();

const TOOL_DESCRIPTION = `A detailed tool for dynamic and reflective problem-solving through thoughts.
This tool helps analyze problems through a flexible thinking process that can adapt and evolve.
Each thought can build on, question, or revise previous insights as understanding deepens.

When to use this tool:
- Breaking down complex problems into steps
- Planning and design with room for revision
- Analysis that might need course correction
- Problems where the full scope might not be clear initially
- Problems that require a multi-step solution
- Tasks that need to maintain context over multiple steps
- Situations where irrelevant information needs to be filtered out

Key features:
- Adjust total_thoughts up or down as you progress
- Question or revise previous thoughts
- Add more thoughts even after reaching what seemed like the end
- Express uncertainty and explore alternative approaches
- Not every thought needs to build linearly - branch or backtrack
- Generates a solution hypothesis
- Verifies the hypothesis based on the Chain of Thought steps
- Repeats the process until satisfied
- Provides a correct answer

Parameters explained:
- thought: Your current thinking step, which can include:
  * Regular analytical steps
  * Revisions of previous thoughts
  * Questions about previous decisions
  * Realizations about needing more analysis
  * Changes in approach
  * Hypothesis generation
  * Hypothesis verification
- nextThoughtNeeded: True if you need more thinking, even if at what seemed like the end
- thoughtNumber: Current number in sequence (can go beyond initial total if needed)
- totalThoughts: Current estimate of thoughts needed (can be adjusted up/down)
- isRevision: A boolean indicating if this thought revises previous thinking
- revisesThought: If is_revision is true, which thought number is being reconsidered
- branchFromThought: If branching, which thought number is the branching point
- branchId: Identifier for the current branch (if any)
- needsMoreThoughts: If reaching end but realizing more thoughts needed

Should:
1. Start with an initial estimate of needed thoughts, but be ready to adjust
2. Feel free to question or revise previous thoughts
3. Don't hesitate to add more thoughts if needed, even at the "end"
4. Express uncertainty when present
5. Mark thoughts that revise previous thinking or branch into new paths
6. Ignore information that is irrelevant to the current step
7. Generate a solution hypothesis when appropriate
8. Verify the hypothesis based on the Chain of Thought steps
9. Repeat the process until satisfied with the solution
10. Provide a single, ideally correct answer as the final output
11. Only set nextThoughtNeeded to false when truly done and a satisfactory answer is reached`;

export function registerSequentialThinkingPlugin(api: OpenClawPluginApi): void {
  const rawConfig = (api.pluginConfig ?? {}) as Record<string, unknown>;
  const config = resolveConfig(rawConfig);

  const logger = createSubsystemLogger("plugins/sequential-thinking");
  logger.debug("registering sequential_thinking tool");

  const toolInstance = new SequentialThinkingTool(config.thoughtLogging);

  // Prompt injection for configured models: encourage preferring sequential-thinking
  const PREFER_SEQUENTIAL_THINKING_CONTEXT = `There is a 'sequential_thinking' tool available.
When facing complex, ambiguous, or multi-step problems, strongly prefer using the 'sequential_thinking' tool to break down reasoning into structured steps.
This includes:
- Architecture or design decisions
- Debugging tricky issues
- Planning migrations or refactors
- Comparing multiple options with tradeoffs
- Any problem where the full scope isn't clear at first glance`;

  api.on("before_prompt_build", async (_event, ctx) => {
    if (config.models && config.models.length > 0 && ctx.modelId) {
      const modelId = ctx.modelId;
      const modelProvider = ctx.modelProviderId || "";
      const fullModelName = modelProvider
        ? `${modelProvider}/${modelId}`
        : modelId;

      const isTargetModel = config.models.some((m) =>
        fullModelName.includes(m),
      );

      if (isTargetModel) {
        logger.debug(
          `injecting appendSystemContext for model ${fullModelName}`,
          {
            subsystem: "plugins/sequential-thinking",
          },
        );
        return {
          appendSystemContext: PREFER_SEQUENTIAL_THINKING_CONTEXT,
        };
      }
    }
    return undefined;
  });

  // Hook: capture sessionKey before tool execution and initialize per-session state
  api.on("before_tool_call", async (_event, ctx) => {
    logger.debug(
      `before_tool_call hook triggered, ctx: ${JSON.stringify(ctx)}`,
    );
    if (
      ctx.toolName === "sequential_thinking" &&
      ctx.toolCallId &&
      ctx.sessionKey
    ) {
      manager.registerToolCall(ctx.toolCallId, ctx.sessionKey);
    }
    return undefined;
  });

  // Hook: clean up toolCallId mapping after execution
  api.on("after_tool_call", async (_event, ctx) => {
    logger.debug(`after_tool_call hook triggered, ctx: ${JSON.stringify(ctx)}`);
    if (ctx.toolName === "sequential_thinking" && ctx.toolCallId) {
      manager.removeToolCallMapping(ctx.toolCallId);
    }
    return undefined;
  });

  // Hook: purge session state when message_sending
  api.on("message_sending", async (_event, ctx) => {
    logger.debug(`message_sending hook triggered, ctx: ${JSON.stringify(ctx)}`);
    if (ctx.sessionKey) manager.purgeSessionState(ctx.sessionKey);
  });

  // Fallback hook: purge on before_agent_reply (defensive)
  api.on("before_agent_reply", async (_event, ctx) => {
    logger.debug(
      `before_agent_reply hook triggered, ctx: ${JSON.stringify(ctx)}`,
    );
    if (ctx.sessionKey) manager.purgeSessionState(ctx.sessionKey);
  });

  // Hook: purge session state when agent_end (defensive)
  api.on("agent_end", async (_event, ctx) => {
    logger.debug(`agent_end hook triggered, ctx: ${JSON.stringify(ctx)}`);
    if (ctx.sessionKey) manager.purgeSessionState(ctx.sessionKey);
  });

  const tool: AnyAgentTool = {
    name: "sequential_thinking",
    label: "Sequential Thinking",
    description: TOOL_DESCRIPTION,
    parameters: ParametersSchema,
    executionMode: "sequential",
    execute: async (toolCallId, params: ThoughtData, _signal, _onUpdate) => {
      let state: RunState = {
        thoughtHistory: [],
        branches: {},
      };

      const existingState = manager.getStateByToolCallId(toolCallId);
      if (existingState) {
        state = existingState;
      }

      // Create local copy to prevent mutation of caller's params object
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
  };

  api.registerTool(tool);

  if (api.registerSessionExtension) {
    api.registerSessionExtension({
      namespace: "sequential_thinking_state",
      description: "Sequential thinking tool state",
      cleanup: (ctx) => manager.getCleanupCallback()(ctx.reason),
    });
  }
}
