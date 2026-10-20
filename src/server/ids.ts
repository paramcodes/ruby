declare const pageIdBrand: unique symbol;
declare const workspaceIdBrand: unique symbol;

// Branded ids keep a page id and a workspace id from being passed to the wrong
// query at compile time. They are plain strings at runtime. Both brands live
// here so that each domain can own its own records without importing another
// domain's types.
export type PageId = string & { readonly [pageIdBrand]: "PageId" };
export type WorkspaceId = string & {
  readonly [workspaceIdBrand]: "WorkspaceId";
};

export const MAX_PAGE_ID_LENGTH = 128;
export const MAX_WORKSPACE_ID_LENGTH = 128;

export function toPageId(value: unknown): PageId | null {
  if (!isBoundedId(value, MAX_PAGE_ID_LENGTH)) {
    return null;
  }

  return value as PageId;
}

export function toWorkspaceId(value: unknown): WorkspaceId | null {
  if (!isBoundedId(value, MAX_WORKSPACE_ID_LENGTH)) {
    return null;
  }

  return value as WorkspaceId;
}

function isBoundedId(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    value.trim() === value
  );
}
