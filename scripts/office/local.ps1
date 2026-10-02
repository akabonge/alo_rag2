<#
.SYNOPSIS
Sends a small, private drafting job to a local Ollama model (Phi or Llama desk).
.DESCRIPTION
Runs entirely on this computer through Ollama at 127.0.0.1:11434. Nothing is sent to a
cloud provider. The result is a draft saved under alo-office/local/ with provenance; a
Claude, Codex or Grok desk must check it before anything reaches the repository.

The local desks are slow on this laptop (about 5-8 tokens/second), so input is capped.
They do not edit files, run Git, or act as a source of portfolio facts.
.EXAMPLE
./scripts/office/local.ps1 -Task proofread -Path src/text.html
.EXAMPLE
git diff --stat origin/main | ./scripts/office/local.ps1 -Task commit
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateSet('proofread', 'plain', 'summarize', 'commit')][string]$Task,
    [string]$Path,
    [Parameter(ValueFromPipeline)][string[]]$Text,
    [ValidateSet('phi', 'llama')][string]$Desk,
    [int]$MaxChars = 6000,
    [string]$RepositoryPath = (Join-Path $PSScriptRoot '../..'),
    [string]$OfficePath
)

begin { $piped = [System.Collections.Generic.List[string]]::new() }
process { if ($Text) { $piped.AddRange($Text) } }
end {
    $ErrorActionPreference = 'Stop'
    . (Join-Path $PSScriptRoot 'Office.Common.ps1')
    $context = Get-OfficeContext $RepositoryPath $OfficePath

    $models = @{ phi = 'phi4-mini:latest'; llama = 'llama3.1:8b-instruct-q4_K_M' }
    $tasks = @{
        proofread = @{ Desk = 'phi'; Prompt = 'Proofread the text below. List only real problems: spelling, grammar, repeated words, and any em dash (—). For each, quote the problem and give a fix. Do not change facts, names, numbers or claims. If there are no problems, reply exactly: No issues.' }
        plain     = @{ Desk = 'llama'; Prompt = 'Rewrite the text below in plain, direct English for a general reader. Keep every fact, name, number and claim exactly as given. Do not add information. Do not use em dashes.' }
        summarize = @{ Desk = 'llama'; Prompt = 'Summarize the text below for Alo in at most 5 short bullets: what changed, what was checked, what is still open. Use only what the text says.' }
        commit    = @{ Desk = 'llama'; Prompt = 'Write a Git commit message for the change below: an imperative subject line under 60 characters, a blank line, then 1-3 short body lines. Use only what the input shows. Output only the message.' }
    }
    if (-not $Desk) { $Desk = $tasks[$Task].Desk }
    $model = $models[$Desk]

    if ($Path) {
        $source = (Resolve-Path -LiteralPath $Path).Path
        $inputText = Get-Content -LiteralPath $source -Raw -Encoding utf8
    } elseif ($piped.Count) {
        $source = 'pipeline'
        $inputText = $piped -join "`n"
    } else {
        throw 'Provide -Path or pipe text in.'
    }
    if ([string]::IsNullOrWhiteSpace($inputText)) { throw 'Input is empty.' }
    if ($inputText.Length -gt $MaxChars) {
        throw "Input is $($inputText.Length) characters; the local desks accept $MaxChars. Send a smaller excerpt."
    }

    try {
        $tags = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 5
    } catch {
        throw 'Ollama is not running. Start the Ollama app, then retry.'
    }
    $installed = $tags.models | Where-Object name -eq $model
    if (-not $installed) { throw "Model $model is not installed. Run: ollama pull $model" }

    Write-Host "$Desk desk ($model) is working on '$Task'. This can take a few minutes on this laptop..."
    $body = @{
        model   = $model
        prompt  = "$($tasks[$Task].Prompt)`n`n---`n$inputText`n---"
        stream  = $false
        options = @{ temperature = 0.2; num_ctx = 4096 }
    } | ConvertTo-Json -Depth 4
    $result = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/generate' -Method Post -Body ([Text.Encoding]::UTF8.GetBytes($body)) -ContentType 'application/json' -TimeoutSec 900

    # Small models miss mechanical rules, so the em dash check does not depend on the model.
    $response = $result.response.Trim()
    if ($Task -eq 'proofread') {
        $dashLines = @($inputText -split "`n" | Select-String -SimpleMatch ([string][char]0x2014) | ForEach-Object { "- Line $($_.LineNumber): em dash" })
        if ($dashLines.Count) { $response += "`n`nScript check (not the model):`n" + ($dashLines -join "`n") }
    }

    $outDir = Join-Path $context.OfficePath 'local'
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    $stamp = Get-Date -Format 'yyyy-MM-dd-HHmmss'
    $outFile = Join-Path $outDir "$stamp-$Desk-$Task.md"
    $seconds = [math]::Round($result.total_duration / 1e9, 1)
    $rate = if ($result.eval_duration) { [math]::Round($result.eval_count / ($result.eval_duration / 1e9), 1) } else { 0 }
    $hash = (Get-FileHash -InputStream ([IO.MemoryStream]::new([Text.Encoding]::UTF8.GetBytes($inputText))) -Algorithm SHA256).Hash.Substring(0, 12)
    @"
# Local $Desk desk: $Task

Draft only. A Claude, Codex or Grok desk must verify this before it is used.

- Model: ``$model`` (digest ``$($installed.digest.Substring(0, 12))``), local Ollama, no network provider
- Source: ``$source`` (sha256 ``$hash``, $($inputText.Length) characters)
- Time: $seconds s, $rate tokens/s, $(Get-Date -Format 'yyyy-MM-dd HH:mm')

## Output

$response
"@ | Set-Content -LiteralPath $outFile -Encoding utf8

    Write-Host "Saved: $outFile ($seconds s)"
    $response
}
