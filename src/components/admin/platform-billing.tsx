import { useEffect, useState } from "react";
import { CreditCard, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Organization = { organization_id: string; organization_name: string };
type Invoice = { id: string; invoice_number: string; organization_id: string; amount: number; plan_code: string; status: string; due_at: string };
type Plan = { code: string; name: string; price_monthly: number; max_venues: number; max_courts: number; max_active_events: number; max_players_per_event: number; max_staff: number; max_members: number };
type Quota = { plan_code: string; status: string; max_venues: number; max_courts: number; max_active_events: number; max_players_per_event: number; max_staff: number; max_members: number; override_active: boolean };
type Field = keyof Pick<Quota, "max_venues" | "max_courts" | "max_active_events" | "max_players_per_event" | "max_staff" | "max_members">;
const fields: Array<[Field, string]> = [["max_venues", "Venue"], ["max_courts", "Court"], ["max_active_events", "Event aktif"], ["max_players_per_event", "Peserta / event"], ["max_staff", "Staff"], ["max_members", "Anggota"]];

export function PlatformBilling() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [planCode, setPlanCode] = useState("free");
  const [status, setStatus] = useState("active");
  const [values, setValues] = useState<Record<Field, string>>({ max_venues: "", max_courts: "", max_active_events: "", max_players_per_event: "", max_staff: "", max_members: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);

  useEffect(() => {
    Promise.all([supabase.rpc("platform_list_organizations"), supabase.rpc("platform_list_subscription_plans"), supabase.rpc("get_subscription_mode"), supabase.rpc("platform_list_invoices")]).then(([orgResult, planResult, modeResult, invoiceResult]) => {
      setOrganizations((orgResult.data ?? []) as unknown as Organization[]);
      setPlans((planResult.data ?? []) as unknown as Plan[]);
      setInvoices((invoiceResult.data ?? []) as unknown as Invoice[]);
      setSubscriptionEnabled(Boolean((modeResult.data as { subscription_enabled?: boolean } | null)?.subscription_enabled));
      setOrganizationId(((orgResult.data ?? [])[0] as unknown as Organization | undefined)?.organization_id ?? "");
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    supabase.rpc("get_organization_quota", { p_organization_id: organizationId }).then(({ data }) => {
      const next = (data ?? null) as unknown as Quota | null;
      if (!next) return;
      setPlanCode(next.plan_code); setStatus(next.status);
      setValues({ max_venues: String(next.max_venues), max_courts: String(next.max_courts), max_active_events: String(next.max_active_events), max_players_per_event: String(next.max_players_per_event), max_staff: String(next.max_staff), max_members: String(next.max_members) });
    });
  }, [organizationId]);

  async function save() {
    setSaving(true); setMessage("");
    const { error } = await supabase.rpc("platform_set_organization_quota", { p_organization_id: organizationId, p_plan_code: planCode, p_status: status, p_max_venues: Number(values.max_venues), p_max_courts: Number(values.max_courts), p_max_active_events: Number(values.max_active_events), p_max_players_per_event: Number(values.max_players_per_event), p_max_staff: Number(values.max_staff), p_max_members: Number(values.max_members), p_note: "Diatur melalui Admin Platform" });
    setMessage(error ? error.message : "Paket dan quota berhasil disimpan."); setSaving(false);
  }

  if (loading) return <div className="mt-5 flex items-center gap-2 text-sm text-arena-dim"><Loader2 className="size-4 animate-spin" /> Memuat billing...</div>;
  return <section className="mt-5 space-y-5"><div className="rounded-[28px] border border-white bg-gradient-to-br from-[#e8f3fb] via-white to-[#eef8df] p-5 shadow-[0_26px_60px_-42px_rgba(17,45,72,.55)] sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[0.24em] text-arena-dim">Commercial control</p><h2 className="mt-1 font-display text-2xl font-bold">Billing & quota</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-arena-dim">Atur paket organisasi dan batas operasional tanpa mengubah data event yang sudah ada.</p></div><CreditCard className="size-8 text-arena-lime" /></div><div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-arena-ink/10 bg-white/70 p-4"><div><p className="text-xs font-bold uppercase tracking-wider text-arena-dim">Mode subscription</p><p className="mt-1 text-sm text-arena-dim">{subscriptionEnabled ? "ON: quota dibatasi sesuai paket." : "OFF: quota tidak memblokir operasi selama masa uji coba."}</p></div><button type="button" onClick={async () => { const { data, error } = await supabase.rpc("platform_set_subscription_mode", { p_enabled: !subscriptionEnabled }); if (!error) setSubscriptionEnabled(Boolean((data as { subscription_enabled?: boolean } | null)?.subscription_enabled)); setMessage(error ? error.message : "Mode subscription diperbarui."); }} className={`rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-wider ${subscriptionEnabled ? "bg-emerald-600 text-white" : "bg-slate-200 text-arena-ink"}`}>{subscriptionEnabled ? "Subscription ON" : "Subscription OFF"}</button></div><div className="mt-6 grid gap-4 sm:grid-cols-3"><label className="text-xs font-bold uppercase tracking-wider text-arena-dim">Organisasi<select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} className="arena-input mt-2 w-full normal-case tracking-normal">{organizations.map((org) => <option key={org.organization_id} value={org.organization_id}>{org.organization_name}</option>)}</select></label><label className="text-xs font-bold uppercase tracking-wider text-arena-dim">Paket<select value={planCode} onChange={(e) => { const code = e.target.value; setPlanCode(code); const plan = plans.find((item) => item.code === code); if (plan) setValues({ max_venues: String(plan.max_venues), max_courts: String(plan.max_courts), max_active_events: String(plan.max_active_events), max_players_per_event: String(plan.max_players_per_event), max_staff: String(plan.max_staff), max_members: String(plan.max_members) }); }} className="arena-input mt-2 w-full normal-case tracking-normal">{plans.map((plan) => <option key={plan.code} value={plan.code}>{plan.name} {plan.price_monthly ? `- Rp${plan.price_monthly.toLocaleString("id-ID")}/bulan` : ""}</option>)}</select></label><label className="text-xs font-bold uppercase tracking-wider text-arena-dim">Status<select value={status} onChange={(e) => setStatus(e.target.value)} className="arena-input mt-2 w-full normal-case tracking-normal"><option value="trialing">Trialing</option><option value="active">Active</option><option value="past_due">Past due</option><option value="cancelled">Cancelled</option><option value="expired">Expired</option></select></label></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{fields.map(([field, label]) => <label key={field} className="text-xs font-bold uppercase tracking-wider text-arena-dim">{label}<input type="number" min="0" value={values[field]} onChange={(e) => setValues((current) => ({ ...current, [field]: e.target.value }))} className="arena-input mt-2 w-full" /></label>)}</div><div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" disabled={saving || !organizationId} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-full bg-arena-ink px-5 py-3 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-50"><Save className="size-4" /> {saving ? "Menyimpan..." : "Simpan quota"}</button>{message && <span className="text-sm text-arena-dim">{message}</span>}</div></div><div className="rounded-[28px] border border-arena-ink/10 bg-white p-5"><h3 className="font-display text-xl font-bold">Review pembayaran</h3><div className="mt-4 space-y-3">{invoices.filter((invoice) => ["proof_submitted", "under_review"].includes(invoice.status)).map((invoice) => <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-arena-ink/10 p-4"><div><p className="font-bold">{invoice.invoice_number}</p><p className="text-sm text-arena-dim">{invoice.plan_code.toUpperCase()} · Rp{Number(invoice.amount).toLocaleString("id-ID")}</p></div><div className="flex gap-2"><button type="button" onClick={async () => { await supabase.rpc("platform_review_payment", { p_invoice_id: invoice.id, p_status: "paid", p_note: "Disetujui Admin Platform" }); const result = await supabase.rpc("platform_list_invoices"); setInvoices((result.data ?? []) as unknown as Invoice[]); }} className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Approve</button><button type="button" onClick={async () => { await supabase.rpc("platform_review_payment", { p_invoice_id: invoice.id, p_status: "rejected", p_note: "Bukti pembayaran ditolak" }); const result = await supabase.rpc("platform_list_invoices"); setInvoices((result.data ?? []) as unknown as Invoice[]); }} className="rounded-full bg-red-100 px-3 py-2 text-xs font-bold text-red-700">Reject</button></div></div>)}{!invoices.some((invoice) => ["proof_submitted", "under_review"].includes(invoice.status)) && <p className="text-sm text-arena-dim">Tidak ada bukti pembayaran yang menunggu review.</p>}</div></div></section>;
}
