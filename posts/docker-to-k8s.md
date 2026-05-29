# 从 Docker Compose 到 K8s：容器化实践之路

最早用 Docker 只是"在别人机器上能跑"的那个老梗，后来项目要上容器化，从 Compose 一路摸到 Kubernetes，踩了不少坑。

## Docker 初印象

Docker 解决了一个很实在的问题——"我这能跑你那儿不行"。以前配环境要装 JDK、MySQL、Redis、Nginx 一堆东西，有了 Docker 之后一个 `docker-compose up -d` 搞定所有。Dockerfile 写好依赖，镜像一打，哪台机器跑都一样。

最常用的一小段：

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - SPRING_PROFILES_ACTIVE=docker
  mysql:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: root123
  redis:
    image: redis:7-alpine
```

开发环境爽是爽了，但到了生产——单机部署没高可用，健康检查靠手动，扩容靠复制粘贴修改端口。

## 为什么需要编排

假设你有 5 个微服务，每个服务启动要等依赖的上游就绪，还要考虑：

- 机器挂了服务自动迁移
- 流量高了自动加实例
- 配置、密钥统一管理
- 服务发现，不用记 IP 和端口

Docker Compose 不是为这些问题设计的。这时候 Kubernetes 的价值就出来了。

## K8s 核心概念

K8s 的学习曲线确实陡，概念一堆。但搞懂几个最核心的就能用起来：

```
┌─────────────────────────────────────────────────┐
│                    Namespace                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │
│  │ Service │  │ Service │  │  ConfigMap/     │ │
│  │ ClusterIP│  │(对外暴露)│  │  Secret         │ │
│  └────┬────┘  └────┬────┘  └─────────────────┘ │
│       │            │                             │
│  ┌────┴────┐  ┌────┴────┐                        │
│  │   Pod   │  │   Pod   │                        │
│  │┌───────┐│  │┌───────┐│                        │
│  ││ 容器1  ││  ││ 容器1  ││                        │
│  ││ 容器2  ││  ││ 容器2  ││                        │
│  │└───────┘│  │└───────┘│                        │
│  └─────────┘  └─────────┘                        │
│       ↑            ↑                             │
│  ┌────┴────────────┴────┐                        │
│  │     Deployment       │                        │
│  │  (副本数=2, 滚动更新)  │                        │
│  └──────────────────────┘                        │
└─────────────────────────────────────────────────┘
```

- **Pod**：最小调度单元，一个 Pod 里可以放多个容器（通常是 sidecar 模式）
- **Deployment**：管理 Pod 副本数，控制滚动更新和回滚
- **Service**：给 Pod 一个稳定的访问入口，不管 Pod IP 怎么变
- **Ingress**：统一对外暴露 HTTP 路由
- **ConfigMap / Secret**：配置和密钥管理

## 一个真实的部署流程

从代码到上线的大致路径：

1. 写 Dockerfile，`docker build` 打镜像
2. 推到镜像仓库（Harbor / ACR / ECR）
3. 写 Deployment YAML，指定镜像和资源限制
4. 写 Service 给集群内访问，写 Ingress 暴露外网路径
5. `kubectl apply -f .` 部署
6. 看 Pod 日志：`kubectl logs -f deployment/myapp`
7. 出问题排查：`kubectl describe pod`、`kubectl exec` 进去看

实际项目中我们会配合 Helm 做模板化，把几个环境的差异抽成 values.yaml，不用每个环境复制粘贴一大坨 YAML。

## 翻过的车

第一次上生产时，Pod 老是重启——因为没设 `resources.limits`，内存吃多了被 OOM Killer 杀掉。K8s 的 OOM 和前面讲的 JVM OOM 还不太一样，它是容器级别的，Pod 直接进 CrashLoopBackOff。

加了这个就好了：

```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "1Gi"
    cpu: "500m"
```

还有一次滚动更新，因为健康检查的 `readinessProbe` 路径写错了，K8s 以为新 Pod 一直没准备好，永远不替换老 Pod。加了 `initialDelaySeconds: 30` 和应用启动预热时间对上才解决。

## 小结

Docker 解决"能跑"，K8s 解决"稳定地跑"。两者不是替代关系而是互补的——Docker 是单机容器引擎，K8s 是跨机器的编排系统。小项目用 Docker Compose 够了，但一到多实例、滚动发布、自动扩缩这些需求，K8s 的概念成本就被它带来的运维收益抵消了。
