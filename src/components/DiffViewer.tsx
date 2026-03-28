import { useStore } from '../store';
import type { PendingChange } from '../store';

interface DiffViewerProps {
    change: PendingChange;
}

const DiffViewer: React.FC<DiffViewerProps> = ({ change }) => {
    const acceptPendingChange = useStore(state => state.acceptPendingChange);
    const rejectPendingChange = useStore(state => state.rejectPendingChange);

    return (
        <div className="diff-viewer-overlay">
            <div className="diff-viewer-header">
                <div className="diff-info">
                    <i className="codicon codicon-diff-modified" />
                    <span className="file-path">{change.path}</span>
                    <span className="diff-desc">{change.description}</span>
                </div>
                <div className="diff-actions">
                    <button className="btn-reject" onClick={() => rejectPendingChange(change.id)}>
                        <i className="codicon codicon-close" /> Reject
                    </button>
                    <button className="btn-accept" onClick={() => acceptPendingChange(change.id)}>
                        <i className="codicon codicon-check" /> Accept
                    </button>
                </div>
            </div>
            
            <style>{`
                .diff-viewer-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    z-index: 100;
                    background: var(--vscode-editor-background, #1e1e1e);
                    border-bottom: 1px solid var(--vscode-panel-border, #454545);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    animation: slideDown 0.2s ease-out;
                }

                @keyframes slideDown {
                    from { transform: translateY(-100%); }
                    to { transform: translateY(0); }
                }

                .diff-viewer-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 16px;
                    background: var(--vscode-editorWidget-background, #252526);
                }

                .diff-info {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 12px;
                }

                .file-path {
                    font-weight: 600;
                    color: var(--vscode-breadcrumb-foreground, #ccc);
                }

                .diff-desc {
                    color: var(--vscode-descriptionForeground, #888);
                    font-style: italic;
                }

                .diff-actions {
                    display: flex;
                    gap: 8px;
                }

                button {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 4px 10px;
                    border-radius: 4px;
                    border: none;
                    font-size: 12px;
                    cursor: pointer;
                    transition: filter 0.1s;
                }

                button:hover {
                    filter: brightness(1.2);
                }

                .btn-accept {
                    background: var(--vscode-button-background, #0e639c);
                    color: white;
                }

                .btn-reject {
                    background: transparent;
                    color: var(--vscode-errorForeground, #f48771);
                    border: 1px solid var(--vscode-errorForeground, #f48771);
                }

                .codicon {
                    font-size: 14px;
                }
            `}</style>
        </div>
    );
};

export default DiffViewer;
