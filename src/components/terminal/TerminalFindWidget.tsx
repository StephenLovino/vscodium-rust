import React, { useState, useEffect, useRef } from 'react';
import { SearchAddon } from '@xterm/addon-search';

interface TerminalFindWidgetProps {
    searchAddon: SearchAddon | null;
    visible: boolean;
    onClose: () => void;
}

const TerminalFindWidget: React.FC<TerminalFindWidgetProps> = ({ searchAddon, visible, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isCaseSensitive, setIsCaseSensitive] = useState(false);
    const [isWholeWord, setIsWholeWord] = useState(false);
    const [isRegex, setIsRegex] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (visible && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [visible]);

    const handleSearch = (next = true) => {
        if (!searchAddon || !searchTerm) return;
        
        if (next) {
            searchAddon.findNext(searchTerm, {
                caseSensitive: isCaseSensitive,
                wholeWord: isWholeWord,
                regex: isRegex,
                incremental: true
            });
        } else {
            searchAddon.findPrevious(searchTerm, {
                caseSensitive: isCaseSensitive,
                wholeWord: isWholeWord,
                regex: isRegex
            });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch(!e.shiftKey);
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    if (!visible) return null;

    return (
        <div 
            className="terminal-find-widget"
            style={{
                position: 'absolute',
                top: '0',
                right: '40px',
                zIndex: 100,
                background: 'var(--vscode-editorWidget-background, #252526)',
                border: '1px solid var(--vscode-widget-border, #454545)',
                display: 'flex',
                alignItems: 'center',
                padding: '4px 6px',
                gap: '4px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
                borderRadius: '0 0 3px 3px'
            }}
        >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Find"
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        // Search as we type
                        if (searchAddon && e.target.value) {
                            searchAddon.findNext(e.target.value, {
                                caseSensitive: isCaseSensitive,
                                wholeWord: isWholeWord,
                                regex: isRegex,
                                incremental: true
                            });
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    style={{
                        background: 'var(--vscode-input-background, #3c3c3c)',
                        color: 'var(--vscode-input-foreground, #cccccc)',
                        border: '1px solid var(--vscode-input-border, transparent)',
                        padding: '2px 30px 2px 6px',
                        fontSize: '11px',
                        width: '180px',
                        outline: 'none'
                    }}
                />
                
                {/* Search Options (Mini icons inside input) */}
                <div style={{ position: 'absolute', right: '4px', display: 'flex', gap: '2px' }}>
                    <i 
                        className="codicon codicon-case-sensitive" 
                        title="Match Case"
                        onClick={() => setIsCaseSensitive(!isCaseSensitive)}
                        style={{ 
                            fontSize: '12px', 
                            cursor: 'pointer',
                            opacity: isCaseSensitive ? 1 : 0.4,
                            padding: '2px',
                            background: isCaseSensitive ? 'rgba(0, 122, 204, 0.4)' : 'transparent',
                            borderRadius: '2px'
                        }}
                    ></i>
                    <i 
                        className="codicon codicon-whole-word" 
                        title="Match Whole Word"
                        onClick={() => setIsWholeWord(!isWholeWord)}
                        style={{ 
                            fontSize: '12px', 
                            cursor: 'pointer',
                            opacity: isWholeWord ? 1 : 0.4,
                            padding: '2px',
                            background: isWholeWord ? 'rgba(0, 122, 204, 0.4)' : 'transparent',
                            borderRadius: '2px'
                        }}
                    ></i>
                    <i 
                        className="codicon codicon-regex" 
                        title="Use Regular Expression"
                        onClick={() => setIsRegex(!isRegex)}
                        style={{ 
                            fontSize: '12px', 
                            cursor: 'pointer',
                            opacity: isRegex ? 1 : 0.4,
                            padding: '2px',
                            background: isRegex ? 'rgba(0, 122, 204, 0.4)' : 'transparent',
                            borderRadius: '2px'
                        }}
                    ></i>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '2px', borderLeft: '1px solid #444', paddingLeft: '4px', marginLeft: '4px' }}>
                <i 
                    className="codicon codicon-arrow-up" 
                    title="Previous Match (Shift+Enter)"
                    onClick={() => handleSearch(false)}
                    style={{ fontSize: '14px', cursor: 'pointer', padding: '2px', borderRadius: '3px' }}
                ></i>
                <i 
                    className="codicon codicon-arrow-down" 
                    title="Next Match (Enter)"
                    onClick={() => handleSearch(true)}
                    style={{ fontSize: '14px', cursor: 'pointer', padding: '2px', borderRadius: '3px' }}
                ></i>
                <i 
                    className="codicon codicon-close" 
                    title="Close (Escape)"
                    onClick={onClose}
                    style={{ fontSize: '14px', cursor: 'pointer', padding: '2px', borderRadius: '3px', marginLeft: '4px' }}
                ></i>
            </div>
        </div>
    );
};

export default TerminalFindWidget;
