import React from 'react';
import { useStore } from '../store';

const RightSidebar: React.FC = () => {
    const isOpen = useStore(state => state.isRightSidebarOpen);
    const toggle = useStore(state => state.toggleRightSidebar);

    if (!isOpen) return null;

    return (
        <aside className="right-sidebar" id="right-sidebar" style={{ display: 'flex', width: '450px', flexDirection: 'column', background: 'var(--vscode-sideBar-background)', borderLeft: '1px solid var(--vscode-panel-border)', zIndex: 10 }}>
            <div className="right-sidebar-header" style={{ height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', background: 'var(--vscode-editorGroupHeader-tabsBackground)', borderBottom: '1px solid var(--vscode-panel-border)' }}>
                <span style={{ fontSize: '11px', fontWeight: 500, fontFamily: 'var(--font-ui)', color: 'var(--vscode-sideBar-foreground)' }}>Open Agent Manager</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <i className="codicon codicon-layout-panel-justify hoverable" style={{ color: 'var(--vscode-sideBar-foreground)', cursor: 'pointer' }}></i>
                    <i className="codicon codicon-layout-sidebar-right hoverable" style={{ color: 'var(--vscode-sideBar-foreground)', cursor: 'pointer' }}></i>
                    <i className="codicon codicon-layout-panel hoverable" style={{ color: 'var(--vscode-sideBar-foreground)', cursor: 'pointer' }}></i>
                    <i className="codicon codicon-search hoverable" style={{ color: 'var(--vscode-sideBar-foreground)', cursor: 'pointer' }}></i>
                    <i className="codicon codicon-account hoverable" style={{ color: 'var(--vscode-sideBar-foreground)', cursor: 'pointer' }}></i>
                    <i className="codicon codicon-settings-gear hoverable" style={{ color: 'var(--vscode-sideBar-foreground)', cursor: 'pointer' }}></i>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--vscode-activityBar-background)', border: '1px solid var(--vscode-panel-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', cursor: 'pointer', color: 'var(--vscode-sideBar-foreground)' }}>K</div>
                    <i className="codicon codicon-chevron-down hoverable" style={{ color: 'var(--vscode-sideBar-foreground)', cursor: 'pointer' }}></i>
                </div>
            </div>

            <div className="agent-tabs" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 10px', borderBottom: '1px solid var(--vscode-panel-border)' }}>
                <div style={{ fontSize: '11px', padding: '4px 0', color: 'var(--vscode-sideBar-foreground)', opacity: 0.8 }}>Authentic VS Code UI</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <i className="codicon codicon-add hoverable" style={{ fontSize: '14px', color: 'var(--vscode-sideBar-foreground)', cursor: 'pointer' }}></i>
                    <i className="codicon codicon-history hoverable" style={{ fontSize: '14px', color: 'var(--vscode-sideBar-foreground)', cursor: 'pointer' }}></i>
                    <i className="codicon codicon-ellipsis hoverable" style={{ fontSize: '14px', color: 'var(--vscode-sideBar-foreground)', cursor: 'pointer' }}></i>
                    <i className="codicon codicon-close hoverable" id="close-agent-panel" onClick={toggle} style={{ fontSize: '14px', color: 'var(--vscode-sideBar-foreground)', cursor: 'pointer' }}></i>
                </div>
            </div>

            <div id="agent-messages" style={{ flex: 1, overflowY: 'auto', padding: '15px', fontSize: '13px', fontFamily: 'var(--font-ui)', display: 'flex', flexDirection: 'column', gap: '15px', color: 'var(--vscode-editor-foreground)' }}>
            </div>

            <div className="agent-input-section" style={{ padding: '10px', borderTop: '1px solid var(--vscode-panel-border)' }}>
                <div className="agent-input-wrapper" style={{ background: 'var(--vscode-editor-background)', border: '1px solid var(--vscode-panel-border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <textarea id="agent-input" placeholder="Ask anything..." style={{ width: '100%', minHeight: '80px', maxHeight: '250px', background: 'transparent', border: 'none', color: 'var(--vscode-editor-foreground)', padding: '10px', resize: 'none', fontSize: '13px', fontFamily: 'var(--font-ui)', outline: 'none' }}></textarea>

                    <div className="agent-input-toolbar" style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', background: 'var(--vscode-editorGroupHeader-tabsBackground)', borderTop: '1px solid var(--vscode-panel-border)', gap: '4px' }}>
                        <button className="agent-icon-btn" style={{ background: 'none', border: 'none', color: 'var(--vscode-sideBar-foreground)', opacity: 0.8, cursor: 'pointer' }}><i className="codicon codicon-add"></i></button>

                        <div className="agent-dropdown" id="agent-mode-dropdown" style={{ display: 'flex', alignItems: 'center', background: 'var(--vscode-activityBar-background)', border: '1px solid var(--vscode-panel-border)', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', gap: '4px', padding: '2px 6px', color: 'var(--vscode-sideBar-foreground)' }}>
                            <i className="codicon codicon-chevron-up" style={{ fontSize: '12px' }}></i>
                            <span id="agent-mode-label">Planning</span>
                        </div>

                        <div className="agent-dropdown" id="agent-model-dropdown" style={{ display: 'flex', alignItems: 'center', background: 'var(--vscode-activityBar-background)', border: '1px solid var(--vscode-panel-border)', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', gap: '4px', padding: '2px 6px', color: 'var(--vscode-sideBar-foreground)' }}>
                            <i className="codicon codicon-chevron-up" style={{ fontSize: '12px' }}></i>
                            <span id="agent-model-label">Gemini 3.1 Pro (Low)</span>
                        </div>

                        <div style={{ flex: 1 }}></div>
                        <button className="agent-icon-btn" style={{ background: 'none', border: 'none', color: 'var(--vscode-sideBar-foreground)', opacity: 0.8, cursor: 'pointer' }}><i className="codicon codicon-mic"></i></button>
                        <button className="agent-icon-btn" title="Add context" style={{ background: 'none', border: 'none', color: 'var(--vscode-sideBar-foreground)', opacity: 0.8, cursor: 'pointer' }}><i className="codicon codicon-git-pull-request-create"></i></button>
                        <button className="agent-icon-btn" id="agent-send" style={{ color: '#f85b5b', border: '1px solid transparent', borderRadius: '4px', background: 'none', cursor: 'pointer' }}><i className="codicon codicon-debug-stop"></i></button>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default RightSidebar;
