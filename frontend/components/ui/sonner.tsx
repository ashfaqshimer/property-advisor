"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[var(--color-surface)] group-[.toaster]:text-[var(--color-ink)] group-[.toaster]:border group-[.toaster]:border-[var(--color-band)] group-[.toaster]:shadow-lg rounded-xl font-sans",
          description: "group-[.toast]:text-[var(--color-muted)]",
          actionButton:
            "group-[.toast]:bg-[var(--color-brand)] group-[.toast]:text-[var(--color-on-brand)] font-medium",
          cancelButton:
            "group-[.toast]:bg-[var(--color-band)] group-[.toast]:text-[var(--color-ink)] font-medium",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
