export const TOOL_DESCRIPTION = `A detailed tool for dynamic and reflective problem-solving through thoughts.
This tool helps analyze problems through a flexible thinking process that can adapt and evolve.
Each thought can build on, question, or revise previous insights as understanding deepens.

When to use this tool:
- Breaking down complex problems into steps
- Planning and design with room for revision
- Analysis that might need course correction
- Problems where the full scope might not be clear initially
- Problems that require a multi-step solution
- Tasks that need to maintain context over multiple steps
- Situations where irrelevant information needs to be filtered out

Key features:
- Adjust total_thoughts up or down as you progress
- Question or revise previous thoughts
- Add more thoughts even after reaching what seemed like the end
- Express uncertainty and explore alternative approaches
- Not every thought needs to build linearly - branch or backtrack
- Generates a solution hypothesis
- Verifies the hypothesis based on the Chain of Thought steps
- Repeats the process until satisfied
- Provides a correct answer

Parameters explained:
- thought: Your current thinking step, which can include:
  * Regular analytical steps
  * Revisions of previous thoughts
  * Questions about previous decisions
  * Realizations about needing more analysis
  * Changes in approach
  * Hypothesis generation
  * Hypothesis verification
- nextThoughtNeeded: True if you need more thinking, even if at what seemed like the end
- thoughtNumber: Current number in sequence (can go beyond initial total if needed)
- totalThoughts: Current estimate of thoughts needed (can be adjusted up/down)
- isRevision: A boolean indicating if this thought revises previous thinking
- revisesThought: If is_revision is true, which thought number is being reconsidered
- branchFromThought: If branching, which thought number is the branching point
- branchId: Identifier for the current branch (if any)
- needsMoreThoughts: If reaching end but realizing more thoughts needed

Should:
1. Start with an initial estimate of needed thoughts, but be ready to adjust
2. Feel free to question or revise previous thoughts
3. Don't hesitate to add more thoughts if needed, even at the "end"
4. Express uncertainty when present
5. Mark thoughts that revise previous thinking or branch into new paths
6. Ignore information that is irrelevant to the current step
7. Generate a solution hypothesis when appropriate
8. Verify the hypothesis based on the Chain of Thought steps
9. Repeat the process until satisfied with the solution
10. Provide a single, ideally correct answer as the final output
11. Only set nextThoughtNeeded to false when truly done and a satisfactory answer is reached`;

export const PREFER_SEQUENTIAL_THINKING_CONTEXT = `<tool_usage_hint>
There is a \`sequential_thinking\` tool available for structured reasoning.

**When to use it:**
Use this tool whenever the problem cannot be solved in a single reasoning pass. Specifically:
- Architecture or design decisions
- Debugging tricky or intermittent issues
- Planning migrations, refactors, or multi-step implementations
- Comparing options with non-obvious tradeoffs
- Ambiguous requirements where clarification is needed before acting
- Interpreting error logs with multiple cascading failures
- Security or hardening decisions with conflicting constraints
- Test planning with multiple branches or edge-case scenarios
- Estimating scope, timeline, or resource allocation
- Root cause analysis where the symptom ≠ the actual problem
- Translating vague user requests into actionable technical steps
- Multi-layer dependency issues (e.g., config → code → infra → network)
- When you catch yourself making assumptions that need verification

**When NOT to use it:**
- Simple factual questions or single-step operations
- Tasks where the answer is already known from context
- Trivial clarifying questions

**Why it matters:**
Sequential thinking prevents reasoning collapse on multi-step problems by maintaining explicit context across thought steps, allowing revision and branching mid-analysis.
</tool_usage_hint>`;
