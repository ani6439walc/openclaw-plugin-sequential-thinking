import { describe, it, expect } from "vitest";
import { resolveConfig } from "./config.js";

describe("resolveConfig", () => {
  it("returns defaults when raw is empty", () => {
    const result = resolveConfig({});
    expect(result.thoughtLogging).toBe(false);
    expect(result.models).toBeUndefined();
  });

  it("returns defaults when raw is not an object", () => {
    expect(resolveConfig(undefined)).toEqual({ thoughtLogging: false });
    expect(resolveConfig("invalid")).toEqual({ thoughtLogging: false });
  });

  it("defaults thoughtLogging to false when not provided", () => {
    const result = resolveConfig({ models: ["claude-sonnet-4"] });
    expect(result.thoughtLogging).toBe(false);
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

  it("defaults thoughtLogging to true for non-boolean values", () => {
    expect(resolveConfig({ thoughtLogging: 0 }).thoughtLogging).toBe(true);
    expect(resolveConfig({ thoughtLogging: "" }).thoughtLogging).toBe(true);
    expect(resolveConfig({ thoughtLogging: "yes" }).thoughtLogging).toBe(true);
  });

  it("defaults thoughtLogging to true for null and undefined", () => {
    expect(resolveConfig({ thoughtLogging: null }).thoughtLogging).toBe(true);
    expect(resolveConfig({ thoughtLogging: undefined }).thoughtLogging).toBe(
      true,
    );
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
    expect(result.models).toEqual(["claude-sonnet-4", "gpt-4o", "opus"]);
  });

  it("filters empty and whitespace-only strings from models", () => {
    const result = resolveConfig({
      models: ["gpt-4", "", "   ", "claude"],
    });
    expect(result.models).toEqual(["gpt-4", "claude"]);
  });

  it("trims model identifiers", () => {
    const result = resolveConfig({
      models: [" gpt-4 ", "\tclaude\n"],
    });
    expect(result.models).toEqual(["gpt-4", "claude"]);
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
