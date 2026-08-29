import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import solc from "solc"

export function compileContract() {
  const sourcePath = path.resolve("src/AgentShieldRegistry.sol")
  const source = fs.readFileSync(sourcePath, "utf8")
  const input = {
    language: "Solidity",
    sources: { "AgentShieldRegistry.sol": { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  }

  const output = JSON.parse(solc.compile(JSON.stringify(input)))
  const errors = (output.errors ?? []).filter((entry) => entry.severity === "error")
  if (errors.length) throw new Error(errors.map((entry) => entry.formattedMessage).join("\n"))

  const artifact = output.contracts["AgentShieldRegistry.sol"].AgentShieldRegistry
  if (!artifact?.evm?.bytecode?.object) throw new Error("Compiler returned no deployable bytecode.")
  return { abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}` }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const { abi, bytecode } = compileContract()
  console.log(`AgentShieldRegistry compiled: ${abi.length} ABI entries, ${(bytecode.length - 2) / 2} bytecode bytes`)
}
