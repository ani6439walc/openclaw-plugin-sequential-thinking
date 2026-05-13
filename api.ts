export {
  definePluginEntry,
  type OpenClawPluginApi,
} from "openclaw/plugin-sdk/plugin-entry";

import { createSubsystemLogger } from "openclaw/plugin-sdk/runtime-env";
export const logger = createSubsystemLogger("plugins/sequential-thinking");
