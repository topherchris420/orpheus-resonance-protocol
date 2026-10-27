import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  /** Accessible name announced for the thumb. */
  label?: string
  /** Human-readable value, e.g. "70 percent". */
  valueText?: (value: number) => string
}

const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>(
  ({ className, label, valueText, ...props }, ref) => {
    const current = (props.value ?? props.defaultValue ?? [props.min ?? 0])[0]
    return (
      <SliderPrimitive.Root
        ref={ref}
        className={cn("relative flex w-full touch-none select-none items-center py-2", className)}
        {...props}
      >
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-[hsl(var(--o-line))]">
          <SliderPrimitive.Range className="absolute h-full bg-[hsl(var(--o-teal))]" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label={label}
          aria-valuetext={valueText ? valueText(current) : undefined}
          className="block h-5 w-5 rounded-full border-2 border-[hsl(var(--o-teal))] bg-[hsl(var(--o-surface-1))] ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--o-teal))] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        />
      </SliderPrimitive.Root>
    )
  },
)
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
