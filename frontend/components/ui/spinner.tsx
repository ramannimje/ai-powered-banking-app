"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-8 h-8",
  lg: "w-12 h-12",
};

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-muted border-t-primary`}
      />
    </div>
  );
}