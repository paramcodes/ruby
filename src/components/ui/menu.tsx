"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import styles from "./menu.module.css";

export type MenuProps = {
  trigger: React.ReactNode;
  /** Accessible name for the menu surface. */
  label: string;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
};

export function Menu({ align = "start", children, label, trigger }: MenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          aria-label={label}
          className={styles.content}
          sideOffset={4}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export type MenuItemProps = React.ComponentPropsWithoutRef<
  typeof DropdownMenu.Item
>;

export function MenuItem({ className, ...props }: MenuItemProps) {
  return (
    <DropdownMenu.Item
      className={[styles.item, className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className={styles.separator} />;
}
