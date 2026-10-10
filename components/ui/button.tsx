import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all focus-visible:outline-[2px_solid_var(--ring)] focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60",
        outline: "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "border-0 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "border-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 min-w-11 px-4 py-2 has-[>svg]:px-3 lg:h-10",
        sm: "h-11 min-w-11 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5 lg:h-8",
        lg: "h-11 min-w-11 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-11 lg:size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)
function Button({
  className, variant = "default", size = "default", asChild = false, loading = false, children, disabled, ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean; loading?: boolean }) {
  const Comp = asChild ? Slot.Root : "button"
  return (
    <Comp data-slot="button" data-variant={variant} data-size={size} disabled={disabled || loading} aria-busy={loading || undefined} className={cn(buttonVariants({ variant, size, className }), loading && "relative")} {...props}>
      {loading ? <span className="opacity-0">{children}</span> : children}
      {loading ? <span className="absolute inset-0 grid place-items-center"><Loader2 className="animate-spin" aria-hidden /></span> : null}
    </Comp>
  )
}
export { Button, buttonVariants }
