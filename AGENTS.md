# 项目协作约定

## 项目状态

- 本项目为 GMX-Solana，主要使用 Rust、Anchor 0.31.1、Solana CLI 2.1.21。
- 已使用独立 Program ID 将全部 8 个程序部署到 devnet，构建 features 为 `devnet,mock`，不启用 `test-only` 或 `migration`。
- 部署信息见 `config/devnet-mock-deployment.json`，操作说明见 `DEVNET-MOCK.md`。
- 已初始化默认 Store、16 个角色及 mock verifier access control；Store authority、receiver、holding 和全部角色均为当前部署钱包，mock access controller 的 user 为 Store PDA。
- 初始化记录见 `config/devnet-mock-initialization.json`，可用 `just initialize-devnet-mock` 重复运行；代币、市场、oracle 等后续业务账户尚未初始化，尚未验证 mock 喂价。
- 私钥位于 Git 忽略的 `config/devnet-mock.local/`，不得提交。

## 文档语言

- 今后新增和更新的项目文档统一使用中文，包括 README、操作说明、设计说明和阶段性记录。
- 代码标识符、命令、配置字段、地址及必要的技术名称保留原文。

## Git 提交与推送

- Commit message 使用 `feat: xxx`、`fix: xxx` 或 `chore: xxx` 格式。
- 用户说 `push` 时，视为授权暂存全部改动、提交并推送，直接执行：

  ```sh
  git add . && git commit -m 'xxx' && git push
  ```

- 根据当前对话上下文快速简要总结 commit message 即可；不额外扫描文件、审查 diff、运行测试或反复思考，不请求确认。
- 仅在命令失败时进行必要排查；没有可提交改动时直接执行 `git push`。
