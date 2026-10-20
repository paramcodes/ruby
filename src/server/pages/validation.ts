import { toPageId, type PageId } from "@/server/ids";

import {
  MAX_SORT_ORDER,
  MAX_TITLE_LENGTH,
  type CreatePageInput,
  type MovePageInput
} from "./types";

export type ValidationError =
  | "invalid-title"
  | "invalid-page-id"
  | "invalid-parent-id"
  | "invalid-sort-order";

export type ValidationResult<T> =
  { ok: true; value: T } | { ok: false; error: ValidationError };

export function validateTitle(value: unknown): ValidationResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: "invalid-title" };
  }

  const title = value.trim();

  if (title.length === 0 || title.length > MAX_TITLE_LENGTH) {
    return { ok: false, error: "invalid-title" };
  }

  return { ok: true, value: title };
}

export function validatePageId(value: unknown): ValidationResult<PageId> {
  const pageId = toPageId(value);

  if (!pageId) {
    return { ok: false, error: "invalid-page-id" };
  }

  return { ok: true, value: pageId };
}

export function validateParentId(
  value: unknown
): ValidationResult<PageId | null> {
  if (value === null) {
    return { ok: true, value: null };
  }

  const parentId = toPageId(value);

  if (!parentId) {
    return { ok: false, error: "invalid-parent-id" };
  }

  return { ok: true, value: parentId };
}

export function validateCreatePageInput(
  value: unknown
): ValidationResult<CreatePageInput> {
  if (!isRecord(value)) {
    return { ok: false, error: "invalid-title" };
  }

  const title = validateTitle(value["title"]);
  if (!title.ok) {
    return title;
  }

  const parentId = validateParentId(value["parentId"]);
  if (!parentId.ok) {
    return parentId;
  }

  const rawId = value["id"];

  if (rawId === undefined) {
    return {
      ok: true,
      value: { title: title.value, parentId: parentId.value }
    };
  }

  const id = validatePageId(rawId);
  if (!id.ok) {
    return id;
  }

  return {
    ok: true,
    value: { id: id.value, title: title.value, parentId: parentId.value }
  };
}

export function validateMovePageInput(
  value: unknown
): ValidationResult<MovePageInput> {
  if (!isRecord(value)) {
    return { ok: false, error: "invalid-page-id" };
  }

  const pageId = validatePageId(value["pageId"]);
  if (!pageId.ok) {
    return pageId;
  }

  const parentId = validateParentId(value["parentId"]);
  if (!parentId.ok) {
    return parentId;
  }

  const sortOrder = value["sortOrder"];
  if (
    typeof sortOrder !== "number" ||
    !Number.isInteger(sortOrder) ||
    sortOrder < 0 ||
    sortOrder > MAX_SORT_ORDER
  ) {
    return { ok: false, error: "invalid-sort-order" };
  }

  return {
    ok: true,
    value: { pageId: pageId.value, parentId: parentId.value, sortOrder }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
