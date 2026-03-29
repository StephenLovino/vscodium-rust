import React, { useEffect, useRef, useState } from 'react';
import { terminalManager, getVSCodeTheme } from '../../terminal';
import { SearchAddon } from '@xterm/addon-search';
import TerminalFindWidget from './TerminalFindWidget';
import { useStore } from '../../store';

interface TerminalInstanceProps {
    id: string;
    groupId: string;
    active: boolean;
}

const TerminalInstance: React.FC<TerminalInstanceProps> = ({ id, groupId, active }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const setActiveInstance = useStore(state => state.setActiveTerminalInstance);
    
    const [searchAddon, setSearchAddon] = useState<SearchAddon | null>(null);
    const [findVisible, setFindVisible] = useState(false);

    // Initial attachment and re-attachment on container change
    useEffect(() => {
        if (containerRef.current) {
            terminalManager.attach(id, containerRef.current);
            const t = terminalManager.terminals.get(id);
            if (t) {
                setSearchAddon(t.searchAddon);
            }
        }
    }, [id]);

    // Handle visibility changes
    useEffect(() => {
        if (active && containerRef.current) {
            terminalManager.resize(id);
            const t = terminalManager.terminals.get(id);
            if (t) t.term.focus();
        }
    }, [active, id]);

    // Resize handling
    useEffect(() => {
        if (!containerRef.current) return;
        
        const observer = new ResizeObserver(() => {
            if (active) {
                terminalManager.resize(id);
            }
        });
        
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [id, active]);

    const currentTheme = useStore(state => state.theme);
    useEffect(() => {
        terminalManager.setTheme(id, getVSCodeTheme());
    }, [currentTheme, id]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!active) return;
            
            // Cmd+F (Mac) or Ctrl+F (Others)
            if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
                e.preventDefault();
                setFindVisible(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [active]);

    return (
        <div 
            className={`terminal-instance-wrapper ${active ? 'active' : ''}`}
            onClick={() => setActiveInstance(groupId, id)}
            style={{ 
                flex: 1,
                width: '100%', 
                height: '100%',
                background: 'var(--vscode-terminal-background, #1e1e1e)',
                borderLeft: active ? '1px solid var(--vscode-terminal-tab-activeBorder, #007acc)' : '1px solid transparent',
                position: 'relative',
                overflow: 'hidden',
                display: active ? 'flex' : 'none',
                flexDirection: 'column'
            }} 
        >
            <TerminalFindWidget 
                searchAddon={searchAddon} 
                visible={findVisible} 
                onClose={() => {
                    setFindVisible(false);
                    const t = terminalManager.terminals.get(id);
                    if (t) t.term.focus();
                }} 
            />
            <div 
                ref={containerRef}
                style={{ 
                    flex: 1, 
                    width: '100%', 
                    height: '100%',
                    position: 'relative'
                }}
            />
        </div>
    );
};

export default TerminalInstance;
