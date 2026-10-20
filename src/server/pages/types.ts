import type { PageId, WorkspaceId } from "@/server/ids";

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
  /**
   * Optional explicit id. The seed needs deterministic ids so a repeated run
   * updates the same rows; a normal create lets the command generate one.
   */
  id?: PageId;
  title: string;
  parentId: PageId | null;
};

export type MovePageInput = {
  pageId: PageId;
  parentId: PageId | null;
  sortOrder: number;
};
