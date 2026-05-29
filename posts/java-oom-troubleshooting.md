# 一次线上 OOM 排查全记录

生产环境的内存问题，排查起来和破案差不多——线索散落在日志、监控和 dump 文件里，需要一点点串起来。这篇文章记录一次完整的 OOM 排查过程。

## 现场

那天下午四点，钉钉告警群开始疯狂弹消息："订单服务 502"，"接口响应时间超过 5s"，接着运维截图甩过来——日志里一片 `java.lang.OutOfMemoryError: Java heap space`。

先不管三七二十一，重启恢复了服务，保住 SLA 再说。然后开始找根因。

## 第一轮排查：看日志

监控显示 OOM 之前 heap 使用率是一条斜着向上的线，GC 频率越来越高但回收的内存越来越少——典型的内存泄漏特征。

我们把内存 dump 拉下来，大概 2 个 GB。用 Eclipse MAT 打开，先看 Leak Suspects：

```
One instance of "java.util.concurrent.ConcurrentHashMap" loaded by 
"sun.misc.Launcher$AppClassLoader" occupies 1,483,260,008 (87.23%) bytes.
```

一个 ConcurrentHashMap 占了堆内存的 87%，接近 1.5GB。顺藤摸瓜往里看——map 里存了几百万个 `OrderInfo` 对象，按订单号做 key。

## 第二轮排查：对代码

Map 的引用链追踪下去，最终定位到一个叫 `OrderSearchCacheManager` 的类：

```java
@Component
public class OrderSearchCacheManager {
    private final Map<String, SearchResult> localCache = new ConcurrentHashMap<>();
    
    public void put(String key, SearchResult result) {
        localCache.put(key, result);
    }
    
    // 没有过期清理机制
    // 没有大小限制
    // 没有弱引用
}
```

问题一目了然——这个"缓存"只往里放、不往外清。每次用户搜索订单，搜索结果就进这个 map，永不过期。业务量上去后，map 无限膨胀直到 OOM。

## 为什么没早发现

代码是三个月前另一个同事写的，当时日搜索量只有几百次。随着业务增长，没人想起这段代码的坑——没有监控 map 大小，没有告警，没有清理策略。

> 一个没有 eviction policy 的缓存，本质上就是一个定时炸弹。

## 修复方案

立即的修复是加 Caffeine Cache 替换裸 Map：

```java
private final Cache<String, SearchResult> localCache = Caffeine.newBuilder()
    .maximumSize(10_000)
    .expireAfterWrite(Duration.ofMinutes(30))
    .recordStats()
    .build();
```

Caffeine 是 Guava Cache 的后继者，W-TinyLFU 淘汰算法性能更好。

同时加了几个兜底措施：

- JVM 参数加上 `-XX:+HeapDumpOnOutOfMemoryError`，下次再 OOM 自动 dump
- 监控堆内存使用率超过 80% 就发告警
- Code Review 清单增加"缓存必须有过期策略"这一条

## 反思

回头看这次事故，根因不是代码写错了，而是**没有对缓存行为做约束**。Map 本身没毛病，但没有边界就会出问题。任何存储都要回答三个问题：存多少（capacity）、存多久（TTL）、满了怎么办（eviction）——缺一个就是坑。
