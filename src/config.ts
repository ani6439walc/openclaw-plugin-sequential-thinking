import { z, preprocess } from "openclaw/plugin-sdk/zod";

export type SequentialThinkingConfig = {
  thoughtLogging: boolean;
  models?: string[];
};

const ConfigSchema = preprocess(
  (value) =>
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? value
      : {},
  z.object({
    thoughtLogging: preprocess(
      (value) => (typeof value === "boolean" ? value : true),
      z.boolean(),
    ),
    models: preprocess(
      (value) =>
        Array.isArray(value)
          ? value
              .filter((model): model is string => typeof model === "string")
              .map((model) => model.trim())
              .filter((model) => model.length > 0)
          : undefined,
      z.array(z.string()).optional(),
    ),
  }),
);

export function resolveConfig(raw: unknown): SequentialThinkingConfig {
  return ConfigSchema.parse(raw) as SequentialThinkingConfig;
}
