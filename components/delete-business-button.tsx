"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { mutate } from "@/app/actions";
import { useFeedback } from "./use-feedback";

export function DeleteBusinessButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const [pending, setPending] = useState(false);
  const [, feedback] = useFeedback();
  const router = useRouter();
  return (
    <button
      type="button"
      className="button outline danger small"
      aria-label={`Delete ${name}`}
      disabled={pending}
      onClick={async () => {
        if (
          !window.confirm(
            `Delete “${name}”? This permanently removes the business, its jobs, applications, and verification records. This cannot be undone.`,
          )
        )
          return;
        setPending(true);
        try {
          const result = await mutate("delete-business", { id });
          feedback(result);
          if (result.ok) {
            router.push("/business/dashboard");
            router.refresh();
          }
        } catch {
          feedback({
            ok: false,
            message: "Unable to delete the business. Please try again.",
          });
        } finally {
          setPending(false);
        }
      }}
    >
      <Trash2 size={16} />
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
