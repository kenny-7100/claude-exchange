import kbtc from '../../../tokens/kbtc/token.json' with { type: 'json' }
import kdoge from '../../../tokens/kdoge/token.json' with { type: 'json' }
import keth from '../../../tokens/keth/token.json' with { type: 'json' }
import khype from '../../../tokens/khype/token.json' with { type: 'json' }
import klink from '../../../tokens/klink/token.json' with { type: 'json' }
import ksol from '../../../tokens/ksol/token.json' with { type: 'json' }
import kusdc from '../../../tokens/kusdc/token.json' with { type: 'json' }
import kusdt from '../../../tokens/kusdt/token.json' with { type: 'json' }
import kweth from '../../../tokens/kweth/token.json' with { type: 'json' }

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
