import React, { useEffect, useState, useRef, useMemo } from 'react';
import { marked } from 'marked';
import { useStore } from '../store';
import type { FileEntry } from '../store';
import { invoke } from '../tauri_bridge';
import AgentSettingsView from './AgentSettingsView';

const SidebarPane: React.FC<{ title: string; children: React.ReactNode; defaultCollapsed?: boolean; actions?: React.ReactNode }> = ({ title, children, defaultCollapsed = false, actions }) => {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
    return (
        <div className="sidebar-pane" style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div 
                className={`pane-header${isCollapsed ? ' collapsed' : ''}`} 
                onClick={() => setIsCollapsed(!isCollapsed)}
                style={{ 
                    padding: '6px 10px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    cursor: 'pointer',
                    background: 'rgba(255,255,255,0.02)',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--vscode-sideBar-foreground)',
                    opacity: 0.8
                }}
            >
                <i className={`codicon codicon-chevron-${isCollapsed ? 'right' : 'down'}`} style={{ marginRight: '8px', fontSize: '12px' }}></i>
                <span style={{ flex: 1 }}>{title}</span>
                {actions && <div className="pane-actions" onClick={e => e.stopPropagation()}>{actions}</div>}
            </div>
            {!isCollapsed && <div className="pane-content" style={{ padding: '8px 0' }}>{children}</div>}
        </div>
    );
};

// Configure marked options
marked.setOptions({
    gfm: true,
    breaks: true,
    silent: true
});

