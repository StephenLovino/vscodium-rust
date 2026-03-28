import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import EmulatorPanel from './EmulatorPanel';
import MitmPanel from './MitmPanel';
import { terminalManager } from '../terminal';

interface TerminalTab {
    id: string;
    name: string;
}

const TerminalItem: React.FC<{ id: string; active: boolean }> = ({ id, active }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const initialized = useRef(false);

    useEffect(() => {
        if (containerRef.current && !initialized.current) {
            initialized.current = true;
            const t = terminalManager.terminals.get(id);
            if (t) {
                t.term.open(containerRef.current);
                setTimeout(() => t.fitAddon.fit(), 100);
            }
        }
    }, [id]);

    useEffect(() => {
        if (active) {
            const t = terminalManager.terminals.get(id);
            if (t) {
                t.term.focus();
                setTimeout(() => t.fitAddon.fit(), 50);
            }
        }
    }, [active, id]);

    return (
        <div 
            ref={containerRef} 
            className={`terminal-instance ${active ? '' : 'hidden'}`}
            style={{ 
                width: '100%', 
                height: '100%', 
                background: '#1e1e1e',
                padding: '4px'
            }} 
        />
    );
};

const BottomPanel: React.FC = () => {
    const isOpen = useStore(state => state.isBottomPanelOpen);
    const activeTab = useStore(state => state.activePanelTab);
    const setActiveTab = useStore(state => state.setActivePanelTab);
    const [terminals, setTerminals] = useState<TerminalTab[]>([]);
    const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);

    // Initial terminal
    useEffect(() => {
        if (isOpen && activeTab === 'TERMINAL' && terminals.length === 0) {
            createNewTerminal();
        }
    }, [isOpen, activeTab]);

    const createNewTerminal = async (shell?: string) => {
        // We create a temporary hidden div to mount the terminal initially
        const tempDiv = document.createElement('div');
        tempDiv.style.visibility = 'hidden';
        tempDiv.style.position = 'absolute';
        document.body.appendChild(tempDiv);
        
        try {
            const id = await terminalManager.createTerminal(tempDiv, shell);
            const t = terminalManager.terminals.get(id);
            const name = t?.shell || 'terminal';
            
            const newTab = { id, name: `${name} (${id.split('-')[1].slice(-4)})` };
            setTerminals(prev => [...prev, newTab]);
            setActiveTerminalId(id);
        } catch (e) {
            console.error('Failed to spawn terminal', e);
        } finally {
            document.body.removeChild(tempDiv);
        }
    };

    const closeTerminal = async (id: string) => {
        await terminalManager.closeTerminal(id);
        setTerminals(prev => {
            const next = prev.filter(t => t.id !== id);
            if (activeTerminalId === id) {
                setActiveTerminalId(next.length > 0 ? next[next.length - 1].id : null);
            }
            return next;
        });
    };

    if (!isOpen) return null;

    return (
        <footer className="bottom-panel" id="bottom-panel" style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', background: 'var(--vscode-panel-background)', borderTop: '1px solid var(--vscode-panel-border)', zIndex: 10 }}>
            <div className="panel-header" style={{ display: 'flex', background: 'var(--vscode-panel-background)', borderBottom: '1px solid var(--vscode-panel-border)', alignItems: 'center', height: '35px' }}>
                <div className="panel-tabs" style={{ display: 'flex', height: '100%' }}>
                    {['PROBLEMS', 'OUTPUT', 'DEBUG CONSOLE', 'TERMINAL', 'EMULATOR', 'MITM PROXY'].map(tab => (
                        <div 
                            key={tab}
                            className={`panel-tab ${activeTab === tab ? 'active' : ''}`} 
                            onClick={() => setActiveTab(tab)}
                            style={{ 
                                padding: '0 12px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                cursor: 'pointer',
                                fontSize: '11px',
                                borderBottom: activeTab === tab ? '1px solid var(--vscode-panelTitle-activeBorder)' : 'none',
                                color: activeTab === tab ? 'var(--vscode-panelTitle-activeForeground)' : 'var(--vscode-panelTitle-inactiveForeground)',
                                opacity: activeTab === tab ? 1 : 0.7
                            }}
                        >
                            {tab}
                        </div>
                    ))}
                </div>
                
                <div id="terminal-controls" style={{ 
                    display: activeTab === 'TERMINAL' ? 'flex' : 'none', 
                    marginLeft: 'auto', 
                    alignItems: 'center', 
                    gap: '4px',
                    paddingRight: '12px'
                }}>
                    <div style={{ display: 'flex', gap: '2px', marginRight: '10px', borderRight: '1px solid var(--vscode-panel-border)', paddingRight: '10px' }}>
                        {terminals.map(t => (
                            <div 
                                key={t.id}
                                onClick={() => setActiveTerminalId(t.id)}
                                style={{ 
                                    padding: '2px 8px', 
                                    fontSize: '10px', 
                                    cursor: 'pointer',
                                    background: activeTerminalId === t.id ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent',
                                    color: activeTerminalId === t.id ? 'var(--vscode-list-activeSelectionForeground)' : 'inherit',
                                    borderRadius: '2px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                {t.name}
                                <i className="codicon codicon-close" onClick={(e) => { e.stopPropagation(); closeTerminal(t.id); }} style={{ fontSize: '10px', opacity: 0.6 }}></i>
                            </div>
                        ))}
                    </div>

                    <button 
                        className="icon-btn" 
                        onClick={() => createNewTerminal()}
                        style={{ background: 'none', border: 'none', color: 'var(--vscode-sideBar-foreground)', cursor: 'pointer', opacity: 0.8, padding: '2px 6px' }}
                    >
                        <i className="codicon codicon-add"></i>
                    </button>
                    
                    <select
                        onChange={(e) => {
                            if (e.target.value) {
                                createNewTerminal(e.target.value);
                                e.target.value = "";
                            }
                        }}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--vscode-sideBar-foreground)',
                            fontSize: '11px',
                            cursor: 'pointer',
                            width: '20px',
                            opacity: 0.6
                        }}
                    >
                        <option value="">+</option>
                        <option value="powershell">PowerShell</option>
                        <option value="cmd">Command Prompt</option>
                        <option value="bash">Bash</option>
                        <option value="zsh">Zsh</option>
                    </select>
                </div>
            </div>

            <div className="panel-content" id="panel-content" style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#1e1e1e', padding: 0 }}>
                {activeTab === 'TERMINAL' && (
                    <div style={{ width: '100%', height: '100%' }}>
                        {terminals.map(t => (
                            <TerminalItem key={t.id} id={t.id} active={activeTerminalId === t.id} />
                        ))}
                        {terminals.length === 0 && (
                            <div style={{ padding: '20px', opacity: 0.5, fontSize: '12px', textAlign: 'center' }}>
                                No active terminals. Click + to create one.
                            </div>
                        )}
                    </div>
                )}
                {activeTab === 'EMULATOR' && (
                    <div style={{ width: '100%', height: '100%' }}>
                        <EmulatorPanel />
                    </div>
                )}
                {activeTab === 'MITM PROXY' && (
                    <div style={{ width: '100%', height: '100%' }}>
                        <MitmPanel />
                    </div>
                )}
                {['PROBLEMS', 'OUTPUT', 'DEBUG CONSOLE'].includes(activeTab) && (
                    <div style={{ padding: '20px', opacity: 0.5, fontSize: '12px', textAlign: 'center' }}>
                         {activeTab} view is currently empty.
                    </div>
                )}
            </div>
        </footer>
    );
};

export default BottomPanel;
