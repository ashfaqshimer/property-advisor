import * as React from "react"
import { cn } from "@/lib/utils"

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, ...props }, ref) => {
    return (
      <select
        className={cn(
          "flex w-full rounded-lg border border-[#d7e0da] dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3.5 py-3 text-sm focus:outline-none focus:border-[#28513f] dark:focus:border-emerald-600 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Select.displayName = "Select"

export { Select }
