import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { api } from '../../lib/api';
import { formatTime } from '../../lib/utils';
import './SearchModal.css';

interface SearchResult {
    id: string;
    content: string;
    type: string;
    createdAt: string;
    senderId: string;
    senderName: string;
}

interface Props {
    conversationId: string;
    onClose: () => void;
    onSelectMessage: (messageId: string) => void;
}

export function SearchModal({ conversationId, onClose, onSelectMessage }: Props) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus input
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Search on query change (debounced)
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const response = await api.searchMessages(conversationId, query);
                setResults(response.results);
            } catch (err) {
                console.error('Search failed', err);
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(timer);
    }, [query, conversationId]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleSelect = (messageId: string) => {
        onSelectMessage(messageId);
        onClose();
    };

    return (
        <div className="search-modal-overlay" onClick={onClose}>
            <div className="search-modal" onClick={(e) => e.stopPropagation()}>
                <div className="search-modal-header">
                    <Search size={18} />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search messages..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="search-modal-input"
                    />
                    <button onClick={onClose} className="search-modal-close">
                        <X size={18} />
                    </button>
                </div>

                <div className="search-modal-results">
                    {loading && <div className="search-modal-loading">Searching...</div>}

                    {!loading && results.length === 0 && query.trim() && (
                        <div className="search-modal-empty">No messages found</div>
                    )}

                    {!loading && results.map((result) => (
                        <div
                            key={result.id}
                            className="search-result-item"
                            onClick={() => handleSelect(result.id)}
                        >
                            <div className="search-result-header">
                                <span className="search-result-sender">{result.senderName}</span>
                                <span className="search-result-time">{formatTime(result.createdAt)}</span>
                            </div>
                            <div className="search-result-content">
                                {result.content || '[Attachment]'}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="search-modal-footer">
                    <kbd>Esc</kbd> to close
                </div>
            </div>
        </div>
    );
}
