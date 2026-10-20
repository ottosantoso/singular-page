-- Daftar ulang setelah "Batalkan pendaftaran" gagal dengan:
--   duplicate key value violates unique constraint "event_players_pkey"
-- Penyebab: withdraw_event_guest hanya mengubah status menjadi 'withdrawn' (baris tetap ada) dan primary key
-- tabel adalah (event_id, display_name), sedangkan register_event_guest selalu INSERT baris baru dengan nama yang sama.
-- Perbaikan: kalau ada baris 'withdrawn' dengan nama itu (tanpa membedakan huruf besar/kecil), aktifkan kembali
-- dengan token pendaftaran baru; baru INSERT kalau memang belum pernah ada.
create or replace function public.register_event_guest(
  p_public_code text,
  p_display_name text,
  p_gender text,
  p_phone text default null::text,
  p_email text default null::text,
  p_photo_url text default null::text,
  p_consent_to_show_name boolean default true,
  p_tier text default 'intermediate'::text
)
returns table(event_id uuid, event_name text, public_code text, player_id uuid, display_name text, registration_token text, registration_status text)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_event public.events;
  v_token text;
  v_name text := nullif(trim(p_display_name), '');
  v_gender text := lower(nullif(trim(p_gender), ''));
  v_email text := nullif(lower(trim(p_email)), '');
  v_phone text := nullif(trim(p_phone), '');
  v_tier text := lower(coalesce(nullif(trim(p_tier), ''), 'intermediate'));
  v_status text := 'registered';
  v_active_count integer;
  v_reactivated integer;
begin
  if v_name is null or length(v_name) < 2 or length(v_name) > 80 then raise exception 'Nama peserta harus 2 sampai 80 karakter' using errcode = '22023'; end if;
  if v_gender not in ('male', 'female') then raise exception 'Jenis kelamin peserta wajib dipilih' using errcode = '22023'; end if;
  if v_tier not in ('newbie', 'beginner', 'intermediate', 'advanced', 'pro', 'elite') then raise exception 'Tier peserta tidak valid' using errcode = '22023'; end if;
  select * into v_event from public.events e where e.public_code = lower(trim(p_public_code)) and e.status = 'registration' limit 1;
  if not found then raise exception 'Event tidak tersedia untuk pendaftaran' using errcode = 'P0002'; end if;
  if exists (select 1 from public.event_players ep where ep.event_id = v_event.id and ep.status <> 'withdrawn' and lower(ep.display_name) = lower(v_name)) then raise exception 'Nama tersebut sudah terdaftar di event ini' using errcode = '23505'; end if;
  select count(*)::integer into v_active_count from public.event_players ep where ep.event_id = v_event.id and ep.status in ('registered', 'checked_in');
  if v_event.max_players is not null and v_active_count >= v_event.max_players then v_status := 'waitlisted'; end if;
  v_token := encode(gen_random_bytes(18), 'hex');

  -- Pakai ulang baris 'withdrawn' (utamakan nama yang persis sama) alih-alih INSERT yang bentrok di primary key.
  update public.event_players ep
  set display_name = v_name,
      player_user_id = auth.uid(),
      gender = v_gender,
      tier = v_tier,
      email = v_email,
      phone = v_phone,
      photo_url = nullif(trim(p_photo_url), ''),
      registration_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
      consent_to_show_name = coalesce(p_consent_to_show_name, true),
      status = v_status,
      registered_at = now(),
      checked_in_at = null,
      seed = null
  where ep.event_id = v_event.id
    and ep.display_name = (
      select ep2.display_name
      from public.event_players ep2
      where ep2.event_id = v_event.id
        and ep2.status = 'withdrawn'
        and lower(ep2.display_name) = lower(v_name)
      order by (ep2.display_name = v_name) desc
      limit 1
    );
  get diagnostics v_reactivated = row_count;

  if v_reactivated = 0 then
    insert into public.event_players (event_id, player_user_id, display_name, gender, tier, email, phone, photo_url, registration_token_hash, consent_to_show_name, status, registered_at)
    values (v_event.id, auth.uid(), v_name, v_gender, v_tier, v_email, v_phone, nullif(trim(p_photo_url), ''), encode(extensions.digest(v_token, 'sha256'), 'hex'), coalesce(p_consent_to_show_name, true), v_status, now());
  end if;

  return query select v_event.id, v_event.name, v_event.public_code, null::uuid, v_name, v_token, v_status;
end;
$function$;
