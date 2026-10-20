import { describe, expect, it } from "vitest";

import {
  MAX_PAGE_ID_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_WORKSPACE_ID_LENGTH,
  toPageId,
  toWorkspaceId
} from "./types";
import {
  validateCreatePageInput,
  validateMovePageInput,
  validatePageId,
  validateParentId,
  validateTitle
} from "./validation";

describe("toPageId", () => {
  it("accepts a non-empty bounded string and returns the same value", () => {
    expect(toPageId("page-123")).toBe("page-123");
    expect(toPageId("a".repeat(MAX_PAGE_ID_LENGTH))).toBe(
      "a".repeat(MAX_PAGE_ID_LENGTH)
    );
  });

  it("rejects empty, padded, over-long, and non-string values", () => {
    expect(toPageId("")).toBeNull();
    expect(toPageId("   ")).toBeNull();
    expect(toPageId(" page-123 ")).toBeNull();
    expect(toPageId("a".repeat(MAX_PAGE_ID_LENGTH + 1))).toBeNull();
    expect(toPageId(42)).toBeNull();
    expect(toPageId(null)).toBeNull();
  });
});

describe("toWorkspaceId", () => {
  it("accepts a non-empty bounded string and rejects invalid values", () => {
    expect(toWorkspaceId("workspace-123")).toBe("workspace-123");
    expect(toWorkspaceId("a".repeat(MAX_WORKSPACE_ID_LENGTH))).toBe(
      "a".repeat(MAX_WORKSPACE_ID_LENGTH)
    );
    expect(toWorkspaceId("")).toBeNull();
    expect(toWorkspaceId("a".repeat(MAX_WORKSPACE_ID_LENGTH + 1))).toBeNull();
    expect(toWorkspaceId({})).toBeNull();
  });
});

describe("validateTitle", () => {
  it("returns the trimmed title", () => {
    expect(validateTitle("  Meeting notes  ")).toEqual({
      ok: true,
      value: "Meeting notes"
    });
  });

  it("accepts a title at the upper bound after trimming", () => {
    const value = "a".repeat(MAX_TITLE_LENGTH);
    expect(validateTitle(`  ${value}  `)).toEqual({ ok: true, value });
  });

  it("rejects empty, whitespace-only, over-long, and non-string titles", () => {
    expect(validateTitle("")).toEqual({ ok: false, error: "invalid-title" });
    expect(validateTitle("   ")).toEqual({ ok: false, error: "invalid-title" });
    expect(validateTitle("a".repeat(MAX_TITLE_LENGTH + 1))).toEqual({
      ok: false,
      error: "invalid-title"
    });
    expect(validateTitle(undefined)).toEqual({
      ok: false,
      error: "invalid-title"
    });
    expect(validateTitle(7)).toEqual({ ok: false, error: "invalid-title" });
  });
});

describe("validatePageId", () => {
  it("returns a branded page id for valid input", () => {
    const result = validatePageId("page-123");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("page-123");
    }
  });

  it("rejects invalid page ids", () => {
    expect(validatePageId("")).toEqual({
      ok: false,
      error: "invalid-page-id"
    });
    expect(validatePageId("a".repeat(MAX_PAGE_ID_LENGTH + 1))).toEqual({
      ok: false,
      error: "invalid-page-id"
    });
    expect(validatePageId(null)).toEqual({
      ok: false,
      error: "invalid-page-id"
    });
  });
});

describe("validateParentId", () => {
  it("accepts null and valid page ids", () => {
    expect(validateParentId(null)).toEqual({ ok: true, value: null });
    expect(validateParentId("page-123")).toEqual({
      ok: true,
      value: "page-123"
    });
  });

  it("rejects undefined and invalid page ids", () => {
    expect(validateParentId(undefined)).toEqual({
      ok: false,
      error: "invalid-parent-id"
    });
    expect(validateParentId("")).toEqual({
      ok: false,
      error: "invalid-parent-id"
    });
    expect(validateParentId(12)).toEqual({
      ok: false,
      error: "invalid-parent-id"
    });
  });
});

describe("validateCreatePageInput", () => {
  it("trims the title and preserves a null parent", () => {
    expect(
      validateCreatePageInput({ title: "  Notes ", parentId: null })
    ).toEqual({ ok: true, value: { title: "Notes", parentId: null } });
  });

  it("accepts a valid parent id", () => {
    expect(
      validateCreatePageInput({ title: "Child", parentId: "page-parent" })
    ).toEqual({
      ok: true,
      value: { title: "Child", parentId: "page-parent" }
    });
  });

  it("reports the failing field for invalid input", () => {
    expect(validateCreatePageInput({ title: "", parentId: null })).toEqual({
      ok: false,
      error: "invalid-title"
    });
    expect(validateCreatePageInput({ title: "Child", parentId: "" })).toEqual({
      ok: false,
      error: "invalid-parent-id"
    });
    expect(validateCreatePageInput(null)).toEqual({
      ok: false,
      error: "invalid-title"
    });
  });
});

describe("validateMovePageInput", () => {
  it("accepts a valid move", () => {
    expect(
      validateMovePageInput({
        pageId: "page-1",
        parentId: "page-2",
        sortOrder: 3
      })
    ).toEqual({
      ok: true,
      value: { pageId: "page-1", parentId: "page-2", sortOrder: 3 }
    });
  });

  it("accepts a root move with sort order zero", () => {
    expect(
      validateMovePageInput({ pageId: "page-1", parentId: null, sortOrder: 0 })
    ).toEqual({
      ok: true,
      value: { pageId: "page-1", parentId: null, sortOrder: 0 }
    });
  });

  it("rejects invalid identifiers and sort orders", () => {
    expect(
      validateMovePageInput({ pageId: "", parentId: null, sortOrder: 0 })
    ).toEqual({ ok: false, error: "invalid-page-id" });
    expect(
      validateMovePageInput({ pageId: "page-1", parentId: "", sortOrder: 0 })
    ).toEqual({ ok: false, error: "invalid-parent-id" });
    expect(
      validateMovePageInput({ pageId: "page-1", parentId: null, sortOrder: -1 })
    ).toEqual({ ok: false, error: "invalid-sort-order" });
    expect(
      validateMovePageInput({
        pageId: "page-1",
        parentId: null,
        sortOrder: 1.5
      })
    ).toEqual({ ok: false, error: "invalid-sort-order" });
    expect(
      validateMovePageInput({
        pageId: "page-1",
        parentId: null,
        sortOrder: "1"
      })
    ).toEqual({ ok: false, error: "invalid-sort-order" });
  });
});
