import { definePluginEntry, type OpenClawPluginDefinition } from "./api.js";
import { registerSequentialThinkingPlugin } from "./src/plugin.js";

const plugin: OpenClawPluginDefinition = definePluginEntry({
  id: "sequential-thinking",
  name: "SequentialThinking",
  description:
    "Native sequential_thinking tool for dynamic and reflective problem-solving.",
  register: registerSequentialThinkingPlugin,
});

export default plugin;
