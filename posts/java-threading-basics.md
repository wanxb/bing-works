# Java 多线程入门：从 synchronized 到线程池

刚学 Java 的时候，多线程这块一直处于"知道怎么用但说不清为什么"的状态。最近把这块重新理了一遍，这里做个笔记。

## 创建线程的方式

面试必问题。两种方式，实现 Runnable 或者继承 Thread。实际项目中基本都实现 Runnable，因为 Java 单继承，继承了 Thread 就没法继承别的了。

```java
// 推荐这样写
Runnable task = () -> System.out.println("hello");
new Thread(task).start();
```

写 lambda 的话就不用纠结了，反正都是函数式接口。

## synchronized 到底锁了什么

这个我一开始理解错了，以为是锁代码块。实际上是锁对象。

```java
public class Demo {
    public synchronized void methodA() {
        // 锁的是 this
    }

    public static synchronized void methodB() {
        // 锁的是 Demo.class
    }
}
```

实例方法锁 this，静态方法锁 class 对象。同一个实例的两个 synchronized 方法不能同时执行，但不同实例互不影响。

synchronized 代码块可以指定锁对象：

```java
private final Object lock = new Object();
synchronized (lock) {
    // 只锁这一块
}
```

比同步方法粒度更细，性能更好。

## volatile 的可见性

这个关键字困扰了我好一阵。它不保证原子性，只保证**可见性**——一个线程改了值，其他线程立马能看到。

经典场景是标志位：

```java
private volatile boolean running = true;

public void stop() {
    running = false;  // 其他线程立刻可见
}

public void run() {
    while (running) {
        // do work
    }
}
```

如果没有 volatile，running 的修改可能只在当前线程的缓存里，别的线程永远看不到。

## 线程池

不用线程池的话，每次 new Thread 然后 start，用完线程就销毁了，创建销毁的开销挺大的。线程池就是提前创建好一批线程，用完还回去。

```java
ExecutorService pool = Executors.newFixedThreadPool(10);
pool.execute(() -> doSomething());
pool.submit(() -> doSomething());  // 有返回值
pool.shutdown();
```

Executors 提供了好几种工厂方法：newFixedThreadPool、newCachedThreadPool、newSingleThreadExecutor。不过阿里规约说不要用 Executors 直接创建，线程池的最大线程数可能 OOM。生产环境建议用 ThreadPoolExecutor 手动指定参数：

```java
new ThreadPoolExecutor(
    10, 50, 60L, TimeUnit.SECONDS,
    new LinkedBlockingQueue<>(200),
    new ThreadPoolExecutor.CallerRunsPolicy()
);
```

七个参数，挨个理解：核心线程数、最大线程数、空闲存活时间、时间单位、任务队列、线程工厂、拒绝策略。

## 一点感想

多线程这块东西很多，Lock、CAS、ThreadLocal、并发集合类都还没写，后面慢慢补。学这些基础的时候有个体会：先理解它解决什么问题，再看怎么实现，比死记硬背管用多了。
