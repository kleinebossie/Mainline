import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm font-sans text-sm font-medium tracking-tight transition-[color,background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "bg-evergreen text-primary-foreground shadow-sm hover:bg-evergreen-bright",
        default:
          "bg-evergreen text-primary-foreground shadow-sm hover:bg-evergreen-bright",
        secondary:
          "bg-paper-raised text-ink border border-line hover:bg-ink/[0.04]",
        outline:
          "border border-line bg-transparent text-ink hover:bg-ink/[0.04] hover:border-ink/40",
        quiet: "text-graphite hover:bg-ink/[0.05] hover:text-ink",
        ghost: "text-graphite hover:bg-ink/[0.05] hover:text-ink",
        danger:
          "bg-clay text-destructive-foreground shadow-sm hover:bg-clay/90",
        destructive:
          "bg-clay text-destructive-foreground shadow-sm hover:bg-clay/90",
      },
      size: {
        default: "min-h-11 sm:min-h-10 px-4 py-2",
        sm: "min-h-10 sm:min-h-9 px-3 text-xs",
        lg: "min-h-12 px-6 text-base",
        icon: "h-11 w-11 sm:h-10 sm:w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
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
