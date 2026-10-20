import { describe, expect, it } from "vitest";

import { MAX_SEARCH_QUERY_LENGTH, validateSearchQuery } from "./validation";

describe("validateSearchQuery", () => {
  it("accepts a simple lowercase term", () => {
    expect(validateSearchQuery("alpha")).toEqual({
      ok: true,
      value: "alpha"
    });
  });

  it("trims leading and trailing whitespace", () => {
    expect(validateSearchQuery("  alpha  ")).toEqual({
      ok: true,
      value: "alpha"
    });
  });

  it("collapses internal whitespace runs to single spaces", () => {
    expect(validateSearchQuery("alpha   beta\t\tgamma")).toEqual({
      ok: true,
      value: "alpha beta gamma"
    });
  });

  it("normalizes newlines and tabs", () => {
    expect(validateSearchQuery("alpha\nbeta\tgamma")).toEqual({
      ok: true,
      value: "alpha beta gamma"
    });
  });

  it("rejects empty strings", () => {
    expect(validateSearchQuery("")).toEqual({ ok: false, error: "empty" });
  });

  it("rejects whitespace-only strings", () => {
    expect(validateSearchQuery("   \t\n ")).toEqual({
      ok: false,
      error: "empty"
    });
  });

  it("rejects non-string values as empty", () => {
    expect(validateSearchQuery(null)).toEqual({ ok: false, error: "empty" });
    expect(validateSearchQuery(undefined)).toEqual({
      ok: false,
      error: "empty"
    });
    expect(validateSearchQuery(42)).toEqual({ ok: false, error: "empty" });
    expect(validateSearchQuery(["alpha"])).toEqual({
      ok: false,
      error: "empty"
    });
  });

  it("rejects queries longer than the maximum length", () => {
    const long = "a".repeat(MAX_SEARCH_QUERY_LENGTH + 1);
    expect(validateSearchQuery(long)).toEqual({
      ok: false,
      error: "too-long"
    });
  });

  it("accepts queries exactly at the maximum length", () => {
    const max = "a".repeat(MAX_SEARCH_QUERY_LENGTH);
    expect(validateSearchQuery(max)).toEqual({ ok: true, value: max });
  });

  it("preserves case and punctuation", () => {
    expect(validateSearchQuery("Hello, World!")).toEqual({
      ok: true,
      value: "Hello, World!"
    });
  });
});
