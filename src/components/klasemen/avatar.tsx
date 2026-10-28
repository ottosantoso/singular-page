import { avatarTone, initials } from "@/lib/klasemen-insights";

export function Avatar({ name, size }: { name: string; size?: "lg" | "xl" }) {
  return (
    <span
      className={`kl-avatar ${size ? `kl-avatar--${size}` : ""}`}
      style={avatarTone(name)}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
