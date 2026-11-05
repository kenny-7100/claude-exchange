# 支持 mock 预言机的独立 devnet 部署

本项目使用独立的 8 个 Program ID，已同步至程序声明、callback 检查、Anchor 配置和 SDK IDL。公开部署信息、二进制哈希、交易结果及核对 slot 记录在 `config/devnet-mock-deployment.json` 中。

## 构建

```sh
just build-devnet-mock
```

SBF 构建启用 `devnet,mock`，使用 platform-tools v1.56 和架构 v0。本地 SBF builder 必须支持这些选项；已安装版本为 4.4.0。Anchor 版本为 0.31.1，Solana CLI 版本为 2.1.21。IDL 生成使用 Anchor 的 nightly 主机工具链；已验证可用的版本为 Rust 1.101.0-nightly（92b5b8c87 2026-10-29）。不启用 `test-only` 或 `migration`。

SBF 文件生成至 `target/deploy/`，全部 8 份 IDL 生成至 `target/idl/`，其中 6 份 SDK IDL 同步至 `crates/programs/idls/`。

## 程序部署与核对

将 Solana CLI 配置为 devnet RPC，并使用部署清单中 `upgrade_authority` 对应的钱包，然后执行：

```sh
just deploy-devnet-mock
just verify-devnet-mock
```

部署脚本在发送交易前检查 devnet genesis hash、钱包、程序密钥和 IDL 地址。首先部署 mock verifier，保留当前钱包的升级权限，并下载每个链上程序，与本地二进制逐字节比较。已经核对且内容未改变的程序只重新检查，不重复部署。上传 buffer 密钥会持久保存，便于中断后恢复。

程序和 buffer 密钥保存在 Git 忽略的 **`config/devnet-mock.local/`** 中。请安全备份该目录；它位于 `target/` 外，避免 `cargo clean` 删除部署身份。部署日志和下载的二进制也保存在该目录，不得提交其内容。清理构建目录后，若要使用 Anchor 自带的 deploy/keys 命令，应先将程序密钥恢复至 `target/deploy/`；本项目部署脚本直接使用持久保存的密钥副本。

## Store 与 mock 访问控制初始化

使用部署时相同的 devnet RPC 和 Solana CLI 钱包，运行：

```sh
just initialize-devnet-mock
```

SDK 示例读取 Solana CLI 的 RPC 和密钥配置，检查 devnet genesis hash 和部署权限，然后初始化默认 Store。Store 的 authority、receiver 和 holding 地址均为当前 CLI 钱包。针对个人学习测试用途，初始化记录中的 16 个角色全部启用并授予该钱包，包括 keeper、配置、Treasury 和 Timelock 相关角色，不包含 migration 角色。角色授权本身不代表已创建 Treasury 或 Timelock 的业务账户。

Mock verifier 的 authority 也是当前钱包。Access controller 允许的 `user` 必须为 **Store PDA**，因为 verifier CPI 由 Store 签名调用。即使 keeper 权限属于钱包，也需要这一 PDA 绑定。Verifier 和 access controller 是该 mock 程序下的单例 PDA；已有账户绑定不一致时，初始化会停止。

公开账户地址、成功交易签名和核对 slot 保存至 `config/devnet-mock-initialization.json`。每笔交易确认后保存进度。重复运行会读取链上状态，跳过已有且一致的初始化和授权，然后核对最终结果。SDK 示例需要 `client,devnet` features，不重新构建或部署链上程序。

## 测试 Token

全部 9 个 K 系列 SPL 测试 Token 已部署到 devnet，每个 Token 初始增发 1 个完整 Token 到当前 CLI 钱包。增发和 metadata 更新权限保留给该钱包，不设置冻结权限。

部署配置、素材和链上结果位于 `tokens/`，操作说明见 [测试 Token 文档](tokens/README.md)。通过以下命令检查或恢复：

```sh
npm run tokens:check
npm run tokens:deploy
npm run tokens:verify
```

## 尚未完成的范围

市场、Token Map、oracle/price-feed 和其他后续业务账户尚未初始化，尚未提交 mock 报价或交易业务请求。GT Incentive 仍为现有的仅包含初始化逻辑的程序。

默认 Store PDA 同时记录在部署清单中。Mock 报价使用 `ChainlinkDataStreams` provider，仍要求正确的 keeper/authority、匹配的 feed ID、有效的价格范围和新鲜时间戳。启用 `mock` 的 Store 也继续接受真实 Chainlink verifier。Mock 报价生成和提交工具仍待实现。

当前工作流只在本地生成 IDL；发布到链上 IDL 账户需要单独执行。
