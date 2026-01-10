"use client";

import React, { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface DayOfWeekPickerProps {
  value: number; // 0-6 (Sunday-Saturday)
  onChange: (value: number) => void;
  disabled?: boolean;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

export function DayOfWeekPicker({
  value,
  onChange,
  disabled = false,
}: DayOfWeekPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemHeight = 40;

  // Scroll to selected item on mount and value changes
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = value * itemHeight;
    }
  }, [value, itemHeight]);

  const handleScroll = () => {
    if (!containerRef.current || disabled) return;
    const index = Math.round(containerRef.current.scrollTop / itemHeight);
    const clampedIndex = Math.max(0, Math.min(6, index));
    if (clampedIndex !== value) onChange(clampedIndex);
  };

  const snapToValue = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: value * itemHeight,
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
        {DAYS_OF_WEEK.map((day) => (
          <div
            key={day.value}
            className={cn(
              "flex items-center justify-center cursor-pointer transition-all duration-200",
              day.value === value
                ? "text-foreground font-semibold text-lg"
                : "text-muted-foreground text-sm"
            )}
            style={{ height: itemHeight }}
            onClick={() => !disabled && onChange(day.value)}
          >
            {day.label}
          </div>
        ))}
        <div style={{ height: itemHeight }} />
      </div>
    </div>
  );
}
