import React from 'react'
import { Link, useLocation } from 'react-router'
import { ThemeContext } from '../../dms/packages/dms/src/ui/useTheme'
import Icon from '../../dms/packages/dms/src/ui/components/Icon'

const defaultLinks = [
  { name: 'Data Sources', path: '/datasources', icon: 'Database' },
  { name: 'Docs',         path: '/docs',        icon: 'Pages' },
]

export default function QuickLinks(props) {
  const { theme: fullTheme = {} } = React.useContext(ThemeContext) || {}
  const links = fullTheme?.quickLinks?.links || defaultLinks
  const { pathname } = useLocation()

  return (
    <div className="@container w-full">
      {links.map((link, i) => {
        const active = pathname.startsWith(link.path)
        return (
          <Link
            key={i}
            to={link.path}
            className={`
              flex items-center
              transition-all cursor-pointer
              border-l-[3px]
              ${active
                ? 'bg-[#1e2530] text-white border-yellow-400'
                : 'text-slate-300 hover:text-white hover:bg-[#1e2530] border-transparent'
              }
              justify-center py-3
              @[120px]:justify-start @[120px]:px-4 @[120px]:py-2.5 @[120px]:gap-3
            `}
          >
            <Icon
              icon={link.icon || 'Pages'}
              className={`
                size-6 @[120px]:size-5 flex-shrink-0
                ${active ? 'text-yellow-400' : 'text-slate-400 group-hover:text-slate-300'}
              `}
            />
            <span className="
              hidden @[120px]:inline
              font-['Proxima_Nova'] font-[400] text-[15px]
            ">
              {link.name}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
