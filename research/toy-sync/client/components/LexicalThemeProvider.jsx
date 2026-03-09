import React from 'react';
import { ThemeContext } from '@dms/ui/themeContext';
import { lexicalTheme } from '@dms/ui/components/lexical/theme';

// Clone default flat theme with dark-friendly overrides
const darkLexicalStyle = {
  ...lexicalTheme.styles[0],

  // Editor shell — light text on dark background
  editorShell: "font-sans text-neutral-300 text-base leading-relaxed",

  // Content area
  contentEditable: 'border-none relative [tab-size:1] outline-none outline-0 text-neutral-300',
  text_code: "bg-neutral-800 px-1 py-0.5 font-mono text-[94%] text-orange-300",

  // Headings — white text
  heading_h1: "font-semibold text-3xl text-white",
  heading_h2: "font-medium text-xl text-white",
  heading_h3: "font-medium text-lg text-white",
  heading_h4: "font-medium text-white",
  heading_h5: "text-white",
  heading_h6: "text-white",

  // Block elements
  quote: "m-0 mb-2 text-neutral-400 border-l-4 border-neutral-600 pl-4 pb-3",
  link: "text-blue-400 underline",

  // Toolbar — dark background
  toolbar_base: "flex flex-wrap h-fit overflow-hidden mb-[1px] p-1 rounded-tl-lg rounded-tr-lg sticky top-0 items-center bg-neutral-800 border-b border-neutral-700",
  toolbar_toolbarItem_base: "border-0 flex bg-none rounded-lg p-2 cursor-pointer align-middle flex-shrink-0 items-center justify-between hover:bg-neutral-700 [&_*]:invert",
  toolbar_toolbarItem_text: "flex leading-[20px] text-[14px] text-neutral-400 truncate overflow-hidden h-[20px] text-left pr-[10px]",
  toolbar_toolbarItem_active_base: "bg-neutral-700",
  toolbar_divider: "w-[1px] bg-neutral-600 mx-[4px] h-[35px]",

  // Dropdowns — dark background
  dropdown_base: "z-10 block fixed shadow-lg rounded-[8px] min-h-[40px] bg-neutral-800 border border-neutral-700",
  dropdown_item_base: "m-0 mx-2 p-2 text-neutral-300 cursor-pointer leading-4 text-[15px] flex items-center flex-row flex-shrink-0 justify-between bg-neutral-800 rounded-lg border-0 max-w-[250px] min-w-[100px] hover:bg-neutral-700",
  dropdown_item_icon: "flex w-5 h-5 select-none mr-3 leading-4 bg-contain bg-center bg-no-repeat invert",
  dropdownItemActive: "bg-neutral-700",
  dropdown_divider: "w-auto bg-neutral-600 my-1 h-[1px] mx-2",

  // Typeahead popover (slash menu) — dark background
  typeaheadPopover_base: "bg-neutral-800 shadow-[0_5px_10px_rgba(0,0,0,0.5)] rounded-[8px] mt-[25px] border border-neutral-700",
  typeaheadPopover_ul_li_base: "m-0 min-w-[180px] text-[14px] outline-none cursor-pointer rounded-[8px] hover:bg-neutral-700",
  typeaheadPopover_ul_li_item: "p-[8px] text-neutral-300 cursor-pointer leading-[16px] text-[15px] flex items-center shrink-0 rounded-[8px] border-0",
  typeaheadPopover_ul_li_icon: "flex w-[20px] h-[20px] select-none mr-[8px] leading-[16px] bg-contain bg-no-repeat bg-center invert",
  typeaheadPopover_ul_li_selected: "bg-neutral-700",
  typeaheadPopover_ul_li_hover: "bg-neutral-700",
};

const toyTheme = {
  lexical: {
    options: { activeStyle: 0 },
    styles: [darkLexicalStyle],
  },
};

export default function LexicalThemeProvider({ children }) {
  return (
    <ThemeContext.Provider value={{ theme: toyTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
