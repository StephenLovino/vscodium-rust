import React from 'react';
import { useStore } from '../store';
import { invoke } from '@tauri-apps/api/core';

const StatusBar: React.FC = () => {
    const theme = useStore(state => state.theme);
    const setTheme = useStore(state => state.setTheme);
    const setActiveSidebarView = useStore(state => state.setActiveSidebarView);
    const toggleBottomPanel = useStore(state => state.toggleBottomPanel);
    const agentModel = useStore(state => state.agentModel);

    const toggleTheme = () => {
        const themes = ['vs', 'vs-dark', 'hc-black'];
        const next = themes[(themes.indexOf(theme) + 1) % themes.length];
        setTheme(next);
    };

    const handleOptimize = async () => {
        try {
            await invoke('optimize_memory');
            console.log('App memory optimized');
        } catch (e) {
            console.error('Failed to optimize memory:', e);
        }
    };

    React.useEffect(() => {
        // Auto-optimize memory every 5 minutes
        const timer = setInterval(handleOptimize, 5 * 60 * 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <footer className="status-bar" style={{
            backgroundColor: '#007acc', // VS Code Blue
            color: '#ffffff',
            height: '22px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            fontFamily: 'var(--font-ui)',
            userSelect: 'none',
            zIndex: 1000
        }}>
            <div className="status-left" style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                <div style={{ 
                    background: '#16825d', 
                    height: '100%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '0 8px',
                    marginRight: '8px'
                }}>
                    <i className="codicon codicon-remote" style={{ fontSize: '14px' }}></i>
                </div>
                <div className="status-item hoverable" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', height: '100%', padding: '0 6px' }}>
                    <i className="codicon codicon-layout-sidebar-left" style={{ fontSize: '12px', marginRight: '4px' }}></i>
                    vscodium-rust
                </div>
                <div className="status-item hoverable" onClick={() => setActiveSidebarView('scm-view')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', height: '100%', padding: '0 6px' }}>
                    <i className="codicon codicon-source-control" style={{ fontSize: '12px', marginRight: '4px' }}></i>main*
                </div>
                <div className="status-item hoverable" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', height: '100%', padding: '0 6px', opacity: 0.8 }}>
                    <i className="codicon codicon-sync" style={{ fontSize: '12px' }}></i>
                </div>
                <div className="status-item hoverable" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', height: '100%', padding: '0 6px' }}>
                    <i className="codicon codicon-error" style={{ fontSize: '12px', marginRight: '2px' }}></i>6
                    <i className="codicon codicon-warning" style={{ fontSize: '12px', marginLeft: '6px', marginRight: '2px' }}></i>0
                </div>
            </div>
            <div className="status-right" style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                <div className="status-item hoverable" style={{ cursor: 'pointer', height: '100%', display: 'flex', alignItems: 'center', padding: '0 8px', opacity: 0.9 }}>
                    <i className="codicon codicon-broadcast" style={{ fontSize: '12px', marginRight: '6px' }} />Discord RPC
                </div>
                <div className="status-item hoverable" style={{ cursor: 'pointer', height: '100%', display: 'flex', alignItems: 'center', padding: '0 8px' }}>Ln 1, Col 1</div>
                <div className="status-item hoverable" style={{ cursor: 'pointer', height: '100%', display: 'flex', alignItems: 'center', padding: '0 8px' }}>Spaces: 4</div>
                <div className="status-item hoverable" style={{ cursor: 'pointer', height: '100%', display: 'flex', alignItems: 'center', padding: '0 8px' }}>UTF-8</div>
                <div className="status-item hoverable" onClick={handleOptimize} style={{ cursor: 'pointer', height: '100%', display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                    <i className="codicon codicon-dashboard" style={{ fontSize: '12px', marginRight: '4px' }} />Optimize
                </div>
                <div className="status-item hoverable" onClick={toggleTheme} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', height: '100%', padding: '0 8px' }}>
                    <i className="codicon codicon-color-mode" style={{ marginRight: '4px' }}></i>
                    <span>{theme}</span>
                </div>
            </div>
        </footer>
    );
};

export default StatusBar;
