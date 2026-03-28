import React, { useState } from 'react';
import { useStore } from '../../store';
import ContextMenu from './ContextMenu';

const TerminalSidebar: React.FC = () => {
    const groups = useStore(state => state.terminalGroups);
    const activeGroupId = useStore(state => state.activeTerminalGroupId);
    const setActiveGroup = useStore(state => state.setActiveTerminalGroup);
    const renameGroup = useStore(state => state.renameTerminalGroup);
    const closeGroup = useStore(state => state.closeTerminalGroup);
    const splitTerminal = useStore(state => state.splitTerminal);
    const agentMessages = useStore(state => state.agentMessages);
    const latestAgentMessage = [...agentMessages].reverse().find(m => m.role === 'assistant' && (m.steps || m.artifacts));
    
    const [menuState, setMenuState] = useState({ visible: false, x: 0, y: 0, groupId: '' });
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    const handleContextMenu = (e: React.MouseEvent, groupId: string) => {
        e.preventDefault();
        setMenuState({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            groupId
        });
    };

    const startRename = (groupId: string, initialName: string) => {
        setRenamingId(groupId);
        setRenameValue(initialName);
    };

    const handleRenameSubmit = () => {
        if (renamingId && renameValue.trim()) {
            renameGroup(renamingId, renameValue.trim());
        }
        setRenamingId(null);
    };

    const contextMenuOptions = [
        { 
            label: 'Split Terminal', 
            icon: 'codicon-split-horizontal', 
            onClick: () => {
                const group = groups.find(g => g.id === menuState.groupId);
                if (group) splitTerminal(group.id, group.activeInstanceId);
            }
        },
        { 
            label: 'Rename...', 
            icon: 'codicon-edit', 
            onClick: () => {
                const group = groups.find(g => g.id === menuState.groupId);
                if (group) startRename(group.id, group.name);
            }
        },
        { 
            label: 'Close Terminal', 
            icon: 'codicon-close', 
            danger: true,
            onClick: () => closeGroup(menuState.groupId)
        }
    ];

    return (
        <div 
            className="terminal-sidebar"
            style={{ 
                width: '100%', 
                height: '100%', 
                background: 'var(--vscode-panel-background)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}
        >
            <ContextMenu 
                visible={menuState.visible}
                x={menuState.x}
                y={menuState.y}
                options={contextMenuOptions}
                onClose={() => setMenuState({ ...menuState, visible: false })}
            />

            {/* Sidebar Header */}
            <div className="pane-header" style={{ height: '35px', padding: '0 8px 0 16px', borderBottom: '1px solid var(--vscode-panel-border, #454545)', borderTop: 'none' }}>
                <span style={{ flex: 1, fontSize: '11px', fontWeight: 600 }}>TERMINALS</span>
                <div className="panel-toolbar" style={{ gap: '2px' }}>
                    <div className="toolbar-item" style={{ width: '24px', height: '24px' }} onClick={() => (window as any).executeCommand('terminal.new')}>
                        <i className="codicon codicon-add" style={{ fontSize: '14px' }}></i>
                    </div>
                    <div className="toolbar-item" style={{ width: '24px', height: '24px' }}>
                        <i className="codicon codicon-chevron-down" style={{ fontSize: '14px' }}></i>
                    </div>
                </div>
            </div>

            {/* Terminal List */}
            <div className="terminal-groups-section" style={{ flex: 1, overflowY: 'auto' }}>
                {groups.map((group) => (
                    <div 
                        key={group.id}
                        onClick={() => setActiveGroup(group.id)}
                        onContextMenu={(e) => handleContextMenu(e, group.id)}
                        className={`pane-item ${activeGroupId === group.id ? 'active' : ''}`}
                        style={{ 
                            height: '22px',
                            padding: '0 8px 0 16px',
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            background: activeGroupId === group.id ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
                            color: activeGroupId === group.id ? 'var(--vscode-list-activeSelectionForeground)' : 'inherit'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden' }}>
                            <i className="codicon codicon-terminal" style={{ fontSize: '12px', opacity: 0.8 }}></i>
                            {renamingId === group.id ? (
                                <input 
                                    autoFocus
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onBlur={handleRenameSubmit}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleRenameSubmit();
                                        if (e.key === 'Escape') setRenamingId(null);
                                    }}
                                    style={{
                                        background: 'var(--vscode-input-background, #3c3c3c)',
                                        color: 'var(--vscode-input-foreground, #cccccc)',
                                        border: '1px solid var(--vscode-focusBorder, #007acc)',
                                        fontSize: '11px',
                                        padding: '0 2px',
                                        width: '100%',
                                        outline: 'none',
                                        height: '18px'
                                    }}
                                />
                            ) : (
                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</span>
                            )}
                        </div>
                        
                        <div className="tab-actions" style={{ display: 'flex', gap: '4px', opacity: activeGroupId === group.id ? 1 : 0, transition: 'opacity 0.1s' }}>
                            <i className="codicon codicon-split-horizontal" style={{ fontSize: '12px', padding: '2px' }} onClick={(e) => { e.stopPropagation(); splitTerminal(group.id, group.activeInstanceId); }} />
                            <i className="codicon codicon-trash" style={{ fontSize: '12px', padding: '2px' }} onClick={(e) => { e.stopPropagation(); closeGroup(group.id); }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TerminalSidebar;
