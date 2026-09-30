<#
.SYNOPSIS
Reports office branches, local changes, available tools, and credential variable presence.
.DESCRIPTION
Read-only. It never prints secret values, reads credential stores, calls model APIs,
or claims that configured credentials are valid. VS Code extension login is manual.
#>
[CmdletBinding()]
param(
    [string]$RepositoryPath = (Join-Path $PSScriptRoot '../..'),
    [string]$OfficePath
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Office.Common.ps1')
$context = Get-OfficeContext $RepositoryPath $OfficePath
$rows = foreach ($desk in $context.Desks) {
    if (-not (Test-Path -LiteralPath $desk.Path)) {
        [pscustomobject]@{ Desk = $desk.Name; Branch = $desk.Branch; State = 'Not created'; Changes = '-'; Workspace = 'Missing' }
        continue
    }
    try {
        $currentBranch = Assert-OfficeWorktree $context $desk -PassThru
        $changes = (Invoke-OfficeGit $desk.Path @('status', '--porcelain=v1', '--untracked-files=normal')).Output
        $workspaceState = try { Assert-OfficeWorkspace $desk; 'Ready' } catch { 'Missing or mismatched' }
        [pscustomobject]@{ Desk = $desk.Name; Branch = $currentBranch; State = 'Ready'; Changes = @($changes).Count; Workspace = $workspaceState }
    } catch {
        [pscustomobject]@{ Desk = $desk.Name; Branch = $desk.Branch; State = 'Mismatched'; Changes = '-'; Workspace = 'Check setup' }
        Write-Warning $_.Exception.Message
    }
}
$rows | Format-Table -AutoSize

Write-Host 'CLI tools available on PATH:'
foreach ($tool in @('git', 'code', 'node', 'npm', 'gh', 'codex', 'claude', 'cline')) {
    $available = [bool](Get-Command $tool -CommandType Application -ErrorAction SilentlyContinue)
    Write-Host ('  {0}: {1}' -f $tool, $(if ($available) { 'Available' } else { 'Not found' }))
}
Write-Host 'Credential variable names only (current terminal; presence does not validate login):'
foreach ($name in @('ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'XAI_API_KEY', 'OPENROUTER_API_KEY')) {
    $configured = -not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name, 'Process'))
    Write-Host ('  {0}: {1}' -f $name, $(if ($configured) { 'Present' } else { 'Not present' }))
}
Write-Host 'Check Claude, Codex, and Cline provider sign-ins inside each named VS Code profile.'
