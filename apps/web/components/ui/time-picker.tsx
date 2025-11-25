"use client";

import React, { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value: string; // Format: "HH:MM" in 24-hour format
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function TimePicker({
  value,
  onChange,
  disabled = false,
}: TimePickerProps) {
  // Parse 24-hour format to 12-hour components
  const [hours24, minutes] = value.split(":").map(Number);
  const isPM = hours24 >= 12;
  const hour12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;

  // Convert 12-hour components to 24-hour format string
  const formatTime = (h12: number, min: number, pm: boolean) => {
    const h24 = pm ? (h12 === 12 ? 12 : h12 + 12) : h12 === 12 ? 0 : h12;
    return `${String(h24).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2">
      <ScrollPicker
        value={hour12}
        onChange={(h) => onChange(formatTime(h, minutes, isPM))}
        items={Array.from({ length: 12 }, (_, i) => i + 1)}
        disabled={disabled}
      />
      <span className="text-2xl font-semibold text-foreground">:</span>
      <ScrollPicker
        value={minutes}
        onChange={(m) => onChange(formatTime(hour12, m, isPM))}
        items={Array.from({ length: 60 }, (_, i) => i)}
        format={(n) => String(n).padStart(2, "0")}
        disabled={disabled}
      />
      <ScrollPicker
        value={isPM ? "PM" : "AM"}
        onChange={(val) => onChange(formatTime(hour12, minutes, val === "PM"))}
        items={["AM", "PM"]}
        disabled={disabled}
      />
    </div>
  );
}

interface ScrollPickerProps<T extends number | string> {
  value: T;
  onChange: (value: T) => void;
  items: T[];
  format?: (item: T) => string;
  disabled?: boolean;
}

function ScrollPicker<T extends number | string>({
  value,
  onChange,
  items,
  format = String,
  disabled = false,
}: ScrollPickerProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemHeight = 40;

  // Scroll to selected item on mount and value changes
  useEffect(() => {
    const index = items.indexOf(value);
    if (containerRef.current && index !== -1) {
      containerRef.current.scrollTop = index * itemHeight;
    }
  }, [value, items, itemHeight]);

  const handleScroll = () => {
    if (!containerRef.current || disabled) return;
    const index = Math.round(containerRef.current.scrollTop / itemHeight);
    const clampedIndex = Math.max(0, Math.min(items.length - 1, index));
    if (items[clampedIndex] !== value) onChange(items[clampedIndex]);
  };

  const snapToValue = () => {
    const index = items.indexOf(value);
    if (containerRef.current && index !== -1) {
      containerRef.current.scrollTo({
        top: index * itemHeight,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="relative w-20 h-[120px]">
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
        {items.map((item, index) => (
          <div
            key={index}
            className={cn(
              "flex items-center justify-center cursor-pointer transition-all duration-200",
              item === value
                ? "text-foreground font-semibold text-xl"
                : "text-muted-foreground text-sm"
            )}
            style={{ height: itemHeight }}
            onClick={() => !disabled && onChange(item)}
          >
            {format(item)}
          </div>
        ))}
        <div style={{ height: itemHeight }} />
      </div>
    </div>
  );
}
