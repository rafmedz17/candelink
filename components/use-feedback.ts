"use client";
import { useEffect, useState } from "react";
export function useFeedback<T = { ok: boolean; message: string }>() {
  const [result, setResult] = useState<T | null>(null);
  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => setResult(null), 4000);
    return () => clearTimeout(timer);
  }, [result]);
  return [result, setResult] as const;
}
