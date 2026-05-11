import { createSubsystemLogger } from "../api.js";

const logger = createSubsystemLogger("plugins/sequential-thinking");

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
    this.thoughtLogging = thoughtLogging ?? true;
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

    let prefix = "";
    let context = "";

    if (isRevision) {
      prefix = "🔄 Revision";
      context = ` (revising thought ${revisesThought})`;
    } else if (branchFromThought) {
      prefix = "🌿 Branch";
      context = ` (from thought ${branchFromThought}, ID: ${branchId})`;
    } else {
      prefix = "💭 Thought";
      context = "";
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
      // Adjust totalThoughts if thoughtNumber exceeds it
      if (input.thoughtNumber > input.totalThoughts) {
        input.totalThoughts = input.thoughtNumber;
      }

      state.thoughtHistory.push(input);

      if (input.branchFromThought && input.branchId) {
        if (!state.branches[input.branchId]) {
          state.branches[input.branchId] = [];
        }
        state.branches[input.branchId].push(input);
      }

      if (this.thoughtLogging) {
        const formattedThought = this.formatThought(input);
        logger.debug(formattedThought, {
          subsystem: "plugins/sequential-thinking",
        });
      }

      const result = {
        thoughtNumber: input.thoughtNumber,
        totalThoughts: input.totalThoughts,
        nextThoughtNeeded: input.nextThoughtNeeded,
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
