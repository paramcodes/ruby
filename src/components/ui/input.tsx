import { useId } from "react";

import styles from "./input.module.css";

export type InputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "id"
> & {
  label: string;
  description?: string;
  error?: string;
  id?: string;
};

export function Input({
  className,
  description,
  error,
  id,
  label,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;
  const errorId = `${inputId}-error`;
  const describedBy = [
    description ? descriptionId : null,
    error ? errorId : null
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <input
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : undefined}
        className={[styles.input, error ? styles.invalid : null, className]
          .filter(Boolean)
          .join(" ")}
        id={inputId}
        {...props}
      />
      {description ? (
        <p className={styles.description} id={descriptionId}>
          {description}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
