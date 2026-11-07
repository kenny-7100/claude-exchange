# 项目协作约定

## 项目状态

- 本项目为 GMX-Solana，主要使用 Rust、Anchor 0.31.1、Solana CLI 2.1.21。
- 已使用独立 Program ID 将全部 8 个程序部署到 devnet，构建 features 为 `devnet,mock`，不启用 `test-only` 或 `migration`。
- 部署信息见 `config/devnet-mock-deployment.json`，操作说明见 `DEVNET-MOCK.md`。
- 已初始化默认 Store、16 个角色及 mock verifier access control；Store authority、receiver、holding 和全部角色均为当前部署钱包，mock access controller 的 user 为 Store PDA。
- 初始化记录见 `config/devnet-mock-initialization.json`，可用 `just initialize-devnet-mock` 重复运行；市场、Token Map、oracle 等后续业务账户尚未初始化。已通过无签名 devnet 模拟验证 mock price feed 创建、报价写入与更新，尚未通过钱包发送真实报价交易。
- 已将全部 9 个 K 系列 SPL 测试 Token 部署到 devnet，初始供应量和管理员余额均为 1；增发及 metadata 更新权限均保留给当前 CLI 钱包，未设置冻结权限。配置和链上记录见 `tokens/*/token.json`，中文说明见 `tokens/README.md`。
- 私钥位于 Git 忽略的 `config/devnet-mock.local/`，不得提交。

## 文档语言

- 今后新增和更新的项目文档统一使用中文，包括 README、操作说明、设计说明和阶段性记录。
- 代码标识符、命令、配置字段、地址及必要的技术名称保留原文。

## 管理前端 admin-ui

- `admin-ui/` 定位为个人学习测试使用的合约管理和调试前端，使用 React、TypeScript、Vite。
- 用户明确计划通过 UI 创建 pool、创建 market、提交 mock 报价；具体页面、参数和交互流程待后续确定。
- 应用名称为 GMX Solana Lab，目录保留为 `admin-ui/`。已建立 Home、Market、Pool、Token 四个页面；Home 直接加载，其余三个页面懒加载。已接入钱包、Token 余额与增发，以及固定来源的 Mock 价格展示和报价弹窗；首次报价将创建账户与更新价格放入同一笔钱包交易。Home、Market、Pool 仍为占位页面，Mock 报价尚未进行真实钱包交易验证。
- 后续接入以现有 devnet 程序、Store 和测试 Token 为基础，复用 `config/`、`tokens/` 中的公开部署信息；交易由连接的钱包签名，前端不得读取或打包本地私钥及含凭据的 CLI RPC 配置。
- 详细说明见 `admin-ui/README.md`，计划功能不得描述为已实现。

## TypeScript 脚本

- Token 部署及后续管理工具使用 TypeScript，放在 `scripts/` 下，通过项目本地 `tsx` 运行。
- 根目录使用 npm 管理脚本依赖，提交 `package-lock.json`，新环境使用 `npm ci` 安装。
- 使用 `npm run typecheck` 检查脚本类型；`tsx` 执行脚本时不会自动进行类型检查。
- 测试 Token 使用 `npm run tokens:check` 检查、`npm run tokens:deploy` 部署或恢复、`npm run tokens:verify` 核对；支持 `-- --token kbtc` 指定单个 Token。已有 mint 时不重复增发。

## Git 提交与推送

- Commit message 使用 `feat: xxx`、`fix: xxx` 或 `chore: xxx` 格式。
- 用户说 `push` 时，视为授权暂存全部改动、提交并推送，直接执行：

  ```sh
  git add . && git commit -m 'xxx' && git push
  ```

- 根据当前对话上下文快速简要总结 commit message 即可；不额外扫描文件、审查 diff、运行测试或反复思考，不请求确认。
- 仅在命令失败时进行必要排查；没有可提交改动时直接执行 `git push`。
