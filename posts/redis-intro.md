# Redis 入门笔记：从零开始理解内存数据库

刚接触 Redis 的时候就觉得这玩意儿挺神奇的——数据存在内存里，读写飞快，但怎么保证不丢数据呢？这篇笔记记录一下我学 Redis 的过程。

## 安装和启动

Linux 下直接 `apt install redis-server` 就行，macOS 用 `brew install redis`。启动更简单：

```
redis-server
```

然后 `redis-cli` 就连上了，默认 6379 端口。一开始我老记不住这个端口号，后来看到有人说 6379 是九宫格键盘上 "M-E-R" 的位置，Merz 是 Redis 作者喜欢的一首歌，就觉得还挺有意思的。

## 五种基础类型

Redis 不是普通的 key-value 存储，value 可以是好几种类型：

**String** — 最基础，存字符串或者数字。`SET name "bing"`，`GET name` 就完事了。数字可以用 `INCR`，我一开始还以为是线程安全的计数器，后来才知道 Redis 是单线程的，计数天然安全。

**List** — 链表，`LPUSH` `RPUSH` `LPOP` `RPOP`，可以当队列或栈用。我之前用 List 做了一个简单的消息队列，生产者 LPUSH，消费者 BRPOP 阻塞等。不过只是玩玩的，生产环境肯定不用这个搞消息队列。

**Set** — 无序集合，去重用的。`SADD` `SREM` `SINTER`。交集、并集这些操作在一些场景下很有用，比如共同好友。

**Hash** — 相当于 Java 里的 HashMap，适合存对象。`HSET user:1 name "bing" age "26"`，不用序列化整个对象，想取哪个字段取哪个。

**Sorted Set** — 有序集合，这个最特别。每个元素关联一个 score，按 score 排序。排行榜场景用这个太合适了，`ZADD` `ZRANGE` `ZREVRANK` 一套下来搞定。

## 持久化：内存数据怎么不丢

这个问题我刚学的时候很关心。Redis 提供了两种方式：

**RDB** — 快照。隔一段时间把内存数据全写进磁盘，`dump.rdb` 文件。优点是恢复快，缺点是两次快照之间的数据可能丢。

**AOF** — 追加日志。每一条写命令都追加到文件里，类似 MySQL 的 binlog。重启时重放一遍。优点是数据更安全，缺点是文件大、恢复慢。

生产环境一般两个都开，RDB 用来备份，AOF 用来保证数据安全。

## 简单总结

Redis 上手确实简单，但要用好、要理解它在分布式场景下的作用，还需要继续学习。下一篇笔记打算写写 Redis 的缓存策略和常见的坑。

```
SET learning "in_progress"
INCR knowledge
```
