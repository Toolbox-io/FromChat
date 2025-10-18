import { useState, useEffect, useRef } from "react";
import "./css/searchBar.scss";

interface SearchBarProps {
    placeholder: string;
    children?: React.ReactNode;
    searchQuery: string;
    onQueryChange: (query: string) => void;
    isExpanded: boolean;
    onToggleExpanded: () => void;
    leftIcon?: string | React.ReactNode;
    rightIcon?: string | React.ReactNode;
}

export default function SearchBar({ 
    placeholder,
    children,
    searchQuery,
    onQueryChange,
    isExpanded,
    onToggleExpanded,
    leftIcon = "search--outlined",
    rightIcon = null
}: SearchBarProps) {
    const [dynamicHeight, setDynamicHeight] = useState<string>("48px");
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const parentContainerRef = useRef<HTMLDivElement>(null);


    // Focus input when expanded and manage height
    useEffect(() => {
        if (isExpanded && inputRef.current) {
            inputRef.current.focus();
            // Set expanded height
            const leftPanel = document.getElementById('chat-list');
            if (leftPanel) {
                const panelHeight = leftPanel.offsetHeight;
                setDynamicHeight(`${panelHeight}px`);
            }
        } else {
            // Set collapsed height
            setDynamicHeight("48px");
        }
    }, [isExpanded]);

    function handleToggle() {
        onToggleExpanded();
    };

    function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
        const query = e.target.value;
        onQueryChange(query);
    };

    // Helper function to render icon
    function renderIcon(icon: string | React.ReactNode | undefined, defaultIcon?: string) {
        if (icon === null) return null;
        if (!icon) {
            return defaultIcon ? <mdui-icon name={defaultIcon}></mdui-icon> : null;
        } else if (typeof icon === 'string') {
            return <mdui-icon name={icon}></mdui-icon>;
        } else {
            return icon;
        }
    };

    return (
        <div 
            ref={parentContainerRef}
            className="search-parent"
        >
            <div 
                ref={searchContainerRef}
                className={`search-bar-container ${isExpanded ? "expanded" : "collapsed"}`}
                style={{ height: dynamicHeight }}
                onClick={!isExpanded ? handleToggle : undefined}
            >
                {/* Single Search Bar Element */}
                <div className="search-bar">
                    {/* Left Icon */}
                    <div className="search-icon">
                        {renderIcon(leftIcon, "search--outlined")}
                    </div>

                    {/* Input/Placeholder */}
                    <div className="search-input-container">
                        {isExpanded ? (
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder={placeholder}
                                className="search-input"
                                value={searchQuery}
                                onChange={handleQueryChange}
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span className="search-placeholder">{placeholder}</span>
                        )}
                    </div>

                    {/* Right Icon */}
                    <div className="search-clear">
                        {renderIcon(rightIcon)}
                    </div>
                </div>

                {/* Results Section - Only visible when expanded */}
                {isExpanded && (
                    <div className="search-results">
                        {children}
                    </div>
                )}
            </div>
        </div>
    );
}