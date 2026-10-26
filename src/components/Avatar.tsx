export function Avatar({ name, color, size = 28 }: { name: string; color: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="avatar" style={{ background: color, width: size, height: size }} title={name} aria-hidden>
      {initials}
    </span>
  );
}
