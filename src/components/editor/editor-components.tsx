"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { Components } from "@blocknote/react";
import type { ComponentType } from "react";

import styles from "./editor-prototype.module.css";

type PropsOf<Component> =
  Component extends ComponentType<infer Props> ? Props : never;

type ComponentPropsOf<
  Group extends keyof Components,
  Component extends keyof Components[Group]
> = PropsOf<Components[Group][Component]>;

type GenericProps<
  Group extends keyof Components["Generic"],
  Component extends keyof Components["Generic"][Group]
> = PropsOf<Components["Generic"][Group][Component]>;

// A deliberately small component set for the prototype. BlockNote owns the
// editor engine; every visible affordance here is our own markup styled with
// the design tokens, so no UI theme package is imported.
function SideMenuRoot({ children }: ComponentPropsOf<"SideMenu", "Root">) {
  return <div className="bn-side-menu">{children}</div>;
}

function SideMenuButton({
  children,
  className,
  draggable,
  icon,
  label,
  onClick,
  onDragEnd,
  onDragStart
}: ComponentPropsOf<"SideMenu", "Button">) {
  return (
    <button
      aria-label={label}
      className={[styles.sideMenuButton, className].filter(Boolean).join(" ")}
      draggable={draggable}
      onClick={onClick}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
      title={label}
      type="button"
    >
      {icon ?? children}
    </button>
  );
}

function SuggestionMenuRoot({
  children,
  className,
  id
}: ComponentPropsOf<"SuggestionMenu", "Root">) {
  return (
    <div
      aria-label="Slash menu"
      className={[styles.suggestionMenu, className].filter(Boolean).join(" ")}
      id={id}
      role="listbox"
    >
      {children}
    </div>
  );
}

function SuggestionMenuItem({
  className,
  id,
  isSelected,
  item,
  onClick
}: ComponentPropsOf<"SuggestionMenu", "Item">) {
  return (
    <button
      aria-selected={isSelected}
      className={[styles.suggestionItem, isSelected ? styles.selected : ""]
        .filter(Boolean)
        .concat(className)
        .join(" ")}
      id={id}
      onClick={onClick}
      role="option"
      type="button"
    >
      {item.icon ? (
        <span aria-hidden="true" className={styles.suggestionIcon}>
          {item.icon}
        </span>
      ) : null}
      <span className={styles.suggestionText}>
        <span className={styles.suggestionTitle}>{item.title}</span>
        {item.subtext ? (
          <span className={styles.suggestionSubtext}>{item.subtext}</span>
        ) : null}
      </span>
    </button>
  );
}

function SuggestionMenuEmptyItem({
  children,
  className
}: ComponentPropsOf<"SuggestionMenu", "EmptyItem">) {
  return (
    <p
      className={[styles.suggestionEmpty, className].filter(Boolean).join(" ")}
    >
      {children}
    </p>
  );
}

function SuggestionMenuLabel({
  children,
  className
}: ComponentPropsOf<"SuggestionMenu", "Label">) {
  return (
    <p
      className={[styles.suggestionLabel, className].filter(Boolean).join(" ")}
    >
      {children}
    </p>
  );
}

function SuggestionMenuLoader({
  className
}: ComponentPropsOf<"SuggestionMenu", "Loader">) {
  return (
    <p
      className={[styles.suggestionEmpty, className].filter(Boolean).join(" ")}
      role="status"
    >
      Searching…
    </p>
  );
}

function MenuRoot({ children, onOpenChange }: GenericProps<"Menu", "Root">) {
  return (
    <DropdownMenu.Root onOpenChange={onOpenChange}>
      {children}
    </DropdownMenu.Root>
  );
}

function MenuTrigger({ children }: GenericProps<"Menu", "Trigger">) {
  return <DropdownMenu.Trigger asChild>{children}</DropdownMenu.Trigger>;
}

function MenuDropdown({
  children,
  className
}: GenericProps<"Menu", "Dropdown">) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        className={[styles.menuDropdown, className].filter(Boolean).join(" ")}
        sideOffset={6}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

function MenuItem({
  checked,
  children,
  className,
  disabled,
  icon,
  onClick
}: GenericProps<"Menu", "Item">) {
  return (
    <DropdownMenu.Item
      className={[styles.menuItem, className].filter(Boolean).join(" ")}
      disabled={disabled}
      onSelect={() => onClick?.()}
    >
      {icon ? (
        <span aria-hidden="true" className={styles.menuIcon}>
          {icon}
        </span>
      ) : null}
      <span className={styles.menuLabel}>{children}</span>
      {checked ? <span aria-hidden="true">✓</span> : null}
    </DropdownMenu.Item>
  );
}

function MenuLabel({ children, className }: GenericProps<"Menu", "Label">) {
  return (
    <DropdownMenu.Label
      className={[styles.menuLabelText, className].filter(Boolean).join(" ")}
    >
      {children}
    </DropdownMenu.Label>
  );
}

function MenuDivider({ className }: GenericProps<"Menu", "Divider">) {
  return (
    <DropdownMenu.Separator
      className={[styles.menuDivider, className].filter(Boolean).join(" ")}
    />
  );
}

function MenuButton({
  children,
  className,
  icon,
  label,
  onClick,
  onDragEnd,
  onDragStart
}: GenericProps<"Menu", "Button">) {
  return (
    <button
      aria-label={label}
      className={[styles.menuItem, className].filter(Boolean).join(" ")}
      draggable={false}
      onClick={onClick}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
      type="button"
    >
      {icon ? (
        <span aria-hidden="true" className={styles.menuIcon}>
          {icon}
        </span>
      ) : null}
      <span className={styles.menuLabel}>{children ?? label}</span>
    </button>
  );
}

function TableHandleRoot({
  children,
  className,
  draggable,
  label,
  onDragEnd,
  onDragStart,
  style
}: ComponentPropsOf<"TableHandle", "Root">) {
  return (
    <div
      className={[styles.tableHandle, className].filter(Boolean).join(" ")}
      draggable={draggable}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
      style={style}
      title={label}
    >
      {children}
    </div>
  );
}

function TableHandleExtendButton({
  children,
  className,
  onClick,
  onMouseDown
}: ComponentPropsOf<"TableHandle", "ExtendButton">) {
  return (
    <button
      className={[styles.tableHandleExtend, className]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      onMouseDown={onMouseDown}
      type="button"
    >
      {children}
    </button>
  );
}

// BlockNote's `Components` type covers every optional feature. The prototype
// only enables slash menu and side menu, so the unused groups are absent at
// runtime. The cast keeps that reduced surface explicit in one place.
export const prototypeComponents = {
  SideMenu: { Root: SideMenuRoot, Button: SideMenuButton },
  SuggestionMenu: {
    Root: SuggestionMenuRoot,
    EmptyItem: SuggestionMenuEmptyItem,
    Item: SuggestionMenuItem,
    Label: SuggestionMenuLabel,
    Loader: SuggestionMenuLoader
  },
  TableHandle: {
    Root: TableHandleRoot,
    ExtendButton: TableHandleExtendButton
  },
  Generic: {
    Menu: {
      Root: MenuRoot,
      Trigger: MenuTrigger,
      Dropdown: MenuDropdown,
      Item: MenuItem,
      Label: MenuLabel,
      Divider: MenuDivider,
      Button: MenuButton
    }
  }
} as unknown as Components;
