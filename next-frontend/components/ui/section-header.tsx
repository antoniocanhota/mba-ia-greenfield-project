import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const sectionHeaderVariants = cva("flex flex-col", {
  variants: {
    size: {
      md: "gap-1 [&_[data-slot=section-header-title]]:text-h3 [&_[data-slot=section-header-title]]:text-foreground",
      lg: "gap-1.5 [&_[data-slot=section-header-title]]:text-h2 [&_[data-slot=section-header-title]]:text-foreground",
    },
  },
  defaultVariants: {
    size: "md",
  },
})

type SectionHeaderProps = Omit<React.ComponentProps<"div">, "title"> &
  VariantProps<typeof sectionHeaderVariants> & {
    title: React.ReactNode
    description?: React.ReactNode
  }

function SectionHeader({
  className,
  size,
  title,
  description,
  ...props
}: SectionHeaderProps) {
  return (
    <div
      data-slot="section-header"
      className={cn(sectionHeaderVariants({ size }), className)}
      {...props}
    >
      <h2 data-slot="section-header-title">{title}</h2>
      {description ? (
        <p
          data-slot="section-header-description"
          className="text-body-md text-muted-foreground"
        >
          {description}
        </p>
      ) : null}
    </div>
  )
}

export { SectionHeader, sectionHeaderVariants }
