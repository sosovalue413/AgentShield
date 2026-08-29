$agentShieldSecret = Read-Host -Prompt "0G testnet private key" -AsSecureString
$agentShieldPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($agentShieldSecret)

try {
    $env:PRIVATE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($agentShieldPointer)
    npm run deploy:testnet
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($agentShieldPointer)
    Remove-Item Env:PRIVATE_KEY -ErrorAction SilentlyContinue
}
