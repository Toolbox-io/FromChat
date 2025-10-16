import { useState, useEffect } from "react";
import { useAppState } from "@/pages/chat/state";
import { searchUsers, fetchUserPublicKey } from "@/core/api/dmApi";
import type { User } from "@/core/types";
import defaultAvatar from "@/images/default-avatar.png";
import SearchBar from "@/core/components/SearchBar";

interface SearchUser extends User {
    publicKey?: string | null;
}

export function UsernameSearch() {
    const { user, switchToDM } = useAppState();
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [debounceTimeout, setDebounceTimeout] = useState<NodeJS.Timeout | null>(null);

    // Debounced search
    useEffect(() => {
        if (debounceTimeout) {
            clearTimeout(debounceTimeout);
        }

        if (searchQuery.length > 1) {
            setIsSearching(true);
            const newTimeout = setTimeout(async () => {
                if (user.authToken) {
                    try {
                        const users = await searchUsers(searchQuery, user.authToken);
                        setSearchResults(users);
                    } catch (error) {
                        console.error("Search failed:", error);
                        setSearchResults([]);
                    } finally {
                        setIsSearching(false);
                    }
                }
            }, 300);
            setDebounceTimeout(newTimeout);
        } else {
            setSearchResults([]);
            setIsSearching(false);
        }

        return () => {
            if (debounceTimeout) {
                clearTimeout(debounceTimeout);
            }
        };
    }, [searchQuery, user.authToken]);

    async function handleUserClick(searchUser: SearchUser) {
        if (!user.authToken) return;

        try {
            let publicKey = searchUser.publicKey;
            if (!publicKey) {
                const fetchedPublicKey = await fetchUserPublicKey(searchUser.id, user.authToken);
                publicKey = fetchedPublicKey;
            }

            if (publicKey) {
                switchToDM({
                    userId: searchUser.id,
                    username: searchUser.username,
                    publicKey: publicKey,
                    profilePicture: searchUser.profile_picture,
                    online: searchUser.online || false
                });
                // Collapse search
                setIsExpanded(false);
                setSearchQuery("");
                setSearchResults([]);
            }
        } catch (error) {
            console.error("Failed to start DM conversation:", error);
        }
    }

    function handleQueryChange(query: string) {
        setSearchQuery(query);
    }

    function handleToggleExpanded() {
        if (isExpanded) {
            // Collapsing
            setSearchQuery("");
            setSearchResults([]);
        }
        setIsExpanded(!isExpanded);
    }

    return (
        <SearchBar
            placeholder="Поиск"
            searchQuery={searchQuery}
            onQueryChange={handleQueryChange}
            isExpanded={isExpanded}
            onToggleExpanded={handleToggleExpanded}
            leftIcon={isExpanded ? (
                <mdui-button-icon
                    className="back-button"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleToggleExpanded();
                    }}
                    type="button"
                    icon="arrow_back--outlined"
                />
            ) : "search--outlined"}
        >
            {isSearching && (
                <div className="search-loading">
                    <mdui-circular-progress value={0}></mdui-circular-progress>
                    <span>Поиск...</span>
                </div>
            )}

            {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="search-empty">
                    <span>Пользователи не найдены</span>
                </div>
            )}

            {!isSearching && searchResults.length > 0 && (
                <mdui-list>
                    {searchResults.map((searchUser) => (
                        <mdui-list-item
                            key={searchUser.id}
                            headline={searchUser.username}
                            description={searchUser.online ? "В сети" : "Не в сети"}
                            onClick={() => handleUserClick(searchUser)}
                            style={{ cursor: "pointer" }}
                        >
                            <img 
                                src={searchUser.profile_picture || defaultAvatar}
                                alt={searchUser.username}
                                slot="icon"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = defaultAvatar;
                                }}
                            />
                        </mdui-list-item>
                    ))}
                </mdui-list>
            )}

            {!isSearching && searchQuery.length < 2 && (
                <div className="search-hint">
                    <span>Введите минимум 2 символа для поиска</span>
                </div>
            )}
        </SearchBar>
    );
}