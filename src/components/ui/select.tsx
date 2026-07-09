import * as React from "react";

import { cn } from "@/lib/utils";

const Select = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select">
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "border-input bg-paper-raised ring-offset-paper aria-[invalid=true]:border-clay aria-[invalid=true]:focus-visible:ring-clay flex h-10 w-full rounded-md border px-3 py-2 font-mono text-sm text-ink transition-colors focus-visible:border-evergreen focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Select.displayName = "Select";

export { Select };
