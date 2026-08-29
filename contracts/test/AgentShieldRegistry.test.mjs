import assert from "node:assert/strict"
import test from "node:test"
import ganache from "ganache"
import { BrowserProvider, ContractFactory, id, parseUnits, ZeroHash } from "ethers"
import { compileContract } from "../scripts/compile.mjs"

async function deployFixture() {
  const eip1193 = ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 3 } })
  const provider = new BrowserProvider(eip1193)
  const owner = await provider.getSigner(0)
  const stranger = await provider.getSigner(1)
  const { abi, bytecode } = compileContract()
  const registry = await new ContractFactory(abi, bytecode, owner).deploy()
  await registry.waitForDeployment()
  return { eip1193, owner, stranger, registry }
}

test("registers an agent and rejects duplicate registration", async () => {
  const { eip1193, registry } = await deployFixture()
  try {
    const agentId = id("payments-agent")
    await (await registry.registerAgent(agentId, parseUnits("25", 6), parseUnits("100", 6))).wait()
    const policy = await registry.policies(agentId)
    assert.notEqual(policy.owner, "0x0000000000000000000000000000000000000000")
    await assert.rejects(registry.registerAgent(agentId, 1n, 1n))
  } finally {
    await eip1193.disconnect()
  }
})

test("enforces ownership for policy and protocol updates", async () => {
  const { eip1193, registry, stranger } = await deployFixture()
  try {
    const agentId = id("owner-agent")
    await (await registry.registerAgent(agentId, 10n, 100n)).wait()
    await assert.rejects(registry.connect(stranger).updatePolicy(agentId, 10n, 100n, false))
    await assert.rejects(registry.connect(stranger).setProtocolAllowed(agentId, await stranger.getAddress(), true))
  } finally {
    await eip1193.disconnect()
  }
})

test("blocks inactive, excessive, risky, and unapproved decisions", async () => {
  const { eip1193, registry, stranger } = await deployFixture()
  try {
    const agentId = id("guard-agent")
    const protocol = await stranger.getAddress()
    await (await registry.registerAgent(agentId, 25n, 100n)).wait()
    assert.equal(await registry.previewDecision(agentId, protocol, 5n, 10), false)
    await (await registry.setProtocolAllowed(agentId, protocol, true)).wait()
    assert.equal(await registry.previewDecision(agentId, protocol, 26n, 10), false)
    assert.equal(await registry.previewDecision(agentId, protocol, 5n, 70), false)
    assert.equal(await registry.previewDecision(agentId, protocol, 5n, 10), true)
    await (await registry.updatePolicy(agentId, 25n, 100n, false)).wait()
    assert.equal(await registry.previewDecision(agentId, protocol, 5n, 10), false)
  } finally {
    await eip1193.disconnect()
  }
})

test("records allowed decisions and consumes the daily budget", async () => {
  const { eip1193, registry, stranger } = await deployFixture()
  try {
    const agentId = id("budget-agent")
    const protocol = await stranger.getAddress()
    await (await registry.registerAgent(agentId, 25n, 30n)).wait()
    await (await registry.setProtocolAllowed(agentId, protocol, true)).wait()
    await (await registry.recordDecision(id("decision-1"), agentId, protocol, protocol, 20n, 10, ZeroHash)).wait()
    assert.equal((await registry.policies(agentId)).spentToday, 20n)
    assert.equal(await registry.previewDecision(agentId, protocol, 11n, 10), false)
  } finally {
    await eip1193.disconnect()
  }
})

test("records blocked decisions without consuming budget", async () => {
  const { eip1193, registry, stranger } = await deployFixture()
  try {
    const agentId = id("blocked-agent")
    const protocol = await stranger.getAddress()
    await (await registry.registerAgent(agentId, 25n, 100n)).wait()
    await (await registry.setProtocolAllowed(agentId, protocol, true)).wait()
    await (await registry.recordDecision(id("decision-blocked"), agentId, protocol, protocol, 5n, 90, ZeroHash)).wait()
    assert.equal((await registry.policies(agentId)).spentToday, 0n)
  } finally {
    await eip1193.disconnect()
  }
})
