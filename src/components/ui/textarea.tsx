import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "border-line bg-paper-raised text-ink ring-offset-paper placeholder:text-graphite/60 focus-visible:border-evergreen focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-clay aria-[invalid=true]:focus-visible:ring-clay flex min-h-24 w-full resize-y rounded-sm border px-3 py-2 font-sans text-sm leading-relaxed transition-colors",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
