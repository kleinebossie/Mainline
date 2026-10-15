import * as React from "react";

import { cn } from "@/lib/utils";

const Select = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select">
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "border-input bg-sheet text-ink aria-[invalid=true]:border-brick flex h-10 w-full appearance-none rounded-[2px] border bg-[length:1rem] bg-[right_0.5rem_center] bg-no-repeat px-2.5 pr-8 font-mono text-sm transition-colors focus-visible:border-biro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-biro/35 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    style={{
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%235f6a66' stroke-width='1.6'><path d='M6 8l4 4 4-4'/></svg>\")",
    }}
    {...props}
  />
));
Select.displayName = "Select";

export { Select };
