import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Controls read as commands on an instrument: monospace, lightly tracked, crisp. The
// machine-readout voice (VISION §4: Engine⟷Methodology) extends to the things you press.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-mono text-sm font-medium tracking-tight transition-[color,background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          "bg-evergreen text-primary-foreground shadow-sm hover:bg-evergreen-bright",
        outline:
          "border border-ink/25 bg-transparent text-ink hover:border-ink/50 hover:bg-ink/[0.04]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost: "text-graphite hover:bg-ink/[0.05] hover:text-ink",
        destructive:
          "bg-clay text-destructive-foreground shadow-sm hover:bg-clay/90",
      },
      size: {
        default: "h-10 min-w-10 px-4 py-2",
        sm: "h-9 min-w-9 px-3 text-xs",
        lg: "h-12 rounded-md px-7 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
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
