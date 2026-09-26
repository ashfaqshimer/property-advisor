import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-lg bg-[#28513f] dark:bg-emerald-700 px-5 py-3 text-sm font-semibold text-white dark:text-zinc-200 transition-colors hover:bg-[#1e4031] dark:hover:bg-emerald-600 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
