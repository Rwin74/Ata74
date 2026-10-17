param()
$ErrorActionPreference='Stop'
$tokens=$null;$parseErrors=$null
[System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '../system-scripts/system.ps1'),[ref]$tokens,[ref]$parseErrors) | Out-Null
if($parseErrors.Count){throw ($parseErrors.Message -join '; ')}
Write-Output 'PowerShell syntax: PASS'
