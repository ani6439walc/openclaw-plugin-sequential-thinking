import { z } from "zod";

export type SequentialThinkingConfig = {
  thoughtLogging: boolean;
  models?: string[];
};

const ConfigSchema = z
  .object({
    thoughtLogging: z.boolean().catch(true),
    models: z
      .array(z.unknown())
      .transform((models) =>
        models
          .filter((model): model is string => typeof model === "string")
          .map((model) => model.trim())
          .filter((model) => model.length > 0),
      )
      .optional()
      .catch(undefined),
  })
  .catch({
    thoughtLogging: true,
  });

export function resolveConfig(raw: unknown): SequentialThinkingConfig {
  return ConfigSchema.parse(raw);
}
