import React, { useCallback, useRef } from 'react';
import ActivityBar from './ActivityBar';
import { invoke } from '../tauri_bridge';
import Sidebar from './Sidebar';
import BottomPanel from './BottomPanel';
import RightSidebar from './RightSidebar';
import Editor from './Editor';
import SettingsPage from './SettingsPage';
import { useStore } from '../store';

function detectLanguageIcon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, string> = {
        rs: 'rust', ts: 'typescript', tsx: 'react', js: 'javascript',
        jsx: 'react', json: 'json', css: 'css', html: 'html',
        md: 'markdown', toml: 'settings', yaml: 'symbol-method', yml: 'symbol-method',
    };
    return map[ext] ?? 'file';
}

const Workbench: React.FC = () => {
    const isSidebarOpen = useStore(state => state.isSidebarOpen);
    const isBottomPanelOpen = useStore(state => state.isBottomPanelOpen);
    const isRightSidebarOpen = useStore(state => state.isRightSidebarOpen);
    const sidebarWidth = useStore(state => state.sidebarWidth);
    const rightSidebarWidth = useStore(state => state.rightSidebarWidth);
    const bottomPanelHeight = useStore(state => state.bottomPanelHeight);
    
    const setSidebarWidth = useStore(state => state.setSidebarWidth);
    const setRightSidebarWidth = useStore(state => state.setRightSidebarWidth);
    const setBottomPanelHeight = useStore(state => state.setBottomPanelHeight);

    const tabs = useStore(state => state.tabs);
    const activeTabId = useStore(state => state.activeTabId);
    const closeTab = useStore(state => state.closeTab);
    const setActiveTab = useStore(state => state.setActiveTab);

    const resizingRef = useRef<'sidebar' | 'right-sidebar' | 'panel' | null>(null);

    const startResizing = useCallback((type: 'sidebar' | 'right-sidebar' | 'panel') => {
        resizingRef.current = type;
        document.body.style.cursor = type === 'panel' ? 'row-resize' : 'col-resize';
        document.body.classList.add('resizing');
        
        const onMouseMove = (e: MouseEvent) => {
            if (resizingRef.current === 'sidebar') {
                const newWidth = Math.max(160, Math.min(600, e.clientX - 48)); // 48 is activity bar width
                setSidebarWidth(newWidth);
            } else if (resizingRef.current === 'right-sidebar') {
                const newWidth = Math.max(200, Math.min(800, window.innerWidth - e.clientX));
                setRightSidebarWidth(newWidth);
            } else if (resizingRef.current === 'panel') {
                const newHeight = Math.max(100, Math.min(window.innerHeight - 100, window.innerHeight - e.clientY - 22)); // 22 is status bar height
                setBottomPanelHeight(newHeight);
            }
        };

        const onMouseUp = () => {
            resizingRef.current = null;
            document.body.style.cursor = '';
            document.body.classList.remove('resizing');
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }, [setSidebarWidth, setRightSidebarWidth, setBottomPanelHeight]);

    const hasOpenFile = activeTabId !== null && tabs.length > 0;

    const activeRoot = useStore(state => state.activeRoot);
    const activeRootName = useStore(state => state.activeRootName);

    return (
        <div id="workbench">
            <ActivityBar />
            {isSidebarOpen && <div style={{ width: sidebarWidth, flexShrink: 0, display: 'flex' }}><Sidebar /></div>}

            {isSidebarOpen && (
                <div 
                    className="resizer-v" 
                    id="sidebar-resizer" 
                    onMouseDown={() => startResizing('sidebar')}
                />
            )}

            <div className="main-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>
                <main className="editors-layout" id="editors-layout" style={{ display: 'flex', flex: 1, overflow: 'hidden', background: 'var(--vscode-editor-background)' }}>
                    {/* Primary Editor Group */}
                    <div className="editor-group active" id="group-1" style={{ display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
                        <div className="editor-main">
                            {/* Tab strip */}
                            <div className="tabs-row">
                                {tabs.map(tab => (
                                    <div
                                        key={tab.id}
                                        className={`tab${tab.id === activeTabId ? ' active' : ''}`}
                                        onClick={() => setActiveTab(tab.id)}
                                        title={tab.path}
                                        style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                                    >
                                        <span style={{ marginRight: '6px' }}>{tab.filename}</span>
                                        {tab.isModified && (
                                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--vscode-tab-activeForeground)', display: 'inline-block', marginRight: 4 }} />
                                        )}
                                        <i
                                            className="codicon codicon-close"
                                            style={{ marginLeft: tab.isModified ? 0 : '10px', fontSize: '14px', cursor: 'pointer', opacity: 0.7 }}
                                            onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                                        />
                                    </div>
                                ))}
                                {tabs.length === 0 && !activeRoot && (
                                    <div className="tab active" style={{ display: 'flex', alignItems: 'center' }}>
                                        <i className="codicon codicon-markdown" style={{ marginRight: '6px', fontSize: '14px', color: '#1f9ceb' }} />
                                        Welcome
                                        <i className="codicon codicon-close" style={{ marginLeft: '10px', fontSize: '14px', cursor: 'pointer' }} />
                                    </div>
                                )}
                            </div>

                            {/* Breadcrumbs */}
                            <div className="breadcrumbs" id="breadcrumbs">
                                {hasOpenFile ? (
                                    <>
                                        <i className="codicon codicon-folder" style={{ fontSize: '14px', marginRight: '4px', opacity: 0.6 }} />
                                        <span className="breadcrumb-item" style={{ cursor: 'pointer' }}>{(tabs.find(t => t.id === activeTabId)?.path.split('/').slice(-2, -1)[0]) ?? (activeRootName || 'vscodium-rust')}</span>
                                        <i className="codicon codicon-chevron-right" style={{ fontSize: '12px', margin: '0 4px', opacity: 0.4 }} />
                                        <i className={`codicon codicon-${detectLanguageIcon(tabs.find(t => t.id === activeTabId)?.filename || '')}`} style={{ fontSize: '14px', marginRight: '4px', opacity: 0.6 }} />
                                        <span className="breadcrumb-item active" style={{ color: 'var(--vscode-tab-activeForeground)', fontWeight: 400 }}>
                                            {tabs.find(t => t.id === activeTabId)?.filename}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <i className="codicon codicon-folder" style={{ fontSize: '14px', marginRight: '4px', opacity: 0.6 }} />
                                        <span className="breadcrumb-item">{activeRootName || 'vscodium-rust'}</span>
                                        <i className="codicon codicon-chevron-right" style={{ fontSize: '12px', margin: '0 4px', opacity: 0.4 }} />
                                        <span className="breadcrumb-item active" style={{ color: 'var(--vscode-tab-activeForeground)' }}>Welcome</span>
                                    </>
                                )}
                            </div>

                            <div className="editor-wrapper" style={{ position: 'relative', width: '100%', height: '100%', flex: 1 }}>
                                {/* Welcome screen when no root is open and no tabs */}
                                {!activeRoot && tabs.length === 0 && (
                                    <div id="welcome-view" className="welcome-view" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: 'var(--vscode-editor-background)', color: 'var(--vscode-sideBar-foreground)' }}>
                                        <div className="welcome-logo" style={{ marginBottom: '24px', opacity: 0.8 }}>
                                            <svg width="120" height="120" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M72.4 15.2L28.8 45.3L15.6 33.7L6.4 41.5L25.3 71.3L72.4 84.8C75.8 85.8 79.1 83.3 79.1 79.7V20.3C79.1 16.7 75.8 14.2 72.4 15.2Z" fill="#0065A9" />
                                                <path d="M72.4 15.2L28.8 45.3L25.3 71.3L72.4 84.8C75.8 85.8 79.1 83.3 79.1 79.7V20.3C79.1 16.7 75.8 14.2 72.4 15.2Z" fill="#007ACC" />
                                                <path d="M28.8 45.3L15.6 33.7L25.3 54.7L28.8 45.3Z" fill="#1F9CEB" />
                                            </svg>
                                        </div>
                                        <h1 className="welcome-title" style={{ fontSize: '36px', fontWeight: 200, marginBottom: '6px' }}>Visual Studio Code</h1>
                                        <h2 style={{ fontSize: '18px', fontWeight: 200, opacity: 0.5, marginBottom: '40px' }}>Editing evolved</h2>
                                        
                                        <div className="welcome-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start', minWidth: '200px' }}>
                                            <span style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', opacity: 0.8 }}>Start</span>
                                            <a href="#" onClick={(e) => { e.preventDefault(); (window as any).executeCommand('explorer.newFile'); }} style={{ color: 'var(--vscode-focusBorder)', textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <i className="codicon codicon-new-file" /> New File...
                                            </a>
                                            <a href="#" onClick={(e) => { e.preventDefault(); (window as any).executeCommand('explorer.openFolder'); }} style={{ color: 'var(--vscode-focusBorder)', textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <i className="codicon codicon-folder-opened" /> Open Folder...
                                            </a>
                                            <a href="#" onClick={(e) => { e.preventDefault(); (window as any).executeCommand('git.clone'); }} style={{ color: 'var(--vscode-focusBorder)', textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <i className="codicon codicon-source-control" /> Clone Git Repository...
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {/* Monaco Editor or Settings Page */}
                                {hasOpenFile && (
                                    <div style={{ width: '100%', height: '100%' }}>
                                        {tabs.find(t => t.id === activeTabId)?.type === 'settings' ? (
                                            <SettingsPage />
                                        ) : (
                                            <Editor />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </main>

                {isBottomPanelOpen && (
                    <div 
                        className="resizer-h" 
                        id="panel-resizer" 
                        onMouseDown={() => startResizing('panel')}
                    />
                )}
                <div style={{ height: isBottomPanelOpen ? bottomPanelHeight : 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <BottomPanel />
                </div>
            </div>

            {isRightSidebarOpen && (
                <div 
                    className="resizer-v" 
                    id="right-sidebar-resizer" 
                    onMouseDown={() => startResizing('right-sidebar')}
                />
            )}
            {isRightSidebarOpen && (
                <div style={{ width: rightSidebarWidth, flexShrink: 0, display: 'flex' }}>
                    <RightSidebar />
                </div>
            )}
        </div>
    );
};

export default Workbench;
