# 模型量化与本地部署实战：从 GGUF 到 vLLM

> 写作日期：2025-02-18

ChatGPT 很香，但有些场景必须用本地模型：

- 你的数据不能出内网（金融、医疗、法律）
- 需要低延迟、不用等排队
- 要跑大量测试，API 费用扛不住
- 想玩开源模型但不想被厂商锁定

这篇文章是我自己折腾本地部署的实战记录。不聊概念，只说怎么落地。

## 核心概念：为什么要量化

大模型本质上是一个巨大的矩阵——参数越多，精度越高，但需要的内存也越大。

```
FP16 (16-bit float)：每个参数 2 字节
  70B 模型需要 70B × 2B = 140GB 显存

INT4 (4-bit integer)：每个参数 0.5 字节
  70B 模型需要 70B × 0.5B = 35GB 显存

INT8 (8-bit integer)：每个参数 1 字节
  70B 模型需要 70B × 1B = 70GB 显存
```

量化就是把模型参数的精度降低（从 16 位浮点数变成 4 位整数），从而大幅减少内存占用。代价是精度损失，但好消息是——**对于 7B 以上的模型，合理的量化方式（如 Q4_K_M）在大多数任务上的精度损失 < 1%**。

以我的 24GB RTX 3090 为例：

| 模型 | 精度 | 是否跑得动 |
|------|------|-----------|
| Llama 3.1 8B | FP16 (16GB) | ✅ 刚好够 |
| Qwen 2.5 7B | FP16 (14GB) | ✅ |
| Llama 3.1 70B | FP16 (140GB) | ❌ |
| **Llama 3.1 70B** | **Q4_K_M (35GB)** | ❌ 仍不够 |
| **Llama 3.1 70B** | **Q2_K (17.5GB)** | ⚠️ 能跑但质量下降 |
| Qwen 2.5 32B | Q4_K_M (16GB) | ✅ |

核心结论：**24GB 显存的极限是 Q4 量化后的 30B-40B 模型。**

## 方案对比：三种主流本地部署方式

从易到难，三种主流方案各有适用场景：

### 方案一：Ollama（最推荐起步）

Ollama 把本地部署简化到了极致：

```
# 安装后用一行命令跑一个模型
ollama run qwen2.5:7b

# 或者直接调用 API
curl http://localhost:11434/api/generate -d '{
  "model": "qwen2.5:7b",
  "prompt": "你好，请介绍一下你自己"
}'
```

**适合场景**：个人使用、原型验证、小团队。

**我的体会**：Ollama 太方便了，以至于容易让人忽略底层原理。新手直接用 Ollama 完全没问题，但我建议至少了解一下它做了什么——模型格式转换、量化加速、显存管理——这些概念在换用其他方案时都会遇到。

**支持的量化格式**：主要是 GGUF + 它内置的量化选项（q4_0、q4_K_M、q5_K_M 等），从 HuggingFace 拉模型时会自动处理。

**性能实测**：

| 模型 | 硬件 | tokens/s | 体验 |
|------|------|----------|------|
| Qwen 2.5 7B Q4 | RTX 3090 | ~70 t/s | 飞快的 |
| Qwen 2.5 32B Q4 | RTX 3090 | ~18 t/s | 流畅可读 |
| Llama 3.1 8B Q4 | Mac M1 16GB | ~25 t/s | 能用 |
| Mistral 7B Q4 | Mac M1 16GB | ~30 t/s | 流畅 |

**Ollama 的最佳实践**：

- 设置 `OLLAMA_NUM_PARALLEL=4` 支持并发请求
- 用 `OLLAMA_KEEP_ALIVE=0` 在不使用时释放显存
- 模型文件默认在 `~/.ollama/models/`，可以改环境变量指向大容量盘
- 如果需要多 GPU，Ollama 会自动检测并利用所有显存

### 方案二：llama.cpp（性能最极致）

llama.cpp 是 Ollama 的底层引擎，直接使用 C++ 实现，效率极高。适合需要精细控制量化参数、或者需要在 CPU 上跑模型的场景。

