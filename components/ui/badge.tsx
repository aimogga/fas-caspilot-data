import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva("inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3", {
  variants: { variant: {
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    destructive: "bg-destructive-soft text-destructive",
    info: "bg-info-soft text-info",
    muted: "bg-muted text-muted-foreground",
  } },
  defaultVariants: { variant: "muted" },
})

function Badge({ className, variant = "muted", prefix, children, ...props }: Omit<React.ComponentProps<"span">, "prefix"> & VariantProps<typeof badgeVariants> & { prefix: React.ReactNode }) {
  if (prefix == null || prefix === "") throw new Error("Badge requires an icon or text prefix")
  return <span data-slot="badge" data-variant={variant} className={cn(badgeVariants({ variant }), className)} {...props}>{prefix} {children}</span>
}
export { Badge, badgeVariants }
