import { Icons } from "./icons";


const theme = {
  // -------------------- Layout ------------------------
  layout: {
    "options": {
      "activeStyle": 0,
      "sideNav": {
        "size": "compact",
        "nav": "main",
        "activeStyle": null,
        "navDepth": "2",
        "navTitle": "flex-1 text-[24px] font-['Oswald'] font-[500] leading-[24px] text-[#2D3E4C] py-3 px-4 uppercase",
        "topMenu": [],
        "bottomMenu": []
      },
      "topNav": {
        "size": "compact",
        "nav": "main",
        "leftMenu": [{ type: "Logo" }],
        "rightMenu": [{ type: "SearchButton" }, { type: "UserMenu" }]
      }
    },
    "styles": [{
      outerWrapper: "bg-[linear-gradient(0deg,rgba(244,244,244,0.96),rgba(244,244,244,0.96)),url('/themes/mny/topolines.png')]  bg-[size:500px]",
      wrapper: "max-w-[1440px] mx-auto",
      wrapper2: "flex-1 flex items-start flex-col items-stretch max-w-full",
      wrapper3: "flex flex-1 md:px-4 xl:px-[64px]",
      childWrapper: "h-full flex-1",
    }],
  },
  "sidenav": {
    "options": {
      "activeStyle": "0",
    },
    "styles": [
      {
        "layoutContainer1": "pr-2  hidden lg:block min-w-[302px] max-w-[302px] pt-[88px]  print:hidden ",
        "layoutContainer2": "hidden scrollbar-sm lg:block sticky top-[120px] h-[calc(100vh_-_125px)] bg-white rounded-lg shadow-md w-full overflow-y-auto overflow-x-hidden mt-8",
        "logoWrapper": "bg-neutral-100 text-slate-800",
        "sidenavWrapper": "hidden md:flex bg-white w-full h-full z-20  flex-col pr-5",
        "menuItemWrapper": " flex-1 flex flex-col flex flex-col",
        "menuItemWrapper_level_1": "pl-8",
        "menuItemWrapper_level_2": "",
        "menuItemWrapper_level_3": "",
        "menuItemWrapper_level_4": "",
        "menuIconSide": "hidden size-8 text-[#37576B]",
        "menuIconSideActive": "hidden size-8 text-[#37576B]",
        "itemsWrapper": "border-slate-200 py-6 flex-1",
        "navItemContent": "transition-transform duration-300 ease-in-out flex-1 w-full",
        "navItemContent_level_1": "pl-1 text-[16px] font-['Oswald'] font-[500] leading-[16px]  text-[#2D3E4C] py-3 uppercase",
        "navItemContent_level_2": `text-[16px] font-['Proxima_Nova'] font-[600] leading-[19.2px] text-[#37576B] pl-4 py-3`,
        "navItemContent_level_3": `text-[14px] font-['Proxima_Nova'] font-[400] leading-[19.6px] text-[#37576B] pl-4 py-2`,
        "navItemContent_level_4": `text-[14px] font-['Proxima_Nova'] font-[400] leading-[19.6px] text-[#37576B] pl-4 py-2`,
        "navitemSide": "w-full md:flex-1  group flex flex-col border-white focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300        transition-all cursor-pointer",
        "navitemSideActive": " w-full md:flex-1 group  flex flex-col focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300        transition-all cursor-pointer border-l-2 border-slate-600       ",
        "indicatorIcon": "ArrowRight",
        "indicatorIconOpen": "ArrowDown",
        "bottomMenuWrapper": "",
        "topnavWrapper": "w-full h-[50px] flex items-center pr-1",
        "topnavContent": "flex items-center w-full h-full bg-white lg:bg-zinc-100 dark:bg-zinc-900 dark:lg:bg-zinc-950 justify-between",
        "topnavMenu": "hidden  lg:flex items-center flex-1  h-full overflow-x-auto overflow-y-hidden scrollbar-sm",
        "topmenuRightNavContainer": "hidden md:flex h-full items-center",
        "topnavMobileContainer": "bg-slate-50",
        "topNavWrapper": "flex flex-row md:flex-col p-2",
        "indicatorIconWrapper": "text-[#37576B] size-4",
        "subMenuParentWrapper": "flex w-full",
        "subMenuOuterWrapper":"",
        "subMenuWrapperChild": "flex flex-col",
        "subMenuWrapperTop": "",
        //"subMenuWrapper_1": "pl-2 w-full",
        "subMenuWrapper_1": "w-full bg-[#F3F8F9] rounded-[12px] py-[12px]",
        "subMenuWrapper_2":"w-full bg-[#E0EBF0]"

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
        "subMenuWrapperChild": "flex flex-col",
        "subMenuWrapperTop": "",
        "name": "small"
      }
    ]
  },
  "topnav": {
    "options": {
      "activeStyle": "0",
      "maxDepth": "1"
    },
    "styles": [{
      "layoutContainer1": `print:hidden`,
      "layoutContainer2": `fixed top-0 z-20 max-w-[1440px] left-50% -translate-50% w-full md:px-4 md:pt-[32px] xl:px-[64px] pointer-events-none`,
      "topnavWrapper": `px-[24px] py-[16px] w-full bg-white h-20 flex items-center md:rounded-lg shadow pointer-events-auto relative`,
      "topnavContent": `flex items-center w-full h-full  max-w-[1400px] mx-auto `,
      "leftMenuContainer": '',
      "centerMenuContainer": `hidden md:flex items-center flex-1 h-full overflow-x-auto overflow-y-hidden scrollbar-sm`,
      "rightMenuContainer": "hidden md:flex h-full items-center justify-end  min-w-[110px]",
      "mobileNavContainer": "bg-white pointer-events-auto h-[calc(100vh_-_80px)] overflow-y-auto",
      "mobileButtonContainer": "flex flex-1 justify-end content-end md:hidden",
      "mobileButton": `md:hidden inline-flex items-center justify-center border-3 rounded-full border-[#E0EBF0] size-8`,
      "menuOpenIcon": `BarsMenu`,
      "menuCloseIcon": `XMark`,

      // Menu Item Styles
      "navitemWrapper": "",
      "navitemWrapper_level_2": 'bg-[#F3F8F9] p-4 rounded-lg',
      "navitem": `
          md:w-fit group  whitespace-nowrap
          text-[16px] font-['Proxima_Nova'] font-[500] text-[#37576B]
          px-2
          focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300
          transition cursor-pointer
      `,
      "navitemActive": `w-fit group  whitespace-nowrap
        text-[16px] font-['Proxima_Nova'] font-[500] text-[#37576B]
        px-2 text-blue
        focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300
        transition cursor-pointer
      `,
      "navitemContent": "flex-1 flex items-center gap-[2px]",
      "navIcon": `text-[#37576B]  size-6`,
      "navIconActive": `text-[#37576B] items-center text-lg`,
      "navitemDescription":"hidden",
      "navitemDescription_level_2": `text-[16px] font-['Proxima_Nova'] font-[400] text-[#37576B] text-wrap`,
      "navitemName_level_1": "",
      "navitemName_level_2": "uppercase font-[Oswald] text-[14px] flex items-center p-1",

      "indicatorIconWrapper": "size-3",
      "indicatorIcon": "ArrowDown",
      "indicatorIconOpen": "ArrowDown",


      // SubMenu Styles
      "subMenuWrapper":"absolute left-0 right-0 normal-case z-10 px-4 -mx-[15px] pt-[34px] cursor-default",
      "subMenuWrapper2": `bg-white flex items-stretch rounded-lg p-4 shadow`,
      "subMenuParentContent": "basis-1/3  text-wrap pr-[64px]",
      "subMenuParentName": `text-[36px] font-['Oswald'] font-500 text-[#2D3E4C] uppercase pb-2`,
      "subMenuParentDesc": `text-[16px] font-['Proxima_Nova'] font-[400] text-[#37576B]`,
      "subMenuParentLink": `w-fit h-fit cursor-pointer uppercase border boder-[#E0EBF0] bg-white hover:bg-[#E0EBF0] text-[#37576B] font-[700] leading-[14.62px] rounded-full text-[12px] text-center py-[16px] px-[24px]`,
      "subMenuItemsWrapperParent": "grid grid-cols-2 gap-1 flex-1",
      "subMenuItemsWrapper": "grid grid-cols-4 flex-1"
    }
    ]
  },
  layoutGroup: {
    options: {
      activeStyle: 0
    },
    styles: [
      {
        name: "default",
        wrapper1: "w-full h-full flex-1 flex flex-row pt-2", // inside page header, wraps sidebar
        wrapper2:
          "flex flex-1 w-full  flex-col  shadow-md bg-white rounded-lg relative text-md font-light leading-7 p-4 h-full min-h-[200px]", // content wrapepr
        wrapper3:""
      },
      {
        name: "content",
        wrapper1: "w-full h-full flex-1 flex flex-row lg:pt-[118px] pb-[5px]", // inside page header, wraps sidebar
        wrapper2:
          "flex flex-1 w-full  flex-col  shadow-md bg-white rounded-lg relative text-md font-light leading-7 p-4 h-full min-h-[calc(100vh_-_102px)]", // content wrapepr
        wrapper3: ""
      },
      {
        name: "darkSection",
        wrapper1: `w-full h-full flex-1 flex flex-row -my-8 py-10 bg-[linear-gradient(0deg,rgba(33,52,64,.96),rgba(55,87,107,.96)),url('/themes/mny/topolines.png')]  bg-[size:500px] pb-[4px]`, // inside page header, wraps sidebar
        wrapper2: "max-w-[1440px]  xl:px-[64px] md:px-4 mx-auto",
        wrapper3:
          "flex flex-1 w-full  flex-col  relative text-md font-light leading-7 p-4 h-full min-h-[200px]", // content wrapepr
      },
      {
        name: "lightCentered",
        wrapper1: `w-full h-full flex-1 flex flex-row pb-[4px] `, // inside page header, wraps sidebar
        wrapper2: "max-w-[1440px]  xl:px-[64px] md:px-4 mx-auto",
        wrapper3:
          "flex flex-1 w-full  shadow-md bg-white rounded-lg  flex-col  relative text-md font-light leading-7 p-4 h-full min-h-[200px]", // content wrapepr
      },
      {
        name: "clearCentered",
        wrapper1: `w-full h-full flex-1 flex flex-row -mt-3`, // inside page header, wraps sidebar
        wrapper2: "max-w-[1440px] w-full xl:px-[48px] mx-auto",
        wrapper3: "flex flex-1 w-full flex-col relative h-full min-h-[200px]", // content wrapepr
      },
      {
        name: "header",
        wrapper1: "w-full h-full flex-1 flex flex-row", // inside page header, wraps sidebar
        wrapper2: "flex flex-1 w-full  flex-col  relative min-h-[200px]", // content wrapepr
        wrapper3: ""
      },
    ]
  },
  // ----------------------- End Layout ------------------------
  // Pages Pattern
  // ------------------
  pages: {
    sectionArray: {
      "options": {
        "activeStyle": 0
      },
      "styles": [
        {
          container: "w-full grid grid-cols-6 md:grid-cols-12 ",
          gridSize: 12,
          layouts: {
            centered: "max-w-[1020px] mx-auto  px-0 lg:px-[56px]",
            fullwidth: "",
          },
          sizes: {
            "1/4": { className: "col-span-6 md:col-span-3", iconSize: 25 },
            "1/3": { className: "col-span-6 md:col-span-4", iconSize: 33 },
            "1/2": { className: "col-span-6 md:col-span-6", iconSize: 50 },
            "2/3": { className: "col-span-6 md:col-span-8", iconSize: 66 },
            1: { className: "col-span-6 md:col-span-9", iconSize: 75 },
            2: { className: "col-span-6 md:col-span-12", iconSize: 100 },
          },
        }
      ]
    }
  },
  pageOptions: {
    settingsPane: [
      {
        type: "Select",
        label: "Page Background",
        location: "theme.page.container",
        default: "",
        options: [
          {
            label: "Default",
            value: `bg-[linear-gradient(0deg,rgba(244,244,244,0.96),rgba(244,244,244,0.96)),url('/themes/mny/topolines.png')]  bg-[size:500px] pb-[4px]`,
          },
          {
            label: "Blue",
            value: `bg-[linear-gradient(0deg,rgba(33,52,64,.96),rgba(55,87,107,.96)),url('/themes/mny/topolines.png')] bg-[size:500px] pb-[4px]`,
          },
          {
            label: "Yellow",
            value: `bg-[linear-gradient(0deg,rgba(252,246,236,.96),rgba(252,246,236,.96)),url('/themes/mny/topolines.png')] bg-[size:500px] pb-[4px]`,
          },
        ],
      },
      {
        type: "Select",
        label: "Show in Footer",
        location: "navOptions.show_in_footer",
        default: "",
        options: [
          { label: "No", value: "" },
          { label: "Yes", value: `show` },
        ],
      },
    ],
  },
  logo: {
    logoWrapper: "",
    logoAltImg: "",
    imgWrapper: "h-12 pl-3 pr-2 flex items-center",
    img: "https://mitigateny.org/themes/mny/mnyLogo.svg",
    titleWrapper: "",
    title: "",
    linkPath: "/",
  },
  heading: {
    base: "p-2 w-full font-sans font-medium text-md bg-transparent",
    1: `font-[500]  text-[#2D3E4C] text-[36px] leading-[140%] tracking-[-.02em] font-[500] underline-offset-8 underline decoration-4 decoration-[#EAAD43] uppercase font-['Oswald'] pb-[12px]`,
    2: `font-[500]  text-[#2D3E4C] text-[24px] leading-[24px] scroll-mt-36 font-['Oswald'] pb-[12x]`,
    3: `font-[500]  text-[#2D3E4C] text-[16px] leading-[16px] scroll-mt-36 font-['Oswald'] pb-[12x]`,
    4: `text-[36px] sm:text-[48px] tracking-[-2px] items-center font-medium font-['Oswald'] text-[#2D3E4C] sm:leading-[100%] uppercase`,
    default: "",
  },
  levelClasses: {
    1: " pt-2 pb-1 uppercase text-sm text-blue-400 hover:underline cursor-pointer border-r-2 mr-4",
    2: "pl-2 pt-2 pb-1 uppercase text-sm text-slate-400 hover:underline cursor-pointer border-r-2 mr-4",
    3: "pl-4 pt-2 pb-1 text-sm text-slate-400 hover:underline cursor-pointer border-r-2 mr-4",
    4: "pl-6 pt-2 pb-1 text-sm text-slate-400 hover:underline cursor-pointer border-r-2 mr-4",
  },





  pageControls: {
    controlItem:
      "pl-6 py-0.5 text-md cursor-pointer hover:text-blue-500 text-slate-400 flex items-center",
    select:
      "bg-transparent border-none rounded-sm focus:ring-0 focus:border-0 pl-1",
    selectOption:
      "p-4 text-md cursor-pointer hover:text-blue-500 text-slate-400 hover:bg-blue-600",
  },
  navPadding: {
    1: "",
    2: "",
    3: "",
  },

  table: {
    tableContainer:
      "relative flex flex-col w-full h-full overflow-x-auto scrollbar-sm border rounded-t-[12px]",
    tableContainerNoPagination: "rounded-b-[12px]",
    tableContainer1:
      "flex flex-col no-wrap min-h-[200px] max-h-[calc(78vh_-_10px)] overflow-y-auto scrollbar-sm",
    headerContainer: "sticky top-0 grid ",
    thead: "flex justify-between",
    theadfrozen: "",
    thContainer:
      "w-full font-[500] py-4 pl-4 pr-0 font-[Oswald] text-[12px] uppercase text-[#2d3e4c] border-x",
    thContainerBg: "bg-[#F3F8F9] text-gray-900",
    thContainerBgSelected: "bg-gray-50 text-gray-900",
    cell: "relative flex items-center min-h-[36px]  border border-slate-50",
    cellInner: `
          w-full min-h-full flex flex-wrap items-center truncate py-1 px-2
          font-['Proxima_Nova'] font-[400] text-[14px] text-[#37576B] leading-[20px]
      `,
    cellBg: "bg-white",
    cellBgSelected: "bg-blue-50",
    cellFrozenCol: "",
    paginationContainer:
      "w-full p-2 rounded-b-[12px] bg-[#F3F8F9] flex items-center justify-between",
    paginationInfoContainer: "",
    paginationPagesInfo:
      "font-[500] font-[Oswald] text-[12px] uppercase text-[#2d3e4c] leading-[18px]",
    paginationRowsInfo: "text-xs font-[Proxima Nova] leading-[14px]",
    paginationControlsContainer:
      "flex flex-row items-center border rounded-[8px] overflow-hidden",
    pageRangeItem:
      "cursor-pointer px-[12px]  py-[7px] font-[Oswald] font-[500] text-[12px] border-r last:border-none uppercase leading-[18px]",
    pageRangeItemInactive: "bg-white text-[#2D3E4C]",
    pageRangeItemActive: "bg-[#2D3E4C] text-white",
    openOutContainer:
      "w-[420px] overflow-auto scrollbar-sm flex flex-col gap-[12px] p-[16px] bg-white h-full float-right",
    openOutContainerWrapper: "absolute inset-0 right-0 h-full w-full z-[100]",
    openOutHeader:
      "font-semibold font-[Proxima Nova] text-[#37576B] text-[14px] leading-[17.05px]",
    openOutValue:
      "font-normal font-[Proxima Nova] text-[#37576B] text-[14px] leading-[19.6px]",
    openOutTitle:
      "font-medium font-[Oswald] text-[24px] leading-[100%] uppercase text-[#2D3E4C]",
  },
  attribution: {
    wrapper: "w-full flex flex-col gap-[4px] text-[#2D3E4C] text-xs",
    label: "font-semibold text-[12px] leading-[14.62px] border-t pt-[14px]",
    link: "font-normal leading-[14.62px] text-[12px] underline",
  },
  label: {
    labelWrapper:
      "w-full px-[12px] pt-[9px] pb-[7px] bg-[#C5D7E0] hover:bg-[#E0EBF0] group rounded-[1000px]",
    labelWrapperDisabled:
      "px-[12px] pt-[9px] pb-[7px] bg-[#F3F8F9] group rounded-[1000px]",
    label: "text-[12px] text-[#37576B] font-bold leading-[14.62px]",
    labelDisabled: "text-[12px] text-[#C5D7E0] font-bold leading-[14.62px]",
  },
  dataCard: {
    styles: [
      {
        columnControlWrapper:
            "grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-x-1 gap-y-0.5",
        columnControlHeaderWrapper: `px-1 font-semibold border bg-gray-50 text-gray-500`,

        mainWrapperCompactView: "grid",
        mainWrapperSimpleView: "flex flex-col",
        subWrapper: "w-full text-[#2D3E4C]",
        subWrapperCompactView: "flex flex-col flex-wrap rounded-[12px]",
        subWrapperSimpleView: "grid",

        headerValueWrapper:
            "w-full rounded-[12px] flex items-center gap-[4px] justify-center p-2",
        headerValueWrapperCompactView: "rounded-none ",
        headerValueWrapperBorderBelow: "border-b border-[#C0D8E1] rounded-none", // custom added border
        headerValueWrapperSimpleView: "",
        itemBorder: 'border shadow',
        itemFlexCol: 'flex-col',
        itemFlexRow: 'flex-row',
        itemFlexColReverse: 'flex-col flex-col-reverse',
        itemFlexRowReverse: 'flex-row flex-row-reverse',
        iconAndColorValues: 'flex items-center gap-1.5 uppercase',

        formEditButtonsWrapper: 'self-end flex gap-0.5 text-sm',
        formEditSaveButton: 'bg-blue-300 hover:bg-blue-400 text-blue-700 rounded-lg w-fit px-2 py-0.5',
        formEditCancelButton: 'bg-red-300 hover:bg-red-400 text-red-700 rounded-lg w-fit px-2 py-0.5',
        formAddNewItemButton: 'bg-blue-300 hover:bg-blue-400 text-blue-700 rounded-lg w-fit px-2 py-0.5 text-sm self-end',

        linkColValue:
            "flex-1 flex justify-center w-full bg-[#C5D7E0] rounded-full px-[12px] py-[8px] font-[Proxima Nova] font-bold text-[12px] leading-[100%] tracking-[0px] uppercase",
        justifyTextLeft: "text-start justify-items-start",
        justifyTextRight: "text-end justify-items-end",
        justifyTextCenter: "text-center justify-items-center",
        textXS: "font-medium font-[Oswald] text-[12px] leading-[140%]",
        textXSReg:
            "font-normal font-[Proxima Nova] text-[12px] leading-[100%] uppercase",
        textSM: "font-medium font-[Oswald] text-[14px] leading-[100%] uppercase",
        textSMReg: "font-normal font-[Proxima Nova] text-[14px] leading-[140%]",
        textSMBold: "font-normal font-[Proxima Nova] text-[14px] leading-[140%]",
        textSMSemiBold:
            "font-semibold font-[Proxima Nova] text-[14px] leading-[140%]",
        textMD: "font-medium font-[Oswald] text-[16px] leading-[100%] uppercase",
        textMDReg: "font-normal font-[Proxima Nova] text-[16px] leading-[140%]",
        textMDBold: "font-bold font-[Proxima Nova] text-[16px] leading-[140%]",
        textMDSemiBold:
            "font-semibold font-[Proxima Nova] text-[16px] leading-[140%]",
        textXL: "font-medium font-[Oswald] text-[20px] leading-[100%] uppercase",
        textXLSemiBold:
            "font-semibold font-[Proxima Nova] text-[20px] leading-[120%]",
        text2XL: "font-medium font-[Oswald] text-[24px] leading-[100%] uppercase",
        text2XLReg:
            "font-regular font-[Oswald] text-[24px] leading-[120%] uppercase",
        text3XL:
            "font-medium font-[Oswald] text-[30px] leading-[100%] uppercase tracking-[-0.05em]",
        text3XLReg:
            "font-normal font-[Oswald] text-[30px] leading-[120%] uppercase",
        text4XL:
            "font-medium font-[Oswald] text-[36px] leading-[100%] uppercase tracking-[-0.05em]",
        text5XL:
            "font-medium font-[Oswald] text-[48px] leading-[100%] uppercase tracking-[-0.05em]",
        text6XL: "font-medium font-[Oswald] text-[60px] leading-[100%] uppercase",
        text7XL:
            "font-medium font-[Oswald] text-[72px] leading-[100%] uppercase tracking-normal",
        text8XL:
            "font-medium font-[Oswald] text-[96px] leading-[95%] uppercase tracking-normal ",

        imgXS: "max-w-16 max-h-16",
        imgSM: "max-w-24 max-h-24",
        imgMD: "max-w-32 max-h-32",
        imgXL: "max-w-40 max-h-40",
        img2XL: "max-w-48 max-h-48",
        img3XL: "max-w-56 max-h-56",
        img4XL: "max-w-64 max-h-64",
        img5XL: "w-full",
        img6XL: "max-w-80 max-h-80",
        img7XL: "max-w-96 max-h-96",
        img8XL: "max-w-128 max-h-128",
        imgDefault: 'max-w-[50px] max-h-[50px]',

        header: "w-full flex-1 uppercase text-[#37576B]",
        headerCompactView: "",
        headerSimpleView: "",
        value: "w-full text-[#2D3E4C]",
        valueWrapper: 'min-h-[20px]',
        valueCompactView: "",
        valueSimpleView: "",
        description: "text-[#2D3E4C] font-light normal-case font-[Oswald] text-[12px]",

        componentWrapper: 'w-full',
      }
    ]
  },
  filters: {
    filtersWrapper: "w-full flex flex-col rounded-md",
    filterLabel:
      "py-0.5 font-[Proxima Nova] font-regular text-[14px] text-[#2D3E4C] leading-[140%] tracking-[0px] capitalize text-balance",
    loadingText: "pl-0.5 font-thin text-[#2D3E4C]",
    filterSettingsWrapperInline: "w-2/3",
    filterSettingsWrapperStacked: "w-full",
    labelWrapperInline: "w-1/3 text-xs",
    labelWrapperStacked: "w-full text-xs",
    input:
      "w-full max-h-[150px] flex rounded-[12px] px-[10px] py-[4px] gap-[6px] text-[14px] text-[#37576B] border leading-[140%] tracking-[0px] bg-white overflow-auto scrollbar-sm text-nowrap",
    settingPillsWrapper: "flex flex-row flex-wrap gap-1",
    settingPill:
      "px-1 py-0.5 bg-orange-500/15 text-orange-700 hover:bg-orange-500/25 rounded-md",
    settingLabel: "text-gray-900 font-regular min-w-fit",
  },
  graph: {
    text: "text-[#2D3E4C] font-[Oswald] font-semibold text-[12px] leading-[100%] tracking-[0px] uppercase",
    darkModeText:
      "bg-transparent text-white font-[Oswald] font-semibold text-[12px] leading-[100%] tracking-[0px] uppercase",
    headerWrapper:
      "grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-x-1 gap-y-0.5",
    columnControlWrapper: `px-1 font-semibold border bg-gray-50 text-gray-500`,
    scaleWrapper:
      "flex rounded-[8px] divide-x border w-fit border-[#E0EBF0] overflow-hidden",
    scaleItem:
      "px-[12px] py-[7px] font-[Oswald] font-medium text-[12px] text-[#2D3E4C] text-center leading-[100%] tracking-[0px] uppercase cursor-pointer",
    scaleItemActive: "bg-white",
    scaleItemInActive: "bg-[#F3F8F9]",
  },
  icon: {
    icon: "text-slate-400 hover:text-blue-500 size-4",
  },
  lexical: {
    // MNY theme uses options/styles pattern with flat keys
    // The default style (0) contains MNY-branded defaults
    // Additional styles available: Inline Guidance, Annotation, etc.
    options: { activeStyle: 0 },
    styles: [
      {
        // Style 0: Default (mny branded)
        name: "default",
        contentEditable: "border-none relative [tab-size:1] outline-0",
        editorScroller: "min-h-[150px] border-0 flex relative outline-0 z-0 resize-y",
        viewScroller: "border-0 flex relative outline-0 z-0 resize-none",
        editorContainer: "relative block rounded-[10px] min-h-[50px]",
        editorShell: "font-['Proxima_Nova'] font-[400] text-[16px] text-[#37576B] leading-[22.4px]",
        card: "p-[12px] shadow-[0px_0px_6px_0px_rgba(0,0,0,0.02),0px_2px_4px_0px_rgba(0,0,0,0.08)]",
        paragraph: "m-0 relative",
        quote: "m-0 mb-2 py-6 font-['Oswald'] text-[30px] leading-[36px] text-[#2D3E4C] border-l-4 border-[#37576B] pl-4",
        link: "text-[#37576B] font-[500] no-underline inline-block hover:underline hover:cursor-pointer",
        heading_h1: "font-[500] text-[#2D3E4C] text-[36px] leading-[140%] tracking-[-.02em] underline-offset-8 underline decoration-4 decoration-[#EAAD43] uppercase font-['Oswald'] pb-[12px]",
        heading_h2: "font-[500] text-[#2D3E4C] text-[24px] leading-[24px] scroll-mt-36 font-['Oswald']",
        heading_h3: "font-[500] text-[#2D3E4C] text-[16px] leading-[16px] scroll-mt-36 font-['Oswald']",
        heading_h4: "font-medium text-[#2D3E4C] scroll-mt-36 font-display",
        heading_h5: "text-[36px] sm:text-[48px] tracking-[-2px] items-center font-medium font-['Oswald'] text-[#2D3E4C] sm:leading-[100%] uppercase",
        heading_h6: "scroll-mt-36 font-display",
        text_bold: "font-[700]",
        text_code: "bg-gray-200 px-1 py-0.5 font-mono text-[94%]",
        text_italic: "italic",
        text_strikethrough: "line-through",
        text_subscript: "align-sub text-[0.8em]",
        text_superscript: "align-super text-[0.8em]",
        text_underline: "underline",
        text_underlineStrikethrough: "underline line-through",
        blockCursor: "block pointer-events-none absolute content-[''] after:absolute after:-top-[2px] after:w-[20px] after:border-t-[1px_solid_black]",
        characterLimit: "inline !bg-[#ffbbbb]",
        layoutContainer: "grid gap-[10px]",
        layoutItem: "px-2 py-4 min-w-0 max-w-full",
        layoutItemEditable: "border border-dashed border-slate-300 rounded-lg",
      },
      {
        // Style 1: Inline Guidance (dashed orange border)
        name: "Inline Guidance",
        contentEditable: "border-3 border-dashed border-[#e7ae48] px-6 py-4 rounded-lg relative [tab-size:1] outline-none",
      },
      {
        // Style 2: Annotation Card
        name: "Annotation",
        contentEditable: "border-none relative [tab-size:1] outline-none",
        editorContainer: "relative block rounded-[12px] min-h-[50px] px-[12px] shadow-[0px_0px_6px_0px_rgba(0,0,0,0.02),0px_2px_4px_0px_rgba(0,0,0,0.08)] overflow-hidden",
        editorViewContainer: "relative block rounded-[12px] px-[12px] shadow-[0px_0px_6px_0px_rgba(0,0,0,0.02),0px_2px_4px_0px_rgba(0,0,0,0.08)] overflow-hidden",
        paragraph: "m-0 relative",
        layoutContainer: "grid",
        layoutItem: "border-b border-slate-300 min-w-0 max-w-full",
        heading_h1: "pl-[4px] pt-[8px] font-[500] text-[34px] text-[#2D3E4C] leading-[40px] uppercase font-['Oswald'] pb-[12px]",
        heading_h2: "pl-[4px] pt-[8px] font-[500] text-[24px] text-[#2D3E4C] leading-[24px] scroll-mt-36 font-['Oswald']",
        heading_h3: "pl-[4px] pt-[8px] font-[500] text-[16px] text-[#2D3E4C] font-['Oswald']",
        heading_h4: "pl-[4px] pt-[8px] font-medium scroll-mt-36 text-[#2D3E4C] font-display",
        heading_h5: "pl-[4px] scroll-mt-36 font-display",
        heading_h6: "pl-[4px] scroll-mt-36 font-display",
      },
      {
        // Style 3: Annotation Image Card
        name: "Annotation Image Card",
        editorShell: "font-['Proxima_Nova'] font-[400] text-[16px] text-[#37576B] leading-[22.4px] pt-[120px]",
        contentEditable: "border-none relative [tab-size:1] outline-none",
        editorContainer: "relative block rounded-[12px] min-h-[50px] p-[12px] shadow-[0px_0px_6px_0px_rgba(0,0,0,0.02),0px_2px_4px_0px_rgba(0,0,0,0.08)]",
        editorViewContainer: "relative block rounded-[12px] p-[12px] shadow-[0px_0px_6px_0px_rgba(0,0,0,0.02),0px_2px_4px_0px_rgba(0,0,0,0.08)]",
        paragraph: "m-0 relative",
        layoutContainer: "grid",
        layoutItem: "border-b border-slate-300 min-w-0 max-w-full",
        heading_h1: "pl-[16px] pt-[8px] font-[500] text-[34px] text-[#2D3E4C] leading-[40px] uppercase font-['Oswald'] pb-[12px]",
        heading_h2: "pl-[16px] pt-[8px] font-[500] text-[24px] text-[#2D3E4C] leading-[24px] scroll-mt-36 font-['Oswald']",
        heading_h3: "pl-[16px] pt-[8px] font-[500] text-[16px] text-[#2D3E4C] font-['Oswald']",
        heading_h4: "pl-[16px] pt-[8px] font-medium scroll-mt-36 text-[#2D3E4C] font-display",
        heading_h5: "pl-[16px] scroll-mt-36 font-display",
        heading_h6: "pl-[16px] scroll-mt-36 font-display",
        inlineImage: "inline-block relative z-10 cursor-default select-none mx-[-12px] mt-[-120px]",
      },
      {
        // Style 6: Dark (white text on dark backgrounds)
        name: "Dark",
        editorShell: "font-['Proxima_Nova'] font-[400] text-[16px] text-white leading-[22.4px]",
        heading_h1: "pt-[8px] font-[500] text-[64px] text-white leading-[40px] uppercase font-['Oswald'] pb-[12px]",
        heading_h2: "pt-[8px] font-[500] text-[24px] text-white leading-[24px] scroll-mt-36 font-['Oswald']",
        heading_h3: "pt-[8px] font-[500] text-[16px] text-white font-['Oswald']",
        heading_h4: "pt-[8px] font-medium scroll-mt-36 text-white font-display",
        heading_h5: "scroll-mt-36 font-display",
        heading_h6: "scroll-mt-36 font-display",
      },
      {
        // Style 4: Handwritten (Caveat font)
        name: "Handwritten_2",
        contentEditable: "border-none relative [tab-size:1] outline-none",
        editorScroller: "min-h-[150px] border-0 flex relative outline-0 z-0 resize-y",
        viewScroller: "border-0 flex relative outline-0 z-0 resize-none",
        editorContainer: "relative block rounded-[10px] min-h-[50px]",
        editorShell: "font-['Caveat'] font-[600] text-[20px] text-[#37576B] leading-[22.4px]",
      },
      {
        // Style 5: Sitemap
        name: "sitemap",
        link: "leading-[22.4px] tracking-normal",
        heading_h1: "pt-[8px] font-[500] text-[64px] text-white leading-[40px] uppercase font-['Oswald'] pb-[12px]",
        heading_h2: "text-[#2D3E4C] no-underline font-[Oswald] font-medium text-[16px] leading-[14px] uppercase tracking-normal",
        heading_h3: "text-[#2D3E4C] font-[Oswald] font-medium text-[14px] leading-[14px] uppercase tracking-normal",
        heading_h4: "pt-[8px] font-medium scroll-mt-36 text-white font-display",
        heading_h5: "scroll-mt-36 font-display",
        heading_h6: "scroll-mt-36 font-display",
      },
    ],
  },
};

//theme.navOptions.logo = <Link to='/' className='h-12 flex px-4 items-center'><div className='rounded-full h-10 bg-blue-500 border border-slate-50' /></Link>

export default {
  ...theme,
  Icons
};
