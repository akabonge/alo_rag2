<#
.SYNOPSIS
Opens all three Alo office worktrees together in one VS Code window.
.DESCRIPTION
The default office uses the Default profile and reuses the current VS Code window,
preserving access to its installed extensions and sign-ins. -Agent All is an alias
for the shared office. To deliberately open one separate desk and named profile,
use -Agent Claude, Codex, or Grok. Opening a workspace does not start an AI task.
#>
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Low')]
param(
    [string]$RepositoryPath = (Join-Path $PSScriptRoot '../..'),
    [string]$OfficePath,
    [ValidateSet('Office', 'All', 'Claude', 'Codex', 'Grok')][string]$Agent = 'Office'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Office.Common.ps1')
$context = Get-OfficeContext $RepositoryPath $OfficePath
$codeCommand = Get-Command code -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $codeCommand) { throw 'VS Code CLI was not found. Add VS Code to PATH and restart your terminal.' }
$sharedOffice = $Agent -in @('Office', 'All')
$desks = @($context.Desks | Where-Object { $sharedOffice -or $_.Name -eq $Agent })
foreach ($desk in $desks) {
    Assert-OfficeWorktree $context $desk
    if (-not $sharedOffice) { Assert-OfficeWorkspace $desk }
}
if ($sharedOffice) {
    Assert-OfficeSharedWorkspace $context
    if ($PSCmdlet.ShouldProcess($context.SharedWorkspacePath, 'Open all three worktrees in one VS Code window using the Default profile (reuse current window)')) {
        $PSNativeCommandUseErrorActionPreference = $false
        & $codeCommand.Source --reuse-window --profile 'Default' $context.SharedWorkspacePath
        if ($LASTEXITCODE -ne 0) { throw "VS Code failed to open the shared office (exit $LASTEXITCODE)." }
    }
    return
}
foreach ($desk in $desks) {
    if ($PSCmdlet.ShouldProcess($desk.WorkspacePath, "Open VS Code window with profile '$($desk.Profile)'")) {
        $PSNativeCommandUseErrorActionPreference = $false
        & $codeCommand.Source --new-window --profile $desk.Profile $desk.WorkspacePath
        if ($LASTEXITCODE -ne 0) { throw "VS Code failed to open $($desk.Name) (exit $LASTEXITCODE)." }
    }
}
