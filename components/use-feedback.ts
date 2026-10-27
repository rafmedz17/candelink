"use client";
import { useCallback, useEffect, useState } from "react";
import { showToast } from "@/lib/toasts";
export function useErrorFeedback() {
  return useCallback((message: string) => {
    if (message) showToast(message, "error");
  }, []);
}
export function useFeedback<
  T extends { ok: boolean; message: string } = { ok: boolean; message: string },
>() {
  const [result, setResult] = useState<T | null>(null);
  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => setResult(null), 4000);
    return () => clearTimeout(timer);
  }, [result]);
  const feedback = useCallback((value: T | null) => {
    setResult(value);
    if (value?.message)
      showToast(value.message, value.ok ? "success" : "error");
  }, []);
  return [result, feedback] as const;
}
