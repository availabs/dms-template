import { MnyHeaderWrapper } from './mnyHeaderDataDriven'
import { overlayImageOptions, insetImageOptions } from './consts'

export default {
    "name": 'Header: MNY',
    "type": 'Header',
    useDataSource: true,
    useDataWrapper: true,
    defaultState: {
        columns: [],
        display: {
            usePageFilters: false,
            usePagination: true,
            pageSize: 5,
            totalLength: 0,
            overlay: 'overlay',
            showBreadcrumbs: true,
            titleSize: 'sm:text-[72px] tracking-[0px]'
        },
        filters: { op: 'AND', groups: [] },
        data: [],
        externalSource: {
            columns: []
        }
    },
    controls: {
        columns: [
            {
                type: 'toggle',
                label: 'Title',
                key: 'title',
                onChange: ({ key, value, attribute, state, columnIdx }) => {
                    state.columns.forEach(column => {
                        column.title = value ? column.name === attribute.name : value;
                        column.show = column.name === attribute.name ? value : (column.note || column.bgImg || column.logo);
                    })
                }
            },
            {
                type: 'toggle',
                label: 'Note',
                key: 'note',
                onChange: ({ key, value, attribute, state, columnIdx }) => {
                    state.columns.forEach(column => {
                        column.note = value ? column.name === attribute.name : value;
                        column.show = column.name === attribute.name ? value : (column.title || column.bgImg || column.logo);
                    })
                }
            },
            {
                type: 'toggle',
                label: 'Image',
                key: 'bgImg',
                onChange: ({ key, value, attribute, state, columnIdx }) => {
                    state.columns.forEach(column => {
                        column.bgImg = value ? column.name === attribute.name : value;
                        column.show = column.name === attribute.name ? value : (column.title || column.note || column.logo);
                    })
                }
            },
            {
                type: 'toggle',
                label: 'Logo',
                key: 'logo',
                onChange: ({ key, value, attribute, state, columnIdx }) => {
                    state.columns.forEach(column => {
                        column.logo = value ? column.name === attribute.name : value;
                        column.show = column.name === attribute.name ? value : (column.title || column.note || column.bgImg);
                    })
                }
            },
            // Unlike Title/Note/Image/Logo above, this slot takes SEVERAL columns
            // — the header's plan-facts strip (status · approved · expires in the
            // LHMP design) is one entry per flagged column, labelled by its
            // display_name, in column order. So the toggle sets only its own
            // column and must also keep it in the query (`show`).
            {
                type: 'toggle',
                label: 'Plan fact',
                key: 'planFact',
                onChange: ({ value, attribute, state }) => {
                    const col = state.columns.find(c => c.name === attribute.name);
                    if (!col) return;
                    col.planFact = value;
                    col.show = value || col.title || col.note || col.bgImg || col.logo;
                }
            },
            { type: 'toggle', label: 'Filter', key: 'filters', trueValue: [{ type: 'internal', operation: 'filter', values: [] }] },
        ],
        more: [
            { type: 'toggle', label: 'Attribution', key: 'showAttribution' },
            { type: 'toggle', label: 'Breadcrumbs', key: 'showBreadcrumbs' },
            { type: 'toggle', label: 'Search', key: 'showSearchBar' },
            // Defaults ON when unset, so existing headers are unchanged; a plan
            // home turns it off (the chips are a landing-page affordance and are
            // not in the LHMP design).
            { type: 'toggle', label: 'Featured Searches', key: 'showFeaturedSearches' },
            { type: 'select', label: 'Note Size', key: 'noteFontStyle',
                options: [
                    { label: 'Small (14px)', value: 'proseSM' },
                    { label: 'Regular (16px)', value: 'prose' },
                    { label: 'Large (20px)', value: 'proseLG' },
                    { label: 'X-Small (12px)', value: 'proseXS' },
                ]
            },
            { type: 'input', inputType: 'text', label: 'Note Link Text', key: 'noteLinkText' },
            { type: 'input', inputType: 'text', label: 'Note Link Path', key: 'noteLinkPath' },
            { type: 'select', label: 'Overlay', key: 'overlay',
                options: [
                    { label: 'Overlay', value: 'overlay' },
                    { label: 'Inset', value: 'inset' },
                    { label: 'Full Width', value: 'full' },
                    { label: 'No Image', value: 'none' }
                ]
            },
            { type: 'select', label: 'Title Size', key: 'titleSize',
                options: [
                    { label: 'Regular', value: 'sm:text-[48px] tracking-[-2px]' },
                    { label: 'Large', value: 'sm:text-[72px] tracking-[0px]' },
                ]
            },
            { type: 'input', inputType: 'text', label: 'Default Title', key: 'defaultTitle' },
            { type: 'input', inputType: 'text', label: 'Default Note', key: 'defaultNote' },
            { type: 'select', label: 'Default Image', key: 'defaultBgImg',
                options: [{ label: '', value: undefined }, ...overlayImageOptions, ...insetImageOptions] }
        ]
    },
    "EditComp": MnyHeaderWrapper,
    "ViewComp": MnyHeaderWrapper
}
