"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function PendingSubmitButton({
  children,
  pendingLabel,
  disabled,
  name,
  value,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  children: ReactNode;
  pendingLabel: ReactNode;
}) {
  const status = useFormStatus();
  const submittedValue = name ? status.data?.get(name) : null;
  const isSubmittingThis =
    status.pending &&
    (name == null || value == null || submittedValue === String(value));

  return (
    <button
      {...props}
      type="submit"
      name={name}
      value={value}
      disabled={disabled || status.pending}
      aria-busy={isSubmittingThis}
    >
      {isSubmittingThis ? pendingLabel : children}
    </button>
  );
}
