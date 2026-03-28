import React from 'react';
import { useStore } from '../store';

const AgentSettingsView: React.FC = () => {
    const cyberMode = useStore(state => state.cyberMode);
    const ollamaUrl = useStore(state => state.ollamaUrl);
    const setCyberMode = useStore(state => state.setCyberMode);
    const setOllamaUrl = useStore(state => state.setOllamaUrl);
    const ollamaStatus = useStore(state => state.ollamaStatus);
    const refreshModels = useStore(state => state.refreshAvailableModels);
    const agentModel = useStore(state => state.agentModel);
    const setAgentModel = useStore(state => state.setAgentModel);
    const availableModels = useStore(state => state.availableModels);

    return (
        <div className="agent-settings-view" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto' }}>
            <section>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--vscode-sideBarSectionHeader-foreground)', marginBottom: '12px', textTransform: 'uppercase' }}>
                    Model Configuration
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '11px', opacity: 0.8 }}>Active Model</label>
                    <select 
                        value={agentModel}
                        onChange={(e) => setAgentModel(e.target.value)}
                        style={{ background: 'var(--vscode-dropdown-background)', color: 'var(--vscode-dropdown-foreground)', border: '1px solid var(--vscode-dropdown-border)', padding: '4px', fontSize: '12px' }}
                    >
                        {availableModels.map(m => (
                            <option key={`${m.provider}|${m.id}`} value={`${m.provider}|${m.id}`}>
                                {m.provider.toUpperCase()} - {m.id}
                            </option>
                        ))}
                    </select>
                </div>
            </section>

            <section>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--vscode-sideBarSectionHeader-foreground)', marginBottom: '12px', textTransform: 'uppercase' }}>
                    Ollama Integration
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', opacity: 0.8 }}>Self-Hosted URL</label>
                        <input 
                            type="text" 
                            value={ollamaUrl}
                            onChange={(e) => setOllamaUrl(e.target.value)}
                            style={{ background: 'var(--vscode-input-background)', color: 'var(--vscode-input-foreground)', border: '1px solid var(--vscode-input-border)', padding: '4px 8px', fontSize: '12px' }}
                            placeholder="http://localhost:11434"
                        />
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ 
                            width: '8px', 
                            height: '8px', 
                            borderRadius: '50%', 
                            background: ollamaStatus === 'running' ? '#4ade80' : ollamaStatus === 'error' ? '#f87171' : '#fbbf24'
                        }}></div>
                        <span style={{ fontSize: '12px' }}>
                            {ollamaStatus === 'running' ? 'Connected' : ollamaStatus === 'error' ? 'Error' : 'Checking...'}
                        </span>
                        <button 
                            onClick={() => refreshModels('ollama')}
                            style={{ marginLeft: 'auto', background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)', border: 'none', padding: '2px 8px', fontSize: '10px', cursor: 'pointer' }}
                        >
                            Reconnect
                        </button>
                    </div>
                </div>
            </section>

            <section>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--vscode-sideBarSectionHeader-foreground)', marginBottom: '12px', textTransform: 'uppercase' }}>
                    Cybersecurity Mode
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input 
                            type="checkbox" 
                            checked={cyberMode}
                            onChange={(e) => setCyberMode(e.target.checked)}
                            style={{ cursor: 'pointer' }}
                        />
                        <label style={{ fontSize: '12px', fontWeight: 500, color: cyberMode ? '#f87171' : 'inherit' }}>
                            Enable Offensive Capabilities
                        </label>
                    </div>
                    <p style={{ fontSize: '11px', opacity: 0.6, margin: 0, fontStyle: 'italic' }}>
                        Enables exploit generation, malware research, and advanced reverse engineering tools for the AI agent.
                    </p>
                </div>
            </section>
        </div>
    );
};

export default AgentSettingsView;
