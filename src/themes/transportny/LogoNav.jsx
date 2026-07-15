import React from 'react'
import { Link } from 'react-router'
import { ThemeContext, getComponentTheme } from '~/dms/packages/dms/src/ui/useTheme'
import Icon from '~/dms/packages/dms/src/ui/components/Icon'

const defaultSites = [
  { name: 'NPMRDS',       subdomain: 'npmrds',       icon: 'Pages' },
  { name: 'Freight Atlas', subdomain: 'freightatlas', icon: 'Pages' },
  { name: 'TSMO', subdomain: 'tsmo', icon: 'Pages' },
   { name: 'Sandbox',         subdomain: 'sandbox',         icon: 'Pages' },
]

function getSiteHref(subdomain) {
  const { protocol, host } = window.location
  const parts = host.split('.')
  // Bare IPv4 host (e.g. 1.2.3.4) has no room for a subdomain — swapping in
  // an octet would produce a broken address, so just prefix it instead.
  const isIPv4Host = /^\d+$/.test(parts[parts.length - 1])
  if (!isIPv4Host && parts.length >= 2) {
    parts[0] = subdomain
  } else {
    parts.unshift(subdomain)
  }
  return `${protocol}//${parts.join('.')}`
}

export default function LogoNav(props) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef(null)
  const { theme: fullTheme = {} } = React.useContext(ThemeContext) || {}
  const logoTheme = getComponentTheme(fullTheme, 'logo', props.activeStyle)
  const navConfig = fullTheme?.logoNav || {}
  const sites = navConfig.sites || defaultSites
  const hostParts = window.location.host.split('.')
  // Bare IPv4 host (e.g. 1.2.3.4) would otherwise misread its last octet as
  // a subdomain; real TLDs are never all-digits.
  const currentSubdomain = /^\d+$/.test(hostParts[hostParts.length - 1]) ? '' : hostParts[0]
  const activeSite = sites.find(s => s.subdomain === currentSubdomain)
  const title = activeSite?.name || logoTheme?.title || 'TransportNY'

  React.useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="@container relative overflow-visible">
      <div className={`${logoTheme?.logoWrapper || ''} w-full`}>
        {/* Logo icon — links to home */}
        <Link to={logoTheme?.linkPath || '/'} className="flex-shrink-0 cursor-pointer">
          {logoTheme?.img ? (
            <div className={logoTheme?.imgWrapper}>
              <img className={logoTheme?.imgClass} src={logoTheme?.img} alt="" />
            </div>
          ) : (
            <div className={logoTheme?.logoAltImg} />
          )}
        </Link>
        {/* Title + caret — opens dropdown */}
        <button
          onClick={() => setOpen(!open)}
          className="hidden @[120px]:flex flex-1 items-center gap-2 cursor-pointer min-w-0"
        >
          <div className={`${logoTheme?.titleWrapper || ''} flex-1 text-left`}>
            {title}
          </div>
          <div className={`
            transition-transform duration-200
            ${open ? 'rotate-180' : ''}
            text-slate-400
          `}>
            <Icon icon="CaretDown" className="size-4" />
          </div>
        </button>
      </div>

      {/* Dropdown panel — below in expanded, flyout right in compact */}
      {open && (
        <div className="
          absolute z-50
          bg-[#0F1722] border border-white/10
          shadow-2xl overflow-hidden rounded-b-lg
          min-w-[236px]
          top-full @[120px]:left-0 -left-[32px]
          @[120px]:right-0
        ">
          <div className="px-4 pt-3 pb-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-slate-500 border-b border-white/[0.08]">
            // switch product
          </div>
          {sites.map((site, i) => {
            const isActive = site.subdomain === currentSubdomain
            return (
              <a
                key={i}
                href={site.href || getSiteHref(site.subdomain)}
                className={`
                  flex items-center gap-3 px-4 py-2.5
                  transition-colors cursor-pointer whitespace-nowrap
                  border-l-2 ${isActive
                    ? 'border-[#FACC15] bg-white/[0.04]'
                    : 'border-transparent hover:bg-white/[0.06]'}
                `}
                onClick={() => setOpen(false)}
              >
                <span className={`inline-flex size-8 rounded-[6px] items-center justify-center text-white flex-shrink-0 ${site.chip || 'bg-[#2a3545]'}`}>
                  <Icon icon={site.icon || 'Pages'} className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`font-['Oswald'] text-[13.5px] tracking-wide uppercase truncate ${isActive ? 'text-[#FACC15]' : 'text-slate-200'}`}>
                    {site.name}
                  </div>
                  {site.tag && (
                    <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500 truncate">
                      {site.tag}
                    </div>
                  )}
                </div>
                {isActive && <span className="size-1.5 rounded-full bg-[#FACC15] flex-shrink-0" />}
              </a>
            )
          })}
          <a
            href={getSiteHref('www')}
            onClick={() => setOpen(false)}
            className="
              flex items-center justify-between gap-3 px-4 py-2.5 mt-1
              border-t border-white/[0.08]
              font-mono text-[10px] uppercase tracking-[0.16em]
              text-slate-400 hover:text-white hover:bg-white/[0.06]
              transition-colors cursor-pointer
            "
          >
            <span>Platform home</span>
            <span className="text-[#FACC15]">&rarr;</span>
          </a>
        </div>
      )}
    </div>
  )
}
