# Devnet 测试 Token

本目录管理 KBTC、KDOGE、KETH、KHYPE、KLINK、KSOL、KUSDC、KUSDT、KWETH 共 9 个测试 Token。每个 Token 使用独立子目录，包含以下文件：

- `<token>.svg`：从 `https://kgmx.jimao.uk` 下载的原始图片。
- `<token>.json`：从同一站点下载的原始 metadata。
- `token.json`：部署配置和部署结果记录。

图片和 metadata 都是公开素材。当前已完成部署前配置，状态为 `pending_deployment`，尚未创建链上 mint 或发布链上 metadata。

## 精度与初始供应量

| Token | 精度（decimals） | 初始供应量 |
| --- | ---: | ---: |
| KBTC | 8 | 0 |
| KDOGE | 8 | 0 |
| KETH | 8 | 0 |
| KHYPE | 8 | 0 |
| KLINK | 8 | 0 |
| KSOL | 9 | 0 |
| KUSDC | 6 | 0 |
| KUSDT | 6 | 0 |
| KWETH | 8 | 0 |

KSOL 沿用 SOL 的 9 位精度，美元测试 Token 使用 6 位，其余测试资产统一使用 8 位。KETH 和 KWETH 也采用 8 位，在保留足够小数精度的同时，为 SPL Token 的 `u64` 供应量上限留出更多整数容量。mint 创建后，精度无法修改。

`initial_supply` 使用字符串表示 Token 数量，`initial_supply_raw` 使用整数字符串表示最小单位数量。所有 Token 的这两个字段均为 `"0"`。部署时创建管理员的关联 Token 账户（Associated Token Account，ATA），但跳过增发，初始余额为 0。

这些 Token 都是独立测试资产；KSOL 和 KWETH 也不涉及原生 SOL 包装或 ETH 跨链。

## 管理员与权限

`administrator` 为计划使用的管理员和接收钱包，与 `planned_authorities` 中记录的当前 Solana CLI 钱包一致：

```text
J11xHtw4dkogTwexUkWaMH8PyFNGYdJuLg5TNvxeag4Q
```

- 增发权限（mint authority）：由该钱包持续持有，方便以后按需增发。
- Metadata 更新权限：由该钱包持有。
- 冻结权限（freeze authority）：不设置。

`planned_authorities` 记录计划权限；实际的 `mint_authority` 和 `metadata_update_authority` 在链上核对前保持 `null`。`freeze_authority: null` 同时也是计划的最终设置。初始供应量为 0 不代表放弃增发权限。

## Metadata 配置

使用经典 SPL Token Program，并通过 Metaplex 的 Fungible 标准创建链上 metadata，指向各自记录的公网 `metadata_uri`。

- 名称、符号和 URI 使用各自 `token.json` 的配置。
- Metadata 允许管理员更新。
- Seller fee 为 0。
- 不设置 creators、collection 或 uses。

上述内容属于部署配置；下载的原始 metadata JSON 和 SVG 素材保持原样。

## 部署记录与私钥

发送交易前，部署工具应核对当前 CLI 钱包和 devnet genesis hash 是否与配置一致。部署后填入真实的 mint 地址、实际权限、metadata 账户、管理员 ATA 和交易签名，完成链上核对后再更新部署状态。

这些目录只保存公开素材、配置和部署记录。不得保存 mint 私钥、钱包私钥或助记词。需要持久保存的私钥统一放在 Git 忽略的 `config/devnet-mock.local/` 中。
