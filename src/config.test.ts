import { describe, it, expect } from "vitest";
import { resolveConfig } from "./config.js";

describe("resolveConfig", () => {
  it("returns defaults when raw is empty", () => {
    const result = resolveConfig({});
    expect(result.thoughtLogging).toBe(true);
    expect(result.models).toBeUndefined();
  });

  it("defaults thoughtLogging to true when not provided", () => {
    const result = resolveConfig({ models: ["claude-sonnet-4"] });
    expect(result.thoughtLogging).toBe(true);
    expect(result.models).toEqual(["claude-sonnet-4"]);
  });

  it("sets thoughtLogging to true when explicitly true", () => {
    const result = resolveConfig({ thoughtLogging: true });
    expect(result.thoughtLogging).toBe(true);
  });

  it("sets thoughtLogging to false when explicitly false", () => {
    const result = resolveConfig({ thoughtLogging: false });
    expect(result.thoughtLogging).toBe(false);
  });

  it("sets thoughtLogging to false for falsy values like 0 and empty string", () => {
    expect(resolveConfig({ thoughtLogging: 0 }).thoughtLogging).toBe(false);
    expect(resolveConfig({ thoughtLogging: "" }).thoughtLogging).toBe(false);
  });

  it("defaults thoughtLogging to true for null and undefined", () => {
    expect(resolveConfig({ thoughtLogging: null }).thoughtLogging).toBe(true);
    expect(resolveConfig({ thoughtLogging: undefined }).thoughtLogging).toBe(
      true,
    );
  });

  it("sets thoughtLogging to true for truthy values like 1 and 'yes'", () => {
    expect(resolveConfig({ thoughtLogging: 1 }).thoughtLogging).toBe(true);
    expect(resolveConfig({ thoughtLogging: "yes" }).thoughtLogging).toBe(true);
  });

  it("returns models as undefined when not provided", () => {
    const result = resolveConfig({ thoughtLogging: false });
    expect(result.models).toBeUndefined();
  });

  it("returns models undefined when raw.models is not an array", () => {
    expect(resolveConfig({ models: "string" }).models).toBeUndefined();
    expect(resolveConfig({ models: 123 }).models).toBeUndefined();
    expect(resolveConfig({ models: null }).models).toBeUndefined();
    expect(resolveConfig({ models: {} }).models).toBeUndefined();
  });

  it("filters models to only string entries", () => {
    const result = resolveConfig({
      models: ["claude-sonnet-4", 123, null, "gpt-4o", undefined, "", "opus"],
    });
    expect(result.models).toEqual(["claude-sonnet-4", "gpt-4o", "", "opus"]);
  });

  it("preserves all valid string models", () => {
    const result = resolveConfig({
      models: ["claude-sonnet-4", "anthropic/claude-opus-4", "openai/gpt-4o"],
    });
    expect(result.models).toEqual([
      "claude-sonnet-4",
      "anthropic/claude-opus-4",
      "openai/gpt-4o",
    ]);
  });

  it("handles mixed array with strings and non-strings", () => {
    const result = resolveConfig({
      models: ["valid", { obj: true }, 42, "also-valid", false],
    });
    expect(result.models).toEqual(["valid", "also-valid"]);
  });

  it("handles empty models array", () => {
    const result = resolveConfig({ models: [] });
    expect(result.models).toEqual([]);
  });

  it("handles both config options together", () => {
    const result = resolveConfig({
      thoughtLogging: false,
      models: ["model-a", "model-b"],
    });
    expect(result.thoughtLogging).toBe(false);
    expect(result.models).toEqual(["model-a", "model-b"]);
  });
});
