// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AgentShieldRegistry
/// @notice Owner-controlled agent policies and immutable security decision events.
contract AgentShieldRegistry {
    uint8 public constant BLOCK_RISK_THRESHOLD = 70;

    struct Policy {
        address owner;
        uint128 maxTransaction;
        uint128 dailyBudget;
        uint128 spentToday;
        uint64 spendingDay;
        bool active;
    }

    mapping(bytes32 agentId => Policy policy) public policies;
    mapping(bytes32 agentId => mapping(address protocol => bool allowed)) public allowedProtocols;

    event AgentRegistered(
        bytes32 indexed agentId,
        address indexed owner,
        uint128 maxTransaction,
        uint128 dailyBudget
    );
    event PolicyUpdated(
        bytes32 indexed agentId,
        uint128 maxTransaction,
        uint128 dailyBudget,
        bool active
    );
    event ProtocolPermissionUpdated(bytes32 indexed agentId, address indexed protocol, bool allowed);
    event DecisionRecorded(
        bytes32 indexed decisionId,
        bytes32 indexed agentId,
        address indexed destination,
        uint256 amount,
        uint8 risk,
        bool allowed,
        bytes32 reportHash
    );

    error AgentAlreadyRegistered();
    error AgentNotRegistered();
    error NotAgentOwner();
    error InvalidPolicy();
    error InvalidRisk();

    modifier onlyAgentOwner(bytes32 agentId) {
        address policyOwner = policies[agentId].owner;
        if (policyOwner == address(0)) revert AgentNotRegistered();
        if (policyOwner != msg.sender) revert NotAgentOwner();
        _;
    }

    function registerAgent(bytes32 agentId, uint128 maxTransaction, uint128 dailyBudget) external {
        if (policies[agentId].owner != address(0)) revert AgentAlreadyRegistered();
        if (agentId == bytes32(0) || maxTransaction == 0 || dailyBudget < maxTransaction) revert InvalidPolicy();

        policies[agentId] = Policy({
            owner: msg.sender,
            maxTransaction: maxTransaction,
            dailyBudget: dailyBudget,
            spentToday: 0,
            spendingDay: uint64(block.timestamp / 1 days),
            active: true
        });

        emit AgentRegistered(agentId, msg.sender, maxTransaction, dailyBudget);
    }

    function updatePolicy(
        bytes32 agentId,
        uint128 maxTransaction,
        uint128 dailyBudget,
        bool active
    ) external onlyAgentOwner(agentId) {
        if (maxTransaction == 0 || dailyBudget < maxTransaction) revert InvalidPolicy();
        Policy storage policy = policies[agentId];
        policy.maxTransaction = maxTransaction;
        policy.dailyBudget = dailyBudget;
        policy.active = active;
        emit PolicyUpdated(agentId, maxTransaction, dailyBudget, active);
    }

    function setProtocolAllowed(bytes32 agentId, address protocol, bool allowed) external onlyAgentOwner(agentId) {
        allowedProtocols[agentId][protocol] = allowed;
        emit ProtocolPermissionUpdated(agentId, protocol, allowed);
    }

    function previewDecision(
        bytes32 agentId,
        address protocol,
        uint256 amount,
        uint8 risk
    ) public view returns (bool allowed) {
        Policy memory policy = policies[agentId];
        if (policy.owner == address(0) || !policy.active || risk >= BLOCK_RISK_THRESHOLD) return false;
        if (amount > policy.maxTransaction || !allowedProtocols[agentId][protocol]) return false;

        uint256 currentSpent = policy.spendingDay == uint64(block.timestamp / 1 days) ? policy.spentToday : 0;
        return currentSpent + amount <= policy.dailyBudget;
    }

    function recordDecision(
        bytes32 decisionId,
        bytes32 agentId,
        address destination,
        address protocol,
        uint256 amount,
        uint8 risk,
        bytes32 reportHash
    ) external onlyAgentOwner(agentId) returns (bool allowed) {
        if (risk > 100) revert InvalidRisk();
        Policy storage policy = policies[agentId];
        uint64 today = uint64(block.timestamp / 1 days);
        if (policy.spendingDay != today) {
            policy.spendingDay = today;
            policy.spentToday = 0;
        }

        allowed = previewDecision(agentId, protocol, amount, risk);
        if (allowed) policy.spentToday += uint128(amount);

        emit DecisionRecorded(decisionId, agentId, destination, amount, risk, allowed, reportHash);
    }
}
