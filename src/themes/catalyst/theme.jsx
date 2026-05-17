import React from 'react'

import { Link } from 'react-router'
//import Logo from '../MNYLogo'



const Logo = ({sideNav}) => {

  return (
    <>
      <Link to="/" className={`flex `}>
        <div className='h-12 pl-3 w-64 pr-12 flex items-center '>
          DMS
        </div>
      </Link>
    </>
  )
}

const theme = {


  layout: {
    wrapper: 'relative isolate flex min-h-svh w-full max-lg:flex-col bg-white lg:bg-zinc-100 dark:bg-zinc-900 dark:lg:bg-zinc-950 overflow-hidden',
    wrapper2: 'flex-1 flex items-start flex-col items-stretch max-w-full',
    wrapper3: 'flex flex-1',

    // wrapper2: 'w-full h-full flex-1 flex flex-row lg:px-3', // inside page header, wraps sidebar
    // wrapper3: 'grow p-6 lg:rounded-lg lg:bg-white lg:p-10 lg:shadow-sm lg:ring-1 lg:ring-zinc-950/5 dark:lg:bg-zinc-900 dark:lg:ring-white/10 relative ' ,

    childWrapper: 'flex-1 h-full',
    topnavContainer1:`h-[50px] -mb-1`,
    topnavContainer2:`fixed w-full z-20 `,
    sidenavContainer1: 'border-r -mr-3',
    sidenavContainer2: 'fixed inset-y-0 left-0 w-64 max-lg:hidden'
  },
  pageControls: {
    controlItem: 'pl-6 py-0.5 text-md cursor-pointer hover:text-blue-500 text-slate-400 flex items-center',
    select: 'bg-transparent border-none rounded-sm focus:ring-0 focus:border-0 pl-1',
    selectOption: 'p-4 text-md cursor-pointer hover:text-blue-500 text-slate-400 hover:bg-blue-600',
  },
  navPadding: {
    1: '',
    2: '',
    3: ''
  },
  navLabel: 'px-6 pb-1 pt-6 uppercase text-xs text-blue-400',
  bg: 'bg-slate-100',
  sidenav: {
     fixed: "lg:ml-64",
     logoWrapper: "w-64 bg-neutral-100 text-slate-800",
     sidenavWrapper: "flex flex-col w-64 h-full z-20",
     menuItemWrapper: "flex flex-col ",
     menuIconSide: "group w-6 mr-2 text-blue-500  group-hover:text-blue-800",
     menuIconSideActive: "group w-6 mr-2 text-blue-500  group-hover:text-blue-800",
     itemsWrapper: "pt-5 flex-1 ",
     navItemContent: "transition-transform duration-300 ease-in-out",
     navitemSide: `
      group  flex flex-col
      group flex px-3 py-1.5 text-[14px] font-light hover:bg-blue-50 text-slate-700 mx-2  undefined
      focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300
      transition-all cursor-pointer`,
     navitemSideActive: `
      group  flex flex-col
      px-3 py-1.5 text-[14px] font-light hover:bg-blue-50 text-slate-700  mx-2
        focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300
      transition-all cursor-pointer`,
     indicatorIcon: "fa fa-angle-right pt-2.5",
     indicatorIconOpen: "fal fa-angle-down pt-2.5",
     subMenuWrapper: "pl-2 w-full",
     subMenuParentWrapper: "flex flex-col w-full",
     bottomMenuWrapper: 'border-t'
  },
  topnav: {
      fixed: 'mt-12',
      topnavWrapper: `w-full h-[50px] flex items-center pr-1`,
      topnavContent: `flex items-center w-full h-full bg-white lg:bg-zinc-100 dark:bg-zinc-900 dark:lg:bg-zinc-950`,
      topnavMenu: `hidden  lg:flex items-center flex-1  h-full overflow-x-auto overflow-y-hidden scrollbar-sm`,
      menuItemWrapper: 'flex',
      menuIconTop: `text-blue-400 mr-3 text-lg group-hover:text-blue-500`,
      menuIconTopActive : `text-blue-500 mr-3 text-lg group-hover:text-blue-500`,
      menuOpenIcon: `fa-light fa-bars fa-fw`,
      menuCloseIcon: `fa-light fa-xmark fa-fw"`,
      navitemTop: `
          w-fit group font-display whitespace-nowrap
          flex tracking-widest items-center font-[Oswald] font-medium text-slate-700 text-[11px] px-2 h-12
          focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300
          transition cursor-pointer
      `,
      navitemTopActive:
        ` w-fit group font-display whitespace-nowrap
          flex tracking-widest items-center font-[Oswald] font-medium text-slate-700 text-[11px] px-2 h-12 text-blue
          focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300
          transition cursor-pointer
        `,
      topmenuRightNavContainer: "hidden md:flex h-full items-center",
      topnavMobileContainer: "bg-slate-50",

      mobileButton:`md:hidden bg-slate-100 inline-flex items-center justify-center pt-[12px] px-2 hover:text-blue-400  text-gray-400 hover:bg-gray-100 `,
      indicatorIcon: 'fal fa-angle-down pl-2 pt-1',
      indicatorIconOpen: 'fal fa-angle-down pl-2 pt-1',

      subMenuWrapper: `hidden`, //`absolute bg-white `,
      subMenuParentWrapper: 'hidden', //,`flex flex-row  max-w-[1400px] mx-auto`,
      subMenuWrapperChild: `divide-x overflow-x-auto max-w-[1400px] mx-auto`,
      subMenuWrapperTop: 'hidden',//`absolute top-full left-0 border-y border-gray-200 w-full bg-white normal-case`,
      subMenuWrapperInactiveFlyout: `absolute left-0 right-0  mt-8 normal-case bg-white shadow-lg z-10 p-2`,
      subMenuWrapperInactiveFlyoutBelow: ` absolute ml-40 normal-case bg-white shadow-lg z-10 p-2`,
      subMenuWrapperInactiveFlyoutDirection: 'grid grid-cols-4',

  }
}

