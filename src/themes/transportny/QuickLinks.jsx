import React from 'react'
import { Link, useLocation } from 'react-router'
import Icon from '~/dms/packages/dms/src/ui/components/Icon'
import { CMSContext } from '~/dms/packages/dms/src'
import ReportIssueModal from './ReportIssueModal'

const defaultLinks = [
  { name: 'Data Sources', path: '/datasources', icon: 'Database' },
  { name: 'Docs',         path: '/docs',        icon: 'Pages' },
]

export default function QuickLinks() {

  const { pathname } = useLocation()
  const { user } = React.useContext(CMSContext) || {}
  const [reportOpen, setReportOpen] = React.useState(false)

  const linkClass = (active) => `
    flex items-center
    transition-all cursor-pointer
    border-l-[3px]
    ${active
      ? 'bg-[#1e2530] text-white border-yellow-400'
      : 'text-slate-300 hover:text-white hover:bg-[#1e2530] border-transparent'
    }
    justify-center py-3
    @[120px]:justify-start @[120px]:px-4 @[120px]:py-2.5 @[120px]:gap-3
  `

  return (
    <div className="@container w-full">
      {defaultLinks.map((link, i) => {
        const active = pathname.startsWith(link.path)
        return (
          <Link key={i} to={link.path} className={linkClass(active)}>
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

      {user?.authed ? (
        <>
          <div className="mx-4 my-2 border-t border-white/10" />
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className={linkClass(false) + ' w-full'}
          >
            <Icon
              icon="AlertTriangle"
              className="size-6 @[120px]:size-5 flex-shrink-0 text-slate-400"
            />
            <span className="
              hidden @[120px]:inline
              font-['Proxima_Nova'] font-[400] text-[15px]
            ">
              Report an issue
            </span>
          </button>
          <ReportIssueModal open={reportOpen} setOpen={setReportOpen} />
        </>
      ) : null}
    </div>
  )
}
