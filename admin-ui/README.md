# GMX Solana Lab

GMX Solana Lab 是本项目用于个人学习测试的管理前端，目录保留为 `admin-ui/`，基于 React、TypeScript 和 Vite。目标是通过可视化界面操作已部署到 Solana devnet 的合约，查看链上状态和交易结果。

## 已确定的方向

用户计划在该前端中提供以下操作入口：

- 创建 pool，以及查看相关池子状态。
- 创建 market，以及配置和查看相关市场信息。
- 提交 mock 报价，以及查看报价状态和更新时间。

市场与池子的具体业务参数、初始化依赖和操作流程尚待后续确定。当前 Home、Market、Pool 为占位页面；Token 页面已实现余额、增发和 Mock 报价，市场与池子业务仍待实现。

测试 Token 查询与增发已实现；钱包角色总览和流动性操作仍待实现。

## 当前状态与接入基础

目前已建立多页面路由和共用导航，已接入钱包、SPL Token 增发及 Mock 报价交易。后续接入以当前已部署的 devnet 实例为基础：

- 8 个程序已部署，构建启用 `devnet,mock`。
- 默认 Store、16 个角色和 mock verifier 访问控制已初始化。
- 9 个 K 系列 SPL 测试 Token 已部署，每个初始增发 1 个到管理员钱包。
- 市场、Token Map、oracle/price-feed 等后续业务账户尚未初始化，mock 喂价已通过无签名模拟，尚未完成真实钱包签名交易验证。

公开信息来源：

- [程序部署记录](../config/devnet-mock-deployment.json)。
- [Store 与访问控制初始化记录](../config/devnet-mock-initialization.json)。
- [测试 Token 配置与操作说明](../tokens/README.md)，各 Token 的实际地址和权限见对应目录中的 `token.json`。
- [Devnet 操作说明](../DEVNET-MOCK.md)。

## 后续实现约定

前端复用上述公开部署信息，避免手工维护相互冲突的程序地址和 Token 地址。需要签名的操作由连接的钱包完成；私钥由钱包保管，不得读取或打包 `config/devnet-mock.local/` 下的密钥。RPC 按下文的本地环境变量配置，含 API key 的 URL 在浏览器中可见，不能作为保密存储。

界面应明确展示当前网络、连接钱包、操作前置条件、交易执行状态和失败原因，方便理解每次操作对链上状态的影响。文档统一使用中文，并明确区分计划功能与已实现功能。

## 开发环境与基础依赖

前端独立管理依赖，使用本目录的 `package.json` 和 `package-lock.json`。在 `admin-ui/` 下执行：

```sh
npm ci
npm run dev
npm run build
npm run lint
```

### 样式与界面

| 依赖 | 用途 |
| --- | --- |
| `tailwindcss`、`@tailwindcss/vite` | Tailwind v4 及官方 Vite 插件，已在 Vite 和全局 CSS 中接入 |
| `clsx`、`tailwind-merge` | 条件类名和 Tailwind 冲突合并，统一使用 `src/lib/utils.ts` 的 `cn()` |
| `lucide-react` | React 图标，按需导入 |

Vite 示例页面、图片和样式已清理。全局基础样式放入 `base` CSS 层，页面与导航使用 Tailwind utilities。

### 钱包、RPC 与链上交互

| 依赖 | 用途 |
| --- | --- |
| `@solana/web3.js` | 使用 1.x API 访问 RPC、派生 PDA、构造和确认交易，与当前 Anchor JS 和钱包适配器配套 |
| `@coral-xyz/anchor` | 固定为与合约一致的 0.31.1，通过本项目 IDL 编码指令、解析账户和错误 |
| `@solana/spl-token` | SPL Token、ATA、余额和 Token 指令 |
| `@solana/wallet-adapter-react` | 已接入 ConnectionProvider、WalletProvider 和钱包 hooks，支持 Wallet Standard 自动发现 |
| `@solana/wallet-adapter-react-ui` | 已接入钱包选择弹窗及连接按钮 |
| `@tanstack/react-query` | RPC 查询缓存、刷新与 mutation 状态 |
| `bn.js`、`@types/bn.js` | Anchor 大整数参数与类型支持 |
| `decimal.js` | Token 数量、价格和精度换算，避免直接用 JavaScript number 处理大额原始数量 |

暂不直接引入另一套 Solana Kit API，也不安装钱包适配器全集；支持 Wallet Standard 的钱包优先自动发现，不支持该标准的钱包可在明确需求后单独添加适配器。钱包依赖自身的传递依赖可能包含 Solana Kit，应用层统一使用上述 web3.js 接口。

### 表单与参数校验

| 依赖 | 用途 |
| --- | --- |
| `react-hook-form` | 管理创建市场、配置参数和报价等表单 |
| `zod` | 定义输入结构并进行运行时校验 |
| `@hookform/resolvers` | 将 Zod 校验接入 React Hook Form |

### 多页面与路由

应用通过 `react-router-dom` 组织多个页面，为各业务页面提供独立 URL 和共用导航。使用兼容当前 Node.js 22.17.0 环境的 7.18.5 版本，从 `react-router-dom` 导入浏览器路由相关 API。

已挂载 `BrowserRouter`，提供共用导航、当前页面高亮、懒加载提示和未知路径提示。Home、Market、Pool 使用占位文本；Token 提供余额、增发与 Mock 报价。

