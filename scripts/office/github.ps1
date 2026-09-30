<#
.SYNOPSIS
Runs GitHub CLI using the GitHub credential already available to Git.
.DESCRIPTION
The token is held only in the current process environment for the command and is
restored afterward. Nothing is written to a config file or printed by this wrapper.
Existing environment authentication and GitHub CLI sign-in take precedence.
.EXAMPLE
./scripts/office/github.ps1 issue list --repo akabonge/alo_rag2
#>
[CmdletBinding()]
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GhArguments)
$ErrorActionPreference = 'Stop'
$ghCommand = Get-Command gh -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
$ghPath = if ($ghCommand) { $ghCommand.Source } else { Join-Path $env:ProgramFiles 'GitHub CLI/gh.exe' }
if (-not (Test-Path -LiteralPath $ghPath -PathType Leaf)) { throw 'Install GitHub CLI before using this helper.' }
if (-not $GhArguments.Count) { throw 'Supply a GitHub CLI command, for example: issue list --repo akabonge/alo_rag2' }
$previousToken = $env:GH_TOKEN
$credentialOutput = $null
try {
    if (-not $env:GH_TOKEN -and -not $env:GITHUB_TOKEN) {
        & $ghPath auth status --active --hostname github.com *> $null
        $useGitCredential = $LASTEXITCODE -ne 0
    } else {
        $useGitCredential = $false
    }
    if ($useGitCredential) {
        $credentialOutput = @("protocol=https`nhost=github.com`n`n" | git credential fill 2>$null)
        if ($LASTEXITCODE -ne 0) { throw 'GitHub Git sign-in is unavailable. Sign in with GitHub CLI or Git Credential Manager.' }
        $passwordLine = $credentialOutput | Where-Object { $_.StartsWith('password=') } | Select-Object -First 1
        if (-not $passwordLine) { throw 'Git Credential Manager did not return a GitHub credential.' }
        $env:GH_TOKEN = $passwordLine.Substring(9)
        $passwordLine = $null
        $credentialOutput = $null
    }
    & $ghPath @GhArguments
    if ($LASTEXITCODE -ne 0) { throw "GitHub CLI exited with code $LASTEXITCODE." }
} finally {
    $env:GH_TOKEN = $previousToken
    $credentialOutput = $null
}
