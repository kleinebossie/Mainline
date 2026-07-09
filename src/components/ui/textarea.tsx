import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "border-input bg-paper-raised ring-offset-paper aria-[invalid=true]:border-clay aria-[invalid=true]:focus-visible:ring-clay flex min-h-28 w-full resize-y rounded-md border px-3 py-2 font-serif text-sm leading-relaxed text-ink transition-colors placeholder:text-graphite/60 focus-visible:border-evergreen focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
