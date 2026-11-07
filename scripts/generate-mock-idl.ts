import { readFileSync, writeFileSync } from 'node:fs'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
type NamedDefinition = { name: string; [key: string]: JsonValue }
type SourceIdl = {
  address: string
  metadata: JsonValue
  instructions: NamedDefinition[]
  accounts: NamedDefinition[]
  types: NamedDefinition[]
  errors: JsonValue[]
}

// 从仓库 IDL 提取实际使用的指令及账户依赖，避免打包完整业务 IDL。
const source: SourceIdl = JSON.parse(readFileSync(new URL('../crates/programs/idls/gmsol_store.json', import.meta.url), 'utf8'))
const names = new Set(['Store', 'PriceFeed'])
function visit(value: JsonValue): void {
  if (!value || typeof value !== 'object') return
  if (!Array.isArray(value)) {
    const defined = value.defined
    if (defined && typeof defined === 'object' && !Array.isArray(defined) && typeof defined.name === 'string') {
      names.add(defined.name)
    }
  }
  Object.values(value).forEach(visit)
}
let previous = 0
while (previous !== names.size) {
  previous = names.size
  source.types.filter((type) => names.has(type.name)).forEach(visit)
}
function clean(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(clean)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'docs').map(([key, item]) => [key, clean(item)]))
}
const idl = clean({
  address: source.address,
  metadata: source.metadata,
  instructions: source.instructions.filter((ix) => ['initialize_price_feed', 'update_price_feed_with_chainlink'].includes(ix.name)),
  accounts: source.accounts.filter((account) => ['Store', 'PriceFeed'].includes(account.name)),
  types: source.types.filter((type) => names.has(type.name)),
  errors: source.errors,
})
writeFileSync(new URL('../admin-ui/src/lib/idl/mock-store.json', import.meta.url), JSON.stringify(idl, null, 2) + '\n')
