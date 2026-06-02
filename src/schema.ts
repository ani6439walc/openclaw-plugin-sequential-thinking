import { Type } from "typebox";

const positiveInteger = (description: string) =>
  Type.Integer({
    description,
    minimum: 1,
  });

export const TOOL_PARAMETER_SCHEMA = Type.Object(
  {
    thought: Type.String({ description: "Your current thinking step" }),
    nextThoughtNeeded: Type.Boolean({
      description: "Whether another thought step is needed",
    }),
    thoughtNumber: positiveInteger(
      "Current thought number (integer value, e.g., 1, 2, 3)",
    ),
    totalThoughts: positiveInteger(
      "Estimated total thoughts needed (integer value, e.g., 5, 10)",
    ),
    isRevision: Type.Optional(
      Type.Boolean({ description: "Whether this revises previous thinking" }),
    ),
    revisesThought: Type.Optional(
      positiveInteger("Which thought is being reconsidered"),
    ),
    branchFromThought: Type.Optional(
      positiveInteger("Branching point thought number"),
    ),
    branchId: Type.Optional(Type.String({ description: "Branch identifier" })),
    needsMoreThoughts: Type.Optional(
      Type.Boolean({ description: "If more thoughts are needed" }),
    ),
  },
  { additionalProperties: false },
);
