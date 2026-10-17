import * as React from "react";

import { cn } from "@/lib/utils";

const Select = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select">
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "border-line bg-paper-raised text-ink ring-offset-paper focus-visible:border-evergreen focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-clay aria-[invalid=true]:focus-visible:ring-clay flex h-11 sm:h-10 w-full rounded-sm border px-3 py-2 font-sans text-sm transition-colors",
      className,
    )}
    {...props}
  />
));
Select.displayName = "Select";

export { Select };
