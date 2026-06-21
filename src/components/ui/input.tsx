import * as React from "react";

import { cn } from "@/lib/utils";

// Inputs are where you record your own data, so they read in the machine voice: monospace,
// a crisp underline-weighted field, an evergreen focus ring.
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "border-input bg-paper-raised ring-offset-paper placeholder:text-graphite/60 focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 font-mono text-sm transition-colors focus-visible:border-evergreen focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
