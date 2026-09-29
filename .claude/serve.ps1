param([string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path, [int]$Port = 8765)
$mime = @{ ".html"="text/html; charset=utf-8"; ".js"="application/javascript"; ".json"="application/manifest+json"; ".png"="image/png"; ".css"="text/css"; ".svg"="image/svg+xml"; ".ico"="image/x-icon" }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://127.0.0.1:$Port/")
$l.Start()
Write-Host "serving $Root on http://127.0.0.1:$Port (vercel-like cleanUrls, trailingSlash:false)"
while ($l.IsListening) {
  $ctx = $l.GetContext(); $req = $ctx.Request; $res = $ctx.Response
  $p = [Uri]::UnescapeDataString($req.Url.AbsolutePath)
  try {
    # trailingSlash:false -> /x/ redirects to /x (except root)
    if ($p.Length -gt 1 -and $p.EndsWith("/")) { $res.StatusCode = 308; $res.RedirectLocation = $p.TrimEnd("/"); $res.Close(); continue }
    # cleanUrls -> /x.html redirects to /x ; /x/index.html -> /x
    if ($p -match "\.html$") { $t = $p -replace "/index\.html$","" -replace "\.html$",""; if ($t -eq "") { $t = "/" }; $res.StatusCode = 308; $res.RedirectLocation = $t; $res.Close(); continue }
    $rel = $p.TrimStart("/") -replace "/","\"
    $cands = @()
    if ($rel -eq "") { $cands += "index.html" } else { $cands += $rel; $cands += "$rel.html"; $cands += "$rel\index.html" }
    $file = $null
    foreach ($c in $cands) { $f = Join-Path $Root $c; if (Test-Path $f -PathType Leaf) { $file = $f; break } }
    if (-not $file) { $res.StatusCode = 404; $b = [Text.Encoding]::UTF8.GetBytes("404 $p"); $res.OutputStream.Write($b,0,$b.Length); $res.Close(); continue }
    $ext = [IO.Path]::GetExtension($file).ToLower()
    $res.ContentType = if ($mime[$ext]) { $mime[$ext] } else { "application/octet-stream" }
    $res.Headers["Cache-Control"] = "no-store"
    $bytes = [IO.File]::ReadAllBytes($file)
    $res.ContentLength64 = $bytes.Length; $res.OutputStream.Write($bytes,0,$bytes.Length); $res.Close()
    Write-Host ("{0} {1} -> {2}" -f $res.StatusCode, $p, $file.Substring($Root.Length))
  } catch { try { $res.StatusCode = 500; $res.Close() } catch {} ; Write-Host "ERR $p $_" }
}
