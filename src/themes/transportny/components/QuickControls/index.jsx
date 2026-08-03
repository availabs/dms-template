import React from 'react';
import { ThemeContext, getComponentTheme } from '../../../../dms/packages/dms/src/ui/useTheme';
import { quickControlsTheme } from './QuickControls.theme';
import { applyMeasurePick, isReportPage } from '../MeasurePicker';
import { MEASURE_OPTIONS, COMPARISON_MODE_OPTIONS, DEFAULT_PICK } from '../MeasurePicker/composeMeasureConfig';

/**
 * NPMRDS "Quick Controls" — sectionHeaderExtensions builder for "AVL Graph".
 *
 * New entry point onto the exact same Measure/Comparison Mode picker the
 * Settings-drawer "Measure" item-group (MeasurePicker/index.js) already
 * exposes: one or two clicks in the card's own header instead of opening
 * the drawer. Calls the shared `applyMeasurePick`/`isReportPage` exported
 * from that module so the two entry points read/write identical state and
 * can never silently drift (see avl-graph-quick-controls.md's "Non-obvious
 * risk to design around"). Graph Type and Resolution are deliberately not
 * offered here — see that task file's "Scope" section.
 */
export function npmrdsQuickControls({ state, dwAPI, currentComponent, isEdit, canEditSection, siblingSections = [] }) {
    if (!(isEdit && canEditSection && currentComponent?.useDataSource && isReportPage(siblingSections))) return null;
    return <QuickControlsRow state={state} dwAPI={dwAPI} currentComponent={currentComponent} />;
}

function QuickControlsRow({ state, dwAPI, currentComponent }) {
    const { UI, theme: themeFromContext = {} } = React.useContext(ThemeContext) || {};
    const { NavigableMenu, Button } = UI || {};
    const t = { ...quickControlsTheme, ...getComponentTheme(themeFromContext, 'quickControls') };
    const pick = { ...DEFAULT_PICK, ...(state?.display?._measurePick || {}) };

    const measureLabel = MEASURE_OPTIONS.find(o => o.value === pick.measure)?.label || 'Measure';
    const comparisonLabel = COMPARISON_MODE_OPTIONS.find(o => o.value === pick.comparisonMode)?.label || 'Plain';

    // Flat (unnested) config — a single-level list of Measure options, unlike
    // MeasurePicker's nested-select item-groups (Graph Type/Measure/
    // Resolution/Comparison Mode all in one drawer submenu). Only Measure
    // needs a menu here; Comparison Mode is a direct two-value flip below.
    const measureMenuConfig = MEASURE_OPTIONS.map(opt => ({
        id: `qc_measure_${opt.value}`,
        name: opt.label,
        icon: opt.value === pick.measure ? 'CircleCheck' : 'Blank',
        onClick: () => applyMeasurePick({ state, dwAPI, currentComponent }, { measure: opt.value }),
    }));

    const toggleComparisonMode = () => applyMeasurePick(
        { state, dwAPI, currentComponent },
        { comparisonMode: pick.comparisonMode === 'difference' ? 'plain' : 'difference' },
    );

    return (
        <div className={t.wrapper}>
            <NavigableMenu config={measureMenuConfig} showTitle={false}>
                <Button className={t.pill}>{measureLabel}</Button>
            </NavigableMenu>
            <Button className={t.pill} onClick={toggleComparisonMode}>{comparisonLabel}</Button>
        </div>
    );
}
