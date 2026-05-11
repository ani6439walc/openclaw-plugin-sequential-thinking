import { definePluginEntry } from "./api.js";
import { registerSequentialThinkingPlugin } from "./src/plugin.js";

export default definePluginEntry({
  id: "sequential-thinking",
  name: "SequentialThinking",
  description:
    "Native sequential_thinking tool for dynamic and reflective problem-solving.",
  register: registerSequentialThinkingPlugin,
});
