import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] font-medium tracking-tight transition-colors focus:outline-none focus:ring-1 focus:ring-blue-600 select-none",
  {
    variants: {
      variant: {
        default:
          "border-slate-200 bg-slate-900 text-white shadow-sm",
        secondary:
          "border-slate-200 bg-slate-100 text-slate-800",
        destructive:
          "border-rose-200 bg-rose-50 text-rose-800",
        outline:
          "border-slate-300 text-slate-700 bg-white",
        muted:
          "border-slate-200 bg-slate-50 text-slate-600",
        blue:
          "border-blue-200 bg-blue-50 text-blue-800",
        cyan:
          "border-cyan-200 bg-cyan-50 text-cyan-800",
        violet:
          "border-purple-200 bg-purple-50 text-purple-800",
        emerald:
          "border-emerald-200 bg-emerald-50 text-emerald-800",
        amber:
          "border-amber-200 bg-amber-800 text-amber-800 bg-amber-50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
