import { ContractFactory, JsonRpcProvider, Wallet, formatEther } from "ethers"
import { createInterface } from "node:readline/promises"
import { compileContract } from "./compile.mjs"

const EXPECTED_CHAIN_ID = 16602n
const RPC_URL = process.env.RPC_URL || "https://evmrpc-testnet.0g.ai"
let rawPrivateKey = process.env.PRIVATE_KEY?.trim()

if (!rawPrivateKey) {
  const prompt = createInterface({ input: process.stdin, output: process.stderr, terminal: false })
  rawPrivateKey = (await prompt.question("Private key (input is not stored): ")).trim()
  prompt.close()
}

if (!rawPrivateKey || !/^(0x)?[0-9a-fA-F]{64}$/.test(rawPrivateKey)) {
  throw new Error("Set a valid PRIVATE_KEY in the process environment. Do not commit it to a file.")
}

const provider = new JsonRpcProvider(RPC_URL)
const network = await provider.getNetwork()
if (network.chainId !== EXPECTED_CHAIN_ID) {
  throw new Error(`Refusing to deploy to chain ${network.chainId}; expected 0G Galileo ${EXPECTED_CHAIN_ID}.`)
}

const wallet = new Wallet(rawPrivateKey.startsWith("0x") ? rawPrivateKey : `0x${rawPrivateKey}`, provider)
const balance = await provider.getBalance(wallet.address)
console.log(`Deployer: ${wallet.address}`)
console.log(`Balance: ${formatEther(balance)} 0G`)
if (balance === 0n) throw new Error("The deployer has no 0G testnet funds. Fund it from https://faucet.0g.ai first.")

const { abi, bytecode } = compileContract()
const factory = new ContractFactory(abi, bytecode, wallet)
const contract = await factory.deploy()
const deploymentTx = contract.deploymentTransaction()
console.log(`Deployment transaction: ${deploymentTx.hash}`)
await contract.waitForDeployment()

const address = await contract.getAddress()
console.log(`AgentShieldRegistry: ${address}`)
console.log(`Explorer: https://chainscan-galileo.0g.ai/address/${address}`)
