"use client";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
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
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const router = useRouter();
  const [, feedback] = useFeedback();
  return (
    <>
      <details className="owner-card-menu" ref={menu}>
        <summary aria-label={`More actions for ${name}`}>
          <MoreHorizontal size={20} />
          <span className="sr-only">More actions</span>
        </summary>
        <div>
          <button
            className="button ghost danger"
            type="button"
            onClick={() => {
              setError("");
              dialog.current?.showModal();
            }}
          >
            <Trash2 size={16} />
            Delete business
          </button>
        </div>
      </details>
      <dialog
        ref={dialog}
        className="photo-crop-dialog owner-delete-dialog"
        aria-labelledby={`delete-${id}`}
        onClose={() => {
          if (menu.current) menu.current.open = false;
        }}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <h2 id={`delete-${id}`}>Delete {name}?</h2>
        <p>
          This permanently removes this business, its jobs, applications, and
          verification records. This cannot be undone.
        </p>
        {error && <p role="alert">{error}</p>}
        <div className="photo-crop-actions">
          <button
            autoFocus
            type="button"
            className="button outline"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            Keep business
          </button>
          <button
            type="button"
            className="button danger"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                const result = await mutate("delete-business", { id });
                if (!result.ok) {
                  setError(result.message);
                  return;
                }
                feedback(result);
                dialog.current?.close();
                router.push("/business/dashboard");
                router.refresh();
              } catch {
                setError(
                  "Unable to delete this business. Check your connection and retry.",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? "Deleting..." : "Delete business"}
          </button>
        </div>
      </dialog>
    </>
  );
}
