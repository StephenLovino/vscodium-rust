import React, { useState } from 'react';
import { useStore } from '../store';

const BottomPanel: React.FC = () => {
    const isOpen = useStore(state => state.isBottomPanelOpen);
    const backendPing = useStore(state => state.backendPing);
    const [pingResult, setPingResult] = useState<string>('');
    const [isPending, setIsPending] = useState(false);

    if (!isOpen) return null;

    const handlePing = async () => {
        setIsPending(true);
        const result = await backendPing();
        setPingResult(result);
        setIsPending(false);
        // Clear result after 3 seconds
        setTimeout(() => setPingResult(''), 3000);
    };

    return (
        <footer className="bottom-panel" id="bottom-panel" style={{ height: '250px', display: 'flex', flexDirection: 'column', background: 'var(--vscode-panel-background)', borderTop: '1px solid var(--vscode-panel-border)' }}>
            <div className="panel-header" style={{ display: 'flex', background: 'var(--vscode-panel-background)', borderBottom: '1px solid var(--vscode-panel-border)', alignItems: 'center' }}>
                <div className="panel-tabs">
                    <div className="panel-tab active" style={{ textTransform: 'uppercase' }}>TERMINAL</div>
                    <div className="panel-tab" style={{ textTransform: 'uppercase' }}>OUTPUT</div>
                    <div className="panel-tab" style={{ textTransform: 'uppercase' }}>PROBLEMS</div>
                    <div className="panel-tab" style={{ textTransform: 'uppercase' }}>DEBUG CONSOLE</div>
                </div>

                <div style={{ marginLeft: '20px', fontSize: '11px', color: 'var(--vscode-sideBar-foreground)', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        onClick={handlePing}
                        disabled={isPending}
                        style={{
                            background: 'var(--vscode-statusBar-background)',
                            color: 'white',
                            border: 'none',
                            padding: '2px 8px',
                            borderRadius: '2px',
                            cursor: 'pointer',
                            fontSize: '10px'
                        }}
                    >
                        {isPending ? 'Pinging Service...' : 'Test Backend Connectivity'}
                    </button>
                    {pingResult && <span style={{ color: '#4ec9b0' }}>{pingResult}</span>}
                </div>

                <div id="terminal-tabs" style={{ display: 'flex', gap: '4px', marginLeft: 'auto', padding: '0 10px', alignItems: 'center' }}>
                    <button id="new-terminal" className="icon-btn" title="New Terminal" style={{ background: 'none', border: 'none', color: 'var(--vscode-sideBar-foreground)', cursor: 'pointer', opacity: 0.8 }}>
                        <i className="codicon codicon-add"></i>
                    </button>
                </div>
            </div>
            <div className="panel-content" id="panel-content" style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--vscode-editor-background)', padding: 0 }}>
                <div id="terminal-container" style={{ width: '100%', height: '100%' }}></div>
            </div>
        </footer>
    );
};

export default BottomPanel;
