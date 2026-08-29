"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { BrowserProvider, Contract, JsonRpcProvider, ZeroAddress, formatUnits, getAddress, id, isAddress, keccak256, parseUnits, toUtf8Bytes, verifyMessage } from "ethers"
import { encodeErc20Call, evaluateGuard, normalizeProtocolAddresses, parseNativeValue, parseTokenValue, type Decision, type GuardForm } from "@/lib/guard"
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Copy,
  ExternalLink,
  Fingerprint,
  Gauge,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
  Zap,
} from "lucide-react"

type Tab = "overview" | "agents" | "guard" | "policies" | "activity"

type Agent = {
  id: string
  name: string
  purpose: string
  wallet: string
  trust: number
  maxTransaction: number
  dailyBudget: number
  usedToday: number
  spendingDay: string
  protocols: string[]
  syncedProtocols: string[]
  status: "PROTECTED" | "REVIEW"
  active: boolean
  onchainPolicySynced: boolean
}

type ActivityItem = {
  id: string
  createdAt: string
  agent: string
  action: string
  amount: number
  asset: string
  destination: string
  risk: number
  decision: Decision
  reasons: string[]
  txHash?: string
  decisionTxHash?: string
  txStatus?: "LOCAL" | "DECISION_RECORDED" | "SUBMITTED" | "CONFIRMED" | "REVERTED" | "UNKNOWN"
  approvalSignature?: string
}

type GuardResult = {
  activityId: string
  risk: number
  decision: Decision
  reasons: string[]
  input: GuardForm
}

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    ethereum?: EthereumProvider
  }
}

const STORAGE_KEY = "agentshield-console-v2"
const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_AGENTSHIELD_REGISTRY?.trim()
const REGISTRY_ABI = [
  "function registerAgent(bytes32 agentId, uint128 maxTransaction, uint128 dailyBudget)",
  "function updatePolicy(bytes32 agentId, uint128 maxTransaction, uint128 dailyBudget, bool active)",
  "function setProtocolAllowed(bytes32 agentId, address protocol, bool allowed)",
  "function previewDecision(bytes32 agentId, address protocol, uint256 amount, uint8 risk) view returns (bool allowed)",
  "function recordDecision(bytes32 decisionId, bytes32 agentId, address destination, address protocol, uint256 amount, uint8 risk, bytes32 reportHash) returns (bool allowed)",
  "function allowedProtocols(bytes32 agentId, address protocol) view returns (bool allowed)",
  "function policies(bytes32 agentId) view returns (address owner, uint128 maxTransaction, uint128 dailyBudget, uint128 spentToday, uint64 spendingDay, bool active)",
] as const
const TESTNET = {
  chainId: "0x40da",
  name: "0G-Galileo-Testnet",
  rpcUrl: "https://evmrpc-testnet.0g.ai",
  explorer: "https://chainscan-galileo.0g.ai",
  symbol: "0G",
  faucet: "https://faucet.0g.ai",
}

const INITIAL_AGENTS: Agent[] = []
const INITIAL_ACTIVITY: ActivityItem[] = []
const currentSpendingDay = () => new Date().toISOString().slice(0, 10)

const EMPTY_GUARD: GuardForm = {
  amount: "",
  asset: "0G",
  destination: "",
  action: "transfer",
  instruction: "",
  protocol: "",
  tokenContract: "",
  tokenDecimals: "6",
  calldata: "0x",
  unlimitedApproval: false,
}

const ease = [0.22, 1, 0.36, 1] as const

function shortAddress(value: string) {
  if (value.length < 12) return value
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

function statusTone(decision: Decision) {
  if (decision === "ALLOWED") return "text-[#3f6212] border-[#3f6212]"
  if (decision === "REVIEW") return "text-[#a16207] border-[#a16207]"
  return "text-[#b91c1c] border-[#b91c1c]"
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="border-2 border-foreground bg-background px-4 py-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight" style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </p>
      {detail && <p className="mt-1 text-[10px] text-muted-foreground">{detail}</p>}
    </div>
  )
}

function SectionLabel({ children, index }: { children: React.ReactNode; index: string }) {
  return (
    <div className="mb-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
      <span>{children}</span>
      <div className="h-px flex-1 bg-border" />
      <span>{index}</span>
    </div>
  )
}

function DecisionBadge({ decision }: { decision: Decision }) {
  return <span className={`border px-2 py-1 text-[10px] font-bold tracking-[0.13em] ${statusTone(decision)}`}>{decision}</span>
}

