# fix-dns.ps1
# Șterge recordurile DNS A/AAAA manuale din zona moneo.bond
# și re-deployează workerul cu custom domain.
#
# CUM SĂ OBȚII UN API TOKEN:
# 1. Deschide https://dash.cloudflare.com/profile/api-tokens
# 2. Click "Create Token"
# 3. Alege template-ul "Edit zone DNS"
# 4. Sub "Zone Resources" → selectează "moneo.bond"
# 5. Apasă "Continue to summary" → "Create Token"
# 6. Copiază tokenul generat și pune-l mai jos:
#
# CUM SĂ GĂSEȘTI ZONE ID:
# Cloudflare Dashboard → moneo.bond → Overview → (jos, dreapta) "Zone ID"
# ACCOUNT ID: Cloudflare Dashboard → orice pagină → URL-ul conține /accounts/<ACCOUNT_ID>/
# (sau Workers & Pages → Overview → "Account ID")

$API_TOKEN  = "PUNE_TOKENUL_TAU_AICI"    # <-- înlocuiește
$ZONE_ID    = "PUNE_ZONE_ID_AICI"        # <-- înlocuiește
$ACCOUNT_ID = "PUNE_ACCOUNT_ID_AICI"     # <-- înlocuiește

if ($API_TOKEN -eq "PUNE_TOKENUL_TAU_AICI" -or $ZONE_ID -eq "PUNE_ZONE_ID_AICI" -or $ACCOUNT_ID -eq "PUNE_ACCOUNT_ID_AICI") {
    Write-Host "❌ Completează mai întâi API_TOKEN, ZONE_ID și ACCOUNT_ID în script." -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $API_TOKEN"
    "Content-Type"  = "application/json"
}

Write-Host "`n📋 Listez DNS records pentru moneo.bond..." -ForegroundColor Cyan

$records = Invoke-RestMethod `
    -Uri "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" `
    -Headers $headers `
    -Method GET

if (-not $records.success) {
    Write-Host "❌ Eroare API: $($records.errors | ConvertTo-Json)" -ForegroundColor Red
    exit 1
}

Write-Host "`nRecorduri găsite:" -ForegroundColor Yellow
$records.result | ForEach-Object {
    Write-Host "  $($_.type.PadRight(6)) $($_.name.PadRight(30)) -> $($_.content)  [id: $($_.id)]"
}

# Ștergem recordurile A și AAAA (nu CNAME sau TXT de verificare)
$toDelete = $records.result | Where-Object { $_.type -in @("A", "AAAA") -and $_.name -eq "moneo.bond" }

if ($toDelete.Count -eq 0) {
    Write-Host "`n✅ Nu există recorduri A/AAAA care blochează. Continui cu deploy-ul." -ForegroundColor Green
} else {
    Write-Host "`n🗑  Șterg $($toDelete.Count) record(uri) conflictuale..." -ForegroundColor Yellow
    foreach ($rec in $toDelete) {
        $del = Invoke-RestMethod `
            -Uri "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$($rec.id)" `
            -Headers $headers `
            -Method DELETE
        if ($del.success) {
            Write-Host "  ✅ Șters: $($rec.type) $($rec.name) -> $($rec.content)" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Eroare la ștergere: $($del.errors | ConvertTo-Json)" -ForegroundColor Red
        }
    }
}

Write-Host "`n🚀 Rulez wrangler deploy cu custom domain..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\cloudflare\workers"
npx wrangler deploy

Write-Host "`n✅ Gata! Testează https://moneo.bond în browser." -ForegroundColor Green
Write-Host "   (DNS propagation poate dura 1-2 minute)" -ForegroundColor Gray
