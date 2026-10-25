"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteUser } from "@/app/admin/user-actions";
import type { Result } from "@/app/actions";

export function DeleteUserButton({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  return (
    <div className="delete-user-control">
      {!open ? (
        <button
          type="button"
          className="button outline danger"
          onClick={() => setOpen(true)}
        >
          Delete user
        </button>
      ) : (
        <form
          className="form-stack"
          onSubmit={async (event) => {
            event.preventDefault();
            if (pending || confirmation !== "DELETE") return;
            setPending(true);
            try {
              const r = await deleteUser(userId);
              setResult(r);
            } catch {
              setResult({
                ok: false,
                message: "Deletion could not finish. Refresh and try again.",
              });
            } finally {
              setPending(false);
              router.refresh();
            }
          }}
        >
          <p>
            Permanently delete {name || "this user"}? This removes their
            account, uploaded files, applications, and conversations. This
            cannot be undone.
          </p>
          <label>
            Type DELETE to confirm
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              disabled={pending}
              required
            />
          </label>
          <div className="record-actions">
            <button
              className="button danger"
              type="submit"
              disabled={pending || confirmation !== "DELETE"}
            >
              {pending ? "Deleting…" : "Permanently delete user"}
            </button>
            <button
              className="button outline"
              type="button"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setConfirmation("");
                setResult(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {result && (
        <p
          className={`form-message ${result.ok ? "" : "error"}`}
          role={result.ok ? "status" : "alert"}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
