import React, { useEffect } from 'react';
import { useStore } from '../store';

const SidebarPane: React.FC<{ title: string; children: React.ReactNode; defaultCollapsed?: boolean; actions?: React.ReactNode }> = ({ title, children, defaultCollapsed = false, actions }) => {
    const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);
    return (
        <div className="sidebar-pane" style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div className={`pane-header${isCollapsed ? ' collapsed' : ''}`} onClick={() => setIsCollapsed(!isCollapsed)}>
                <i className="codicon codicon-chevron-down"></i>
                <span style={{ flex: 1 }}>{title}</span>
                {actions && <div className="pane-actions" onClick={e => e.stopPropagation()}>{actions}</div>}
            </div>
            {!isCollapsed && <div className="pane-content" style={{ padding: '4px 0' }}>{children}</div>}
        </div>
    );
};

const RightSidebar: React.FC = () => {
    const isOpen = useStore(state => state.isRightSidebarOpen);
    const toggle = useStore(state => state.toggleRightSidebar);
    const mode = useStore(state => state.agentMode);
    const setMode = useStore(state => state.setAgentMode);
    const model = useStore(state => state.agentModel);
    const setModel = useStore(state => state.setAgentModel);
    const inputRef = React.useRef<HTMLTextAreaElement>(null);
    const [showModeDropdown, setShowModeDropdown] = React.useState(false);
    const [showModelDropdown, setShowModelDropdown] = React.useState(false);

    if (!isOpen) return null;

    const onSend = () => {
        if (inputRef.current) {
            import('../agent').then(m => m.handleAgentChat(inputRef.current!));
        }
    };

    const onModeClick = (e: React.MouseEvent) => {
        const target = e.currentTarget as HTMLElement;
        import('../agent').then(m => m.openModeDropdown(target, (val) => {
            // Updated via store inside openModeDropdown
        }));
    };

    const onModelClick = (e: React.MouseEvent) => {
        const target = e.currentTarget as HTMLElement;
        import('../agent').then(m => m.openModelDropdown(target, (val) => {
            // Updated via store inside openModelDropdown
        }));
    };

    return (
        <aside className="right-sidebar" id="right-sidebar" style={{ display: 'flex', width: '100%', height: '100%', flexDirection: 'column', background: 'var(--vscode-sideBar-background)', borderLeft: '1px solid var(--vscode-panel-border)', zIndex: 10 }}>
            <div className="right-sidebar-header" style={{ height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', background: 'var(--vscode-editorGroupHeader-tabsBackground)', borderBottom: '1px solid var(--vscode-panel-border)' }}>
                <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--vscode-sideBar-foreground)', opacity: 0.8, textTransform: 'uppercase' }}>Open Agent Manager</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <i className="codicon codicon-split-horizontal hoverable" title="Split View" style={{ fontSize: '14px', opacity: 0.7 }}></i>
                    <i className="codicon codicon-more hoverable" title="More Actions" style={{ fontSize: '14px', opacity: 0.7 }}></i>
                    <i className="codicon codicon-close hoverable" title="Close" onClick={toggle} style={{ fontSize: '16px', opacity: 0.7 }}></i>
                </div>
            </div>

            <div className="right-sidebar-content" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                <SidebarPane title="Current Task" defaultCollapsed={false}>
                    <div id="active-task-description" style={{ padding: '8px 16px', fontSize: '13px', color: 'var(--vscode-editor-foreground)', opacity: 0.6, fontStyle: 'italic' }}>
                        No active task. Ask the agent to start something.
                    </div>
                </SidebarPane>

                <SidebarPane title="Execution Progress" defaultCollapsed={false}>
                    <div id="agent-messages" style={{ padding: '4px 16px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Messages will be injected here */}
                    </div>
                </SidebarPane>
            </div>

            <div className="agent-input-section" style={{ padding: '16px', borderTop: '1px solid var(--vscode-panel-border)', background: 'var(--vscode-sideBar-background)', position: 'relative' }}>
                <div className="agent-input-wrapper" style={{ background: 'var(--vscode-input-background)', border: '1px solid var(--vscode-panel-border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', padding: '8px' }}>
                        <div style={{ padding: '8px 4px', display: 'flex', alignItems: 'center', opacity: 0.5 }}>
                            <i className="codicon codicon-add hoverable" style={{ fontSize: '16px', cursor: 'pointer' }}></i>
                        </div>
                        <textarea 
                            ref={inputRef}
                            placeholder="Ask anything..." 
                            style={{ 
                                flex: 1, 
                                minHeight: '60px', 
                                background: 'transparent', 
                                border: 'none', 
                                color: 'var(--vscode-editor-foreground)', 
                                padding: '8px', 
                                resize: 'none', 
                                fontSize: '14px', 
                                outline: 'none',
                                lineHeight: '1.4'
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    onSend();
                                }
                            }}
                        ></textarea>
                    </div>
                    
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        padding: '8px 12px', 
                        background: 'rgba(255,255,255,0.02)',
                        borderTop: '1px solid rgba(128,128,128,0.1)', 
                        gap: '12px',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div 
                                onClick={onModeClick} 
                                className="hoverable"
                                style={{ cursor: 'pointer', fontSize: '12px', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }}
                            >
                                <i className="codicon codicon-layers" style={{ fontSize: '12px', opacity: 0.6 }}></i>
                                {mode} <i className="codicon codicon-chevron-down" style={{ fontSize: '10px', opacity: 0.5 }}></i>
                            </div>
                            <div 
                                onClick={onModelClick} 
                                className="hoverable"
                                style={{ cursor: 'pointer', fontSize: '12px', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }}
                            >
                                <i className="codicon codicon-sparkle" style={{ fontSize: '12px', opacity: 0.6 }}></i>
                                {(model.split('|')[1] || model).split(' ')[0]} <i className="codicon codicon-chevron-down" style={{ fontSize: '10px', opacity: 0.5 }}></i>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <i 
                                onClick={() => (window as any).startKeyHunt?.()}
                                className="codicon codicon-radar hoverable" 
                                style={{ fontSize: '16px', opacity: 0.6, cursor: 'pointer' }}
                                title="Hunt for Working AI Keys"
                            ></i>
                            <i className="codicon codicon-mic hoverable" style={{ fontSize: '16px', opacity: 0.6, cursor: 'pointer' }}></i>
                            <div 
                                onClick={onSend}
                                className="hoverable"
                                style={{ 
                                    width: '28px', 
                                    height: '28px', 
                                    borderRadius: '50%', 
                                    background: 'var(--vscode-focusBorder)', 
                                    color: 'white', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'transform 0.1s'
                                }}
                            >
                                <i className="codicon codicon-arrow-right" style={{ fontSize: '16px' }}></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default RightSidebar;