```
# 克隆编译
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
make -j

# 下载模型（GGUF 格式）
# 从 HuggingFace 上找 GGUF 格式的模型

# 运行
./llama-cli -m qwen2.5-7b-Q4_K_M.gguf \
  -p "请用中文介绍一下深度学习" \
  -n 512 \
  -t 8
```

**什么时候不要用 Ollama 而用 llama.cpp？**

1. **需要自己调量化参数**——Ollama 只暴露了几个预设量化选项，llama.cpp 可以精细到每个 layer 的量化类型
2. **需要 CPU 推理**——llama.cpp 在 CPU 上的优化比 Ollama 更好
3. **需要嵌入到其他应用**——llama.cpp 提供 C++ API 和 Python binding
4. **需要 batch 推理**——批量处理时 llama.cpp 的 throughput 更高

**llama.cpp 的量化等级选择**：

```
q2_K：2-bit 量化，极省显存，质量下降明显
q3_K_M：3-bit，中庸之选
q4_0：4-bit 不分组，最快但质量稍差
q4_K_M：4-bit 分组，质量/速度最佳平衡 ← 推荐
q5_K_M：5-bit 分组，质量高但显存增加 25%
q6_K：6-bit，几乎无损
q8_0：8-bit，无损但显存翻倍
```

我的经验：**非敏感任务用 q4_K_M，追求质量用 q5_K_M，q2_K 只有在显存实在不够时才用。**

### 方案三：vLLM（生产环境首选）

当你的场景需要支持多用户并发、高吞吐、生产级部署时，Ollama 和 llama.cpp 就不够用了。vLLM 专为此而生。

```
# 安装
pip install vllm

# 启动 API 服务
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-7B-Instruct \
  --dtype auto \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.9

# 调用方式与 OpenAI API 兼容
curl http://localhost:8000/v1/chat/completions -d '{
  "model": "Qwen/Qwen2.5-7B-Instruct",
  "messages": [{"role": "user", "content": "你好"}]
}'
```

**vLLM 的核心优势是 PagedAttention**——它把 KV Cache 分页管理，解决了显存碎片问题，可以比常规方案多处理 2-4 倍的并发请求。

**什么时候上 vLLM？**

1. 需要服务多个用户/服务（QPS > 10）
2. 需要兼容 OpenAI API 格式
3. 需要 Continuous Batching（动态批处理）
4. 需要 Prefix Caching（前缀缓存加速）

**vLLM 的性能数据（RTX 3090，Qwen 2.5 7B）**：

| 并发数 | Throughput | 每请求延迟 |
|--------|-----------|-----------|
| 1 | ~65 t/s | ~1.5s |
| 4 | ~180 t/s | ~2.2s |
| 8 | ~280 t/s | ~3.8s |
| 16 | ~350 t/s | ~7.5s |

**生产配置的最佳实践**：

```
# 关键参数说明
--gpu-memory-utilization 0.9    # 留 10% 给其他进程
--max-num-seqs 256              # 最大并发序列数
--enable-prefix-caching          # 开启前缀缓存（适合共享 system prompt）
--kv-cache-dtype fp8             # KV Cache 也用 FP8 节省显存
--max-model-len 8192             # 上下文长度，不要设太大浪费显存
```

## 量化转换实战：从头量化一个模型

以 Qwen 2.5 7B 为例，从原始 FP16 转到 GGUF Q4_K_M：

```
# 1. 下载原始模型 safetensors（HuggingFace）
git lfs clone https://huggingface.co/Qwen/Qwen2.5-7B-Instruct

# 2. 用 llama.cpp 的 convert.py 转 GGUF
python convert.py Qwen2.5-7B-Instruct/ \
  --outfile qwen2.5-7b-fp16.gguf \
  --outtype f16

# 3. 量化
./llama-quantize qwen2.5-7b-fp16.gguf \
  qwen2.5-7b-q4_K_M.gguf \
  q4_K_M
```

过程耗时约 15 分钟（取决于硬盘速度），完成后文件从 ~14GB 降到 ~4.5GB。

## 踩坑记录

本地部署的坑比想象多，记录的给我印象最深的几个：

### 坑 1：显存爆炸——上下文长度

