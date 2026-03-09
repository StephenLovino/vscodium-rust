import React from 'react';
import { useStore } from '../store';

const ActivityBar: React.FC = () => {
    const activeView = useStore(state => state.activeSidebarView);
    const setActiveView = useStore(state => state.setActiveSidebarView);

    const items = [
        { id: 'explorer-view', icon: 'files', title: 'Explorer' },
        { id: 'search-view', icon: 'search', title: 'Search' },
        { id: 'scm-view', icon: 'source-control', title: 'Source Control' },
        { id: 'debug-view', icon: 'debug-alt', title: 'Run and Debug' },
        { id: 'extensions-view', icon: 'extensions', title: 'Extensions' },
        { id: 'specs-view', icon: 'book', title: 'Specs' },
        { id: 'agent-view', icon: 'sparkle', title: 'Agent' },
        { id: 'planning-view', icon: 'checklist', title: 'Workflow & Planning' },
        { id: 'mobile-view', icon: 'device-mobile', title: 'Mobile' },
    ];

    return (
        <aside className="activity-bar" id="activity-bar">
            <div className="activity-bar-top">
                {items.map(item => (
                    <div
                        key={item.id}
                        className={`activity-item ${activeView === item.id ? 'active' : ''}`}
                        title={item.title}
                        onClick={() => setActiveView(item.id)}
                    >
                        <div className="activity-item-icon">
                            <i className={`codicon codicon-${item.icon}`}></i>
                        </div>
                    </div>
                ))}
            </div>
            <div className="activity-bar-bottom">
                <div className="activity-item" title="Accounts">
                    <div className="activity-item-icon">
                        <i className="codicon codicon-account"></i>
                    </div>
                </div>
                <div className="activity-item" title="Manage" id="activity-settings">
                    <div className="activity-item-icon">
                        <i className="codicon codicon-settings-gear"></i>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default ActivityBar;
