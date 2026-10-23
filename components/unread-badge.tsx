export function UnreadBadge({
  count,
  label,
  className = "",
}: {
  count: number;
  label: string;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={`unread-badge ${className}`}
      aria-label={`${count} ${label}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
