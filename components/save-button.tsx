"use client";
import { Bookmark, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { mutate } from "@/app/actions";
import { useFeedback } from "./use-feedback";
export function SaveButton({
  id,
  initial = false,
}: {
  id: string;
  initial?: boolean;
}) {
  const [saved, setSaved] = useState(initial),
    [pending, setPending] = useState(false);
  const [, setResult] = useFeedback();
  return (
    <div className="save-wrap">
      <button
        className={`save-button ${saved ? "is-saved" : ""}`}
        title={saved ? "Unsave job" : "Save job"}
        aria-label={saved ? "Unsave job" : "Save job"}
        aria-pressed={saved}
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            const result = await mutate("save", { id, remove: saved });
            if (result.ok) {
              setSaved(!saved);
              setResult({
                ok: true,
                message: saved
                  ? "Job removed from saved opportunities."
                  : "Job saved to your opportunities.",
              });
            } else setResult(result);
          } catch {
            setResult({
              ok: false,
              message: "We couldn't update your saved jobs. Please try again.",
            });
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? (
          <LoaderCircle size={18} className="spin" />
        ) : (
          <Bookmark size={19} fill={saved ? "currentColor" : "none"} />
        )}
      </button>
    </div>
  );
}
