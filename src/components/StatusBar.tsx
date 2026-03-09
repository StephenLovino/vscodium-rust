import React from 'react';

const StatusBar: React.FC = () => {
    return (
        <footer className="status-bar" style={{
            backgroundColor: 'var(--vscode-statusBar-background)',
            color: 'var(--vscode-statusBar-foreground)',
            height: 'var(--status-bar-height)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 10px',
            fontSize: '12px',
            fontFamily: 'var(--font-ui)'
        }}>
            <div className="status-left" style={{ display: 'flex', alignItems: 'center', gap: '12px', height: '100%' }}>
                <div className="status-item hoverable" id="git-indicator" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', height: '100%', padding: '0 4px' }}>
                    <i className="codicon codicon-source-control" style={{ fontSize: '14px', marginRight: '4px' }}></i>main*
                </div>
                <div className="status-item hoverable" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', height: '100%', padding: '0 4px' }}>
                    <i className="codicon codicon-sync" style={{ fontSize: '14px', marginRight: '4px' }}></i>
                </div>
                <div className="status-item hoverable" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', height: '100%', padding: '0 4px' }}>
                    <i className="codicon codicon-error" style={{ fontSize: '14px', marginRight: '4px' }}></i>0
                    <i className="codicon codicon-warning" style={{ fontSize: '14px', marginLeft: '6px', marginRight: '4px' }}></i>0
                </div>
                <div className="status-item hoverable" id="model-selector" title="Switch AI Model" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', height: '100%', padding: '0 4px' }}>
                    <i className="codicon codicon-sparkle" style={{ fontSize: '14px', marginRight: '4px' }}></i>
                    <span id="current-model">GPT-4o</span>
                </div>
                <div className="status-item hoverable" id="device-selector" title="Mobile Devices" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', height: '100%', padding: '0 4px' }}>
                    <i className="codicon codicon-device-mobile" style={{ fontSize: '14px', marginRight: '4px' }}></i>
                    <span id="current-device">No Device</span>
                </div>
            </div>
            <div className="status-right" style={{ display: 'flex', alignItems: 'center', gap: '12px', height: '100%' }}>
                <div className="status-item hoverable" id="cursor-pos" style={{ cursor: 'pointer', height: '100%', display: 'flex', alignItems: 'center', padding: '0 4px' }}>Ln 1, Col 1</div>
                <div className="status-item hoverable" style={{ cursor: 'pointer', height: '100%', display: 'flex', alignItems: 'center', padding: '0 4px' }}>Spaces: 4</div>
                <div className="status-item hoverable" style={{ cursor: 'pointer', height: '100%', display: 'flex', alignItems: 'center', padding: '0 4px' }}>UTF-8</div>
                <div className="status-item hoverable" style={{ cursor: 'pointer', height: '100%', display: 'flex', alignItems: 'center', padding: '0 4px' }}>CRLF</div>
                <div className="status-item hoverable" style={{ cursor: 'pointer', height: '100%', display: 'flex', alignItems: 'center', padding: '0 4px' }}>Rust</div>
                <div className="status-item hoverable" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', height: '100%', padding: '0 4px' }}>
                    <i className="codicon codicon-feedback" style={{ fontSize: '14px' }}></i>
                </div>
                <div className="status-item hoverable" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', height: '100%', padding: '0 4px' }}>
                    <i className="codicon codicon-bell" style={{ fontSize: '14px' }}></i>
                </div>
            </div>
        </footer>
    );
};

export default StatusBar;
