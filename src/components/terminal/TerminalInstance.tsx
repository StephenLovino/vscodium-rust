import React, { useEffect, useRef, useState } from 'react';
import { terminalManager } from '../../terminal';
import { SearchAddon } from '@xterm/addon-search';
import TerminalFindWidget from './TerminalFindWidget';
import { useStore } from '../../store';

const getVSCodeTheme = () => {
    const style = getComputedStyle(document.documentElement);
    return {
        background: style.getPropertyValue('--vscode-terminal-background').trim() || '#1e1e1e',
        foreground: style.getPropertyValue('--vscode-terminal-foreground').trim() || '#cccccc',
        cursor: style.getPropertyValue('--vscode-terminalCursor-foreground').trim() || '#cccccc',
        cursorAccent: style.getPropertyValue('--vscode-terminalCursor-background').trim() || '#1e1e1e',
        selectionBackground: style.getPropertyValue('--vscode-terminal-selectionBackground').trim() || 'rgba(255, 255, 255, 0.1)',
        black: style.getPropertyValue('--vscode-terminal-ansiBlack').trim() || '#000000',
        red: style.getPropertyValue('--vscode-terminal-ansiRed').trim() || '#cd3131',
        green: style.getPropertyValue('--vscode-terminal-ansiGreen').trim() || '#0dbc79',
        yellow: style.getPropertyValue('--vscode-terminal-ansiYellow').trim() || '#e5e510',
        blue: style.getPropertyValue('--vscode-terminal-ansiBlue').trim() || '#2472c8',
        magenta: style.getPropertyValue('--vscode-terminal-ansiMagenta').trim() || '#bc3fbc',
        cyan: style.getPropertyValue('--vscode-terminal-ansiCyan').trim() || '#11a8cd',
        white: style.getPropertyValue('--vscode-terminal-ansiWhite').trim() || '#e5e5e5',
        brightBlack: style.getPropertyValue('--vscode-terminal-ansiBrightBlack').trim() || '#666666',
        brightRed: style.getPropertyValue('--vscode-terminal-ansiBrightRed').trim() || '#f14c4c',
        brightGreen: style.getPropertyValue('--vscode-terminal-ansiBrightGreen').trim() || '#23d18b',
        brightYellow: style.getPropertyValue('--vscode-terminal-ansiBrightYellow').trim() || '#f5f543',
        brightBlue: style.getPropertyValue('--vscode-terminal-ansiBrightBlue').trim() || '#3b8eea',
        brightMagenta: style.getPropertyValue('--vscode-terminal-ansiBrightMagenta').trim() || '#d670d6',
        brightCyan: style.getPropertyValue('--vscode-terminal-ansiBrightCyan').trim() || '#29b8db',
        brightWhite: style.getPropertyValue('--vscode-terminal-ansiBrightWhite').trim() || '#e5e5e5'
    };
};

interface TerminalInstanceProps {
    id: string;
    groupId: string;
    active: boolean;
}

const TerminalInstance: React.FC<TerminalInstanceProps> = ({ id, groupId, active }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const initialized = useRef(false);
    const setActiveInstance = useStore(state => state.setActiveTerminalInstance);
    
    const [searchAddon, setSearchAddon] = useState<SearchAddon | null>(null);
    const [findVisible, setFindVisible] = useState(false);

    useEffect(() => {
        if (containerRef.current && !initialized.current) {
            initialized.current = true;
            
            const spawnInstance = async () => {
                let termInstance = terminalManager.terminals.get(id);
                if (!termInstance) {
                    await terminalManager.createTerminal(containerRef.current!, undefined, undefined, id);
                    termInstance = terminalManager.terminals.get(id);
                } else {
                    termInstance.term.open(containerRef.current!);
                }
                
                if (termInstance) {
                    // Always load search addon
                    const search = new SearchAddon();
                    termInstance.term.loadAddon(search);
                    setSearchAddon(search);
                    
                    // Apply theme
                    termInstance.term.options.theme = getVSCodeTheme();
                    
                    setTimeout(() => termInstance?.fitAddon.fit(), 100);
                }
            };
            
            spawnInstance();
        }
    }, [id]);

    const currentTheme = useStore(state => state.theme);
    useEffect(() => {
        const t = terminalManager.terminals.get(id);
        if (t) {
            t.term.options.theme = getVSCodeTheme();
        }
    }, [currentTheme, id]);

    useEffect(() => {
        if (active) {
            const t = terminalManager.terminals.get(id);
            if (t) {
                t.term.focus();
                setTimeout(() => t.fitAddon.fit(), 50);
            }
        }
    }, [active, id]);

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
                height: '100%', // Fixed height calculation
                background: '#1e1e1e',
                borderLeft: active ? '1px solid var(--vscode-terminal-tab-activeBorder, #007acc)' : '1px solid transparent',
                position: 'relative',
                overflow: 'hidden',
                display: active ? 'block' : 'none' // Ensure only active split is prominent if needed, but flex: 1 handles it
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
                style={{ width: '100%', height: '100%' }}
            />
        </div>
    );
};

export default TerminalInstance;
