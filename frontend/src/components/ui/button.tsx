import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/* Bauhaus design: square or pill shapes, hard shadows, uppercase typography, press effect */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold uppercase tracking-wider transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[#121212] focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        /* Primary – Bauhaus Red */
        default:
          "bg-[#D02020] text-white border-2 border-[#121212] shadow-bauhaus hover:bg-[#D02020]/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        /* Secondary – Bauhaus Blue */
        secondary:
          "bg-[#1040C0] text-white border-2 border-[#121212] shadow-bauhaus hover:bg-[#1040C0]/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        /* Yellow – Black text */
        yellow:
          "bg-[#F0C020] text-[#121212] border-2 border-[#121212] shadow-bauhaus hover:bg-[#F0C020]/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        /* Outline – White background */
        outline:
          "bg-white text-[#121212] border-2 border-[#121212] shadow-bauhaus hover:bg-[#E0E0E0] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        /* Ghost – No border/shadow */
        ghost:
          "border-none text-[#121212] shadow-none hover:bg-[#E0E0E0] active:shadow-none",
        destructive:
          "bg-[#D02020] text-white border-2 border-[#121212] shadow-bauhaus hover:bg-[#D02020]/90 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
        link: "text-[#1040C0] underline-offset-4 hover:underline border-0 shadow-none",
      },
      shape: {
        square: "rounded-none",
        pill: "rounded-full",
      },
      size: {
        default: "h-10 px-4 py-2 text-sm has-[>svg]:px-3",
        xs: "h-6 gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3 text-sm has-[>svg]:px-2.5",
        lg: "h-12 px-6 text-base has-[>svg]:px-4",
        icon: "size-10",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      shape: "square",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  shape = "square",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, shape, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
