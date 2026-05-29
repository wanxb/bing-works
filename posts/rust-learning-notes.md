# Rust 初探：所有权、借用与生命周期的理解

学 Rust 之前就听说它"学习曲线陡峭"。花了大概两周把基础知识走了一遍，发现确实陡——但不是难，而是它的概念和之前学过的语言都不一样。习惯了 Java/C# 的 GC、Python 的引用计数之后，突然要直面"所有权"这个概念，脑回路需要重新布线。

## 所有权：Rust 的核心设定

Rust 没有 GC，也没有手动 malloc/free。它的内存管理靠的是**所有权（Ownership）**规则：

```
每个值只有一个所有者。
所有者离开作用域，值被自动释放。
```

初看没啥特别，一个例子就明白区别了：

```rust
let s1 = String::from("hello");
let s2 = s1;

println!("{}", s1);  // 编译错误！s1 已经"移动"给了 s2
```

在其他语言里 `s2 = s1` 是拷贝引用，两个变量指向同一块内存。Rust 不是——它把所有权**转移**给了 `s2`，`s1` 失效了。这称为**移动语义（Move）**。

刚开始会觉得很烦，但这套规则消除了 double free、use-after-free、悬垂指针这些内存 bug。GC 语言在运行时帮你管内存，Rust 是在编译期就保证安全。

对于简单类型（整数、布尔等实现了 Copy trait 的），赋值是复制而不是移动：

```rust
let x = 42;
let y = x;
println!("{}", x);  // 没问题，i32 实现了 Copy
```

## 借用：一把数据可以多人看，但不能同时改

每次都转移所有权太不方便了，函数调用、遍历都要把数据传进去还回来。于是有了**借用（Borrowing）**：

```rust
fn print_len(s: &String) {  // 借一个不可变引用
    println!("{}", s.len());
}

let s = String::from("hello");
print_len(&s);   // & 创建引用
println!("{}", s);  // s 仍然可用
```

借用的核心约束：

```
在同一时刻，要么有多个不可变引用，要么只有一个可变引用。两者不能共存。
```

这不就是读写锁的静态版本吗——多个读者 OK，写者独占。Rust 在编译期就帮你检查了。

```rust
let mut v = vec![1, 2, 3];
let r1 = &v;
let r2 = &v;        // OK，多个不可变引用
let r3 = &mut v;    // 编译错误！已有不可变引用时不能可变借用
```

这个规则阻止了经典的迭代器失效问题：遍历集合时修改集合。Java 里这种行为抛 `ConcurrentModificationException`（运行时），Rust 直接让你编译不过。

## 生命周期：防止引用空悬

生命周期（Lifetime）是借用检查器的延伸。编译器怎么知道一个引用没有指向已释放的数据？靠生命周期标注：

```rust
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}
```

`'a` 告诉编译器：返回的引用和两个输入参数中**较短命**的那个活得一样久。不做这个标注编译器不知道返回值是从 x 还是 y 来的。

大部分场景编译器能自动推断（生命周期省略规则），不需要手动写。但在跨函数返回引用时需要。

## 模式匹配与枚举

Rust 的枚举比 Java/C# 强大太多，每个变体可以携带数据：

```rust
enum Result<T, E> {
    Ok(T),
    Err(E),
}

fn read_file(path: &str) -> Result<String, io::Error> {
    match std::fs::read_to_string(path) {
        Ok(content) => Ok(content),
        Err(e) => Err(e),
    }
}
```

match 表达式是**穷举**的——你必须处理所有分支，编译器会检查。`Option<T>` 和 `Result<T, E>` 没有 null，不存在空指针异常。习惯了以后写 Java 看到 `NullPointerException` 会觉得很荒谬。

## 初学感受

Rust 的学习过程有点像和编译器打架——前两周每天都在修编译错误。所有权、借用这些概念不是看一遍就能理解的，必须亲手写，让编译器报错，然后理解它为什么不让这么写。

但过了那个阶段之后，会发现编译器其实是在教你写正确的代码。Rust 最让人踏实的一点是：**一旦编译通过，程序出现内存 bug 的概率极低。** 这个保证是其他系统级语言给不了的。
