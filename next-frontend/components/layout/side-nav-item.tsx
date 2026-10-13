import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"

type SideNavItemProps = {
  href: string
  label: string
  icon?: React.ReactNode
  active?: boolean
  disabled?: boolean
  className?: string
}

const itemClasses =
  "flex items-center gap-4 rounded-[var(--radius-3)] px-3 py-2 text-label-md outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-6 [&_svg]:shrink-0"

function SideNavItem({
  href,
  label,
  icon,
  active = false,
  disabled = false,
  className,
}: SideNavItemProps) {
  if (disabled) {
    return (
      <span
        data-slot="side-nav-item"
        aria-disabled="true"
        className={cn(
          itemClasses,
          "cursor-not-allowed text-muted-foreground opacity-60",
          className
        )}
      >
        {icon}
        <span>{label}</span>
      </span>
    )
  }

  return (
    <Link
      href={href}
      data-slot="side-nav-item"
      aria-current={active ? "page" : undefined}
      className={cn(
        itemClasses,
        active ? "bg-muted text-foreground" : "text-foreground hover:bg-muted/60",
        className
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  )
}

export { SideNavItem }
export type { SideNavItemProps }
