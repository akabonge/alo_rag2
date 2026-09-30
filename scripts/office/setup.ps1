<#
.SYNOPSIS
Creates three independent Git worktrees and one shared VS Code office workspace.
.DESCRIPTION
Existing worktrees and workspace customizations are preserved. This does not fetch,
install dependencies/extensions, change provider settings, start agents, or push.
Use -WhatIf to preview. BaseRef only affects branches that do not already exist.
Each desk starts on <agent>/work; existing <agent>/<task> branches are preserved.
The shared workspace opens all three worktrees in one window. Separate desk workspace
files are also generated for optional individual use.
#>
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Low')]
param(
    [string]$RepositoryPath = (Join-Path $PSScriptRoot '../..'),
    [ValidateNotNullOrEmpty()][string]$BaseRef = 'origin/main',
    [string]$OfficePath
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Office.Common.ps1')
$context = Get-OfficeContext $RepositoryPath $OfficePath
$null = Invoke-OfficeGit $context.RepositoryPath @('rev-parse', '--verify', '--end-of-options', "${BaseRef}^{commit}")

# Validate every existing target before making the first change.
if (Test-Path -LiteralPath $context.OfficePath) {
    if (-not (Test-Path -LiteralPath $context.OfficePath -PathType Container)) {
        throw "OfficePath is not a directory: $($context.OfficePath)"
    }
}
$registeredTrees = (Invoke-OfficeGit $context.RepositoryPath @('worktree', 'list', '--porcelain')).Output
foreach ($desk in $context.Desks) {
    if (Test-Path -LiteralPath $desk.Path) {
        Assert-OfficeWorktree $context $desk
    } elseif ($registeredTrees -contains "branch refs/heads/$($desk.Branch)") {
        throw "Branch $($desk.Branch) is already assigned to another worktree. Inspect 'git worktree list'; setup will not move or delete it."
    }
    if (Test-Path -LiteralPath $desk.WorkspacePath) { Assert-OfficeWorkspace $desk }
}
if (Test-Path -LiteralPath $context.SharedWorkspacePath) { Assert-OfficeSharedWorkspace $context }

foreach ($desk in $context.Desks) {
    if (Test-Path -LiteralPath $desk.Path) {
        $currentBranch = Assert-OfficeWorktree $context $desk -PassThru
        Write-Host "Keeping existing $($desk.Name) worktree on $currentBranch."
        continue
    }
    $branchExists = (Invoke-OfficeGit $context.RepositoryPath @('show-ref', '--verify', '--quiet', "refs/heads/$($desk.Branch)") @(0, 1)).ExitCode -eq 0
    $action = if ($branchExists) { "Create worktree using existing branch $($desk.Branch)" } else { "Create worktree and branch $($desk.Branch) from $BaseRef" }
    if ($PSCmdlet.ShouldProcess($desk.Path, $action)) {
        $arguments = if ($branchExists) {
            @('worktree', 'add', '--', $desk.Path, $desk.Branch)
        } else {
            @('worktree', 'add', '--no-track', '-b', $desk.Branch, '--', $desk.Path, $BaseRef)
        }
        $result = Invoke-OfficeGit $context.RepositoryPath $arguments
        $result.Output | ForEach-Object { Write-Host $_ }
        Assert-OfficeWorktree $context $desk
    }
}

if (-not (Test-Path -LiteralPath $context.OfficePath) -and
    $PSCmdlet.ShouldProcess($context.OfficePath, 'Create local office workspace directory')) {
    $null = New-Item -ItemType Directory -Path $context.OfficePath
}
foreach ($desk in $context.Desks) {
    if (Test-Path -LiteralPath $desk.WorkspacePath) {
        Write-Host "Keeping existing workspace: $($desk.WorkspacePath)"
    } elseif ($PSCmdlet.ShouldProcess($desk.WorkspacePath, 'Create VS Code workspace')) {
        [IO.File]::WriteAllText($desk.WorkspacePath, (Get-OfficeWorkspaceText $desk), [Text.UTF8Encoding]::new($false))
    }
}
if (Test-Path -LiteralPath $context.SharedWorkspacePath) {
    Write-Host "Keeping shared office workspace: $($context.SharedWorkspacePath)"
} elseif ($PSCmdlet.ShouldProcess($context.SharedWorkspacePath, 'Create shared VS Code workspace containing all three worktrees')) {
    [IO.File]::WriteAllText($context.SharedWorkspacePath, (Get-OfficeSharedWorkspaceText $context), [Text.UTF8Encoding]::new($false))
}
if ($WhatIfPreference) {
    Write-Host 'Office preview complete. No worktrees or workspace files were changed.'
} else {
    Write-Host 'Office setup complete. New desks start on <agent>/work; existing <agent>/<task> branches are preserved.'
    Write-Host 'Use open.ps1 for the shared office in one window, or status.ps1 to inspect the worktrees.'
}
