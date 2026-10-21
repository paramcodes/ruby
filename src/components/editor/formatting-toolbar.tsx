"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  FormattingToolbarController,
  useBlockNoteEditor,
  useEditorState,
  type FormattingToolbarProps
} from "@blocknote/react";
import type { FC } from "react";

import {
  setBlockCommand,
  type EditorBlockKind,
  type EditorCommandHost
} from "./editor-adapter";
import styles from "./editor-prototype.module.css";

const blockTypeOptions: readonly { kind: EditorBlockKind; label: string }[] = [
  { kind: "paragraph", label: "Text" },
  { kind: "heading-1", label: "Heading 1" },
  { kind: "heading-2", label: "Heading 2" },
  { kind: "heading-3", label: "Heading 3" },
  { kind: "quote", label: "Quote" }
];

type TextStyle = "bold" | "italic" | "underline" | "strike";

/** Block types the toolbar can identify, mapped to their slash-menu kind. */
function currentBlockKind(
  block: { type: string } | undefined,
  level: string | undefined
): EditorBlockKind {
  if (block?.type === "heading" && (level === "1" || level === "2")) {
    return level === "1" ? "heading-1" : "heading-2";
  }

  if (block?.type === "heading") {
    return "heading-3";
  }

  if (block?.type === "quote") {
    return "quote";
  }

  return "paragraph";
}

// The formatting metadata for the selection that the toolbar reflects. A null
// result means the selection sits somewhere a text toolbar does not apply.
type ToolbarState = {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  underline: boolean;
  link: boolean;
  kind: EditorBlockKind;
} | null;

function readToolbarState(editor: {
  getActiveStyles(): Record<string, unknown>;
  getTextCursorPosition(): { block: unknown };
}): ToolbarState {
  const styles = editor.getActiveStyles();
  let type: string | undefined;
  let level: string | undefined;

  try {
    const cursor = editor.getTextCursorPosition().block as
      { type?: unknown; props?: { level?: unknown } } | undefined;
    if (cursor && typeof cursor.type === "string") {
      type = cursor.type;
      const levelValue = cursor.props?.level;
      level =
        typeof levelValue === "string" || typeof levelValue === "number"
          ? String(levelValue)
          : undefined;
    }
  } catch {
    type = undefined;
  }

  return {
    bold: styles.bold === true,
    italic: styles.italic === true,
    strike: styles.strike === true,
    underline: styles.underline === true,
    link: typeof styles.link === "string" && styles.link.length > 0,
    kind: currentBlockKind(type ? { type } : undefined, level)
  };
}

function ToolbarButton({
  active,
  children,
  label,
  onPress
}: {
  active: boolean;
  children: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={[
        styles.formattingButton,
        active ? styles.formattingActive : ""
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onPress}
      onMouseDown={(event) => {
        // Keep the editor selection alive: default focus stealing would
        // collapse the range the toolbar operates on.
        event.preventDefault();
      }}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

// BlockNote drives show/hide and positioning; this component only renders the
// toolbar contents, styled with the same tokens as the rest of the editor.
const FormattingToolbarContents: FC<FormattingToolbarProps> =
  function FormattingToolbarContents() {
    const editor = useBlockNoteEditor();

    const state = useEditorState({
      editor,
      selector: ({ editor: active }) => readToolbarState(active)
    });

    if (!state) {
      return null;
    }

    const styleButton = (style: TextStyle, label: string, glyph: string) => (
      <ToolbarButton
        active={state[style]}
        label={label}
        onPress={() => {
          editor.toggleStyles({ [style]: !state[style] });
        }}
      >
        <span aria-hidden="true" data-glyph={style}>
          {glyph}
        </span>
      </ToolbarButton>
    );

    const option = blockTypeOptions.find((item) => item.kind === state.kind);

    return (
      <div className={styles.formattingToolbar}>
        <ToolbarButton
          active={state.link}
          label={state.link ? "Remove link" : "Add link"}
          onPress={() => {
            if (state.link) {
              editor.deleteLink();
              return;
            }

            const url = window.prompt("Link URL");
            if (url) {
              editor.createLink(url);
            }
          }}
        >
          <span aria-hidden="true">🔗</span>
        </ToolbarButton>

        {styleButton("bold", "Bold", "B")}
        {styleButton("italic", "Italic", "I")}
        {styleButton("underline", "Underline", "U")}
        {styleButton("strike", "Strikethrough", "S")}

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className={styles.formattingSelect}
              onMouseDown={(event) => event.preventDefault()}
              title="Change block type"
              type="button"
            >
              {option?.label ?? "Text"}
              <span aria-hidden="true">▾</span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className={styles.suggestionMenu}
              sideOffset={6}
            >
              {blockTypeOptions.map((item) => (
                <DropdownMenu.Item
                  className={[
                    styles.suggestionItem,
                    item.kind === state.kind ? styles.selected : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={item.kind}
                  onSelect={() => {
                    setBlockCommand(editor as EditorCommandHost, item.kind);
                  }}
                >
                  <span className={styles.suggestionText}>{item.label}</span>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    );
  };

/**
 * Bubble toolbar on text selection: bold, italic, underline, strike, link,
 * and the block-type dropdown, positioned by BlockNote's floating toolbar.
 */
export function EditorFormattingToolbar() {
  return (
    <FormattingToolbarController
      formattingToolbar={FormattingToolbarContents}
    />
  );
}
