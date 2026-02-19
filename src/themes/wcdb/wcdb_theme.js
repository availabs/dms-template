import { NavLeftStyleWidget, NavRightStyleWidget } from './widgets'

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
                  "type": "NavLeftStyleWidget"
                },
                {
                    "type": "Logo"
                }
            ],
            "rightMenu": [
                {
                    "type": "UserMenu"
                },
                {
                    "type": "NavRightStyleWidget"
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
              "centerMenuContainer": "hidden lg:flex items-center flex-1 h-full overflow-visible gap-1 px-2 bg-[#0e1011]",
              "rightMenuContainer": "hidden md:flex h-full items-center pr-4 bg-[#0e1011]  rounded-br-[28px]",
              "mobileNavContainer": "px-4 py-2 bg-zinc-100 dark:bg-zinc-900",
              "mobileButton": "lg:hidden inline-flex items-center justify-center p-2 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors",
              "menuOpenIcon": "Menu",
              "menuCloseIcon": "XMark",
              "navitemWrapper": "relative",
              "navitemWrapper_level_2": "relative",
              "navitemWrapper_level_3": "",
              "navitem": `group px-1 py-2 text-[14px] font-medium   text-white transition-all duration-300 ease-in-out
                 transition-colors cursor-pointer
                 flex items-center gap-1.5  hover:text-underline`,
              "navitemActive" : `px-1 py-2 text-[14px] font-medium  text-white transition-all duration-300 ease-in-out
                 transition-colors cursor-pointer
                 flex items-center gap-1.5`,
              "navIcon": "size-4 text-zinc-500 dark:text-zinc-400",
              "navIconActive": "size-4 text-zinc-900 dark:text-white",
              "navitemContent": "bg-left-bottom bg-gradient-to-r from-white to-slate-300 bg-[length:0%_2px] bg-no-repeat group-hover:bg-[length:100%_2px] transition-all duration-500 ease-out",
              "navitemName": "",
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
  },
  "logo":{
    logoWrapper: 'items-center',
    logoAltImg: '',
    imgWrapper: 'pt-1 pl-4',
    img: '/themes/wcdb/logo_white.svg',
    imgClass: 'h-12',
    titleWrapper: '',
    title: '',
    linkPath: '/'
  },
  "pages": {
    "userMenu": {
      "options": {
        "activeStyle": 0
      },
      "styles": [
        {
          name: 'default',
          // UserMenu component
          userMenuContainer: 'flex flex-1 w-full items-center justify-center rounded-xl min-w-[60px] @container',
          avatarWrapper: 'flex p-2 justify-center items-center',
          avatar: 'size-8 border border-[#E0EBF0] rounded-full place-items-center content-center hover:bg-slate-400',
          avatarIcon: 'size-6 fill-[#37576b]',
          infoWrapper: 'flex-1 py-2 @max-[150px]:hidden',
          emailText: 'text-xs font-thin tracking-tighter text-left',
          groupText: 'text-xs font-medium -mt-1 tracking-widest text-left',

          // EditControl component
          editControlWrapper: 'flex justify-center items-center py-2 pr-2',
          iconWrapper: 'size-9 flex items-center justify-center',
          icon: 'text-slate-400 hover:text-blue-500 size-7',
          viewIcon: 'ViewPage',
          editIcon: 'EditPage',

          // Login/Auth section
          loginWrapper: 'flex items-center justify-center py-2',
          loginLink: 'flex items-center',
          loginIconWrapper: 'size-8 place-items-center content-center border border-[#E0EBF0] rounded-full hover:bg-slate-400',
          loginIcon: 'size-6 stroke-slate-500 text-slate-500',
          loginText: 'hidden',
          authContainer: '@container w-full  min-w-[80px]',
          authWrapper: 'flex items-center justify-center ',
          userMenuWrapper: 'flex items-center flex-1 w-full',
        }
      ]
    }
  },
  "widgets": {
    "NavRightStyleWidget": { "label": "Nav Right Style", component: NavRightStyleWidget },
    "NavLeftStyleWidget": { "label": "Nav Left Style", component: NavLeftStyleWidget }
  }
}
export default theme
