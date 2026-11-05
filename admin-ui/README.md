# 合约管理与调试前端

`admin-ui/` 是本项目计划用于个人学习测试的管理前端，基于 React、TypeScript 和 Vite。目标是通过可视化界面操作已部署到 Solana devnet 的合约，查看链上状态和交易结果。

## 已确定的方向

用户计划在该前端中提供以下操作入口：

- 创建 pool，以及查看相关池子状态。
- 创建 market，以及配置和查看相关市场信息。
- 提交 mock 报价，以及查看报价状态和更新时间。

具体页面设计、参数、初始化依赖和操作流程尚待后续确定。当前只沉淀项目定位，不实施上述功能。

测试 Token 查询与增发、钱包角色展示、流动性操作等是可扩展方向，尚未确定为本阶段的实施范围。

## 当前状态与接入基础

目前为前端基础项目，尚未接入钱包、合约交易或 mock 报价功能。后续接入以当前已部署的 devnet 实例为基础：

- 8 个程序已部署，构建启用 `devnet,mock`。
- 默认 Store、16 个角色和 mock verifier 访问控制已初始化。
- 9 个 K 系列 SPL 测试 Token 已部署，每个初始增发 1 个到管理员钱包。
- 市场、Token Map、oracle/price-feed 等后续业务账户尚未初始化，mock 喂价尚未验证。

公开信息来源：

- [程序部署记录](../config/devnet-mock-deployment.json)。
- [Store 与访问控制初始化记录](../config/devnet-mock-initialization.json)。
- [测试 Token 配置与操作说明](../tokens/README.md)，各 Token 的实际地址和权限见对应目录中的 `token.json`。
- [Devnet 操作说明](../DEVNET-MOCK.md)。

## 后续实现约定

前端复用上述公开部署信息，避免手工维护相互冲突的程序地址和 Token 地址。需要签名的操作由连接的钱包完成；私钥由钱包保管，不得读取或打包 `config/devnet-mock.local/` 下的密钥，也不得将含凭据的本地 Solana CLI RPC 配置直接暴露到前端。

界面应明确展示当前网络、连接钱包、操作前置条件、交易执行状态和失败原因，方便理解每次操作对链上状态的影响。文档统一使用中文，并明确区分计划功能与已实现功能。
