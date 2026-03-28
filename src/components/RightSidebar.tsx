import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '../store';
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
                    padding: '8px 12px', 
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

const RightSidebar: React.FC = () => {
    const isOpen = useStore(state => state.isRightSidebarOpen);
    const toggle = useStore(state => state.toggleRightSidebar);
    const aiStatus = useStore(state => state.aiStatus || 'idle');
    const [view, setView] = useState<'chat' | 'history' | 'settings'>('chat');
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const mode = useStore(state => state.agentMode);
    const model = useStore(state => state.agentModel);
    const messages = useStore(state => state.agentMessages);
    const isThinking = useStore(state => state.isAgentThinking);
    const addAgentMessage = useStore(state => state.addAgentMessage);
    const updateLastAgentMessage = useStore(state => state.updateLastAgentMessage);
    const addAgentStep = useStore(state => state.addAgentStep);
    const updateAgentStepStatus = useStore(state => state.updateAgentStepStatus);
    const setIsAgentThinking = useStore(state => state.setIsAgentThinking);
    const clearAgentMessages = useStore(state => state.clearAgentMessages);
    const addAgentFile = useStore(state => state.addAgentFile);
    const addAgentArtifact = useStore(state => state.addAgentArtifact);
    const truncateAgentMessages = useStore(state => state.truncateAgentMessages);
    const activeRootName = useStore(state => state.activeRootName);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let unlistenFuncs: (() => void)[] = [];

        const setupListeners = async () => {
            const bridge = await import('../tauri_bridge');
            
            const u1 = await bridge.listen('ai-content', (event: any) => {
                console.log('AI Content Event received:', event.payload.content.length, 'chars');
                setIsAgentThinking(false);
                updateLastAgentMessage(event.payload.content);
            });
            unlistenFuncs.push(u1);

            const u2 = await bridge.listen('ai-tool-call', (event: any) => {
                addAgentStep(event.payload.name);
            });
            unlistenFuncs.push(u2);

            const u3 = await bridge.listen('ai-tool-result', (event: any) => {
                const { name, result } = event.payload;
                updateAgentStepStatus(name, result.includes('Error') ? 'error' : 'success');
                
                if (name === 'ai_modify_file' || name === 'create_file' || name === 'write_file') {
                    const args = JSON.parse(event.payload.args || '{}');
                    if (args.path) addAgentFile(args.path);
                }

                if (name === 'write_to_file') {
                    const args = JSON.parse(event.payload.args || '{}');
                    if (args.TargetFile && args.TargetFile.includes('.md')) {
                        const type = args.TargetFile.includes('walkthrough') ? 'walkthrough' : 
                                     args.TargetFile.includes('task') ? 'task' : null;
                        if (type) addAgentArtifact(type, args.TargetFile);
                    }
                }
            });
            unlistenFuncs.push(u3);
        };

        setupListeners();

        return () => {
            unlistenFuncs.forEach(fn => fn());
        };
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    if (!isOpen) return null;

    const onRefresh = () => {
        clearAgentMessages();
        invoke('set_ai_status', { status: 'alive' }).catch(console.error);
    };

    const onSend = async () => {
        if (inputRef.current && inputRef.current.value.trim() && !isThinking) {
            const prompt = inputRef.current.value;
            inputRef.current.value = "";
            
            setIsAgentThinking(true);
            addAgentMessage('user', prompt);
            addAgentMessage('assistant', "");
            
            try {
                const m = await import('../agent');
                await m.sendAgentMessage(prompt, () => {});
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

    return (
        <aside className="right-sidebar antigravity-glass" id="right-sidebar" style={{ 
            display: 'flex', 
            width: '100%', 
            height: '100%', 
            flexDirection: 'column', 
            background: 'rgba(25, 25, 25, 0.85)', 
            backdropFilter: 'blur(20px)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.1)', 
            zIndex: 10,
            boxShadow: '-10px 0 30px rgba(0,0,0,0.3)'
        }}>
            <style>{`
                .agent-message-container:hover .message-actions {
                    opacity: 1 !important;
                }
                .hoverable:hover {
                    background: rgba(255,255,255,0.1) !important;
                    color: #fff;
                }
            `}</style>

            <div className="right-sidebar-header" style={{ 
                height: '48px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '0 18px', 
                background: 'rgba(20,20,25,0.6)', 
                backdropFilter: 'blur(30px)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                position: 'sticky',
                top: 0,
                zIndex: 100
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%', 
                        background: aiStatus === 'alive' ? '#4ade80' : aiStatus === 'dead' ? '#f87171' : '#94a3b8',
                        boxShadow: aiStatus === 'alive' ? '0 0 12px rgba(74, 222, 128, 0.5)' : 'none',
                        transition: 'all 0.3s ease'
                    }}></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#fff', letterSpacing: '0.1em' }}>ANTIGRAVITY</span>
                        <span style={{ opacity: 0.2, fontSize: '10px' }}>/</span>
                        <span style={{ fontSize: '10px', fontWeight: 600, opacity: 0.4, letterSpacing: '0.05em', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {view === 'chat' ? (model.split('|')[1] || model).toUpperCase() : view.toUpperCase()}
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <i className="codicon codicon-clear-all hoverable-scale" title="Clear Chat" onClick={clearAgentMessages} style={{ fontSize: '15px', opacity: view === 'chat' ? 0.6 : 0.2, cursor: view === 'chat' ? 'pointer' : 'default' }}></i>
                    <i className="codicon codicon-history hoverable-scale" title="Chat History" onClick={() => setView('history')} style={{ fontSize: '15px', opacity: view === 'history' ? 1 : 0.6, color: view === 'history' ? '#3b82f6' : 'inherit', cursor: 'pointer' }}></i>
                    <i className="codicon codicon-settings-gear hoverable-scale" title="AI Settings" onClick={() => setView('settings')} style={{ fontSize: '15px', opacity: view === 'settings' ? 1 : 0.6, color: view === 'settings' ? '#3b82f6' : 'inherit', cursor: 'pointer' }}></i>
                    <i className="codicon codicon-chrome-close hoverable-scale" title="Close" onClick={toggle} style={{ fontSize: '16px', opacity: 0.6, cursor: 'pointer' }}></i>
                </div>
            </div>

            {view === 'chat' && (
                <div className="right-sidebar-content" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', scrollbarWidth: 'thin' }}>

                    <div id="agent-messages" style={{ flex: 1, padding: '16px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '200px' }}>
                        {messages.length === 0 && !isThinking && (
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
                                    <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : '#fff' }}>{msg.role === 'assistant' ? 'ANTIGRAVITY' : 'YOU'}</span>
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
                                    
                                    {/* Text content first */}
                                    <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', lineHeight: '1.6', color: 'rgba(255,255,255,0.92)', fontSize: '13px' }}>
                                        {msg.content || (msg.role === 'assistant' && isThinking && !msg.steps?.length ? 'Thinking...' : '')}
                                    </div>

                                    {msg.role === 'assistant' && (
                                        <>
                                            {msg.steps && msg.steps.length > 0 && (
                                                <div className="agent-activity-section" style={{ marginTop: '4px', padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                                    <div className="section-title" style={{ fontSize: '10px', fontWeight: 700, opacity: 0.4, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Technical Steps</div>
                                                    <div className="progress-stepper" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: '14px' }}>
                                                        {msg.steps.map((step: any, sIdx: number) => (
                                                            <div key={sIdx} className="progress-step" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px', fontSize: '11px' }}>
                                                                <i className={`codicon codicon-${step.status === 'running' ? 'loading' : step.status === 'error' ? 'error' : 'pass-filled'}`} 
                                                                   style={{ 
                                                                       color: step.status === 'running' ? '#3b82f6' : step.status === 'error' ? '#ef4444' : '#10b981', 
                                                                       animation: step.status === 'running' ? 'spin 1.5s linear infinite' : 'none',
                                                                       fontSize: '12px'
                                                                   }}></i>
                                                                <span style={{ opacity: step.status === 'running' ? 1 : 0.6 }}>{step.status === 'running' ? 'Running' : 'Executed'} <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: '3px', color: '#fff' }}>{step.name}</code></span>
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
                        {isThinking && (
                            <div className="thought-overlay" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px', border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', opacity: 0.6 }}>
                                    <i className="codicon codicon-info" style={{ animation: 'pulse 2s infinite' }}></i>
                                    <span>Antigravity is planning your request...</span>
                                </div>
                            </div>
                        )}
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
                        <div onClick={() => setView('chat')} className="hoverable" style={{ cursor: 'pointer', opacity: 0.6, fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', flexShrink: 0 }}>ANTIGRAVITY</div>
                        <div style={{ opacity: 0.3, fontSize: '10px', flexShrink: 0 }}>/</div>
                        <div className="active-breadcrumb" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--vscode-button-background)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>SETTINGS</div>
                    </div>
                    <AgentSettingsView />
                </div>
            )}

            {view === 'chat' && (
                <div className="agent-input-section" style={{ padding: '18px', borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(20,20,25,0.4)', backdropFilter: 'blur(30px)' }}>
                    <div className="agent-input-wrapper" style={{ 
                        background: 'rgba(30, 30, 35, 0.4)', 
                        border: '1px solid rgba(255,255,255,0.08)', 
                        borderRadius: '20px', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        overflow: 'hidden',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        backdropFilter: 'blur(15px)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', padding: '14px 16px' }}>
                            <textarea 
                                ref={inputRef}
                                placeholder="Message Antigravity..." 
                                style={{ 
                                    flex: 1, minHeight: '80px', background: 'transparent', border: 'none', 
                                    color: '#fff', padding: '4px 0', resize: 'none', fontSize: '14px', 
                                    outline: 'none', lineHeight: '1.6', opacity: 0.95,
                                    fontFamily: 'var(--vscode-font-family)'
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        onSend();
                                    }
                                }}
                            ></textarea>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.04)', gap: '12px', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div onClick={onModeClick} className="premium-pill-active" style={{ cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '14px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.25)', color: '#93c5fd', fontWeight: 800, letterSpacing: '0.02em', boxShadow: '0 0 15px rgba(59, 130, 246, 0.1)' }}>
                                    <i className="codicon codicon-layers" style={{ fontSize: '12px' }}></i>
                                    {mode.toUpperCase()}
                                </div>
                                <div onClick={onModelClick} style={{ cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: '0.02em' }}>
                                    <i className="codicon codicon-sparkle" style={{ fontSize: '12px' }}></i>
                                    {(model.split('|')[1] || model).split(/[:\/-]/)[0].toUpperCase()}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <i onClick={onRefresh} className="codicon codicon-sync hoverable-scale" style={{ fontSize: '18px', opacity: 0.4, cursor: 'pointer' }} title="Sync Session"></i>
                                <div onClick={onSend} className="send-btn-active" style={{ 
                                    width: '32px', height: '32px', borderRadius: '10px', 
                                    background: isThinking ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
                                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                    boxShadow: isThinking ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.3)',
                                    opacity: isThinking ? 0.5 : 1
                                }}>
                                    <i className={`codicon codicon-${isThinking ? 'loading spin' : 'arrow-up'}`} style={{ fontSize: '16px' }}></i>
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
