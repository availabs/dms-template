import Message from './components/Message'
import AudioPlayer from './components/AudioPlayer'

const availTheme = {
  pageComponents: {
    "Message": Message,
    "Audio Player": AudioPlayer
  },
  "admin": {
    "navOptions": {
      "logo": "",
      "sideNav": {
        "size": "compact",
        "logo": "top",
        "dropdown": "none",
        "position": "fixed",
        "nav": "main"
      },
      "topNav": {
        "size": "none",
        "dropdown": "right",
        "logo": "left",
        "position": "sticky",
        "nav": "none"
      }
    },
    "page": {
      "pageWrapper": "w-full h-full flex-1 flex flex-row p-2",
      "pageWrapper2": "grow p-6 lg:rounded-lg lg:bg-white lg:p-10 lg:shadow-xs lg:ring-1 lg:ring-zinc-950/5 dark:lg:bg-zinc-900 dark:lg:ring-white/10"
    }
  },
  "pages": {
    "sectionGroup": {
      "sideNavContainer1": "w-[302px] hidden xl:block",
      "sideNavContainer2": "w-[302px] sticky top-[120px] hidden xl:block h-[calc(100vh_-_128px)] pr-2",
      "sideNavContainer3": "shadow-md rounded-lg overflow-hidden h-full"
    }
  },
  "compatibility": "border-[#191919]",
  "heading": {
    "1": "text-blue-500 font-bold text-xl tracking-wider py-1 pl-1",
    "2": "text-lg tracking-wider",
    "3": "text-md tracking-wide",
    "base": "p-2 w-full font-sans font-medium text-md bg-transparent",
    "default": ""
  },
  "sectionArray": {
    "container": "w-full grid grid-cols-6 ",
    "gridSize": 6,
    "layouts": {
      "centered": "max-w-[1020px] mx-auto",
      "fullwidth": ""
    },
    "sectionEditWrapper": "relative group",
    "sectionEditHover": "absolute inset-0 group-hover:border border-blue-300 border-dashed pointer-events-none z-10",
    "sectionViewWrapper": "relative group",
    "sectionPadding": "p-4",
    "gridviewGrid": "z-0 bg-slate-50 h-full",
    "gridviewItem": "border-x bg-white border-slate-100/75 border-dashed h-full p-[6px]",
    "defaultOffset": 16,
    "sizes": {
      "1": {
        "className": "col-span-6 md:col-span-6",
        "iconSize": 100
      },
      "1/3": {
        "className": "col-span-6 md:col-span-2",
        "iconSize": 33
      },
      "1/2": {
        "className": "col-span-6 md:col-span-3",
        "iconSize": 50
      },
      "2/3": {
        "className": "col-span-6 md:col-span-4",
        "iconSize": 66
      }
    },
    "rowspans": {
      "1": {
        "className": ""
      },
      "2": {
        "className": "md:row-span-2"
      },
      "3": {
        "className": "md:row-span-3"
      },
      "4": {
        "className": "md:row-span-4"
      },
      "5": {
        "className": "md:row-span-5"
      },
      "6": {
        "className": "md:row-span-6"
      },
      "7": {
        "className": "md:row-span-7"
      },
      "8": {
        "className": "md:row-span-8"
      }
    },
    "border": {
      "none": "",
      "full": "border border-[#E0EBF0] rounded-lg",
      "openLeft": "border border-[#E0EBF0] border-l-transparent rounded-r-lg",
      "openRight": "border border-[#E0EBF0] border-r-transparent rounded-l-lg",
      "openTop": "border border-[#E0EBF0] border-t-transparent rounded-b-lg",
      "openBottom": "border border-[#E0EBF0] border-b-transparent rounded-t-lg",
      "borderX": "border border-[#E0EBF0] border-y-transparent"
    }
  },
  "layout": {
    "options": {
      "activeStyle": 0,
      "sideNav": {
        "size": "none",
        "nav": "main",
        "activeStyle": null,
        "topMenu": [],
        "bottomMenu": []
      },
      "topNav": {
        "size": "compact",
        "nav": "main",
        "activeStyle": null,
        "leftMenu": [
          {
            "type": "Logo"
          }
        ],
        "rightMenu": [
          {
            "type": "UserMenu"
          }
        ]
      },
      "widgets": [
        {
          "label": "Logo",
          "value": "Logo"
        },
        {
          "label": "User Menu",
          "value": "UserMenu"
        },
        {
          "label": "Search Button",
          "value": "SearchButton"
        }
      ]
    },
    "styles": [
      {
        "outerWrapper": "bg-[#fdfbf5] p-[1rem]",
        "wrapper": "border border-[#191919] relative isolate flex min-h-svh w-full max-lg:flex-col overflow-hidden text-[#191919]\n    ",
        "wrapper2": "flex-1 flex items-start flex-col items-stretch max-w-full min-h-screen",
        "wrapper3": "flex flex-1",
        "childWrapper": "flex-1 h-full",
        "name": "main"
      }
    ]
  },
  "layoutGroup": {
    "options": {
      "activeStyle": 0
    },
    "styles": [
      {
        "name": "content",
        "wrapper1": "w-full h-full flex-1 flex flex-row ",
        "wrapper2": "flex flex-1 w-full  flex-col  shadow-md  relative text-md font-light leading-7 p-4 h-full min-h-[200px]",
        "wrapepr3": ""
      },
      {
        "name": "header",
        "wrapper1": "w-full h-full flex-1 flex flex-row",
        "wrapper2": "flex flex-1 w-full  flex-col  relative min-h-[200px]",
        "wrapepr3": ""
      }
    ]
  },
  "nestable": {
    "container": "max-w-full max-h-full  pb-6 ",
    "navListContainer": "h-full border-l  pt-3 pl-2 overflow-auto max-h-[calc(100vh_-_155px)] min-h-[calc(100vh_-_155px)]",
    "navItemContainer": "text-slate-600 border-l border-y rounded border-transparent flex items-center gap-1 cursor-pointer group group-hover:bg-blue-100",
    "navItemContainerActive": "bg-white text-blue-500  border-l rounded border-y border-slate-300 flex items-center gap-1 cursor-pointer group group-hover:bg-blue-100",
    "navLink": "flex-1 px-4 py-2 font-light text-elipses",
    "subList": "pl-[30px]",
    "collapseIcon": "text-gray-400 hover:text-gray-500",
    "dragBefore": "before:absolute before:top-0 before:left-0 before:right-0 before:bottom-0 before:bg-blue-300 before:border-dashed before:rounded before:border before:border-blue-600"
  },
  "sidenav": {
    "options": {
      "activeStyle": 0
    },
    "styles": [
      {
        "name": "default",
        "layoutContainer1": "lg:mr-42",
        "layoutContainer2": "fixed inset-y-0 left-0 w-42 max-lg:hidden",
        "logoWrapper": "w-42 bg-neutral-100 text-slate-800",
        "sidenavWrapper": "flex flex-col w-42 h-full z-20",
        "menuItemWrapper": "flex flex-col",
        "menuItemWrapper_level_1": "",
        "menuItemWrapper_level_2": "",
        "menuItemWrapper_level_3": "",
        "menuItemWrapper_level_4": "",
        "navitemSide": "\n      group  flex flex-col\n      group flex px-3 py-1.5 text-[14px] font-light hover:bg-blue-50 text-slate-700 mx-2  undefined\n      focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300\n      transition-all cursor-pointer",
        "navitemSideActive": "\n      group  flex flex-col\n      px-3 py-1.5 text-[14px] font-light hover:bg-blue-50 text-slate-700  mx-2\n        focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300\n      transition-all cursor-pointer",
        "menuIconSide": "group w-6 mr-2 text-blue-500  group-hover:text-blue-800",
        "menuIconSideActive": "group w-6 mr-2 text-blue-500  group-hover:text-blue-800",
        "itemsWrapper": "pt-12 flex-1 ",
        "navItemContent": "transition-transform duration-300 ease-in-out",
        "navItemContent_level_1": "",
        "navItemContent_level_2": "",
        "navItemContent_level_3": "",
        "navItemContent_level_4": "",
        "indicatorIcon": "ArrowRight",
        "indicatorIconOpen": "ArrowDown",
        "subMenuWrapper_1": "pl-2 w-full",
        "subMenuWrapper_2": "",
        "subMenuWrapper_3": "",
        "subMenuOuterWrapper": "",
        "subMenuParentWrapper": "flex flex-col w-full",
        "bottomMenuWrapper": "",
        "topnavWrapper": "w-full h-[50px] flex items-center pr-1",
        "topnavContent": "flex items-center w-full h-full bg-white lg:bg-zinc-100 dark:bg-zinc-900 dark:lg:bg-zinc-950 justify-between",
        "topnavMenu": "hidden  lg:flex items-center flex-1  h-full overflow-x-auto overflow-y-hidden scrollbar-sm",
        "topmenuRightNavContainer": "hidden md:flex h-full items-center",
        "topnavMobileContainer": "bg-slate-50"
      }
    ]
  },
  "topnav": {
    "options": {
      "activeStyle": 0
    },
    "styles": [
      {
        "layoutContainer1": "border-b border-[#191919] mx-10",
        "layoutContainer2": "w-full z-20 ",
        "topnavWrapper": "w-full py-[2rem] flex items-center pr-1",
        "topnavContent": "flex items-center w-full h-full  justify-between",
        "leftMenuContainer": "",
        "centerMenuContainer": "hidden  md:flex items-center flex-1  h-full overflow-x-auto justify-end overflow-y-hidden scrollbar-sm",
        "rightMenuContainer": "hidden min-w-[120px]  md:flex h-full items-center justify-end",
        "mobileNavContainer": "",
        "mobileButton": "md:hidden inline-flex items-center justify-center cursor-pointer p-2 hover:text-slate-800 00  text-gray-400 ",
        "menuOpenIcon": "Menu",
        "menuCloseIcon": "XMark",
        "navitemWrapper": "flex",
        "navitemContent": "flex-1 flex items-center gap-[2px]",
        "navitem": "w-fit group font-display whitespace-nowrapmenuItemWrapper\n        flex tracking-widest items-center font-[Oswald] font-medium text-slate-700 text-[11px] px-2 h-12\n        focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300\n        transition cursor-pointer\n    ",
        "navitemActive": " w-fit group font-display whitespace-nowrap\n        flex tracking-widest items-center font-[Oswald] font-medium text-slate-700 text-[11px] px-2 h-12 text-blue\n        focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300\n        transition cursor-pointer\n      ",
        "navIcon": "",
        "navIconActive": "",
        "navitemName": "uppercase text-lg font-[300]",
        "navitemName_level_2": "",
        "navitemDescription": "hidden",
        "navitemDescription_level_2": "",
        "indicatorIconWrapper": "size-3",
        "indicatorIcon": "ArrowDown",
        "indicatorIconOpen": "ArrowDown",
        "subMenuWrapper": "absolute top-20 left-0 right-0 normal-case z-10 px-10 pb-10   pt-[45px] cursor-default",
        "subMenuWrapper2": "bg-[#fdfbf5] border-[#191919]  border-x border-b flex items-stretch p-4",
        "subMenuParentWrapper": "hidden",
        "subMenuWrapperChild": "divide-x overflow-x-auto max-w-[1400px] mx-auto",
        "subMenuWrapperTop": "hidden",
        "subMenuWrapperInactiveFlyout": "absolute left-0 right-0  mt-8 normal-case bg-white shadow-lg z-10 p-2",
        "subMenuWrapperInactiveFlyoutBelow": " absolute ml-40 normal-case bg-white shadow-lg z-10 p-2",
        "subMenuWrapperInactiveFlyoutDirection": "grid grid-cols-4",
        "topnavMenu": "hidden  lg:flex items-center flex-1  h-full justify-end overflow-x-auto overflow-y-hidden scrollbar-sm",
        "topmenuRightNavContainer": "hidden min-w-[120px] md:flex h-full items-center",
        "topnavMobileContainer": "bg-slate-50",
        "menuItemWrapper": "flex",
        "navitemTop": "\n        w-fit group font-display whitespace-nowrapmenuItemWrapper\n        flex tracking-widest items-center font-[Oswald] font-medium text-slate-700 text-[11px] px-2 h-12\n        focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300\n        transition cursor-pointer\n    ",
        "navitemTopActive": " w-fit group font-display whitespace-nowrap\n        flex tracking-widest items-center font-[Oswald] font-medium text-slate-700 text-[11px] px-2 h-12 text-blue\n        focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300\n        transition cursor-pointer\n      ",
        "navItemContent_level_1": "uppercase text-lg font-[300]",
        "navItemContent_level_2": "uppercase font-[Oswald] text-[14px] flex items-center p-1",
        "navItemDescription_level_1": "hidden",
        "navItemDescription_level_2": "text-[16px] font-['Proxima_Nova'] font-[400] text-[#37576B] text-wrap",
        "subMenuItemsWrapper": "flex justify-end w-full"
      }
    ]
  },
  "logo": {
    "logoWrapper": "h-8 flex px-4 items-center",
    "logoAltImg": "rounded-full h-8 w-8 bg-blue-500 border-2 border-blue-300 hover:bg-blue-600",
    "imgWrapper": "-m-8",
    "img": "https://i.ibb.co/ym626S3X/avail-logo.png",
    "imgClass": "",
    "titleWrapper": "text-2xl ",
    "title": "AVAIL",
    "linkPath": "/"
  },
  "tabs": {
    "tablist": "flex gap-4",
    "tab": "\n    py-1 px-3 font-semibold text-slate-600 focus:outline-none border-b-2 border-white text-xs hover:text-slate-900\n    data-[selected]:border-blue-500 data-[selected]:bg-white/10 data-[hover]:bg-white/5 data-[selected]:data-[hover]:bg-white/10 data-[focus]:outline-1 data-[focus]:outline-white\n  ",
    "tabpanels": "",
    "tabpanel": "rounded-xl bg-white/5"
  },
  "button": {
    "default": "inline-flex items-center gap-2  bg-gray-700 py-1.5  text-sm/6 font-semibold text-white shadow-inner shadow-white/10 focus:outline-none data-[hover]:bg-gray-600 data-[open]:bg-gray-700 data-[focus]:outline-1 data-[focus]:outline-white",
    "plain": "cursor-pointer relative isolate inline-flex items-center justify-center gap-x-2 rounded-lg border text-base/6 font-semibold  sm:text-sm/6 focus:outline-none data-[focus]:outline data-[focus]:outline-2 data-[focus]:outline-offset-2 data-[focus]:outline-blue-500 data-[disabled]:opacity-50 [&>[data-slot=icon]]:-mx-0.5 [&>[data-slot=icon]]:my-0.5 [&>[data-slot=icon]]:size-5 [&>[data-slot=icon]]:shrink-0 [&>[data-slot=icon]]:text-[--btn-icon] [&>[data-slot=icon]]:sm:my-1 [&>[data-slot=icon]]:sm:size-4 forced-colors:[--btn-icon:ButtonText] forced-colors:data-[hover]:[--btn-icon:ButtonText] border-transparent text-zinc-950 data-[active]:bg-zinc-950/5 data-[hover]:bg-zinc-950/5 dark:text-white dark:data-[active]:bg-white/10 dark:data-[hover]:bg-white/10 [--btn-icon:theme(colors.zinc.500)] data-[active]:[--btn-icon:theme(colors.zinc.700)] data-[hover]:[--btn-icon:theme(colors.zinc.700)] dark:[--btn-icon:theme(colors.zinc.500)] dark:data-[active]:[--btn-icon:theme(colors.zinc.400)] dark:data-[hover]:[--btn-icon:theme(colors.zinc.400)] cursor-default",
    "active": "cursor-pointer px-4 inline-flex  justify-center cursor-pointer text-sm font-semibold  bg-blue-600 text-white hover:bg-blue-500 shadow-lg border border-b-4 border-blue-800 hover:border-blue-700 active:border-b-2 active:mb-[2px] active:shadow-none",
    "inactive": "inline-flex  px-4 justify-center cursor-not-allowed text-sm font-semibold bg-slate-300 text-white shadow border border-slate-400 border-b-4",
    "rounded": "rounded-lg",
    "padding": "px-[calc(theme(spacing[3.5])-1px)] py-[calc(theme(spacing[2.5])-1px)] sm:px-[calc(theme(spacing.3)-1px)] sm:py-[calc(theme(spacing[1.5])-1px)]",
    "transparent": "hover:bg-gray-100 rounded-lg"
  },
  "menu": {
    "menuItems": "absolute z-40 -mr-1 mt-1 w-64 p-1 origin-top-left rounded-md bg-white shadow-lg ring-1 ring-black/5 transition focus:outline-none data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-50 data-[leave]:duration-75 data-[enter]:ease-out data-[leave]:ease-in"
  },
  "input": {
    "input": "relative w-full block appearance-none rounded-lg px-[calc(theme(spacing[3.5])-1px)] py-[calc(theme(spacing[2.5])-1px)] sm:px-[calc(theme(spacing[3])-1px)] sm:py-[calc(theme(spacing[1.5])-1px)] text-base/6 text-zinc-950 placeholder:text-zinc-500 sm:text-sm/6 dark:text-white border border-zinc-950/10 data-[hover]:border-zinc-950/20 dark:border-white/10 dark:data-[hover]:border-white/20 bg-transparent dark:bg-white/5 focus:outline-none data-[invalid]:border-red-500 data-[invalid]:data-[hover]:border-red-500 data-[invalid]:dark:border-red-500 data-[invalid]:data-[hover]:dark:border-red-500 data-[disabled]:border-zinc-950/20 dark:data-[hover]:data-[disabled]:border-white/15 data-[disabled]:dark:border-white/15 data-[disabled]:dark:bg-white/[2.5%] dark:[color-scheme:dark]",
    "inputContainer": "group flex relative w-full before:absolute before:inset-px before:rounded-[calc(theme(borderRadius.lg)-1px)] before:bg-white before:shadow dark:before:hidden after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-inset after:ring-transparent sm:after:focus-within:ring-2 sm:after:focus-within:ring-blue-500 has-[[data-disabled]]:opacity-50 before:has-[[data-disabled]]:bg-zinc-950/5 before:has-[[data-disabled]]:shadow-none before:has-[[data-invalid]]:shadow-red-500/10",
    "textarea": "relative block h-full w-full appearance-none rounded-lg px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)] text-base/6 text-zinc-950 placeholder:text-zinc-500 sm:text-sm/6 dark:text-white border border-zinc-950/10 data-hover:border-zinc-950/20 dark:border-white/10 dark:data-hover:border-white/20 bg-transparent dark:bg-white/5 focus:outline-hidden data-invalid:border-red-500 data-invalid:data-hover:border-red-500 dark:data-invalid:border-red-600 dark:data-invalid:data-hover:border-red-600 disabled:border-zinc-950/20 dark:disabled:border-white/15 dark:disabled:bg-white/2.5 dark:data-hover:disabled:border-white/15 resize-y",
    "confirmButtonContainer": "absolute right-0 hidden group-hover:flex items-center",
    "editButton": "py-1.5 px-2 text-slate-400 hover:text-blue-500 cursor-pointer bg-white/10",
    "cancelButton": "text-slate-400 hover:text-red-500 cursor-pointer  py-1.5 pr-1 ",
    "confirmButton": "text-green-500 hover:text-white hover:bg-green-500 cursor-pointer rounded-full"
  },
  "icon": {
    "iconWrapper": "",
    "icon": "size-6"
  },
  "field": {
    "field": "pb-2",
    "label": "select-none text-base/6 text-zinc-950 data-[disabled]:opacity-50 sm:text-sm/6 dark:text-white",
    "description": "text-base/6 text-zinc-500 data-[disabled]:opacity-50 sm:text-sm/6 dark:text-zinc-400"
  },
  "dialog": {
    "backdrop": "fixed inset-0 flex w-screen justify-center overflow-y-auto bg-zinc-950/25 px-2 py-2 transition duration-100 focus:outline-0 data-[closed]:opacity-0 data-[enter]:ease-out data-[leave]:ease-in sm:px-6 sm:py-8 lg:px-8 lg:py-16 dark:bg-zinc-950/50",
    "dialogContainer": "fixed inset-0 w-screen overflow-y-auto pt-6 sm:pt-0",
    "dialogContainer2": "grid min-h-full grid-rows-[1fr_auto] justify-items-center sm:grid-rows-[1fr_auto_3fr] sm:p-4",
    "dialogPanel": "\n    row-start-2 w-full min-w-0 rounded-t-3xl bg-white p-[--gutter] shadow-lg ring-1 ring-zinc-950/10 [--gutter:theme(spacing.8)] sm:mb-auto sm:rounded-2xl dark:bg-zinc-900 dark:ring-white/10 forced-colors:outline\n    transition duration-100 data-[closed]:translate-y-12 data-[closed]:opacity-0 data-[enter]:ease-out data-[leave]:ease-in sm:data-[closed]:translate-y-0 sm:data-[closed]:data-[enter]:scale-95\n  ",
    "sizes": {
      "xs": "sm:max-w-xs",
      "sm": "sm:max-w-sm",
      "md": "sm:max-w-md",
      "lg": "sm:max-w-lg",
      "xl": "sm:max-w-xl",
      "2xl": "sm:max-w-2xl",
      "3xl": "sm:max-w-3xl",
      "4xl": "sm:max-w-4xl",
      "5xl": "sm:max-w-5xl"
    }
  },
  "popover": {
    "button": "flex items-center cursor-pointer pt-1 pr-1",
    "container": "absolute shadow-lg z-30 transform overflow-visible z-50 rounded-md"
  },
  "label": {
    "labelWrapper": "px-[12px] pt-[9px] pb-[7px] rounded-md",
    "label": "inline-flex items-center rounded-md px-1.5 py-0.5 text-sm/5 font-medium sm:text-xs/5 forced-colors:outline"
  },
  "select": {
    "selectContainer": "group relative block w-full before:absolute before:inset-px before:rounded-[calc(theme(borderRadius.lg)-1px)] before:bg-white before:shadow dark:before:hidden after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-inset after:ring-transparent after:has-[[data-focus]]:ring-2 after:has-[[data-focus]]:ring-blue-500 has-[[data-disabled]]:opacity-50 before:has-[[data-disabled]]:bg-zinc-950/5 before:has-[[data-disabled]]:shadow-none",
    "select": "relative block w-full appearance-none rounded-lg py-[calc(theme(spacing[2.5])-1px)] sm:py-[calc(theme(spacing[1.5])-1px)] px-[calc(theme(spacing[3.5])-1px)] sm:px-[calc(theme(spacing.3)-1px)] [&_optgroup]:font-semibold text-base/6 text-zinc-950 placeholder:text-zinc-500 sm:text-sm/6 dark:text-white dark:*:text-white border border-zinc-950/10 data-[hover]:border-zinc-950/20 dark:border-white/10 dark:data-[hover]:border-white/20 bg-transparent dark:bg-white/5 dark:*:bg-zinc-800 focus:outline-none data-[invalid]:border-red-500 data-[invalid]:data-[hover]:border-red-500 data-[invalid]:dark:border-red-600 data-[invalid]:data-[hover]:dark:border-red-600 data-[disabled]:border-zinc-950/20 data-[disabled]:opacity-100 dark:data-[hover]:data-[disabled]:border-white/15 data-[disabled]:dark:border-white/15 data-[disabled]:dark:bg-white/[2.5%]"
  },
  "listbox": {
    "listboxContainer": "group relative block w-full before:absolute before:inset-px before:rounded-[calc(theme(borderRadius.lg)-1px)] before:bg-white before:shadow dark:before:hidden after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-inset after:ring-transparent after:has-[[data-focus]]:ring-2 after:has-[[data-focus]]:ring-blue-500 has-[[data-disabled]]:opacity-50 before:has-[[data-disabled]]:bg-zinc-950/5 before:has-[[data-disabled]]:shadow-none",
    "listboxOptions": "w-[var(--button-width)] z-20 bg-white rounded-xl border p-1 [--anchor-gap:var(--spacing-1)] focus:outline-none transition duration-100 ease-in data-[leave]:data-[closed]:opacity-0",
    "listboxOption": "group flex gap-2 bg-white data-[focus]:bg-blue-100 z-30",
    "listboxButton": "relative block w-full rounded-lg bg-white/5 py-1.5 pr-8 pl-3 text-left text-sm/6 text-white focus:outline-none data-[focus]:outline-2 data-[focus]:-outline-offset-2 data-[focus]:outline-white/25"
  },
  "table": {
    "tableContainer": "flex flex-col overflow-x-auto",
    "tableContainerNoPagination": "",
    "tableContainer1": "flex flex-col no-wrap min-h-[40px] max-h-[calc(78vh_-_10px)] overflow-y-auto",
    "headerContainer": "sticky top-0 grid",
    "thead": "flex justify-between",
    "theadfrozen": "",
    "thContainer": "w-full font-semibold px-3 py-1 content-center text-sm font-semibold text-gray-600 border",
    "thContainerBgSelected": "bg-blue-100 text-gray-900",
    "thContainerBg": "bg-gray-50 text-gray-500",
    "cell": "relative flex items-center min-h-[35px]  border border-slate-50",
    "cellInner": "\n        w-full min-h-full flex flex-wrap items-center truncate py-0.5 px-1\n        font-[400] text-[14px]  leading-[18px] text-slate-600\n    ",
    "cellBg": "bg-white",
    "cellBgSelected": "bg-blue-50",
    "cellFrozenCol": "",
    "paginationInfoContainer": "",
    "paginationPagesInfo": "font-[500] text-[12px] uppercase text-[#2d3e4c] leading-[18px]",
    "paginationRowsInfo": "text-xs",
    "paginationContainer": "w-full p-2 flex items-center justify-between",
    "paginationControlsContainer": "flex flex-row items-center overflow-hidden gap-0.5",
    "pageRangeItem": "cursor-pointer px-3  text-[#2D3E4C] py-1  text-[12px] hover:bg-slate-50 font-[500] rounded  uppercase leading-[18px]",
    "pageRangeItemInactive": "",
    "pageRangeItemActive": "bg-slate-100 ",
    "openOutContainer": "w-[330px] overflow-auto scrollbar-sm flex flex-col gap-[12px] p-[16px] bg-white h-full float-right",
    "openOutContainerWrapper": "fixed inset-0 right-0 h-full w-full z-[100]",
    "openOutHeader": "font-semibold text-gray-600"
  },
  "lexical": {},
  "dataCard": {
    "columnControlWrapper": "grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-x-1 gap-y-0.5",
    "columnControlHeaderWrapper": "px-1 font-semibold border bg-gray-50 text-gray-500",
    "mainWrapperCompactView": "grid",
    "mainWrapperSimpleView": "flex flex-col",
    "subWrapper": "w-full",
    "subWrapperCompactView": "flex flex-col rounded-[12px]",
    "subWrapperSimpleView": "grid",
    "headerValueWrapper": "w-full rounded-[12px] flex items-center justify-center p-2",
    "headerValueWrapperCompactView": "py-0",
    "headerValueWrapperSimpleView": "",
    "justifyTextLeft": "text-start justify-items-start  rounded-md",
    "justifyTextRight": "text-end justify-items-end rounded-md",
    "justifyTextCenter": "text-center justify-items-center rounded-md",
    "textXS": "text-xs font-medium",
    "textXSReg": "text-xs font-normal",
    "textSM": "text-sm font-medium",
    "textSMReg": "text-sm font-normal",
    "textSMBold": "text-sm font-normal",
    "textSMSemiBold": "text-sm font-semibold",
    "textMD": "ftext-md ont-medium",
    "textMDReg": "text-md font-normal",
    "textMDBold": "text-md font-bold",
    "textMDSemiBold": "text-md font-semibold",
    "textXL": "text-xl font-medium",
    "textXLSemiBold": "text-xl font-semibold",
    "text2XL": "text-2xl font-medium",
    "text2XLReg": "text-2xl font-regular",
    "text3XL": "text-3xl font-medium",
    "text3XLReg": "text-3xl font-normal",
    "text4XL": "text-4xl font-medium",
    "text5XL": "text-5xl font-medium",
    "text6XL": "text-6xl font-medium",
    "text7XL": "text-7xl font-medium",
    "text8XL": "text-8xl font-medium",
    "imgXS": "max-w-16 max-h-16",
    "imgSM": "max-w-24 max-h-24",
    "imgMD": "max-w-32 max-h-32",
    "imgXL": "max-w-40 max-h-40",
    "img2XL": "max-w-48 max-h-48",
    "img3XL": "max-w-56 max-h-56",
    "img4XL": "max-w-64 max-h-64",
    "img5XL": "max-w-72 max-h-72",
    "img6XL": "max-w-80 max-h-80",
    "img7XL": "max-w-96 max-h-96",
    "img8XL": "max-w-128 max-h-128",
    "header": "w-full capitalize",
    "value": "w-full"
  },
  "attribution": {
    "wrapper": "w-full p-1 flex gap-1 text-xs text-gray-900",
    "label": "",
    "link": ""
  },
  "filters": {
    "filterLabel": "py-0.5 text-gray-500 font-medium",
    "loadingText": "pl-0.5 font-thin text-gray-500",
    "filterSettingsWrapperInline": "w-2/3",
    "filterSettingsWrapperStacked": "w-full",
    "labelWrapperInline": "w-1/3 text-xs",
    "labelWrapperStacked": "w-full text-xs",
    "input": "w-full max-h-[150px] flex text-xs overflow-auto scrollbar-sm border rounded-md bg-white p-2 text-nowrap",
    "settingPillsWrapper": "flex flex-row flex-wrap gap-1",
    "settingPill": "px-1 py-0.5 bg-orange-500/15 text-orange-700 hover:bg-orange-500/25 rounded-md",
    "settingLabel": "text-gray-900 font-regular min-w-fit",
    "filtersWrapper": "w-full py-6 flex flex-col rounded-md"
  },
  "graph": {
    "text": "font-regular text-[12px]",
    "darkModeText": "bg-transparent text-white",
    "headerWrapper": "grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-x-1 gap-y-0.5",
    "columnControlWrapper": "px-1 font-semibold border bg-gray-50 text-gray-500",
    "scaleWrapper": "flex rounded-md p-1 divide-x border w-fit",
    "scaleItem": "font-semibold text-gray-500 hover:text-gray-700 px-2 py-1"
  },
  "Icons": {},
  "docs": {
    "PageView": {
      "title": "Page - View",
      "props": {
        "user": {
          "groups": [
            "AVAIL"
          ],
          "authed": "true"
        },
        "item": {
          "id": "1437075",
          "index": "0",
          "title": "Layout",
          "icon": "Settings",
          "parent": null,
          "history": [
            {
              "id": "1437074",
              "ref": "avail+8b636b33-04f4-4500-b88a-06bb5612b6a2|page-edit",
              "time": "Mon Aug 25 2025 21:44:06 GMT-0400 (Eastern Daylight Time)",
              "type": " created Page.",
              "created_at": "2025-08-26 01:44:08.888335+00",
              "updated_at": "2025-08-26 01:44:08.888335+00",
              "created_by": null,
              "updated_by": null
            },
            {
              "id": "1437076",
              "ref": "avail+8b636b33-04f4-4500-b88a-06bb5612b6a2|page-edit",
              "time": "Mon Aug 25 2025 21:44:13 GMT-0400 (Eastern Daylight Time)",
              "type": "published changes.",
              "user": "user",
              "created_at": "2025-08-26 01:44:14.272728+00",
              "updated_at": "2025-08-26 01:44:14.272728+00",
              "created_by": null,
              "updated_by": null
            },
            {
              "id": "1437078",
              "ref": "avail+8b636b33-04f4-4500-b88a-06bb5612b6a2|page-edit",
              "time": "Mon Aug 25 2025 21:44:26 GMT-0400 (Eastern Daylight Time)",
              "type": "added section 1",
              "user": "user",
              "created_at": "2025-08-26 01:44:27.138665+00",
              "updated_at": "2025-08-26 01:44:27.138665+00",
              "created_by": null,
              "updated_by": null
            },
            {
              "id": "1437079",
              "ref": "avail+8b636b33-04f4-4500-b88a-06bb5612b6a2|page-edit",
              "time": "Mon Aug 25 2025 21:44:28 GMT-0400 (Eastern Daylight Time)",
              "type": "published changes.",
              "user": "user",
              "created_at": "2025-08-26 01:44:28.548237+00",
              "updated_at": "2025-08-26 01:44:28.548237+00",
              "created_by": null,
              "updated_by": null
            },
            {
              "id": "1441061",
              "ref": "avail+8b636b33-04f4-4500-b88a-06bb5612b6a2|page-edit",
              "time": "Fri Aug 29 2025 15:27:10 GMT-0400 (Eastern Daylight Time)",
              "type": "edited section 1",
              "user": "user",
              "created_at": "2025-08-29 19:27:10.736895+00",
              "updated_at": "2025-08-29 19:27:10.736895+00",
              "created_by": null,
              "updated_by": null
            },
            {
              "id": "1441062",
              "ref": "avail+8b636b33-04f4-4500-b88a-06bb5612b6a2|page-edit",
              "time": "Fri Aug 29 2025 15:27:15 GMT-0400 (Eastern Daylight Time)",
              "type": "published changes.",
              "user": "user",
              "created_at": "2025-08-29 19:27:15.070169+00",
              "updated_at": "2025-08-29 19:27:15.070169+00",
              "created_by": null,
              "updated_by": null
            },
            {
              "id": "1441064",
              "ref": "avail+8b636b33-04f4-4500-b88a-06bb5612b6a2|page-edit",
              "time": "Fri Aug 29 2025 15:27:43 GMT-0400 (Eastern Daylight Time)",
              "type": "changed page title to Layout",
              "user": "user",
              "created_at": "2025-08-29 19:27:43.764682+00",
              "updated_at": "2025-08-29 19:27:43.764682+00",
              "created_by": null,
              "updated_by": null
            },
            {
              "id": "1441075",
              "ref": "avail+8b636b33-04f4-4500-b88a-06bb5612b6a2|page-edit",
              "time": "Fri Aug 29 2025 15:37:52 GMT-0400 (Eastern Daylight Time)",
              "type": "edited section 1",
              "user": "user",
              "created_at": "2025-08-29 19:37:53.039067+00",
              "updated_at": "2025-08-29 19:37:53.039067+00",
              "created_by": null,
              "updated_by": null
            },
            {
              "id": "1441092",
              "ref": "avail+8b636b33-04f4-4500-b88a-06bb5612b6a2|page-edit",
              "time": "Fri Aug 29 2025 15:57:43 GMT-0400 (Eastern Daylight Time)",
              "type": "published changes.",
              "user": "user",
              "created_at": "2025-08-29 19:57:43.5284+00",
              "updated_at": "2025-08-29 19:57:43.5284+00",
              "created_by": null,
              "updated_by": null
            }
          ],
          "sections": [
            {
              "id": "1441093",
              "ref": "avail+8b636b33-04f4-4500-b88a-06bb5612b6a2|cms-section",
              "group": "default",
              "element": {
                "element-data": "{\"bgColor\":\"rgba(0,0,0,0)\",\"text\":{\"root\":{\"children\":[{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"excepturi aut quisquam animi?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"heading\",\"version\":1,\"tag\":\"h1\"},{\"children\":[],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Lorem ipsum dolor sit amet. Et itaque laboreNon dolorum et velit sequi vel enim facilis ut incidunt iusto qui amet molestiae. Aut recusandae commodiCum iste sed quia nesciunt et ipsum voluptas ut necessitatibus rerum est voluptatem repellat? Eum quis animi sit repudiandae aliquidUt molestiae et quas perferendis. Sed rerum nisiUt fugit est incidunt voluptatem est magni eligendi et totam explicabo! Qui harum libero \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":2,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Ab tempore\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\" eum doloribus iste. 33 nulla minus et repellat eaquequo quia At neque iure aut galisum veritatis. At cumque quia et quia galisum \",\"type\":\"text\",\"version\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eum deleniti qui odio laboriosam et dolores adipisci\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"link\",\"version\":1,\"rel\":null,\"target\":\"_blank\",\"title\":null,\"url\":\"https://www.loremipzum.com/\"},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\".\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Qui magni ratione aut similique laudantium non quod omnis.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"heading\",\"version\":1,\"tag\":\"h2\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Id fugiat voluptas sit enim assumendaAd modi est facilis enim et iusto dolorem ad neque beatae ut enim voluptas! Id internos porro est dolore sintEt internos non obcaecati incidunt ut iusto reprehenderit. Est sunt tenetur \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":2,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Ex quos non fuga nihil eum quae laboriosam\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\" eos dolor itaque nam omnis quam. Ea dolorum quae id autem assumendaeos similique ea asperiores consequatur 33 perspiciatis dolorem. Est sequi sintUt velit vel incidunt minima in voluptas excepturi est sint autem. Sed distinctio doloribus qui molestiae laborumet similique. 33 illo aperiam ut veniam maiores \",\"type\":\"text\",\"version\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed fugit eos similique minus in dolores officia\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"link\",\"version\":1,\"rel\":null,\"target\":\"_blank\",\"title\":null,\"url\":\"https://www.loremipzum.com/\"},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\".\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Est maxime excepturi 33 totam assumenda et temporibus maxime.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Et eligendi perferendis rem pariatur galisum qui ullam sequi.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":2},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Qui quia ducimus non facilis architecto et illo voluptatum?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":3}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"list\",\"version\":1,\"listType\":\"number\",\"start\":1,\"tag\":\"ol\"},{\"children\":[],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Aut omnis molestiae vel amet molestiae et earum earum ea aliquid maxime vel ipsum dolor et magni omnis.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"quote\",\"version\":1},{\"children\":[],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Aut similique necessitatibus hic illum numquam ab facere velit.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"heading\",\"version\":1,\"tag\":\"h3\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed numquam officia in quaerat reprehenderit \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":1,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Est facilis et dolorem similique est praesentium ipsa est voluptatum optio\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\" vel dolores eligendi. Sit dolore quibusdam qui nobis dolorumAut galisum ex dolorem excepturi aut impedit quia ut amet repellendus. Qui consequatur nobisUt soluta sed ipsam repellat At consequatur ullam sit autem nihil sit reprehenderit quisquam ut placeat dolorum. Cum laborum maxime qui fuga modi \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":2,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Et laudantium est dolorem accusantium\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\" ut doloremque magnam aut delectus molestias eum modi sequi! Et optio temporeAb dolores non blanditiis unde sit voluptas galisum rem eveniet consequatur aut expedita autem ex quaerat nesciunt. Sit provident architecto aut rerum officiiset eveniet. Ut consequatur aliquamUt incidunt ex autem expedita est quisquam quisquam ex consequuntur veniam. Hic blanditiis assumenda aut omnis inventoreest voluptate. 33 consequatur culpaEt voluptas hic autem corrupti non distinctio galisum?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[],\"direction\":null,\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Qui molestiae provident ea velit labore et dolorem quasi.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed temporibus vitae et soluta rerum sit natus cupiditate aut sequi nemo.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":2},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed illo libero a dolores quas.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":3},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Rem iusto sapiente in maxime autem?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":4},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed accusantium possimus quo illo quod.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":5}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"list\",\"version\":1,\"listType\":\"bullet\",\"start\":1,\"tag\":\"ul\"},{\"children\":[],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"A commodi rerum ut fuga quod.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"heading\",\"version\":1,\"tag\":\"h4\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Ut dolorem culpa ut eius velitaut tempore? Ad voluptas odio \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":2,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eos voluptas non soluta omnis\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\". Et omnis quod et obcaecati magnirem facilis. Qui possimus laborum qui ullam voluptatemUt expedita et quia quod sit aspernatur galisum! Qui eveniet mollitiaQuo modi non voluptate sunt non necessitatibus sapiente est velit voluptatibus ut iure sint et molestias quia? Ut dolor excepturiEum iste et voluptatem consequatur et voluptatum minima et cupiditate dolorum. Qui perspiciatis quod non doloribus galisumQui earum est optio quas et magnam quos 33 officiis voluptates. Eum quia nihil in optio consequunturEos porro qui voluptatibus delectus est harum ducimus non nostrum voluptatum. Aut minima voluptate qui quia dictaId libero eum dolore dolorem qui quisquam tempore ex possimus magnam.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eos Quis labore qui voluptate consequatur.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Aut necessitatibus quisquam At laudantium illo eos inventore nihil sed animi reiciendis.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Est sunt necessitatibus quo cumque doloribus.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eum repellendus cumque eos magni sapiente et deleniti animi.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"root\",\"version\":1}},\"isCard\":\"\"}",
                "element-type": "lexical"
              },
              "trackingId": "e06e2735-a29d-44a6-8d01-8836dd1ca578",
              "created_at": "2025-08-29 19:57:43.551898+00",
              "updated_at": "2025-08-29 19:57:43.551898+00",
              "created_by": null,
              "updated_by": null
            }
          ],
          "url_slug": "layout",
          "published": null,
          "has_changes": false,
          "draft_sections": [
            {
              "id": "1437077",
              "ref": "avail+8b636b33-04f4-4500-b88a-06bb5612b6a2|cms-section",
              "group": "default",
              "element": {
                "element-data": "{\"bgColor\":\"rgba(0,0,0,0)\",\"text\":{\"root\":{\"children\":[{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"excepturi aut quisquam animi?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"heading\",\"version\":1,\"tag\":\"h1\"},{\"children\":[],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Lorem ipsum dolor sit amet. Et itaque laboreNon dolorum et velit sequi vel enim facilis ut incidunt iusto qui amet molestiae. Aut recusandae commodiCum iste sed quia nesciunt et ipsum voluptas ut necessitatibus rerum est voluptatem repellat? Eum quis animi sit repudiandae aliquidUt molestiae et quas perferendis. Sed rerum nisiUt fugit est incidunt voluptatem est magni eligendi et totam explicabo! Qui harum libero \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":2,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Ab tempore\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\" eum doloribus iste. 33 nulla minus et repellat eaquequo quia At neque iure aut galisum veritatis. At cumque quia et quia galisum \",\"type\":\"text\",\"version\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eum deleniti qui odio laboriosam et dolores adipisci\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"link\",\"version\":1,\"rel\":null,\"target\":\"_blank\",\"title\":null,\"url\":\"https://www.loremipzum.com/\"},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\".\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Qui magni ratione aut similique laudantium non quod omnis.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"heading\",\"version\":1,\"tag\":\"h2\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Id fugiat voluptas sit enim assumendaAd modi est facilis enim et iusto dolorem ad neque beatae ut enim voluptas! Id internos porro est dolore sintEt internos non obcaecati incidunt ut iusto reprehenderit. Est sunt tenetur \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":2,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Ex quos non fuga nihil eum quae laboriosam\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\" eos dolor itaque nam omnis quam. Ea dolorum quae id autem assumendaeos similique ea asperiores consequatur 33 perspiciatis dolorem. Est sequi sintUt velit vel incidunt minima in voluptas excepturi est sint autem. Sed distinctio doloribus qui molestiae laborumet similique. 33 illo aperiam ut veniam maiores \",\"type\":\"text\",\"version\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed fugit eos similique minus in dolores officia\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"link\",\"version\":1,\"rel\":null,\"target\":\"_blank\",\"title\":null,\"url\":\"https://www.loremipzum.com/\"},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\".\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Est maxime excepturi 33 totam assumenda et temporibus maxime.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Et eligendi perferendis rem pariatur galisum qui ullam sequi.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":2},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Qui quia ducimus non facilis architecto et illo voluptatum?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":3}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"list\",\"version\":1,\"listType\":\"number\",\"start\":1,\"tag\":\"ol\"},{\"children\":[],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Aut omnis molestiae vel amet molestiae et earum earum ea aliquid maxime vel ipsum dolor et magni omnis.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"quote\",\"version\":1},{\"children\":[],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Aut similique necessitatibus hic illum numquam ab facere velit.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"heading\",\"version\":1,\"tag\":\"h3\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed numquam officia in quaerat reprehenderit \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":1,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Est facilis et dolorem similique est praesentium ipsa est voluptatum optio\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\" vel dolores eligendi. Sit dolore quibusdam qui nobis dolorumAut galisum ex dolorem excepturi aut impedit quia ut amet repellendus. Qui consequatur nobisUt soluta sed ipsam repellat At consequatur ullam sit autem nihil sit reprehenderit quisquam ut placeat dolorum. Cum laborum maxime qui fuga modi \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":2,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Et laudantium est dolorem accusantium\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\" ut doloremque magnam aut delectus molestias eum modi sequi! Et optio temporeAb dolores non blanditiis unde sit voluptas galisum rem eveniet consequatur aut expedita autem ex quaerat nesciunt. Sit provident architecto aut rerum officiiset eveniet. Ut consequatur aliquamUt incidunt ex autem expedita est quisquam quisquam ex consequuntur veniam. Hic blanditiis assumenda aut omnis inventoreest voluptate. 33 consequatur culpaEt voluptas hic autem corrupti non distinctio galisum?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[],\"direction\":null,\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Qui molestiae provident ea velit labore et dolorem quasi.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed temporibus vitae et soluta rerum sit natus cupiditate aut sequi nemo.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":2},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed illo libero a dolores quas.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":3},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Rem iusto sapiente in maxime autem?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":4},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed accusantium possimus quo illo quod.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":5}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"list\",\"version\":1,\"listType\":\"bullet\",\"start\":1,\"tag\":\"ul\"},{\"children\":[],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"A commodi rerum ut fuga quod.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"heading\",\"version\":1,\"tag\":\"h4\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Ut dolorem culpa ut eius velitaut tempore? Ad voluptas odio \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":2,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eos voluptas non soluta omnis\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\". Et omnis quod et obcaecati magnirem facilis. Qui possimus laborum qui ullam voluptatemUt expedita et quia quod sit aspernatur galisum! Qui eveniet mollitiaQuo modi non voluptate sunt non necessitatibus sapiente est velit voluptatibus ut iure sint et molestias quia? Ut dolor excepturiEum iste et voluptatem consequatur et voluptatum minima et cupiditate dolorum. Qui perspiciatis quod non doloribus galisumQui earum est optio quas et magnam quos 33 officiis voluptates. Eum quia nihil in optio consequunturEos porro qui voluptatibus delectus est harum ducimus non nostrum voluptatum. Aut minima voluptate qui quia dictaId libero eum dolore dolorem qui quisquam tempore ex possimus magnam.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eos Quis labore qui voluptate consequatur.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Aut necessitatibus quisquam At laudantium illo eos inventore nihil sed animi reiciendis.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Est sunt necessitatibus quo cumque doloribus.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eum repellendus cumque eos magni sapiente et deleniti animi.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"root\",\"version\":1}},\"isCard\":\"\"}",
                "element-type": "lexical"
              },
              "trackingId": "e06e2735-a29d-44a6-8d01-8836dd1ca578",
              "created_at": "2025-08-26 01:44:27.077009+00",
              "updated_at": "2025-08-29 19:37:53.017996+00",
              "created_by": null,
              "updated_by": null
            }
          ],
          "section_groups": [
            {
              "name": "default",
              "index": 0,
              "theme": "content",
              "position": "content"
            }
          ],
          "draft_section_groups": [
            {
              "name": "default",
              "index": 0,
              "theme": "content",
              "position": "content"
            }
          ],
          "app": "avail",
          "type": "8b636b33-04f4-4500-b88a-06bb5612b6a2",
          "description": null,
          "navOptions": null,
          "hide_in_nav": null,
          "updated_at": "2025-08-29 19:57:43.569796+00",
          "created_at": "2025-08-26 01:44:08.928005+00",
          "filters": null,
          "sidebar": null,
          "theme": null
        },
        "dataItems": [
          {
            "id": "1437075",
            "index": "0",
            "title": "Layout",
            "icon": "Settings",
            "url_slug": "layout",
            "parent": null,
            "history": [
              {
                "id": "1437074",
                "ref": "avail+8b636b33-04f4-4500-b88a-06bb5612b6a2|page-edit",
                "time": "Mon Aug 25 2025 21:44:06 GMT-0400 (Eastern Daylight Time)",
                "type": " created Page.",
                "created_at": "2025-08-26 01:44:08.888335+00",
                "updated_at": "2025-08-26 01:44:08.888335+00",
                "created_by": null,
                "updated_by": null
              },
              {
                "id": "1437076",
                "ref": "avail+8b636b33-04f4-4500-b88a-06bb5612b6a2|page-edit",
                "time": "Mon Aug 25 2025 21:44:13 GMT-0400 (Eastern Daylight Time)",
                "type": "published changes.",
                "user": "user",
                "created_at": "2025-08-26 01:44:14.272728+00",
                "updated_at": "2025-08-26 01:44:14.272728+00",
                "created_by": null,
                "updated_by": null
              },
              {
                "id": "1437078",
                "ref": "avail+8b636b33-04f4-4500-b88a-06bb5612b6a2|page-edit",
                "time": "Mon Aug 25 2025 21:44:26 GMT-0400 (Eastern Daylight Time)",
                "type": "added section 1",
                "user": "user",
                "created_at": "2025-08-26 01:44:27.138665+00",
                "updated_at": "2025-08-26 01:44:27.138665+00",
                "created_by": null,
                "updated_by": null
              },
              {
                "id": "1437079",
                "ref": "avail+8b636b33-04f4-4500-b88a-06bb5612b6a2|page-edit",
                "time": "Mon Aug 25 2025 21:44:28 GMT-0400 (Eastern Daylight Time)",
                "type": "published changes.",
                "user": "user",
                "created_at": "2025-08-26 01:44:28.548237+00",
                "updated_at": "2025-08-26 01:44:28.548237+00",
                "created_by": null,
                "updated_by": null
              },
              {
                "id": "1441061",
                "ref": "avail+8b636b33-04f4-4500-b88a-06bb5612b6a2|page-edit",
                "time": "Fri Aug 29 2025 15:27:10 GMT-0400 (Eastern Daylight Time)",
                "type": "edited section 1",
                "user": "user",
                "created_at": "2025-08-29 19:27:10.736895+00",
                "updated_at": "2025-08-29 19:27:10.736895+00",
                "created_by": null,
                "updated_by": null
              },
              {
                "id": "1441062",
                "ref": "avail+8b636b33-04f4-4500-b88a-06bb5612b6a2|page-edit",
                "time": "Fri Aug 29 2025 15:27:15 GMT-0400 (Eastern Daylight Time)",
                "type": "published changes.",
                "user": "user",
                "created_at": "2025-08-29 19:27:15.070169+00",
                "updated_at": "2025-08-29 19:27:15.070169+00",
                "created_by": null,
                "updated_by": null
              },
              {
                "id": "1441064",
                "ref": "avail+8b636b33-04f4-4500-b88a-06bb5612b6a2|page-edit",
                "time": "Fri Aug 29 2025 15:27:43 GMT-0400 (Eastern Daylight Time)",
                "type": "changed page title to Layout",
                "user": "user",
                "created_at": "2025-08-29 19:27:43.764682+00",
                "updated_at": "2025-08-29 19:27:43.764682+00",
                "created_by": null,
                "updated_by": null
              }
            ],
            "sections": [
              {
                "id": "1441063",
                "ref": "avail+8b636b33-04f4-4500-b88a-06bb5612b6a2|cms-section",
                "group": "default",
                "element": {
                  "element-data": "{\"bgColor\":\"rgba(0,0,0,0)\",\"text\":{\"root\":{\"children\":[{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eum corrupti praesentium non dignissimos excepturi aut quisquam animi?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"heading\",\"version\":1,\"tag\":\"h1\"},{\"children\":[],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Lorem ipsum dolor sit amet. Et itaque laboreNon dolorum et velit sequi vel enim facilis ut incidunt iusto qui amet molestiae. Aut recusandae commodiCum iste sed quia nesciunt et ipsum voluptas ut necessitatibus rerum est voluptatem repellat? Eum quis animi sit repudiandae aliquidUt molestiae et quas perferendis. Sed rerum nisiUt fugit est incidunt voluptatem est magni eligendi et totam explicabo! Qui harum libero \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":2,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Ab tempore\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\" eum doloribus iste. 33 nulla minus et repellat eaquequo quia At neque iure aut galisum veritatis. At cumque quia et quia galisum \",\"type\":\"text\",\"version\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eum deleniti qui odio laboriosam et dolores adipisci\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"link\",\"version\":1,\"rel\":null,\"target\":\"_blank\",\"title\":null,\"url\":\"https://www.loremipzum.com/\"},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\".\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Qui magni ratione aut similique laudantium non quod omnis.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"heading\",\"version\":1,\"tag\":\"h2\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Id fugiat voluptas sit enim assumendaAd modi est facilis enim et iusto dolorem ad neque beatae ut enim voluptas! Id internos porro est dolore sintEt internos non obcaecati incidunt ut iusto reprehenderit. Est sunt tenetur \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":2,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Ex quos non fuga nihil eum quae laboriosam\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\" eos dolor itaque nam omnis quam. Ea dolorum quae id autem assumendaeos similique ea asperiores consequatur 33 perspiciatis dolorem. Est sequi sintUt velit vel incidunt minima in voluptas excepturi est sint autem. Sed distinctio doloribus qui molestiae laborumet similique. 33 illo aperiam ut veniam maiores \",\"type\":\"text\",\"version\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed fugit eos similique minus in dolores officia\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"link\",\"version\":1,\"rel\":null,\"target\":\"_blank\",\"title\":null,\"url\":\"https://www.loremipzum.com/\"},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\".\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Est maxime excepturi 33 totam assumenda et temporibus maxime.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Et eligendi perferendis rem pariatur galisum qui ullam sequi.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":2},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Qui quia ducimus non facilis architecto et illo voluptatum?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":3}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"list\",\"version\":1,\"listType\":\"number\",\"start\":1,\"tag\":\"ol\"},{\"children\":[],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Aut omnis molestiae vel amet molestiae et earum earum ea aliquid maxime vel ipsum dolor et magni omnis.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"quote\",\"version\":1},{\"children\":[],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Aut similique necessitatibus hic illum numquam ab facere velit.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"heading\",\"version\":1,\"tag\":\"h3\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed numquam officia in quaerat reprehenderit \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":1,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Est facilis et dolorem similique est praesentium ipsa est voluptatum optio\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\" vel dolores eligendi. Sit dolore quibusdam qui nobis dolorumAut galisum ex dolorem excepturi aut impedit quia ut amet repellendus. Qui consequatur nobisUt soluta sed ipsam repellat At consequatur ullam sit autem nihil sit reprehenderit quisquam ut placeat dolorum. Cum laborum maxime qui fuga modi \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":2,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Et laudantium est dolorem accusantium\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\" ut doloremque magnam aut delectus molestias eum modi sequi! Et optio temporeAb dolores non blanditiis unde sit voluptas galisum rem eveniet consequatur aut expedita autem ex quaerat nesciunt. Sit provident architecto aut rerum officiiset eveniet. Ut consequatur aliquamUt incidunt ex autem expedita est quisquam quisquam ex consequuntur veniam. Hic blanditiis assumenda aut omnis inventoreest voluptate. 33 consequatur culpaEt voluptas hic autem corrupti non distinctio galisum?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[],\"direction\":null,\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Qui molestiae provident ea velit labore et dolorem quasi.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed temporibus vitae et soluta rerum sit natus cupiditate aut sequi nemo.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":2},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed illo libero a dolores quas.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":3},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Rem iusto sapiente in maxime autem?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":4},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed accusantium possimus quo illo quod.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":5}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"list\",\"version\":1,\"listType\":\"bullet\",\"start\":1,\"tag\":\"ul\"},{\"children\":[],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"A commodi rerum ut fuga quod.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"heading\",\"version\":1,\"tag\":\"h4\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Ut dolorem culpa ut eius velitaut tempore? Ad voluptas odio \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":2,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eos voluptas non soluta omnis\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\". Et omnis quod et obcaecati magnirem facilis. Qui possimus laborum qui ullam voluptatemUt expedita et quia quod sit aspernatur galisum! Qui eveniet mollitiaQuo modi non voluptate sunt non necessitatibus sapiente est velit voluptatibus ut iure sint et molestias quia? Ut dolor excepturiEum iste et voluptatem consequatur et voluptatum minima et cupiditate dolorum. Qui perspiciatis quod non doloribus galisumQui earum est optio quas et magnam quos 33 officiis voluptates. Eum quia nihil in optio consequunturEos porro qui voluptatibus delectus est harum ducimus non nostrum voluptatum. Aut minima voluptate qui quia dictaId libero eum dolore dolorem qui quisquam tempore ex possimus magnam.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eos Quis labore qui voluptate consequatur.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Aut necessitatibus quisquam At laudantium illo eos inventore nihil sed animi reiciendis.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Est sunt necessitatibus quo cumque doloribus.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eum repellendus cumque eos magni sapiente et deleniti animi.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"root\",\"version\":1}},\"isCard\":\"\"}",
                  "element-type": "lexical"
                },
                "trackingId": "e06e2735-a29d-44a6-8d01-8836dd1ca578",
                "created_at": "2025-08-29 19:27:15.08844+00",
                "updated_at": "2025-08-29 19:27:15.08844+00",
                "created_by": null,
                "updated_by": null
              }
            ],
            "published": null,
            "has_changes": false,
            "draft_sections": [
              {
                "id": "1437077",
                "ref": "avail+8b636b33-04f4-4500-b88a-06bb5612b6a2|cms-section",
                "group": "default",
                "element": {
                  "element-data": "{\"bgColor\":\"rgba(0,0,0,0)\",\"text\":{\"root\":{\"children\":[{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eum corrupti praesentium non dignissimos excepturi aut quisquam animi?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"heading\",\"version\":1,\"tag\":\"h1\"},{\"children\":[],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Lorem ipsum dolor sit amet. Et itaque laboreNon dolorum et velit sequi vel enim facilis ut incidunt iusto qui amet molestiae. Aut recusandae commodiCum iste sed quia nesciunt et ipsum voluptas ut necessitatibus rerum est voluptatem repellat? Eum quis animi sit repudiandae aliquidUt molestiae et quas perferendis. Sed rerum nisiUt fugit est incidunt voluptatem est magni eligendi et totam explicabo! Qui harum libero \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":2,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Ab tempore\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\" eum doloribus iste. 33 nulla minus et repellat eaquequo quia At neque iure aut galisum veritatis. At cumque quia et quia galisum \",\"type\":\"text\",\"version\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eum deleniti qui odio laboriosam et dolores adipisci\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"link\",\"version\":1,\"rel\":null,\"target\":\"_blank\",\"title\":null,\"url\":\"https://www.loremipzum.com/\"},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\".\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Qui magni ratione aut similique laudantium non quod omnis.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"heading\",\"version\":1,\"tag\":\"h2\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Id fugiat voluptas sit enim assumendaAd modi est facilis enim et iusto dolorem ad neque beatae ut enim voluptas! Id internos porro est dolore sintEt internos non obcaecati incidunt ut iusto reprehenderit. Est sunt tenetur \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":2,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Ex quos non fuga nihil eum quae laboriosam\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\" eos dolor itaque nam omnis quam. Ea dolorum quae id autem assumendaeos similique ea asperiores consequatur 33 perspiciatis dolorem. Est sequi sintUt velit vel incidunt minima in voluptas excepturi est sint autem. Sed distinctio doloribus qui molestiae laborumet similique. 33 illo aperiam ut veniam maiores \",\"type\":\"text\",\"version\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed fugit eos similique minus in dolores officia\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"link\",\"version\":1,\"rel\":null,\"target\":\"_blank\",\"title\":null,\"url\":\"https://www.loremipzum.com/\"},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\".\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Est maxime excepturi 33 totam assumenda et temporibus maxime.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Et eligendi perferendis rem pariatur galisum qui ullam sequi.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":2},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Qui quia ducimus non facilis architecto et illo voluptatum?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":3}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"list\",\"version\":1,\"listType\":\"number\",\"start\":1,\"tag\":\"ol\"},{\"children\":[],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Aut omnis molestiae vel amet molestiae et earum earum ea aliquid maxime vel ipsum dolor et magni omnis.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"quote\",\"version\":1},{\"children\":[],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Aut similique necessitatibus hic illum numquam ab facere velit.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"heading\",\"version\":1,\"tag\":\"h3\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed numquam officia in quaerat reprehenderit \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":1,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Est facilis et dolorem similique est praesentium ipsa est voluptatum optio\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\" vel dolores eligendi. Sit dolore quibusdam qui nobis dolorumAut galisum ex dolorem excepturi aut impedit quia ut amet repellendus. Qui consequatur nobisUt soluta sed ipsam repellat At consequatur ullam sit autem nihil sit reprehenderit quisquam ut placeat dolorum. Cum laborum maxime qui fuga modi \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":2,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Et laudantium est dolorem accusantium\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\" ut doloremque magnam aut delectus molestias eum modi sequi! Et optio temporeAb dolores non blanditiis unde sit voluptas galisum rem eveniet consequatur aut expedita autem ex quaerat nesciunt. Sit provident architecto aut rerum officiiset eveniet. Ut consequatur aliquamUt incidunt ex autem expedita est quisquam quisquam ex consequuntur veniam. Hic blanditiis assumenda aut omnis inventoreest voluptate. 33 consequatur culpaEt voluptas hic autem corrupti non distinctio galisum?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[],\"direction\":null,\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Qui molestiae provident ea velit labore et dolorem quasi.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed temporibus vitae et soluta rerum sit natus cupiditate aut sequi nemo.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":2},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed illo libero a dolores quas.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":3},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Rem iusto sapiente in maxime autem?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":4},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed accusantium possimus quo illo quod.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":5}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"list\",\"version\":1,\"listType\":\"bullet\",\"start\":1,\"tag\":\"ul\"},{\"children\":[],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"A commodi rerum ut fuga quod.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"heading\",\"version\":1,\"tag\":\"h4\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Ut dolorem culpa ut eius velitaut tempore? Ad voluptas odio \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":2,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eos voluptas non soluta omnis\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\". Et omnis quod et obcaecati magnirem facilis. Qui possimus laborum qui ullam voluptatemUt expedita et quia quod sit aspernatur galisum! Qui eveniet mollitiaQuo modi non voluptate sunt non necessitatibus sapiente est velit voluptatibus ut iure sint et molestias quia? Ut dolor excepturiEum iste et voluptatem consequatur et voluptatum minima et cupiditate dolorum. Qui perspiciatis quod non doloribus galisumQui earum est optio quas et magnam quos 33 officiis voluptates. Eum quia nihil in optio consequunturEos porro qui voluptatibus delectus est harum ducimus non nostrum voluptatum. Aut minima voluptate qui quia dictaId libero eum dolore dolorem qui quisquam tempore ex possimus magnam.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eos Quis labore qui voluptate consequatur.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Aut necessitatibus quisquam At laudantium illo eos inventore nihil sed animi reiciendis.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Est sunt necessitatibus quo cumque doloribus.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eum repellendus cumque eos magni sapiente et deleniti animi.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"root\",\"version\":1}},\"isCard\":\"\"}",
                  "element-type": "lexical"
                },
                "trackingId": "e06e2735-a29d-44a6-8d01-8836dd1ca578",
                "created_at": "2025-08-26 01:44:27.077009+00",
                "updated_at": "2025-08-29 19:27:10.679262+00",
                "created_by": null,
                "updated_by": null
              }
            ],
            "section_groups": [
              {
                "name": "content",
                "index": 0,
                "theme": "content",
                "position": "content"
              }
            ],
            "draft_section_groups": [
              {
                "name": "default",
                "index": 0,
                "theme": "content",
                "position": "content"
              }
            ],
            "app": "avail",
            "type": "8b636b33-04f4-4500-b88a-06bb5612b6a2",
            "description": null,
            "navOptions": null,
            "hide_in_nav": null,
            "updated_at": "2025-08-29 19:27:43.785753+00",
            "created_at": "2025-08-26 01:44:08.928005+00",
            "filters": null,
            "sidebar": null,
            "theme": null
          },
          {
            "id": "1437077",
            "index": "1",
            "title": "Projects",
            "icon": "",
            "url_slug": "projects"
          },
          {
            "id": "1437079",
            "index": "8",
            "title": "Project One",
            "icon": "",
            "url_slug": "project_one",
            "parent": "1437077"
          },
          {
            "id": "1437075",
            "index": "2",
            "title": "Layout",
            "icon": "Settings",
            "url_slug": "layout",
            "parent": null,
            "history": [],
            "sections": [
              {
                "id": "1441063",
                "ref": "avail+8b636b33-04f4-4500-b88a-06bb5612b6a2|cms-section",
                "group": "default",
                "element": {
                  "element-data": "{\"bgColor\":\"rgba(0,0,0,0)\",\"text\":{\"root\":{\"children\":[{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eum corrupti praesentium non dignissimos excepturi aut quisquam animi?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"heading\",\"version\":1,\"tag\":\"h1\"},{\"children\":[],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Lorem ipsum dolor sit amet. Et itaque laboreNon dolorum et velit sequi vel enim facilis ut incidunt iusto qui amet molestiae. Aut recusandae commodiCum iste sed quia nesciunt et ipsum voluptas ut necessitatibus rerum est voluptatem repellat? Eum quis animi sit repudiandae aliquidUt molestiae et quas perferendis. Sed rerum nisiUt fugit est incidunt voluptatem est magni eligendi et totam explicabo! Qui harum libero \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":2,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Ab tempore\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\" eum doloribus iste. 33 nulla minus et repellat eaquequo quia At neque iure aut galisum veritatis. At cumque quia et quia galisum \",\"type\":\"text\",\"version\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eum deleniti qui odio laboriosam et dolores adipisci\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"link\",\"version\":1,\"rel\":null,\"target\":\"_blank\",\"title\":null,\"url\":\"https://www.loremipzum.com/\"},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\".\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Qui magni ratione aut similique laudantium non quod omnis.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"heading\",\"version\":1,\"tag\":\"h2\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Id fugiat voluptas sit enim assumendaAd modi est facilis enim et iusto dolorem ad neque beatae ut enim voluptas! Id internos porro est dolore sintEt internos non obcaecati incidunt ut iusto reprehenderit. Est sunt tenetur \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":2,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Ex quos non fuga nihil eum quae laboriosam\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\" eos dolor itaque nam omnis quam. Ea dolorum quae id autem assumendaeos similique ea asperiores consequatur 33 perspiciatis dolorem. Est sequi sintUt velit vel incidunt minima in voluptas excepturi est sint autem. Sed distinctio doloribus qui molestiae laborumet similique. 33 illo aperiam ut veniam maiores \",\"type\":\"text\",\"version\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed fugit eos similique minus in dolores officia\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"link\",\"version\":1,\"rel\":null,\"target\":\"_blank\",\"title\":null,\"url\":\"https://www.loremipzum.com/\"},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\".\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Est maxime excepturi 33 totam assumenda et temporibus maxime.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Et eligendi perferendis rem pariatur galisum qui ullam sequi.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":2},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Qui quia ducimus non facilis architecto et illo voluptatum?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":3}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"list\",\"version\":1,\"listType\":\"number\",\"start\":1,\"tag\":\"ol\"},{\"children\":[],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Aut omnis molestiae vel amet molestiae et earum earum ea aliquid maxime vel ipsum dolor et magni omnis.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"quote\",\"version\":1},{\"children\":[],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Aut similique necessitatibus hic illum numquam ab facere velit.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"heading\",\"version\":1,\"tag\":\"h3\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed numquam officia in quaerat reprehenderit \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":1,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Est facilis et dolorem similique est praesentium ipsa est voluptatum optio\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\" vel dolores eligendi. Sit dolore quibusdam qui nobis dolorumAut galisum ex dolorem excepturi aut impedit quia ut amet repellendus. Qui consequatur nobisUt soluta sed ipsam repellat At consequatur ullam sit autem nihil sit reprehenderit quisquam ut placeat dolorum. Cum laborum maxime qui fuga modi \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":2,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Et laudantium est dolorem accusantium\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\" ut doloremque magnam aut delectus molestias eum modi sequi! Et optio temporeAb dolores non blanditiis unde sit voluptas galisum rem eveniet consequatur aut expedita autem ex quaerat nesciunt. Sit provident architecto aut rerum officiiset eveniet. Ut consequatur aliquamUt incidunt ex autem expedita est quisquam quisquam ex consequuntur veniam. Hic blanditiis assumenda aut omnis inventoreest voluptate. 33 consequatur culpaEt voluptas hic autem corrupti non distinctio galisum?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[],\"direction\":null,\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Qui molestiae provident ea velit labore et dolorem quasi.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed temporibus vitae et soluta rerum sit natus cupiditate aut sequi nemo.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":2},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed illo libero a dolores quas.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":3},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Rem iusto sapiente in maxime autem?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":4},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed accusantium possimus quo illo quod.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":5}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"list\",\"version\":1,\"listType\":\"bullet\",\"start\":1,\"tag\":\"ul\"},{\"children\":[],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"A commodi rerum ut fuga quod.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"heading\",\"version\":1,\"tag\":\"h4\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Ut dolorem culpa ut eius velitaut tempore? Ad voluptas odio \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":2,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eos voluptas non soluta omnis\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\". Et omnis quod et obcaecati magnirem facilis. Qui possimus laborum qui ullam voluptatemUt expedita et quia quod sit aspernatur galisum! Qui eveniet mollitiaQuo modi non voluptate sunt non necessitatibus sapiente est velit voluptatibus ut iure sint et molestias quia? Ut dolor excepturiEum iste et voluptatem consequatur et voluptatum minima et cupiditate dolorum. Qui perspiciatis quod non doloribus galisumQui earum est optio quas et magnam quos 33 officiis voluptates. Eum quia nihil in optio consequunturEos porro qui voluptatibus delectus est harum ducimus non nostrum voluptatum. Aut minima voluptate qui quia dictaId libero eum dolore dolorem qui quisquam tempore ex possimus magnam.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eos Quis labore qui voluptate consequatur.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Aut necessitatibus quisquam At laudantium illo eos inventore nihil sed animi reiciendis.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Est sunt necessitatibus quo cumque doloribus.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eum repellendus cumque eos magni sapiente et deleniti animi.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"root\",\"version\":1}},\"isCard\":\"\"}",
                  "element-type": "lexical"
                },
                "trackingId": "e06e2735-a29d-44a6-8d01-8836dd1ca578",
                "created_at": "2025-08-29 19:27:15.08844+00",
                "updated_at": "2025-08-29 19:27:15.08844+00",
                "created_by": null,
                "updated_by": null
              }
            ],
            "published": null,
            "has_changes": false,
            "draft_sections": [],
            "section_groups": [
              {
                "name": "content",
                "index": 0,
                "theme": "content",
                "position": "content"
              }
            ],
            "draft_section_groups": [
              {
                "name": "default",
                "index": 0,
                "theme": "content",
                "position": "content"
              }
            ],
            "app": "avail",
            "type": "8b636b33-04f4-4500-b88a-06bb5612b6a2",
            "description": null,
            "navOptions": null,
            "hide_in_nav": null,
            "updated_at": "2025-08-29 19:27:43.785753+00",
            "created_at": "2025-08-26 01:44:08.928005+00",
            "filters": null,
            "sidebar": null,
            "theme": null
          },
          {
            "id": "1437075",
            "index": "2",
            "title": "Layout",
            "icon": "Settings",
            "parent": null,
            "history": [],
            "sections": [
              {
                "id": "1441063",
                "ref": "avail+8b636b33-04f4-4500-b88a-06bb5612b6a2|cms-section",
                "group": "default",
                "element": {
                  "element-data": "{\"bgColor\":\"rgba(0,0,0,0)\",\"text\":{\"root\":{\"children\":[{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eum corrupti praesentium non dignissimos excepturi aut quisquam animi?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"heading\",\"version\":1,\"tag\":\"h1\"},{\"children\":[],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Lorem ipsum dolor sit amet. Et itaque laboreNon dolorum et velit sequi vel enim facilis ut incidunt iusto qui amet molestiae. Aut recusandae commodiCum iste sed quia nesciunt et ipsum voluptas ut necessitatibus rerum est voluptatem repellat? Eum quis animi sit repudiandae aliquidUt molestiae et quas perferendis. Sed rerum nisiUt fugit est incidunt voluptatem est magni eligendi et totam explicabo! Qui harum libero \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":2,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Ab tempore\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\" eum doloribus iste. 33 nulla minus et repellat eaquequo quia At neque iure aut galisum veritatis. At cumque quia et quia galisum \",\"type\":\"text\",\"version\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eum deleniti qui odio laboriosam et dolores adipisci\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"link\",\"version\":1,\"rel\":null,\"target\":\"_blank\",\"title\":null,\"url\":\"https://www.loremipzum.com/\"},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\".\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Qui magni ratione aut similique laudantium non quod omnis.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"heading\",\"version\":1,\"tag\":\"h2\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Id fugiat voluptas sit enim assumendaAd modi est facilis enim et iusto dolorem ad neque beatae ut enim voluptas! Id internos porro est dolore sintEt internos non obcaecati incidunt ut iusto reprehenderit. Est sunt tenetur \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":2,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Ex quos non fuga nihil eum quae laboriosam\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\" eos dolor itaque nam omnis quam. Ea dolorum quae id autem assumendaeos similique ea asperiores consequatur 33 perspiciatis dolorem. Est sequi sintUt velit vel incidunt minima in voluptas excepturi est sint autem. Sed distinctio doloribus qui molestiae laborumet similique. 33 illo aperiam ut veniam maiores \",\"type\":\"text\",\"version\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed fugit eos similique minus in dolores officia\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"link\",\"version\":1,\"rel\":null,\"target\":\"_blank\",\"title\":null,\"url\":\"https://www.loremipzum.com/\"},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\".\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Est maxime excepturi 33 totam assumenda et temporibus maxime.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Et eligendi perferendis rem pariatur galisum qui ullam sequi.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":2},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Qui quia ducimus non facilis architecto et illo voluptatum?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":3}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"list\",\"version\":1,\"listType\":\"number\",\"start\":1,\"tag\":\"ol\"},{\"children\":[],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Aut omnis molestiae vel amet molestiae et earum earum ea aliquid maxime vel ipsum dolor et magni omnis.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"quote\",\"version\":1},{\"children\":[],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Aut similique necessitatibus hic illum numquam ab facere velit.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"heading\",\"version\":1,\"tag\":\"h3\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed numquam officia in quaerat reprehenderit \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":1,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Est facilis et dolorem similique est praesentium ipsa est voluptatum optio\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\" vel dolores eligendi. Sit dolore quibusdam qui nobis dolorumAut galisum ex dolorem excepturi aut impedit quia ut amet repellendus. Qui consequatur nobisUt soluta sed ipsam repellat At consequatur ullam sit autem nihil sit reprehenderit quisquam ut placeat dolorum. Cum laborum maxime qui fuga modi \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":2,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Et laudantium est dolorem accusantium\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\" ut doloremque magnam aut delectus molestias eum modi sequi! Et optio temporeAb dolores non blanditiis unde sit voluptas galisum rem eveniet consequatur aut expedita autem ex quaerat nesciunt. Sit provident architecto aut rerum officiiset eveniet. Ut consequatur aliquamUt incidunt ex autem expedita est quisquam quisquam ex consequuntur veniam. Hic blanditiis assumenda aut omnis inventoreest voluptate. 33 consequatur culpaEt voluptas hic autem corrupti non distinctio galisum?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[],\"direction\":null,\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Qui molestiae provident ea velit labore et dolorem quasi.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed temporibus vitae et soluta rerum sit natus cupiditate aut sequi nemo.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":2},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed illo libero a dolores quas.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":3},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Rem iusto sapiente in maxime autem?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":4},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Sed accusantium possimus quo illo quod.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"listitem\",\"version\":1,\"value\":5}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"list\",\"version\":1,\"listType\":\"bullet\",\"start\":1,\"tag\":\"ul\"},{\"children\":[],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"A commodi rerum ut fuga quod.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"heading\",\"version\":1,\"tag\":\"h4\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Ut dolorem culpa ut eius velitaut tempore? Ad voluptas odio \",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":2,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eos voluptas non soluta omnis\",\"type\":\"text\",\"version\":1},{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\". Et omnis quod et obcaecati magnirem facilis. Qui possimus laborum qui ullam voluptatemUt expedita et quia quod sit aspernatur galisum! Qui eveniet mollitiaQuo modi non voluptate sunt non necessitatibus sapiente est velit voluptatibus ut iure sint et molestias quia? Ut dolor excepturiEum iste et voluptatem consequatur et voluptatum minima et cupiditate dolorum. Qui perspiciatis quod non doloribus galisumQui earum est optio quas et magnam quos 33 officiis voluptates. Eum quia nihil in optio consequunturEos porro qui voluptatibus delectus est harum ducimus non nostrum voluptatum. Aut minima voluptate qui quia dictaId libero eum dolore dolorem qui quisquam tempore ex possimus magnam.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eos Quis labore qui voluptate consequatur.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Aut necessitatibus quisquam At laudantium illo eos inventore nihil sed animi reiciendis.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Est sunt necessitatibus quo cumque doloribus.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Eum repellendus cumque eos magni sapiente et deleniti animi.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"start\",\"indent\":0,\"type\":\"paragraph\",\"version\":1,\"textFormat\":0,\"textStyle\":\"\"}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"root\",\"version\":1}},\"isCard\":\"\"}",
                  "element-type": "lexical"
                },
                "trackingId": "e06e2735-a29d-44a6-8d01-8836dd1ca578",
                "created_at": "2025-08-29 19:27:15.08844+00",
                "updated_at": "2025-08-29 19:27:15.08844+00",
                "created_by": null,
                "updated_by": null
              }
            ],
            "url_slug": "layout",
            "published": null,
            "has_changes": false,
            "draft_sections": [],
            "section_groups": [
              {
                "name": "content",
                "index": 0,
                "theme": "content",
                "position": "content"
              }
            ],
            "draft_section_groups": [
              {
                "name": "default",
                "index": 0,
                "theme": "content",
                "position": "content"
              }
            ],
            "app": "avail",
            "type": "8b636b33-04f4-4500-b88a-06bb5612b6a2",
            "description": null,
            "navOptions": null,
            "hide_in_nav": null,
            "updated_at": "2025-08-29 19:27:43.785753+00",
            "created_at": "2025-08-26 01:44:08.928005+00",
            "filters": null,
            "sidebar": null,
            "theme": null
          }
        ]
      }
    },
    "Input": {
      "doc_name": "example 1",
      "type": "text",
      "placeholder": "Please Enter value..."
    },
    "Select": {
      "options": [
        {
          "label": "Option 1",
          "value": 1
        },
        {
          "label": "Option 2",
          "value": 2
        },
        {
          "label": "Option 3",
          "value": 3
        },
        {
          "label": "Option 4",
          "value": 4
        }
      ],
      "multiple": false
    },
    "Table": {
      "columns": [
        {
          "name": "first_name",
          "display_name": "First Name",
          "show": true,
          "type": "text"
        },
        {
          "name": "last_name",
          "display_name": "Last Name",
          "show": true,
          "type": "text"
        },
        {
          "name": "email",
          "display_name": "Email Address",
          "show": true,
          "type": "text"
        },
        {
          "name": "city",
          "display_name": "City",
          "show": true,
          "type": "text"
        }
      ],
      "data": [
        {
          "first_name": "Alice",
          "last_name": "Johnson",
          "email": "alice.johnson@example.com",
          "city": "New York"
        },
        {
          "first_name": "Bob",
          "last_name": "Smith",
          "email": "bob.smith@example.com",
          "city": "Los Angeles"
        },
        {
          "first_name": "Carol",
          "last_name": "Davis",
          "email": "carol.davis@example.com",
          "city": "Chicago"
        },
        {
          "first_name": "David",
          "last_name": "Brown",
          "email": "david.brown@example.com",
          "city": "Houston"
        }
      ]
    },
    "Card": [
      {
        "columns": [
          {
            "name": "first_name",
            "display_name": "First Name",
            "show": true,
            "type": "text"
          },
          {
            "name": "last_name",
            "display_name": "Last Name",
            "show": true,
            "type": "text"
          },
          {
            "name": "email",
            "display_name": "Email Address",
            "show": true,
            "type": "text"
          },
          {
            "name": "city",
            "display_name": "City",
            "show": true,
            "type": "text"
          }
        ],
        "data": [
          {
            "first_name": "Alice",
            "last_name": "Johnson",
            "email": "alice.johnson@example.com",
            "city": "New York"
          },
          {
            "first_name": "Bob",
            "last_name": "Smith",
            "email": "bob.smith@example.com",
            "city": "Los Angeles"
          },
          {
            "first_name": "Carol",
            "last_name": "Davis",
            "email": "carol.davis@example.com",
            "city": "Chicago"
          },
          {
            "first_name": "David",
            "last_name": "Brown",
            "email": "david.brown@example.com",
            "city": "Houston"
          }
        ],
        "display": {
          "compactView": true
        }
      },
      {
        "columns": [
          {
            "name": "first_name",
            "display_name": "First Name",
            "show": true,
            "type": "text"
          },
          {
            "name": "last_name",
            "display_name": "Last Name",
            "show": true,
            "type": "text"
          },
          {
            "name": "email",
            "display_name": "Email Address",
            "show": true,
            "type": "text"
          },
          {
            "name": "city",
            "display_name": "City",
            "show": true,
            "type": "text"
          }
        ],
        "data": [
          {
            "first_name": "Alice",
            "last_name": "Johnson",
            "email": "alice.johnson@example.com",
            "city": "New York"
          },
          {
            "first_name": "Bob",
            "last_name": "Smith",
            "email": "bob.smith@example.com",
            "city": "Los Angeles"
          },
          {
            "first_name": "Carol",
            "last_name": "Davis",
            "email": "carol.davis@example.com",
            "city": "Chicago"
          },
          {
            "first_name": "David",
            "last_name": "Brown",
            "email": "david.brown@example.com",
            "city": "Houston"
          }
        ],
        "display": {
          "compactView": false
        }
      }
    ],
    "Graph": [
      {
        "columns": [
          {
            "name": "month",
            "display_name": "Month",
            "type": "text",
            "xAxis": true,
            "show": true
          },
          {
            "name": "sales",
            "display_name": "Sales ($)",
            "type": "number",
            "yAxis": true,
            "fn": "sum",
            "show": true
          },
          {
            "name": "region",
            "display_name": "Region",
            "type": "text"
          }
        ],
        "data": [
          {
            "month": "January",
            "sales": 12000,
            "region": "North"
          },
          {
            "month": "February",
            "sales": 15000,
            "region": "South"
          },
          {
            "month": "March",
            "sales": 13000,
            "region": "East"
          },
          {
            "month": "April",
            "sales": 17000,
            "region": "West"
          },
          {
            "month": "May",
            "sales": 16000,
            "region": "North"
          }
        ],
        "display": {
          "graphType": "BarGraph",
          "groupMode": "stacked",
          "orientation": "vertical",
          "showAttribution": true,
          "title": {
            "title": "",
            "position": "start",
            "fontSize": 32,
            "fontWeight": "bold"
          },
          "description": "",
          "bgColor": "#ffffff",
          "textColor": "#000000",
          "height": 300,
          "margins": {
            "marginTop": 20,
            "marginRight": 20,
            "marginBottom": 50,
            "marginLeft": 100
          },
          "legend": {
            "show": true,
            "label": ""
          },
          "tooltip": {
            "show": true,
            "fontSize": 12
          }
        }
      }
    ],
    "Modal": {
      "children": {
        "type": "div",
        "key": null,
        "props": {
          "children": "modal content"
        },
        "_owner": null,
        "_store": {}
      },
      "open": true
    },
    "SideNav": {
      "menuItems": [
        {
          "name": "Nav Item 1",
          "to": "/one"
        },
        {
          "name": "Nav Item 2",
          "to": "/two"
        },
        {
          "name": "Nav Item 3",
          "to": "/three"
        },
        {
          "name": "Nav Item 4",
          "to": "/four"
        },
        {
          "name": "Nav Item 5",
          "to": "/five"
        }
      ]
    },
    "TopNav": {
      "menuItems": [
        {
          "name": "Nav Item 1",
          "to": "/one"
        },
        {
          "name": "Nav Item 2",
          "to": "/two"
        },
        {
          "name": "Nav Item 3",
          "to": "/three"
        },
        {
          "name": "Nav Item 4",
          "to": "/four"
        },
        {
          "name": "Nav Item 5",
          "to": "/five"
        }
      ]
    },
    "Icon": [
      {
        "icon": "Default"
      },
      {
        "icon": "ArrowDown"
      }
    ],
    "Button": [
      {
        "type": "default",
        "children": "Button",
        "doc_name": "Default Button"
      },
      {
        "type": "plain",
        "children": "Button",
        "doc_name": "Plain Button"
      },
      {
        "type": "active",
        "children": "Button",
        "doc_name": "Active Button"
      },
      {
        "type": "inactive",
        "children": "Button",
        "doc_name": "Inactive Button"
      }
    ],
    "Dialog": {
      "size": "lg",
      "open": true,
      "children": {
        "type": "div",
        "key": null,
        "props": {
          "children": "Dialog"
        },
        "_owner": null,
        "_store": {}
      }
    },
    "Label": {
      "text": "Label Text"
    },
    "Popover": {
      "anchor": "bottom"
    },
    "Pill": [
      {
        "color": "orange",
        "text": "text"
      },
      {
        "color": "blue",
        "text": "text"
      }
    ],
    "Menu": {
      "children": {
        "type": "div",
        "key": null,
        "props": {
          "children": "menu btn"
        },
        "_owner": null,
        "_store": {}
      }
    },
    "FieldSet": {
      "themeKey": "field",
      "components": [
        {
          "label": "field 1",
          "description": "this is field 1."
        },
        {
          "label": "field 2",
          "description": "this is field 2."
        }
      ]
    },
    "Switch": [
      {
        "enabled": false,
        "size": "xs",
        "doc_name": "x-small inactive"
      },
      {
        "enabled": true,
        "size": "xs",
        "doc_name": "x-small active"
      },
      {
        "enabled": false,
        "size": "small",
        "doc_name": "small inactive"
      },
      {
        "enabled": true,
        "size": "small",
        "doc_name": "small active"
      },
      {
        "enabled": false,
        "size": "medium",
        "doc_name": "medium inactive"
      },
      {
        "enabled": true,
        "size": "medium",
        "doc_name": "medium active"
      }
    ],
    "Tabs": {
      "tabs": [
        {
          "name": "Tab1"
        },
        {
          "name": "Tab2"
        }
      ]
    },
    "Drawer": {
      "open": true,
      "children": {
        "type": "div",
        "key": null,
        "props": {
          "children": "drawer content"
        },
        "_owner": null,
        "_store": {}
      }
    },
    "Dropdown": [
      {
        "doc_name": "hover",
        "control": {
          "type": "div",
          "key": null,
          "props": {
            "children": "hover me!"
          },
          "_owner": null,
          "_store": {}
        },
        "children": {
          "type": "div",
          "key": null,
          "props": {
            "children": "content"
          },
          "_owner": null,
          "_store": {}
        }
      },
      {
        "doc_name": "click",
        "control": {
          "type": "div",
          "key": null,
          "props": {
            "children": "hover me!"
          },
          "_owner": null,
          "_store": {}
        },
        "children": {
          "type": "div",
          "key": null,
          "props": {
            "children": "content"
          },
          "_owner": null,
          "_store": {}
        },
        "openType": "click"
      }
    ],
    "DeleteModal": {
      "title": "title",
      "prompt": "Prompt",
      "open": true
    },
    "DraggableNav": {
      "themeKey": "nestable",
      "dataItems": [
        {
          "id": 1,
          "index": 0,
          "title": "Parent One",
          "url_slug": "/parent-one"
        },
        {
          "id": 2,
          "index": 1,
          "title": "Child One A",
          "url_slug": "/parent-one/child-a",
          "parent": 1
        },
        {
          "id": 3,
          "index": 2,
          "title": "Child One B",
          "url_slug": "/parent-one/child-b",
          "parent": 1
        },
        {
          "id": 4,
          "index": 3,
          "title": "Parent Two",
          "url_slug": "/parent-two"
        },
        {
          "id": 5,
          "index": 4,
          "title": "Child Two A",
          "url_slug": "/parent-two/child-a",
          "parent": 4
        },
        {
          "id": 6,
          "index": 5,
          "title": "Parent Three",
          "url_slug": "/parent-three"
        },
        {
          "id": 7,
          "index": 6,
          "title": "Child Three A",
          "url_slug": "/parent-three/child-a",
          "parent": 6
        },
        {
          "id": 8,
          "index": 7,
          "title": "Child Three B",
          "url_slug": "/parent-three/child-b",
          "parent": 6
        }
      ]
    },
    "Pagination": {
      "themeKey": "table",
      "totalLength": 100,
      "pageSize": 10,
      "usePagination": true,
      "currentPage": 0
    },
    "NavigableMenu": []
  }
}

export default availTheme
