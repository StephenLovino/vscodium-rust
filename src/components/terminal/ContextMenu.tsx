import React, { useEffect, useRef } from 'react';

interface ContextMenuOption {
    label: string;
    icon?: string;
    onClick: () => void;
    danger?: boolean;
}

interface ContextMenuProps {
    x: number;
    y: number;
    options: ContextMenuOption[];
    onClose: () => void;
    visible: boolean;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, options, onClose, visible }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        if (visible) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [visible, onClose]);

    if (!visible) return null;

    return (
        <div 
            ref={menuRef}
            className="context-menu"
            style={{
                position: 'fixed',
                top: y,
                left: x,
                zIndex: 1000,
                minWidth: '160px',
                background: 'var(--vscode-menu-background, #252526)',
                color: 'var(--vscode-menu-selectionForeground, #cccccc)',
                border: '1px solid var(--vscode-menu-border, #454545)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
                padding: '4px 0',
                borderRadius: '3px'
            }}
        >
            {options.map((option, index) => (
                <div 
                    key={index}
                    onClick={(e) => {
                        e.stopPropagation();
                        option.onClick();
                        onClose();
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        color: option.danger ? '#f14c4c' : 'inherit'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--vscode-menu-selectionBackground, #094771)';
                        e.currentTarget.style.color = 'var(--vscode-menu-selectionForeground, #ffffff)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = option.danger ? '#f14c4c' : 'inherit';
                    }}
                >
                    {option.icon && <i className={`codicon ${option.icon}`} style={{ fontSize: '14px' }}></i>}
                    <span style={{ flex: 1 }}>{option.label}</span>
                </div>
            ))}
        </div>
    );
};

export default ContextMenu;
