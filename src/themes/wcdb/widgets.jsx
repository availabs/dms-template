import React from "react"
import { Link } from "react-router"
import { ThemeContext, getComponentTheme } from "../../dms/packages/dms/src/ui/useTheme"

// ── Admin-rail chrome ──────────────────────────────────────────────────────
// The rail's navigable items come from the pattern's PAGES (add a page, get a
// rail item — the author-empowering default). These two widgets are the parts
// of the mockup's rail that are chrome rather than navigation, and they mount
// through `layout.options.sideNav.topMenu` / `bottomMenu`, which is where the
// Layout expects rail widgets (`Logo`, `UserMenu`, `ThemeModeToggle` are the
// library's own). Both read the active `sidenav` style, so a restyle of the
// rail carries them along.

export const SideNavHeading = ({ label = "" }) => {
  const { theme } = React.useContext(ThemeContext) || {}
  const t = getComponentTheme(theme, "sidenav")
  return <div className={t?.sectionHeading}>{label}</div>
}

export const SideNavSiteLink = ({ label = "View site", heading = "Public site", to = "/", icon = "ViewPage" }) => {
  const { theme, UI } = React.useContext(ThemeContext) || {}
  const { Icon } = UI || {}
  const t = getComponentTheme(theme, "sidenav")
  return (
    <div className={t?.siteLinkWrapper}>
      <div className={t?.sectionDivider} />
      {heading ? <div className={t?.sectionHeading}>{heading}</div> : null}
      <Link to={to} className={t?.navitemSide}>
        {Icon ? <Icon icon={icon} className={t?.menuIconSide} /> : null}
        {label}
      </Link>
    </div>
  )
}

export const NavRightStyleWidget = () => (
  <div>
    <div className="absolute -right-[20px] top-[8px]">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 0L0 20C0 8.95431 8.95431 0 20 0L0 0Z" fill="var(--page-bg)" />
      </svg>
    </div>
  </div>
)

export const NavLeftStyleWidget = () => (
  <div>
    <div className="absolute left-[7px] top-[56px]">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 0L0 20C0 8.95431 8.95431 0 20 0L0 0Z" fill="var(--page-bg)" />
      </svg>
    </div>
  </div>
)
