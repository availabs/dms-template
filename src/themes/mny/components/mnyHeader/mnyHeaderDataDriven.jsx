import React, {useContext, useMemo, useState} from 'react';
import {Link} from "react-router";
import {CMSContext, PageContext, ComponentContext} from "../../../../dms/packages/dms/src/patterns/page/context";
import { ThemeContext } from '../../../../dms/packages/dms/src/ui/useTheme';
import {overlayImageOptions, insetImageOptions} from "./consts";
import {SearchPallet} from "../../../../dms/packages/dms/src/patterns/page/components/search";
import {CountyProse} from "../countyProse";
import { getComponentTheme } from '../../../../dms/packages/dms/src/ui/useTheme';

// The header's note is the county's own description of itself
// (`geography_topography` on the DHSES row, flagged `note: true`), which is one
// unbroken 450-character run in the source. It goes through the same excerpt +
// paragraph-break path as the three profile cards on the plan home, so the four
// places that surface this prose read the same. Budget and paragraph count come
// off the note COLUMN, so an author sets them in the section's column settings;
// the defaults suit the header's narrow identity card. `display.defaultNote` —
// the static fallback sentence — passes through unchanged, being well under the
// budget.
const Note = ({ note, proseMaxChars = 320, proseParagraphs = 1, noteFontStyle = 'proseSM',
               noteLinkText, noteLinkPath }) => {
    const themeFromContext = useContext(ThemeContext)?.theme || {};
    const text = getComponentTheme(themeFromContext, 'textSettings') || {};
    if (!note) return null;
    return (
        <>
            {/* The note's type comes off a named textSettings token, not a
                hardcoded class: the wrapper's old `text-[16px] leading-[24px]`
                could not be reached from the section, and it sat one step above
                the design. Toolbar: "Note Size". */}
            <CountyProse value={note} proseMaxChars={proseMaxChars}
                         proseParagraphs={proseParagraphs}
                         paragraphClassName={text[noteFontStyle] || text.proseSM || ''} />
            {noteLinkText && noteLinkPath ? (
                <Link to={noteLinkPath}
                      className={`inline-block mt-2.5 ${text.metaXS || ''} tracking-wider text-[#37576B] hover:text-[#2D3E4C]`}>
                    {noteLinkText} →
                </Link>
            ) : null}
        </>
    );
};

// The plan facts the design puts under the county's description — status,
// approved, expires. COLUMN-DRIVEN like every other slot in this header: flag a
// column `planFact` (toolbar toggle) and it appears here, labelled by its
// `display_name`, in the order the columns are in. So a county template can
// carry different facts without a code change, and the three the LHMP design
// asks for are just the three that happen to be flagged.
const MDY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// DHSES stores these as `4/28/2021` strings, and the design prints `Apr 28, 2021`.
// Anything that isn't an M/D/YYYY string passes straight through.
const factValue = (v) => {
    const s = v?.value ?? v;
    if (typeof s !== 'string') return s;
    const m = s.match(MDY);
    return m ? `${MONTHS[+m[1] - 1]} ${+m[2]}, ${m[3]}` : s;
};

const PlanFacts = ({ facts }) => {
    const themeFromContext = useContext(ThemeContext)?.theme || {};
    const text = getComponentTheme(themeFromContext, 'textSettings') || {};
    if (!facts?.length) return null;
    return (
        <div className="mt-4 pt-4 border-t border-[#E0EBF0] grid grid-cols-2 sm:grid-cols-3 gap-2">
            {facts.map((f) => (
                <div key={f.name}>
                    <div className={text.metaXXS || ''}>{f.label}</div>
                    <div className={`pt-1 ${text.proseSMSemibold || ''} text-[#2D3E4C]`}>{f.value}</div>
                </div>
            ))}
        </div>
    );
};