//theme.navOptions.logo = <Link to='/' className='h-12 flex px-4 items-center'><div className='rounded-full h-10 bg-blue-500 border border-slate-50' /></Link>

export default theme

export const themeOptions = {
  "topNav": {
    "label": "Top Nav",
    "defaultOpen": true,
    "controls": {
      "size": {
        "label": "Size",
        "type": "select",
        "options": [
          "none",
          "compact"
        ]
      },
      "logo": {
        "label": "Logo",
        "type": "select",
        "options": [
          "none",
          "left",
          "right"
        ]
      },
      "search": {
        "label": "Search",
        "type": "select",
        "options": [
          "none",
          "left",
          "right"
        ]
      },
      "dropdown": {
        "label": "Menu",
        "type": "select",
        "options": [
          "none",
          "left",
          "right"
        ]
      },
      "nav": {
        "label": "Navigation",
        "type": "select",
        "options": [
          "none",
          "main",
          "secondary"
        ]
      }
    }
  },
  "sideNav": {
    "label": "Side Nav",
    "defaultOpen": false,
    "controls": {
      "size": {
        "label": "Size",
        "type": "select",
        "options": [
          "none",
          "micro",
          "mini",
          "compact",
          "full"
        ]
      },
      "color": {
        "label": "Color",
        "type": "select",
        "options": [
          "transparent",
          "white",
          "bright",
          "dark"
        ]
      },
      "logo": {
        "label": "Logo",
        "type": "select",
        "options": [
          "none",
          "top",
          "bottom"
        ]
      },
      "search": {
        "label": "Search",
        "type": "select",
        "options": [
          "none",
          "top",
          "bottom"
        ]
      },
      "dropdown": {
        "label": "Menu",
        "type": "select",
        "options": [
          "none",
          "top",
          "bottom"
        ]
      },
      "nav": {
        "label": "Navigation",
        "type": "select",
        "options": [
          "none",
          "main",
          "secondary"
        ]
      }
    }
  },
  "secondaryNav": {
    "label": "Secondary Nav",
    "defaultOpen": false,
    "controls": {
      "navItems": {
        "label": "Nav Items",
        "type": "menu"
      }
    }
  },
  "authMenu": {
    "label": "Auth Menu",
    "defaultOpen": false,
    "controls": {
      "navItems": {
        "label": "Nav Items",
        "type": "menu"
      }
    }
  }
}
