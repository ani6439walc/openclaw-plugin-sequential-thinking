# SequentialThinking

[![OpenClaw](https://img.shields.io/badge/Platform-OpenClaw-blue.svg)](https://github.com/openclaw/openclaw)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A native OpenClaw plugin that provides the `sequential_thinking` tool for dynamic and reflective problem-solving — no MCP dependency required.

> **Inspired by** the [MCP SequentialThinking server](https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking) — ported from the MCP protocol to run as a first-class OpenClaw plugin with per-session state isolation and model-targeted prompt injection.

## Concept

This plugin registers a first-class `sequential_thinking` tool directly into the OpenClaw runtime via `api.registerTool`. It ports the original MCP `SequentialThinkingServer` logic to run natively inside the plugin, maintaining full compatibility with the original behavior:

- Thought history tracking
- Branching support
- Revision support
- Dynamic `totalThoughts` adjustment

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     OpenClaw Runtime                        │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Plugin Entry (index.ts)                   │  │
│  │  definePluginEntry({ register: registerSequential... })│  │
│  └──────────────────────┬────────────────────────────────┘  │
│                         │                                   │
│  ┌──────────────────────▼────────────────────────────────┐  │
│  │           Plugin Registration (plugin.ts)              │  │
│  │                                                        │  │
│  │  ┌────────────────┐    ┌──────────────────────────┐   │  │
│  │  │ resolveConfig() │    │ SequentialThinkingTool   │   │  │
│  │  │  (config.ts)    │    │  (tool.ts)               │   │  │
│  │  └────────┬───────┘    │  - formatThought()       │   │  │
│  │           │            │  - processThought()      │   │  │
│  │           ▼            │  - input validation      │   │  │
│  │  ┌──────────────────┐  └──────────┬───────────────┘   │  │
│  │  │ 6 Lifecycle Hooks│◄────────────┘                    │  │
│  │  │ - before_prompt  │                                  │  │
│  │  │ - before_tool    │  ┌──────────────────────────┐   │  │
│  │  │ - after_tool     │  │ SessionStateManager      │   │  │
│  │  │ - message_sending│  │  (state.ts)              │   │  │
│  │  │ - before_agent   │  │ - registerToolCall()     │   │  │
│  │  │ - agent_end      │  │ - getOrCreateState()     │   │  │
│  │  │                  │  │ - purgeSessionState()    │   │  │
│  │  │                  │  │ - getCleanupCallback()   │   │  │
│  │  └──────────────────┘  └──────────┬───────────────┘   │  │
│  │                                   │                    │  │
│  │  ┌────────────────────────────────▼────────────────┐  │  │
│  │  │          SDK Session Extension                   │  │  │
│  │  │  registerSessionExtension({                     │  │  │
│  │  │    namespace: "sequential_thinking_state",      │  │  │
│  │  │    cleanup: manager.getCleanupCallback()        │  │  │
│  │  │  })                                              │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Module Responsibilities

| Module          | Role                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `index.ts`      | Plugin entry point — exports `definePluginEntry` with registration function                    |
| `api.ts`        | Re-exports from `openclaw/plugin-sdk` (OpenClawPluginApi, AnyAgentTool, createSubsystemLogger) |
| `src/config.ts` | Config type definition and `resolveConfig()` — parses raw plugin config with defaults          |
| `src/tool.ts`   | `SequentialThinkingTool` class — core thought processing with input validation & no mutation   |
| `src/state.ts`  | `SessionStateManager` class — encapsulated state lifecycle with SDK cleanup integration        |
| `src/plugin.ts` | Plugin registration — TypeBox schema, 6 lifecycle hooks, tool registration, prompt injection   |

### Lifecycle Hooks

| Hook                  | Purpose                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `before_prompt_build` | Injects `sequential_thinking` preference context for configured models                                     |
| `before_tool_call`    | Captures `sessionKey` → `toolCallId` mapping, initializes per-session `RunState` via `SessionStateManager` |
| `after_tool_call`     | Cleans up `toolCallId` → `sessionKey` mapping via manager                                                  |
| `message_sending`     | Purges session state via `manager.purgeSessionState()`                                                     |
| `before_agent_reply`  | Defensive purge — ensures no stale state carries over                                                      |
| `agent_end`           | Defensive purge — cleanup on session termination                                                           |

Additionally, the SDK's `registerSessionExtension` cleanup callback handles `delete`, `reset`, `disable`, and `restart` lifecycle events automatically.

### Session State Isolation

Unlike the original MCP server which maintains global state, this plugin isolates thought history per OpenClaw session using the `SessionStateManager` class:

- **Encapsulated Maps**: `sessionKeyByToolCallId` and `stateBySessionKey` are managed internally
- **SDK Lifecycle Integration**: Registered via `api.registerSessionExtension()` with cleanup callbacks for `delete`, `reset`, `disable`, and `restart` events
- **Execute Bridge**: In-memory state is required for the `execute` function (tool callbacks have no `ctx` access), but cleanup is SDK-driven

State lifecycle: created on `before_tool_call` → used during `execute` → purged on SDK cleanup or explicit hook calls (`message_sending` / `before_agent_reply` / `agent_end`).

## How It Works

1. **Tool Registration**: On plugin startup, `registerSequentialThinkingPlugin` creates a `SequentialThinkingTool` instance and registers it as an `AgentTool` via `api.registerTool`.
2. **Agent Invocation**: When the agent decides to use `sequential_thinking`, the tool's `execute` method receives the thought parameters, resolves the per-session state, and delegates to `processThought()`.
3. **State Management**: Per-session `RunState` maintains thought history and branch registry, isolated by `sessionKey`.
4. **Result Streaming**: The tool returns a JSON result with `thoughtNumber`, `totalThoughts`, `nextThoughtNeeded`, `branches`, and `thoughtHistoryLength`.

## Configuration

In `openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "sequential-thinking": {
        "enabled": true,
        "config": {
          "thoughtLogging": true,
          "models": [
            "anthropic/claude-sonnet-4",
            "google/gemini-3-flash-preview",
            "openai/gpt-4o"
          ]
        }
      }
    }
  }
}
```

## Tool Schema

### sequential_thinking

Facilitates a detailed, step-by-step thinking process for problem-solving and analysis.

**Inputs:**

- `thought` (string): The current thinking step (must be non-empty)
- `nextThoughtNeeded` (boolean): Whether another thought step is needed
- `thoughtNumber` (integer): Current thought number (must be positive integer)
- `totalThoughts` (integer): Estimated total thoughts needed (must be positive integer)
- `isRevision` (boolean, optional): Whether this revises previous thinking
- `revisesThought` (integer, optional): Which thought is being reconsidered
- `branchFromThought` (integer, optional): Branching point thought number
- `branchId` (string, optional): Branch identifier
- `needsMoreThoughts` (boolean, optional): If more thoughts are needed

**Validation:** Invalid inputs (NaN, zero, negative, non-integer, empty strings) are rejected with `isError: true`.

## Plugin Config

- `thoughtLogging` (boolean, default: `true`): Log formatted thoughts to console
- `models` (string[], default: `[]`): Model IDs that should receive a prompt injection encouraging preference for `sequential_thinking` on complex problems. Empty strings are automatically filtered out.

## Differences from MCP Original

| Feature               | MCP Server                                        | OpenClaw Plugin                                             |
| --------------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| **Protocol**          | MCP (`server.request`)                            | OpenClaw plugin API (`api.registerTool`)                    |
| **State scope**       | Global (single instance)                          | Per-session (isolated by `sessionKey`)                      |
| **Configuration**     | Environment variables (`DISABLE_THOUGHT_LOGGING`) | Plugin config (`thoughtLogging`, `models`)                  |
| **Prompt injection**  | None                                              | `before_prompt_build` hook for targeted models              |
| **Session lifecycle** | N/A                                               | SDK `registerSessionExtension` cleanup + 6 hooks            |
| **Response format**   | `{ content: [...], isError? }`                    | `{ content: [...], details: parsed }`                       |
| **Input validation**  | None                                              | Validates `thoughtNumber`, `totalThoughts`, `thought`       |
| **Type safety**       | N/A                                               | Strict equality, no `as any`, `additionalProperties: false` |

## Development

```bash
pnpm install
pnpm build          # tsc compilation
pnpm typecheck      # tsc --noEmit
pnpm test:unit      # vitest run (76 tests across 4 files)
pnpm test           # typecheck + test:unit
pnpm format         # prettier
```

### Test Coverage

- `src/config.test.ts` — Config resolution, defaults, model filtering, empty string handling
- `src/tool.test.ts` — SequentialThinkingTool: constructor, processThought (history, branches, revisions, validation), formatThought
- `src/state.test.ts` — SessionStateManager: lifecycle methods, session isolation, SDK cleanup callback
- `src/plugin.test.ts` — Plugin registration: hooks (6 lifecycle), tool schema, execute, prompt injection, session state

## License

MIT

---

_🌸　Powered by Ａni & Wan, Jiun Wei © 2026_
