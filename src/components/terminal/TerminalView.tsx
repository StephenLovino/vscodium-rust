import React from 'react';
import TerminalSidebar from './TerminalSidebar';
import TerminalGroupView from './TerminalGroupView';
import { useStore } from '../../store';

const TerminalView: React.FC = () => {
    const groups = useStore(state => state.terminalGroups);
    const activeGroupId = useStore(state => state.activeTerminalGroupId);

    return (
        <div 
            className="terminal-view-container"
            style={{ 
                display: 'flex', 
                flexDirection: 'column',
                width: '100%', 
                height: '100%',
                background: 'var(--vscode-terminal-background, #1e1e1e)'
            }}
        >
            <div 
                className="terminal-groups-host"
                style={{ 
                    flex: 1, 
                    position: 'relative', 
                    height: '100%'
                }}
            >
                {groups.map((group) => (
                    <TerminalGroupView 
                        key={group.id} 
                        groupId={group.id} 
                        active={activeGroupId === group.id} 
                    />
                ))}
                
                {groups.length === 0 && (
                    <div style={{ 
                        padding: '40px', 
                        opacity: 0.5, 
                        fontSize: '12px', 
                        textAlign: 'center',
                        color: 'var(--vscode-foreground)'
                    }}>
                        No active terminals. Click + in the toolbar to create one.
                    </div>
                )}
            </div>
        </div>
    );
};

export default TerminalView;