const Breadcrumbs = ({ chain, show }) => {
    const {UI} = useContext(ThemeContext);
    const {Icon} = UI;

    if(!show) return null;
    return Array.isArray(chain) ? (
        <div className={'px-1 z-[5]'}>
            <div className="flex flex-wrap items-center gap-[4px] text-[#37576B] text-[14px] sm:text-[16px] leading-[100%] tracking-normal">
                {chain.map((c, index) => (
                    <div key={index} className={`flex items-center shrink-0`}>
                        <Link to={`/${c.url_slug}`} className={`w-fit shrink-0 wrap-none ${index === chain.length - 1 ? `font-regular` : `font-semibold`}`}>{c.title}</Link>
                        {index < chain.length - 1 && <Icon icon={'ArrowRight'} height={12} width={12} className="ml-1 -mt-1" />}
                    </div>
                ))}
            </div>
        </div>
    ) : null;
};

const SearchButton = ({app, type, show, showFeaturedSearches = true}) => {
    const {UI} = useContext(ThemeContext);
    const {Icon, Label} = UI;
    const [open, setOpen] = useState(false);
    const [searchStr, setSearchStr] = useState('');
    const featured_searches = ['Climate Change', 'Flood Risk', 'Local Planning', 'Funding']
    if(!show) return null;
    return (
        <>
            <div className='py-2'>
                <div
                    className={`
                                bg-white flex justify-between items-center
                                h-[56px] w-full py-[16px] px-[24px]
                                rounded-[1000px]
                                shadow-[0px_2px_4px_0px_rgba(0,0,0,0.08)]
                                focus-within:ring-2 focus-within:ring-[#6D96AE]
                                shadow-sm transition ease-in
                              `}
                >
                    <input
                        className="w-full focus:outline-none focus:ring-0 text-[#37576B] font-normal text-[16px] leading-[140%]"
                        placeholder="Search for anything..."
                        onChange={e => setSearchStr(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') setOpen(true);
                        }}
                    />

                    <Icon
                        icon={'Search'}
                        height={24}
                        width={24}
                        className="text-[#2D3E4C] p-0.5"
                        onClick={() => setOpen(true)}
                    />
                </div>
            </div>

            {/* The featured-search chips are a landing-page affordance; a county
                plan home does not want them (they are not in the LHMP design).
                Optional rather than removed, and defaulted ON, so every header
                that already renders them is unchanged. Toolbar: "Featured
                Searches". */}
            {showFeaturedSearches ? (
            <div>
                <div className="pt-[8px] font-[500] text-[16px] text-[#2D3E4C] font-['Oswald'] text-left">
                FEATURED SEARCHES
                </div>
                <div className='flex w-full flex-wrap'>
                    {featured_searches.map(search => (
                        <div key={search} className='pr-1 py-0.5 cursor-pointer' onClick={() => {setSearchStr(search);setOpen(true);}}>
                            <Label> <div  className='uppercase'>{search}</div></Label>
                        </div>)
                    )}
                </div>
            </div>) : null}

            <SearchPallet open={open} setOpen={setOpen} app={app} type={type} searchStr={searchStr}/>
        </>
    )
}

const Title = ({title, titleSize, logo}) => {
    if(!title) return;

    return (
        <div className={`flex gap-1 text-[36px] ${titleSize} items-center font-medium font-['Oswald'] text-[#2D3E4C] sm:leading-[100%] uppercase`}>
            {logo && <img className={'max-w-[150px] max-h-[150px]'} alt={' '} src={logo}/>}
            {title}
        </div>
    )
}



