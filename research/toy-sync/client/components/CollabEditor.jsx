import React, { useCallback, useEffect, useRef } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { LexicalCollaboration } from '@lexical/react/LexicalCollaborationContext';
import { CollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin';
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin';
import { ClearEditorPlugin } from '@lexical/react/LexicalClearEditorPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';

import PlaygroundNodes from '@dms/ui/components/lexical/editor/nodes/PlaygroundNodes';
import ToolbarPlugin from '@dms/ui/components/lexical/editor/plugins/ToolbarPlugin/index';
import LinkPlugin from '@dms/ui/components/lexical/editor/plugins/LinkPlugin';
import AutoLinkPlugin from '@dms/ui/components/lexical/editor/plugins/AutoLinkPlugin';
import ListMaxIndentLevelPlugin from '@dms/ui/components/lexical/editor/plugins/ListMaxIndentLevelPlugin';
import CodeHighlightPlugin from '@dms/ui/components/lexical/editor/plugins/CodeHighlightPlugin';
import FloatingTextFormatToolbarPlugin from '@dms/ui/components/lexical/editor/plugins/FloatingTextFormatToolbarPlugin';
import DraggableBlockPlugin from '@dms/ui/components/lexical/editor/plugins/DraggableBlockPlugin';
import ComponentPickerPlugin from '@dms/ui/components/lexical/editor/plugins/ComponentPickerPlugin';
import CollapsiblePlugin from '@dms/ui/components/lexical/editor/plugins/CollapsiblePlugin';
import {LayoutPlugin} from '@dms/ui/components/lexical/editor/plugins/LayoutPlugin/LayoutPlugin';
import PageBreakPlugin from '@dms/ui/components/lexical/editor/plugins/PageBreakPlugin';
import DragDropPaste from '@dms/ui/components/lexical/editor/plugins/DragDropPastePlugin';
import InlineImagePlugin from '@dms/ui/components/lexical/editor/plugins/InlineImagePlugin';
import EmojiPickerPlugin from '@dms/ui/components/lexical/editor/plugins/EmojiPickerPlugin';
import TabFocusPlugin from '@dms/ui/components/lexical/editor/plugins/TabFocusPlugin';
import FloatingLinkEditorPlugin from '@dms/ui/components/lexical/editor/plugins/FloatingLinkEditorPlugin';

import { getLexicalTheme, LexicalThemeContext } from '@dms/ui/components/lexical/useLexicalTheme';
import { lexicalTheme as defaultLexicalTheme, buildLexicalInternalTheme } from '@dms/ui/components/lexical/theme';
import { ThemeContext } from '@dms/ui/themeContext';

import { createToyProvider } from '../collab/toy-provider.js';

/**
 * CollabEditor uses Lexical's CollaborationPlugin to provide real-time
 * character-level collaborative editing via Yjs. Unlike the DMS LexicalEdit
 * component (value/onChange pattern), this component:
 * - Does NOT accept a value prop (Yjs is the source of truth)
 * - Does NOT use onChange (edits flow through Yjs)
 * - Does NOT need remoteVersion/remount (Yjs binding updates in-place)
 */
export default function CollabEditor({ noteId }) {
  const floatingAnchorRef = useRef(null);
  const { theme: contextTheme } = React.useContext(ThemeContext) || {};
  const flatLexicalTheme = contextTheme ? getLexicalTheme(contextTheme) : defaultLexicalTheme.styles[0];
  const nestedLexicalTheme = buildLexicalInternalTheme(flatLexicalTheme);

  const initialConfig = {
    editorState: null, // CRITICAL: null for collaboration — Yjs manages state
    namespace: 'toy-collab',
    nodes: [...PlaygroundNodes],
    editable: true,
    onError: (error) => {
      console.error('[CollabEditor] error:', error);
    },
    theme: nestedLexicalTheme,
  };

  const providerFactory = useCallback((id, yjsDocMap) => {
    return createToyProvider(id, yjsDocMap);
  }, []);

  // Get user identity for cursor display
  let username = 'User';
  let cursorColor = '#e06c75';
  try {
    const stored = sessionStorage.getItem('collab-identity');
    if (stored) {
      const identity = JSON.parse(stored);
      username = identity.name;
      cursorColor = identity.color;
    }
  } catch {}

  return (
    <LexicalThemeContext.Provider value={contextTheme}>
      <LexicalCollaboration>
        <LexicalComposer key={noteId} initialConfig={initialConfig}>
          <div className={`${nestedLexicalTheme.editorShell || ''}`} ref={floatingAnchorRef}>
            <ToolbarPlugin theme={nestedLexicalTheme} />
            <div className="relative">
              <RichTextPlugin
                contentEditable={
                  <div className={nestedLexicalTheme.editorScroller || 'editor-scroller'}>
                    <div className={nestedLexicalTheme.editor?.base || 'editor'}>
                      <ContentEditable className={nestedLexicalTheme.contentEditable} />
                    </div>
                  </div>
                }
                placeholder={
                  <div className="absolute top-[15px] left-[28px] text-neutral-600 select-none pointer-events-none text-base overflow-hidden text-ellipsis">
                    Start writing...
                  </div>
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
            </div>

            <CollaborationPlugin
              id={noteId}
              providerFactory={providerFactory}
              shouldBootstrap={true}
              username={username}
              cursorColor={cursorColor}
            />

            <ListPlugin />
            <CheckListPlugin />
            <LinkPlugin />
            <AutoLinkPlugin />
            <ListMaxIndentLevelPlugin maxDepth={7} />
            <CodeHighlightPlugin />
            <HorizontalRulePlugin />
            <TabIndentationPlugin />
            <TabFocusPlugin />
            <ClearEditorPlugin />
            <TablePlugin />
            <CollapsiblePlugin />
            <LayoutPlugin />
            <PageBreakPlugin />
            <DragDropPaste />
            <InlineImagePlugin />
            <ComponentPickerPlugin />
            <EmojiPickerPlugin />
            {floatingAnchorRef.current && (
              <>
                <FloatingTextFormatToolbarPlugin
                  anchorElem={floatingAnchorRef.current}
                  theme={nestedLexicalTheme}
                />
                <FloatingLinkEditorPlugin anchorElem={floatingAnchorRef.current} />
                <DraggableBlockPlugin anchorElem={floatingAnchorRef.current} />
              </>
            )}
          </div>
        </LexicalComposer>
      </LexicalCollaboration>
    </LexicalThemeContext.Provider>
  );
}
