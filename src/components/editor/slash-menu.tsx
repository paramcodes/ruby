"use client";

import { filterSuggestionItems } from "@blocknote/core";
import {
  SuggestionMenuController,
  type DefaultReactSuggestionItem
} from "@blocknote/react";

import {
  insertBlockCommand,
  type EditorBlockKind,
  type EditorCommandHost
} from "./editor-adapter";

type SlashMenuItem = {
  kind: EditorBlockKind;
  title: string;
  subtext: string;
  aliases: readonly string[];
};

// Every block the writing flow supports is reachable from the slash menu.
export const slashMenuItemDefinitions: readonly SlashMenuItem[] = [
  {
    kind: "paragraph",
    title: "Paragraph",
    subtext: "Plain text",
    aliases: ["text", "plain", "body"]
  },
  {
    kind: "heading-1",
    title: "Heading 1",
    subtext: "Page section title",
    aliases: ["h1", "title"]
  },
  {
    kind: "heading-2",
    title: "Heading 2",
    subtext: "Section heading",
    aliases: ["h2", "subtitle"]
  },
  {
    kind: "heading-3",
    title: "Heading 3",
    subtext: "Subsection heading",
    aliases: ["h3"]
  },
  {
    kind: "bullet-list",
    title: "Bullet List",
    subtext: "Unordered list",
    aliases: ["bullet", "unordered", "ul"]
  },
  {
    kind: "numbered-list",
    title: "Numbered List",
    subtext: "Ordered list",
    aliases: ["number", "ordered", "ol"]
  },
  {
    kind: "checklist",
    title: "Checklist",
    subtext: "Task list with checkboxes",
    aliases: ["check", "todo", "task"]
  },
  {
    kind: "quote",
    title: "Quote",
    subtext: "Call out a passage",
    aliases: ["blockquote", "citation"]
  },
  {
    kind: "divider",
    title: "Divider",
    subtext: "Horizontal rule",
    aliases: ["line", "rule", "separator"]
  },
  {
    kind: "code-block",
    title: "Code Block",
    subtext: "Preformatted code",
    aliases: ["code", "pre", "snippet"]
  },
  {
    kind: "table",
    title: "Table",
    subtext: "Rows and columns",
    aliases: ["grid", "table", "rows", "columns"]
  }
];

export function buildSlashMenuItems(
  editor: EditorCommandHost
): DefaultReactSuggestionItem[] {
  return slashMenuItemDefinitions.map((item) => ({
    title: item.title,
    subtext: item.subtext,
    aliases: [...item.aliases],
    group: "Blocks",
    onItemClick: () => {
      insertBlockCommand(editor, item.kind);
    }
  }));
}

export function EditorSlashMenu({ editor }: { editor: EditorCommandHost }) {
  return (
    <SuggestionMenuController
      getItems={async (query) =>
        filterSuggestionItems(buildSlashMenuItems(editor), query)
      }
      triggerCharacter="/"
    />
  );
}
