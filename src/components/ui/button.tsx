import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold cursor-pointer transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_8px_20px_-10px_oklch(0.31_0.13_256/0.8)] hover:-translate-y-0.5 hover:bg-primary/92 hover:shadow-[0_12px_24px_-12px_oklch(0.31_0.13_256/0.9)]",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:-translate-y-0.5 hover:bg-destructive/90",
        outline:
          "border border-input/90 bg-card/80 shadow-sm hover:-translate-y-0.5 hover:border-primary/20 hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:-translate-y-0.5 hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-7",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

// A slow network response between click and the button actually disabling (most Save buttons
// disable via `mutation.isPending`, but that flips one render tick after the click, not
// synchronously) was letting an impatient second click fire the same create mutation twice —
// duplicate pupils, duplicate payments, etc. This is a same-tick guard against exactly that:
// it blocks a second click within 600ms of the first, independent of whichever `disabled`
// condition (if any) a given call site wires up itself.
const DOUBLE_CLICK_GUARD_MS = 600;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, onClick, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const lastClickRef = React.useRef(0);
    const handleClick = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        if (!onClick) return;
        const now = Date.now();
        if (now - lastClickRef.current < DOUBLE_CLICK_GUARD_MS) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        lastClickRef.current = now;
        onClick(event);
      },
      [onClick],
    );
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onClick={onClick ? handleClick : undefined}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
