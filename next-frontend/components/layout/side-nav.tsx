"use client"

import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { SideNavItem } from "@/components/layout/side-nav-item"

// Routes outside the Phase 03 scope render disabled (OQ-12).
const primaryItems = [
  { href: "/", label: "Home", disabled: true },
  { href: "/subscriptions", label: "Subscriptions", disabled: true },
]

const youItems = [
  { href: "/studio", label: "Your videos", disabled: true },
  { href: "/liked", label: "Liked videos", disabled: true },
]

function SideNav({ className }: { className?: string }) {
  const pathname = usePathname()

  return (
    <nav
      data-slot="side-nav"
      aria-label="Main navigation"
      className={cn("flex w-60 shrink-0 flex-col gap-4 p-3", className)}
    >
      <ul className="flex flex-col gap-1">
        {primaryItems.map((item) => (
          <li key={item.href}>
            <SideNavItem {...item} active={pathname === item.href} />
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-1">
        <h2 className="px-3 text-label-lg text-foreground">You</h2>
        <ul className="flex flex-col gap-1">
          {youItems.map((item) => (
            <li key={item.href}>
              <SideNavItem {...item} active={pathname === item.href} />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

export { SideNav }
