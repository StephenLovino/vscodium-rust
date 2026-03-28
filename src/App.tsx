import React, { useEffect } from 'react';
import { invoke } from './tauri_bridge';
import TitleBar from './components/TitleBar';
import Workbench from './components/Workbench';
import StatusBar from './components/StatusBar';
import './styles.css';
import './panes.css';
import { initSearch } from './search';
import { initStatusBar } from './status_bar';
import { initExtensions } from './extensions';
import { initSpecs } from './specs';
import { initMobile } from './mobile';
import { useStore } from './store.ts';
import { initCommands } from './commands.ts';
import { initScm } from './scm';
import { initDebugUI } from './debug_ui';
import { initTerminal } from './terminal';
import { initAgent } from './agent';

const ContextMenu: React.FC = () => {
    const isOpen = useStore(state => state.isContextMenuOpen);
    const pos = useStore(state => state.contextMenuPosition);
    const setOpen = useStore(state => state.setContextMenuOpen);

    if (!isOpen) return null;

    return (
        <div 
            id="context-menu" 
            className="context-menu" 
            style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 10000 }}
            onMouseLeave={() => setOpen(false)}
        >
            <div className="menu-item" id="cm-open">Open</div>
            <div className="menu-item" id="cm-reveal">Reveal in Finder</div>
            <div className="menu-separator"></div>
            <div className="menu-item" id="cm-new-file">New File...</div>
            <div className="menu-item" id="cm-new-folder">New Folder...</div>
            <div className="menu-separator"></div>
            <div className="menu-item" id="cm-rename">Rename...</div>
            <div className="menu-item" id="cm-delete" style={{ color: '#f87171' }}>Delete</div>
            <div className="menu-separator"></div>
            <div className="menu-item" id="cm-palette" onClick={() => (window as any).executeCommand('workbench.action.showCommands')}>Command Palette...</div>
        </div>
    );
};

const App: React.FC = () => {
    const isCommandPaletteOpen = useStore(state => state.isCommandPaletteOpen);
    const commandPaletteQuery = useStore(state => state.commandPaletteQuery);
    const setCommandPaletteQuery = useStore(state => state.setCommandPaletteQuery);
    const isDebugToolbarOpen = useStore(state => state.isDebugToolbarOpen);

    useEffect(() => {
        (window as any).useStore = useStore;
        // Initialize non-React behaviors once the shell is mounted.
        initCommands();
        initSearch();
        initStatusBar();
        initExtensions();
        initSpecs();
        initMobile();
        initScm();
        initDebugUI();
        initTerminal();
        initAgent();

        // Disable Auto-Load of previous directory to prevent crashing on large folders during startup
        const { refreshAvailableModels, setActiveRoot } = useStore.getState();
        refreshAvailableModels();
        
        // Force clean state on startup instead of restoring activeRoot
        setActiveRoot(null);
    }, []);

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {isCommandPaletteOpen && (
                <div id="command-palette" className="command-palette">
                    <div className="command-input-container">
                        <input 
                            type="text" 
                            id="command-input" 
                            placeholder="Type a command or search..." 
                            autoFocus 
                            value={commandPaletteQuery}
                            onChange={(e) => setCommandPaletteQuery(e.target.value)}
                        />
                    </div>
                    <div id="command-list" className="command-list"></div>
                </div>
            )}

            <TitleBar />
            <Workbench />
            <StatusBar />

            {isDebugToolbarOpen && (
                <div id="debug-toolbar" className="debug-toolbar">
                    <div className="debug-tool-item" id="debug-continue" title="Continue (F5)">▶️</div>
                    <div className="debug-tool-item" id="debug-step-over" title="Step Over (F10)">↷</div>
                    <div className="debug-tool-item" id="debug-step-into" title="Step Into (F11)">↴</div>
                    <div className="debug-tool-item" id="debug-step-out" title="Step Out (Shift+F11)">⤴</div>
                    <div className="debug-tool-item" id="debug-restart" title="Restart (Ctrl+Shift+F5)">↻</div>
                    <div className="debug-tool-item stop" id="debug-stop" title="Stop (Shift+F5)">⏹️</div>
                </div>
            )}
            
            <ContextMenu />
        </div>
    );
};

export default App;
