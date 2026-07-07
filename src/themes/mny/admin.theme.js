import { Icons } from "./icons";
import mny from "./theme";

const theme = {
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
  "compatibility": "border-[#191919] pt-[41px]",
  "layout": {
    "options": {
      "activeStyle": 0,
      "sideNav": {
        "size": "compact",
        "nav": "main",
        "activeStyle": "",
        "topMenu": [
          {
            "type": "Logo"
          },
          {
            "type": "SearchButton"
          }
        ],
        "bottomMenu": [
          {
            "type": "UserMenu"
          }
        ],
        "navDepth": "1",
        "navTitle": "flex-1 text-[24px] font-['Oswald'] font-[500] leading-[24px] text-[#2D3E4C] py-3 px-4 uppercase"
      },
      "topNav": {
        "size": "none",
        "nav": "none",
        "activeStyle": null,
        "leftMenu": [
          {
            "type": "Logo"
          }
        ],
        "rightMenu": [
          {
            "type": "SearchButton"
          },
          {
            "type": "UserMenu"
          }
        ]
      },
    },
    "styles": [
      {
        "outerWrapper": "bg-[linear-gradient(0deg,rgba(244,244,244,0.96),rgba(244,244,244,0.96)),url('/themes/mny/topolines.png')]  bg-[size:500px] min-h-screen",
        "wrapper": "",
        "wrapper2": "flex-1 flex items-start flex-col items-stretch max-w-full",
        "wrapper3": "flex flex-1 md:px-2 ",
        "childWrapper": "h-full flex-1 pb-[10px] pt-[2px]"
      }
    ]
  },
  "layoutGroup": {
    "options": {
      "activeStyle": "6"
    },
    "styles": [
      {
        "name": "default",
        "wrapper1": "w-full h-full flex-1 flex flex-row pt-2  mx-auto",
        "wrapper2": "flex flex-1 w-full  flex-col  shadow-md bg-white rounded-lg relative text-md font-light px-4  h-full",
        "wrapepr3": "",
        "iconWrapper": "",
        "icon": "",
      },
      {
        "name": "flush",
        "wrapper1": "w-full h-full flex-1 flex flex-row pt-2  mx-auto",
        "wrapper2": "flex flex-1 w-full  flex-col  shadow-md bg-white rounded-lg relative text-md font-light h-full",
        "wrapepr3": "",
      },
      {
        "name": "content",
        "wrapper1": "w-full h-full flex-1 flex flex-row lg:py-[10px] md:px-0  mx-auto",
        "wrapper2": "flex flex-1 w-full  flex-col  shadow-md bg-white rounded-lg relative text-md font-light leading-7 p-4 h-full min-h-[calc(100vh_-_102px)]",
        "wrapepr3": ""
      },

      {
        "name": "lightCentered",
        "wrapper1": "w-full h-full flex-1 flex flex-row pb-[4px] ",
        "wrapper2": "max-w-[1440px]  xl:px-[64px] md:px-4 mx-auto",
        "wrapper3": "flex flex-1 w-full  shadow-md bg-white rounded-lg  flex-col  relative text-md font-light leading-7 p-4 h-full min-h-[200px]"
      },
      {
        "name": "clearCentered",
        "wrapper1": "w-full h-full flex-1 flex flex-row -mt-3",
        "wrapper2": "max-w-[1440px] w-full xl:px-[48px] mx-auto",
        "wrapper3": "flex flex-1 w-full flex-col relative h-full min-h-[200px]"
      },
      {
        "name": "full_width",
        "wrapper1": "w-full h-full flex-1 flex flex-row pt-2 ",
        "wrapper2": "flex flex-1 w-full  flex-col  shadow-md bg-white rounded-lg relative text-md font-light leading-7 p-4 h-full min-h-[200px]",
        "wrapepr3": "",
        "iconWrapper": "",
        "icon": "",
        "sideNavContainer1": "",
        "sideNavContainer2": ""
      }
    ]
  },
  "sidenav": {
    "options": {
      "activeStyle": "0",
      "maxDepth": "3"
    },
    "styles": [
      {
        "name": "default",
        "layoutContainer1": "pr-2 pt-[10px] hidden lg:block min-w-[302px] max-w-[302px] print:hidden ",
        "layoutContainer2": "hidden scrollbar-sm lg:block sticky top-[10px] h-[calc(100vh_-_20px)] bg-white rounded-lg shadow-md w-full overflow-x-hidden",
        "logoWrapper": "bg-neutral-100 text-slate-800",
        "sidenavWrapper": "hidden md:flex bg-white w-full h-full z-20  flex-col pr-5",
        "menuItemWrapper": " flex-1 flex flex-col flex flex-col,flex flex-col",
        "menuItemWrapper_level_1": "pl-2",
        "menuItemWrapper_level_2": "",
        "menuItemWrapper_level_3": "",
        "menuItemWrapper_level_4": "",
        "navitemSide": "md:flex-1 group flex flex-col border-white focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300        transition-all cursor-pointer",
        "navitemSideActive": "        md:flex-1 group  flex flex-col        focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300        transition-all cursor-pointer border-l-2 border-slate-600       ",
        "forcedIcon_level_1": "CircleFilled",
        "menuIconSide": "mx-3 size-7 text-[#37576B]",
        "menuIconSideActive": "mx-3 size-7 text-[#37576B]",
        "menuIconSide_level_2": "hidden",
        "itemsWrapper": "border-slate-200 py-6 flex-1",
        "navItemContent": "transition-transform duration-300 ease-in-out flex-1 w-full",
        "navItemContent_level_1": " text-[16px] font-['Oswald'] font-[500] leading-[16px]  text-[#2D3E4C] py-3 uppercase",
        "navItemContent_level_2": "text-[16px] font-['Proxima_Nova'] font-[600] leading-[19.2px] text-[#37576B] pl-4 py-3",
        "navItemContent_level_3": "text-[14px] font-['Proxima_Nova'] font-[400] leading-[19.6px] text-[#37576B] pl-4 py-2",
        "navItemContent_level_4": "text-[14px] font-['Proxima_Nova'] font-[400] leading-[19.6px] text-[#37576B] pl-4 py-2",
        "indicatorIcon": "ArrowRight",
        "indicatorIconOpen": "ArrowDown",
        "subMenuWrapper_1": "ml-3 w-full bg-[#F3F8F9] rounded-[12px] py-[12px]",
        "subMenuWrapper_2": "w-full bg-[#E0EBF0]",
        "subMenuWrapper_3": "",
        "subMenuOuterWrapper": "",
        "subMenuParentWrapper": "flex w-full",
        "bottomMenuWrapper": "",
        "topnavWrapper": "w-full h-[50px] flex items-center pr-1",
        "topnavContent": "flex items-center w-full h-full bg-white lg:bg-zinc-100 dark:bg-zinc-900 dark:lg:bg-zinc-950 justify-between",
        "topnavMenu": "hidden  lg:flex items-center flex-1  h-full overflow-x-auto overflow-y-hidden scrollbar-sm",
        "topmenuRightNavContainer": "hidden md:flex h-full items-center",
        "topnavMobileContainer": "bg-slate-50",
        "topNavWrapper": "flex flex-row md:flex-col p-2",
        "indicatorIconWrapper": "text-[#37576B] size-4",
        "subMenuWrapperChild": "flex flex-col",
        "subMenuWrapperTop": ""
      },
      {
        "name": "mny-compact",
        "subMenuActivate": "onHover",
        "layoutContainer1": "px-2 hidden lg:block min-w-[76px] print:hidden",
        "layoutContainer2": "hidden lg:block fixed top-[10px] left-[10px] h-[calc(100vh_-_20px)] w-[64px] z-30",
        "sidenavWrapper": "flex flex-col bg-white rounded-lg shadow-md w-full h-full z-20 overflow-visible",
        "logoWrapper": "bg-neutral-100 text-slate-800",
        "menuItemWrapper": "flex flex-col",
        "menuItemWrapper_level_1": "",
        "menuItemWrapper_level_2": "flex flex-col w-full",
        "menuItemWrapper_level_3": "flex flex-col w-full",
        "menuIconSide": "hidden",
        "menuIconSideActive": "hidden",
        "menuIconSide_level_1": "size-8 text-[#37576B]",
        "menuIconSideActive_level_1": "size-8 text-[#37576B]",
        "forcedIcon": "",
        "forcedIcon_level_1": "CircleFilled",
        "forcedIcon_level_2": "",
        "forcedIcon_level_3": "",
        "itemsWrapper": "border-slate-200 py-6 flex-1 overflow-visible",
        "navItemContent": "",
        "navItemContent_level_1": "absolute inset-0 text-transparent",
        "navItemContent_level_2": "pl-4 block text-[14px] font-['Proxima_Nova'] font-[600] leading-[19.2px] text-[#37576B]",
        "navItemContent_level_3": "pl-4 block text-[14px] font-['Proxima_Nova'] font-[400] leading-[19.6px] text-[#37576B]",
        "navitemSide": "relative w-full group flex items-center justify-center py-3 focus:outline-none transition-all cursor-pointer hover:bg-[#F3F8F9]",
        "navitemSideActive": "relative w-full group flex items-center justify-center py-3 focus:outline-none transition-all cursor-pointer border-l-2 border-slate-600 bg-[#F3F8F9]",
        "navitemSide_level_2": "relative w-full group flex flex-row items-center px-4 py-2 focus:outline-none transition-all cursor-pointer hover:bg-[#E0EBF0]",
        "navitemSideActive_level_2": "relative w-full group flex flex-row items-center px-4 py-2 focus:outline-none transition-all cursor-pointer bg-[#E0EBF0]",
        "navitemSide_level_3": "relative w-full group flex flex-row items-center px-4 py-2 focus:outline-none transition-all cursor-pointer hover:bg-[#E0EBF0]",
        "navitemSideActive_level_3": "w-full group flex flex-row items-center px-4 py-1.5 focus:outline-none transition-all cursor-pointer bg-[#F3F8F9]",
        "indicatorIcon": "ArrowRight",
        "indicatorIconOpen": "ArrowDown",
        "indicatorIconWrapper": "hidden",
        // "indicatorIconWrapper_level_1": "hidden",
        // "indicatorIconWrapper_level_2": "text-[#37576B] size-4 ml-auto",
        // "indicatorIconWrapper_level_3": "text-[#37576B] size-4 ml-auto",
        "subMenuWrapper_1": "min-w-[220px]  bg-white border border-[#E0EBF0] shadow-xl flex flex-col rounded-r-lg",
        "subMenuWrapper_2": "min-w-[200px] bg-white border border-[#E0EBF0] shadow-lg rounded-r-lg",
        "subMenuWrapper_3": "min-w-[180px] bg-[#F3F8F9] border border-[#C5D7E0] shadow-md rounded-r-lg",
        "subMenuTitle": "text-[14px] uppercase tracking-wider text-[#2D3E4C] font-['Oswald'] font-[500] py-3 px-4 w-full bg-[#F3F8F9] border-b border-[#E0EBF0]",
        "subMenuParentWrapper": "flex flex-col w-full",
        "subMenuOuterWrapper": "absolute left-full top-0",
        "subMenuWrapperChild": "flex flex-col",
        "subMenuWrapperTop": "",
        "bottomMenuWrapper": "flex flex-col",
        "topnavWrapper": "w-full h-[50px] flex items-center pr-1",
        "topnavContent": "flex items-center w-full h-full bg-white lg:bg-zinc-100 justify-between",
        "topnavMenu": "hidden lg:flex items-center flex-1 h-full overflow-x-auto overflow-y-hidden scrollbar-sm",
        "topmenuRightNavContainer": "hidden md:flex h-full items-center",
        "topnavMobileContainer": "bg-slate-50",
        "topNavWrapper": "flex flex-row md:flex-col p-2"
      },
      {
        "layoutContainer1": "pr-2  hidden lg:block min-w-[64px] max-w-[84px]  print:hidden",
        "layoutContainer2": "hidden scrollbar-sm lg:block sticky top-[9px] h-[calc(100vh_-_20px)] bg-white rounded-lg shadow-md w-full overflow-y-auto overflow-x-hidden",
        "logoWrapper": "bg-neutral-100 text-slate-800",
        "sidenavWrapper": "hidden md:flex flex-col bg-white w-full h-full z-20",
        "menuItemWrapper": "flex flex-col",
        "menuIconSide": "size-11 mx-4 text-[#37576B] hover:text-slate-500 ",
        "menuIconSideActive": "size-10 mx-3 text-[#37576B] ",
        "itemsWrapper": "border-slate-200 py-6 flex-1",
        "navItemContent": "hidden",
        "navItemContents": "hidden",
        "navitemSide": "md:flex-1 group flex flex-col border-white focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300        transition-all cursor-pointer",
        "navitemSideActive": "        md:flex-1 group  flex flex-col        focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300        transition-all cursor-pointer border-l-2 border-slate-600       ",
        "indicatorIcon": "ArrowRight",
        "indicatorIconOpen": "ArrowDown",
        "subMenuWrapper": "pl-2 w-full",
        "subMenuParentWrapper": "flex w-full",
        "bottomMenuWrapper": "",
        "topnavWrapper": "w-full h-[50px] flex items-center pr-1",
        "topnavContent": "flex items-center w-full h-full bg-white lg:bg-zinc-100 dark:bg-zinc-900 dark:lg:bg-zinc-950 justify-between",
        "topnavMenu": "hidden  lg:flex items-center flex-1  h-full overflow-x-auto overflow-y-hidden scrollbar-sm",
        "topmenuRightNavContainer": "hidden md:flex h-full items-center",
        "topnavMobileContainer": "bg-slate-50",
        "topNavWrapper": "flex flex-row md:flex-col p-2",
        "indicatorIconWrapper": "text-[#37576B] size-4",
        "subMenuWrappers": [
          "w-full bg-[#F3F8F9] rounded-[12px] py-[12px]",
          "w-full bg-[#E0EBF0]"
        ],
        "subMenuOuterWrappers": [
          "pl-4"
        ],
        "subMenuWrapperChild": "flex flex-col",
        "subMenuWrapperTop": "",
        "name": "small"
      }
    ]
  },
  "topnav": {
    "options": {
      "activeStyle": "0"
    },
    "styles": [
      {
        "layoutContainer1": "print:hidden",
        "layoutContainer2": "z-20 max-w-[1440px] left-50% -translate-50% w-full md:px-4  xl:px-[64px] pointer-events-none",
        "topnavWrapper": "px-[24px] py-[16px] w-full bg-white h-20 flex items-center md:rounded-lg shadow pointer-events-auto relative",
        "topnavContent": "flex items-center w-full h-full  max-w-[1400px] mx-auto ",
        "leftMenuContainer": "",
        "centerMenuContainer": "hidden  lg:flex items-center flex-1  h-full overflow-x-auto overflow-y-hidden scrollbar-sm",
        "rightMenuContainer": "hidden min-w-[120px] md:flex h-full items-center",
        "mobileNavContainer": "",
        "mobileButton": "md:hidden inline-flex items-center justify-center border rounded-full border-[#E0EBF0] size-8",
        "menuOpenIcon": "BarsMenu",
        "menuCloseIcon": "XMark",
        "navitemWrapper": "",
        "navitem": "\n        w-fit group font-display whitespace-nowrapmenuItemWrapper\n        flex tracking-widest items-center font-[Oswald] font-medium text-slate-700 text-[11px] px-2 h-12\n        focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300\n        transition cursor-pointer\n    ",
        "navitemActive": " w-fit group font-display whitespace-nowrap\n        flex tracking-widest items-center font-[Oswald] font-medium text-slate-700 text-[11px] px-2 h-12 text-blue\n        focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300\n        transition cursor-pointer\n      ",
        "navIcon": "",
        "navIconActive": "",
        "navitemContent": "flex-1 flex items-center gap-[2px]",
        "navitemName": "",
        "navitemName_level_2": "uppercase font-[Oswald] text-[14px] flex items-center p-1",
        "navitemDescription": "hidden",
        "navitemDescription_level_2": "text-[16px] font-['Proxima_Nova'] font-[400] text-[#37576B] text-wrap",
        "indicatorIconWrapper": "size-3",
        "indicatorIcon": "ArrowDown",
        "indicatorIconOpen": "ArrowDown",
        "subMenuWrapper": "absolute left-0 right-0 normal-case z-10 px-4 -mx-[15px] pt-[34px] cursor-default",
        "subMenuWrapper2": "bg-white flex items-stretch rounded-lg p-4 shadow",
        "subMenuParentWrapper": "hidden",
        "subMenuWrapperChild": "divide-x overflow-x-auto max-w-[1400px] mx-auto",
        "subMenuWrapperTop": "hidden",
        "subMenuWrapperInactiveFlyout": "absolute left-0 right-0  mt-8 normal-case bg-white shadow-lg z-10 p-2",
        "subMenuWrapperInactiveFlyoutBelow": " absolute ml-40 normal-case bg-white shadow-lg z-10 p-2",
        "subMenuWrapperInactiveFlyoutDirection": "grid grid-cols-4",
        "topnavMenu": "hidden md:flex items-center flex-1 h-full overflow-x-auto overflow-y-hidden scrollbar-sm",
        "topmenuRightNavContainer": "hidden md:flex h-full items-center justify-end  min-w-[110px]",
        "topnavMobileContainer": "bg-white pointer-events-auto h-[calc(100vh_-_80px)] overflow-y-auto",
        "menuItemWrapper": "",
        "navitemTop": "  md:w-fit group  whitespace-nowrap\n          text-[16px] font-['Proxima_Nova'] font-[500] text-[#37576B]\n          px-2\n          focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300\n          transition cursor-pointer\n      ",
        "navitemTopActive": "w-fit group  whitespace-nowrap\n        text-[16px] font-['Proxima_Nova'] font-[500] text-[#37576B]\n        px-2 text-blue\n        focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300\n        transition cursor-pointer\n      ",
        "navItemContent_level_1": "",
        "navItemContent_level_2": "uppercase font-[Oswald] text-[14px] flex items-center p-1",
        "navItemDescription_level_1": "hidden",
        "navItemDescription_level_2": "text-[16px] font-['Proxima_Nova'] font-[400] text-[#37576B] text-wrap",
        "mobileMenuButtonWrapper": "",
        "menuItemWrapper_level_2": "bg-[#F3F8F9] p-4 rounded-lg",
        "menuIcon": "text-[#37576B]  size-6",
        "menuIconActive": "text-[#37576B] items-center text-lg",
        "subMenuParentContent": "basis-1/3  text-wrap pr-[64px]",
        "subMenuParentName": "text-[36px] font-['Oswald'] font-500 text-[#2D3E4C] uppercase pb-2",
        "subMenuParentDesc": "text-[16px] font-['Proxima_Nova'] font-[400] text-[#37576B]",
        "subMenuParentLink": "w-fit h-fit cursor-pointer uppercase border boder-[#E0EBF0] bg-white hover:bg-[#E0EBF0] text-[#37576B] font-[700] leading-[14.62px] rounded-full text-[12px] text-center py-[16px] px-[24px]",
        "subMenuItemsWrapperParent": "grid grid-cols-2 gap-1 flex-1",
        "subMenuItemsWrapper": "grid grid-cols-4 flex-1"
      }
    ]
  },
  "logo": {
    "options": {
      "activeStyle": "0"
    },
    "styles": [
      {
      "logoWrapper": "@container  flex p-1  items-center  gap-0 ",
      "logoAltImg": "hidden",
      "imgWrapper": "flex-shrink-0  @[120px]:ml-3 @[120px]:my-3 ",
      "img": "/themes/mny/nys_logo_blue.svg",
      "imgClass": "h-10 @[120px]:h-16 w-auto",
      "titleWrapper": "pl-2 hidden @[120px]:flex @[120px]:border-l border-[#37576b] h-10 flex items-center font-['Oswald'] text-[#37576b] font-semibold text-xl tracking-wide",
      "title": "MitigateNY",
      "linkPath": "/"
      },
      {
        "logoWrapper": "flex",
      "logoAltImg": "",
      "imgWrapper": "size-12 pl-3 pr-2 flex items-center",
      "img": "/themes/mny/nys_logo_blue.svg",
      "imgClass": "min-h-12",
      "titleWrapper": "",
      "title": "MitigateNY",
      "linkPath": "/"
    },

    ]
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
  "field": {
    "field": "",
    "label": "select-none text-base/6 text-slate-600 data-[disabled]:opacity-50 sm:text-sm/6 dark:text-white",
    "description": "text-base/6 text-zinc-500 data-[disabled]:opacity-50 sm:text-sm/6 dark:text-zinc-400"
  },
  "dialog": {
    "backdrop": "fixed inset-0 flex w-screen justify-center overflow-y-auto bg-zinc-950/25 px-2 py-2 transition duration-100 focus:outline-0 data-[closed]:opacity-0 data-[enter]:ease-out data-[leave]:ease-in sm:px-6 sm:py-8 lg:px-8 lg:py-16 dark:bg-zinc-950/50",
    "dialogContainer": "fixed inset-0 w-screen overflow-y-auto pt-6 sm:pt-0",
    "dialogContainer2": "grid min-h-full grid-rows-[1fr_auto] justify-items-center sm:grid-rows-[1fr_auto_3fr] sm:p-4",
    "dialogPanel": "row-start-2 w-full min-w-0 rounded-t-3xl bg-white p-[--gutter] shadow-lg ring-1 ring-zinc-950/10 [--gutter:theme(spacing.8)] sm:mb-auto sm:rounded-2xl dark:bg-zinc-900 dark:ring-white/10 forced-colors:outline\n    transition duration-100 data-[closed]:translate-y-12 data-[closed]:opacity-0 data-[enter]:ease-out data-[leave]:ease-in sm:data-[closed]:translate-y-0 sm:data-[closed]:data-[enter]:scale-95 z-10 p-2",
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
  pages: {
    ...mny.pages,
    "userMenu": {
      "options": {
        "activeStyle": 0
      },
      "styles": [
        {
          "name": "mny-responsive",
          "userMenuContainer": "@container flex flex-col @[120px]:flex-row w-full items-center justify-center @[120px]:justify-start rounded-lg bg-white @[120px]:bg-[#F3F8F9] @[120px]:mx-2 @[120px]:mb-2 p-2 @[120px]:p-2",
          "avatarWrapper": "flex justify-center items-center",
          "avatar": "size-10 border-2 border-[#C5D7E0] rounded-full place-items-center content-center bg-[#E0EBF0] hover:bg-[#C5D7E0] cursor-pointer",
          "avatarIcon": "size-5 @[120px]:size-6 fill-[#37576B]",
          "infoWrapper": "hidden @[120px]:flex flex-col flex-1 px-2",
          "emailText": "text-xs font-normal text-[#37576B] tracking-tight text-left truncate font-['Proxima_Nova']",
          "groupText": "text-sm font-medium text-[#2D3E4C] font-['Proxima_Nova'] tracking-wide text-left uppercase",
          "editControlWrapper": "flex justify-center items-center",
          "iconWrapper": "size-8 flex items-center justify-center rounded-md hover:bg-[#E0EBF0] cursor-pointer",
          "icon": "text-[#37576B] hover:text-[#2D3E4C] size-5",
          "viewIcon": "View",
          "editIcon": "Edit",
          "loginWrapper": "flex items-center justify-center p-2 @[120px]:py-2 @[120px]:px-3 bg-[#C5D7E0] hover:bg-[#E0EBF0] rounded-full @[120px]:rounded-md cursor-pointer",
          "loginLink": "flex items-center justify-center @[120px]:gap-2 text-[#37576B] text-sm font-bold font-['Proxima_Nova']",
          "loginIconWrapper": "size-5 place-items-center content-center",
          "loginIcon": "size-4 fill-[#37576B]",
          "loginText": "hidden @[120px]:inline uppercase",
          "authContainer": "@container w-full",
          "authWrapper": "flex flex-col-reverse @[120px]:flex-row p-1 @[120px]:p-2 items-center gap-2",
          "userMenuWrapper": "flex flex-col @[120px]:flex-row items-center @[120px]:flex-1 w-full"
        }
      ]
    },
  },
};

export default {
  ...mny,
  ...theme,
  Icons,
};
