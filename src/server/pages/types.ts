declare const pageIdBrand: unique symbol;
declare const workspaceIdBrand: unique symbol;

// Branded ids keep a page id and a workspace id from being passed to the wrong
// query at compile time. They are plain strings at runtime.
export type PageId = string & { readonly [pageIdBrand]: "PageId" };
export type WorkspaceId = string & {
  readonly [workspaceIdBrand]: "WorkspaceId";
};

export const MAX_PAGE_ID_LENGTH = 128;
export const MAX_WORKSPACE_ID_LENGTH = 128;
export const MAX_TITLE_LENGTH = 255;
export const MAX_SORT_ORDER = 2_147_483_647;

export type PageSummary = {
  id: PageId;
  parentId: PageId | null;
  title: string;
  sortOrder: number;
  archivedAt: Date | null;
};

export type PageRecord = PageSummary & {
  workspaceId: WorkspaceId;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatePageInput = {
  title: string;
  parentId: PageId | null;
};

export type MovePageInput = {
  pageId: PageId;
  parentId: PageId | null;
  sortOrder: number;
};

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
