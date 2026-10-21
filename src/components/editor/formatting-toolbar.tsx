"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { COLORS_DEFAULT } from "@blocknote/core";
import {
  FormattingToolbarController,
  useBlockNoteEditor,
  useEditorState,
  type FormattingToolbarProps
} from "@blocknote/react";
import { useCallback, useEffect, useRef, useState, type FC } from "react";

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

const colorNames: readonly (keyof typeof COLORS_DEFAULT)[] = [
  "gray",
  "brown",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink"
];

type TextStyle = "bold" | "italic" | "underline" | "strike" | "code";
type Alignment = "left" | "center" | "right";

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

// The formatting metadata for the selection that the toolbar reflects.
type ToolbarState = {
  alignment: Alignment;
  backgroundColor: string;
  blockId: string | null;
  bold: boolean;
  code: boolean;
  italic: boolean;
  link: string;
  strike: boolean;
  textColor: string;
  underline: boolean;
  kind: EditorBlockKind;
};

function readToolbarState(editor: {
  getActiveStyles(): Record<string, unknown>;
  getTextCursorPosition(): { block: unknown };
}): ToolbarState {
  const styles = editor.getActiveStyles();
  let type: string | undefined;
  let level: string | undefined;
  let blockId: string | null = null;
  let alignment: Alignment = "left";

  try {
    const cursor = editor.getTextCursorPosition().block as
      | {
          id?: unknown;
          type?: unknown;
          props?: { level?: unknown; textAlignment?: unknown };
        }
      | undefined;
    if (cursor && typeof cursor.type === "string") {
      type = cursor.type;
      blockId = typeof cursor.id === "string" ? cursor.id : null;
      const levelValue = cursor.props?.level;
      level =
        typeof levelValue === "string" || typeof levelValue === "number"
          ? String(levelValue)
          : undefined;
      const alignmentValue = cursor.props?.textAlignment;
      if (
        alignmentValue === "center" ||
        alignmentValue === "right" ||
        alignmentValue === "left"
      ) {
        alignment = alignmentValue;
      }
    }
  } catch {
    type = undefined;
  }

  return {
    alignment,
    backgroundColor:
      typeof styles.backgroundColor === "string"
        ? styles.backgroundColor
        : "default",
    blockId,
    bold: styles.bold === true,
    code: styles.code === true,
    italic: styles.italic === true,
    link: typeof styles.link === "string" ? styles.link : "",
    strike: styles.strike === true,
    textColor:
      typeof styles.textColor === "string" ? styles.textColor : "default",
    underline: styles.underline === true,
    kind: currentBlockKind(type ? { type } : undefined, level)
  };
}

