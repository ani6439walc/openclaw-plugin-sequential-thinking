# Sequential Thinking Plugin Development Guide

A native OpenClaw plugin that provides the `sequential_thinking` tool for dynamic and reflective problem-solving.

## Commands

- `pnpm test` - Run tests
- `pnpm build` - Build project
- `pnpm format` - Format code
- `pnpm typecheck` - Type checking

## Project Structure

```
src/
├── plugin.ts          # Main plugin registration logic
├── hooks.ts           # Plugin hooks processing
├── tool.ts            # Sequential Thinking core logic
├── tool-metadata.ts   # Tool description and prompt content
├── schema.ts          # Tool parameter validation schema
├── state.ts           # Session state management
├── config.ts          # Plugin configuration processing
├── plugin.test.ts     # Plugin integration tests
├── state.test.ts      # State management unit tests
├── tool.test.ts       # Tool logic unit tests
└── config.test.ts     # Configuration processing unit tests
```

## Architecture

### Module Tree

```
index.ts
  └─ plugin.ts → registerSequentialThinkingPlugin()
       ├─ config.ts → resolveConfig()
       ├─ tool.ts → SequentialThinkingTool class
       ├─ schema.ts → TOOL_PARAMETER_SCHEMA
       ├─ state.ts → SessionStateManager class
       ├─ tool-metadata.ts → TOOL_DESCRIPTION & PREFER_SEQUENTIAL_THINKING_CONTEXT
       └─ hooks.ts → createHookHandlers()
            ├─ state.ts (for session management)
            └─ config.ts (for hook-time config resolution)
```

### Module Responsibilities

| Module | Purpose |
|--------|---------|
| `index.ts` | Plugin entry point — exports `definePluginEntry` with registration function |
| `api.ts` | Re-exports from `openclaw/plugin-sdk` (OpenClawPluginApi, createSubsystemLogger) |
| `src/config.ts` | Config type definition and `resolveConfig()` — parses raw plugin config with defaults |
| `src/schema.ts` | TypeBox schema for the public `sequential_thinking` tool input contract |
| `src/tool-metadata.ts` | Tool description and prompt-injection system context for targeted models |
| `src/tool.ts` | `SequentialThinkingTool` class — core thought processing with input validation & no mutation |
| `src/state.ts` | `SessionStateManager` class — encapsulated state lifecycle with SDK cleanup integration |
| `src/hooks.ts` | SDK hook handlers — manages per-session state mapping and lifecycle events |
| `src/plugin.ts` | Plugin orchestration — resolves config, registers tool, session extension, and SDK hooks |

### Plugin Flow

1. **Registration Phase**: `registerSequentialThinkingPlugin()` registers tool and hooks
2. **Tool Execution**: `SequentialThinkingTool` processes thinking steps
3. **State Management**: `SessionStateManager` tracks thought history and branches
4. **Hooks Processing**: `createHookHandlers()` handles session lifecycle events

### Key Classes

- `SequentialThinkingTool`: Core thinking logic, handles `thought`, `branch`, `revision` operations
- `SessionStateManager`: Session state management, supports thought history and branching
- `RunState`: Execution state type containing `thoughtHistory` and `branches`

## Code Style & Patterns

- Using TypeScript generics for type-safe processing
- Adopting Zod for configuration validation
- Using TypeBox to define tool parameter schemas
- Integrating through OpenClaw hooks system into session flows
- State management using Map-based session tracking

## Protected Files

- `openclaw.plugin.json` - OpenClaw plugin configuration
- `package.json` - Project dependencies and scripts
- `tsconfig.json` - TypeScript compilation configuration
- `vitest.config.ts` - Test configuration

## Adding a New Feature

1. Modify the `SequentialThinkingTool` class in `tool.ts` to extend core logic
2. Update the parameter schema in `schema.ts` to support new functionality
3. Update the tool description in `tool-metadata.ts`
4. Write corresponding unit tests in `tool.test.ts`
5. If special state handling is needed, extend the `SessionStateManager` in `state.ts`

## Upgrading OpenClaw Dependency

When upgrading OpenClaw dependencies:

1. Update `openclaw/*` dependency versions in `package.json`
2. Check if type definitions in `api.ts` need adjustments
3. Verify all hook handlers are compatible with the new API
4. Run all tests to ensure functionality remains intact

### Regenerate Documentation

After version upgrades, it's recommended to re-analyze the codebase with CodeGraph and update documentation:

```bash
rm -rf .codegraph
codegraph init .
```

This ensures documentation reflects the latest code state, especially module dependencies and shared utilities.