export function AgentShieldConsole() {
  const [tab, setTab] = useState<Tab>("overview")
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS)
  const [activity, setActivity] = useState<ActivityItem[]>(INITIAL_ACTIVITY)
  const [activeAgentId, setActiveAgentId] = useState("")
  const [guardForm, setGuardForm] = useState<GuardForm>(EMPTY_GUARD)
  const [guardResult, setGuardResult] = useState<GuardResult | null>(null)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [network, setNetwork] = useState<string | null>(null)
  const [walletMessage, setWalletMessage] = useState("")
  const [copied, setCopied] = useState(false)
  const [registeringAgentId, setRegisteringAgentId] = useState<string | null>(null)
  const [syncingPolicyId, setSyncingPolicyId] = useState<string | null>(null)
  const [approvingReview, setApprovingReview] = useState(false)
  const [registeredAgentIds, setRegisteredAgentIds] = useState<string[]>([])
  const [showAgentForm, setShowAgentForm] = useState(false)
  const [agentDraft, setAgentDraft] = useState({ name: "", purpose: "", maxTransaction: "25", dailyBudget: "100" })
  const [agentFormError, setAgentFormError] = useState("")
  const [hydrated, setHydrated] = useState(false)

  const activeAgent = agents.find((agent) => agent.id === activeAgentId) ?? agents[0]
  const checkedCount = activity.length
  const blockedCount = activity.filter((item) => item.decision === "BLOCKED").length
  const protectedFunds = agents.reduce((sum, agent) => sum + Math.max(agent.dailyBudget - agent.usedToday, 0), 0)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as { agents?: Agent[]; activity?: ActivityItem[] }
        if (saved.agents?.length) {
          const today = currentSpendingDay()
          const migratedAgents = saved.agents.map((agent) => ({
            ...agent,
            active: agent.active ?? true,
            spendingDay: agent.spendingDay ?? today,
            usedToday: !agent.spendingDay || agent.spendingDay === today ? agent.usedToday : 0,
            syncedProtocols: agent.syncedProtocols ?? [],
            onchainPolicySynced: agent.onchainPolicySynced ?? false,
          }))
          setAgents(migratedAgents)
          setActiveAgentId(migratedAgents[0].id)
        }
        if (saved.activity?.length) setActivity(saved.activity)
      }
    } catch {
      // A malformed local session should not prevent the console from loading.
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ agents, activity }))
  }, [agents, activity, hydrated])

  useEffect(() => {
    if (!hydrated) return
    const resetExpiredBudget = () => {
      const today = currentSpendingDay()
      setAgents((current) => current.map((agent) => agent.spendingDay === today ? agent : { ...agent, usedToday: 0, spendingDay: today }))
    }
    resetExpiredBudget()
    const timer = window.setInterval(resetExpiredBudget, 60_000)
    return () => window.clearInterval(timer)
  }, [hydrated])

  useEffect(() => {
    const provider = window.ethereum
    if (!provider) return
    const handleAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined
      setWalletAddress(accounts?.[0] ?? null)
    }
    const handleChain = (...args: unknown[]) => setNetwork(String(args[0] ?? ""))
    void Promise.all([
      provider.request({ method: "eth_accounts" }),
      provider.request({ method: "eth_chainId" }),
    ]).then(([accounts, chain]) => {
      setWalletAddress((accounts as string[])[0] ?? null)
      setNetwork(String(chain ?? ""))
    }).catch(() => {
      // Wallet discovery is best-effort and never prompts the user.
    })
    provider.on?.("accountsChanged", handleAccounts)
    provider.on?.("chainChanged", handleChain)
    return () => {
      provider.removeListener?.("accountsChanged", handleAccounts)
      provider.removeListener?.("chainChanged", handleChain)
    }
  }, [])

  const agentIdsKey = agents.map((agent) => agent.id).join("|")

  useEffect(() => {
    if (!hydrated || !REGISTRY_ADDRESS || !agents.length) {
      if (!agents.length) setRegisteredAgentIds([])
      return
    }

    let cancelled = false
    const restoreOnchainState = async () => {
      try {
        const provider = new JsonRpcProvider(TESTNET.rpcUrl)
        const registry = new Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider)
        const entries = await Promise.all(agents.map(async (agent) => {
          const policy = await registry.policies(id(agent.id))
          if (policy.owner === ZeroAddress) return null
          const protocolChecks = await Promise.all(agent.protocols.map((protocol) => registry.allowedProtocols(id(agent.id), protocol)))
          const maxTransaction = Number(formatUnits(policy.maxTransaction, 6))
          const dailyBudget = Number(formatUnits(policy.dailyBudget, 6))
          const currentChainDay = BigInt(Math.floor(Date.now() / 86_400_000))
          const usedToday = policy.spendingDay === currentChainDay ? Number(formatUnits(policy.spentToday, 6)) : 0
          const limitsMatch = agent.maxTransaction === maxTransaction && agent.dailyBudget === dailyBudget && agent.active === policy.active
          return {
            agentId: agent.id,
            owner: String(policy.owner),
            maxTransaction,
            dailyBudget,
            usedToday,
            active: Boolean(policy.active),
            protocolsSynced: agent.protocols.length > 0 && protocolChecks.every(Boolean),
            limitsMatch,
          }
        }))
        if (!cancelled) {
          const registered = entries.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
          setRegisteredAgentIds(registered.map((entry) => entry.agentId))
          setAgents((current) => current.map((agent) => {
            const onchain = registered.find((entry) => entry.agentId === agent.id)
            if (!onchain) return { ...agent, onchainPolicySynced: false }
            return {
              ...agent,
              wallet: shortAddress(onchain.owner),
              usedToday: onchain.usedToday,
              spendingDay: currentSpendingDay(),
              onchainPolicySynced: onchain.limitsMatch && onchain.protocolsSynced,
            }
          }))
        }
      } catch {
        if (!cancelled) setWalletMessage("Could not refresh registry state. Local policies are still available.")
      }
    }
    void restoreOnchainState()
    return () => { cancelled = true }
  }, [agentIdsKey, hydrated])

  const connectWallet = async () => {
    setWalletMessage("")
    if (!window.ethereum) {
      setWalletMessage("No injected wallet found. Install MetaMask or Rabby to connect.")
      return
    }
    try {
      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[]
      const chain = String(await window.ethereum.request({ method: "eth_chainId" }))
      setWalletAddress(accounts[0] ?? null)
      setNetwork(chain)
      if (chain !== TESTNET.chainId) setWalletMessage("Wallet connected. Switch to 0G Galileo Testnet before executing.")
    } catch (error) {
      setWalletMessage(error instanceof Error ? error.message : "Wallet connection was cancelled.")
    }
  }

  const switchNetwork = async () => {
    if (!window.ethereum) {
      setWalletMessage("Connect an injected wallet first.")
      return
    }
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: TESTNET.chainId }] })
    } catch (error) {
      const code = (error as { code?: number }).code
      if (code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: TESTNET.chainId,
              chainName: TESTNET.name,
              nativeCurrency: { name: TESTNET.symbol, symbol: TESTNET.symbol, decimals: 18 },
              rpcUrls: [TESTNET.rpcUrl],
              blockExplorerUrls: [TESTNET.explorer],
            }],
          })
        } catch {
          setWalletMessage("Adding the 0G Galileo network was cancelled.")
          return
        }
      } else {
        setWalletMessage("Network switch was cancelled.")
        return
      }
    }
    const activeChain = String(await window.ethereum.request({ method: "eth_chainId" }))
    setNetwork(activeChain)
    setWalletMessage(activeChain === TESTNET.chainId ? "0G Galileo Testnet is ready." : "Wallet is connected to a different network.")
  }

  const runGuard = () => {
    if (!activeAgent) return
    const result = evaluateGuard(guardForm, activeAgent)
    const activityId = `evt-${Date.now()}`
    setGuardResult({ ...result, activityId, input: guardForm })
    const activityItem: ActivityItem = {
      id: activityId,
      createdAt: new Date().toISOString(),
      agent: activeAgent.name,
      action: guardForm.action === "approve" ? "Approve" : guardForm.action === "contract" ? "Contract call" : "Transfer",
      amount: Number(guardForm.amount) || 0,
      asset: guardForm.asset,
      destination: guardForm.destination ? shortAddress(guardForm.destination) : "Unresolved destination",
      risk: result.risk,
      decision: result.decision,
      reasons: result.reasons,
      txStatus: "LOCAL",
    }
    setActivity((current) => [activityItem, ...current].slice(0, 30))
    setAgents((current) => current.map((agent) => agent.id === activeAgent.id
      ? { ...agent, trust: Math.max(0, Math.min(100, Math.round((agent.trust * 3 + (100 - result.risk)) / 4))) }
      : agent))
    setTab("guard")
  }

  const approveReview = async () => {
    if (!guardResult || !activeAgent) return
    if (!window.ethereum || !walletAddress) {
      setWalletMessage("Connect the agent owner wallet to approve this action.")
      return
    }
    if (network !== TESTNET.chainId) {
      setWalletMessage("Switch to 0G Galileo Testnet before approving this action.")
      return
    }
    setApprovingReview(true)
    try {
      const provider = new BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const message = [
        "AgentShield one-time approval",
        `Chain: ${parseInt(TESTNET.chainId, 16)}`,
        `Agent: ${activeAgent.id}`,
        `Decision: ${guardResult.activityId}`,
        `Action hash: ${keccak256(toUtf8Bytes(JSON.stringify(guardResult.input)))}`,
      ].join("\n")
      const signature = await signer.signMessage(message)
      if (verifyMessage(message, signature).toLowerCase() !== walletAddress.toLowerCase()) throw new Error("The approval signature does not match the connected wallet.")
      setGuardResult({ ...guardResult, decision: "ALLOWED", risk: Math.min(guardResult.risk, 34) })
      setActivity((current) => current.map((item) => item.id === guardResult.activityId ? { ...item, decision: "ALLOWED", risk: Math.min(item.risk, 34), reasons: [...item.reasons, "Approved once by wallet owner"], approvalSignature: signature } : item))
      setWalletMessage("One-time wallet approval verified.")
    } catch (error) {
      setWalletMessage(error instanceof Error ? error.message : "The wallet approval was cancelled.")
    } finally {
      setApprovingReview(false)
    }
  }

  const executeTransaction = async () => {
    if (!guardResult || guardResult.decision === "BLOCKED") return
    const destination = guardResult.input.destination.trim()
    if (!/^0x[a-fA-F0-9]{40}$/.test(destination)) {
      setWalletMessage("Add a valid destination address before executing.")
      return
    }
    if (!window.ethereum || !walletAddress) {
      setWalletMessage("Connect a wallet to execute. The guard result is saved locally until then.")
      return
    }
    if (network !== TESTNET.chainId) {
      setWalletMessage("Switch to 0G Galileo Testnet before executing.")
      return
    }
    if (!REGISTRY_ADDRESS || !registeredAgentIds.includes(activeAgent.id)) {
      setWalletMessage("Register this agent on 0G before executing an action.")
      return
    }
    if (!activeAgent.onchainPolicySynced) {
      setWalletMessage("Sync this agent policy and protocol allowlist to 0G before executing.")
      return
    }
    try {
      const input = guardResult.input
      let transaction: Record<string, string>

      if (input.action === "contract") {
        transaction = {
          from: walletAddress,
          to: destination,
          value: input.asset === "0G" ? parseNativeValue(input.amount) : "0x0",
          data: input.calldata,
        }
      } else if (input.asset === "0G") {
        transaction = { from: walletAddress, to: destination, value: parseNativeValue(input.amount) }
      } else {
        const decimals = Number(input.tokenDecimals)
        const units = parseTokenValue(input.amount, decimals)
        transaction = {
          from: walletAddress,
          to: input.tokenContract.trim(),
          value: "0x0",
          data: encodeErc20Call(input.action, destination, units),
        }
      }

      try {
        await window.ethereum.request({ method: "eth_estimateGas", params: [transaction] })
      } catch (simulationError) {
        const detail = simulationError instanceof Error ? simulationError.message : "The request would revert."
        setWalletMessage(`Preflight simulation failed. No transaction was sent. ${detail}`)
        return
      }

      const protocol = getAddress(input.protocol.trim())
      const policyAmount = parseTokenValue(input.amount || "0", 6)
      const provider = new BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const registry = new Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer)
      const allowedOnchain = await registry.previewDecision(id(activeAgent.id), protocol, policyAmount, guardResult.risk)
      if (!allowedOnchain) {
        setWalletMessage("The onchain policy rejected this action. Refresh the policy before trying again.")
        return
      }

      const reportHash = keccak256(toUtf8Bytes(JSON.stringify({
        agentId: activeAgent.id,
        activityId: guardResult.activityId,
        input,
        risk: guardResult.risk,
        decision: guardResult.decision,
      })))
      setWalletMessage("Preflight passed. Confirm the onchain security decision in your wallet.")
      const decisionTransaction = await registry.recordDecision(
        id(`${activeAgent.id}:${guardResult.activityId}`),
        id(activeAgent.id),
        getAddress(destination),
        protocol,
        policyAmount,
        guardResult.risk,
        reportHash,
      )
      const decisionReceipt = await decisionTransaction.wait()
      if (!decisionReceipt || decisionReceipt.status !== 1) throw new Error("The onchain decision transaction did not confirm.")
      setActivity((current) => current.map((item) => item.id === guardResult.activityId ? { ...item, decisionTxHash: decisionTransaction.hash, txStatus: "DECISION_RECORDED" } : item))
      setWalletMessage("Decision recorded on 0G. Confirm the guarded transaction in your wallet.")

      const txHash = String(await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [transaction],
      }))
      setActivity((current) => current.map((item) => item.id === guardResult.activityId ? { ...item, decision: "ALLOWED", txHash, txStatus: "SUBMITTED" } : item))
      setWalletMessage("Preflight passed and the transaction was submitted. Waiting for 0G confirmation.")

      try {
        const receipt = await provider.waitForTransaction(txHash, 1, 60_000)
        if (receipt?.status === 1) {
          const spentAmount = Number(input.amount) || 0
          setAgents((current) => current.map((agent) => agent.id === activeAgentId
            ? { ...agent, usedToday: Math.min(agent.dailyBudget, agent.usedToday + spentAmount), spendingDay: currentSpendingDay() }
            : agent))
          setActivity((current) => current.map((item) => item.id === guardResult.activityId ? { ...item, txStatus: "CONFIRMED" } : item))
          setWalletMessage("Transaction confirmed on 0G. The onchain and local budgets are updated.")
        } else if (receipt?.status === 0) {
          setActivity((current) => current.map((item) => item.id === guardResult.activityId ? { ...item, txStatus: "REVERTED" } : item))
          setWalletMessage("The guarded transaction reverted. Its security decision remains recorded onchain.")
        }
      } catch {
        setActivity((current) => current.map((item) => item.id === guardResult.activityId ? { ...item, txStatus: "UNKNOWN" } : item))
        setWalletMessage("Transaction submitted to 0G. Confirmation is taking longer than expected; follow it on ChainScan.")
      }
    } catch (error) {
      setWalletMessage(error instanceof Error ? error.message : "Transaction was rejected by the wallet.")
    }
  }

  const addAgent = () => {
    setAgentFormError("")
    const name = agentDraft.name.trim()
    const purpose = agentDraft.purpose.trim()
    const maxTransaction = Number(agentDraft.maxTransaction)
    const dailyBudget = Number(agentDraft.dailyBudget)
    if (!name || !purpose) {
      setAgentFormError("Add an agent name and a clear purpose.")
      return
    }
    if (!Number.isFinite(maxTransaction) || !Number.isFinite(dailyBudget) || maxTransaction <= 0 || dailyBudget <= 0) {
      setAgentFormError("Transaction and daily limits must be positive numbers.")
      return
    }
    if (dailyBudget < maxTransaction) {
      setAgentFormError("Daily budget must be greater than or equal to the maximum transaction.")
      return
    }
    const newAgent: Agent = {
      id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
      name,
      purpose,
      wallet: walletAddress ? shortAddress(walletAddress) : "Connect wallet",
      trust: 100,
      maxTransaction,
      dailyBudget,
      usedToday: 0,
      spendingDay: currentSpendingDay(),
      protocols: [],
      syncedProtocols: [],
      status: "PROTECTED",
      active: true,
      onchainPolicySynced: false,
    }
    setAgents((current) => [...current, newAgent])
    setActiveAgentId(newAgent.id)
    setAgentDraft({ name: "", purpose: "", maxTransaction: "25", dailyBudget: "100" })
    setAgentFormError("")
    setShowAgentForm(false)
    setTab("agents")
  }

  const registerAgentOnchain = async (agent: Agent) => {
    if (!REGISTRY_ADDRESS) {
      setWalletMessage("The 0G registry address is not configured for this deployment.")
      return
    }
    if (!window.ethereum || !walletAddress) {
      setWalletMessage("Connect a wallet before registering an agent on 0G.")
      return
    }
    if (network !== TESTNET.chainId) {
      setWalletMessage("Switch to 0G Galileo Testnet before registering an agent.")
      return
    }

    setRegisteringAgentId(agent.id)
    setWalletMessage("Confirm the registry transaction in your wallet.")
    try {
      const provider = new BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const registry = new Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer)
      const transaction = await registry.registerAgent(
        id(agent.id),
        parseUnits(String(agent.maxTransaction), 6),
        parseUnits(String(agent.dailyBudget), 6),
      )
      setWalletMessage("Agent registration submitted. Waiting for 0G confirmation.")
      await transaction.wait()
      setRegisteredAgentIds((current) => current.includes(agent.id) ? current : [...current, agent.id])
      setAgents((current) => current.map((entry) => entry.id === agent.id ? { ...entry, wallet: shortAddress(walletAddress), onchainPolicySynced: false } : entry))
      setWalletMessage(`“${agent.name}” is registered. Add protocol addresses and sync its policy before execution.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "The registry transaction failed."
      setWalletMessage(message.includes("AgentAlreadyRegistered") ? "This agent ID is already registered by a wallet." : message)
    } finally {
      setRegisteringAgentId(null)
    }
  }

  const updateLocalPolicy = (agentId: string, maxTransaction: number, dailyBudget: number, active: boolean, protocols: string[]) => {
    if (!Number.isFinite(maxTransaction) || !Number.isFinite(dailyBudget) || maxTransaction <= 0 || dailyBudget < maxTransaction) {
      setWalletMessage("Policy not saved. Daily budget must cover at least one maximum transaction.")
      return false
    }
    let normalizedProtocols: string[]
    try {
      normalizedProtocols = normalizeProtocolAddresses(protocols)
    } catch (error) {
      setWalletMessage(error instanceof Error ? error.message : "Protocol addresses are invalid.")
      return false
    }
    if (!normalizedProtocols.length) {
      setWalletMessage("Add at least one approved protocol address before saving the policy.")
      return false
    }
    setAgents((current) => current.map((agent) => agent.id === agentId
      ? { ...agent, maxTransaction, dailyBudget, active, protocols: normalizedProtocols, status: active ? "PROTECTED" : "REVIEW", onchainPolicySynced: false }
      : agent))
    setWalletMessage("Local policy saved.")
    return true
  }

  const syncPolicyOnchain = async (agent: Agent) => {
    if (!REGISTRY_ADDRESS || !registeredAgentIds.includes(agent.id)) {
      setWalletMessage("Register this agent on 0G before syncing its policy.")
      return
    }
    if (!window.ethereum || !walletAddress) {
      setWalletMessage("Connect the agent owner wallet before syncing a policy.")
      return
    }
    if (network !== TESTNET.chainId) {
      setWalletMessage("Switch to 0G Galileo Testnet before syncing a policy.")
      return
    }

    if (!agent.protocols.length) {
      setWalletMessage("Add at least one approved protocol address before syncing.")
      return
    }

    setSyncingPolicyId(agent.id)
    setWalletMessage("Confirm the policy update and protocol permissions in your wallet.")
    try {
      const provider = new BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const registry = new Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer)
      const transaction = await registry.updatePolicy(
        id(agent.id),
        parseUnits(String(agent.maxTransaction), 6),
        parseUnits(String(agent.dailyBudget), 6),
        agent.active,
      )
      setWalletMessage("Policy update submitted. Waiting for 0G confirmation.")
      await transaction.wait()
      const currentProtocols = new Set(agent.protocols.map((protocol) => protocol.toLowerCase()))
      const permissions = [...new Set([...agent.syncedProtocols, ...agent.protocols])]
      for (const protocol of permissions) {
        const shouldAllow = currentProtocols.has(protocol.toLowerCase())
        const permissionTransaction = await registry.setProtocolAllowed(id(agent.id), protocol, shouldAllow)
        setWalletMessage(`Updating protocol permissions on 0G (${permissions.indexOf(protocol) + 1}/${permissions.length}).`)
        await permissionTransaction.wait()
      }
      setAgents((current) => current.map((entry) => entry.id === agent.id ? { ...entry, syncedProtocols: [...agent.protocols], onchainPolicySynced: true } : entry))
      setWalletMessage(`“${agent.name}” policy and protocol permissions are synchronized with 0G.`)
    } catch (error) {
      setWalletMessage(error instanceof Error ? error.message : "The policy update failed.")
    } finally {
      setSyncingPolicyId(null)
    }
  }

  const clearWorkspace = () => {
    setAgents([])
    setActivity([])
    setActiveAgentId("")
    setGuardResult(null)
    setRegisteredAgentIds([])
    window.localStorage.removeItem(STORAGE_KEY)
    setWalletMessage("Local workspace cleared. Onchain registry records were not changed.")
    setTab("overview")
  }

  const copyWallet = async () => {
    if (!walletAddress) return
    await navigator.clipboard?.writeText(walletAddress)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const tabItems: { id: Tab; label: string; icon: typeof Activity }[] = [
    { id: "overview", label: "Overview", icon: Gauge },
    { id: "agents", label: "Agents", icon: Fingerprint },
    { id: "guard", label: "Run guard", icon: ShieldCheck },
    { id: "policies", label: "Policies", icon: Zap },
    { id: "activity", label: "Activity", icon: Activity },
  ]

  const riskSummary = useMemo(() => {
    const average = activity.length ? Math.round(activity.reduce((sum, item) => sum + item.risk, 0) / activity.length) : 0
    return { average, safe: activity.filter((item) => item.decision === "ALLOWED").length }
  }, [activity])

  return (
    <div className="min-h-screen bg-background text-foreground dot-grid-bg">
      <header className="border-b-2 border-foreground bg-background/95 px-4 py-4 backdrop-blur-sm lg:px-10">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center justify-between gap-5">
            <Link href="/" className="flex items-center gap-3" aria-label="Back to AgentShield home">
              <span className="grid h-8 w-8 place-items-center border-2 border-foreground bg-foreground text-background"><ShieldCheck size={16} /></span>
              <span className="text-sm font-bold uppercase tracking-[0.16em]">AgentShield</span>
            </Link>
            <span className="hidden border-l border-border pl-5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:block">Security console / v1.0</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[10px] uppercase tracking-[0.15em] text-muted-foreground md:block">0G Galileo Testnet</span>
            {walletAddress ? (
              <button onClick={copyWallet} className="flex items-center gap-2 border-2 border-foreground px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors hover:bg-foreground hover:text-background" title="Copy connected wallet address">
                <span className="h-2 w-2 bg-[#3f6212]" /> {copied ? "Copied" : shortAddress(walletAddress)} <Copy size={12} />
              </button>
            ) : (
              <button onClick={connectWallet} className="flex items-center gap-2 bg-foreground px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-background transition-transform hover:-translate-y-0.5 active:translate-y-0">
                <Wallet size={13} /> Connect wallet
              </button>
            )}
            {walletAddress && network !== TESTNET.chainId && (
              <button onClick={switchNetwork} className="border-2 border-[#ea580c] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#ea580c] transition-colors hover:bg-[#ea580c] hover:text-background">
                Switch to 0G
              </button>
            )}
          </div>
        </div>
        {walletMessage && <p className="mx-auto mt-3 max-w-[1400px] text-[11px] text-[#a16207]" role="status">{walletMessage}</p>}
      </header>

      <main id="main-content" className="mx-auto max-w-[1400px] px-4 py-8 lg:px-10 lg:py-12">
        <div className="mb-8 flex flex-col gap-5 border-b-2 border-foreground pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link href="/" className="mb-5 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft size={12} /> Public overview</Link>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease }} className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">Guard every agent action.</motion.h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">Inspect intent. Enforce policy. Approve safely.</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground"><span className="h-2 w-2 animate-blink bg-[#ea580c]" /> policy engine online</div>
        </div>

        <div className="mb-8 flex gap-1 overflow-x-auto border-b border-border pb-px" role="tablist" aria-label="Console sections">
          {tabItems.map(({ id, label, icon: Icon }) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${tab === id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Icon size={13} strokeWidth={1.8} /> {label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
            <SectionLabel index="01">Overview</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Agents protected" value={String(agents.length)} detail="Local registry" />
              <Stat label="Actions checked" value={String(checkedCount)} detail="Guard evaluations" />
              <Stat label="Threats blocked" value={String(blockedCount)} detail="Policy decisions" />
              <Stat label="Budget available" value={protectedFunds.toFixed(0)} detail="Policy units across agents" />
            </div>
            <div className="mt-8 grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
              <section className="min-w-0 border-2 border-foreground bg-background">
                <div className="flex items-center justify-between border-b-2 border-foreground px-4 py-3"><h2 className="text-xs font-bold uppercase tracking-[0.14em]">Decision stream</h2><button onClick={() => setTab("activity")} className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">View all <ArrowRight className="ml-1 inline" size={12} /></button></div>
                <div className="divide-y divide-border">
                  {activity.slice(0, 5).map((item) => <ActivityRow key={item.id} item={item} />)}
                  {!activity.length && <EmptyState title="No decisions yet" body="Run a check to record one." action="Run guard" onClick={() => setTab("guard")} />}
                </div>
              </section>
              <section className="min-w-0 border-2 border-foreground bg-foreground p-5 text-background">
                <div className="flex items-start justify-between"><div><p className="text-[10px] uppercase tracking-[0.16em] text-background/55">Risk posture</p><p className="mt-2 text-5xl font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{riskSummary.average}</p></div><ShieldCheck size={26} className="text-[#ea580c]" /></div>
                <div className="mt-8 h-2 border border-background/30"><div className="h-full bg-[#ea580c] transition-all" style={{ width: `${Math.max(5, 100 - riskSummary.average)}%` }} /></div>
                <div className="mt-3 flex justify-between text-[10px] uppercase tracking-[0.13em] text-background/55"><span>Protected</span><span>{riskSummary.safe} allowed</span></div>
              </section>
            </div>
            <section className="mt-8"><div className="mb-4 flex items-end justify-between"><h2 className="text-2xl font-bold tracking-tight">Your agents</h2><button onClick={() => setTab("agents")} className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground">Manage agents <ArrowRight className="ml-1 inline" size={12} /></button></div><div className="grid gap-3 md:grid-cols-2">{agents.slice(0, 2).map((agent) => <AgentCard key={agent.id} agent={agent} onSelect={() => { setActiveAgentId(agent.id); setTab("guard") }} />)}{!agents.length && <div className="md:col-span-2"><EmptyState title="No agents yet" body="Create an agent to start." action="Create agent" onClick={() => { setShowAgentForm(true); setTab("agents") }} /></div>}</div></section>
          </motion.div>
        )}

        {tab === "agents" && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
            <SectionLabel index="02">Agents</SectionLabel>
            <div className="mb-6 flex flex-col gap-3 border-2 border-foreground bg-foreground p-5 text-background sm:flex-row sm:items-center sm:justify-between"><h2 className="text-2xl font-bold tracking-tight">Agent identities</h2><button onClick={() => setShowAgentForm((value) => !value)} className="flex items-center justify-center gap-2 bg-background px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground"><Plus size={14} /> Create agent</button></div>
            {showAgentForm && <AgentForm draft={agentDraft} setDraft={setAgentDraft} error={agentFormError} onSubmit={addAgent} onCancel={() => { setShowAgentForm(false); setAgentFormError("") }} />}
            <div className="grid gap-3 md:grid-cols-2">{agents.map((agent) => <AgentCard key={agent.id} agent={agent} expanded registered={registeredAgentIds.includes(agent.id)} registering={registeringAgentId === agent.id} onRegister={() => registerAgentOnchain(agent)} onSelect={() => { setActiveAgentId(agent.id); setTab("guard") }} />)}{!agents.length && <div className="md:col-span-2"><EmptyState title="Create your first agent" body="Set its budget, then run a guarded action." action="Create agent" onClick={() => setShowAgentForm(true)} /></div>}</div>
          </motion.div>
        )}

        {tab === "guard" && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
            <SectionLabel index="03">Run guard</SectionLabel>
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <section className="border-2 border-foreground bg-background p-5">
                <div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-bold tracking-tight">Review an action</h2><Sparkles size={20} className="text-[#ea580c]" /></div>
                <div className="space-y-4">
                  <label className="block"><span className="field-label">Agent</span><select value={activeAgentId} onChange={(event) => setActiveAgentId(event.target.value)} className="field-input">{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label>
                  <div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="field-label">Action</span><select value={guardForm.action} onChange={(event) => setGuardForm((current) => ({ ...current, action: event.target.value as GuardForm["action"] }))} className="field-input"><option value="transfer">Transfer</option><option value="approve">Token approval</option><option value="contract">Contract call</option></select></label><label className="block"><span className="field-label">Asset</span><select value={guardForm.asset} onChange={(event) => setGuardForm((current) => ({ ...current, asset: event.target.value }))} className="field-input"><option value="USDC">USDC</option><option value="0G">0G</option><option value="DAI">DAI</option></select></label></div>
                  <div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="field-label">Amount</span><input inputMode="decimal" value={guardForm.amount} onChange={(event) => setGuardForm((current) => ({ ...current, amount: event.target.value }))} className="field-input" placeholder="0.00" /></label><label className="block"><span className="field-label">Protocol</span><input value={guardForm.protocol} onChange={(event) => setGuardForm((current) => ({ ...current, protocol: event.target.value }))} className="field-input" placeholder="e.g. 0G Pay" /></label></div>
                  {guardForm.asset !== "0G" && guardForm.action !== "contract" && (
                    <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                      <label className="block"><span className="field-label">Token contract</span><input value={guardForm.tokenContract} onChange={(event) => setGuardForm((current) => ({ ...current, tokenContract: event.target.value }))} className="field-input" placeholder="0x…" spellCheck={false} /></label>
                      <label className="block"><span className="field-label">Decimals</span><input inputMode="numeric" value={guardForm.tokenDecimals} onChange={(event) => setGuardForm((current) => ({ ...current, tokenDecimals: event.target.value }))} className="field-input" /></label>
                    </div>
                  )}
                  <label className="block"><span className="field-label">Destination address</span><input value={guardForm.destination} onChange={(event) => setGuardForm((current) => ({ ...current, destination: event.target.value }))} className="field-input" placeholder="0x…" spellCheck={false} /></label>
                  {guardForm.action === "contract" && <label className="block"><span className="field-label">Contract calldata</span><textarea value={guardForm.calldata} onChange={(event) => setGuardForm((current) => ({ ...current, calldata: event.target.value }))} className="field-input min-h-20 resize-y" placeholder="0x" spellCheck={false} /></label>}
                  {guardForm.action === "approve" && (
                    <label className="flex cursor-pointer items-center gap-3 border-2 border-foreground px-3 py-3 text-xs">
                      <input type="checkbox" checked={guardForm.unlimitedApproval} onChange={(event) => setGuardForm((current) => ({ ...current, unlimitedApproval: event.target.checked }))} className="h-4 w-4 accent-[#ea580c]" />
                      Request unlimited token approval
                    </label>
                  )}
                  <label className="block"><span className="field-label">Agent instruction</span><textarea value={guardForm.instruction} onChange={(event) => setGuardForm((current) => ({ ...current, instruction: event.target.value }))} className="field-input min-h-24 resize-y" /></label>
                  <button onClick={runGuard} disabled={!activeAgent} className="flex w-full items-center justify-center gap-2 bg-foreground px-4 py-3 text-xs font-bold uppercase tracking-[0.15em] text-background transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"><ShieldCheck size={15} /> Run security check <ArrowRight size={14} /></button>
                </div>
              </section>
              <GuardResultPanel result={guardResult} approving={approvingReview} onApprove={approveReview} onExecute={executeTransaction} />
            </div>
          </motion.div>
        )}

        {tab === "policies" && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
            <SectionLabel index="04">Policies</SectionLabel>
            <div className="grid gap-3 md:grid-cols-2">{agents.map((agent) => <PolicyCard key={agent.id} agent={agent} registered={registeredAgentIds.includes(agent.id)} syncing={syncingPolicyId === agent.id} onSave={updateLocalPolicy} onSync={() => syncPolicyOnchain(agent)} />)}{!agents.length && <div className="md:col-span-2"><EmptyState title="No policies yet" body="Create an agent to configure transaction and daily spending limits." action="Create agent" onClick={() => { setShowAgentForm(true); setTab("agents") }} /></div>}</div>
          </motion.div>
        )}

        {tab === "activity" && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
            <SectionLabel index="05">Activity</SectionLabel>
            <section className="border-2 border-foreground bg-background"><div className="flex flex-col gap-3 border-b-2 border-foreground px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-xl font-bold tracking-tight">Activity</h2><ClearWorkspaceControl onConfirm={clearWorkspace} /></div><div className="divide-y divide-border">{activity.map((item) => <ActivityRow key={item.id} item={item} detailed />)}{!activity.length && <EmptyState title="No activity yet" body={agents.length ? "Run a guard check to record a decision." : "Create an agent first."} action={agents.length ? "Run guard" : "Create agent"} onClick={() => agents.length ? setTab("guard") : (setShowAgentForm(true), setTab("agents"))} />}</div></section>
          </motion.div>
        )}
      </main>

      <footer className="border-t-2 border-foreground px-4 py-6 lg:px-10"><div className="mx-auto flex max-w-[1400px] flex-col gap-3 text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>AgentShield / 0G Galileo</span><div className="flex flex-wrap gap-4">{REGISTRY_ADDRESS && <a href={`${TESTNET.explorer}/address/${REGISTRY_ADDRESS}`} target="_blank" rel="noreferrer" className="hover:text-foreground">Registry <ExternalLink className="ml-1 inline" size={11} /></a>}<a href={TESTNET.explorer} target="_blank" rel="noreferrer" className="hover:text-foreground">ChainScan <ExternalLink className="ml-1 inline" size={11} /></a><a href={TESTNET.faucet} target="_blank" rel="noreferrer" className="hover:text-foreground">Testnet faucet <ExternalLink className="ml-1 inline" size={11} /></a></div></div></footer>
    </div>
  )
}

function AgentCard({ agent, onSelect, onRegister, expanded = false, registering = false, registered = false }: { agent: Agent; onSelect: () => void; onRegister?: () => void; expanded?: boolean; registering?: boolean; registered?: boolean }) {
  const remaining = Math.max(agent.dailyBudget - agent.usedToday, 0)
  const paused = !agent.active
  const stateLabel = paused ? "PAUSED" : registered ? "ONCHAIN" : agent.status
  const stateTone = paused ? "border-[#a16207] text-[#a16207]" : "border-[#3f6212] text-[#3f6212]"
  return <article className="border-2 border-foreground bg-background p-5 transition-transform hover:-translate-y-0.5"><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center border-2 border-foreground bg-foreground text-background"><Fingerprint size={18} /></div><div><h3 className="text-sm font-bold uppercase tracking-[0.1em]">{agent.name}</h3><p className="mt-1 text-xs text-muted-foreground">{agent.purpose}</p></div></div><span className={`flex items-center gap-2 border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${stateTone}`}><span className={`h-1.5 w-1.5 ${paused ? "bg-[#a16207]" : "bg-[#3f6212]"}`} /> {stateLabel}</span></div><div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4"><div><p className="field-label">Trust</p><p className="mt-1 text-lg font-bold">{agent.trust}<span className="text-xs text-muted-foreground">/100</span></p></div><div><p className="field-label">Max tx</p><p className="mt-1 text-lg font-bold">{agent.maxTransaction}</p></div><div><p className="field-label">Available</p><p className="mt-1 text-lg font-bold">{remaining.toFixed(0)}</p></div></div>{expanded && <div className="mt-4 border-t border-border pt-4"><div className="flex items-center justify-between text-[10px] uppercase tracking-[0.13em] text-muted-foreground"><span>Wallet</span><span>{agent.wallet}</span></div><div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.13em] text-muted-foreground"><span>Allowlist</span><span>{agent.protocols.length ? agent.protocols.join(" · ") : "None"}</span></div></div>}<div className={`mt-5 grid gap-2 ${onRegister ? "sm:grid-cols-2" : ""}`}><button onClick={onSelect} className="flex w-full items-center justify-center gap-2 border-2 border-foreground px-3 py-2 text-[10px] font-bold uppercase tracking-[0.13em] transition-colors hover:bg-foreground hover:text-background">Evaluate action <ArrowRight size={12} /></button>{onRegister && <button onClick={onRegister} disabled={registering || registered || !REGISTRY_ADDRESS} className="flex w-full items-center justify-center gap-2 bg-foreground px-3 py-2 text-[10px] font-bold uppercase tracking-[0.13em] text-background disabled:cursor-not-allowed disabled:opacity-50"><Fingerprint size={12} /> {registered ? "Registered" : registering ? "Registering…" : "Register on 0G"}</button>}</div></article>
}

function PolicyCard({ agent, registered, syncing, onSave, onSync }: { agent: Agent; registered: boolean; syncing: boolean; onSave: (agentId: string, maxTransaction: number, dailyBudget: number, active: boolean, protocols: string[]) => boolean; onSync: () => void }) {
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState("")
  const [draft, setDraft] = useState({
    maxTransaction: String(agent.maxTransaction),
    dailyBudget: String(agent.dailyBudget),
    active: agent.active,
    protocols: agent.protocols.join(", "),
  })

  useEffect(() => {
    if (!editing) setDraft({ maxTransaction: String(agent.maxTransaction), dailyBudget: String(agent.dailyBudget), active: agent.active, protocols: agent.protocols.join(", ") })
  }, [agent.active, agent.dailyBudget, agent.maxTransaction, agent.protocols, editing])

  const save = () => {
    setError("")
    const maxTransaction = Number(draft.maxTransaction)
    const dailyBudget = Number(draft.dailyBudget)
    if (dailyBudget < maxTransaction || maxTransaction <= 0 || !Number.isFinite(maxTransaction) || !Number.isFinite(dailyBudget)) {
      setError("Use positive limits and keep daily budget at or above the maximum transaction.")
      return
    }
    const protocols = [...new Set(draft.protocols.split(",").map((protocol) => protocol.trim()).filter(Boolean))]
    if (onSave(agent.id, maxTransaction, dailyBudget, draft.active, protocols)) setEditing(false)
  }

  return (
    <article className="border-2 border-foreground bg-background">
      <div className="flex items-center justify-between border-b-2 border-foreground px-4 py-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.1em]">{agent.name}</h2>
        <span className="text-[10px] text-muted-foreground">{agent.active ? "POLICY ACTIVE" : "POLICY PAUSED"}</span>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        {editing ? (
          <>
            <label><span className="field-label">Maximum transaction</span><input className="field-input" inputMode="decimal" value={draft.maxTransaction} onChange={(event) => setDraft((current) => ({ ...current, maxTransaction: event.target.value }))} /></label>
            <label><span className="field-label">Daily budget</span><input className="field-input" inputMode="decimal" value={draft.dailyBudget} onChange={(event) => setDraft((current) => ({ ...current, dailyBudget: event.target.value }))} /></label>
            <label className="flex cursor-pointer items-center gap-3 border-2 border-foreground px-3 py-3 text-xs sm:col-span-2"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} className="h-4 w-4 accent-[#ea580c]" />Policy can approve actions</label>
            <label className="sm:col-span-2"><span className="field-label">Approved protocols, comma separated</span><input className="field-input" value={draft.protocols} onChange={(event) => setDraft((current) => ({ ...current, protocols: event.target.value }))} placeholder="0G Pay, DataMarket" /></label>
            {error && <p className="text-xs text-[#b91c1c] sm:col-span-2" role="alert">{error}</p>}
            <div className="flex flex-wrap gap-2 sm:col-span-2"><button onClick={save} className="bg-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-[0.13em] text-background">Save locally</button><button onClick={() => { setEditing(false); setError("") }} className="border-2 border-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-[0.13em]">Cancel</button></div>
          </>
        ) : (
          <>
            <div><p className="field-label">Maximum transaction</p><p className="mt-1 text-xl font-bold">{agent.maxTransaction} <span className="text-xs font-normal text-muted-foreground">policy units</span></p></div>
            <div><p className="field-label">Daily budget</p><p className="mt-1 text-xl font-bold">{agent.dailyBudget} <span className="text-xs font-normal text-muted-foreground">policy units</span></p></div>
            <div className="sm:col-span-2"><div className="mb-2 flex justify-between text-[10px] uppercase tracking-[0.13em] text-muted-foreground"><span>Budget used today</span><span>{agent.usedToday} / {agent.dailyBudget}</span></div><div className="h-2 border border-foreground"><div className="h-full bg-[#ea580c]" style={{ width: `${Math.min(100, (agent.usedToday / agent.dailyBudget) * 100)}%` }} /></div></div>
            <div className="sm:col-span-2"><p className="field-label">Approved protocols</p><div className="mt-2 flex flex-wrap gap-2">{agent.protocols.map((protocol) => <span key={protocol} className="border border-foreground px-2 py-1 text-[10px] uppercase tracking-[0.1em]">{protocol}</span>)}</div></div>
            <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2"><button onClick={() => setEditing(true)} className="border-2 border-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-[0.13em] hover:bg-foreground hover:text-background">Edit policy</button><button onClick={onSync} disabled={!registered || syncing} className="bg-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-[0.13em] text-background disabled:cursor-not-allowed disabled:opacity-50">{syncing ? "Syncing…" : registered ? "Sync to 0G" : "Register before sync"}</button></div>
          </>
        )}
      </div>
    </article>
  )
}

function GuardResultPanel({ result, approving, onApprove, onExecute }: { result: GuardResult | null; approving: boolean; onApprove: () => Promise<void>; onExecute: () => void }) {
  if (!result) return <section className="flex min-h-[560px] flex-col items-center justify-center border-2 border-dashed border-border bg-background p-8 text-center"><div className="grid h-14 w-14 place-items-center border-2 border-foreground"><ShieldCheck size={25} /></div><h2 className="mt-5 text-xl font-bold tracking-tight">Ready to review</h2><p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">Run a check to see the decision.</p></section>
  const blocked = result.decision === "BLOCKED"
  return <section className={`border-2 p-5 ${blocked ? "border-[#b91c1c] bg-[#fff7f7]" : result.decision === "REVIEW" ? "border-[#a16207] bg-[#fffdf5]" : "border-[#3f6212] bg-[#f8fff2]"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Security decision</p><h2 className="mt-2 text-3xl font-bold tracking-tight">{blocked ? "Action blocked" : result.decision === "REVIEW" ? "Wallet approval required" : "Policy passed"}</h2></div><DecisionBadge decision={result.decision} /></div><div className="mt-8 flex items-end gap-4 border-y border-current/20 py-5"><p className="text-7xl font-bold leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>{result.risk}</p><div className="pb-1"><p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Risk score / 100</p><p className="mt-1 text-xs text-muted-foreground">{blocked ? "Do not sign this request." : result.decision === "REVIEW" ? "The owner wallet must sign once." : "Ready for onchain verification."}</p></div></div><div className="mt-6"><p className="field-label">Why this decision</p><ul className="mt-3 space-y-3">{result.reasons.map((reason) => <li key={reason} className="flex items-start gap-2 text-xs"><span className={`mt-1 h-1.5 w-1.5 shrink-0 ${blocked ? "bg-[#b91c1c]" : result.decision === "REVIEW" ? "bg-[#a16207]" : "bg-[#3f6212]"}`} />{reason}</li>)}</ul></div><div className="mt-8 grid gap-2 sm:grid-cols-2">{result.decision === "REVIEW" && <button onClick={() => void onApprove()} disabled={approving} className="flex items-center justify-center gap-2 border-2 border-foreground px-3 py-3 text-[10px] font-bold uppercase tracking-[0.13em] hover:bg-foreground hover:text-background disabled:opacity-50"><Check size={14} /> {approving ? "Waiting for wallet…" : "Sign approval"}</button>}{!blocked && <button onClick={onExecute} className="flex items-center justify-center gap-2 bg-foreground px-3 py-3 text-[10px] font-bold uppercase tracking-[0.13em] text-background hover:-translate-y-0.5"><Zap size={14} /> Execute on 0G</button>}{blocked && <div className="flex items-center justify-center gap-2 border-2 border-[#b91c1c] px-3 py-3 text-[10px] font-bold uppercase tracking-[0.13em] text-[#b91c1c]"><X size={14} /> Wallet call suppressed</div>}</div></section>
}

function ActivityRow({ item, detailed = false }: { item: ActivityItem; detailed?: boolean }) {
  return <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-start gap-3"><div className={`mt-1 grid h-7 w-7 shrink-0 place-items-center border ${item.decision === "BLOCKED" ? "border-[#b91c1c] text-[#b91c1c]" : item.decision === "REVIEW" ? "border-[#a16207] text-[#a16207]" : "border-[#3f6212] text-[#3f6212]"}`}>{item.decision === "BLOCKED" ? <X size={13} /> : item.decision === "REVIEW" ? <CircleAlert size={13} /> : <Check size={13} />}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold uppercase tracking-[0.08em]">{item.action} {item.amount > 0 ? `${item.amount} ${item.asset}` : item.asset}</p><DecisionBadge decision={item.decision} /></div><p className="mt-1 truncate text-xs text-muted-foreground">{item.agent} · {item.destination}</p>{detailed && <p className="mt-2 text-[11px] text-muted-foreground">{item.reasons.join(" · ")}</p>}</div></div><div className="flex shrink-0 items-center gap-4 text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:text-right"><span>{item.createdAt}</span><span className="font-bold text-foreground">RISK {item.risk}</span>{item.txHash && /^0x[0-9a-fA-F]{64}$/.test(item.txHash) && <a href={`${TESTNET.explorer}/tx/${item.txHash}`} target="_blank" rel="noreferrer" className="hover:text-foreground"><ExternalLink size={12} /></a>}</div></div>
}

function EmptyState({ title, body, action, onClick }: { title: string; body: string; action: string; onClick: () => void }) {
  return <div className="flex flex-col items-center justify-center px-5 py-14 text-center"><p className="text-sm font-bold uppercase tracking-[0.1em]">{title}</p><p className="mt-2 max-w-sm text-xs text-muted-foreground">{body}</p><button onClick={onClick} className="mt-5 border-2 border-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-[0.13em] hover:bg-foreground hover:text-background">{action}</button></div>
}

function ClearWorkspaceControl({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false)
  if (confirming) return <div className="flex flex-wrap items-center gap-2"><span className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Clear agents and local history?</span><button onClick={onConfirm} className="border-2 border-[#b91c1c] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.13em] text-[#b91c1c]">Clear workspace</button><button onClick={() => setConfirming(false)} className="px-3 py-2 text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Cancel</button></div>
  return <button onClick={() => setConfirming(true)} className="flex items-center gap-2 self-start text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"><RefreshCcw size={13} /> Clear local workspace</button>
}

function AgentForm({ draft, setDraft, error, onSubmit, onCancel }: { draft: { name: string; purpose: string; maxTransaction: string; dailyBudget: string }; setDraft: (draft: { name: string; purpose: string; maxTransaction: string; dailyBudget: string }) => void; error: string; onSubmit: () => void; onCancel: () => void }) {
  return <section className="mb-6 border-2 border-foreground bg-background p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-bold uppercase tracking-[0.12em]">Create an agent</h2><button onClick={onCancel} aria-label="Close agent form"><X size={16} /></button></div><div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="field-label">Agent name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="field-input" placeholder="e.g. Research payments" /></label><label className="block"><span className="field-label">Purpose</span><input value={draft.purpose} onChange={(event) => setDraft({ ...draft, purpose: event.target.value })} className="field-input" placeholder="What it is allowed to do" /></label><label className="block"><span className="field-label">Max transaction (policy units)</span><input inputMode="decimal" value={draft.maxTransaction} onChange={(event) => setDraft({ ...draft, maxTransaction: event.target.value })} className="field-input" /></label><label className="block"><span className="field-label">Daily budget (policy units)</span><input inputMode="decimal" value={draft.dailyBudget} onChange={(event) => setDraft({ ...draft, dailyBudget: event.target.value })} className="field-input" /></label></div><p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">Keep units consistent for each agent.</p>{error && <p className="mt-3 text-xs text-[#b91c1c]" role="alert">{error}</p>}<div className="mt-4 flex flex-wrap gap-2"><button onClick={onSubmit} className="bg-foreground px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-background">Create identity</button><button onClick={onCancel} className="border-2 border-foreground px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em]">Cancel</button></div></section>
}
