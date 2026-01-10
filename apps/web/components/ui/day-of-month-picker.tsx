"use client";

import React, { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface DayOfMonthPickerProps {
  value: number; // 1-31
  onChange: (value: number) => void;
  disabled?: boolean;
}

function getOrdinalSuffix(n: number): string {
  if (n >= 11 && n <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

export function DayOfMonthPicker({
  value,
  onChange,
  disabled = false,
}: DayOfMonthPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemHeight = 40;
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  // Scroll to selected item on mount and value changes
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = (value - 1) * itemHeight;
    }
  }, [value, itemHeight]);

  const handleScroll = () => {
    if (!containerRef.current || disabled) return;
    const index = Math.round(containerRef.current.scrollTop / itemHeight);
    const clampedIndex = Math.max(0, Math.min(30, index));
    const newValue = clampedIndex + 1;
    if (newValue !== value) onChange(newValue);
  };

  const snapToValue = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: (value - 1) * itemHeight,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="relative w-32 h-[120px]">
      <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-background to-transparent pointer-events-none z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
      <div className="absolute top-1/2 left-0 right-0 h-10 -mt-5 bg-primary/10 border-y border-primary/20 pointer-events-none z-10 rounded-md" />

      <div
        ref={containerRef}
        className={cn(
          "h-full overflow-y-scroll scrollbar-hide relative",
          disabled && "opacity-50 pointer-events-none"
        )}
        onScroll={handleScroll}
        onMouseUp={snapToValue}
        onMouseLeave={snapToValue}
        onTouchEnd={snapToValue}
      >
        <div style={{ height: itemHeight }} />
        {days.map((day) => (
          <div
            key={day}
            className={cn(
              "flex items-center justify-center cursor-pointer transition-all duration-200",
              day === value
                ? "text-foreground font-semibold text-xl"
                : "text-muted-foreground text-sm"
            )}
            style={{ height: itemHeight }}
            onClick={() => !disabled && onChange(day)}
          >
            {day}
            <span className="text-xs ml-0.5">{getOrdinalSuffix(day)}</span>
          </div>
        ))}
        <div style={{ height: itemHeight }} />
      </div>
    </div>
  );
}