export function Header ({app, type, title, note, logo, overlay='overlay', bgImg, chain, showBreadcrumbs, showSearchBar,
                         showFeaturedSearches, proseMaxChars, proseParagraphs, noteFontStyle, noteLinkText, noteLinkPath,
                         planFacts, titleSize='sm:text-[72px] tracking-[0px]'}) {
    return overlay === 'full' ? (
        <div
            className="relative w-full h-auto lg:h-[808px] lg:-mb-[185px] flex flex-col lg:flex-row justify-center"
            style={{ background: `url('${bgImg}') center/cover`}}
        >
            {/* image div */}
            <div
                className="lg:order-last w-full lg:flex-1 lg:h-[699px]"

            >
                <div className="relative top-[90px] mx-auto" />
            </div>

            {/* breadcrumbs, title,note div */}
            <div className="w-full">
                {/* `lg:w-[1440px]` here forced a 1440px inner box at every viewport from
                    1024px up, so every MNY page with a full-overlay header scrolled
                    sideways between 1024 and 1440 (measured: scrollWidth 1440 in a
                    1024 viewport). `w-full lg:max-w-[1440px]` is identical at 1440 and
                    correct below it — the same shape line 135's inset variant already
                    used. Fixed here rather than in the library because this component
                    is brand code and now lives in the mny theme. */}
                <div className="mx-auto px-[15px] xl:px-[64px] lg:pt-[80px] pt-[120px] pb-[40px] w-full lg:max-w-[1440px] h-full flex items-center ">
                    <div className=" w-full lg:w-[481px] px-[32px] py-[37px] gap-[16px] bg-white shadow-md rounded-[12px]">
                        <div className="flex flex-col gap-1">
                            <Breadcrumbs chain={chain} show={showBreadcrumbs}/>
                            <Title title={title} titleSize={titleSize} logo={logo} />
                        </div>
                        <div className="text-[16px] leading-[24px] text-[#37576B] w-full p-1 pt-2">
                            <Note note={note} proseMaxChars={proseMaxChars} proseParagraphs={proseParagraphs}
                                  noteFontStyle={noteFontStyle} noteLinkText={noteLinkText}
                                  noteLinkPath={noteLinkPath} />
                        </div>
                        <PlanFacts facts={planFacts} />
                        <SearchButton app={app} type={type} show={showSearchBar}
                                      showFeaturedSearches={showFeaturedSearches}/>
                    </div>
                </div>
            </div>

        </div>
    ) : overlay === 'none' ? (

        <div className={`relative w-full lg:-mb-[128px] `}>

                <div  className="absolute top-0 right-0 w-[758px] h-[499px] flex-1 rounded-bl-[395px] bg-[#1A2732] sm:bg-gradient-to-r from-[#213440] to-[#213440] via-[#213440]/70" />

                 {/* breadcrumbs, title, note image: none */}
                <div className={'relative max-w-[1440px] w-full mx-auto px-4 xl:px-[64px] pb-4 pt-[100px] sm:pt-[118px] items-center '}>
                    <div className={'p-[56px] h-full bg-white z-[100] rounded-lg shadow-md z-20'}>
                        <div className={'flex flex-col gap-1 w-3/4'}>
                            <Breadcrumbs chain={chain} show={showBreadcrumbs}/>
                            <Title title={title} titleSize={titleSize} logo={logo} />
                        </div>
                        <div className='text-[16px] leading-[24px] text-[#37576B] w-3/4 p-1 pt-2'>
                            <Note note={note} proseMaxChars={proseMaxChars} proseParagraphs={proseParagraphs}
                                  noteFontStyle={noteFontStyle} noteLinkText={noteLinkText}
                                  noteLinkPath={noteLinkPath} />
                        </div>
                        <PlanFacts facts={planFacts} />
                        <SearchButton app={app} type={type} show={showSearchBar}
                                      showFeaturedSearches={showFeaturedSearches}/>
                    </div>
                </div>



        </div>
    ) : (
        <div className={`relative w-full lg:h-[743px] lg:-mb-[85px]
            flex flex-col lg:flex-row bg-fit bg-center justify-center`}>
            {/* image div */}
            <div
                className={`
                   lg:order-last flex-1 rounded-bl-[395px]
                   flex-1 bg-[#1A2732] bg-gradient-to-r from-[#213440] to-[#213440] via-[#213440]/70
                `}
                style={
                    overlay === 'inset' ?
                        { background: `url('${bgImg}')`} : {}}
            >

                {overlay === 'overlay' &&
                    <img className='relative top-[70px] w-[758px] ' src={bgImg} alt={'overlay image'}/>
                }
            </div>

            {/* breadcrumbs, title, note: overlay, inset, full*/}
            <div className='lg:flex-1 top-[150px] sm:top-0 '>
                <div className={'w-full lg:max-w-[656px] h-full lg:ml-auto flex items-center pt-12 lg:pt-0'}>
                    <div className={'pr-[64px] xl:pl-0 px-[15px]'}>

                        <div className={'flex flex-col gap-1'}>
                            <Breadcrumbs chain={chain} show={showBreadcrumbs}/>
                            <Title title={title} titleSize={titleSize} logo={logo} />
                        </div>
                        <div className='text-[16px] leading-[24px] text-[#37576B] w-full p-1 pt-2'>
                            <Note note={note} proseMaxChars={proseMaxChars} proseParagraphs={proseParagraphs}
                                  noteFontStyle={noteFontStyle} noteLinkText={noteLinkText}
                                  noteLinkPath={noteLinkPath} />
                        </div>
                        <PlanFacts facts={planFacts} />
                        <SearchButton app={app} type={type} show={showSearchBar}
                                      showFeaturedSearches={showFeaturedSearches}/>
                    </div>
                </div>
            </div>
        </div>
    )
}


