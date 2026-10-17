param()
$ErrorActionPreference='Stop'
foreach($file in Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot '../system-scripts') -Filter '*.ps1'){
 $tokens=$null;$parseErrors=$null
 [System.Management.Automation.Language.Parser]::ParseFile($file.FullName,[ref]$tokens,[ref]$parseErrors) | Out-Null
 if($parseErrors.Count){throw ($file.Name+': '+($parseErrors.Message -join '; '))}
}
Write-Output 'PowerShell syntax: PASS'