第一次跑 32B 模型，输入了一段 5000 tokens 的文本，直接 OOM。

原因：**KV Cache 的大小跟上下文长度的平方成正比**。你的模型可能只占 16GB，但如果把 `max_seq_len` 设到 32K，KV Cache 会额外吃掉 8-10GB。

解决：根据实际需求设置上下文长度。大部分场景 4K-8K tokens 绰绰有余。

```
# vLLM
--max-model-len 4096

# llama.cpp
./llama-cli -c 4096  # -c 就是 context size
```

### 坑 2：精度选择——Q4_K_M 不等于 Q4_K_M

同一个模型的 Q4_K_M，不同量化器的实现不一样。llama.cpp 的 Q4_K_M 和 AutoGPTQ 的 Q4 虽然都叫"4-bit"，实际行为有差异。**尽量用同一种量化方案的一致性比较**。

一个小测试：同一个 prompt 让 Q4_K_M 和 FP16 版本分别跑 10 次，输出的差异率大约在 2-5%——对于对话场景完全可接受，对于代码生成有细微差异。

### 坑 3：Chat Template——为什么有些模型答非所问

不同的模型要求不同的 Chat Template。同一个 prompt 在 Qwen 上正常，在 Llama 上可能输出乱码。

```
# Qwen 的格式
<|im_start|>system
你是 Qwen 助手
<|im_end|>
<|im_start|>user
你好
<|im_end|>
<|im_start|>assistant

# Llama 的格式
<|begin_of_text|><|start_header_id|>system<|end_header_id|>
你是 Llama 助手<|eot_id|>
<|start_header_id|>user<|end_header_id|>
你好<|eot_id|>
<|start_header_id|>assistant<|end_header_id|>
```

Ollama 和 vLLM 会自动处理这个，但 llama.cpp 自己跑时需要指定正确的 template。用错了表现会很奇怪。

### 坑 4：多 GPU 没那么简单

两张 3090 并不等于一张 48GB 的 A6000。多 GPU 推理有两种模式：

```
张量并行（Tensor Parallelism）
  把一层拆到多张卡上
  好处：单请求延迟低
  坏处：卡间通信开销大
  适合：延迟敏感场景

流水线并行（Pipeline Parallelism）
  不同的层放在不同卡上
  好处：通信开销小
  坏处：存在"气泡"（空闲等待）
  适合：高吞吐场景
```

一般来说，显存够用就不要上多卡。两张卡之间的通信带宽（PCIe）和单卡内部带宽（HBM）差了一个数量级。

## 什么时候用哪种方案

我自己的决策矩阵：

```
┌─────────────────────────────────────────────────────┐
│ 场景                          │ 推荐方案             │
├─────────────────────────────────────────────────────┤
│ 个人尝鲜，跑一跑模型看看效果      │ Ollama ✅           │
│ 开发测试，需要稳定 API           │ Ollama / vLLM       │
│ 嵌入到自己的 Python 应用         │ llama.cpp binding   │
│ 生产服务，多用户并发             │ vLLM ✅             │
│ CPU 推理（无 GPU）              │ llama.cpp ✅         │
│ 需要自定义量化参数               │ llama.cpp ✅         │
│ 边缘设备 / 嵌入式                │ llama.cpp (小模型)   │
└─────────────────────────────────────────────────────┘
```

## 本地模型的未来

2025 年的感受：本地部署的门槛越来越低。Ollama 的一键安装、vLLM 的高效推理、GGUF 的格式统一，让一个人在 24GB 显卡上跑 32B 模型成为了日常。

但也要客观地说：**本地模型和云端模型之间的差距仍在**。同等参数规模下，本地模型的"智商"比不上 GPT-4o 或 Claude，更大的上下文窗口（100K+ tokens）在本地也还是难题。但如果你需要隐私、离线、低成本、高并发中的一个，本地部署就是不可替代的选项。

最后送一个建议：**不要为了跑大模型而买昂贵的硬件**。先算清楚你的场景需要多大的模型，再决定买什么卡。很多时候 Qwen 2.5 7B Q4 就够用了，一张 2000 块的二手 3060 就能跑得很舒服。
