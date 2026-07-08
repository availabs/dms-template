import React from 'react'
import { Link } from 'react-router'
import { ThemeContext, getComponentTheme } from '../../dms/packages/dms/src/ui/useTheme'
import { navLinkWidgetTheme } from './NavLinkWidget.theme'

// Nav-menu widget for cross-pattern links a page-derived nav can't produce
// (e.g. the Pages pattern's "docs" link, the Docs pattern's "features" link).
// Registered on the tessera theme's `widgets` map as `NavLink`; referenced from
// pattern data via layout.options.{top,side}Nav.{left,right,top,bottom}Menu.
export default function NavLinkWidget({ label, href = '#', style = 'plain', activeStyle }) {
  const { theme: themeFromContext = {} } = React.useContext(ThemeContext) || {}
  const theme = { ...navLinkWidgetTheme, ...getComponentTheme(themeFromContext, 'navLinkWidget', activeStyle) }
  const isExternal = /^https?:\/\//.test(href)

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={theme[style] || theme.plain}>
        {label}
      </a>
    )
  }
  return (
    <Link to={href} className={theme[style] || theme.plain}>
      {label}
    </Link>
  )
}
