export type SequentialThinkingConfig = {
  thoughtLogging?: boolean;
  models?: string[];
};

export function resolveConfig(
  raw: Record<string, unknown>,
): SequentialThinkingConfig {
  return {
    thoughtLogging:
      typeof raw.thoughtLogging === "boolean" ? raw.thoughtLogging : true,
    models: Array.isArray(raw.models)
      ? raw.models
          .filter((m): m is string => typeof m === "string")
          .map((m) => m.trim())
          .filter((m) => m.length > 0)
      : undefined,
  };
}
