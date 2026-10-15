import * as React from "react";

import { cn } from "@/lib/utils";

// Longer text is prose, so it reads in the serif voice with comfortable leading.
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "border-input bg-sheet text-ink placeholder:text-graphite/70 aria-[invalid=true]:border-brick flex min-h-28 w-full resize-y rounded-[2px] border px-2.5 py-2 font-serif text-[0.95rem] leading-relaxed transition-colors focus-visible:border-biro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-biro/35 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