| 页面 | 路径 | 加载方式 | 规划内容 |
| --- | --- | --- | --- |
| Home | `/` | 直接加载 | 应用介绍、页面入口及环境概览 |
| Market | `/market` | 懒加载 | 市场创建、参数配置、状态及 mock 报价入口 |
| Pool | `/pool` | 懒加载 | 流动性池创建、配置与状态 |
| Token | `/token` | 懒加载 | 已实现 Token 信息、余额、增发和 Mock 报价 |

页面分别位于 `src/pages/home/index.tsx`、`src/pages/market/index.tsx`、`src/pages/pool/index.tsx`、`src/pages/token/index.tsx`，每个页面使用独立子目录，入口文件统一命名为 `index.tsx`。Home 静态导入，其他三个页面通过 `React.lazy` 动态导入，配合 `Suspense` 按需加载。生产静态托管需将页面路径回退到 `index.html`，确保直接打开或刷新子页面可以正常访问。

钱包与 RPC Provider 已挂载，Token 页面已接入 SPL Token 与 Store 调用，React Query 管理 Mock 报价查询和刷新；表单库仍按需接入。后续接入需验证实际浏览器中的交易编码与钱包签名；安装依赖和通过构建不代表链上流程已验证。全局状态库、完整组件库和 metadata 写入工具按页面需求另行评估。

## 本地 RPC 配置

前端通过 `VITE_SOLANA_RPC_URL` 指定 RPC，未配置时使用公共 devnet RPC。本机已将 Solana CLI 当前配置的 RPC URL 写入 `admin-ui/.env.local`，浏览器直接连接该地址，不通过本地代理或在运行时访问 CLI。

`.env.local` 被 Git 忽略。修改配置后需要重启 Vite；CLI 的 RPC 地址以后变化时，需同步更新此文件。该变量会进入浏览器代码，若 URL 含 API key，访问页面的用户可以看到该 key；不要发布含私人凭据的构建产物。前端不会读取 CLI 钱包私钥。

WebSocket 通过 `VITE_SOLANA_WS_URL` 显式配置，本机已将 CLI 的 WebSocket URL 写入同一 `.env.local`。交易确认时，web3.js 使用该地址订阅签名状态；Token 余额目前通过 HTTP RPC 查询和手动刷新，未订阅余额变化。不配置此变量时，web3.js 会从 HTTP RPC 地址自动推导 WebSocket 地址。HTTP 和 WebSocket 必须指向同一网络，修改后需重启 Vite。WebSocket URL 同样会在浏览器中可见。

## Token Mock 报价

列表显示「Mock 价格（USD）」、链上报价时间，以及每个 Token 唯一的「Mock 报价」按钮。未连接钱包也可查询；按钮仅供当前部署管理员钱包操作。弹窗再次检查链上 `PRICE_KEEPER` 角色和 devnet genesis hash。管理员权限被撤销时，不能提交。

首次点击时读取固定报价账户，不存在则提示账户租金与交易费用，价格输入留空。确认后，在同一笔交易中创建账户并更新价格，仅需一次钱包签名，任一指令失败全部回滚。已有账户时默认使用链上上一次报价，更新时不再创建账户。输入 USD 单价必须大于零，最多 18 位小数，使用整数编码，不经过浮点数；报告使用 Chainlink V3，benchmark、bid、ask 相同，通过 Snappy 压缩后提交给现有 mock verifier。

固定来源配置位于 `config/devnet-mock-price-feeds.json`：使用公开初始化记录中的 Store、管理员 authority、index 0、provider 0（ChainlinkDataStreams）。每个 Token 的 feed ID 固定为命名空间 `gmx-solana-lab:mock:v1:` 加 mint 的 SHA-256，并将前两个字节设为 `0003`（V3）。账户 PDA 由 Store、管理员、index、provider 和 mint 派生，连接钱包变化不会切换来源。不扫描或合并其他 authority / index 的报价。已经创建账户后，不应随意修改固定来源配置。

报告采用链上 Clock 时间，有效期为 300 秒，用于提交时校验。price feed 不保存报告到期时间，列表只对超过 300 秒的价格提示「建议刷新」，这不是业务价格有效性判定；后续业务有效性由 Token Map heartbeat 等配置决定。列表每 30 秒刷新，也支持手动刷新。尚未报价、读取失败分开展示，失败不作为零价格或账户不存在处理。交易确认检查 `value.err`；已广播但确认结果不明确时保留交易链接，禁用重复提交，需要先核对交易并刷新列表。

目前只更新 price feed，未创建 Token Map、Oracle 或 Market，也不表示市场已采用该价格。已通过无签名 devnet 模拟验证账户创建、价格回读和再次更新；真实钱包签名、浏览器 UI 完整流程仍需实测。

在仓库根目录执行：

```sh
npm run test:mock-prices
npm run mock-prices:check
```

第二条命令读取本机 CLI 的 RPC（不读取钱包私钥），无签名模拟创建与两次报价，不发送交易、不改变链上状态。测试包含精度边界、固定来源、ABI / Snappy、单笔交易大小、账户解码及源 IDL 一致性检查。

前端使用从仓库 Store IDL 提取的必要指令和账户类型，文件在 `src/lib/idl/mock-store.json`。生成脚本为根目录 `scripts/generate-mock-idl.ts`，通过项目本地 `tsx` 运行，并纳入根目录 `npm run typecheck` 检查。合约 IDL 更新后，在仓库根目录执行 `npm run idl:mock` 重新生成，再运行上述测试；`admin-ui/` 下的同名命令也会转调根目录脚本。
