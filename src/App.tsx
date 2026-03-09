import React, { useEffect } from 'react';
import TitleBar from './components/TitleBar';
import Workbench from './components/Workbench';
import StatusBar from './components/StatusBar';
import './styles.css';

const App: React.FC = () => {
    return (
        <>
            <div id="command-palette" className="command-palette hidden">
                <div className="command-input-container">
                    <input type="text" id="command-input" placeholder="Type a command or search..." />
                </div>
                <div id="command-list" className="command-list"></div>
            </div>

            <TitleBar />
            <Workbench />
            <StatusBar />

            {/* Debug Toolbar */}
            <div id="debug-toolbar" className="debug-toolbar hidden">
                <div className="debug-tool-item" id="debug-continue" title="Continue (F5)">▶️</div>
                <div className="debug-tool-item" id="debug-step-over" title="Step Over (F10)">↷</div>
                <div className="debug-tool-item" id="debug-step-into" title="Step Into (F11)">↴</div>
                <div className="debug-tool-item" id="debug-step-out" title="Step Out (Shift+F11)">⤴</div>
                <div className="debug-tool-item" id="debug-restart" title="Restart (Ctrl+Shift+F5)">↻</div>
                <div className="debug-tool-item stop" id="debug-stop" title="Stop (Shift+F5)">⏹️</div>
            </div>

            {/* Context Menu */}
            <div id="context-menu" className="context-menu hidden">
                <div className="menu-item" id="cm-cut">Cut</div>
                <div className="menu-item" id="cm-copy">Copy</div>
                <div className="menu-item" id="cm-paste">Paste</div>
                <div className="menu-separator"></div>
                <div className="menu-item" id="cm-palette">Command Palette...</div>
            </div>
        </>
    );
};

export default App;
