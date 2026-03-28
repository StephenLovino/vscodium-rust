import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import EmulatorPanel from './EmulatorPanel';
import MitmPanel from './MitmPanel';
import { terminalManager } from '../terminal';
import TerminalView from './terminal/TerminalView';

interface TerminalTab {
    id: string;
    name: string;
}


const BottomPanel: React.FC = () => {
    const isOpen = useStore(state => state.isBottomPanelOpen);
    const activeTab = useStore(state => state.activePanelTab);
    const setActiveTab = useStore(state => state.setActivePanelTab);
    const toggleBottomPanel = useStore(state => state.toggleBottomPanel);
    
    const terminalGroups = useStore(state => state.terminalGroups);
    const activeTerminalGroupId = useStore(state => state.activeTerminalGroupId);
    const addTerminalGroup = useStore(state => state.addTerminalGroup);
    const splitTerminal = useStore(state => state.splitTerminal);
    
    const activeGroup = terminalGroups.find(g => g.id === activeTerminalGroupId);

    if (!isOpen) return null;

    return (
        <footer className="bottom-panel" id="bottom-panel" style={{
            display: 'flex',
            flexDirection: 'column',
            background: '#1e1e1e', // Match VS Code Dark
            color: '#cccccc',
            borderTop: '1px solid #333'
        }}>
            <div className="panel-header" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '35px',
                padding: '0 8px',
                borderBottom: '1px solid #333',
                fontSize: '11px',
                textTransform: 'uppercase'
            }}>
                <div className="panel-tabs" style={{ display: 'flex', gap: '16px', height: '100%', alignItems: 'center' }}>
                    {['Problems', 'Output', 'Debug Console', 'Terminal', 'Ports'].map(tab => (
                        <div 
                            key={tab}
                            className={`panel-tab ${activeTab === tab.toUpperCase() ? 'active' : ''}`} 
                            onClick={() => setActiveTab(tab.toUpperCase() as any)}
                            style={{ 
                                cursor: 'pointer', 
                                borderBottom: activeTab === tab.toUpperCase() ? '1px solid #ffffff' : '1px solid transparent',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                opacity: activeTab === tab.toUpperCase() ? 1 : 0.6,
                                padding: '0 4px',
                                gap: '6px'
                            }}
                        >
                            {tab}
                            {tab === 'Problems' && (
                                <span style={{ 
                                    background: '#007acc', 
                                    color: '#ffffff', 
                                    padding: '1px 6px', 
                                    borderRadius: '10px', 
                                    fontSize: '10px',
                                    fontWeight: 700
                                }}>6</span>
                            )}
                        </div>
                    ))}
                </div>

                <div className="panel-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {activeTab === 'TERMINAL' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div className="toolbar-item" style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.8 }}>
                                <i className="codicon codicon-terminal" style={{ fontSize: '14px' }}></i>
                                <span>zsh</span>
                                <i className="codicon codicon-chevron-down" style={{ fontSize: '12px' }}></i>
                            </div>
                            <div className="toolbar-item" onClick={() => addTerminalGroup()} title="New Terminal"><i className="codicon codicon-add" style={{ fontSize: '16px' }}></i></div>
                            <div className="toolbar-item" onClick={() => activeGroup && splitTerminal(activeGroup.id, activeGroup.activeInstanceId)} title="Split Terminal"><i className="codicon codicon-split-horizontal" style={{ fontSize: '16px' }}></i></div>
                            <div className="toolbar-item" title="Kill Terminal"><i className="codicon codicon-trash" style={{ fontSize: '16px' }}></i></div>
                            <div className="toolbar-item"><i className="codicon codicon-broadcast" style={{ fontSize: '16px' }}></i></div>
                            <div className="toolbar-item"><i className="codicon codicon-more" style={{ fontSize: '16px' }}></i></div>
                        </div>
                    )}
                    <span style={{ height: '20px', width: '1px', background: '#444', margin: '0 4px' }}></span>
                    <div className="toolbar-item" title="Maximize Panel Size"><i className="codicon codicon-chevron-up" style={{ fontSize: '16px' }}></i></div>
                    <div className="toolbar-item" title="Close Panel" onClick={toggleBottomPanel}><i className="codicon codicon-close" style={{ fontSize: '16px' }}></i></div>
                </div>
            </div>

            <div className="panel-content" id="panel-content" style={{ flex: 1, overflow: 'hidden' }}>
                {activeTab === 'TERMINAL' && <TerminalView />}
                {['PROBLEMS', 'OUTPUT', 'DEBUG CONSOLE', 'PORTS'].includes(activeTab) && (
                    <div style={{ padding: '20px', opacity: 0.5, fontSize: '12px', textAlign: 'center' }}>
                         {activeTab} view is currently empty.
                    </div>
                )}
            </div>
        </footer>
    );
};

export default BottomPanel;
