import React from 'react';
import { useStore } from '../store';

export const TrustDialog: React.FC = () => {
    const request = useStore(state => state.extensionTrustRequest);
    const resolve = useStore(state => state.resolveExtensionTrust);
    const [alwaysTrust, setAlwaysTrust] = React.useState(false);

    if (!request) return null;

    return (
        <div className="theme-picker-overlay" style={{ zIndex: 11000 }}>
            <div className="solid-panel" style={{ 
                width: '400px', 
                padding: '20px', 
                borderRadius: '4px',
                boxShadow: 'var(--shadow-macos)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
            }}>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>Trust this extension?</div>
                <div style={{ fontSize: '13px', opacity: 0.9, lineHeight: '1.4' }}>
                    Antigravity is about to install <strong>{request.publisher}.{request.name}</strong> (v{request.version}). 
                    Installing extensions from untrusted sources can potentially harm your system.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginTop: '4px' }}>
                    <input 
                        type="checkbox" 
                        id="always-trust-checkbox" 
                        checked={alwaysTrust}
                        onChange={(e) => setAlwaysTrust(e.target.checked)}
                    />
                    <label htmlFor="always-trust-checkbox" style={{ cursor: 'pointer' }}>
                        Always trust publisher "<strong>{request.publisher}</strong>"
                    </label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                    <button 
                        className="nav-btn" 
                        style={{ border: 'none', background: 'transparent', color: '#fff', padding: '6px 16px', width: 'auto' }}
                        onClick={() => resolve(false)}
                    >
                        Don't Install
                    </button>
                    <button 
                        style={{ 
                            background: 'var(--antigravity-accent)', 
                            color: '#fff', 
                            border: 'none', 
                            padding: '6px 16px', 
                            borderRadius: '2px',
                            cursor: 'pointer'
                        }}
                        onClick={() => resolve(true, alwaysTrust)}
                    >
                        Trust and Install
                    </button>
                </div>
            </div>
        </div>
    );
};
