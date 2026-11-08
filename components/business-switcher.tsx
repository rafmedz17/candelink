"use client";
import { useRouter } from "next/navigation";
import { usePhotoSave } from "./photo-save-context";
export function BusinessSwitcher({
  businesses,
  selected,
  tab,
}: {
  businesses: { id: string; name: string }[];
  selected: string;
  tab: string;
}) {
  const router = useRouter();
  const changes = usePhotoSave();
  return (
    <form
      action="/business/dashboard"
      className="owner-business-switcher"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        (changes?.navigate || router.push)(
          `/business/dashboard?${new URLSearchParams({ tab, business: String(data.get("business")) })}`,
        );
      }}
    >
      <input type="hidden" name="tab" value={tab} />
      <label>
        Switch business
        <select name="business" defaultValue={selected}>
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <button className="button outline" type="submit">
        Open business
      </button>
    </form>
  );
}
