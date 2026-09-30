Set-StrictMode -Version Latest

function Invoke-OfficeGit {
    param(
        [Parameter(Mandatory)][string]$RepositoryPath,
        [Parameter(Mandatory)][string[]]$Arguments,
        [int[]]$AllowedExitCodes = @(0)
    )

    # Always inspect native exit codes, including on Windows PowerShell 5.1.
    $ErrorActionPreference = 'Continue'
    $PSNativeCommandUseErrorActionPreference = $false
    $output = @(& git -C $RepositoryPath @Arguments 2>&1)
    $exitCode = $LASTEXITCODE
    if ($exitCode -notin $AllowedExitCodes) {
        throw "git $($Arguments -join ' ') failed ($exitCode): $($output -join [Environment]::NewLine)"
    }
    [pscustomobject]@{
        ExitCode = $exitCode
        Output = @($output | ForEach-Object { $_.ToString() })
    }
}

function Get-OfficeFullPath {
    param([Parameter(Mandatory)][string]$Path)
    [IO.Path]::GetFullPath($Path).TrimEnd([char[]]'\/')
}

function Test-OfficeSamePath {
    param([Parameter(Mandatory)][string]$First, [Parameter(Mandatory)][string]$Second)
    [string]::Equals((Get-OfficeFullPath $First), (Get-OfficeFullPath $Second), [StringComparison]::OrdinalIgnoreCase)
}

function Get-OfficeContext {
    param([Parameter(Mandatory)][string]$RepositoryPath, [string]$OfficePath)

    if (-not (Get-Command git -CommandType Application -ErrorAction SilentlyContinue)) {
        throw 'Git is required. Install Git for Windows and restart your terminal.'
    }
    $repository = Get-OfficeFullPath $RepositoryPath
    if (-not (Test-Path -LiteralPath $repository -PathType Container)) {
        throw "Repository folder does not exist: $repository"
    }
    $topLevel = (Invoke-OfficeGit $repository @('rev-parse', '--show-toplevel')).Output -join ''
    if (-not (Test-OfficeSamePath $repository $topLevel)) {
        throw "RepositoryPath must be the repository root: $topLevel"
    }
    $commonDir = (Invoke-OfficeGit $repository @('rev-parse', '--path-format=absolute', '--git-common-dir')).Output -join ''
    $parent = Split-Path -Parent $repository
    if (-not $OfficePath) { $OfficePath = Join-Path $parent 'alo-office' }
    $office = Get-OfficeFullPath $OfficePath
    $desks = @(
        [pscustomobject]@{ Name = 'Claude'; Slug = 'claude'; Branch = 'claude/work'; Color = '#6b402e'; Extension = 'anthropic.claude-code' },
        [pscustomobject]@{ Name = 'Codex'; Slug = 'codex'; Branch = 'codex/work'; Color = '#195a50'; Extension = 'openai.chatgpt' },
        [pscustomobject]@{ Name = 'Grok'; Slug = 'grok'; Branch = 'grok/work'; Color = '#37416c'; Extension = 'saoudrizwan.claude-dev' }
    ) | ForEach-Object {
        $_ | Add-Member NoteProperty Path (Join-Path $parent "alo-$($_.Slug)") -PassThru |
            Add-Member NoteProperty WorkspacePath (Join-Path $office "alo-$($_.Slug).code-workspace") -PassThru |
            Add-Member NoteProperty Profile "Alo $($_.Name)" -PassThru
    }
    [pscustomobject]@{
        RepositoryPath = $repository
        CommonDir = $commonDir
        OfficePath = $office
        SharedWorkspacePath = Join-Path $office 'Alo Office.code-workspace'
        Desks = @($desks)
    }
}

function Assert-OfficeWorktree {
    param([Parameter(Mandatory)]$Context, [Parameter(Mandatory)]$Desk, [switch]$PassThru)

    if (-not (Test-Path -LiteralPath $Desk.Path -PathType Container)) {
        throw "Expected worktree folder is missing: $($Desk.Path). Run setup.ps1 first."
    }
    $actualRoot = (Invoke-OfficeGit $Desk.Path @('rev-parse', '--show-toplevel')).Output -join ''
    $actualCommon = (Invoke-OfficeGit $Desk.Path @('rev-parse', '--path-format=absolute', '--git-common-dir')).Output -join ''
    $branchResult = Invoke-OfficeGit $Desk.Path @('symbolic-ref', '--quiet', '--short', 'HEAD') @(0, 1)
    $actualBranch = $branchResult.Output -join ''
    if (-not (Test-OfficeSamePath $Desk.Path $actualRoot) -or
        -not (Test-OfficeSamePath $Context.CommonDir $actualCommon) -or
        $branchResult.ExitCode -ne 0 -or -not $actualBranch.StartsWith("$($Desk.Slug)/", [StringComparison]::Ordinal)) {
        throw "Refusing unexpected folder/worktree at $($Desk.Path). Expected this repository on a $($Desk.Slug)/* branch; found root '$actualRoot', common Git directory '$actualCommon', branch '$actualBranch'. No files were reset or removed."
    }
    if ($PassThru) { $actualBranch }
}

