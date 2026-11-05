# Devnet 测试 Token

本目录管理 KBTC、KDOGE、KETH、KHYPE、KLINK、KSOL、KUSDC、KUSDT、KWETH 共 9 个测试 Token。每个 Token 使用独立子目录，包含以下文件：

- `<token>.svg`：从 `https://kgmx.jimao.uk` 下载的原始图片。
- `<token>.json`：从同一站点下载的原始 metadata。
- `token.json`：部署配置和部署结果记录。

图片和 metadata 都是公开素材。全部 9 个 Token 已部署到 devnet，状态为 `deployed`，链上 mint、Metaplex metadata 和管理员 ATA 均已创建；每个 Token 初始增发 1 个完整 Token 到管理员钱包，供应量和权限已完成链上核对。真实地址、交易签名及核对时间和 slot 记录在各自 `token.json` 中。

## 精度与初始供应量

| Token | 精度（decimals） | 初始供应量 |
| --- | ---: | ---: |
| KBTC | 8 | 1 |
| KDOGE | 8 | 1 |
| KETH | 8 | 1 |
| KHYPE | 8 | 1 |
| KLINK | 8 | 1 |
| KSOL | 9 | 1 |
| KUSDC | 6 | 1 |
| KUSDT | 6 | 1 |
| KWETH | 8 | 1 |

KSOL 沿用 SOL 的 9 位精度，美元测试 Token 使用 6 位，其余测试资产统一使用 8 位。KETH 和 KWETH 也采用 8 位，在保留足够小数精度的同时，为 SPL Token 的 `u64` 供应量上限留出更多整数容量。mint 创建后，精度无法修改。

`initial_supply` 使用字符串表示 Token 数量，`initial_supply_raw` 使用整数字符串表示最小单位数量。所有 Token 的 `initial_supply` 均为 `"1"`；`initial_supply_raw` 为 `10^decimals`。部署时创建管理员的关联 Token 账户（Associated Token Account，ATA），将 1 个完整 Token 增发至该账户。

这些 Token 都是独立测试资产；KSOL 和 KWETH 也不涉及原生 SOL 包装或 ETH 跨链。

## 管理员与权限

`administrator` 为计划使用的管理员和接收钱包，与 `planned_authorities` 中记录的当前 Solana CLI 钱包一致：

```text
J11xHtw4dkogTwexUkWaMH8PyFNGYdJuLg5TNvxeag4Q
```

- 增发权限（mint authority）：由该钱包持续持有，方便以后按需增发。
- Metadata 更新权限：由该钱包持有。
- 冻结权限（freeze authority）：不设置。

`planned_authorities` 记录计划权限；实际的 `mint_authority` 和 `metadata_update_authority` 已根据链上核对结果填写。`freeze_authority: null` 表示没有设置冻结权限。完成初始增发后继续保留增发权限，管理员可以按需增发。

## Metadata 配置

使用经典 SPL Token Program，并通过 Metaplex 的 Fungible 标准创建链上 metadata，指向各自记录的公网 `metadata_uri`。

- 名称、符号和 URI 使用各自 `token.json` 的配置。
- Metadata 允许管理员更新。
- Seller fee 为 0。
- 不设置 creators、collection 或 uses。

上述内容属于部署配置；下载的原始 metadata JSON 和 SVG 素材保持原样。

## 部署记录与私钥

后续部署和管理脚本使用 TypeScript，放在项目根目录的 `scripts/` 下。开发环境使用 Node.js 22 或更新版本，在项目根目录执行：

```sh
npm ci
npm run typecheck
```

通过 `npx --no-install tsx scripts/<脚本名>.ts` 运行脚本。`tsx` 负责执行 TypeScript，类型检查需单独运行 `npm run typecheck`。依赖包含 Solana Web3.js、SPL Token、Metaplex Token Metadata 及 Umi SDK，具体版本由根目录 `package-lock.json` 锁定。部署脚本为 `scripts/deploy-test-tokens.ts`。

```sh
# 只检查配置、网络、钱包、程序及交易构建，不写文件、不发送交易
npm run tokens:check

# 部署全部 9 个 Token，或恢复中断的部署
npm run tokens:deploy

# 只核对链上状态，不写文件、不发送交易
npm run tokens:verify

# 仅处理一个 Token
npm run tokens:deploy -- --token kbtc
```

直接运行脚本且未指定模式时，默认为检查模式。检查模式不进行交易模拟；部署模式发送交易前由 RPC 执行 preflight 模拟。每个 Token 的 mint、metadata、ATA 创建和初始增发在一笔原子交易内完成，任一步失败则整笔交易回滚。

部署前将 mint 密钥和已签名交易保存到 `config/devnet-mock.local/test-tokens/`。重试时沿用原来的 mint，未过期交易沿用原签名重发；确认过期后才允许构建新交易。已有 mint 时只核对，不重复增发。部署进度、交易签名、实际权限和核对结果写回各自 `token.json`。请同时备份公开部署记录和私有密钥目录。

部署模式通过私有目录中的 `deploy.lock/` 防止并发运行；正常结束或抛出异常会释放锁。如果进程被强制终止，应先确认没有部署进程仍在运行，再手动删除残留锁目录并重试。

核对要求供应量和管理员余额均等于初始的 1 个 Token。以后手动增发或转出后，核对命令会报告与初始配置不一致，并且不会自动补发或销毁 Token。

发送交易前，部署工具应核对当前 CLI 钱包和 devnet genesis hash 是否与配置一致。部署后填入真实的 mint 地址、实际权限、metadata 账户、管理员 ATA 和交易签名，完成链上核对后再更新部署状态。

这些目录只保存公开素材、配置和部署记录。不得保存 mint 私钥、钱包私钥或助记词。需要持久保存的私钥统一放在 Git 忽略的 `config/devnet-mock.local/` 中。
