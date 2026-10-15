import * as React from "react";

import { cn } from "@/lib/utils";

// Inputs are where you record your own numbers, so they read in the data voice: mono,
// tabular, hairline field, biro focus.
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "border-input bg-sheet text-ink placeholder:text-graphite/70 aria-[invalid=true]:border-brick flex h-10 w-full rounded-[2px] border px-2.5 font-mono text-sm transition-colors focus-visible:border-biro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-biro/35 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
