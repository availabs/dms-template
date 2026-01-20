import { Icons } from "./icons";

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
  "pages": {
    "sectionGroup": {
      "sideNavContainer1": "w-[302px] hidden xl:block",
      "sideNavContainer2": "w-[302px] sticky top-[120px] hidden xl:block h-[calc(100vh_-_128px)] pr-2",
      "sideNavContainer3": "shadow-md rounded-lg overflow-hidden h-full"
    },
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
  "compatibility": "border-[#191919] pt-[41px]",
  "heading": {
    "1": "font-[500]  text-[#2D3E4C] text-[36px] leading-[140%] tracking-[-.02em] font-[500] underline-offset-8 underline decoration-4 decoration-[#EAAD43] uppercase font-['Oswald'] pb-[12px]",
    "2": "font-[500]  text-[#2D3E4C] text-[24px] leading-[24px] scroll-mt-36 font-['Oswald'] pb-[12x]",
    "3": "font-[500]  text-[#2D3E4C] text-[16px] leading-[16px] scroll-mt-36 font-['Oswald'] pb-[12x]",
    "4": "text-[36px] sm:text-[48px] tracking-[-2px] items-center font-medium font-['Oswald'] text-[#2D3E4C] sm:leading-[100%] uppercase",
    "base": "p-2 w-full font-sans font-medium text-md bg-transparent",
    "default": ""
  },
  "sectionArray": {
    "container": "w-full grid grid-cols-6 md:grid-cols-12 ",
    "gridSize": 12,
    "layouts": {
      "centered": "max-w-[1020px] mx-auto  px-0 lg:px-[56px]",
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
        "className": "col-span-6 md:col-span-9",
        "iconSize": 75
      },
      "2": {
        "className": "col-span-6 md:col-span-12",
        "iconSize": 100
      },
      "1/3": {
        "className": "col-span-6 md:col-span-4",
        "iconSize": 33
      },
      "1/2": {
        "className": "col-span-6 md:col-span-6",
        "iconSize": 50
      },
      "2/3": {
        "className": "col-span-6 md:col-span-8",
        "iconSize": 66
      },
      "1/4": {
        "className": "col-span-6 md:col-span-3",
        "iconSize": 25
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
            "type": "Search"
          },
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
        "outerWrapper": "bg-[linear-gradient(0deg,rgba(244,244,244,0.96),rgba(244,244,244,0.96)),url('/themes/mny/topolines.png')]  bg-[size:500px] min-h-screen",
        "wrapper": "",
        "wrapper2": "flex-1 flex items-start flex-col items-stretch max-w-full",
        "wrapper3": "flex flex-1 md:px-2 ",
        "childWrapper": "h-full flex-1"
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
        "wrapper1": "w-full h-full flex-1 flex flex-row pt-2 max-w-[990px] mx-auto",
        "wrapper2": "flex flex-1 w-full  flex-col  shadow-md bg-white rounded-lg relative text-md font-light leading-7 p-4 h-full min-h-[200px]",
        "wrapepr3": "",
        "iconWrapper": "",
        "icon": "text-slate-400 hover:text-blue-500",
        "sideNavContainer1": "hidden xl:block",
        "sideNavContainer2": "min-w-[302px] max-w-[302px] sticky top-20 hidden xl:block h-[100vh_-_102px] pr-2"
      },
      {
        "name": "content",
        "wrapper1": "w-full h-full flex-1 flex flex-row lg:py-[10px] md:px-0 max-w-[990px] mx-auto",
        "wrapper2": "flex flex-1 w-full  flex-col  shadow-md bg-white rounded-lg relative text-md font-light leading-7 p-4 h-full min-h-[calc(100vh_-_102px)]",
        "wrapepr3": ""
      },
      {
        "name": "darkSection",
        "wrapper1": "w-full h-full flex-1 flex flex-row -my-8 py-10 bg-[linear-gradient(0deg,rgba(33,52,64,.96),rgba(55,87,107,.96)),url('/themes/mny/topolines.png')]  bg-[size:500px] pb-[4px]",
        "wrapper2": "max-w-[1440px]  xl:px-[64px] md:px-4 mx-auto",
        "wrapper3": "flex flex-1 w-full  flex-col  relative text-md font-light leading-7 p-4 h-full min-h-[200px]"
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
        "name": "header",
        "wrapper1": "w-full h-full flex-1 flex flex-row",
        "wrapper2": "flex flex-1 w-full  flex-col  relative min-h-[200px]",
        "wrapper3": ""
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
      "activeStyle": "0",
      "maxDepth": "3"
    },
    "styles": [
      {
        "name": "default",
        "layoutContainer1": "pr-2 pt-[10px] hidden lg:block min-w-[302px] max-w-[302px] print:hidden ",
        "layoutContainer2": "hidden scrollbar-sm lg:block sticky top-[10px] h-[calc(100vh_-_20px)] bg-white rounded-lg shadow-md w-full overflow-y-auto overflow-x-hidden p-4",
        "logoWrapper": "bg-neutral-100 text-slate-800",
        "sidenavWrapper": "hidden md:flex bg-white w-full h-full z-20  flex-col pr-5",
        "menuItemWrapper": " flex-1 flex flex-col flex flex-col,flex flex-col",
        "menuItemWrapper_level_1": "pl-2",
        "menuItemWrapper_level_2": "",
        "menuItemWrapper_level_3": "",
        "menuItemWrapper_level_4": "",
        "navitemSide": "md:flex-1 group flex flex-col border-white focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300        transition-all cursor-pointer",
        "navitemSideActive": "        md:flex-1 group  flex flex-col        focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300        transition-all cursor-pointer border-l-2 border-slate-600       ",
        "menuIconSide": "hidden size-8 text-[#37576B]",
        "menuIconSideActive": "hidden size-8 text-[#37576B]",
        "itemsWrapper": "border-slate-200 py-6 flex-1",
        "navItemContent": "transition-transform duration-300 ease-in-out flex-1 w-full",
        "navItemContent_level_1": "pl-1 text-[16px] font-['Oswald'] font-[500] leading-[16px]  text-[#2D3E4C] py-3 uppercase",
        "navItemContent_level_2": "text-[16px] font-['Proxima_Nova'] font-[600] leading-[19.2px] text-[#37576B] pl-4 py-3",
        "navItemContent_level_3": "text-[14px] font-['Proxima_Nova'] font-[400] leading-[19.6px] text-[#37576B] pl-4 py-2",
        "navItemContent_level_4": "text-[14px] font-['Proxima_Nova'] font-[400] leading-[19.6px] text-[#37576B] pl-4 py-2",
        "indicatorIcon": "ArrowRight",
        "indicatorIconOpen": "ArrowDown",
        "subMenuWrapper_1": "w-full bg-[#F3F8F9] rounded-[12px] py-[12px]",
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
        "navitemTop": "\n          md:w-fit group  whitespace-nowrap\n          text-[16px] font-['Proxima_Nova'] font-[500] text-[#37576B]\n          px-2\n          focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300\n          transition cursor-pointer\n      ",
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
      "logoWrapper": "@container h-16 flex px-1  items-center @[120px]:justify-start gap-0 @[120px]:gap-2",
      "logoAltImg": "hidden",
      "imgWrapper": "flex-shrink-0 @[120px]:border-r ",
      "img": "/themes/mny/nys_logo_blue.svg",
      "imgClass": "h-10 @[120px]:h-16 w-auto",
      "titleWrapper": "pl-2 hidden @[120px]:block font-['Oswald'] text-[#37576b] font-semibold text-xl tracking-wide",
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
    "icon": "text-slate-400 hover:text-blue-500 size-4"
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
    "labelWrapper": "w-full px-[12px] pt-[9px] pb-[7px] bg-[#C5D7E0] hover:bg-[#E0EBF0] group rounded-[1000px]",
    "label": "text-[12px] text-[#37576B] font-bold leading-[14.62px]",
    "labelWrapperDisabled": "px-[12px] pt-[9px] pb-[7px] bg-[#F3F8F9] group rounded-[1000px]",
    "labelDisabled": "text-[12px] text-[#C5D7E0] font-bold leading-[14.62px]"
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
    "tableContainer": "relative flex flex-col w-full h-full overflow-x-auto scrollbar-sm border rounded-t-[12px]",
    "tableContainerNoPagination": "rounded-b-[12px]",
    "tableContainer1": "flex flex-col no-wrap min-h-[200px] max-h-[calc(78vh_-_10px)] overflow-y-auto scrollbar-sm",
    "headerContainer": "sticky top-0 grid ",
    "thead": "flex justify-between",
    "theadfrozen": "",
    "thContainer": "w-full font-[500] py-4 pl-4 pr-0 font-[Oswald] text-[12px] uppercase text-[#2d3e4c] border-x",
    "thContainerBgSelected": "bg-gray-50 text-gray-900",
    "thContainerBg": "bg-[#F3F8F9] text-gray-900",
    "cell": "relative flex items-center min-h-[36px]  border border-slate-50",
    "cellInner": "\n          w-full min-h-full flex flex-wrap items-center truncate py-1 px-2\n          font-['Proxima_Nova'] font-[400] text-[14px] text-[#37576B] leading-[20px]\n      ",
    "cellBg": "bg-white",
    "cellBgSelected": "bg-blue-50",
    "cellFrozenCol": "",
    "paginationInfoContainer": "",
    "paginationPagesInfo": "font-[500] font-[Oswald] text-[12px] uppercase text-[#2d3e4c] leading-[18px]",
    "paginationRowsInfo": "text-xs font-[Proxima Nova] leading-[14px]",
    "paginationContainer": "w-full p-2 rounded-b-[12px] bg-[#F3F8F9] flex items-center justify-between",
    "paginationControlsContainer": "flex flex-row items-center border rounded-[8px] overflow-hidden",
    "pageRangeItem": "cursor-pointer px-[12px]  py-[7px] font-[Oswald] font-[500] text-[12px] border-r last:border-none uppercase leading-[18px]",
    "pageRangeItemInactive": "bg-white text-[#2D3E4C]",
    "pageRangeItemActive": "bg-[#2D3E4C] text-white",
    "openOutContainer": "w-[420px] overflow-auto scrollbar-sm flex flex-col gap-[12px] p-[16px] bg-white h-full float-right",
    "openOutContainerWrapper": "absolute inset-0 right-0 h-full w-full z-[100]",
    "openOutHeader": "font-semibold font-[Proxima Nova] text-[#37576B] text-[14px] leading-[17.05px]",
    "openOutValue": "font-normal font-[Proxima Nova] text-[#37576B] text-[14px] leading-[19.6px]",
    "openOutTitle": "font-medium font-[Oswald] text-[24px] leading-[100%] uppercase text-[#2D3E4C]"
  },
  "lexical": {
    "contentEditable": "border-none relative [tab-size:1] outline-0",
    "editorScroller": "min-h-[150px] border-0 flex relative outline-0 z-0 resize-y",
    "viewScroller": "border-0 flex relative outline-0 z-0 resize-none",
    "editorContainer": "relative block rounded-[10px] min-h-[50px]",
    "editorShell": "font-['Proxima_Nova'] font-[400] text-[16px] text-[#37576B] leading-[22.4px]",
    "card": "p-[12px] shadow-[0px_0px_6px_0px_rgba(0,0,0,0.02),0px_2px_4px_0px_rgba(0,0,0,0.08)]",
    "heading": {
      "h1": "font-[500]  text-[#2D3E4C] text-[36px] leading-[140%] tracking-[-.02em] font-[500] underline-offset-8 underline decoration-4 decoration-[#EAAD43] uppercase font-['Oswald'] pb-[12px]",
      "h2": "font-[500]  text-[#2D3E4C] text-[24px] leading-[24px] scroll-mt-36 font-['Oswald'] pb-[12x]",
      "h3": "font-[500]  text-[#2D3E4C] text-[16px] leading-[16px] scroll-mt-36 font-['Oswald'] pb-[12x]",
      "h4": "font-medium text-[#2D3E4C] scroll-mt-36 font-display",
      "h5": "text-[36px] sm:text-[48px] tracking-[-2px] items-center font-medium font-['Oswald'] text-[#2D3E4C] sm:leading-[100%] uppercase",
      "h6": "scroll-mt-36 font-display"
    },
    "paragraph": "m-0 relative",
    "quote": "m-0 mb-2 py-6 font-['Oswald'] text-[30px] leading-[36px] text-[#2D3E4C] border-l-4 border-[#37576B] pl-4",
    "link": "text-[#37576B] font-[500] no-underline inline-block hover:underline hover:cursor-pointer",
    "text": {
      "bold": "font-[700]",
      "code": "bg-gray-200 px-1 py-0.5 font-mono text-[94%]",
      "italic": "italic",
      "strikethrough": "line-through",
      "subscript": "align-sub text-[0.8em]",
      "superscript": "align-super text-[0.8em]",
      "underline": "underline",
      "underlineStrikethrough": "underline line-through"
    },
    "blockCursor": "block pointer-events-none absolute content-['']  after:absolute after:-top-[2px] after:w-[20px] after:border-t-[1px_solid_black]",
    "characterLimit": "inline !bg-[#ffbbbb]",
    "layoutContainer": "grid gap-[10px]",
    "layoutItem": "px-2 py-4 min-w-0 max-w-full",
    "layoutItemEditable": "border border-dashed border-slate-300 rounded-lg",
    "code": "bg-[rgb(240,_242,_245)] font-[Menlo,_Consolas,_Monaco,_monospace] block pl-[52px] pr-[8px] py-[8px] leading-[1.53] text-[13px] m-0 mt-[8px] mb-[8px] [tab-size:2] relative after:content-[attr(data-gutter)] after:absolute after:bg-[#eee] after:left-[0] after:top-[0] after:border-r-[1px_solid_#ccc] after:p-[8px] after:text-[#777] after:whitespace-pre-wrap after:text-right after:min-w-[25px]",
    "codeHighlight": {
      "atrule": "text-[#07a]",
      "attr": "text-[#07a]",
      "boolean": "text-[#905]",
      "builtin": "text-[#690]",
      "cdata": "text-[slategray]",
      "char": "text-[#690]",
      "class": "text-[#dd4a68]",
      "class-name": "text-[#dd4a68]",
      "comment": "text-[slategray]",
      "constant": "text-[#905]",
      "deleted": "text-[#905]",
      "doctype": "text-[slategray]",
      "entity": "text-[#9a6e3a]",
      "function": "text-[#dd4a68]",
      "important": "text-[#e90]",
      "inserted": "text-[#690]",
      "keyword": "text-[#07a]",
      "namespace": "text-[#e90]",
      "number": "text-[#905]",
      "operator": "text-[#9a6e3a]",
      "prolog": "text-[slategray]",
      "property": "text-[#905]",
      "punctuation": "text-[#999]",
      "regex": "text-[#e90]",
      "selector": "text-[#690]",
      "string": "text-[#690]",
      "symbol": "text-[#905]",
      "tag": "text-[#905]",
      "url": "text-[#9a6e3a]",
      "variable": "text-[#e90]"
    },
    "embedBlock": {
      "base": "select-none",
      "focus": "outline-[2px_solid_rgb(60,_132,_244)]"
    },
    "hashtag": "bg-[rgba(88,_144,_255,_0.15)] border-b-[1px_solid_rgba(88,_144,_255,_0.3)]",
    "image": "editor-image",
    "indent": "PlaygroundEditorTheme__indent",
    "list": {
      "listitem": "mx-[32px]",
      "listitemChecked": "PlaygroundEditorTheme__listItemChecked",
      "listitemUnchecked": "PlaygroundEditorTheme__listItemUnchecked",
      "nested": {
        "listitem": "list-none before:hidden after:hidden"
      },
      "olDepth": [
        "list-inside list-decimal m-0 p-0 ",
        "m-0 p-0 list-inside list-alpha",
        "m-0 p-0 list-inside list-lower-alpha",
        "m-0 p-0 list-inside list-upper-roman",
        "m-0 p-0 list-inside list-lower-roman"
      ],
      "ul": "m-0 p-0 list-inside list-disc"
    },
    "token": {
      "comment": "text-slate-500",
      "punctuation": "text-gray-400",
      "property": "text-[#905]",
      "selector": "text-[#690]",
      "operator": "text-[#9a6e3a]",
      "attr": "text-[#07a]",
      "variable": "text-[#e90]",
      "function": "text-[#dd4a68]"
    },
    "ltr": "text-left",
    "mark": {
      "base": "bg-[rgba(255, 212, 0, 0.14)] border-b-2 border-[rgba(255, 212, 0, 0.3)] pb-0.5",
      "selected": "bg-[rgba(255, 212, 0, 0.5)] border-b-2 border-[rgba(255, 212, 0, 1)]"
    },
    "markOverlap": {
      "base": "bg-[rgba(255,212,0,0.3)] border-b-2 border-b-[rgba(255,212,0,0.7)]",
      "selected": "bg-[rgba(255,212,0,0.7)] border-b-2 border-b-[rgba(255,212,0,0.7)]"
    },
    "rtl": "text-right",
    "table": "border-collapse border-spacing-0 max-w-full overflow-y-scroll table-fixed w-[calc(100%-25px)] my-7",
    "tableAddColumns": "relative top-0 w-[20px] bg-gray-200 h-full right-0 animate-[table-controls_0.2s_ease] border-0 cursor-pointer hover:bg-[#c9dbf0] after:content-[''] after:absolute after:top-0 after:left-0 after:w-full after:h-full after:bg-[url(/images/icons/plus.svg)] after:bg-center after:bg-no-repeat after:bg-contain after:opacity-40",
    "tableAddRows": "absolute bottom-[-25px] w-[calc(100%-25px)] bg-gray-200 h-[20px] left-0 animate-[table-controls_0.2s_ease] border-0 cursor-pointer hover:bg-[#c9dbf0] after:content-[''] after:absolute after:top-0 after:left-0 after:w-full after:h-full after:bg-[url(/images/icons/plus.svg)] after:bg-center after:bg-no-repeat after:bg-contain after:opacity-40",
    "tableCell": "border border-gray-400 min-w-[75px] align-top text-left px-2 py-[6px] relative cursor-default outline-none",
    "tableCellActionButton": "bg-gray-200 block border-0 rounded-full w-5 h-5 text-gray-900 cursor-pointer hover:bg-gray-300",
    "tableCellActionButtonContainer": "block absolute right-1 top-1.5 z-40 w-5 h-5",
    "tableCellEditing": "shadow-[0_0_5px_rgba(0,0,0,0.4)] rounded-[3px]",
    "tableCellHeader": "bg-[#f2f3f5] text-left",
    "tableCellPrimarySelected": "border-2 border-[rgb(60,132,244)] absolute h-[calc(100%-2px)] w-[calc(100%-2px)] left-[-1px] top-[-1px] z-2",
    "tableCellResizer": "absolute right-[-4px] h-full w-[8px] cursor-ew-resize z-10 top-0",
    "tableCellSelected": "bg-[#c9dbf0]",
    "tableCellSortedIndicator": "block opacity-50 absolute bottom-0 left-0 w-full h-[4px] bg-[#999]",
    "tableResizeRuler": "block absolute w-[1px] bg-[rgb(60,132,244)] h-full top-0",
    "tableSelected": "outline outline-2 outline-[rgb(60,132,244)]",
    "charLimit": "inline bg-[#ffbbbb] !important",
    "editorEditTreeView": "rounded-none",
    "editorViewContainer": "relative block rounded-[10px]",
    "editorViewTreeView": "rounded-none",
    "editorPlanText": "rounded-t-[10px]",
    "testRecorderOutput": "my-5 mx-auto w-full",
    "treeViewOutput": "block bg-gray-900 text-white p-0 text-xs my-[1px] mx-auto mb-[10px] relative overflow-hidden rounded-lg",
    "editorDevButton": {
      "base": "relative block w-10 h-10 text-xs rounded-[20px] border-none cursor-pointer outline-none shadow-[0px_1px_10px_rgba(0,0,0,0.3)] bg-gray-700 hover:bg-gray-600 after:content-[''] after:absolute after:top-[10px] after:right-[10px] after:bottom-[10px] after:left-[10px] after:block after:bg-contain after:filter invert",
      "active": "bg-red-600"
    },
    "testRecorderToolbar": "flex",
    "testRecorderButton": {
      "base": "relative block w-8 h-8 text-xs p-[6px] rounded-md border-none cursor-pointer outline-none shadow-md bg-gray-800 transition-shadow duration-75 ease-out after:content-[''] after:absolute after:top-2 after:right-2 after:bottom-2 after:left-2 after:block after:bg-contain after:filter-invert",
      "active": "shadow-lg"
    },
    "componentPickerMenu": "w-[200px]",
    "mentionsMenu": "w-[250px]",
    "autoEmbedMenu": "w-[150px]",
    "emojiMenu": "w-[200px]",
    "icon": {
      "plus": "bg-[url(/images/icons/plus.svg)]",
      "caretRight": "bg-[url(/images/icons/caret-right-fill.svg)]",
      "columns": "bg-[url(/images/icons/3-columns.svg)]",
      "dropdownMore": "bg-[url(/images/icons/dropdown-more.svg)]",
      "fontColor": "bg-[url(/images/icons/font-color.svg)]",
      "fontFamily": "bg-[url(/images/icons/font-family.svg)]",
      "bgColor": "bg-[url(/images/icons/bg-color.svg)]",
      "table": "bg-[#6c757d] bg-[url(/images/icons/table.svg)]  mask-[url(/images/icons/table.svg)] mask-no-repeat mask-size-contain",
      "paragraph": "bg-[url(/images/icons/text-paragraph.svg)]",
      "h1": "bg-[url(/images/icons/type-h1.svg)]",
      "h2": "bg-[url(/images/icons/type-h2.svg)]",
      "h3": "bg-[url(/images/icons/type-h3.svg)]",
      "h4": "bg-[url(/images/icons/type-h4.svg)]",
      "h5": "bg-[url(/images/icons/type-h5.svg)]",
      "h6": "bg-[url(/images/icons/type-h6.svg)]",
      "bulletList": "bg-[url(/images/icons/list-ul.svg)]",
      "bullet": "bg-[url(/images/icons/list-ul.svg)]",
      "checkList": "bg-[url(/images/icons/square-check.svg)]",
      "check": "bg-[url(/images/icons/square-check.svg)]",
      "numberedList": "bg-[url(/images/icons/list-ol.svg)]",
      "number": "bg-[url(/images/icons/list-ol.svg)]",
      "quote": "bg-[url(/images/icons/chat-square-quote.svg)]",
      "code": "bg-[url(/images/icons/code.svg)]",
      "strikethrough": "bg-[url(/images/icons/type-strikethrough.svg)]",
      "subscript": "bg-[url(/images/icons/type-subscript.svg)]",
      "superscript": "bg-[url(/images/icons/type-superscript.svg)]",
      "palette": "bg-[url(/images/icons/palette.svg)]",
      "bucket": "bg-[url(/images/icons/paint-bucket.svg)]",
      "bold": "bg-[url(/images/icons/type-bold.svg)]",
      "italic": "bg-[url(/images/icons/type-italic.svg)]",
      "clear": "bg-[url(/images/icons/trash.svg)]",
      "underline": "bg-[url(/images/icons/type-underline.svg)]",
      "link": "bg-[url(/images/icons/link.svg)]",
      "horizontalRule": "bg-[url(/images/icons/horizontal-rule.svg)]",
      "centerAlign": "bg-[url(/images/icons/text-center.svg)]",
      "rightAlign": "bg-[url(/images/icons/text-right.svg)]",
      "justifyAlign": "bg-[url(/images/icons/justify.svg)]",
      "indent": "bg-[url(/images/icons/indent.svg)]",
      "markdown": "bg-[url(/images/icons/markdown.svg)]",
      "outdent": "bg-[url(/images/icons/outdent.svg)]",
      "undo": "bg-[url(/images/icons/arrow-counterclockwise.svg)]",
      "redo": "bg-[url(/images/icons/arrow-clockwise.svg)]",
      "sticky": "bg-[url(/images/icons/sticky.svg)]",
      "mic": "bg-[url(/images/icons/mic.svg)]",
      "import": "bg-[url(/images/icons/upload.svg)]",
      "export": "bg-[url(/images/icons/download.svg)]",
      "diagram2": "bg-[url(/images/icons/diagram-2.svg)]",
      "user": "bg-[url(/images/icons/user.svg)]",
      "equation": "bg-[url(/images/icons/plus-slash-minus.svg)]",
      "gif": "bg-[url(/images/icons/filetype-gif.svg)]",
      "copy": "bg-[url(/images/icons/copy.svg)]",
      "success": "bg-[url(/images/icons/success.svg)]",
      "prettier": "bg-[url(/images/icons/prettier.svg)]",
      "prettierError": "bg-[url(/images/icons/prettier-error.svg)]",
      "image": "bg-[url(/images/icons/file-image.svg)]",
      "close": "bg-[url(/images/icons/close.svg)]",
      "figma": "bg-[url(/images/icons/figma.svg)]",
      "poll": "bg-[url(/images/icons/card-checklist.svg)]",
      "tweet": "bg-[url(/images/icons/tweet.svg)]",
      "youtube": "bg-[url(/images/icons/youtube.svg)]",
      "leftAlign": "bg-[url(/images/icons/text-left.svg)]"
    },
    "iconChevronDown": "bg-transparent bg-contain inline-block h-[8px] w-[8px] bg-[url(/images/icons/chevron-down.svg)]",
    "switch": {
      "base": "block text-gray-700 my-[5px] bg-gray-200 bg-opacity-70 py-[5px] px-[10px] rounded-lg",
      "richTextSwitch": "absolute right-0",
      "characterCountSwitch": "absolute right-[130px]",
      "label": "mr-1 line-height-[24px] w-[100px] text-[14px] inline-block align-middle",
      "button": "bg-[rgb(206,208,212)] h-[24px] box-border rounded-[12px] w-[44px] inline-block align-middle relative outline-none cursor-pointer transition-colors duration-[100ms] border-[2px] border-transparent focus-visible:border-blue-500",
      "buttonSpan": "absolute top-0 left-0 block w-[20px] h-[20px] rounded-[12px] bg-white transition-transform duration-[200ms]",
      "buttonChecked": "bg-[rgb(24,119,242)]",
      "buttonCheckedSpan": "translate-x-[20px]"
    },
    "linkEditor": {
      "base": "flex absolute top-0 left-0 z-10 max-w-[400px] w-full opacity-0 bg-white shadow-lg rounded-b-lg transition-opacity duration-500 will-change-transform",
      "button": {
        "active": "bg-[rgb(223,232,250)]",
        "base": "w-[20px] h-[20px] inline-block p-[6px] rounded-lg cursor-pointer mx-[2px]",
        "hovered": "w-[20px] h-[20px] inline-block bg-gray-200",
        "i": "bg-contain inline-block h-[20px] w-[20px] align-middle"
      },
      "linkInput": {
        "base": "block w-[calc(100%-75px)] box-border m-3 p-2 rounded-[15px] bg-[#eee] text-[15px] text-[rgb(5,5,5)] border-0 outline-0 relative font-inherit",
        "a": "text-[rgb(33,111,219)] underline whitespace-nowrap overflow-hidden mr-[30px] overflow-ellipsis hover:underline"
      },
      "linkView": {
        "base": "block w-[calc(100%-24px)] m-2 p-2 rounded-[15px] text-[15px] text-[rgb(5,5,5)] border-0 outline-0 relative font-inherit",
        "a": "block break-words w-[calc(100%-33px)]"
      },
      "div": {
        "linkEdit": "bg-[url(/images/icons/pencil-fill.svg)] bg-[length:16px] bg-center bg-no-repeat w-[35px] align-middle absolute right-[30px] top-0 bottom-0 cursor-pointer",
        "linkTrash": "bg-[url(/images/icons/trash.svg)] bg-[length:16px] bg-center bg-no-repeat w-[35px] align-middle absolute right-0 top-0 bottom-0 cursor-pointer",
        "linkCancel": "bg-[url(/images/icons/close.svg)] bg-[length:16px] bg-center bg-no-repeat w-[35px] align-middle absolute right-0 top-0 bottom-0 cursor-pointer mr-[28px]",
        "linkConfirm": "bg-[url(/images/icons/success-alt.svg)] bg-[length:16px] bg-center bg-no-repeat w-[35px] align-middle absolute right-0 top-0 bottom-0 cursor-pointer mr-[2px]"
      },
      "fontSizeWrapper": "flex mx-[4px]",
      "fontFamilyWrapper": "flex mx-[4px]",
      "select": "p-[6px] border-0 bg-[rgba(0,0,0,0.075)] rounded-[4px]",
      "buttonHovered": "w-5 h-5 inline-block bg-gray-200",
      "icon": "bg-contain inline-block h-5 w-5 align-middle"
    },
    "mention": {
      "focus": "shadow-[0_0_0_2px_rgb(180,213,255)] outline-none"
    },
    "blockControls": {
      "base": "absolute right-2 top-4 w-8 h-8 box-border shadow-md z-10 rounded-lg border border-gray-300 overflow-hidden",
      "button": {
        "base": "border border-white bg-white block transition-colors duration-100 ease-in cursor-pointer outline-none rounded-lg p-1 hover:bg-gray-200",
        "focusVisible": "focus-visible:border-blue-500"
      },
      "span": {
        "base": "block w-[18px] h-[18px] m-[2px] bg-contain",
        "paragraph": "bg-[url(/images/icons/text-paragraph.svg)]",
        "h1": "bg-[url(/images/icons/type-h1.svg)]",
        "h2": "bg-[url(/images/icons/type-h2.svg)]",
        "quote": "bg-[url(/images/icons/chat-square-quote.svg)]",
        "ul": "bg-[url(/images/icons/list-ul.svg)]",
        "ol": "bg-[url(/images/icons/list-ol.svg)]",
        "code": "bg-[url(/images/icons/code.svg)]"
      }
    },
    "charactersLimit": {
      "base": "text-gray-400 text-xs text-right block absolute left-3 bottom-1",
      "exceeded": "text-red-500"
    },
    "dropdown": {
      "base": "z-10 block fixed shadow-lg rounded-[8px] min-h-[40px] bg-white",
      "item": {
        "base": "m-0 mx-2 p-2 text-[#050505] cursor-pointer leading-4 text-[15px] flex items-center flex-row flex-shrink-0 justify-between bg-white rounded-lg border-0 max-w-[250px] min-w-[100px] hover:bg-gray-200",
        "fontSizeItem": "min-w-unset",
        "fontSizeText": "min-w-unset",
        "active": "flex w-5 h-5 bg-contain",
        "firstChild": "mt-2",
        "lastChild": "mb-2",
        "text": "flex leading-5 flex-grow min-w-[150px]",
        "icon": "flex w-5 h-5 select-none mr-3 leading-4 bg-contain bg-center bg-no-repeat"
      },
      "divider": "w-auto bg-gray-200 my-1 h-[1px] mx-2"
    },
    "switchbase": "block text-gray-700 my-1 bg-[rgba(238,_238,_238,_0.7)] p-1 px-[10px] rounded-lg",
    "switchlabel": "mr-1 leading-6 w-[100px] text-sm inline-block align-middle",
    "switchbutton": "bg-gray-300 h-[24px] box-border rounded-full w-[44px] inline-block align-middle relative outline-none cursor-pointer transition-colors duration-100 border-2 border-transparent",
    "switchbuttonFocus": "focus-visible:border-blue-500",
    "switchbuttonSpan": "absolute top-0 left-0 block w-[20px] h-[20px] rounded-full bg-white transition-transform duration-200",
    "switchbuttonChecked": "bg-blue-600",
    "switchbuttonCheckedSpan": "translate-x-[20px]",
    "editor": {
      "base": "flex-auto relative resize-y z-negative",
      "image": {
        "base": "inline-block relative cursor-default select-none",
        "img": {
          "base": "max-w-full cursor-default",
          "focused": "outline outline-2 outline-blue-600",
          "draggable": {
            "base": "cursor-grab",
            "active": "cursor-grabbing"
          }
        },
        "captionContainer": "block absolute bottom-1 left-0 right-0 p-0 m-0 border-t border-white bg-opacity-90 bg-white min-w-[100px] text-black overflow-hidden",
        "captionButton": "block absolute bottom-5 left-0 right-0 w-[30%] mx-auto p-2 border border-white/30 rounded bg-black bg-opacity-50 min-w-[100px] text-white cursor-pointer select-none hover:bg-blue-500",
        "resizer": {
          "base": "block w-[7px] h-[7px] absolute bg-blue-600 border border-white",
          "n": "top-[-6px] left-[48%] cursor-n-resize",
          "ne": "top-[-6px] right-[-6px] cursor-ne-resize",
          "e": "bottom-[48%] right-[-6px] cursor-e-resize",
          "se": "bottom-[-2px] right-[-6px] cursor-nwse-resize",
          "s": "bottom-[-2px] left-[48%] cursor-s-resize",
          "sw": "bottom-[-2px] left-[-6px] cursor-sw-resize",
          "w": "bottom-[48%] left-[-6px] cursor-w-resize",
          "nw": "top-[-6px] left-[-6px] cursor-nw-resize"
        }
      },
      "inlineImage": {
        "base": "inline-block relative z-10 cursor-default select-none",
        "img": {
          "base": "cursor-default",
          "focused": "outline outline-2 outline-blue-600",
          "draggable": {
            "base": "cursor-grab",
            "active": "cursor-grabbing"
          }
        },
        "captionContainer": "block bg-gray-200 min-w-full text-black overflow-hidden",
        "editButton": {
          "base": "block absolute top-3 right-3 py-[6px] px-[8px] border border-white/30 rounded-md bg-black/50 min-w-[60px] text-white cursor-pointer select-none hover:bg-blue-500",
          "hide": "hidden"
        },
        "position": {
          "full": "my-4",
          "left": "float-left w-fit mx-1 mb-0",
          "right": "float-right w-fit mb-0 mx-1"
        },
        "resizer": {
          "base": "block w-[7px] h-[7px] absolute bg-blue-600 border border-white",
          "n": "top-[-6px] left-[48%] cursor-n-resize",
          "ne": "top-[-6px] right-[-6px] cursor-ne-resize",
          "e": "bottom-[48%] right-[-6px] cursor-e-resize",
          "se": "bottom-[-2px] right-[-6px] cursor-nwse-resize",
          "s": "bottom-[-2px] left-[48%] cursor-s-resize",
          "sw": "bottom-[-2px] left-[-6px] cursor-sw-resize",
          "w": "bottom-[48%] left-[-6px] cursor-w-resize",
          "nw": "top-[-6px] left-[-6px] cursor-nw-resize"
        }
      }
    },
    "keyword": "text-[#f1765e] font-bold",
    "tableDisableCell": {
      "disableSelection": {
        "base": "",
        "selectedSpan": "bg-transparent",
        "selectedBr": "bg-transparent"
      }
    },
    "cellActionButtonContainer": "absolute top-0 left-0 will-change-transform",
    "cellActionButton": "bg-none flex justify-center items-center border-0 relative rounded-[15px] text-[#222] inline-block cursor-pointer",
    "actionButton": {
      "base": "bg-[#eee] border-0 px-3 py-2 relative ml-[5px] rounded-[15px] text-[#222] inline-block cursor-pointer hover:bg-[#ddd] hover:text-black",
      "disabled": "g-gray-200 cursor-not-allowed opacity-60"
    },
    "typeaheadPopover": {
      "base": "bg-white shadow-[0_5px_10px_rgba(0,0,0,0.3)] rounded-[8px] mt-[25px]",
      "ul": {
        "base": "p-0 list-none m-0 rounded-[8px] max-h-[200px] overflow-y-scroll scrollbar-none",
        "li": {
          "base": "m-0 min-w-[180px] text-[14px] outline-none cursor-pointer rounded-[8px] hover:bg-gray-200",
          "selected": "bg-gray-200",
          "item": "p-[8px] text-[#050505] cursor-pointer leading-[16px] text-[15px] flex items-center shrink-0 rounded-[8px] border-0",
          "active": "flex w-[20px] h-[20px] bg-contain",
          "firstChild": "rounded-t-[8px]",
          "lastChild": "rounded-b-[8px]",
          "hover": "bg-gray-200",
          "text": "flex items-center leading-[20px] grow min-w-[150px]",
          "icon": "flex w-[20px] h-[20px] select-none mr-[8px] leading-[16px] bg-contain bg-no-repeat bg-center"
        }
      },
      "li": "m-0 mx-2 p-2 text-[#050505] cursor-pointer leading-4 text-[15px] flex items-center flex-row flex-shrink-0 bg-white rounded-lg border-0"
    },
    "debugTimetravelPanel": {
      "base": "overflow-hidden p-0 pb-2.5 m-auto flex",
      "slider": "p-0 flex-[8]",
      "button": "p-0 border-0 bg-none flex-[1] text-white text-xs hover:underline"
    },
    "debugTimetravelButton": "absolute top-2.5 right-3 border-0 p-0 text-xs text-white bg-transparent hover:underline",
    "debugTreetypeButton": "absolute top-2.5 right-[85px] border-0 p-0 text-xs text-white bg-transparent hover:underline",
    "connecting": "absolute top-2.5 left-2.5 text-[15px] text-gray-400 overflow-hidden text-ellipsis whitespace-nowrap pointer-events-none",
    "toolbar": {
      "base": "flex flex-wrap h-fit overflow-hidden mb[1px] p-1 rounded-tl-lg rounded-tr-lg sticky top-0 items-center",
      "toolbarItem": {
        "base": "border-0 flex bg-none rounded-lg p-2 cursor-pointer align-middle flex-shrink-0 items-center justify-between hover:bg-gray-200",
        "disabled": {
          "base": "cursor-not-allowed",
          "icon": "opacity-20",
          "text": "opacity-20",
          "iconFormat": "opacity-60",
          "chevronDown": "opacity-20"
        },
        "spaced": "mr-2",
        "iconFormat": "flex h-[18px] w-[18px] opacity-60 custom-vertical-align",
        "active": {
          "base": "bg-[rgba(223,232,250,0.3)]",
          "i": "opacity-100"
        },
        "fontFamilyText": "block max-w-[10rem]",
        "text": "flex leading-[20px] custom-vertical-align text-[14px] text-gray-500 truncate overflow-hidden h-[20px] text-left pr-[10px]",
        "icon": "flex w-5 h-5 select-none mr-2 leading-4 bg-contain"
      },
      "codeLanguage": "w-[150px]",
      "chevronDownIcon": "mt-1 w-4 h-4 flex select-none",
      "chevronDownIconInside": "w-4 h-4 flex ml-6 mt-2.5 mr-2 pointer-events-none",
      "divider": "w-[1px] bg-[#eee] mx-[4px] h-[35px]"
    },
    "stickyNoteContainer": {
      "base": "absolute z-9 w-[120px] inline-block",
      "dragging": "transition-none"
    },
    "stickyNote": {
      "base": "relative block cursor-move text-left w-[120px] m-6 p-[20px] border border-[#e8e8e8] font-[Reenie_Beanie] text-[24px] rounded-br-[60px]",
      "contentEditable": "min-h-[20px] border-0 resize-none cursor-text text-[24px] caret-black block relative tab-[1] outline-none p-[10px] select-text whitespace-pre-wrap break-words",
      "placeholder": "text-[24px] text-gray-500 overflow-hidden absolute truncate top-[30px] left-[20px] w-[120px] select-none whitespace-nowrap inline-block pointer-events-none",
      "after": "absolute z-[-1] right-0 bottom-[20px] w-[120px] h-[25px] bg-black/20 shadow-[2px_15px_5px_rgba(0,0,0,0.4)] transform -scale-x-100",
      "yellow": "border-t border-[#fdfd86] bg-gradient-to-br from-[#ffff88] to-[#ffffc6]",
      "pink": "border-t border-[#e7d1e4] bg-gradient-to-br from-[#f7cbe8] to-[#e7bfe1]",
      "div": "cursor-text",
      "delete": "absolute top-[8px] right-[10px] text-[10px] border-0 bg-none cursor-pointer opacity-50 hover:font-bold hover:opacity-100",
      "color": "absolute top-[8px] right-[25px] border-0 bg-none opacity-50 hover:opacity-100",
      "colorIcon": "block w-[12px] h-[12px] bg-contain"
    },
    "excalidrawButton": {
      "base": "border-0 p-0 m-0 bg-transparent",
      "selected": "outline outline-2 outline-[rgb(60,132,244)] user-select-none"
    },
    "hr": {
      "base": "p-[2px] border-none my-4 cursor-pointer relative",
      "after": "absolute left-0 right-0 h-[2px] bg-[#ccc] leading-[2px]",
      "selected": "outline-[2px] outline-solid outline-[#3c84f4] select-none"
    },
    "spacer": "tracking[-2px]",
    "editorEquation": {
      "base": "cursor-default select-none",
      "focused": "outline-2 outline-solid outline-[#3c84f4]"
    },
    "buttonItemIcon": "opacity-60",
    "dropdownItemActive": "bg-[#dfe8fa4d]",
    "dropdownItemActiveIcon": "opacity-100",
    "tableNodeContentEditable": "min-h-[20px] border-0 resize-none cursor-text block relative tab-size-1 outline-0 p-0 select-text text-[15px] whitespace-pre-wrap break-words z-3",
    "nestable": {
      "base": "relative",
      "list": "p-0 list-none",
      "listDirectChild": "p-0",
      "item": "m-0",
      "itemFirstChild": "mt-0",
      "itemList": "mt-0",
      "isDragging": {
        "list": "pointer-events-none",
        "allElements": "opacity-0",
        "before": "absolute inset-0 rounded-md"
      },
      "itemIcon": "mr-1 cursor-pointer",
      "dragLayer": "fixed top-0 left-0 z-[100] pointer-events-none",
      "dragLayerList": "absolute top-0 left-0 p-0",
      "icon": {
        "base": "relative inline-block w-5 h-5 bg-transparent bg-center bg-no-repeat",
        "before": "hidden"
      },
      "iconPlusGray": "w-5 h-5 bg-[url(\"./icon-plus-gray.svg\")]",
      "iconMinusGray": "w-5 h-5 bg-[url(\"./icon-minus-gray.svg\")]"
    },
    "draggableBlockMenu": {
      "base": "rounded-md p-0.5 cursor-grab opacity-0 absolute -left-0 top-0 will-change-transform hover:bg-gray-200",
      "icon": "w-4 h-4 opacity-30 bg-[url(/images/icons/draggable-block-menu.svg)]",
      "active": "cursor-grabbing"
    },
    "draggableBlockTargetLine": {
      "base": "pointer-events-none bg-blue-500 h-1 absolute left-0 top-0 opacity-0 will-change-transform"
    },
    "floatingTextFormatPopup": {
      "base": "flex bg-white p-1 align-middle absolute top-0 left-0 z-10 opacity-0 shadow-md rounded-lg transition-opacity duration-500 h-11 will-change-transform",
      "popupItem": {
        "base": "border-0 flex bg-transparent rounded-lg p-2 cursor-pointer align-middle",
        "disabled": "cursor-not-allowed",
        "spaced": "mr-[2px]",
        "icon": "bg-contain inline-block h-[18px] w-[18px] mt-[2px] flex opacity-60",
        "disabledIcon": "opacity-20",
        "active": "bg-[rgba(223,232,250,0.3)]",
        "activeIcon": "opacity-100",
        "hover": "hover:bg-gray-200"
      },
      "select": {
        "base": "border-0 flex bg-transparent rounded-lg p-2 w-18 text-sm text-gray-500 truncate appearance-none",
        "codeLanguage": "capitalize w-32"
      },
      "text": "flex items-center text-[14px] text-gray-500 leading-[20px] w-[70px] h-[20px] overflow-hidden text-left truncate",
      "icon": "flex w-5 h-5 select-none mr-2 leading-4 bg-contain",
      "chevronDown": "mt-0.75 w-4 h-4 flex select-none",
      "chevronInside": "w-4 h-4 flex ml-[-6.25rem] mt-[11px] mr-[10px] pointer-events-none",
      "divider": "w-px bg-gray-200 mx-1",
      "insertComment": "hidden md:block"
    },
    "collapsible": {
      "container": "bg-[#fcfcfc] border border-gray-200 rounded-lg mb-2",
      "containerOpen": "bg-transparent border-none",
      "title": "scroll-mt-24 cursor-pointer p-1.25 pl-5 relative font-bold list-none outline-none",
      "titleBefore": "absolute left-1.75 top-1/2 transform -translate-y-1/2 border border-solid border-transparent border-l-black border-t-[4px] border-b-[4px] border-l-[6px] border-r-[6px]",
      "titleBeforeClosed": "border-[0.25rem_0.375rem_0.25rem_0.375rem]",
      "titleBeforeOpen": "border-[0.375rem_0.25rem_0_0.25rem] border-t-black bg-transparent",
      "content": "p-0 pl-5 pb-[5px]",
      "collapsedContent": "hidden select-none"
    },
    "tableOfContents": {
      "container": "fixed top-52 right-[-35px] p-[10px] w-[250px] flex flex-row justify-start z-10 h-[300px] text-[#65676b]",
      "headings": "list-none mt-0 ml-[10px] p-0 overflow-scroll w-[200px] h-[220px] overflow-x-hidden overflow-y-auto scrollbar-hide",
      "heading1": "text-black font-bold cursor-pointer",
      "heading2": "ml-[10px]",
      "heading3": "ml-5",
      "normalHeading": "cursor-pointer leading-5 text-base",
      "selectedHeading": "text-[#3578e5] relative",
      "selectedHeadingWrapper": "relative",
      "selectedHeadingBefore": "absolute inline-block left-[-30px] top-1 z-10 h-1 w-1 bg-[#3578e5] border-4 border-white rounded-full",
      "normalHeadingWrapper": "ml-8 relative"
    },
    "imageNode": {
      "contentEditable": "min-h-[20px] border-0 resize-none cursor-text caret-[#050505] block relative tab-[1] outline-0 p-[10px] select-text text-[12px] w-[calc(100%-20px)] whitespace-pre-wrap break-words",
      "placeholder": "text-[12px] text-gray-500 overflow-hidden absolute text-ellipsis top-[10px] left-[10px] select-none whitespace-nowrap inline-block pointer-events-none"
    },
    "imageControlWrapperResizing": "touch-none",
    "actions": {
      "base": "absolute text-right m-[10px] bottom-0 right-0",
      "treeView": "rounded-bl-none rounded-br-none",
      "i": {
        "base": "bg-contain inline-block h-[15px] w-[15px] align-[-0.25em]",
        "indent": "bg-[url(/images/icons/indent.svg)]",
        "outdent": "bg-[url(/images/icons/outdent.svg)]",
        "lock": "bg-[url(/images/icons/lock-fill.svg)]",
        "unlock": "bg-[url(/images/icons/lock.svg)]",
        "image": "bg-[url(/images/icons/file-image.svg)]",
        "table": "bg-[url(/images/icons/table.svg)]",
        "leftAlign": "bg-[url(/images/icons/text-left.svg)]",
        "centerAlign": "bg-[url(/images/icons/text-center.svg)]",
        "rightAlign": "bg-[url(/images/icons/text-right.svg)]",
        "justifyAlign": "bg-[url(/images/icons/justify.svg)]",
        "disconnect": "bg-[url(/images/icons/plug.svg)]",
        "connect": "bg-[url(/images/icons/plug-fill.svg)]"
      }
    }
  },
  "dataCard": {
    "columnControlWrapper": "grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-x-1 gap-y-0.5",
    "columnControlHeaderWrapper": "px-1 font-semibold border bg-gray-50 text-gray-500",
    "mainWrapperCompactView": "grid",
    "mainWrapperSimpleView": "flex flex-col",
    "subWrapper": "w-full text-[#2D3E4C]",
    "subWrapperCompactView": "flex flex-col flex-wrap rounded-[12px]",
    "subWrapperSimpleView": "grid",
    "headerValueWrapper": "w-full rounded-[12px] flex items-center gap-[4px] justify-center p-2",
    "headerValueWrapperCompactView": "rounded-none ",
    "headerValueWrapperSimpleView": "",
    "justifyTextLeft": "text-start justify-items-start",
    "justifyTextRight": "text-end justify-items-end",
    "justifyTextCenter": "text-center justify-items-center",
    "textXS": "font-medium font-[Oswald] text-[12px] leading-[140%]",
    "textXSReg": "font-normal font-[Proxima Nova] text-[12px] leading-[100%] uppercase",
    "textSM": "font-medium font-[Oswald] text-[14px] leading-[100%] uppercase",
    "textSMReg": "font-normal font-[Proxima Nova] text-[14px] leading-[140%]",
    "textSMBold": "font-normal font-[Proxima Nova] text-[14px] leading-[140%]",
    "textSMSemiBold": "font-semibold font-[Proxima Nova] text-[14px] leading-[140%]",
    "textMD": "font-medium font-[Oswald] text-[16px] leading-[100%] uppercase",
    "textMDReg": "font-normal font-[Proxima Nova] text-[16px] leading-[140%]",
    "textMDBold": "font-bold font-[Proxima Nova] text-[16px] leading-[140%]",
    "textMDSemiBold": "font-semibold font-[Proxima Nova] text-[16px] leading-[140%]",
    "textXL": "font-medium font-[Oswald] text-[20px] leading-[100%] uppercase",
    "textXLSemiBold": "font-semibold font-[Proxima Nova] text-[20px] leading-[120%]",
    "text2XL": "font-medium font-[Oswald] text-[24px] leading-[100%] uppercase",
    "text2XLReg": "font-regular font-[Oswald] text-[24px] leading-[120%] uppercase",
    "text3XL": "font-medium font-[Oswald] text-[30px] leading-[100%] uppercase tracking-[-0.05em]",
    "text3XLReg": "font-normal font-[Oswald] text-[30px] leading-[120%] uppercase",
    "text4XL": "font-medium font-[Oswald] text-[36px] leading-[100%] uppercase tracking-[-0.05em]",
    "text5XL": "font-medium font-[Oswald] text-[48px] leading-[100%] uppercase tracking-[-0.05em]",
    "text6XL": "font-medium font-[Oswald] text-[60px] leading-[100%] uppercase",
    "text7XL": "font-medium font-[Oswald] text-[72px] leading-[100%] uppercase tracking-normal",
    "text8XL": "font-medium font-[Oswald] text-[96px] leading-[95%] uppercase tracking-normal ",
    "imgXS": "max-w-16 max-h-16",
    "imgSM": "max-w-24 max-h-24",
    "imgMD": "max-w-32 max-h-32",
    "imgXL": "max-w-40 max-h-40",
    "img2XL": "max-w-48 max-h-48",
    "img3XL": "max-w-56 max-h-56",
    "img4XL": "max-w-64 max-h-64",
    "img5XL": "w-full",
    "img6XL": "max-w-80 max-h-80",
    "img7XL": "max-w-96 max-h-96",
    "img8XL": "max-w-128 max-h-128",
    "header": "w-full flex-1 uppercase text-[#37576B]",
    "value": "w-full text-[#2D3E4C]",
    "headerValueWrapperBorderBColor": "border-[#C0D8E1]",
    "linkColValue": "flex-1 flex justify-center w-full bg-[#C5D7E0] rounded-full px-[12px] py-[8px] font-[Proxima Nova] font-bold text-[12px] leading-[100%] tracking-[0px] uppercase",
    "headerCompactView": "",
    "headerSimpleView": "",
    "valueCompactView": "",
    "valueSimpleView": ""
  },
  "attribution": {
    "wrapper": "w-full flex flex-col gap-[4px] text-[#2D3E4C] text-xs",
    "label": "font-semibold text-[12px] leading-[14.62px] border-t pt-[14px]",
    "link": "font-normal leading-[14.62px] text-[12px] underline"
  },
  "filters": {
    "filterLabel": "py-0.5 font-[Proxima Nova] font-regular text-[14px] text-[#2D3E4C] leading-[140%] tracking-[0px] capitalize text-balance",
    "loadingText": "pl-0.5 font-thin text-[#2D3E4C]",
    "filterSettingsWrapperInline": "w-2/3",
    "filterSettingsWrapperStacked": "w-full",
    "labelWrapperInline": "w-1/3 text-xs",
    "labelWrapperStacked": "w-full text-xs",
    "input": "w-full max-h-[150px] flex rounded-[12px] px-[10px] py-[4px] gap-[6px] text-[14px] text-[#37576B] border leading-[140%] tracking-[0px] bg-white overflow-auto scrollbar-sm text-nowrap",
    "settingPillsWrapper": "flex flex-row flex-wrap gap-1",
    "settingPill": "px-1 py-0.5 bg-orange-500/15 text-orange-700 hover:bg-orange-500/25 rounded-md",
    "settingLabel": "text-gray-900 font-regular min-w-fit",
    "filtersWrapper": "w-full flex flex-col rounded-md"
  },
  "graph": {
    "text": "text-[#2D3E4C] font-[Oswald] font-semibold text-[12px] leading-[100%] tracking-[0px] uppercase",
    "darkModeText": "bg-transparent text-white font-[Oswald] font-semibold text-[12px] leading-[100%] tracking-[0px] uppercase",
    "headerWrapper": "grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-x-1 gap-y-0.5",
    "columnControlWrapper": "px-1 font-semibold border bg-gray-50 text-gray-500",
    "scaleWrapper": "flex rounded-[8px] divide-x border w-fit border-[#E0EBF0] overflow-hidden",
    "scaleItem": "px-[12px] py-[7px] font-[Oswald] font-medium text-[12px] text-[#2D3E4C] text-center leading-[100%] tracking-[0px] uppercase cursor-pointer",
    "scaleItemActive": "bg-white",
    "scaleItemInActive": "bg-[#F3F8F9]"
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
            "icon": "Page",
            "url_slug": "projects"
          },
          {
            "id": "1437079",
            "index": "0",
            "title": "Project One",
            "icon": "Data",
            "url_slug": "project_one",
            "parent": "1437077"
          },
          {
            "id": "1437080",
            "index": "1",
            "title": "Project two",
            "icon": "Data",
            "url_slug": "project_two",
            "parent": "1437077"
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
        "ref": null,
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
        "ref": null,
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
        "ref": null,
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
        "ref": null,
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
          "ref": null,
          "props": {
            "children": "hover me!"
          },
          "_owner": null,
          "_store": {}
        },
        "children": {
          "type": "div",
          "key": null,
          "ref": null,
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
          "ref": null,
          "props": {
            "children": "hover me!"
          },
          "_owner": null,
          "_store": {}
        },
        "children": {
          "type": "div",
          "key": null,
          "ref": null,
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
  },
  "pageOptions": {
    "settingsPane": [
      {
        "type": "Select",
        "label": "Page Background",
        "location": "theme.page.container",
        "default": "",
        "options": [
          {
            "label": "Default",
            "value": "bg-[linear-gradient(0deg,rgba(244,244,244,0.96),rgba(244,244,244,0.96)),url('/themes/mny/topolines.png')]  bg-[size:500px] pb-[4px]"
          },
          {
            "label": "Blue",
            "value": "bg-[linear-gradient(0deg,rgba(33,52,64,.96),rgba(55,87,107,.96)),url('/themes/mny/topolines.png')] bg-[size:500px] pb-[4px]"
          },
          {
            "label": "Yellow",
            "value": "bg-[linear-gradient(0deg,rgba(252,246,236,.96),rgba(252,246,236,.96)),url('/themes/mny/topolines.png')] bg-[size:500px] pb-[4px]"
          }
        ]
      },
      {
        "type": "Select",
        "label": "Show in Footer",
        "location": "navOptions.show_in_footer",
        "default": "",
        "options": [
          {
            "label": "No",
            "value": ""
          },
          {
            "label": "Yes",
            "value": "show"
          }
        ]
      }
    ]
  },
  "levelClasses": {
    "1": " pt-2 pb-1 uppercase text-sm text-blue-400 hover:underline cursor-pointer border-r-2 mr-4",
    "2": "pl-2 pt-2 pb-1 uppercase text-sm text-slate-400 hover:underline cursor-pointer border-r-2 mr-4",
    "3": "pl-4 pt-2 pb-1 text-sm text-slate-400 hover:underline cursor-pointer border-r-2 mr-4",
    "4": "pl-6 pt-2 pb-1 text-sm text-slate-400 hover:underline cursor-pointer border-r-2 mr-4"
  },
  "pageControls": {
    "controlItem": "pl-6 py-0.5 text-md cursor-pointer hover:text-blue-500 text-slate-400 flex items-center",
    "select": "bg-transparent border-none rounded-sm focus:ring-0 focus:border-0 pl-1",
    "selectOption": "p-4 text-md cursor-pointer hover:text-blue-500 text-slate-400 hover:bg-blue-600"
  },
  "navPadding": {
    "1": "",
    "2": "",
    "3": ""
  }
}


export default {
  ...theme,
  Icons
}
