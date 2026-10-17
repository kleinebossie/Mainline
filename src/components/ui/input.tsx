import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "border-line bg-paper-raised text-ink ring-offset-paper placeholder:text-graphite/60 focus-visible:border-evergreen focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-clay aria-[invalid=true]:focus-visible:ring-clay flex h-11 sm:h-10 w-full rounded-sm border px-3 py-2 font-sans text-sm transition-colors",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
