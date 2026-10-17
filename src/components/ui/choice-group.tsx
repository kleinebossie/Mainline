"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";

import { cn } from "@/lib/utils";

const ChoiceGroup = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn("grid gap-2.5", className)}
      {...props}
      ref={ref}
    />
  );
});
ChoiceGroup.displayName = RadioGroupPrimitive.Root.displayName;

const ChoiceGroupItem = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> & {
    indicatorClassName?: string;
  }
>(({ className, children, indicatorClassName, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "group relative flex cursor-pointer items-start gap-3 rounded-md border border-line bg-paper-raised p-3.5 text-left transition-colors hover:border-ink/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-evergreen data-[state=checked]:bg-paper-raised min-h-11",
        className,
      )}
      {...props}
    >
      <div className="flex h-5 items-center justify-center">
        <div
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-graphite/40 transition-colors group-data-[state=checked]:border-evergreen group-data-[state=checked]:bg-evergreen",
            indicatorClassName,
          )}
        >
          <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
            <div className="h-1.5 w-1.5 rounded-full bg-paper-raised" />
          </RadioGroupPrimitive.Indicator>
        </div>
      </div>
      <div className="flex-1 text-sm font-sans">{children}</div>
    </RadioGroupPrimitive.Item>
  );
});
ChoiceGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { ChoiceGroup, ChoiceGroupItem };
