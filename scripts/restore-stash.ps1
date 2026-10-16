param(
  [string]$Stash = "stash@{0}"
)

$ErrorActionPreference = "Stop"

function Invoke-Git([string[]]$Args) {
  & git @Args
  if ($LASTEXITCODE -ne 0) { throw "git $($Args -join ' ') gagal." }
}

$status = git status --porcelain=v1
if ($status) {
  throw "Working tree tidak bersih. Commit atau simpan perubahan lokal dulu sebelum restore stash."
}

Invoke-Git @("stash", "apply", $Stash)
Write-Host "Stash $Stash berhasil direstore."
Write-Host "Jika ada konflik, selesaikan manual lalu jalankan: git add -A"
