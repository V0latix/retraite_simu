import * as React from "react"

import { cn } from "@/lib/utils"

/** Pulsing placeholder block. Match its size to the content it stands in for. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" className={cn("animate-pulse bg-muted", className)} {...props} />
}

export { Skeleton }
