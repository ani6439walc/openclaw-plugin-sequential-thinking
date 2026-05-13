export type SequentialThinkingConfig = {
  thoughtLogging?: boolean;
  models?: string[];
};

export function resolveConfig(
  raw: Record<string, unknown>,
): SequentialThinkingConfig {
  return {
    thoughtLogging:
      raw.thoughtLogging != null ? Boolean(raw.thoughtLogging) : true,
    models: Array.isArray(raw.models)
      ? raw.models.filter(
          (m): m is string => typeof m === "string" && m.length > 0,
        )
      : undefined,
  };
}
