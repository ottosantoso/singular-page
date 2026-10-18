import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { ArrowRight, CalendarDays, MapPin, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/club/$slug")({
  head: () => ({ meta: [{ title: "Club publik - OTTOPLAY" }] }),
  loader: async ({ params }) => {
    const { data, error } = await supabase.rpc("get_public_organization", { p_slug: params.slug });
    if (error) throw error;
    return data?.[0] as PublicClubPayload | undefined;
  },
  component: PublicClubPage,
});

type PublicClubPayload = {
  organization: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    banner_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
    sport_label: string | null;
    public_description: string | null;
  } | null;
  venues: Array<{ name: string; address: string | null; timezone: string }>;
  events: Array<{ id: string; name: string; sport: string; format: string; status: string; starts_at: string | null; public_code: string; max_players: number | null }>;
};

function PublicClubPage() {
  const payload = Route.useLoaderData() as PublicClubPayload | undefined;
  if (!payload?.organization) return <main className="arena-home grid min-h-screen place-items-center p-6 text-arena-dim">Club tidak ditemukan.</main>;
  const org = payload.organization;
  const primary = org.primary_color || "#b8f34a";
  const secondary = org.secondary_color || "#0b2a5c";
  return (
    <main className="arena-home min-h-screen px-4 py-6 sm:px-8 sm:py-10" style={{ "--club-primary": primary, "--club-secondary": secondary } as CSSProperties}>
      <div className="mx-auto max-w-6xl">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-arena-dim">OTTOPLAY <span className="text-arena-lime">· Club directory</span></Link>
        <section className="relative mt-5 min-h-[300px] overflow-hidden rounded-[30px] bg-[var(--club-secondary)] p-6 text-white shadow-2xl sm:p-10">
          {org.banner_url && <img src={org.banner_url} alt="" className="absolute inset-0 size-full object-cover opacity-35" />}
          <div className="relative z-10 flex min-h-[250px] flex-col justify-end">
            <div className="flex items-end gap-4">
              {org.logo_url ? <img src={org.logo_url} alt={`Logo ${org.name}`} className="size-20 rounded-2xl border border-white/25 bg-white/90 object-contain p-2" /> : <div className="grid size-20 place-items-center rounded-2xl bg-[var(--club-primary)] font-display text-3xl font-bold text-arena-ink">{org.name.slice(0, 1).toUpperCase()}</div>}
              <div><p className="text-xs font-bold uppercase tracking-[0.25em] text-white/65">{org.sport_label || "Sports club"}</p><h1 className="mt-1 font-display text-4xl font-bold uppercase tracking-tight sm:text-6xl">{org.name}</h1></div>
            </div>
            {org.public_description && <p className="mt-5 max-w-2xl text-sm leading-6 text-white/75">{org.public_description}</p>}
          </div>
        </section>
        <section className="mt-6 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
          <div className="rounded-[24px] border border-arena-ink/10 bg-white/85 p-6"><p className="text-xs font-bold uppercase tracking-[0.2em] text-arena-lime">Venues</p><h2 className="mt-2 font-display text-2xl font-bold text-arena-ink">Tempat bermain</h2><div className="mt-5 grid gap-3">{payload.venues.length ? payload.venues.map((venue) => <div key={`${venue.name}-${venue.address}`} className="rounded-2xl bg-slate-50 p-4"><div className="flex gap-3"><MapPin className="mt-0.5 size-5 text-arena-lime" /><div><b>{venue.name}</b>{venue.address && <p className="mt-1 text-sm text-arena-dim">{venue.address}</p>}</div></div></div>) : <p className="text-sm text-arena-dim">Venue publik belum ditambahkan.</p>}</div></div>
          <div className="rounded-[24px] border border-arena-ink/10 bg-white/85 p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-arena-lime">Open events</p><h2 className="mt-2 font-display text-2xl font-bold text-arena-ink">Event club</h2></div><Trophy className="size-7 text-arena-lime" /></div><div className="mt-5 grid gap-3">{payload.events.length ? payload.events.map((event) => <Link key={event.id} to="/e/$publicCode" params={{ publicCode: event.public_code }} className="group rounded-2xl bg-slate-50 p-4 transition hover:bg-[color-mix(in_srgb,var(--club-primary)_24%,white)]"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-arena-dim">{event.sport} · {event.status}</p><b className="mt-1 block font-display text-lg text-arena-ink">{event.name}</b><p className="mt-2 flex items-center gap-2 text-xs text-arena-dim"><CalendarDays className="size-3.5" /> {event.starts_at ? new Date(event.starts_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "Jadwal menyusul"}</p></div><ArrowRight className="size-5 text-arena-dim transition group-hover:translate-x-1" /></div></Link>) : <p className="text-sm text-arena-dim">Belum ada event publik.</p>}</div></div>
        </section>
      </div>
    </main>
  );
}


