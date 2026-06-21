import { RunState, ThoughtData } from './tool.js';
import { StateManagement, StateOperations } from './state-interface.js';

/**
 * Mapping service for associating tool calls with session keys
 */
class SessionMappingService {
  private sessionKeyByToolCallId: Map<string, string>;

  constructor() {
    this.sessionKeyByToolCallId = new Map();
  }

  registerToolCall(sessionKey: string, toolCallId: string): void {
    this.sessionKeyByToolCallId.set(toolCallId, sessionKey);
  }

  getSessionKey(toolCallId: string): string | undefined {
    return this.sessionKeyByToolCallId.get(toolCallId);
  }

  removeToolCallMapping(toolCallId: string): void {
    this.sessionKeyByToolCallId.delete(toolCallId);
  }

  removeMappingsForSession(sessionKey: string): void {
    const toRemove: string[] = [];
    for (const [toolCallId, sk] of this.sessionKeyByToolCallId) {
      if (sk === sessionKey) {
        toRemove.push(toolCallId);
      }
    }
    for (const toolCallId of toRemove) {
      this.sessionKeyByToolCallId.delete(toolCallId);
    }
  }

  clear(): void {
    this.sessionKeyByToolCallId.clear();
  }

  getAllMappings(): Map<string, string> {
    return new Map(this.sessionKeyByToolCallId);
  }
}

/**
 * Storage service for maintaining state data
 */
class StateStorageService {
  private stateBySessionKey: Map<string, RunState>;

  constructor() {
    this.stateBySessionKey = new Map();
  }

  getOrCreateState(sessionKey: string): RunState {
    if (!this.stateBySessionKey.has(sessionKey)) {
      this.stateBySessionKey.set(sessionKey, {
        thoughtHistory: [],
        branches: {},
      });
    }
    return this.stateBySessionKey.get(sessionKey)!;
  }

  getState(sessionKey: string): RunState | undefined {
    return this.stateBySessionKey.get(sessionKey);
  }

  setState(sessionKey: string, state: RunState): void {
    this.stateBySessionKey.set(sessionKey, state);
  }

  hasState(sessionKey: string): boolean {
    return this.stateBySessionKey.has(sessionKey);
  }

  purgeSessionState(sessionKey: string): void {
    this.stateBySessionKey.delete(sessionKey);
  }

  getAllSessionKeys(): string[] {
    return Array.from(this.stateBySessionKey.keys());
  }

  clear(): void {
    this.stateBySessionKey.clear();
  }

  get stateCount(): number {
    return this.stateBySessionKey.size;
  }
}

/**
 * Lifecycle management service for handling cleanup operations
 */
class LifecycleManager {
  private storageService: StateStorageService;
  private mappingService: SessionMappingService;

  constructor(storageService: StateStorageService, mappingService: SessionMappingService) {
    this.storageService = storageService;
    this.mappingService = mappingService;
  }

  getCleanupCallback(): (action: 'disable' | 'reset' | 'delete' | 'restart') => void {
    return (action: 'disable' | 'reset' | 'delete' | 'restart') => {
      for (const key of this.storageService.getAllSessionKeys()) {
        this.storageService.purgeSessionState(key);
        this.mappingService.removeMappingsForSession(key);
      }
    };
  }
}

/**
 * Composite implementation of StateManagement and StateOperations
 */
export class CompositeStateManagement implements StateManagement, StateOperations {
  private mappingService: SessionMappingService;
  private storageService: StateStorageService;
  private lifecycleManager: LifecycleManager;

  constructor() {
    this.mappingService = new SessionMappingService();
    this.storageService = new StateStorageService();
    this.lifecycleManager = new LifecycleManager(this.storageService, this.mappingService);
  }

  registerToolCall(sessionKey: string, toolCallId: string): void {
    this.mappingService.registerToolCall(sessionKey, toolCallId);
    // Ensure state exists for the session
    this.storageService.getOrCreateState(sessionKey);
  }

  getOrCreateState(sessionKey: string): RunState {
    return this.storageService.getOrCreateState(sessionKey);
  }

  removeToolCallMapping(toolCallId: string): void {
    this.mappingService.removeToolCallMapping(toolCallId);
  }

  getStateByToolCallId(toolCallId: string): RunState | undefined {
    const sessionKey = this.mappingService.getSessionKey(toolCallId);
    if (!sessionKey) return undefined;
    return this.storageService.getState(sessionKey);
  }

  purgeSessionState(sessionKey: string): void {
    // Clean up mappings that point to this session
    this.mappingService.removeMappingsForSession(sessionKey);
    
    this.storageService.purgeSessionState(sessionKey);
  }

  hasState(sessionKey: string): boolean {
    return this.storageService.hasState(sessionKey);
  }

  get stateCount(): number {
    return this.storageService.stateCount;
  }

  getCleanupCallback(): (action: 'disable' | 'reset' | 'delete' | 'restart') => void {
    return this.lifecycleManager.getCleanupCallback();
  }

  reset(): void {
    this.mappingService.clear();
    this.storageService.clear();
  }

  addThought(sessionKey: string, thought: ThoughtData): void {
    const state = this.getOrCreateState(sessionKey);
    
    // Use local copy to avoid mutating input
    const adjustedInput = { ...thought };
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
  }

  getThoughtHistory(sessionKey: string): ThoughtData[] {
    const state = this.getOrCreateState(sessionKey);
    return [...state.thoughtHistory]; // Return a copy to prevent external mutations
  }

  addBranch(sessionKey: string, branchId: string, thoughts: ThoughtData[]): void {
    const state = this.getOrCreateState(sessionKey);
    state.branches[branchId] = [...thoughts];
  }

  getBranchIds(sessionKey: string): string[] {
    const state = this.getOrCreateState(sessionKey);
    return Object.keys(state.branches);
  }
}