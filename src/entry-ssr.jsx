import { createSSRHandler } from './dms/packages/dms/src/render/ssr2/handler'
import { adminConfig } from './dms/packages/dms/src'
import themes from './themes'

/**
 * Site-specific SSR entry point.
 * Wires this project's themes and adminConfig into the generic SSR handler.
 *
 * Called by the Express SSR setup (setup.mjs) with runtime config
 * (apiHost, siteConfig, pgEnvs).
 */
export default function createHandler(config = {}) {
  return createSSRHandler({
    adminConfigFn: adminConfig[0],
    themes,
    ...config,
  })
}
