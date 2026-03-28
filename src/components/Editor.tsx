import React, { useCallback, useEffect, useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';
import type { OnMount, OnChange } from '@monaco-editor/react';
import { useStore } from '../store';
import DiffViewer from './DiffViewer';

const CTRL_S = 2048 | 49; // KeyMod.CtrlCmd | KeyCode.KeyS

const Editor: React.FC = () => {
    const activeTabId = useStore(state => state.activeTabId);
    const tabs = useStore(state => state.tabs);
    const updateTabContent = useStore(state => state.updateTabContent);
    const saveActiveFile = useStore(state => state.saveActiveFile);
    const theme = useStore(state => state.theme);
    const setActiveEditorPath = useStore(state => state.setActiveEditorPath);

    const activeTab = tabs.find(t => t.id === activeTabId) ?? null;

    const editorRef = useRef<any>(null);

    // Update active editor path in store whenever tab changes
    useEffect(() => {
        if (activeTab?.path) {
            setActiveEditorPath(activeTab.path);
        }
    }, [activeTabId, activeTab?.path, setActiveEditorPath]);

    const handleMount: OnMount = useCallback((editor) => {
        editorRef.current = editor;
        editor.addCommand(CTRL_S, () => saveActiveFile());
    }, [saveActiveFile]);

    const handleChange: OnChange = useCallback((value) => {
        if (activeTabId && value !== undefined) {
            updateTabContent(activeTabId, value);
        }
    }, [activeTabId, updateTabContent]);

    const pendingChanges = useStore(state => state.pendingChanges);
    const activeFilePendingChange = pendingChanges.find(c => c.path === activeTab?.path);

    // When switching tabs, sync the editor value
    useEffect(() => {
        if (editorRef.current && activeTab) {
            const currentValue = editorRef.current.getValue();
            // If there's a pending change, show the new content
            const targetContent = activeFilePendingChange ? activeFilePendingChange.newContent : activeTab.content;
            if (currentValue !== targetContent) {
                editorRef.current.setValue(targetContent);
            }
        }
    }, [activeTabId, activeFilePendingChange]);

    if (!activeTab) {
        return null;
    }

    return (
        <div style={{ position: 'relative', height: '100%', width: '100%' }}>
            <MonacoEditor
                height="100%"
                width="100%"
                theme={theme}
                language={activeTab.language}
                value={activeFilePendingChange ? activeFilePendingChange.newContent : activeTab.content}
                onMount={handleMount}
                onChange={handleChange}
            options={{
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                lineNumbers: 'on',
                lineNumbersMinChars: 3,
                glyphMargin: false,
                folding: true,
                lineDecorationsWidth: 10,
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                wordWrap: 'off',
                tabSize: 4,
                insertSpaces: true,
                automaticLayout: true,
                renderWhitespace: 'selection',
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                bracketPairColorization: { enabled: true },
            }}
            />
        </div>
    );
};

export default Editor;
