# 区块链学习笔记：从分布式账本到智能合约编程

想搞懂区块链不是因为炒币，而是对"去中心化"这个技术理念本身的好奇——一个没有中央服务器的系统怎么保证数据不被篡改？花了一段时间从零开始学，这篇是整理的笔记。

## 区块链是什么

本质是一个**分布式的、不可篡改的链表**。每个区块包含一批交易记录，区块之间用哈希值链接：

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│    区块 N-1       │     │     区块 N        │     │    区块 N+1       │
│                  │     │                  │     │                  │
│ prev_hash: 0x... │◄────│ prev_hash: 0xAA  │◄────│ prev_hash: 0xBB  │
│ timestamp        │     │ timestamp        │     │ timestamp        │
│ transactions[]   │     │ transactions[]   │     │ transactions[]   │
│ nonce            │     │ nonce            │     │ nonce            │
│ hash: 0xAA...    │     │ hash: 0xBB...    │     │ hash: 0xCC...    │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

如果有人想篡改区块 N 里的一笔交易，该区块的哈希值会变，导致 N+1 的 `prev_hash` 对不上，必须把 N+1 以后的区块全部重算。而网络上的其他节点不认可你这套链——除非你拥有全网 51% 以上的算力。

这就是**工作量证明（PoW）**的核心思想：让篡改的成本高到不现实。

## 共识机制

多个节点如何就"哪条链是有效的"达成一致，是区块链的核心问题。

**PoW（Proof of Work）**：比特币用的方案。谁先算出满足条件的哈希值，谁就有权打包下一个区块，获得区块奖励。算力竞赛的代价是电费——这被诟病了十几年。

**PoS（Proof of Stake）**：以太坊 2022 年转向的方案。不拼算力，改拼"质押量"——押的 ETH 越多、押的时间越长，被选中打包区块的概率越高。省电，但被批评为"富者愈富"。

**DPoS（Delegated PoS）**：代议制。持币者投票选出一批"超级节点"负责出块。效率有质的提升但去中心化程度打了折扣。EOS 和 TRON 用的是这个。

每个方案都在"去中心化程度、安全性、性能"三者之间做权衡——这在业内叫**不可能三角**。

## 智能合约

比特币只能转账，以太坊引入了**智能合约**——一段部署在链上的代码，一旦部署就不能修改，且所有人都能看到源码。这解决了一个核心信任问题：你不用相信我，你相信代码就行。

合约是图灵完备的——理论上什么都能算，但每步计算都要付 Gas 费。这是一种经济上的反滥用机制：死循环合约会因为 Gas 耗尽而终止，而不是永远跑下去。

```solidity
// 一个最简单的计数器合约
contract Counter {
    uint256 public count;

    function increment() public {
        count += 1;
    }

    function decrement() public {
        require(count > 0, "count is zero");
        count -= 1;
    }
}
```

部署到链上之后，任何人都可以调用 `increment()`，状态永久记录。合约地址相当于一个去中心化应用的 API 入口。

## 几个重要概念

**Gas** —— 以太坊的"燃料"。`count += 1` 消耗 Gas，`require(count > 0)` 也消耗 Gas。Gas 单价（Gwei）随网络拥堵波动，高峰期一笔交易手续费几十美元不在话下。

**NFT** —— 非同质化代币，本质是一个 token ID 加一段 metadata URL。ERC-721 标准定义了 `ownerOf(tokenId)` 和 `transferFrom()` 接口。知道这些之后再看 NFT 炒作会冷静很多。

**DeFi** —— 去中心化金融。把借贷、交易、保险这些金融行为搬到链上，通过智能合约自动执行。Uniswap 的核心功能不过是用 `x * y = k` 这个恒定乘积公式做市——

```solidity
function swap(uint amountIn, uint reserveIn, uint reserveOut) 
    public pure returns (uint amountOut) 
{
    uint amountInWithFee = amountIn * 997;
    uint numerator = amountInWithFee * reserveOut;
    uint denominator = reserveIn * 1000 + amountInWithFee;
    return numerator / denominator;
}
```

核心原理就这么几行，复杂的是外围的流动性管理、滑点控制、前端攻击防御。

## 当前阶段的局限

加密世界的去中心化目前还是一种"趋势"而非"现实"。交易所跑路、跨链桥被黑、稳定币脱锚……过去几年已经发生太多次了。技术上确实惊艳，但工程可靠性还远达不到传统金融标准。

学了区块链之后反而没那么容易被币圈的叙事打动了——知道底层是什么之后，很多东西就祛魅了。
