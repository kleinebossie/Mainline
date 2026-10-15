import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Controls are named by what they do, in the UI voice (sentence case, no arrows, no
// tracked caps). Blue is the interaction colour, so the primary control is the only thing
// on a screen that wears it (planning/DESIGN.md §Colour law).
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[3px] text-[0.875rem] font-medium tracking-[-0.005em] transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 active:translate-y-px",
  {
    variants: {
      variant: {
        default: "bg-biro text-sheet hover:bg-biro/90",
        outline:
          "border border-ink/25 bg-sheet text-ink hover:border-ink/45 hover:bg-ink/[0.03]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost: "text-graphite hover:bg-ink/[0.05] hover:text-ink",
        destructive: "bg-brick text-sheet hover:bg-brick/90",
        link: "text-biro underline decoration-rule underline-offset-4 hover:decoration-biro",
      },
      size: {
        default: "h-10 min-w-10 px-4 py-2",
        sm: "h-9 min-w-9 px-3 text-[0.8125rem]",
        lg: "h-12 px-6 text-[0.95rem]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
