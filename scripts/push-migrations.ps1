param(
  [ValidateSet("dev", "prod", "both")]
  [string]$Target = "dev"
)

$projects = @{
  dev = "owptsovberbfwvvdxjiu"
  prod = "qibsdczvxqmbjrtmvgtj"
}

# Avoid a Windows telemetry-file permission issue in the local CLI wrapper.
$env:SUPABASE_TELEMETRY_DISABLED = "1"
$env:SUPABASE_TELEMETRY = "false"
$env:SUPABASE_CLI_TELEMETRY = "false"

$cli = (Get-Command supabase.cmd -ErrorAction SilentlyContinue).Source
if (-not $cli) {
  $cli = (Get-Command supabase -ErrorAction SilentlyContinue).Source
}
if (-not $cli) {
  throw "Supabase CLI tidak ditemukan. Install CLI lalu jalankan supabase login."
}

function Push-Migrations([string]$name) {
  $ref = $projects[$name]
  Write-Host "Link Supabase $name ($ref)..."
  & $cli link --project-ref $ref
  if ($LASTEXITCODE -ne 0) { throw "Gagal link project $name." }

  Write-Host "Push migration ke $name..."
  if ($name -eq "dev") {
    & $cli db push --linked --include-all --dns-resolver https
  } else {
    & $cli db push --linked --dns-resolver https
  }
  if ($LASTEXITCODE -ne 0) { throw "Gagal push migration ke $name." }
}

if ($Target -eq "both") {
  Push-Migrations "dev"
  Push-Migrations "prod"
} else {
  Push-Migrations $Target
}

Write-Host "Selesai. Target terakhir: $Target"


