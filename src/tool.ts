import { logger } from "../api.js";

export interface ThoughtData {
  thought: string;
  thoughtNumber: number;
  totalThoughts: number;
  isRevision?: boolean;
  revisesThought?: number;
  branchFromThought?: number;
  branchId?: string;
  needsMoreThoughts?: boolean;
  nextThoughtNeeded: boolean;
}

export interface RunState {
  thoughtHistory: ThoughtData[];
  branches: Record<string, ThoughtData[]>;
}

export class SequentialThinkingTool {
  private thoughtLogging: boolean;

  constructor(thoughtLogging?: boolean) {
    this.thoughtLogging = thoughtLogging ?? false;
  }

  private formatThought(thoughtData: ThoughtData): string {
    const {
      thoughtNumber,
      totalThoughts,
      thought,
      isRevision,
      revisesThought,
      branchFromThought,
      branchId,
    } = thoughtData;

    let prefix = "💭 Thought";
    let context = "";

    if (isRevision) {
      prefix = "🔄 Revision";
      context = ` (revising thought ${revisesThought})`;
    } else if (branchFromThought) {
      prefix = "🌿 Branch";
      context = ` (from thought ${branchFromThought}, ID: ${branchId})`;
    }

    return `${prefix} ${thoughtNumber}/${totalThoughts}${context}\n${thought}`;
  }

  public processThought(
    input: ThoughtData,
    state: RunState,
  ): {
    text: string;
    isError?: boolean;
  } {
    try {
      // Input validation
      if (
        !Number.isFinite(input.thoughtNumber) ||
        !Number.isInteger(input.thoughtNumber) ||
        input.thoughtNumber <= 0
      ) {
        return {
          text: "Error: thoughtNumber must be a positive integer",
          isError: true,
        };
      }
      if (
        !Number.isFinite(input.totalThoughts) ||
        !Number.isInteger(input.totalThoughts) ||
        input.totalThoughts <= 0
      ) {
        return {
          text: "Error: totalThoughts must be a positive integer",
          isError: true,
        };
      }
      if (typeof input.thought !== "string" || input.thought.trim() === "") {
        return {
          text: "Error: thought must be a non-empty string",
          isError: true,
        };
      }

      // Use local copy to avoid mutating input
      const adjustedInput = { ...input };
      if (adjustedInput.thoughtNumber > adjustedInput.totalThoughts) {
        adjustedInput.totalThoughts = adjustedInput.thoughtNumber;
      }

      state.thoughtHistory.push(adjustedInput);

      if (adjustedInput.branchFromThought && adjustedInput.branchId) {
        if (!state.branches[adjustedInput.branchId]) {
          state.branches[adjustedInput.branchId] = [];
        }
        state.branches[adjustedInput.branchId].push(adjustedInput);
      }

      if (this.thoughtLogging) {
        logger.debug(this.formatThought(adjustedInput));
      }

      const result = {
        thoughtNumber: adjustedInput.thoughtNumber,
        totalThoughts: adjustedInput.totalThoughts,
        nextThoughtNeeded: adjustedInput.nextThoughtNeeded,
        branches: Object.keys(state.branches),
        thoughtHistoryLength: state.thoughtHistory.length,
      };

      return {
        text: JSON.stringify(result, null, 2),
      };
    } catch (error) {
      return {
        text: JSON.stringify(
          {
            error: error instanceof Error ? error.message : String(error),
            status: "failed",
          },
          null,
          2,
        ),
        isError: true,
      };
    }
  }
}
