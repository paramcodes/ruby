"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useId } from "react";

import { Button } from "./button";
import styles from "./dialog.module.css";

export type DialogProps = {
  /** Controlled open state. Omit when using `trigger`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Optional element that opens the dialog when clicked. */
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function Dialog({
  children,
  description,
  onOpenChange,
  open,
  title,
  trigger
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? (
        <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      ) : null}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={styles.overlay} />
        <DialogPrimitive.Content
          aria-describedby={description ? descriptionId : undefined}
          aria-labelledby={titleId}
          className={styles.content}
        >
          <div className={styles.header}>
            <DialogPrimitive.Title className={styles.title} id={titleId}>
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description
                className={styles.description}
                id={descriptionId}
              >
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <div className={styles.body}>{children}</div>
          <DialogPrimitive.Close asChild>
            <Button aria-label="Close dialog" size="sm" variant="ghost">
              Close
            </Button>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