const RightSidebar: React.FC = () => {
    const isOpen = useStore(state => state.isRightSidebarOpen);
    const toggle = useStore(state => state.toggleRightSidebar);
    const aiStatus = useStore(state => state.aiStatus || 'idle');
    const [view, setView] = useState<'chat' | 'history' | 'settings'>('chat');
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const mode = useStore(state => state.agentMode);
    const model = useStore(state => state.agentModel);
    const messages = useStore(state => state.agentMessages);
    const isAgentThinking = useStore(state => state.isAgentThinking);
    const addAgentMessage = useStore(state => state.addAgentMessage);
    const updateLastAgentMessage = useStore(state => state.updateLastAgentMessage);
    const addAgentStep = useStore(state => state.addAgentStep);
    const updateAgentStepStatus = useStore(state => state.updateAgentStepStatus);
    const setIsAgentThinking = useStore(state => state.setIsAgentThinking);
    const clearAgentMessages = useStore(state => state.clearAgentMessages);
    const resetThread = useStore(state => state.resetThread);
    const pendingChanges = useStore(state => state.pendingChanges);
    const acceptPendingChange = useStore(state => state.acceptPendingChange);
    const rejectPendingChange = useStore(state => state.rejectPendingChange);
    const addAgentFile = useStore(state => state.addAgentFile);
    const addAgentArtifact = useStore(state => state.addAgentArtifact);
    const [inputValue, setInputValue] = useState('');
    const [isMentionDropdownOpen, setIsMentionDropdownOpen] = useState(false);
    const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
    const truncateAgentMessages = useStore(state => state.truncateAgentMessages);
    const attachedContext = useStore(state => state.attachedContext);
    const addAttachedContext = useStore(state => state.addAttachedContext);
    const removeAttachedContext = useStore(state => state.removeAttachedContext);
    const clearAttachedContext = useStore(state => state.clearAttachedContext);
    const fileTree = useStore(state => state.fileTree);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const allFiles = useMemo(() => {
        const flatten = (entries: FileEntry[]): FileEntry[] => {
            let res: FileEntry[] = [];
            for (const e of entries) {
                if (!e.is_dir) res.push(e);
                if (e.children) res.push(...flatten(e.children));
            }
            return res;
        };
        return flatten(fileTree);
    }, [fileTree]);

    const filteredSuggestions = useMemo(() => {
        const lastWord = inputValue.split(/\s+/).pop() || '';
        if (!lastWord.startsWith('@')) return [];
        const query = lastWord.slice(1).toLowerCase();
        return allFiles.filter(f => f.name.toLowerCase().includes(query)).slice(0, 10);
    }, [inputValue, allFiles]);

    useEffect(() => {
        return () => {};
    }, []);

    useEffect(() => {
        const container = document.querySelector('.right-sidebar-content');
        if (container) {
            const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
            if (isNearBottom) {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }, [messages]);

    if (!isOpen) return null;

    const onRefresh = () => {
        clearAgentMessages();
        invoke('set_ai_status', { status: 'alive' }).catch(console.error);
    };

    const onSend = async () => {
        const val = inputValue.trim();
        if (val && !isAgentThinking) {
            setInputValue("");
            setIsMentionDropdownOpen(false);
            if (inputRef.current) inputRef.current.style.height = 'auto';
            
            const context = [...attachedContext];
            setIsAgentThinking(true);
            addAgentMessage('user', val, context);
            clearAttachedContext();
            addAgentMessage('assistant', "");
            
            try {
                const m = await import('../agent');
                await m.sendAgentMessage(val, () => {});
            } catch (err: any) {
                console.error('Agent chat failed:', err);
                const errorMsg = err.message || JSON.stringify(err);
                updateLastAgentMessage(`Error: ${errorMsg}`);
            } finally {
                setIsAgentThinking(false);
            }
        }
    };

    const onModeClick = (e: React.MouseEvent) => {
        const target = e.currentTarget as HTMLElement;
        import('../agent').then(m => m.openModeDropdown(target, () => {}));
    };

    const onModelClick = (e: React.MouseEvent) => {
        const target = e.currentTarget as HTMLElement;
        import('../agent').then(m => m.openModelDropdown(target, () => {}));
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                addAttachedContext({
                    type: file.type.startsWith('image/') ? 'attachment' : 'file',
                    id: `dropped-${Date.now()}-${i}`,
                    name: file.name,
                    path: (file as any).path || file.name
                });
            }
        }
    };

    const handleMentionSelect = (file: FileEntry) => {
        const words = inputValue.split(/\s+/);
        words[words.length - 1] = `@${file.name}`;
        const newValue = words.join(' ') + ' ';
        setInputValue(newValue);
        setIsMentionDropdownOpen(false);
        addAttachedContext({
            id: file.path,
            type: 'file',
            name: file.name,
            path: file.path
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (isMentionDropdownOpen && filteredSuggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedMentionIndex(prev => (prev + 1) % filteredSuggestions.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedMentionIndex(prev => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                handleMentionSelect(filteredSuggestions[selectedMentionIndex]);
            } else if (e.key === 'Escape') {
                setIsMentionDropdownOpen(false);
            }
        } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setInputValue(val);

        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
        }

        const lastWord = val.split(/\s+/).pop() || '';
        setIsMentionDropdownOpen(lastWord.startsWith('@'));
        setSelectedMentionIndex(0);
    };

    return (
        <aside 
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="right-sidebar antigravity-glass" id="right-sidebar">
            <style>{`
                .agent-message-container:hover .message-actions {
                    opacity: 1 !important;
                }
                .hoverable:hover {
                    background: rgba(255,255,255,0.1) !important;
                    color: #fff;
                }
                .markdown-content p { margin: 0 0 1em 0; }
                .markdown-content p:last-child { margin-bottom: 0; }
                .markdown-content pre { 
                    background: rgba(0,0,0,0.3); 
                    padding: 12px; 
                    border-radius: 8px; 
                    overflow-x: auto;
                    border: 1px solid rgba(255,255,255,0.05);
                    margin: 12px 0;
                }
                .markdown-content code {
                    font-family: var(--font-mono);
                    background: rgba(255,255,255,0.1);
                    padding: 2px 4px;
                    border-radius: 4px;
                    font-size: 0.9em;
                }
                .markdown-content pre code {
                    background: transparent;
                    padding: 0;
                    border-radius: 0;
                }
                .markdown-content ul, .markdown-content ol {
                    margin: 0 0 1em 0;
                    padding-left: 20px;
                }
                .markdown-content h1, .markdown-content h2, .markdown-content h3 {
                    margin: 1.5em 0 0.5em 0;
                    font-weight: 600;
                    color: #fff;
                }
                .markdown-content h1:first-child, .markdown-content h2:first-child, .markdown-content h3:first-child {
                    margin-top: 0;
                }
            `}</style>

            <div className="right-sidebar-header" style={{ 
                height: '48px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '0 18px', 
                background: 'var(--vscode-editor-background)', 
                borderBottom: '1px solid var(--vscode-panel-border, rgba(255,255,255,0.06))',
                position: 'sticky',
                top: 0,
                zIndex: 100
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%', 
                        background: aiStatus === 'alive' ? '#4ade80' : '#ef4444',
                        boxShadow: aiStatus === 'alive' ? '0 0 12px rgba(74, 222, 128, 0.5)' : 'none',
                        transition: 'all 0.3s ease'
                    }}></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#fff', opacity: 0.9, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                            {view === 'chat' ? 'ANTIGRAVITY' : view.toUpperCase()}
                        </span>
                        {view === 'chat' && (
                            <span style={{ 
                                fontSize: '9px', 
                                fontWeight: 700, 
                                opacity: 0.35, 
                                letterSpacing: '0.04em',
                                background: 'rgba(255,255,255,0.05)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: '1px solid rgba(255,255,255,0.05)'
                            }}>
                                PRIVACY-FIRST
                            </span>
                        )}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <i className="codicon codicon-add hoverable-scale" title="New Chat" onClick={clearAgentMessages} style={{ fontSize: '15px', opacity: 0.6, cursor: 'pointer' }}></i>
                    <i className="codicon codicon-history hoverable-scale" title="History" onClick={() => setView('history')} style={{ fontSize: '15px', opacity: view === 'history' ? 1 : 0.6, color: view === 'history' ? '#3b82f6' : 'inherit', cursor: 'pointer' }}></i>
                    <i 
                        className="codicon codicon-more hoverable-scale" 
                        title="More" 
                        onClick={(e) => {
                            const target = e.currentTarget as HTMLElement;
                            const rect = target.getBoundingClientRect();
                            const menu = document.createElement('div');
                            menu.className = 'antigravity-glass dropdown-menu';
                            menu.style.cssText = `position:fixed; top:${rect.bottom + 5}px; right:${window.innerWidth - rect.right}px; z-index:10000; padding:4px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); width:160px; background: rgba(30,30,35,0.95); backdrop-filter: blur(10px);`;
                            
                            const addItem = (label: string, icon: string, action: () => void) => {
                                const item = document.createElement('div');
                                item.className = 'hoverable';
                                item.style.cssText = 'padding:6px 10px; font-size:12px; display:flex; gap:8px; align-items:center; cursor:pointer; border-radius:4px;';
                                item.innerHTML = `<i class="codicon codicon-${icon}" style="font-size:14px; opacity:0.7"></i><span>${label}</span>`;
                                item.onclick = () => { action(); document.body.removeChild(menu); };
                                menu.appendChild(item);
                            };

                            addItem('Reset Thread', 'sync', () => resetThread());
                            addItem('Export Chat', 'export', () => {});
                            addItem('Clean Context', 'trash', () => clearAttachedContext());
                            addItem('Settings', 'settings-gear', () => setView('settings'));
                            
                            document.body.appendChild(menu);
                            const closeMenu = (ev: MouseEvent) => {
                                if (!menu.contains(ev.target as Node) && ev.target !== target) {
                                    document.body.removeChild(menu);
                                    window.removeEventListener('click', closeMenu);
                                }
                            };
                            window.addEventListener('click', closeMenu);
                        }}
                        style={{ fontSize: '15px', opacity: 0.6, cursor: 'pointer' }}
                    ></i>
                    <i className="codicon codicon-chrome-close hoverable-scale" title="Close" onClick={toggle} style={{ fontSize: '16px', opacity: 0.6, cursor: 'pointer' }}></i>
                </div>
            </div>

            {view === 'chat' && (
                <div className="right-sidebar-content" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', scrollbarWidth: 'thin' }}>
                    {/* Active Task Summary Card */}
                    {(isAgentThinking || messages.length > 0) && (
                        <div className="task-summary-card" style={{
                            margin: '16px',
                            padding: '20px',
                            background: 'rgba(59, 130, 246, 0.08)',
                            borderRadius: '16px',
                            border: '1px solid rgba(59, 130, 246, 0.15)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Integrating Antigravity IDE Features</div>
                                <div style={{ 
                                    background: isAgentThinking ? '#007acc' : '#16825d', 
                                    color: '#fff', 
                                    fontSize: '9px', 
                                    padding: '2px 8px', 
                                    borderRadius: '10px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase'
                                }}>
                                    {isAgentThinking ? 'Executing' : 'Completed'}
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                                <div style={{
                                    width: '16px',
                                    height: '16px',
                                    border: '2px solid rgba(255,255,255,0.1)',
                                    borderTop: '2px solid #007acc',
                                    borderRadius: '50%',
                                    animation: isAgentThinking ? 'spin 1s linear infinite' : 'none'
                                }}></div>
                                <span>{isAgentThinking ? 'Updating UI components to match VS Code reference...' : 'Waiting for next task'}</span>
                            </div>

                            <div style={{ marginTop: '4px' }}>
                                <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.4, marginBottom: '8px', fontWeight: 800 }}>Files Edited</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {[
                                        '/Users/hades/Desktop/vscodium-rust/src/components/BottomPanel.tsx',
                                        '/Users/hades/Desktop/vscodium-rust/src/components/StatusBar.tsx',
                                        '/Users/hades/Desktop/vscodium-rust/src/components/terminal/TerminalView.tsx'
                                    ].map(file => (
                                        <div key={file} style={{ 
                                            fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px', 
                                            background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '4px',
                                            cursor: 'pointer'
                                        }} onClick={() => invoke('open_file', { path: file })}>
                                            <i className="codicon codicon-file-code" style={{ fontSize: '12px', opacity: 0.5 }}></i>
                                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.split('/').pop()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div id="agent-messages" style={{ flex: 1, padding: '16px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '200px' }}>
                        {messages.length === 0 && !isAgentThinking && (
                            <div style={{ textAlign: 'center', marginTop: '40px', opacity: 0.4 }}>
                                <i className="codicon codicon-sparkle-filled" style={{ fontSize: '32px', marginBottom: '12px', display: 'block' }}></i>
                                <p style={{ fontSize: '12px' }}>How can I help you build today?</p>
                            </div>
                        )}
                    
                        {messages.map((msg, idx) => (
                            <div key={idx} className="agent-message-container" style={{ position: 'relative', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', opacity: 0.6 }}>
                                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: msg.role === 'user' ? 'var(--vscode-button-background)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                                        <i className={`codicon codicon-${msg.role === 'user' ? 'person' : 'sparkle'}`} style={{ fontSize: '11px', color: msg.role === 'user' ? '#fff' : '#000' }}></i>
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : '#fff' }}>
                                        {msg.role === 'assistant' ? (model.split('|')[1] || model).split(':')[0] : 'YOU'}
                                    </span>
                                </div>
                                <div className={`agent-message ${msg.role === 'user' ? 'user-message-box' : 'assistant-message-box'}`} style={{
                                    background: msg.role === 'user' ? 'rgba(59, 130, 246, 0.06)' : 'rgba(255, 255, 255, 0.03)',
                                    padding: '16px 20px',
                                    borderRadius: '18px',
                                    border: msg.role === 'user' ? '1px solid rgba(59, 130, 246, 0.12)' : '1px solid rgba(255, 255, 255, 0.05)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '14px',
                                    position: 'relative',
                                    backdropFilter: 'blur(10px)'
                                }}>
                                    <div className="message-actions" style={{
                                        position: 'absolute',
                                        top: '10px',
                                        right: '10px',
                                        display: 'flex',
                                        gap: '6px',
                                        opacity: 0,
                                        transition: 'opacity 0.2s ease',
                                        zIndex: 5
                                    }}>
                                        <i className="codicon codicon-copy hoverable-scale" title="Copy Message" onClick={() => navigator.clipboard.writeText(msg.content)} style={{ fontSize: '14px', padding: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)' }}></i>
                                        <i className="codicon codicon-edit hoverable-scale" title="Edit Message" onClick={() => {
                                            if (inputRef.current) {
                                                inputRef.current.value = msg.content;
                                                inputRef.current.focus();
                                                truncateAgentMessages(idx);
                                            }
                                        }} style={{ fontSize: '14px', padding: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)' }}></i>
                                    </div>
                                    {/* Text content - markdown rendered for assistant */}
                                    {msg.role === 'user' ? (
                                        <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', lineHeight: '1.6', color: 'rgba(255,255,255,0.92)', fontSize: '13px' }}>
                                            {msg.content || null}
                                        </div>
                                    ) : (
                                        msg.content ? (
                                            <div
                                                className="markdown-content"
                                                style={{ wordBreak: 'break-word', lineHeight: '1.7', color: 'rgba(255,255,255,0.92)', fontSize: '13px' }}
                                                dangerouslySetInnerHTML={{ 
                                                    __html: marked.parse(
                                                        typeof msg.content === 'string' 
                                                            ? msg.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim() 
                                                            : String(msg.content)
                                                    ) as string 
                                                }}
                                            />
                                        ) : null
                                    )}

                                    {msg.role === 'assistant' && msg.steps && msg.steps.length > 0 && (
                                        <div className="agent-activity-section" style={{ marginTop: '8px', padding: '10px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <div className="section-title" style={{ fontSize: '10px', fontWeight: 700, opacity: 0.4, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Technical Steps</div>
                                            <div className="progress-stepper" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: '14px' }}>
                                                {msg.steps.map((step: any, sIdx: number) => (
                                                <div key={sIdx} className="progress-step" style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px', fontSize: '11px' }}>
                                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                        <i className={`codicon codicon-${step.status === 'running' ? 'loading' : step.status === 'error' ? 'error' : 'pass-filled'}`} 
                                                            style={{ 
                                                                color: step.status === 'running' ? '#3b82f6' : step.status === 'error' ? '#ef4444' : '#10b981', 
                                                                animation: step.status === 'running' ? 'spin 1.5s linear infinite' : 'none',
                                                                fontSize: '12px',
                                                                flexShrink: 0
                                                            }}></i>
                                                        <span style={{ opacity: step.status === 'running' ? 1 : 0.7 }}>{step.status === 'running' ? 'Running' : 'Executed'} <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: '3px', color: '#93c5fd', fontSize: '10.5px' }}>{step.name}</code></span>
                                                    </div>
                                                </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {msg.role === 'assistant' && (
                                        <>
                                            {msg.steps && msg.steps.length > 0 && (
                                                <div className="agent-activity-section" style={{ marginTop: '8px', padding: '10px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <div className="section-title" style={{ fontSize: '10px', fontWeight: 700, opacity: 0.4, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Technical Steps</div>
                                                    <div className="progress-stepper" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: '14px' }}>
                                                        {msg.steps.map((step: any, sIdx: number) => (
                                                        <div key={sIdx} className="progress-step" style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px', fontSize: '11px' }}>
                                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                                <i className={`codicon codicon-${step.status === 'running' ? 'loading' : step.status === 'error' ? 'error' : 'pass-filled'}`} 
                                                                   style={{ 
                                                                       color: step.status === 'running' ? '#3b82f6' : step.status === 'error' ? '#ef4444' : '#10b981', 
                                                                       animation: step.status === 'running' ? 'spin 1.5s linear infinite' : 'none',
                                                                       fontSize: '12px',
                                                                       flexShrink: 0
                                                                   }}></i>
                                                                <span style={{ opacity: step.status === 'running' ? 1 : 0.7 }}>{step.status === 'running' ? 'Running' : 'Executed'} <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: '3px', color: '#93c5fd', fontSize: '10.5px' }}>{step.name}</code></span>
                                                            </div>
                                                              {step.result && step.status !== 'running' && (
                                                                <div style={{ 
                                                                    marginLeft: '22px',
                                                                    padding: '8px 12px',
                                                                    background: step.status === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(0,0,0,0.25)',
                                                                    border: `1px solid ${step.status === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)'}`,
                                                                    borderRadius: '8px',
                                                                    fontFamily: 'var(--font-mono)',
                                                                    fontSize: '11px',
                                                                    color: step.status === 'error' ? '#f87171' : 'rgba(255,255,255,0.65)',
                                                                    whiteSpace: 'pre-wrap',
                                                                    wordBreak: 'break-word',
                                                                    maxHeight: '600px',
                                                                    overflowY: 'auto',
                                                                    lineHeight: '1.5'
                                                                }}>
                                                                    {step.result}
                                                                </div>
                                                              )}
                                                        </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {msg.files && msg.files.length > 0 && (
                                                <div className="agent-activity-section" style={{ marginTop: '4px' }}>
                                                    <div className="section-title" style={{ fontSize: '10px', fontWeight: 700, opacity: 0.4, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Files Affected</div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        {msg.files.map((file: string, fIdx: number) => (
                                                            <div key={fIdx} style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.7, cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)' }} onClick={() => invoke('open_file', { path: file })}>
                                                                <i className="codicon codicon-file-code" style={{ opacity: 0.4, fontSize: '12px' }}></i>
                                                                <span style={{ fontWeight: 500 }}>{file.split('/').pop()}</span>
                                                                <span style={{ fontSize: '9px', opacity: 0.3, marginLeft: 'auto', fontFamily: 'monospace' }}>{file.replace(/\/Users\/[^\/]+/, '~')}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {msg.artifacts && msg.artifacts.length > 0 && (
                                                <div className="agent-activity-section" style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                                    {msg.artifacts.map((artifact: any, aIdx: number) => (
                                                        <button key={aIdx} onClick={() => invoke('open_file', { path: artifact.path })} style={{ flex: 1, padding: '10px 14px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '10px', fontSize: '11px', fontWeight: 600, color: '#93c5fd', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                                            <i className={`codicon codicon-${artifact.type === 'walkthrough' ? 'checklist' : 'tasklist'}`} style={{ fontSize: '14px' }}></i>
                                                            {artifact.type === 'walkthrough' ? 'View Walkthrough' : 'View Task List'}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                </div>
            )}

            {view === 'history' && (
                <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                    <i className="codicon codicon-history" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>No Chat History</div>
                    <div style={{ fontSize: '12px', textAlign: 'center', marginTop: '8px' }}>Your past conversations will appear here once saved.</div>
                </div>
            )}

            {view === 'settings' && (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderBottom: '1px solid var(--vscode-panel-border)', background: 'rgba(30,30,30,0.4)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 10, width: '100%', boxSizing: 'border-box' }}>
                        <div onClick={() => setView('chat')} className="hoverable" style={{ cursor: 'pointer', opacity: 0.6, fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', flexShrink: 0 }}>
                            {(model.split('|')[1] || model).split(':')[0]}
                        </div>
                        <div style={{ opacity: 0.3, fontSize: '10px', flexShrink: 0 }}>/</div>
                        <div className="active-breadcrumb" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--vscode-button-background)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>SETTINGS</div>
                    </div>
                    <AgentSettingsView />
                </div>
            )}

            {view === 'chat' && (
                <div className="agent-input-section" style={{ 
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {/* Redesigned Pending Changes Row */}
                    {pendingChanges.length >= 0 && (
                        <div style={{ 
                            padding: '10px 16px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            borderTop: '1px solid rgba(255,255,255,0.06)',
                            background: 'transparent'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', opacity: 0.6 }}>
                                <i className="codicon codicon-files" style={{ fontSize: '14px' }}></i>
                                <span>{pendingChanges.length} Files With Changes</span>
                            </div>
                            <div 
                                onClick={() => useStore.getState().acceptAllPendingChanges()} 
                                style={{ 
                                    display: 'flex', alignItems: 'center', gap: '6px', 
                                    fontSize: '11px', opacity: 0.6, cursor: 'pointer' 
                                }}
                            >
                                <i className="codicon codicon-diff" style={{ fontSize: '14px' }}></i>
                                <span>Review Changes</span>
                            </div>
                        </div>
                    )}

                    <div style={{ padding: '0 12px 12px 12px' }}>
                        <div 
                            className="agent-input-wrapper" 
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                            style={{ 
                                background: 'rgba(255,255,255,0.03)', 
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '14px',
                                display: 'flex', 
                                flexDirection: 'column', 
                                overflow: 'hidden',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                padding: '12px'
                            }}>
                            
                            {/* Attached Context Chips */}
                            {attachedContext.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                                    {attachedContext.map((item, idx) => (
                                        <div key={idx} style={{ 
                                            display: 'flex', alignItems: 'center', gap: '6px', 
                                            padding: '3px 8px', background: 'rgba(255,255,255,0.05)', 
                                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
                                            fontSize: '10px', color: 'rgba(255,255,255,0.8)'
                                        }}>
                                            <i className={`codicon codicon-${item.type === 'attachment' ? 'file-media' : item.type === 'file' ? 'file' : 'mention'}`} style={{ fontSize: '10px', opacity: 0.6 }}></i>
                                            <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                                            <i className="codicon codicon-close" 
                                               onClick={(e) => { e.stopPropagation(); removeAttachedContext(idx); }}
                                               style={{ fontSize: '10px', cursor: 'pointer', opacity: 0.4 }}
                                               title="Remove"></i>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <textarea 
                                ref={inputRef}
                                value={inputValue}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask anything, @ to mention, / for workflows" 
                                style={{ 
                                    width: '100%',
                                    minHeight: '20px', background: 'transparent', border: 'none', 
                                    outline: 'none', color: '#fff', fontSize: '13.5px', 
                                    resize: 'none', padding: 0, lineHeight: '1.5',
                                    fontFamily: 'inherit',
                                    opacity: 0.8
                                }}
                            />

                            <div style={{ 
                                display: 'flex', alignItems: 'center', marginTop: '12px',
                                justifyContent: 'space-between'
                            }}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <i className="codicon codicon-add" 
                                       onClick={(e) => {
                                           const target = e.currentTarget as HTMLElement;
                                           import('../agent').then(m => m.openContextDropdown(target, (type: any, name, data) => {
                                               addAttachedContext({ type, name, data, id: `${type}-${name}-${Date.now()}` });
                                           }));
                                       }} 
                                       style={{ fontSize: '16px', opacity: 0.4, cursor: 'pointer' }} 
                                       title="Add Context"></i>
                                    
                                    <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.08)', margin: '0 4px' }}></div>

                                    <div 
                                        onClick={onModeClick}
                                        style={{ 
                                            fontSize: '11px', opacity: 0.6, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '4px',
                                            padding: '2px 4px', borderRadius: '4px'
                                        }}
                                        className="hoverable-bg"
                                    >
                                        <i className="codicon codicon-chevron-up" style={{ fontSize: '9px', opacity: 0.5 }}></i>
                                        <span style={{ fontWeight: 500 }}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
                                    </div>

                                    <div 
                                        onClick={onModelClick}
                                        style={{ 
                                            fontSize: '11px', opacity: 0.6, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '4px',
                                            padding: '2px 4px', borderRadius: '4px'
                                        }}
                                        className="hoverable-bg"
                                    >
                                        <i className="codicon codicon-chevron-up" style={{ fontSize: '9px', opacity: 0.5 }}></i>
                                        <span>{(model.split('|')[1] || model).split(':')[0] || model}</span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    {/* Mic icon stays same */}
                                    <i className="codicon codicon-mic" style={{ fontSize: '16px', opacity: 0.4, cursor: 'pointer' }}></i>
                                    <div 
                                        onClick={onSend} 
                                        style={{ 
                                            width: '26px', height: '26px', borderRadius: '50%', 
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: inputValue.trim() ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.1)',
                                            color: inputValue.trim() ? '#000' : 'rgba(255,255,255,0.3)',
                                            cursor: inputValue.trim() ? 'pointer' : 'default',
                                            transition: 'all 0.2s ease'
                                        }}>
                                        <i className="codicon codicon-arrow-right" style={{ fontSize: '14px' }}></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
};

export default RightSidebar;
