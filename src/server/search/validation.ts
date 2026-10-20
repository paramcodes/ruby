// User-facing search terms are validated at the boundary: trimmed, normalized
// to single spaces, and rejected when empty or longer than the configured limit.
// A separate `validateSearchQuery` for server actions keeps the same rule set
// usable by direct callers such as the seed script.

export const MAX_SEARCH_QUERY_LENGTH = 200;

export type SearchQueryValidationError = "empty" | "too-long";

export type ValidatedSearchQuery = string;

export function validateSearchQuery(
  value: unknown
):
  | { ok: true; value: ValidatedSearchQuery }
  | { ok: false; error: SearchQueryValidationError } {
  if (typeof value !== "string") {
    return { ok: false, error: "empty" };
  }

  // Collapse internal whitespace runs to single spaces so the query and the
  // tsvector both normalize the same way, and trim leading/trailing spaces.
  const normalized = value.replace(/\s+/gu, " ").trim();

  if (normalized.length === 0) {
    return { ok: false, error: "empty" };
  }

  if (normalized.length > MAX_SEARCH_QUERY_LENGTH) {
    return { ok: false, error: "too-long" };
  }

  return { ok: true, value: normalized };
}
