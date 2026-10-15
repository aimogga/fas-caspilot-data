"use client"
import * as React from "react"
import { HoverCard as HoverCardPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"
// Hand-written minimal face (DS-09): the shadcn registry was unreachable from the build shell. Same data-slot names as the registry output.
function HoverCard({ ...props }: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
  return <HoverCardPrimitive.Root data-slot="hover-card" {...props} />
}
function HoverCardTrigger({ ...props }: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {
  return <HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />
}
function HoverCardContent({ className, align = "center", sideOffset = 4, ...props }: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
  const face = "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden"
  return <HoverCardPrimitive.Portal><HoverCardPrimitive.Content data-slot="hover-card-content" align={align} sideOffset={sideOffset} collisionPadding={8} className={cn(face, className)} {...props} /></HoverCardPrimitive.Portal>
}
export { HoverCard, HoverCardTrigger, HoverCardContent }
