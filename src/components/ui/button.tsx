import * as Slot from "@radix-ui/react-slot";
import { forwardRef } from "react";

import styles from "./button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Renders the single child element instead of a button. Useful for links
   * that should look like buttons, such as a "Create page" shortcut.
   */
  asChild?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      asChild = false,
      className,
      size = "md",
      type = "button",
      variant = "primary",
      ...props
    },
    ref
  ) {
    const Component = asChild ? Slot.Slot : "button";
    const classes = [styles.button, styles[variant], styles[size], className]
      .filter(Boolean)
      .join(" ");

    return (
      <Component
        className={classes}
        ref={ref}
        {...props}
        {...(asChild ? {} : { type })}
      />
    );
  }
);
