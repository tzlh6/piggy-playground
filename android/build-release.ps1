param(
    [Parameter(Mandatory=$true)][string]$ToolsPath,
    [Parameter(Mandatory=$true)][string]$KeystorePath,
    [string]$OutputPath,
    [switch]$WithTests
)
$ErrorActionPreference = 'Stop'
if (-not $env:PIGGY_ANDROID_STOREPASS) { throw 'Set PIGGY_ANDROID_STOREPASS for your own keystore before building.' }
$buildRoot = Join-Path $PSScriptRoot '..\build\android'
$arguments = @((Join-Path $PSScriptRoot 'build.py'), '--tools', $ToolsPath, '--keystore', $KeystorePath, '--work', (Join-Path $buildRoot 'build'))
if ($OutputPath) { $arguments += @('--output', $OutputPath) }
if ($WithTests) { $arguments += '--tests' }
& python @arguments
if ($LASTEXITCODE -ne 0) { throw 'APK build or verification failed.' }
