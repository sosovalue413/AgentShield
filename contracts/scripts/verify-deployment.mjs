import { Contract, JsonRpcProvider } from "ethers"
import { setTimeout as delay } from "node:timers/promises"

const RPC_URL = process.env.RPC_URL || "https://evmrpc-testnet.0g.ai"
const transactionHash = process.argv[2]?.trim()

if (!/^0x[0-9a-fA-F]{64}$/.test(transactionHash || "")) {
  throw new Error("Pass a deployment transaction hash.")
}

const provider = new JsonRpcProvider(RPC_URL)
let receipt = null
for (let attempt = 1; attempt <= 12 && !receipt; attempt += 1) {
  try {
    receipt = await provider.getTransactionReceipt(transactionHash)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.log(`Receipt check ${attempt}/12: ${message.includes("no matching receipts") ? "indexing" : "RPC unavailable"}`)
  }
  if (!receipt) await delay(5_000)
}

if (!receipt) throw new Error("The transaction is still pending or unavailable after 60 seconds.")
if (receipt.status !== 1) throw new Error("The deployment transaction reverted.")
if (!receipt.contractAddress) throw new Error("The transaction did not create a contract.")

const code = await provider.getCode(receipt.contractAddress)
if (code === "0x") throw new Error("No contract bytecode exists at the receipt address.")
const registry = new Contract(receipt.contractAddress, ["function VERSION() view returns (uint16)"], provider)
const version = await registry.VERSION()

console.log(`AgentShieldRegistry: ${receipt.contractAddress}`)
console.log(`Version: ${version}`)
console.log(`VERSION selector: ${registry.interface.getFunction("VERSION").selector}`)
console.log(`Explorer: https://chainscan-galileo.0g.ai/address/${receipt.contractAddress}`)
