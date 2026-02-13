import LogoNav from './LogoNav'
import QuickLinks from './QuickLinks'


const theme = {
  "pages": {
    "sectionGroup": {
      "sideNavContainer1": "w-[302px] hidden xl:block",
      "sideNavContainer2": "w-[302px] sticky top-[120px] hidden xl:block h-[calc(100vh_-_128px)] pr-2",
      "sideNavContainer3": "shadow-md rounded-lg overflow-hidden h-full"
    },
    "sectionArray": {
      "options": {
        "activeStyle": 0
      },
      "styles": [
        {
          "name": "default",
          "wrapper": "relative",
          "gridOverlay": "absolute inset-0 pointer-events-none",
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
          "addSectionButton": "cursor-pointer py-0.5 text-sm text-blue-200 hover:text-blue-400 truncate w-full hover:bg-blue-50/75 -ml-4 hidden group-hover:flex absolute -top-5",
          "spacer": "flex-1",
          "addSectionIconWrapper": "flex items-center",
          "addSectionIcon": "size-6",
          "sizes": {
            "1": {
              "className": "col-span-12 md:col-span-6",
              "iconSize": 100
            },
            "1/3": {
              "className": "col-span-12 md:col-span-2",
              "iconSize": 33
            },
            "1/2": {
              "className": "col-span-12 md:col-span-3",
              "iconSize": 50
            },
            "2/3": {
              "className": "col-span-12 md:col-span-4",
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
        }
      ]
    },
    "section": {
      "options": {
        "activeStyle": 0
      },
      "styles": [
        {
          "name": "default",
          "wrapper": "",
          "wrapperHidden": "hidden",
          "topBar": "flex w-full",
          "topBarSpacer": "flex-1",
          "topBarButtonsEdit": "flex gap-1 z-10",
          "topBarButtonsView": "z-10",
          "menuPosition": "absolute top-[6px] right-[6px] items-center",
          "editIcon": "hover:text-blue-500 size-6",
          "contentWrapper": "h-full"
        }
      ]
    },
    "userMenu": {
      "options": {
        "activeStyle": 0
      },
      "styles": [
        {
          "name": "transportny-responsive",
          "userMenuContainer": "@container flex flex-1 flex-row w-full items-center justify-center @[120px]:justify-start rounded-lg bg-transparent @[120px]:bg-[#1a2029] @[120px]:mx-2 @[120px]:mb-2 p-1 @[120px]:p-2",
          "avatarWrapper": "flex justify-center items-center",
          "avatar": "size-10 border-2 border-[#3a4555] rounded-full place-items-center content-center bg-[#2a3545] hover:bg-[#3a4555] cursor-pointer",
          "avatarIcon": "size-5 @[120px]:size-6 fill-slate-400",
          "infoWrapper": "hidden @[120px]:flex flex-col flex-1 px-2",
          "emailText": "text-xs font-normal text-slate-400 tracking-tight text-left truncate",
          "groupText": "text-sm font-medium text-white tracking-wide text-left",
          "editControlWrapper": "flex justify-center items-center mt-2 @[120px]:mt-0",
          "iconWrapper": "size-10 @[120px]:size-8 flex items-center justify-center rounded-full @[120px]:rounded-md hover:bg-[#2a3545] cursor-pointer",
          "icon": "text-slate-400 hover:text-white size-5",
          "viewIcon": "ViewPage",
          "editIcon": "EditPage",
          "loginWrapper": "flex items-center transition-all cursor-pointer border-l-[3px] border-transparent text-slate-300 hover:text-white hover:bg-[#1e2530] justify-center py-3 @[120px]:justify-start @[120px]:px-4 @[120px]:py-2.5 @[120px]:gap-3",
          "loginLink": "",
          "loginIconWrapper": "",
          "loginIcon": "size-6 @[120px]:size-5 flex-shrink-0 text-slate-400",
          "loginText": "hidden @[120px]:inline font-['Proxima_Nova'] font-[400] text-[15px]",
          "authContainer": "@container w-full",
          "authWrapper": "flex flex-col-reverse @[120px]:flex-row p-1 @[120px]:p-2 items-center gap-2",
          "userMenuWrapper": "flex flex-col @[120px]:flex-row items-center @[120px]:flex-1 w-full"
        }
      ]
    },
    "searchButton": {
      "options": {
        "activeStyle": 0
      },
      "styles": [
        {
          "name": "transportny-responsive",
          "button": "@container flex items-center justify-center @[100px]:justify-between w-10 @[100px]:w-full h-10 mx-auto @[100px]:mx-2 mb-2 @[100px]:mb-0 py-2 @[100px]:px-3 bg-[#1a2029] hover:bg-[#252d3a] border border-[#3a4555] rounded-full @[100px]:rounded-lg transition ease-in cursor-pointer",
          "buttonText": "hidden @[100px]:inline text-slate-400 font-normal text-sm",
          "iconWrapper": "p-0 @[100px]:p-1.5 @[100px]:bg-[#3b82f6] @[100px]:rounded-md",
          "icon": "Search",
          "iconClass": "text-slate-400 @[100px]:text-white hover:text-white",
          "iconSize": 18
        }
      ]
    },
    "searchPallet": {
      "options": {
        "activeStyle": 0
      },
      "styles": [{
        "name": "transportny",
        "backdrop": "fixed inset-0 bg-black bg-opacity-60 transition-opacity",
        "dialogContainer": "fixed inset-0 z-20 w-screen overflow-y-auto p-4 sm:p-6 md:p-20 flex items-center place-content-center",
        "dialogPanel": "relative max-w-3xl sm:w-[637px] max-h-3/4 sm:h-[700px] p-4 flex flex-col gap-2 overflow-hidden rounded-xl bg-[#1a2029] border border-[#3a4555] transition-all",
        "inputWrapper": "w-full flex items-center relative px-4 py-3 bg-[#12181F] rounded-lg border border-[#3a4555]",
        "input": "px-1 flex-1 font-normal text-base text-white leading-[140%] bg-transparent focus:ring-0 sm:text-sm rounded-lg ring-0 outline-none placeholder:text-slate-500",
        "searchIconWrapper": "p-1",
        "searchIcon": "Search",
        "searchIconClass": "text-slate-400",
        "resultsWrapper": "bg-[#12181F] rounded-xl px-3 py-4 flex flex-col gap-2 divide-y divide-[#3a4555] max-h-[500px] transform-gpu scroll-py-3 overflow-x-hidden overflow-y-auto scrollbar-sm",
        "resultItemWrapper": "flex flex-col gap-3 pb-3 w-full select-none rounded-xl transition ease-in",
        "resultItemOuter": "select-none pt-3",
        "pageResultWrapper": "group w-full flex items-center text-xl font-medium text-slate-200 hover:text-white cursor-pointer",
        "pageIcon": "DraftPage",
        "pageIconWidth": 15,
        "pageIconHeight": 21,
        "pageTitle": "pl-2 font-['Oswald'] font-medium text-base leading-[100%] uppercase text-slate-200",
        "pageArrowIcon": "ArrowRight",
        "pageArrowClass": "h-6 w-6 ml-2 text-transparent group-hover:text-white",
        "sectionsWrapper": "ml-3 pl-4 flex flex-col gap-3 border-l border-[#3a4555]",
        "sectionItemWrapper": "w-full cursor-pointer group",
        "sectionTitleWrapper": "w-full flex items-center text-md font-medium text-slate-300 hover:text-white",
        "sectionIcon": "Section",
        "sectionIconWidth": 18,
        "sectionIconHeight": 18,
        "sectionTitle": "pl-1 font-normal text-base leading-[140%] tracking-normal text-slate-300",
        "sectionArrowClass": "h-6 w-6 ml-2 text-transparent group-hover:text-white",
        "tagsWrapper": "w-full ml-8",
        "tag": "tracking-wide p-1 text-xs text-white font-semibold rounded-md border",
        "tagMatch": "border-yellow-500 bg-yellow-600",
        "tagNoMatch": "border-[#3a4555] bg-[#2a3545]",
        "suggestionsWrapper": "flex items-center max-h-96 transform-gpu scroll-py-3 overflow-y-auto p-3",
        "suggestionsLabel": "text-xs italic text-slate-400",
        "suggestionItem": "flex cursor-pointer select-none hover:bg-[#2a3545] rounded-xl p-1",
        "suggestionTagIcon": "text-xs text-yellow-400 fa fa-tag",
        "suggestionTagText": "ml-2 text-sm font-medium text-slate-300",
        "suggestionTagTextFocus": "ml-2 text-sm font-medium text-white",
        "loadingWrapper": "p-2 mx-auto w-1/4 h-full flex items-center justify-middle",
        "loadingIcon": "px-2 fa fa-loader text-slate-400",
        "loadingText": "font-semibold text-white",
        "noResultsWrapper": "px-6 py-14 text-center text-sm sm:px-14",
        "noResultsIcon": "fa fa-exclamation mx-auto h-6 w-6 text-slate-400",
        "noResultsTitle": "mt-4 font-semibold text-white",
        "noResultsText": "mt-2 text-slate-400"
      }]
    }
  },
  "compatibility": "border-[#191919] pt-[41px]",
  "heading": {
    "1": "text-blue-500 font-bold text-xl tracking-wider py-1 pl-1",
    "2": "text-lg tracking-wider",
    "3": "text-md tracking-wide",
    "base": "p-2 w-full font-sans font-medium text-md bg-transparent",
    "default": ""
  },

  "layout": {
    "options": {
      "activeStyle": 0,
      "sideNav": {
        "size": "compact",
        "nav": "main",
        "activeStyle": null,
        "subMenuActivate": "onHover",
        "topMenu": [{ "type": "LogoNav" }],
        "bottomMenu": [{ "type": "QuickLinks" }, { "type": "UserMenu", "options": { "activeStyle": 0, "navigableMenuActiveStyle": 0 } }]
      },
      "topNav": {
        "size": "none",
        "nav": "none",
        "activeStyle": null,
        "leftMenu": [],
        "rightMenu": []
      },
    },
    "styles": [
      {
        "outerWrapper": "bg-white",
        "wrapper": "relative isolate flex min-h-svh w-full max-lg:flex-col overflow-clip",
        "wrapper2": "flex-1 flex items-start flex-col items-stretch max-w-full min-h-screen",
        "wrapper3": "flex flex-1",
        "childWrapper": "flex-1 h-full"
      }
    ]
  },
  "layoutGroup": {
    "options": {
      "activeStyle": "0"
    },
    "styles": [
      {
        "name": "content",
        "wrapper1": "w-full h-full flex-1 flex flex-row ",
        "wrapper2": "flex flex-1 w-full  flex-col bg-white relative text-md font-light leading-7 h-full min-h-[200px]",
        "wrapper3": "",
        "wrapepr3": ""
      },
      {
        "name": "header",
        "wrapper1": "w-full h-full flex-1 flex flex-row",
        "wrapper2": "flex flex-1 w-full  flex-col  relative min-h-[200px]",
        "wrapper3": "",
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
        "name": "transportny-dark",
        "layoutContainer1": "lg:ml-64",
        "layoutContainer2": "fixed inset-y-0 left-0 w-64 max-lg:hidden",
        "logoWrapper": "w-64 bg-[#12181F]",
        "sidenavWrapper": "flex flex-col w-64 h-full z-20 bg-[#12181F]",
        "menuItemWrapper": "flex flex-1 flex-col",
        "menuItemWrapper_level_1": "",
        "menuItemWrapper_level_2": "pl-4",
        "menuItemWrapper_level_3": "pl-6",
        "menuItemWrapper_level_4": "pl-8",
        "navitemSide": "font-['Proxima_Nova'] font-[400] text-[15px] group flex items-center px-4 py-2.5 hover:bg-[#1e2530] text-slate-300 border-l-[3px] border-transparent focus:outline-none transition-all cursor-pointer",
        "navitemSideActive": "font-['Proxima_Nova'] font-[500] text-[15px] group flex items-center px-4 py-2.5 bg-[#1e2530] text-white border-l-[3px] border-yellow-400 focus:outline-none transition-all cursor-pointer",
        "menuIconSide": "size-5 mr-3 text-slate-400 group-hover:text-slate-300 flex-shrink-0",
        "menuIconSideActive": "size-5 mr-3 text-yellow-400 flex-shrink-0",
        "forcedIcon": "",
        "forcedIcon_level_1": "",
        "forcedIcon_level_2": "",
        "forcedIcon_level_3": "",
        "forcedIcon_level_4": "",
        "itemsWrapper": "flex-1 py-4 overflow-y-auto scrollbar-sm",
        "navItemContent": "flex-1 flex items-center justify-between transition-transform duration-300 ease-in-out",
        "navItemContent_level_1": "",
        "navItemContent_level_2": "",
        "navItemContent_level_3": "",
        "navItemContent_level_4": "",
        "indicatorIcon": "ChevronRight",
        "indicatorIconOpen": "ChevronDown",
        "indicatorIconWrapper": "size-4 text-slate-500 transition-transform duration-200 ml-auto",
        "subMenuWrapper_1": "w-full bg-[#0d1117]",
        "subMenuWrapper_2": "w-full",
        "subMenuWrapper_3": "w-full",
        "subMenuOuterWrapper": "",
        "subMenuParentWrapper": "flex flex-col w-full",
        "bottomMenuWrapper": "border-t border-[#2a3545] pt-2",
        "sectionDivider": "my-3 border-t border-[#2a3545]",
        "sectionHeading": "px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider",
        "topnavWrapper": "w-full h-[50px] flex items-center pr-1",
        "topnavContent": "flex items-center w-full h-full bg-[#12181F] justify-between",
        "topnavMenu": "hidden lg:flex items-center flex-1 h-full overflow-x-auto overflow-y-hidden scrollbar-sm",
        "topmenuRightNavContainer": "hidden md:flex h-full items-center",
        "topnavMobileContainer": "bg-[#12181F]"
      },
      {
        "name": "compact",
        "subMenuActivate": "onHover",
        "layoutContainer1": "lg:ml-16",
        "layoutContainer2": "fixed inset-y-0 left-0 w-16 max-lg:hidden z-20",
        "logoWrapper": "w-16 bg-[#12181F]",
        "sidenavWrapper": "flex flex-col w-16 h-full z-20 bg-[#12181F] items-center overflow-visible",
        "menuItemWrapper": "flex justify-center",
        "menuItemWrapper_level_1": "",
        "menuItemWrapper_level_2": "flex flex-col w-full",
        "menuItemWrapper_level_3": "",
        "menuItemWrapper_level_4": "",
        "navitemSide": "group relative flex items-center justify-center w-full py-3 hover:bg-[#1e2530] text-slate-400 border-l-[3px] border-transparent focus:outline-none transition-all cursor-pointer",
        "navitemSideActive": "group relative flex items-center justify-center w-full py-3 bg-[#1e2530] text-white border-l-[3px] border-yellow-400 focus:outline-none transition-all cursor-pointer",
        "menuIconSide": "size-6 text-slate-400 group-hover:text-slate-300",
        "menuIconSideActive": "size-6 text-yellow-400",
        "forcedIcon": "",
        "forcedIcon_level_1": "Circle",
        "forcedIcon_level_2": "",
        "forcedIcon_level_3": "",
        "forcedIcon_level_4": "",
        "itemsWrapper": "flex-1 py-4 w-full overflow-visible",
        "navItemContent": "",
        "navItemContent_level_1": "absolute inset-0 text-transparent",
        "navItemContent_level_2": "flex-1 px-4 py-2.5 text-[14px] text-slate-300 hover:text-white hover:bg-[#2a3545] font-['Proxima_Nova'] font-[400] cursor-pointer transition-all border-l-2 border-transparent hover:border-yellow-400",
        "navItemContent_level_3": "",
        "navItemContent_level_4": "",
        "indicatorIcon": "hidden",
        "indicatorIconOpen": "hidden",
        "indicatorIconWrapper": "hidden",
        "subMenuWrapper_1": "min-w-[220px] bg-[#1a2029] border border-[#3a4555] shadow-2xl flex flex-col overflow-hidden",
        "subMenuWrapper_2": "min-w-[180px] bg-[#1a2029] border border-[#3a4555] shadow-xl py-1",
        "subMenuWrapper_3": "hidden",
        "subMenuTitle": "text-sm uppercase tracking-wider text-slate-400 font-semibold py-2 px-4 w-full bg-[#12181F] border-b border-[#2a3545]",
        "subMenuParentWrapper": "flex flex-col w-full",
        "subMenuOuterWrapper": "absolute left-full top-0",
        "subMenuWrapperChild": "flex flex-col",
        "bottomMenuWrapper": "border-t border-[#2a3545] pt-2 w-full",
        "sectionDivider": "my-3 border-t border-[#2a3545] w-full",
        "sectionHeading": "hidden",
        "topnavWrapper": "w-full h-[50px] flex items-center justify-center",
        "topnavContent": "flex items-center justify-center w-full h-full bg-[#12181F]",
        "topnavMenu": "hidden",
        "topmenuRightNavContainer": "hidden",
        "topnavMobileContainer": "bg-[#12181F]"
      }
    ]
  },
  "topnav": {
    "options": {
      "activeStyle": 0,
      "maxDepth": 2
    },
    "styles": [
      {
        "name": "catalyst",
        "layoutContainer1": "h-[50px]",
        "layoutContainer2": "w-full z-20 ",
        "topnavWrapper": "w-full h-[50px] flex items-center pr-1",
        "topnavContent": "flex items-center w-full h-full bg-white lg:bg-zinc-100 dark:bg-zinc-900 dark:lg:bg-zinc-950 justify-between",
        "leftMenuContainer": "",
        "centerMenuContainer": "hidden  lg:flex items-center flex-1  h-full overflow-x-auto overflow-y-hidden scrollbar-sm",
        "rightMenuContainer": "hidden min-w-[120px] md:flex h-full items-center",
        "mobileNavContainer": "",
        "mobileButton": "md:hidden inline-flex items-center justify-center  px-2 hover:text-blue-400  text-gray-400 hover:bg-gray-100 ",
        "menuOpenIcon": "Menu",
        "menuCloseIcon": "XMark",
        "navitemWrapper": "",
        "navitemWrapper_level_2": "relative",
        "navitemWrapper_level_3": "",
        "navitem": "\n        w-fit group font-display whitespace-nowrapmenuItemWrapper\n        flex tracking-widest items-center font-[Oswald] font-medium text-slate-700 text-[11px] px-2 h-12\n        focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300\n        transition cursor-pointer\n    ",
        "navitemActive": " w-fit group font-display whitespace-nowrap\n        flex tracking-widest items-center font-[Oswald] font-medium text-slate-700 text-[11px] px-2 h-12 text-blue\n        focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300\n        transition cursor-pointer\n      ",
        "navIcon": "",
        "navIconActive": "",
        "navitemContent": "flex-1 flex items-center gap-[2px]",
        "navitemName": "",
        "navitemName_level_2": "uppercase font-[Oswald] text-[14px] flex items-center p-1",
        "navitemName_level_3": "w-full text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white py-2 px-3 rounded-md transition-colors",
        "navitemDescription": "hidden",
        "navitemDescription_level_2": "text-[16px] font-['Proxima_Nova'] font-[400] text-[#37576B] text-wrap",
        "navitemDescription_level_3": "text-xs text-zinc-500 dark:text-zinc-400 mt-0.5",
        "indicatorIconWrapper": "size-3",
        "indicatorIcon": "ArrowDown",
        "indicatorIconOpen": "ArrowDown",
        "subMenuWrapper": "hidden",
        "subMenuWrapper2": "",
        "subMenuWrapper_level_2": "absolute left-full top-0 ml-2 z-50",
        "subMenuWrapper2_level_2": "bg-white dark:bg-zinc-900 rounded-xl shadow-lg ring-1 ring-zinc-950/5 dark:ring-white/10 py-1 min-w-[200px]",
        "subMenuItemsWrapper": "flex flex-col",
        "subMenuItemsWrapperParent": "flex flex-col",
        "subMenuParentWrapper": "hidden",
        "subMenuParentContent": "px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 mb-1",
        "subMenuParentName": "text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide",
        "subMenuParentDesc": "text-xs text-zinc-400 dark:text-zinc-500 mt-0.5",
        "subMenuParentLink": "text-xs text-zinc-900 dark:text-white hover:underline mt-1 inline-block",
        "subMenuWrapperChild": "divide-x overflow-x-auto max-w-[1400px] mx-auto",
        "subMenuWrapperTop": "hidden",
        "subMenuWrapperInactiveFlyout": "absolute left-0 right-0  mt-8 normal-case bg-white shadow-lg z-10 p-2",
        "subMenuWrapperInactiveFlyoutBelow": " absolute ml-40 normal-case bg-white shadow-lg z-10 p-2",
        "subMenuWrapperInactiveFlyoutDirection": "grid grid-cols-4"
      }
    ]
  },
  "logo": {
    "logoWrapper": "@container h-16 flex px-2 @[120px]:px-4 py-3 items-center justify-center @[120px]:justify-start gap-0 @[120px]:gap-2 bg-[#12181F]",
    "logoAltImg": "hidden",
    "imgWrapper": "flex-shrink-0",
    "img": "/themes/transportny/nys_logo_white.svg",
    "imgClass": "h-8 @[120px]:h-10 w-auto",
    "titleWrapper": "hidden @[120px]:block text-white font-['Oswald'] font-semibold text-lg tracking-wide uppercase",
    "title": "TransportNY",
    "linkPath": "/"
  },
  "tabs": {
    "tablist": "flex gap-4",
    "tab": "\n    py-1 px-3 font-semibold text-slate-600 focus:outline-none border-b-2 border-white text-xs hover:text-slate-900\n    data-[selected]:border-blue-500 data-[selected]:bg-white/10 data-[hover]:bg-white/5 data-[selected]:data-[hover]:bg-white/10 data-[focus]:outline-1 data-[focus]:outline-white\n  ",
    "tabpanels": "",
    "tabpanel": "rounded-xl bg-white/5"
  },
  "button": {
    "options": {
      "activeStyle": 0
    },
    "styles": [
      {
        "name": "default Buttons",
        "button": "inline-flex items-center gap-2  bg-gray-700 py-1.5  text-sm/6 font-semibold text-white shadow-inner shadow-white/10 focus:outline-none data-[hover]:bg-gray-600 data-[open]:bg-gray-700 data-[focus]:outline-1 data-[focus]:outline-white\n        rounded-lg\n        px-[calc(theme(spacing[3.5])-1px)] py-[calc(theme(spacing[2.5])-1px)] sm:px-[calc(theme(spacing.3)-1px)] sm:py-[calc(theme(spacing[1.5])-1px)]\n      "
      },
      {
        "name": "plain",
        "button": "cursor-pointer relative isolate inline-flex items-center justify-center gap-x-2 rounded-lg border text-base/6 font-semibold  sm:text-sm/6 focus:outline-none data-[focus]:outline data-[focus]:outline-2 data-[focus]:outline-offset-2 data-[focus]:outline-blue-500 data-[disabled]:opacity-50 [&>[data-slot=icon]]:-mx-0.5 [&>[data-slot=icon]]:my-0.5 [&>[data-slot=icon]]:size-5 [&>[data-slot=icon]]:shrink-0 [&>[data-slot=icon]]:text-[--btn-icon] [&>[data-slot=icon]]:sm:my-1 [&>[data-slot=icon]]:sm:size-4 forced-colors:[--btn-icon:ButtonText] forced-colors:data-[hover]:[--btn-icon:ButtonText] border-transparent text-zinc-950 data-[active]:bg-zinc-950/5 data-[hover]:bg-zinc-950/5 dark:text-white dark:data-[active]:bg-white/10 dark:data-[hover]:bg-white/10 [--btn-icon:theme(colors.zinc.500)] data-[active]:[--btn-icon:theme(colors.zinc.700)] data-[hover]:[--btn-icon:theme(colors.zinc.700)] dark:[--btn-icon:theme(colors.zinc.500)] dark:data-[active]:[--btn-icon:theme(colors.zinc.400)] dark:data-[hover]:[--btn-icon:theme(colors.zinc.400)] cursor-default\n      rounded-lg\n      px-[calc(theme(spacing[3.5])-1px)] py-[calc(theme(spacing[2.5])-1px)] sm:px-[calc(theme(spacing.3)-1px)] sm:py-[calc(theme(spacing[1.5])-1px)]\n      "
      },
      {
        "name": "active",
        "button": "cursor-pointer px-4 inline-flex  justify-center cursor-pointer text-sm font-semibold  bg-blue-600 text-white hover:bg-blue-500 shadow-lg border border-b-4 border-blue-800 hover:border-blue-700 active:border-b-2 active:mb-[2px] active:shadow-none\n      rounded-lg\n      px-[calc(theme(spacing[3.5])-1px)] py-[calc(theme(spacing[2.5])-1px)] sm:px-[calc(theme(spacing.3)-1px)] sm:py-[calc(theme(spacing[1.5])-1px)]\n      "
      }
    ]
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
    "options": {
      "activeStyle": 0
    },
    "styles": [
      {
        "name": "default",
        "tableContainer": "flex flex-col overflow-x-auto min-h-[40px] max-h-[calc(78vh_-_10px)] overflow-y-auto",
        "tableContainerNoPagination": "",
        "headerContainer": "sticky top-0 grid",
        "headerLeftGutter": "flex justify-between sticky left-0 z-[1]",
        "headerWrapper": "flex justify-between",
        "headerCellContainer": "w-full font-semibold px-3 py-1 content-center text-sm font-semibold text-gray-600",
        "headerCellContainerBgSelected": "bg-blue-100 text-gray-900",
        "headerCellContainerBg": "bg-gray-50 text-gray-500",
        "colResizer": "z-5 -ml-2 w-[1px] hover:w-[2px] bg-gray-200 hover:bg-gray-400",
        "wrapText": "whitespace-pre-wrap",
        "cell": "relative flex items-center min-h-[35px]  border border-slate-50",
        "cellInner": "w-full min-h-full flex flex-wrap items-center truncate py-0.5 px-1 font-[400] text-[14px]  leading-[18px] text-slate-600",
        "cellBgOdd": "bg-gray-50 hover:bg-gray-100",
        "cellBgEven": "bg-white hover:bg-gray-100",
        "cellBg": "bg-white hover:bg-gray-100",
        "cellBgSelected": "bg-blue-50 hover:bg-blue-100",
        "totalCell": "hover:bg-gray-150",
        "cellEditableTextBox": "absolute border focus:outline-none min-w-[180px] min-h-[50px] z-[10] whitespace-pre-wrap",
        "cellFrozenCol": "",
        "cellInvalid": "bg-red-50 hover:bg-red-100",
        "gutterCellWrapper": "flex text-xs items-center justify-center cursor-pointer sticky left-0 z-[1]",
        "gutterCellWrapperNotSelected": "bg-gray-50 text-gray-500",
        "gutterCellWrapperSelected": "bg-blue-100 text-gray-900",
        "paginationInfoContainer": "",
        "paginationPagesInfo": "font-[500] text-[12px] uppercase text-[#2d3e4c] leading-[18px]",
        "paginationRowsInfo": "text-xs",
        "paginationContainer": "w-full p-2 flex items-center justify-between",
        "paginationControlsContainer": "flex flex-row items-center overflow-hidden gap-0.5",
        "pageRangeItem": "cursor-pointer px-3  text-[#2D3E4C] py-1  text-[12px] hover:bg-slate-50 font-[500] rounded  uppercase leading-[18px]",
        "pageRangeItemInactive": "",
        "pageRangeItemActive": "bg-slate-100 ",
        "totalRow": "bg-gray-100 sticky bottom-0 z-[3]",
        "stripedRow": "even:bg-gray-50",
        "openOutContainer": "w-[330px] overflow-auto scrollbar-sm flex flex-col gap-[12px] p-[16px] bg-white h-full float-right",
        "openOutContainerWrapper": "fixed inset-0 right-0 h-full w-full z-[100]",
        "openOutHeader": "font-semibold text-gray-600",
        "openOutCloseIconContainer": "w-full flex justify-end",
        "openOutCloseIconWrapper": "w-fit h-fit p-[8px] text-[#37576B] border border-[#E0EBF0] rounded-full cursor-pointer",
        "openOutCloseIcon": "XMark",
        "openOutContainerWrapperBgColor": "#00000066",
        "openOutIconWrapper": "px-2 cursor-pointer bg-transparent text-gray-500 hover:text-gray-600",
        "headerCellWrapper": "relative w-full",
        "headerCellBtn": "group inline-flex items-center w-full justify-between gap-x-1.5 rounded-md cursor-pointer",
        "headerCellLabel": "truncate select-none",
        "headerCellBtnActive": "bg-gray-300",
        "headerCellFnIconClass": "text-gray-400",
        "headerCellCountIcon": "TallyMark",
        "headerCellListIcon": "LeftToRightListBullet",
        "headerCellSumIcon": "Sum",
        "headerCellAvgIcon": "Avg",
        "headerCellGroupIcon": "Group",
        "headerCellSortAscIcon": "SortAsc",
        "headerCellSortDescIcon": "SortDesc",
        "headerCellMenuIcon": "ArrowDown",
        "headerCellMenuIconClass": "text-gray-400 group-hover:text-gray-600 transition ease-in-out duration-200 print:hidden",
        "headerCellIconWrapper": "flex items-center",
        "headerCellMenu": "py-0.5 flex flex-col gap-0.5 items-center px-1 text-xs text-gray-600 font-regular max-h-[500px] min-w-[180px] z-[10] overflow-auto scrollbar-sm bg-white divide-y divide-gray-100 rounded-md shadow-lg ring-1 ring-black ring-opacity-5",
        "headerCellControlWrapper": "w-full group px-2 py-1 flex justify-between items-center rounded-md hover:bg-gray-100",
        "headerCellControlLabel": "w-fit font-regular text-gray-500 cursor-default",
        "headerCellControl": "p-0.5 w-full rounded-md bg-white group-hover:bg-gray-100 cursor-pointer"
      }
    ],
    "tableContainer": "flex flex-col overflow-x-auto",
    "tableContainerNoPagination": "",
    "tableContainer1": "flex flex-col no-wrap min-h-[40px] max-h-[calc(78vh_-_10px)] overflow-y-auto",
    "headerContainer": "sticky top-0 grid",
    "thead": "flex justify-between",
    "theadfrozen": "",
    "thContainer": "w-full font-semibold px-3 py-1 content-center text-sm font-semibold text-gray-600",
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
    "options": {
      "activeStyle": 0
    },
    "styles": [
      {
        "name": "default",
        "header": "w-full capitalize",
        "value": "w-full",
        "valueWrapper": "min-h-[20px]",
        "description": "w-full text-xs font-light",
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
        "componentWrapper": "w-full",
        "headerValueWrapperBorderBelow": "border-b rounded-none",
        "itemBorder": "border shadow",
        "itemFlexCol": "flex-col",
        "itemFlexRow": "flex-row",
        "itemFlexColReverse": "flex-col flex-col-reverse",
        "itemFlexRowReverse": "flex-row flex-row-reverse",
        "iconAndColorValues": "flex items-center gap-1.5 uppercase",
        "formEditButtonsWrapper": "self-end flex gap-0.5 text-sm",
        "formEditSaveButton": "bg-blue-300 hover:bg-blue-400 text-blue-700 rounded-lg w-fit px-2 py-0.5",
        "formEditCancelButton": "bg-red-300 hover:bg-red-400 text-red-700 rounded-lg w-fit px-2 py-0.5",
        "formAddNewItemButton": "bg-blue-300 hover:bg-blue-400 text-blue-700 rounded-lg w-fit px-2 py-0.5 text-sm self-end",
        "justifyTextLeft": "text-start justify-items-start  rounded-md",
        "justifyTextRight": "text-end justify-items-end rounded-md",
        "justifyTextCenter": "text-center justify-items-center rounded-md",
        "textXS": "text-xs font-medium",
        "textXSReg": "text-xs font-normal",
        "textSM": "text-sm font-medium",
        "textSMReg": "text-sm font-normal",
        "textSMBold": "text-sm font-normal",
        "textSMSemiBold": "text-sm font-semibold",
        "textMD": "text-md font-medium",
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
        "imgDefault": "max-w-[50px] max-h-[50px]"
      }
    ],
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
  "navigableMenu": {
    "styles": [
      {
        "name": "dark",
        "button": "px-1 py-0.5",
        "buttonHidden": "hidden group-hover:flex",
        "icon": "Menu",
        "iconWrapper": "size-4",
        "menuWrapper": "bg-[#1a2029] border border-[#3a4555] w-60 p-1 min-h-[75px] rounded-md shadow-2xl",
        "menuHeaderWrapper": "flex px-2 py-1 justify-between",
        "menuHeaderContent": "flex gap-2 items-center w-full",
        "menuTitle": "font-semibold text-white",
        "backButton": "w-fit",
        "backIcon": "ArrowLeft",
        "backIconWrapper": "size-4 text-slate-400",
        "closeButton": "w-fit",
        "menuCloseIcon": "XMark",
        "menuCloseIconWrapper": "hover:cursor-pointer size-4 text-slate-400 hover:text-white",
        "menuItemsWrapper": "max-h-[80vh] overflow-y-auto scrollbar-sm",
        "menuItem": "group flex w-full gap-1 items-center justify-between px-2 py-1.5 rounded-md text-sm text-slate-300",
        "menuItemHover": "hover:bg-[#2a3545] hover:text-white",
        "menuItemIconLabelWrapper": "flex flex-1 items-center gap-2",
        "menuItemIconWrapper": "min-w-5 size-5 text-slate-400 group-hover:text-slate-300",
        "menuItemLabel": "text-slate-300",
        "menuItemLabelLink": "cursor-pointer hover:text-white",
        "subMenuIcon": "ArrowRight",
        "subMenuIconWrapper": "place-self-center text-slate-500",
        "valueSubmenuIconWrapper": "flex gap-0.5",
        "valueWrapper": "p-0.5 rounded-md bg-[#2a3545] text-slate-300 text-sm",
        "separator": "w-full border-b border-[#3a4555]"
      }
    ]
  },
  "datasets": {
    breadcrumbs: {
      nav: 'border-b border-gray-200 flex h-10',
      ol: 'w-full px-4 flex items-center space-x-4 sm:px-6 lg:px-8',
      li: 'flex',
      link: "ml-4 text-sm font-medium font-['Proxima_Nova'] text-gray-500 hover:text-gray-700",
      homeIcon: 'text-gray-400 hover:text-yellow-500 size-4',
      homeLink: 'hover:text-yellow-500 text-gray-400',
      separator: 'flex-shrink-0 w-6 h-full text-gray-300',
    },
    table: {
      tableHeader: "px-4 py-1 text-sm pb-1 h-8 border border-b-4 border-gray-200 bg-slate-50 text-left font-semibold font-['Proxima_Nova'] text-gray-700 uppercase first:rounded-tl-md last:rounded-tr-md",
      tableInfoBar: 'bg-white',
      tableRow: 'bg-white hover:bg-yellow-50 transition ease-in-out duration-150',
      totalRow: 'bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition ease-in-out duration-150',
      tableOpenOutRow: 'flex flex-col',
      tableRowStriped: 'bg-white odd:bg-slate-50 hover:bg-yellow-50 transition ease-in-out duration-150',
      tableCell: 'px-4 py-1 text-sm break-words border border-gray-200 pl-1 align-top font-light text-gray-700',
      inputSmall: 'w-24',
      sortIconDown: 'fas fa-sort-amount-down text-gray-400 opacity-75',
      sortIconUp: 'fas fa-sort-amount-up text-gray-400 opacity-75',
      sortIconIdeal: 'fa fa-sort-alt text-gray-400 opacity-25',
      infoIcon: 'fas fa-info text-sm text-blue-500 hover:text-blue-700',
    },
    datasetsList: {
      pageWrapper: 'max-w-6xl mx-auto w-full',
      header: 'sticky top-0 z-10 bg-white flex flex-col gap-3 pb-3',
      toolbar: 'flex flex-row items-center gap-1 px-4',
      toolbarSearch: 'flex-1',
      body: 'flex flex-row gap-3 px-4 pb-4',
      sidebar: 'w-1/4 flex flex-col gap-1 sticky top-[6.5rem] self-start max-h-[calc(100svh-7.5rem)] overflow-y-auto overflow-x-hidden scrollbar-sm',
      sidebarItem: 'bg-white hover:bg-gray-50 px-3 py-2 flex items-center min-w-0 text-sm text-gray-700 transition-colors border-b border-gray-100',
      sidebarItemActive: 'bg-white border-l-2 border-yellow-400 text-gray-900 px-3 py-2 flex items-center min-w-0 text-sm font-medium transition-colors border-b border-gray-100',
      sidebarItemText: 'flex-1 min-w-0 truncate',
      sidebarBadge: 'bg-yellow-50 text-yellow-600 text-xs w-5 h-5 ml-auto shrink-0 grow-0 rounded-full flex items-center justify-center',
      sidebarSubItem: 'bg-white hover:bg-gray-50 pl-6 pr-3 py-1.5 flex items-center min-w-0 text-sm text-gray-500 transition-colors border-b border-gray-100',
      sidebarSubItemActive: 'bg-white border-l-2 border-yellow-400 text-gray-900 pl-6 pr-3 py-1.5 flex items-center min-w-0 text-sm font-medium transition-colors border-b border-gray-100',
      sourceList: 'w-3/4 flex flex-col gap-2',
      sourceCard: 'w-full p-4 bg-[#f3f8f9] hover:bg-white rounded-lg border border-gray-200 shadow-sm flex transition-colors',
      sourceTitle: "text-base font-semibold font-['Proxima_Nova'] text-blue-600 hover:text-blue-800 w-full block transition-colors",
      sourceTypeLabel: 'text-xs font-normal text-gray-400 ml-2',
      sourceCategoryBadge: 'text-xs py-0.5 px-2 bg-yellow-50 text-yellow-700 rounded-full mr-1.5',
      sourceDescription: 'pt-1 text-sm text-gray-500 line-clamp-2',
    },
    metadataComp: {
      container: 'p-2',
      searchWrapper: 'w-full',
      dirtyWarning: 'flex text-sm italic items-center text-yellow-600',
      dirtyWarningIcon: 'text-yellow-500 cursor-pointer mx-1 size-6',
      fieldListScroll: 'max-h-[74dvh] overflow-auto scrollbar-sm',
      addFieldWrapper: 'w-full p-2',
      fieldRow: 'hover:bg-yellow-50 border-l-4 border-gray-200 hover:border-yellow-400 mb-1 px-2 pb-2 w-full flex flex-col',
      fieldRowEven: 'bg-white',
      fieldRowOdd: 'bg-slate-50',
      fieldHeader: 'flex items-center w-full gap-2',
      dragHandle: 'h-4 w-4 m-1 text-gray-600',
      dragHandleSvg: 'nc-icon cursor-move !h-3.75 text-gray-500 mr-1',
      fieldControls: 'w-full flex flex-wrap justify-between flex-col sm:flex-row items-stretch sm:items-center',
      advancedToggle: 'cursor-pointer p-2 text-gray-500 hover:text-gray-900 text-xl',
      advancedPanel: 'flex flex-col',
      advancedDescRow: 'flex flex-row justify-between items-center',
      inputWrapper: 'flex flex-col items-start',
      label: "text-sm font-light capitalize font-['Proxima_Nova'] text-gray-600",
      optionsWrapper: 'flex flex-col items-start w-full gap-1',
      optionsInner: 'w-full flex flex-col',
      optionsList: 'flex flex-row flex-wrap',
      optionTag: 'bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold px-1.5 py-1 m-1 flex no-wrap items-center rounded-md border border-red-200',
      optionTagLabel: 'hover:cursor-pointer',
      optionRemove: 'p-0.5 px-1 cursor-pointer',
      optionFormRow: 'w-full flex',
      deleteModalBorder: 'border border-red-500',
      deleteTitle: 'text-lg font-medium text-gray-900',
      deleteMessage: 'text-md font-medium text-gray-700 py-4 px-2',
      deleteButton: 'bg-red-500 text-white hover:bg-red-600',
      deleteWrapper: 'w-full text-end',
      mappedGrid: 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-1',
      metadataFieldTheme: 'pb-2 flex flex-col',
      customGrid4: 'grid grid-cols-4 gap-1',
      customGrid6: 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-1',
      metadataHeader: 'flex justify-between',
      addFieldRow: 'w-full flex flex-col sm:flex-row',
      addButton: 'p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md',
      addButtonError: 'p-2 bg-red-100 text-red-600 rounded-md',
      addButtonIcon: 'text-blue-600 px-1 size-6',
      addButtonContent: 'flex items-center',
    },
    validateComp: {
      container: 'flex flex-1 w-full flex-col bg-white border border-gray-200 rounded-lg shadow-sm relative text-md font-light leading-7 p-4',
      innerWrapper: 'w-full max-w-7xl mx-auto',
      headerRow: 'flex justify-between w-full',
      statGroup: 'flex gap-2 text-gray-500',
      statBox: 'bg-slate-50 border border-gray-200 rounded-md px-2 py-1',
      statValue: 'text-gray-900',
      revalidateButton: 'px-2 py-1 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md',
      revalidateButtonError: 'px-2 py-1 text-sm bg-red-50 hover:bg-red-100 text-red-600 rounded-md',
      sectionHeader: 'w-full flex items-center justify-between px-2 py-1 text-gray-500 bg-slate-50 border border-gray-200 rounded-md my-2',
      modalBackdrop: 'fixed inset-0 h-full w-full z-[100] content-center bg-black/40',
      modalPanel: 'w-3/4 h-1/2 overflow-auto scrollbar-sm flex flex-col gap-3 p-4 bg-white border border-gray-200 place-self-center rounded-lg shadow-xl',
      modalCloseRow: 'w-full flex justify-end',
      modalCloseButton: 'w-fit h-fit p-2 text-gray-500 hover:text-gray-900 border border-gray-200 rounded-full cursor-pointer',
      modalTitle: 'text-lg text-gray-900',
      modalBody: 'max-h-3/4 overflow-auto scrollbar-sm border border-gray-200 rounded-lg p-4',
      modalGridHeader: 'grid grid-cols-3 text-gray-700',
      modalGridRow: 'group grid grid-cols-3 items-center gap-y-1 rounded-md',
      modalGridRowOdd: 'bg-slate-50',
      modalInvalidBadge: 'mx-1 px-1 py-0.5 text-sm bg-red-50 text-red-500',
      modalUpdateButton: 'px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100',
      columnHeader: 'truncate select-none text-gray-700',
      columnHeaderWithErrors: 'truncate select-none min-w-[15px] text-gray-700',
      errorBadgeGroup: 'flex ml-1 gap-0.5 font-light',
      errorCount: 'flex px-1 py-0.5 text-xs bg-red-50 text-red-500 rounded-sm',
      filterToggle: 'flex place-items-center px-1 py-0.5 text-sm bg-blue-50 text-blue-700 rounded-sm',
    },
    sourceOverview: {
      title: "mt-1 pl-4 sm:pl-6 text-2xl text-blue-600 font-medium font-['Oswald'] overflow-hidden sm:mt-0 sm:col-span-3",
      body: 'flex flex-col md:flex-row',
      descriptionCol: 'w-full md:w-[70%] pl-4 py-2 sm:pl-6 flex justify-between group text-sm text-gray-500 pr-14',
      metadataCol: 'w-full md:w-[30%] flex flex-col gap-1',
      metaItem: 'flex flex-col px-4 text-sm text-gray-600',
      metaLabel: "text-sm font-['Proxima_Nova'] text-gray-500",
      metaValue: 'text-base font-medium text-blue-600',
      metaEditRow: 'flex justify-between group',
      metaEditInner: 'flex-1 flex flex-col px-4',
      pencilWrapper: 'hidden group-hover:block text-blue-500 cursor-pointer',
      pencilIcon: 'fad fa-pencil absolute -ml-4 p-2.5 rounded hover:bg-blue-500 hover:text-white',
      sectionHeader: 'flex items-center p-2 mx-4 text-blue-600 hover:bg-blue-50 rounded-md',
      sectionBadge: 'bg-yellow-50 text-yellow-700 text-xs p-1 ml-2 shrink-0 grow-0 rounded-lg flex items-center justify-center border border-yellow-200',
      tableWrapper: 'w-full p-4',
      columnName: "font-semibold font-['Proxima_Nova'] text-gray-800",
      columnActualName: 'text-xs font-normal text-gray-400',
      columnType: 'font-light italic text-gray-500',
      seeMoreLink: 'w-fit ml-auto mt-1 px-2 py-0.5 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded cursor-pointer transition-colors',
      versionsWrapper: 'w-full p-4',
      downloadLink: 'text-sm text-blue-600 hover:text-blue-800 hover:underline',
      downloadUnavailable: 'text-sm text-gray-400 italic',
    },
    sourcePage: {
      pageWrapper: 'max-w-6xl mx-auto w-full',
      tabBar: 'w-full flex justify-between items-end pl-4 border-b border-gray-200',
      tabNav: 'w-full flex',
      tab: "px-3 py-2 font-['Proxima_Nova'] font-medium text-sm text-gray-500 border-b-2 -mb-px",
      tabActive: 'border-yellow-400 text-gray-900',
      tabInactive: 'border-transparent hover:border-gray-300 hover:text-gray-700',
    },
    createPage: {
      pageWrapper: 'max-w-4xl mx-auto w-full',
      heading: "text-2xl font-medium text-gray-900 font-['Oswald']",
      form: 'flex flex-col gap-4 mt-4',
      fieldLabel: "text-sm font-medium font-['Proxima_Nova'] text-gray-700",
      actions: 'flex gap-2 mt-2',
      externalWrapper: 'mt-6',
    },
    settingsPage: {
      pageWrapper: 'max-w-5xl mx-auto w-full',
      heading: "text-2xl font-medium text-gray-900 font-['Oswald']",
      searchWrapper: 'my-4',
      columnsWrapper: 'flex flex-col sm:flex-row gap-4',
      column: 'flex-1 border border-gray-200 rounded-lg p-3 bg-slate-50',
      columnLabel: "text-sm font-medium font-['Proxima_Nova'] text-gray-700",
      columnHint: 'text-xs italic text-gray-500 ml-1',
      categoryList: 'flex flex-wrap gap-1 mt-2 max-h-[70vh] overflow-auto',
      categoryButton: 'bg-white hover:bg-gray-50 px-3 py-1.5 rounded-md flex items-center gap-2 text-sm text-gray-700 border border-gray-200',
      categoryCount: 'bg-yellow-50 text-yellow-600 text-xs w-5 h-5 shrink-0 rounded-full flex items-center justify-center',
      emptyMessage: 'text-gray-400 text-sm italic p-2',
    },
  },
  "widgets": {
    "LogoNav": { "label": "Logo Nav", component: LogoNav },
    "QuickLinks": { "label": "Quick Links", component: QuickLinks }
  }
}

export default theme
