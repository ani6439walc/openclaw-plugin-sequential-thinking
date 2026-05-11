# SequentialThinking
[![OpenClaw](https://img.shields.io/badge/Platform-OpenClaw-blue.svg)](https://github.com/openclaw/openclaw)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)


A native OpenClaw plugin that provides the `sequential_thinking` tool for dynamic and reflective problem-solving — no MCP dependency required.

## Concept

This plugin registers a first-class `sequential_thinking` tool directly into the OpenClaw runtime via `api.registerTool`. It ports the original MCP `SequentialThinkingServer` logic to run natively inside the plugin, maintaining full compatibility with the original behavior:

- Thought history tracking
- Branching support
- Revision support
- Dynamic `totalThoughts` adjustment

## How It Works

1. **Tool Registration**: On plugin startup, `registerSequentialThinkingPlugin` creates a `SequentialThinkingTool` instance and registers it as an `AgentTool` via `api.registerTool`.
2. **Agent Invocation**: When the agent decides to use `sequential_thinking`, the tool's `execute` method receives the thought parameters, validates them, and delegates to the server.
3. **State Management**: The server maintains an in-memory thought history and branch registry for the lifetime of the plugin process.
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
            "claude-sonnet-4",
            "anthropic/claude-opus-4",
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

- `thought` (string): The current thinking step
- `nextThoughtNeeded` (boolean): Whether another thought step is needed
- `thoughtNumber` (integer): Current thought number
- `totalThoughts` (integer): Estimated total thoughts needed
- `isRevision` (boolean, optional): Whether this revises previous thinking
- `revisesThought` (integer, optional): Which thought is being reconsidered
- `branchFromThought` (integer, optional): Branching point thought number
- `branchId` (string, optional): Branch identifier
- `needsMoreThoughts` (boolean, optional): If more thoughts are needed

## Plugin Config

- `thoughtLogging` (boolean, default: `true`): Log formatted thoughts to console
- `models` (string[], default: `[]`): Model IDs that should receive a prompt injection encouraging preference for `sequential_thinking` on complex tasks. Supports exact `modelId` or `provider/modelId` patterns.

---

_Powered by SequentialThinking | OpenClaw Plugin_
