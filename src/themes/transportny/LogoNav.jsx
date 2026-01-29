import React from 'react'
import { Link } from 'react-router'
import { ThemeContext, getComponentTheme } from '../../dms/packages/dms/src/ui/useTheme'
import Icon from '../../dms/packages/dms/src/ui/components/Icon'

const defaultSites = [
  { name: 'NPMRDS',       subdomain: 'npmrds2',       icon: 'Pages' },
  { name: 'Freight Atlas', subdomain: 'freightatlas', icon: 'Pages' },
  { name: 'TSMO', subdomain: 'tsmo2', icon: 'Pages' },
   { name: 'Sandbox',         subdomain: 'sandbox',         icon: 'Pages' },
]

function getSiteHref(subdomain) {
  const { protocol, host } = window.location
  const parts = host.split('.')
  if (parts.length >= 2) {
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
  const currentSubdomain = window.location.host.split('.')[0]
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
          bg-[#1a2029] border border-[#3a4555]
          shadow-2xl overflow-hidden rounded-b-xl
          pb-2
          min-w-[200px]
          top-full @[120px]:left-0 -left-[32px]
          @[120px]:right-0
        ">
          {sites.map((site, i) => (
            <a
              key={i}
              href={site.href || getSiteHref(site.subdomain)}
              className="
                flex items-center gap-3 px-4 py-2.5
                text-slate-300 hover:text-white hover:bg-[#2a3545]
                transition-colors cursor-pointer
                border-l-[3px] border-transparent
                whitespace-nowrap
              "
              onClick={() => setOpen(false)}
            >
              <Icon icon={site.icon || 'Pages'} className="size-5 text-slate-400 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-['Oswald'] text-sm tracking-wide uppercase truncate">
                  {site.name}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
