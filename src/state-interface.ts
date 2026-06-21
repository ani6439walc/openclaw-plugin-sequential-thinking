import { RunState, ThoughtData } from './tool.js';

/**
 * Interface for managing session state in the sequential thinking plugin
 */
export interface StateManagement {
  /**
   * Register a tool call with a session key
   */
  registerToolCall(sessionKey: string, toolCallId: string): void;

  /**
   * Get or create state for a session
   */
  getOrCreateState(sessionKey: string): RunState;

  /**
   * Remove tool call mapping
   */
  removeToolCallMapping(toolCallId: string): void;

  /**
   * Get state by tool call ID
   */
  getStateByToolCallId(toolCallId: string): RunState | undefined;

  /**
   * Purge all state for a session
   */
  purgeSessionState(sessionKey: string): void;

  /**
   * Check if state exists for a session
   */
  hasState(sessionKey: string): boolean;

  /**
   * Get the number of active states
   */
  readonly stateCount: number;

  /**
   * Get cleanup callback for session extension
   */
  getCleanupCallback(): (action: 'disable' | 'reset' | 'delete' | 'restart') => void;

  /**
   * Reset all state
   */
  reset(): void;
}

/**
 * Additional interface for state operations
 */
export interface StateOperations {
  /**
   * Update state with a new thought
   */
  addThought(sessionKey: string, thought: ThoughtData): void;

  /**
   * Get current thought history
   */
  getThoughtHistory(sessionKey: string): ThoughtData[];

  /**
   * Add a branch to the state
   */
  addBranch(sessionKey: string, branchId: string, thoughts: ThoughtData[]): void;

  /**
   * Get all branch IDs for a session
   */
  getBranchIds(sessionKey: string): string[];
}