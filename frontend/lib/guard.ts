import { getAddress, isAddress } from "ethers"

export type Decision = "ALLOWED" | "REVIEW" | "BLOCKED"

export type GuardForm = {
  amount: string
  asset: string
  destination: string
  action: "transfer" | "approve" | "contract"
  instruction: string
  protocol: string
  tokenContract: string
  tokenDecimals: string
  calldata: string
  unlimitedApproval: boolean
}

export type AgentPolicyInput = {
  name: string
  maxTransaction: number
  dailyBudget: number
  usedToday: number
  protocols: string[]
  active: boolean
}

export type GuardEvaluation = {
  risk: number
  decision: Decision
  reasons: string[]
}

export function normalizeProtocolAddresses(values: string[]) {
  const unique = new Map<string, string>()
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    if (!isAddress(trimmed)) throw new Error(`Invalid protocol address: ${trimmed}`)
    const normalized = getAddress(trimmed)
    unique.set(normalized.toLowerCase(), normalized)
  }
  return [...unique.values()]
}

export function parseTokenValue(value: string, decimals: number) {
  const normalized = value.trim()
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new Error("Token decimals must be between 0 and 36.")
  const amountPattern = new RegExp(`^\\d+(\\.\\d{0,${decimals}})?$`)
  if (!amountPattern.test(normalized)) throw new Error(`Enter a valid amount with at most ${decimals} decimal places.`)
  const [whole, fraction = ""] = normalized.split(".")
  const unit = BigInt(`1${"0".repeat(decimals)}`)
  return BigInt(whole) * unit + BigInt(fraction.padEnd(decimals, "0") || "0")
}

export function parseNativeValue(value: string) {
  return `0x${parseTokenValue(value, 18).toString(16)}`
}

export function encodeErc20Call(action: "transfer" | "approve", destination: string, amount: bigint) {
  if (!isAddress(destination)) throw new Error("Destination is not a valid EVM address.")
  const selector = action === "approve" ? "095ea7b3" : "a9059cbb"
  const addressWord = getAddress(destination).toLowerCase().replace(/^0x/, "").padStart(64, "0")
  const amountWord = amount.toString(16).padStart(64, "0")
  return `0x${selector}${addressWord}${amountWord}`
}

export function evaluateGuard(form: GuardForm, agent: AgentPolicyInput): GuardEvaluation {
  const amount = Number(form.amount) || 0
  const reasons: string[] = []
  let risk = 6
  let forceBlock = false
  let requiresReview = false

  if (!agent.active) {
    risk += 100
    forceBlock = true
    reasons.push("Agent policy is paused")
  }

  if (!isAddress(form.destination.trim())) {
    risk += 80
    forceBlock = true
    reasons.push("Destination is not a valid EVM address")
  }
  if (form.asset !== "0G" && form.action !== "contract" && !isAddress(form.tokenContract.trim())) {
    risk += 80
    forceBlock = true
    reasons.push("Token contract is not a valid EVM address")
  }

  const decimals = Number(form.tokenDecimals)
  if (form.asset !== "0G" && form.action !== "contract" && (!Number.isInteger(decimals) || decimals < 0 || decimals > 36)) {
    risk += 60
    forceBlock = true
    reasons.push("Token decimals must be between 0 and 36")
  }
  if (form.action === "contract" && !/^0x(?:[a-fA-F0-9]{2})*$/.test(form.calldata.trim())) {
    risk += 60
    forceBlock = true
    reasons.push("Contract calldata must be valid hex bytes")
  }
  if (amount <= 0 && form.action === "transfer") {
    risk += 50
    forceBlock = true
    reasons.push("Transfer amount must be greater than zero")
  }
  try {
    parseTokenValue(form.amount || "0", 6)
  } catch {
    risk += 80
    forceBlock = true
    reasons.push("Policy amount supports up to 6 decimal places")
  }
  if (amount > agent.maxTransaction) {
    risk += 28
    forceBlock = true
    reasons.push(`Amount exceeds ${agent.name}'s ${agent.maxTransaction} ${form.asset} limit`)
  }
  if (amount > Math.max(agent.dailyBudget - agent.usedToday, 0)) {
    risk += 18
    forceBlock = true
    reasons.push("Daily budget would be exceeded")
  }
  if (form.action === "approve") {
    risk += 20
    requiresReview = true
    reasons.push("Token approval requires an explicit review")
    if (form.asset === "0G") {
      risk += 80
      forceBlock = true
      reasons.push("Native 0G does not support token approvals")
    }
    if (form.unlimitedApproval || /unlimited|max|infinite|0x[fF]{6,}/i.test(form.instruction)) {
      risk += 24
      forceBlock = true
      reasons.push("Unlimited approval pattern detected")
    }
  }

  const protocol = form.protocol.trim()
  const protocolValid = isAddress(protocol)
  if (!protocolValid) {
    risk += 80
    forceBlock = true
    reasons.push("Protocol must be a valid EVM address")
  }
  const protocolAllowed = protocolValid && agent.protocols.some((entry) => entry.toLowerCase() === protocol.toLowerCase())
  if (!protocolAllowed) {
    risk += 30
    reasons.push("Protocol is not on the agent allowlist")
  }
  if (/ignore (all|any)|system override|previous instructions|transfer all|bypass|reveal secret/i.test(form.instruction)) {
    risk += 70
    forceBlock = true
    reasons.push("Prompt injection pattern detected")
  }
  if (protocolAllowed) {
    risk -= 10
    reasons.push("Approved protocol")
  }

  risk = Math.min(100, Math.max(0, risk))
  if (forceBlock) risk = Math.max(risk, 75)
  const decision: Decision = forceBlock || risk >= 70 ? "BLOCKED" : requiresReview || risk >= 35 ? "REVIEW" : "ALLOWED"
  if (reasons.length === 0) reasons.push("Within policy")
  return { risk, decision, reasons }
}
