<#
.SYNOPSIS
Opens each Alo office desk in a separate VS Code window and named profile.
.DESCRIPTION
Named profiles separate extension settings/state. Extension recommendations do not
install or authenticate extensions. Opening a desk does not start an AI task.
#>
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Low')]
param(
    [string]$RepositoryPath = (Join-Path $PSScriptRoot '../..'),
    [string]$OfficePath,
    [ValidateSet('All', 'Claude', 'Codex', 'Grok')][string]$Agent = 'All'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Office.Common.ps1')
$context = Get-OfficeContext $RepositoryPath $OfficePath
$codeCommand = Get-Command code -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $codeCommand) { throw 'VS Code CLI was not found. Add VS Code to PATH and restart your terminal.' }
$desks = @($context.Desks | Where-Object { $Agent -eq 'All' -or $_.Name -eq $Agent })
foreach ($desk in $desks) {
    Assert-OfficeWorktree $context $desk
    Assert-OfficeWorkspace $desk
}
foreach ($desk in $desks) {
    if ($PSCmdlet.ShouldProcess($desk.WorkspacePath, "Open VS Code window with profile '$($desk.Profile)'")) {
        $PSNativeCommandUseErrorActionPreference = $false
        & $codeCommand.Source --new-window --profile $desk.Profile $desk.WorkspacePath
        if ($LASTEXITCODE -ne 0) { throw "VS Code failed to open $($desk.Name) (exit $LASTEXITCODE)." }
    }
}
