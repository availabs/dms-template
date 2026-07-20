import React from 'react';
import { ThemeContext, getComponentTheme } from '../../dms/packages/dms/src/ui/useTheme';
import { editorMockupTheme } from './EditorMockup.theme';

const isJson = (str) => {
  try { JSON.parse(str); } catch (e) { return false; }
  return true;
};

const BLOCK_SPAN = { 12: 'col-span-12', 8: 'col-span-8', 7: 'col-span-7', 5: 'col-span-5', 4: 'col-span-4' };

function Block({ block, t, Icon }) {
  const span = BLOCK_SPAN[block.span] || 'col-span-12';
  if (block.kind === 'header') {
    return (
      <div className={span}>
        <div className={t.blockPanel}>
          <p className={t.blockTitle}>{block.title}</p>
          {block.subtitle && <p className={t.blockSubtitle}>{block.subtitle}</p>}
        </div>
      </div>
    );
  }
  if (block.kind === 'stat') {
    return (
      <div className={span}>
        <div className={t.blockPanel}>
          <p className={t.statLabel}>{block.label}</p>
          <p className={t.statValue}>{block.value}</p>
        </div>
      </div>
    );
  }
  if (block.kind === 'table') {
    return (
      <div className={span}>
        <div className={t.tablePanel}>
          {block.title && (
            <div className={t.tableHeader}>
              <span className={t.tableHeaderLabel}>{block.title}</span>
            </div>
          )}
          {(block.rows || []).map((row, i) => (
            <div key={i} className={t.tableRow}>
              <span>{row.label}</span>
              <span className={t.tableRowMeta}>{row.meta}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (block.kind === 'dropzone') {
    return (
      <div className={span}>
        <div className={t.dropzone}>
          <p className={t.dropzoneLabel}>{block.label}</p>
        </div>
      </div>
    );
  }
  if (block.kind === 'selected') {
    // selectedJoints: optional array of class strings rendered as empty spans —
    // corner-handle tiles pinned on the selection border by the theme.
    const joints = Array.isArray(t.selectedJoints) ? t.selectedJoints : [];
    return (
      <div className={span}>
        <div className={t.selectedPanel}>
          {joints.map((cls, i) => (
            <span key={i} aria-hidden="true" className={cls} />
          ))}
          {block.toolbar && (
            <div className={t.selectedToolbar}>
              {block.toolbar.map((iconName, i) => (
                <Icon key={i} icon={iconName} className={t.selectedToolbarIcon} />
              ))}
            </div>
          )}
          <p className={t.selectedText}>{block.text}</p>
        </div>
      </div>
    );
  }
  if (block.kind === 'labeled') {
    return (
      <div className={span}>
        <div className={t.labeledPanel}>
          <span className={t.labeledText}>{block.label}</span>
          <span className={t.labeledMeta}>{block.meta}</span>
        </div>
      </div>
    );
  }
  return null;
}

export function EditorMockup({ path, badge, cta, sidebar, blocks = [], dragCard, annotations = [] }) {
  const { theme: themeFromContext = {}, UI } = React.useContext(ThemeContext) || {};
  const t = { ...editorMockupTheme, ...getComponentTheme(themeFromContext, 'pages.editorMockup') };
  const Icon = UI?.Icon;

  return (
    <div className={t.wrapper}>
      <div className={t.frame}>
        {(path || badge || cta) && (
          <div className={t.titlebar}>
            <span className={t.trafficLights}>
              <span className={t.trafficDot} />
              <span className={t.trafficDot} />
              <span className={t.trafficDot} />
            </span>
            {path && <span className={t.path}>{path}</span>}
            <span className="flex-1" />
            {badge && <span className={t.badge}>{badge}</span>}
            {cta && (
              <span className={t.cta}>
                {cta.icon && Icon && <Icon icon={cta.icon} className={t.ctaIcon} />}
                {cta.text}
              </span>
            )}
          </div>
        )}
        <div className={t.body}>
          {sidebar && (
            <div className={t.sidebar}>
              {sidebar.map((item, i) => (
                <div key={i} className={item.active ? t.sidebarItemActive : t.sidebarItem}>
                  {item.icon && Icon && <Icon icon={item.icon} className={t.sidebarIcon} />}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          )}
          <div className={t.canvas}>
            <div className={t.canvasGrid}>
              {blocks.map((block, i) => (
                <Block key={i} block={block} t={t} Icon={Icon} />
              ))}
            </div>
            {dragCard && (
              <div className={t.dragCard}>
                <div className={t.dragCardHeader}>
                  {Icon && <Icon icon="GripVertical" className={t.dragCardGrip} />}
                  <span className={t.dragCardLabel}>{dragCard.label}</span>
                </div>
                <div className={t.dragCardBars}>
                  {(dragCard.bars || []).map((h, i) => (
                    <div key={i} className={t.dragCardBar} style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {annotations.map((a, i) => (
        <p key={i} className={a.position === 'bottom-left' ? t.annotationBottomLeft : t.annotationTopRight}>
          {a.text}
        </p>
      ))}
    </div>
  );
}

export const EditorMockupEdit = ({ value }) => {
  const data = value && typeof value === 'object'
    ? value['element-data']
    : (value && isJson(value) ? JSON.parse(value) : {});
  const parsed = typeof data === 'string' && isJson(data) ? JSON.parse(data) : (data || {});
  return <EditorMockup {...parsed} />;
};

export const EditorMockupView = ({ value }) => {
  const data = value && typeof value === 'object'
    ? value['element-data']
    : (value && isJson(value) ? JSON.parse(value) : {});
  const parsed = typeof data === 'string' && isJson(data) ? JSON.parse(data) : (data || {});
  return <EditorMockup {...parsed} />;
};
