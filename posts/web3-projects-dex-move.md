# Web3 实战：Solidity DEX 与 Sui Move 链上应用

学区块链不能光看理论，还是要上手写代码。这篇记录两个实践项目：一个是基于 WTF-Dapp 教程写的简易去中心化交易所（DEX），另一个是用 Sui Move 写一个链上留言板。

## 项目一：简易 DEX

参考的是 WTF-Dapp 教程里的 DEX 实现。核心功能三个：创建流动性池、添加流动性、Token 兑换。

### 合约设计

DEX 的核心是一个交易对合约——每种交易对（比如 ETH/USDT）独立部署一份合约。用户存入两种 Token 提供流动性，交易者用一种 Token 换另一种。

```
┌──────────────────────────────────────┐
│           SimpleDEX 合约             │
│                                      │
│  addLiquidity(tokenA, tokenB)        │
│       │                              │
│       ▼                              │
│  ┌──────────┐                       │
│  │ 流动性池   │   x · y = k          │
│  │ TokenA    │                       │
│  │ TokenB    │                       │
│  └──────────┘                       │
│       │                              │
│       ▼                              │
│  swap(tokenIn, amountIn)             │
│    → 根据恒定乘积公式计算输出量         │
└──────────────────────────────────────┘
```

### 添加流动性

```solidity
function addLiquidity(uint amountA, uint amountB) external {
    IERC20(tokenA).transferFrom(msg.sender, address(this), amountA);
    IERC20(tokenB).transferFrom(msg.sender, address(this), amountB);
    
    uint liquidity;
    if (totalSupply == 0) {
        liquidity = sqrt(amountA * amountB);  // 初始注入
    } else {
        // 按比例计算 LP Token 数量
        liquidity = min(
            (amountA * totalSupply) / reserveA,
            (amountB * totalSupply) / reserveB
        );
    }
    
    _mint(msg.sender, liquidity);
    _updateReserves();
}
```

LP Token（流动性代币）是提供流动性的凭证——将来赎回流动性时销毁 LP Token，按比例拿回两种资产。

### Token 兑换

```solidity
function swap(address tokenIn, uint amountIn) external returns (uint amountOut) {
    require(tokenIn == tokenA || tokenIn == tokenB, "invalid token");
    
    (uint reserveIn, uint reserveOut) = tokenIn == tokenA 
        ? (reserveA, reserveB) 
        : (reserveB, reserveA);
    
    // x * y = k 恒定乘积
    // amountOut = reserveOut - k / (reserveIn + amountIn)
    amountOut = reserveOut - (reserveA * reserveB) / (reserveIn + amountIn);
    amountOut = (amountOut * 997) / 1000;  // 0.3% 手续费
    
    IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
    IERC20(tokenOut).transfer(msg.sender, amountOut);
    _updateReserves();
}
```

`x * y = k` 是 Uniswap V2 的核心公式。池子里两种 Token 数量的乘积必须保持恒定。你换走一种 Token，池子里它就变少了，另一种就要多给你一些——自动做市商（AMM）的本质就是这条数学公式。

### 前端交互

DApp 的前端用 ethers.js 连接 MetaMask：

```javascript
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
const dex = new ethers.Contract(contractAddress, abi, signer);

// 添加流动性
await dex.addLiquidity(
    ethers.parseEther("1.0"),
    ethers.parseEther("2000"),
    { gasLimit: 300000 }
);

// 兑换 Token
await dex.swap(tokenAAddress, ethers.parseEther("0.1"));
```

### 学到的教训

写 Solidity 合约最需要注意的是安全性。重入攻击（reentrancy）是最经典的漏洞——攻击合约在 `transfer` 回调中重新调用合约函数，在状态更新之前再次执行逻辑。现在的标准做法是"先更新状态，再转账"，或者用 OpenZeppelin 的 ReentrancyGuard。

## 项目二：Sui Move 链上留言板

Solidity 写熟了之后，想尝试一下新兴的 Move 语言。选择 Sui 而不是 Aptos 纯粹因为 Sui 的文档写得更好。

### Move 和 Solidity 的核心区别

Move 引入了"所有权"概念（和 Rust 很像），资产是**不可复制、不可隐式丢弃**的。转账是"把资产从 A 的账户移动到 B 的账户"，而不是修改一个数字。

```move
module message_board::board {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    struct Board has key {
        id: UID,
        messages: vector<Message>,
    }

    struct Message has store {
        author: address,
        content: String,
        timestamp: u64,
    }
}
```

`has key` 表示 Board 是 Sui 对象（链上存储），`has store` 表示 Message 可以嵌入其他结构体里。

### 写入留言

```move
public entry fun post_message(
    board: &mut Board,
    content: vector<u8>,
    ctx: &TxContext
) {
    let msg = Message {
        author: tx_context::sender(ctx),
        content: string::utf8(content),
        timestamp: tx_context::epoch_timestamp_ms(ctx),
    };
    vector::push_back(&mut board.messages, msg);
}
```

`entry fun` 是公开可调用的入口函数。`&mut Board` 表示对 Board 对象的可变引用——调用者必须拥有这个对象（或是共享对象）才能操作。

### Sui 的特色：对象模型

Sui 把链上所有东西都建模成"对象"——Token 是对象、NFT 是对象、留言板也是对象。对象有生命周期：创建、转移、共享、删除。这比以太坊的账户+存储模型更直观：

```
Solidity:  账户地址 → mapping → 数据
Sui Move:  对象ID → 直接操作对象
```

对象的转移天然防双花——你把一个 Coin 对象转给了别人，它的所有权就变了，你不能再花一次。在 Solidity 里这是靠 `balance[from] -= amount` 来保证的，Move 在语言层面就杜绝了。

## 两个生态的感受

| 维度 | Solidity / EVM | Sui Move |
|------|---------------|----------|
| 学习曲线 | 中等，类似 JS | 偏高，类似 Rust |
| 安全模型 | 靠开发者+审计 | 语言级资产安全 |
| 工具链 | Hardhat/Foundry 成熟 | Sui CLI, 成长中 |
| 生态规模 | 最大，DeFi 项目密集 | 早期，正在建设 |

Web3 目前还是个"泡沫和机遇并存"的领域。但抛开币价涨跌不谈，智能合约编程本身是一种新的开发范式——数据的完整性和执行规则由代码保证而不是由某个机构背书。这个方向上的探索值得认真对待。
