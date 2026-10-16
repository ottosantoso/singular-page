param(
  [Parameter(Mandatory = $true)]
  [string]$Message
)

$ErrorActionPreference = "Stop"
$originalBranch = (git branch --show-current).Trim()
if ($originalBranch -ne "development") {
  throw "Jalankan skrip dari branch development. Branch saat ini: $originalBranch"
}

function Invoke-Git([string[]]$Args) {
  & git @Args
  if ($LASTEXITCODE -ne 0) { throw "git $($Args -join ' ') gagal. Hentikan proses agar konflik tidak tertutup." }
}

Invoke-Git @("fetch", "origin")
Invoke-Git @("pull", "--ff-only", "origin", "development")
Invoke-Git @("add", "-A")

$staged = git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  throw "Tidak ada perubahan untuk di-commit."
}

Invoke-Git @("commit", "-m", $Message)
Invoke-Git @("push", "origin", "development")

try {
  Invoke-Git @("switch", "main")
  Invoke-Git @("pull", "--ff-only", "origin", "main")
  Invoke-Git @("merge", "--no-ff", "development", "-m", "Merge development into main")
  Invoke-Git @("push", "origin", "main")
}
catch {
  Write-Error $_
  Write-Host "Jika merge konflik: selesaikan file, git add -A, git commit, lalu git push origin main."
  throw
}
finally {
  if ((git branch --show-current).Trim() -eq "main") {
    Invoke-Git @("switch", "development")
  }
}

Write-Host "Selesai: development dan main sudah dipush. Working branch kembali ke development."