function ToolbarButton({
  active,
  children,
  label,
  onPress
}: {
  active?: boolean;
  children: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <button
      aria-pressed={active ?? false}
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

function AlignmentIcon({ alignment }: { alignment: Alignment }) {
  const lines =
    alignment === "left"
      ? "M4 6h16M4 12h10M4 18h16"
      : alignment === "center"
        ? "M4 6h16M7 12h10M4 18h16"
        : "M4 6h16M10 12h10M4 18h16";

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
      width="14"
    >
      <path d={lines} />
    </svg>
  );
}

function ColorMenu({
  focusEditor,
  label,
  menuContainer,
  onPick,
  restoreRange,
  selected,
  variant
}: {
  focusEditor: () => void;
  label: string;
  menuContainer: HTMLElement | null;
  onPick: (color: string) => void;
  restoreRange: () => void;
  selected: string;
  variant: "text" | "background";
}) {
  const selectedColor =
    selected === "default"
      ? undefined
      : COLORS_DEFAULT[selected as keyof typeof COLORS_DEFAULT];
  const selectedValue = selectedColor
    ? variant === "text"
      ? selectedColor.text
      : selectedColor.background
    : undefined;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={styles.formattingColor}
          onMouseDown={(event) => event.preventDefault()}
          title={label}
          type="button"
        >
          <span
            aria-hidden="true"
            className={styles.formattingColorMark}
            data-variant={variant}
            style={
              selectedValue
                ? {
                    backgroundColor:
                      variant === "text" ? "transparent" : selectedValue,
                    color: selectedValue
                  }
                : undefined
            }
          >
            {variant === "text" ? "A" : "▨"}
          </span>
          <span aria-hidden="true" className={styles.formattingChevron}>
            ▾
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={menuContainer ?? undefined}>
        <DropdownMenu.Content
          className={styles.formattingSwatches}
          // Radix restores focus to the trigger when the menu closes. The
          // trigger is gone by then (the editor takes the focus back), so the
          // focus would land on the document and the editor would read it as
          // a blur and hide the toolbar.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            focusEditor();
          }}
        >
          {colorNames.map((name) => {
            const color = COLORS_DEFAULT[name] ?? {
              background: "transparent",
              text: "currentColor"
            };
            return (
              <DropdownMenu.Item
                className={styles.formattingSwatch}
                key={name}
                // Radix moves focus to the item under the pointer, and the
                // browser clears the editor's selection when focus leaves
                // it. Putting the range back keeps the colour on the text
                // the user picked.
                onFocus={restoreRange}
                onPointerDown={(event) => event.preventDefault()}
                onSelect={() => onPick(name)}
                title={name}
              >
                <span
                  aria-hidden="true"
                  className={styles.formattingSwatchChip}
                  style={
                    variant === "text"
                      ? { backgroundColor: color.text }
                      : { backgroundColor: color.background }
                  }
                />
                <span className={styles.visuallyHidden}>{name}</span>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// BlockNote drives show/hide and positioning; this component only renders the
// toolbar contents, styled with the same tokens as the rest of the editor.
const FormattingToolbarContents: FC<FormattingToolbarProps> =
  function FormattingToolbarContents() {
    const editor = useBlockNoteEditor();
    const [linkField, setLinkField] = useState<string | null>(null);
    const [menuContainer, setMenuContainer] = useState<HTMLElement | null>(
      null
    );
    const linkInputRef = useRef<HTMLInputElement>(null);
    // The range the toolbar acts on. A menu takes focus, and the browser
    // clears the editor's selection when it does, so the range is captured
    // while the selection is alive and restored before a style is applied.
    const savedRange = useRef<{ from: number; to: number } | null>(null);

    // Menus open inside a container that BlockNote knows about, so moving
    // focus into them still counts as focus inside the editor. Without this
    // the editor reports a focus loss and hides the toolbar mid-menu.
    useEffect(() => {
      if (!menuContainer) {
        return;
      }

      editor.registerPortalElement(menuContainer);
      return () => {
        editor.unregisterPortalElement(menuContainer);
      };
    }, [editor, menuContainer]);

    const state = useEditorState({
      editor,
      selector: ({ editor: active }) => readToolbarState(active)
    });

    // Keep the last live range: the toolbar re-renders on every selection
    // change, which is exactly when the range is worth remembering.
    useEffect(() => {
      const selection = editor.prosemirrorState.selection;

      if (!selection.empty) {
        savedRange.current = { from: selection.from, to: selection.to };
      }
    }, [editor, state]);

    // Puts the remembered range back into the editor so a style applies to
    // the text the user selected, not to whatever is focused now.
    const restoreRange = useCallback(() => {
      const range = savedRange.current;

      if (!range) {
        return;
      }

      editor._tiptapEditor.commands.setTextSelection({
        from: range.from,
        to: range.to
      });
    }, [editor]);

    // Opening the link field focuses the input; the editor keeps its
    // selection, so the link still applies to the original text.
    useEffect(() => {
      if (linkField !== null) {
        restoreRange();
        linkInputRef.current?.focus();
        linkInputRef.current?.select();
      }
    }, [linkField, restoreRange]);

    const styleButton = (style: TextStyle, label: string, glyph: string) => (
      <ToolbarButton
        active={state[style]}
        label={label}
        onPress={() => {
          restoreRange();
          editor.toggleStyles({ [style]: !state[style] });
          editor.focus();
        }}
      >
        <span aria-hidden="true" data-glyph={style}>
          {glyph}
        </span>
      </ToolbarButton>
    );

    const option = blockTypeOptions.find((item) => item.kind === state.kind);

    const applyLink = () => {
      if (linkField === null) {
        return;
      }

      restoreRange();

      const url = linkField.trim();
      if (url === "") {
        editor.deleteLink();
      } else {
        editor.createLink(url);
      }

      setLinkField(null);
      editor.focus();
    };

    return (
      <div className={styles.formattingToolbar}>
        {linkField === null ? (
          <ToolbarButton
            active={state.link !== ""}
            label={state.link ? "Edit link" : "Add link"}
            onPress={() => {
              setLinkField(state.link);
            }}
          >
            <span aria-hidden="true">🔗</span>
          </ToolbarButton>
        ) : (
          <span className={styles.formattingLinkField}>
            <input
              aria-label="Link URL"
              className={styles.formattingLinkInput}
              onChange={(event) => setLinkField(event.target.value)}
              onFocus={restoreRange}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyLink();
                }

                if (event.key === "Escape") {
                  event.preventDefault();
                  setLinkField(null);
                  editor.focus();
                }
              }}
              onMouseDown={(event) => event.stopPropagation()}
              placeholder="https://"
              ref={linkInputRef}
              value={linkField}
            />
            {state.link ? (
              <button
                className={styles.formattingLinkRemove}
                onClick={() => {
                  editor.deleteLink();
                  setLinkField(null);
                  editor.focus();
                }}
                title="Remove link"
                type="button"
              >
                ✕
              </button>
            ) : null}
          </span>
        )}

        {styleButton("bold", "Bold", "B")}
        {styleButton("italic", "Italic", "I")}
        {styleButton("underline", "Underline", "U")}
        {styleButton("strike", "Strikethrough", "S")}
        {styleButton("code", "Inline code", "</>")}

        <ColorMenu
          focusEditor={() => editor.focus()}
          label="Text color"
          menuContainer={menuContainer}
          onPick={(color) => {
            restoreRange();

            if (state.textColor === color) {
              editor.removeStyles({ textColor: "default" });
            } else {
              editor.addStyles({ textColor: color });
            }

            editor.focus();
          }}
          restoreRange={restoreRange}
          selected={state.textColor}
          variant="text"
        />
        <ColorMenu
          focusEditor={() => editor.focus()}
          label="Highlight color"
          menuContainer={menuContainer}
          onPick={(color) => {
            restoreRange();

            if (state.backgroundColor === color) {
              editor.removeStyles({ backgroundColor: "default" });
            } else {
              editor.addStyles({ backgroundColor: color });
            }

            editor.focus();
          }}
          restoreRange={restoreRange}
          selected={state.backgroundColor}
          variant="background"
        />

        <span className={styles.formattingDivider} />

        {(["left", "center", "right"] as const).map((alignment) => (
          <ToolbarButton
            active={state.alignment === alignment}
            key={alignment}
            label={`Align ${alignment}`}
            onPress={() => {
              if (state.blockId) {
                // The default block union types `props` per block, so the
                // shared alignment prop needs a cast at this boundary.
                editor.updateBlock(state.blockId, {
                  props: { textAlignment: alignment }
                } as unknown as Parameters<typeof editor.updateBlock>[1]);
              }
            }}
          >
            <AlignmentIcon alignment={alignment} />
          </ToolbarButton>
        ))}

        <span className={styles.formattingDivider} />

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
          <DropdownMenu.Portal container={menuContainer ?? undefined}>
            <DropdownMenu.Content
              className={styles.suggestionMenu}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                editor.focus();
              }}
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
                  onFocus={restoreRange}
                  onPointerDown={(event) => event.preventDefault()}
                  onSelect={() => {
                    restoreRange();
                    setBlockCommand(editor as EditorCommandHost, item.kind);
                    editor.focus();
                  }}
                >
                  <span className={styles.suggestionText}>{item.label}</span>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* Mount point for the menus above: it lives inside the toolbar, so
            the editor keeps the toolbar on screen while a menu is open. */}
        <span aria-hidden="true" ref={setMenuContainer} />
      </div>
    );
  };

/**
 * Bubble toolbar on text selection: styles, colors, alignment, links, and the
 * block-type dropdown, positioned by BlockNote's floating toolbar.
 */
export function EditorFormattingToolbar() {
  return (
    <FormattingToolbarController
      formattingToolbar={FormattingToolbarContents}
    />
  );
}
