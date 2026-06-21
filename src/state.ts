import { RunState } from "./tool.js";
import { StateManagement } from "./state-interface.js";
import { CompositeStateManagement } from "./composite-state-management.js";

// Export the interface for use in other modules
export type { StateManagement };

// Export the concrete implementation for backward compatibility
export { CompositeStateManagement };

// For backward compatibility, we alias the new class as the old name
/**
 * @deprecated Use CompositeStateManagement or StateManagement interface instead
 */
export class SessionStateManager extends CompositeStateManagement {}
