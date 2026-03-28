import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface Extension {
    id?: string;
    namespace?: string;
    publisher?: string;
    name: string;
    version: string;
    displayName?: string;
    description?: string;
    iconUrl?: string;
}

const ExtensionsView: React.FC = () => {
    const [query, setQuery] = useState('');
    const [marketExtensions, setMarketExtensions] = useState<Extension[]>([]);
    const [installedExtensions, setInstalledExtensions] = useState<Extension[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [activeTab, setActiveTab] = useState<'installed' | 'marketplace'>('installed');

    useEffect(() => {
        loadInstalled();
    }, []);

    const loadInstalled = async () => {
        try {
            const installed = await invoke<Extension[]>('get_installed_extensions');
            setInstalledExtensions(installed);
        } catch (e) {
            console.error('Failed to load installed extensions', e);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query) return;
        setIsSearching(true);
        setActiveTab('marketplace');
        try {
            const results = await invoke<Extension[]>('search_extensions', { query });
            setMarketExtensions(results);
        } catch (e) {
            console.error('Search extensions failed', e);
        } finally {
            setIsSearching(false);
        }
    };

    const installExtension = async (ext: Extension) => {
        try {
            // Publisher from Open-VSX is usually in 'namespace' or manually split from id
            const publisher = ext.namespace || ext.publisher || ext.id?.split('.')[0] || 'unknown';
            await invoke('install_extension', { 
                publisher, 
                name: ext.name, 
                version: ext.version 
            });
            alert(`Installed ${ext.displayName || ext.name}`);
            loadInstalled();
        } catch (e) {
            alert(`Installation failed: ${e}`);
        }
    };

    return (
        <div className="extensions-view" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
             <div className="sidebar-search-container" style={{ padding: '10px' }}>
                <form onSubmit={handleSearch}>
                    <input 
                        type="text" 
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search Extensions in Marketplace" 
                        style={{ 
                            width: '100%', 
                            boxSizing: 'border-box', 
                            background: 'var(--vscode-input-background)', 
                            color: 'var(--vscode-input-foreground)', 
                            border: '1px solid var(--vscode-panel-border)', 
                            padding: '4px 6px', 
                            fontSize: '12px', 
                            outline: 'none',
                            borderRadius: '2px'
                        }} 
                    />
                </form>
            </div>

            <div className="extensions-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--vscode-panel-border)', fontSize: '11px' }}>
                <div 
                    onClick={() => setActiveTab('installed')}
                    style={{ padding: '6px 12px', cursor: 'pointer', opacity: activeTab === 'installed' ? 1 : 0.6, borderBottom: activeTab === 'installed' ? '1px solid var(--vscode-focusBorder)' : 'none' }}>
                    INSTALLED
                </div>
                <div 
                    onClick={() => setActiveTab('marketplace')}
                    style={{ padding: '6px 12px', cursor: 'pointer', opacity: activeTab === 'marketplace' ? 1 : 0.6, borderBottom: activeTab === 'marketplace' ? '1px solid var(--vscode-focusBorder)' : 'none' }}>
                    MARKETPLACE
                </div>
            </div>

            <div className="extensions-list" style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                {activeTab === 'installed' ? (
                    installedExtensions.map((ext, i) => (
                        <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '12px', fontSize: '12px' }}>
                            <div style={{ width: '32px', height: '32px', background: '#333', borderRadius: '4px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <i className="codicon codicon-extensions" style={{ fontSize: '20px', opacity: 0.5 }}></i>
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <div style={{ fontWeight: 'bold' }}>{ext.displayName || ext.name}</div>
                                <div style={{ fontSize: '10px', opacity: 0.6 }}>{ext.version} - {ext.publisher}</div>
                            </div>
                        </div>
                    ))
                ) : (
                    isSearching ? (
                        <div style={{ textAlign: 'center', padding: '20px' }}><i className="codicon codicon-loading codicon-modifier-spin"></i></div>
                    ) : (
                        marketExtensions.map((ext, i) => (
                            <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '16px', fontSize: '12px' }}>
                                {ext.iconUrl ? (
                                    <img src={ext.iconUrl} style={{ width: '32px', height: '32px', borderRadius: '4px' }} alt="icon" />
                                ) : (
                                    <div style={{ width: '32px', height: '32px', background: '#333', borderRadius: '4px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <i className="codicon codicon-extensions" style={{ fontSize: '20px', opacity: 0.5 }}></i>
                                    </div>
                                )}
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ext.displayName || ext.name}</span>
                                        <button 
                                            onClick={() => installExtension(ext)}
                                            style={{ background: 'var(--vscode-button-background)', color: 'white', border: 'none', padding: '2px 8px', fontSize: '10px', cursor: 'pointer', borderRadius: '2px' }}>
                                            Install
                                        </button>
                                    </div>
                                    <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {ext.description}
                                    </div>
                                </div>
                            </div>
                        ))
                    )
                )}
            </div>
        </div>
    );
};

export default ExtensionsView;
