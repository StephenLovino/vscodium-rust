import React, { useState, useEffect } from 'react';
import { useStore, type FileEntry } from '../store';
import { invoke } from '@tauri-apps/api/core';

const FileTreeItem: React.FC<{ entry: FileEntry; depth: number }> = ({ entry, depth }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const openFile = useStore(state => state.openFile);

    // Auto-open if it's the root (rel_path is empty)
    useEffect(() => {
        if (depth === 0) setIsCollapsed(false);
    }, [depth]);

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (entry.is_dir) {
            setIsCollapsed(!isCollapsed);
        } else {
            openFile(entry.path).catch(err => console.error(err));
        }
    };

    return (
        <div className="file-tree-item" style={{ userSelect: 'none' }}>
            <div
                className="tree-row"
                onClick={handleToggle}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    height: '22px',
                    paddingLeft: `${depth * 12 + 12}px`,
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: 'var(--vscode-sideBar-foreground)',
                    whiteSpace: 'nowrap'
                }}
            >
                {entry.is_dir ? (
                    <i className={`codicon codicon-${isCollapsed ? 'chevron-right' : 'chevron-down'}`} style={{ marginRight: '6px', fontSize: '14px' }}></i>
                ) : (
                    <i className="codicon codicon-file" style={{ marginRight: '6px', marginLeft: '16px', fontSize: '14px' }}></i>
                )}
                <span>{entry.name}</span>
            </div>
            {!isCollapsed && entry.children && (
                <div className="tree-children">
                    {entry.children.map(child => (
                        <FileTreeItem key={child.path} entry={child} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};

const Sidebar: React.FC = () => {
    const activeView = useStore(state => state.activeSidebarView);
    const isOpen = useStore(state => state.isSidebarOpen);
    const fileTree = useStore(state => state.fileTree);
    const refreshFileTree = useStore(state => state.refreshFileTree);

    // API Keys state
    const [openAIKey, setOpenAIKey] = useState('');
    const [anthropicKey, setAnthropicKey] = useState('');
    const [googleKey, setGoogleKey] = useState('');
    const [statusMessage, setStatusMessage] = useState('');

    useEffect(() => {
        invoke('get_api_keys').then((keys: any) => {
            if (keys.openai) setOpenAIKey(keys.openai);
            if (keys.anthropic) setAnthropicKey(keys.anthropic);
            if (keys.google) setGoogleKey(keys.google);
        }).catch(err => console.error("Failed to load keys", err));
    }, []);

    const handleOpenFolder = async () => {
        try {
            const result = await invoke<string | null>('open_folder');
            if (result) {
                await refreshFileTree();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const saveKeys = async () => {
        setStatusMessage('Saving...');
        try {
            await invoke('save_api_keys', {
                keys: {
                    openai: openAIKey,
                    anthropic: anthropicKey,
                    google: googleKey
                }
            });
            setStatusMessage('API Keys Saved Successfully.');
            setTimeout(() => setStatusMessage(''), 3000);
        } catch (err) {
            console.error(err);
            setStatusMessage('Error saving keys.');
        }
    };

    if (!isOpen) return null;

    const titles: Record<string, string> = {
        'explorer-view': 'Explorer',
        'search-view': 'Search',
        'scm-view': 'Source Control',
        'debug-view': 'Run and Debug',
        'extensions-view': 'Extensions',
        'specs-view': 'Specs',
        'agent-view': 'Agent',
        'planning-view': 'Workflow & Planning',
        'mobile-view': 'Mobile (ADB)'
    };

    return (
        <aside className="sidebar" id="sidebar" style={{ background: 'var(--vscode-sideBar-background)', color: 'var(--vscode-sideBar-foreground)', display: 'flex', flexDirection: 'column', width: 'var(--sidebar-width)', borderRight: '1px solid var(--vscode-panel-border)' }}>
            <div className="sidebar-title" id="sidebar-title" style={{ padding: '0 20px', fontWeight: 400, opacity: 1, color: 'var(--vscode-sideBar-foreground)' }}>{titles[activeView] || 'Explorer'}</div>

            <div id="explorer-view" className={`sidebar-section ${activeView === 'explorer-view' ? '' : 'hidden'}`}>
                <div className="sidebar-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div id="explorer-header-text"><i className="codicon codicon-chevron-down" style={{ marginRight: '4px' }}></i>
                        EXPLORER</div>
                    <div className="explorer-actions" style={{ display: 'flex', gap: '8px', marginRight: '10px' }}>
                        <i className="codicon codicon-new-file" id="explorer-new-file" title="New File" style={{ cursor: 'pointer', fontSize: '14px' }}></i>
                        <i className="codicon codicon-new-folder" id="explorer-new-folder" title="New Folder" style={{ cursor: 'pointer', fontSize: '14px' }}></i>
                        <i className="codicon codicon-refresh" id="explorer-refresh" onClick={() => refreshFileTree()} title="Refresh" style={{ cursor: 'pointer', fontSize: '14px' }}></i>
                    </div>
                </div>
                <div id="explorer-content" className="sidebar-content" style={{ display: 'flex', flexDirection: 'column', padding: '0 0 10px 0', overflowY: 'auto' }}>
                    {fileTree.length > 0 ? (
                        <div className="file-tree" style={{ width: '100%' }}>
                            {fileTree.map(entry => (
                                <FileTreeItem key={entry.path} entry={entry} depth={0} />
                            ))}
                        </div>
                    ) : (
                        <>
                            <div style={{ padding: '20px', textAlign: 'center', opacity: 0.6, fontSize: '12px' }}>
                                You have not yet opened a folder.
                            </div>
                            <button
                                className="primary-button"
                                id="explorer-open-folder"
                                onClick={handleOpenFolder}
                                style={{ background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)', border: 'none', padding: '6px 10px', borderRadius: '2px', cursor: 'pointer', fontSize: '13px', margin: '0 20px' }}
                            >Open Folder</button>
                        </>
                    )}
                </div>
            </div>

            <div id="agent-view" className={`sidebar-section ${activeView === 'agent-view' ? '' : 'hidden'}`}>
                <div className="sidebar-section-header">AGENT SETTINGS</div>
                <div className="sidebar-content" style={{ padding: '15px' }}>
                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', color: 'var(--vscode-sideBar-foreground)', opacity: 0.8, fontSize: '11px' }}>OpenAI API Key</label>
                        <input type="password" value={openAIKey} onChange={(e) => setOpenAIKey(e.target.value)} id="openai-api-key" placeholder="sk-..." style={{ width: '100%', boxSizing: 'border-box', background: 'var(--vscode-input-background)', color: 'var(--vscode-sideBar-foreground)', border: '1px solid transparent', padding: '4px 6px', fontSize: '12px', outline: 'none' }} />
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', color: 'var(--vscode-sideBar-foreground)', opacity: 0.8, fontSize: '11px' }}>Anthropic API Key</label>
                        <input type="password" value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)} id="anthropic-api-key" placeholder="sk-ant-..." style={{ width: '100%', boxSizing: 'border-box', background: 'var(--vscode-input-background)', color: 'var(--vscode-sideBar-foreground)', border: '1px solid transparent', padding: '4px 6px', fontSize: '12px', outline: 'none' }} />
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', color: 'var(--vscode-sideBar-foreground)', opacity: 0.8, fontSize: '11px' }}>Google API Key</label>
                        <input type="password" value={googleKey} onChange={(e) => setGoogleKey(e.target.value)} id="google-api-key" placeholder="AIza..." style={{ width: '100%', boxSizing: 'border-box', background: 'var(--vscode-input-background)', color: 'var(--vscode-sideBar-foreground)', border: '1px solid transparent', padding: '4px 6px', fontSize: '12px', outline: 'none' }} />
                    </div>
                    <button className="primary-button" id="save-api-keys" onClick={saveKeys} style={{ width: '100%', marginTop: '10px', background: 'var(--vscode-statusBar-background)', color: '#fff', border: 'none', padding: '6px', cursor: 'pointer', fontSize: '12px' }}>Save Keys</button>
                    {statusMessage && <div id="api-key-status" style={{ marginTop: '10px', fontSize: '11px', textAlign: 'center', color: '#89d185' }}>{statusMessage}</div>}
                </div>
            </div>

            <div id="search-view" className={`sidebar-section ${activeView === 'search-view' ? '' : 'hidden'}`}>
                <div className="sidebar-section-header">SEARCH</div>
                <div className="sidebar-search-container">
                    <input type="text" id="search-input" placeholder="Search" />
                </div>
                <div id="search-results" className="sidebar-content"></div>
            </div>

            <div id="extensions-view" className={`sidebar-section ${activeView === 'extensions-view' ? '' : 'hidden'}`}>
                <div className="sidebar-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>EXTENSIONS</div>
                    <div className="extensions-actions" style={{ marginRight: '10px' }}>
                        <i className="codicon codicon-cloud-upload" id="install-vsix-btn" title="Install from VSIX..." style={{ cursor: 'pointer', fontSize: '14px' }}></i>
                    </div>
                </div>
                <div className="sidebar-search-container" style={{ padding: '10px' }}>
                    <input type="text" id="extensions-search-input" placeholder="Search Extensions in Marketplace" style={{ width: '100%', boxSizing: 'border-box', background: 'var(--vscode-input-background)', color: 'var(--vscode-sideBar-foreground)', border: '1px solid transparent', padding: '4px 6px', fontSize: '13px', outline: 'none' }} />
                </div>
                <div id="extensions-content" className="sidebar-content sidebar-accordion">
                    <div className="accordion-header" id="installed-accordion-header">
                        <i className="codicon codicon-chevron-down accordion-icon"></i>
                        <span className="accordion-title">Installed</span>
                    </div>
                    <div id="installed-extensions-list" className="accordion-content"></div>
                    <div className="accordion-header" id="marketplace-accordion-header">
                        <i className="codicon codicon-chevron-down accordion-icon"></i>
                        <span className="accordion-title">Marketplace</span>
                    </div>
                    <div id="marketplace-extensions-list" className="accordion-content"></div>
                </div>
            </div>

            <div id="specs-view" className={`sidebar-section ${activeView === 'specs-view' ? '' : 'hidden'}`}>
                <div className="sidebar-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><i className="codicon codicon-chevron-down" style={{ marginRight: '4px' }}></i> SPECS</div>
                    <div className="specs-actions" style={{ marginRight: '10px' }}>
                        <i className="codicon codicon-add" id="new-spec" title="New Spec" style={{ cursor: 'pointer' }}></i>
                    </div>
                </div>
                <div id="specs-content" className="sidebar-content" style={{ padding: '10px' }}>
                    <div className="specs-empty" id="specs-empty" style={{ fontSize: '12px', opacity: 0.6, fontStyle: 'italic' }}>No active specs. Create one to start a structured workflow.</div>
                    <div id="specs-list" className="specs-list"></div>
                </div>
            </div>

            <div id="mobile-view" className={`sidebar-section ${activeView === 'mobile-view' ? '' : 'hidden'}`}>
                <div className="sidebar-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><i className="codicon codicon-chevron-down" style={{ marginRight: '4px' }}></i> MOBILE (ADB)</div>
                    <div className="mobile-actions" style={{ marginRight: '10px' }}>
                        <i className="codicon codicon-refresh" id="refresh-adb" title="Refresh ADB" style={{ cursor: 'pointer' }}></i>
                    </div>
                </div>
                <div id="mobile-content" className="sidebar-content" style={{ padding: '10px' }}>
                    <div className="specs-empty" id="no-devices-msg">No Android devices connected.</div>
                    <div id="device-list" className="device-list"></div>
                </div>
            </div>

            <div id="source-control-view" className={`sidebar-section ${activeView === 'scm-view' ? '' : 'hidden'}`}>
                <div className="sidebar-section-header">SOURCE CONTROL</div>
                <div className="sidebar-search-container">
                    <input type="text" id="scm-input" placeholder="Message (Cmd+Enter to commit)" />
                </div>
                <div id="scm-changes" className="sidebar-content"></div>
            </div>

            <div id="debug-view" className={`sidebar-section ${activeView === 'debug-view' ? '' : 'hidden'}`}>
                <div className="sidebar-section-header">RUN AND DEBUG</div>
                <div className="debug-controls">
                    <button id="start-debug" className="debug-btn primary">Start Debugging</button>
                </div>
                <div id="debug-content" className="sidebar-content">
                    <div className="debug-section">
                        <div className="debug-section-header"><i className="codicon codicon-chevron-right" style={{ marginRight: '4px' }}></i> VARIABLES</div>
                        <div id="debug-variables" className="debug-section-content"></div>
                    </div>
                    <div className="debug-section">
                        <div className="debug-section-header"><i className="codicon codicon-chevron-right" style={{ marginRight: '4px' }}></i> WATCH</div>
                        <div id="debug-watch" className="debug-section-content"></div>
                    </div>
                    <div className="debug-section">
                        <div className="debug-section-header"><i className="codicon codicon-chevron-down" style={{ marginRight: '4px' }}></i> CALL STACK</div>
                        <div id="debug-callstack" className="debug-section-content"></div>
                    </div>
                    <div className="debug-section">
                        <div className="debug-section-header"><i className="codicon codicon-chevron-down" style={{ marginRight: '4px' }}></i> BREAKPOINTS</div>
                        <div id="debug-breakpoints" className="debug-section-content"></div>
                    </div>
                </div>
            </div>

            <div id="planning-view" className={`sidebar-section ${activeView === 'planning-view' ? '' : 'hidden'}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="sidebar-section-header">WORKFLOW & PLANNING</div>
                <div id="planning-content" className="sidebar-content" style={{ padding: '10px' }}>
                    <div style={{ color: 'var(--vscode-sideBar-foreground)', opacity: 0.6, fontSize: '11px', marginBottom: '10px' }}>ACTIVE TASK BOUNDARY</div>
                    <div style={{ background: 'var(--vscode-editor-background)', border: '1px solid var(--vscode-panel-border)', borderRadius: '4px', padding: '10px' }}>
                        <h4 style={{ color: '#fff', fontSize: '13px', marginBottom: '5px' }}>Implementation Plan</h4>
                        <p style={{ color: 'var(--vscode-sideBar-foreground)', opacity: 0.8, fontSize: '12px' }}>Draft architectures and step-by-step checklists here.</p>
                        <button id="plan-generate" style={{ marginTop: '10px', background: 'var(--vscode-activityBar-background)', color: '#ccc', border: '1px solid var(--vscode-panel-border)', padding: '4px 8px', borderRadius: '2px', cursor: 'pointer', fontSize: '11px' }}>Generate Plan</button>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
