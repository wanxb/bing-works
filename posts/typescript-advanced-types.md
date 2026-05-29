# TypeScript 高级类型实战：泛型、条件类型与类型体操

用 TypeScript 两年了，前一年基本是"JS + interface"的写法，any 满天飞。最近才发现，TS 的类型系统本身就是一门语言，而且是一门图灵完备的语言。这篇文章整理一些实际开发中用得上的高级类型。

## 泛型不用怕

泛型本质是**类型参数化**——不确定类型的时候先拿个变量占位，调用的时候再确定。写过 list 基本上就理解泛型了：

```typescript
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

const a = first([1, 2, 3]);      // a: number | undefined
const b = first(["a", "b"]);     // b: string | undefined
```

关键是约束泛型范围。不是说 `<T>` 什么都能传，你得告诉编译器 T 大概长什么样：

```typescript
interface HasId {
  id: number;
}

function getById<T extends HasId>(list: T[], id: number): T | undefined {
  return list.find(item => item.id === id);
}
```

`T extends HasId` 保证 T 至少有个 id 属性，不然编译器不让你访问 item.id。

## 条件类型 = 类型里的 if-else

```typescript
type IsString<T> = T extends string ? "yes" : "no";

type A = IsString<"hello">;  // "yes"
type B = IsString<42>;       // "no"
```

单看这个没啥用，配合实际场景就有意思了。比如写一个 API 响应类型：

```typescript
type ApiResponse<T> = T extends { error: string }
  ? { success: false; error: string }
  : { success: true; data: T };

type LoginResp = ApiResponse<{ token: string }>;
// { success: true; data: { token: string } }

type ErrorResp = ApiResponse<{ error: "unauthorized" }>;
// { success: false; error: "unauthorized" }
```

比 union type 更精确，调用方根据 `success` 就能判断 data 在不在。

## 从实际场景入手

最常用的几个内置条件类型：

```typescript
type User = {
  id: number;
  name: string;
  email?: string;
};

type RequiredUser = Required<User>;     // 全部必填
type PartialUser = Partial<User>;       // 全部可选
type ReadonlyUser = Readonly<User>;     // 全部只读
type PickedUser = Pick<User, "id" | "name">;  // 只要 id 和 name
type OmittedUser = Omit<User, "email">;        // 不要 email
```

这些组合起来写 DTO 转换非常方便。更新接口只接受部分字段，用 `Partial`；返回给前端不要敏感字段，用 `Omit`。

## 模板字面量类型

4.1 之后类型可以玩字符串模式匹配了：

```typescript
type EventName = `on${Capitalize<string>}`;
// "onClick" | "onChange" | "onFocus" ...

type Route = `/${string}`;
type API = `/api/${string}/${number}`;

// 实战：定义 HTTP 路径参数
type ExtractParams<T extends string> =
  T extends `${string}:${infer P}/${infer Rest}` 
    ? { [K in P]: string } & ExtractParams<`/${Rest}`>
    : T extends `${string}:${infer P}`
    ? { [K in P]: string }
    : {};
```

`infer` 关键字配合条件类型，可以在类型里做"模式匹配 + 提取"，相当于类型世界的正则捕获组。

## 类型体操要适度

学了这些高级特性后容易有一个冲动：把类型写到极致，编辑器提示零死角。但说实话，过度设计的类型比 any 还可怕——`any` 至少一眼能看出来哪里需要小心，十几层嵌套的条件类型会让你 debug 类型本身比 debug 业务逻辑还累。

我现在的原则是：**公共 API 和接口层把类型写严谨，内部实现适可而止。** 让你的队友能看懂你的类型定义，比类型覆盖 100% 更重要。
