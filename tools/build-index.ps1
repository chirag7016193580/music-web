$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$partials = @(
    'partials/layout/ambient-shell.html',
    'partials/layout/sidebar.html',
    'partials/layout/main-content-start.html',
    'partials/layout/modals.html',
    'partials/layout/results-shell.html',
    'partials/layout/queue-panel.html',
    'partials/layout/immersive-player.html',
    'partials/layout/bottom-player.html',
    'partials/layout/toast.html'
)

$styles = @(
    'styles/base.css',
    'styles/sidebar.css',
    'styles/main-content.css',
    'styles/browse-sections.css',
    'styles/player.css',
    'styles/modals.css',
    'styles/responsive.css',
    'styles/recommendations.css',
    'styles/utilities.css'
)

$scripts = @(
    'scripts/config/google-auth-config.js',
    'scripts/core/smart-engine.js',
    'scripts/core/app-state.js',
    'scripts/features/recommendations.js',
    'scripts/features/bootstrap-session.js',
    'scripts/features/discovery.js',
    'scripts/features/audio-effects.js',
    'scripts/features/player-core.js',
    'scripts/features/library-playlists.js',
    'scripts/features/player-ui.js',
    'scripts/features/modals-and-profile.js'
)

$styleTags = ($styles | ForEach-Object { "    <link rel=`"stylesheet`" href=`"$_`">" }) -join "`r`n"
$scriptTags = ($scripts | ForEach-Object { "    <script src=`"$_`" defer></script>" }) -join "`r`n"
$googleIdentityScript = '    <script src="https://accounts.google.com/gsi/client" async defer></script>'
$bodyContent = ($partials | ForEach-Object { Get-Content -Raw -LiteralPath (Join-Path $repoRoot $_) }) -join "`r`n`r`n"

$html = @"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta name="theme-color" content="#000000">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <title>Sangeet - Premium Music Experience</title>

    <!-- Generated from partials/layout via tools/build-index.ps1 -->
    <!-- PWA Manifest -->
    <link rel="manifest" id="manifest-placeholder">

    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet">
$styleTags
</head>
<body>

$bodyContent

$googleIdentityScript
$scriptTags
</body>
</html>
"@

[System.IO.File]::WriteAllText((Join-Path $repoRoot 'index.html'), $html, $utf8NoBom)
