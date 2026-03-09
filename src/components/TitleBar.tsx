import React from 'react';

const TitleBar: React.FC = () => {
    return (
        <div id="title-bar" data-tauri-drag-region>
            <div className="window-controls-left">
                {/* Empty space reserved for macOS traffic lights */}
            </div>
            <div className="command-center" onClick={() => (window as any).showCommandPalette?.()}>
                <div className="command-box">
                    <i className="codicon codicon-search" style={{ fontSize: '14px', marginRight: '6px', color: 'var(--vscode-sideBar-foreground)', opacity: 0.6 }}></i>
                    <span className="text" style={{ color: 'var(--vscode-titleBar-activeForeground)', opacity: 0.8, fontSize: '12px', fontFamily: 'var(--font-ui)' }}>
                        Search VS Code
                    </span>
                </div>
            </div>
            {/* Hidden non-native Windows controls since we use Mac Overlay */}
            <div className="window-controls-right" style={{ display: 'none' }}>
                <div className="control-button" id="win-min" title="Minimize">⎯</div>
                <div className="control-button" id="win-max" title="Maximize">▢</div>
                <div className="control-button close" id="win-close" title="Close">✕</div>
            </div>
        </div>
    );
};

export default TitleBar;