const getChain = (dataItems, currentItem) => {
    const {id, parent, title, url_slug} = currentItem || {};
    if (parent){
        const chainForCurrItem = getChain(dataItems, dataItems.find(di => di.id === parent));
        return [...chainForCurrItem, {id, parent, title, url_slug}]
    }


    return [{id, parent, title, url_slug}];
}

export const MnyHeaderWrapper = ({isEdit}) => {
    const {dataItems, item} = useContext(PageContext);
    const {app, type} = useContext(CMSContext);
    const {state: {display={}, data=[], columns=[]}} = useContext(ComponentContext);

    const titleColumn = useMemo(() => columns.find(({title}) => title), [columns]);
    const noteColumn = useMemo(() => columns.find(({note}) => note), [columns]);
    const imgColumn = useMemo(() => columns.find(({bgImg}) => bgImg), [columns]);
    const logoColumn = useMemo(() => columns.find(({logo}) => logo), [columns]);
    // NOT `find` — unlike title/note/logo/bgImg this slot takes several columns,
    // in the order the author has them.
    const factColumns = useMemo(() => columns.filter(({planFact}) => planFact), [columns]);

    const title = useMemo(() => data?.[0]?.[titleColumn?.name], [data, titleColumn]);
    const note = useMemo(() => data?.[0]?.[noteColumn?.name], [data, noteColumn]);
    const bgImg = useMemo(() => data?.[0]?.[imgColumn?.name], [data, imgColumn]);
    const logo = useMemo(() => data?.[0]?.[logoColumn?.name], [data, imgColumn]);
    const planFacts = useMemo(() => factColumns
        .map(c => ({ name: c.name, label: c.display_name || c.name, value: factValue(data?.[0]?.[c.name]) }))
        .filter(f => f.value !== null && f.value !== undefined && f.value !== ''),
        [data, factColumns]);
    const chain = getChain(dataItems, item);

    return (<>
                <Header title={title || display.defaultTitle}
                   note={note || display.defaultNote}
                   proseMaxChars={noteColumn?.proseMaxChars}
                   proseParagraphs={noteColumn?.proseParagraphs}
                   planFacts={planFacts}
                   logo={logo}
                   bgImg={bgImg || display.defaultBgImg}
                   {...display}
                   chain={chain}
                   app={app}
                   type={type}
                />
                <div className='print-page-break'></div>
            </>)
}

