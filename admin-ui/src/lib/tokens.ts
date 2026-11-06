import kbtc from '../../../tokens/kbtc/token.json'
import kdoge from '../../../tokens/kdoge/token.json'
import keth from '../../../tokens/keth/token.json'
import khype from '../../../tokens/khype/token.json'
import klink from '../../../tokens/klink/token.json'
import ksol from '../../../tokens/ksol/token.json'
import kusdc from '../../../tokens/kusdc/token.json'
import kusdt from '../../../tokens/kusdt/token.json'
import kweth from '../../../tokens/kweth/token.json'

export const supportedTokens = [kbtc, kdoge, keth, khype, klink, ksol, kusdc, kusdt, kweth]
  .map((token) => ({
    name: token.name,
    symbol: token.symbol,
    mint: token.mint,
    decimals: token.decimals,
    mintAuthority: token.mint_authority,
    image: token.image_uri,
  }))

export type SupportedToken = (typeof supportedTokens)[number]
