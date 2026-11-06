# GMX Solana Lab

GMX Solana Lab 是本项目用于个人学习测试的管理前端，目录保留为 `admin-ui/`，基于 React、TypeScript 和 Vite。目标是通过可视化界面操作已部署到 Solana devnet 的合约，查看链上状态和交易结果。

## 已确定的方向

用户计划在该前端中提供以下操作入口：

- 创建 pool，以及查看相关池子状态。
- 创建 market，以及配置和查看相关市场信息。
- 提交 mock 报价，以及查看报价状态和更新时间。

具体业务参数、初始化依赖和操作流程尚待后续确定。当前已准备开发依赖、Tailwind 样式环境和四个占位页面，尚未实施上述业务功能。

测试 Token 查询与增发、钱包角色展示、流动性操作等是可扩展方向，尚未确定为本阶段的实施范围。

## 当前状态与接入基础

目前已建立多页面路由和共用导航，尚未接入钱包、合约交易或 mock 报价功能。后续接入以当前已部署的 devnet 实例为基础：

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
| `@solana/wallet-adapter-react` | 后续接入 ConnectionProvider、WalletProvider 和钱包 hooks，支持 Wallet Standard 自动发现 |
| `@solana/wallet-adapter-react-ui` | 后续接入钱包选择弹窗及连接按钮 |
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

已挂载 `BrowserRouter`，提供共用导航、当前页面高亮、懒加载提示和未知路径提示。页面仅使用占位文本描述用途，未实现业务功能。

| 页面 | 路径 | 加载方式 | 规划内容 |
| --- | --- | --- | --- |
| Home | `/` | 直接加载 | 应用介绍、页面入口及环境概览 |
| Market | `/market` | 懒加载 | 市场创建、参数配置、状态及 mock 报价入口 |
| Pool | `/pool` | 懒加载 | 流动性池创建、配置与状态 |
| Token | `/token` | 懒加载 | 测试 Token 信息与管理 |

页面分别位于 `src/pages/home/index.tsx`、`src/pages/market/index.tsx`、`src/pages/pool/index.tsx`、`src/pages/token/index.tsx`，每个页面使用独立子目录，入口文件统一命名为 `index.tsx`。Home 静态导入，其他三个页面通过 `React.lazy` 动态导入，配合 `Suspense` 按需加载。生产静态托管需将页面路径回退到 `index.html`，确保直接打开或刷新子页面可以正常访问。

以上钱包、RPC、表单依赖目前仅完成安装，尚未挂载 Provider、配置 RPC endpoint 或实现链上调用。后续接入需验证实际浏览器中的交易编码与钱包签名；安装依赖和通过构建不代表链上流程已验证。全局状态库、完整组件库和 metadata 写入工具按页面需求另行评估。
