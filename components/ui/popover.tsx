"use client"
import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"
// Hand-written minimal face (DS-09): the shadcn registry was unreachable from the build shell. Same data-slot names as the registry output.
function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}
function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}
function PopoverContent({ className, align = "center", sideOffset = 4, ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  const face = "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden"
  return <PopoverPrimitive.Portal><PopoverPrimitive.Content data-slot="popover-content" align={align} sideOffset={sideOffset} collisionPadding={8} className={cn(face, className)} {...props} /></PopoverPrimitive.Portal>
}
export { Popover, PopoverTrigger, PopoverContent }