function Get-OfficeWorkspaceText {
    param([Parameter(Mandatory)]$Desk)
    $workspace = [ordered]@{
        folders = @([ordered]@{ name = "Alo $($Desk.Name)"; path = $Desk.Path })
        settings = [ordered]@{
            'window.title' = "Alo $($Desk.Name) | " + '${rootName}${separator}${activeEditorShort}'
            'workbench.colorCustomizations' = [ordered]@{
                'titleBar.activeBackground' = $Desk.Color
                'titleBar.activeForeground' = '#ffffff'
                'activityBar.background' = $Desk.Color
            }
            'git.autofetch' = $false
        }
        extensions = [ordered]@{ recommendations = @($Desk.Extension) }
    }
    ($workspace | ConvertTo-Json -Depth 6) + [Environment]::NewLine
}

function Assert-OfficeWorkspace {
    param([Parameter(Mandatory)]$Desk)
    if (-not (Test-Path -LiteralPath $Desk.WorkspacePath -PathType Leaf)) {
        throw "Workspace file is missing: $($Desk.WorkspacePath). Run setup.ps1 first."
    }
    try { $workspace = Get-Content -LiteralPath $Desk.WorkspacePath -Raw | ConvertFrom-Json }
    catch { throw "Cannot read existing workspace JSON at $($Desk.WorkspacePath): $_" }
    if (@($workspace.folders).Count -ne 1 -or
        -not (Test-OfficeSamePath $workspace.folders[0].path $Desk.Path)) {
        throw "Workspace $($Desk.WorkspacePath) points elsewhere. Refusing to overwrite or open it."
    }
}

function Get-OfficeSharedWorkspaceText {
    param([Parameter(Mandatory)]$Context)
    # Cline uses the first workspace root for rules and Git context.
    $orderedDesks = @($Context.Desks | Where-Object Slug -eq 'grok') + @($Context.Desks | Where-Object Slug -ne 'grok')
    $workspace = [ordered]@{
        folders = @($orderedDesks | ForEach-Object {
            [ordered]@{ name = "Alo $($_.Name)"; path = $_.Path }
        })
        settings = [ordered]@{
            'window.title' = 'Alo Office | ${activeEditorShort}${separator}${rootName}'
            'workbench.colorCustomizations' = [ordered]@{
                'titleBar.activeBackground' = '#24384b'
                'titleBar.activeForeground' = '#ffffff'
                'activityBar.background' = '#24384b'
            }
            'git.autofetch' = $false
        }
        extensions = [ordered]@{ recommendations = @($Context.Desks | ForEach-Object { $_.Extension }) }
    }
    ($workspace | ConvertTo-Json -Depth 6) + [Environment]::NewLine
}

function Assert-OfficeSharedWorkspace {
    param([Parameter(Mandatory)]$Context)
    if (-not (Test-Path -LiteralPath $Context.SharedWorkspacePath -PathType Leaf)) {
        throw "Shared office workspace is missing: $($Context.SharedWorkspacePath). Run setup.ps1 first."
    }
    try { $workspace = Get-Content -LiteralPath $Context.SharedWorkspacePath -Raw | ConvertFrom-Json }
    catch { throw "Cannot read shared workspace JSON at $($Context.SharedWorkspacePath): $_" }
    if (@($workspace.folders).Count -ne $Context.Desks.Count) {
        throw "Shared workspace must contain exactly the three office worktrees. Refusing to overwrite or open $($Context.SharedWorkspacePath)."
    }
    foreach ($desk in $Context.Desks) {
        $matchingFolders = @($workspace.folders | Where-Object { Test-OfficeSamePath $_.path $desk.Path })
        if ($matchingFolders.Count -ne 1) {
            throw "Shared workspace does not contain exactly one $($desk.Name) worktree at $($desk.Path). Refusing to overwrite or open it."
        }
    }
}
