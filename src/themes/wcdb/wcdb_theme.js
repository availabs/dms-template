const theme = {
  "layout": {
    "styles": [
        {
            "outerWrapper": "bg-[#0e1011]",
            "wrapper": "relative isolate flex min-h-svh w-full max-lg:flex-col",
            "wrapper2": "flex-1 flex items-start flex-col items-stretch max-w-full min-h-screen",
            "wrapper3": "flex flex-1 items-start",
            "childWrapper": "flex-1 flex flex-col md:grid md:grid-cols-2"
        }
    ],
    "options": {
        "topNav": {
            "nav": "main",
            "size": "compact",
            "leftMenu": [
                {
                    "type": "Logo"
                }
            ],
            "rightMenu": [
                {
                    "type": "UserMenu"
                }
            ],
            "activeStyle": null
        },
        "sideNav": {
            "nav": "main",
            "size": "none",
            "topMenu": [],
            "bottomMenu": [],
            "activeStyle": null
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
        ],
        "activeStyle": 0
    }
  },
  "layoutGroup": {
      "options": {
          "activeStyle": 0
      },
      "styles": [
          {
              "name": "content",
              "wrapper1": "w-full flex-1 flex flex-row p-2 ",
              "wrapper2": "flex flex-1 w-full  flex-col  shadow-md bg-[#1f2122] rounded-[18px] relative text-md font-light leading-7 p-4 min-h-[200px]",
              "wrapper3": ""
          },
          {
              "name": "header",
              "wrapper1": "w-full flex-1 sticky h-screen top-0 flex flex-row row-span-12 p-2",
              "wrapper2": "rounded-[18px] h-full overflow-hidden",
              "wrapper3": "rounded-[18px]"
          }
      ]
  },
  "topnav":{
      "options": {
          "activeStyle": 0,
          "maxDepth": 2
      },
      "styles": [
          {
              "name": "catalyst",
              "layoutContainer1": "fixed top-0 z-50",
              "layoutContainer2": "w-full",
              "topnavWrapper": "w-full h-14 flex items-center",
              "topnavContent": "flex items-center w-full h-full ",
              "leftMenuContainer": "flex items-center bg-[#0e1011] h-14",
              "centerMenuContainer": "hidden lg:flex items-center flex-1 h-full overflow-visible gap-1 px-4 bg-[#0e1011]",
              "rightMenuContainer": "hidden md:flex h-full items-center gap-2 min-w-[119px] bg-[#0e1011] rounded-br-[18px]",
              "mobileNavContainer": "px-4 py-2 bg-zinc-100 dark:bg-zinc-900",
              "mobileButton": "lg:hidden inline-flex items-center justify-center p-2 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors",
              "menuOpenIcon": "Menu",
              "menuCloseIcon": "XMark",
              "navitemWrapper": "relative",
              "navitemWrapper_level_2": "relative",
              "navitemWrapper_level_3": "",
              "navitem": "\n        px-3 py-2 rounded-lg\n        text-sm font-medium text-zinc-600 dark:text-zinc-400\n        hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white\n        transition-colors cursor-pointer\n        flex items-center gap-1.5\n    ",
              "navitemActive": "\n        px-3 py-2 rounded-lg\n        text-sm font-medium text-zinc-900 dark:text-white\n        bg-zinc-200 dark:bg-zinc-800\n        cursor-pointer\n        flex items-center gap-1.5\n    ",
              "navIcon": "size-4 text-zinc-500 dark:text-zinc-400",
              "navIconActive": "size-4 text-zinc-900 dark:text-white",
              "navitemContent": "flex items-center gap-1.5",
              "navitemName": "",
              "navitemName_level_2": "w-full text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white py-2 px-3 rounded-md transition-colors flex items-center justify-between gap-2",
              "navitemName_level_3": "w-full text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white py-2 px-3 rounded-md transition-colors",
              "navitemDescription": "hidden",
              "navitemDescription_level_2": "text-xs text-zinc-500 dark:text-zinc-400 mt-0.5",
              "navitemDescription_level_3": "text-xs text-zinc-500 dark:text-zinc-400 mt-0.5",
              "indicatorIconWrapper": "size-4 text-zinc-400",
              "indicatorIcon": "ChevronDown",
              "indicatorIconOpen": "ChevronDown",
              "subMenuWrapper": "absolute top-full left-0 mt-2 z-50",
              "subMenuWrapper2": "bg-white dark:bg-zinc-900 rounded-xl shadow-lg ring-1 ring-zinc-950/5 dark:ring-white/10 py-1 min-w-[200px]",
              "subMenuWrapper_level_2": "absolute left-full top-0 ml-2 z-50",
              "subMenuWrapper2_level_2": "bg-white dark:bg-zinc-900 rounded-xl shadow-lg ring-1 ring-zinc-950/5 dark:ring-white/10 py-1 min-w-[200px]",
              "subMenuItemsWrapper": "flex flex-col",
              "subMenuItemsWrapperParent": "flex flex-col",
              "subMenuParentWrapper": "hidden",
              "subMenuParentContent": "px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 mb-1",
              "subMenuParentName": "text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide",
              "subMenuParentDesc": "text-xs text-zinc-400 dark:text-zinc-500 mt-0.5",
              "subMenuParentLink": "text-xs text-zinc-900 dark:text-white hover:underline mt-1 inline-block"
          }
      ]
  }
}
export default theme
