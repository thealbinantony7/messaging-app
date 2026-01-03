import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import './MediaViewer.css';

interface MediaItem {
    id: string;
    url: string;
    createdAt: string;
}

interface Props {
    items: MediaItem[];
    initialIndex: number;
    onClose: () => void;
}

export function MediaViewer({ items, initialIndex, onClose }: Props) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [showUI, setShowUI] = useState(true);
    const [touchStart, setTouchStart] = useState<number | null>(null);

    const currentItem = items[currentIndex];
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex < items.length - 1;

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowLeft' && hasPrev) {
                setCurrentIndex(currentIndex - 1);
            } else if (e.key === 'ArrowRight' && hasNext) {
                setCurrentIndex(currentIndex + 1);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, hasPrev, hasNext, onClose]);

    // Touch swipe navigation
    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStart(e.touches[0]?.clientX ?? null);
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStart === null) return;

        const touchEnd = e.changedTouches[0]?.clientX;
        if (touchEnd === undefined) return;

        const diff = touchStart - touchEnd;

        // Swipe threshold: 50px
        if (Math.abs(diff) > 50) {
            if (diff > 0 && hasNext) {
                setCurrentIndex(currentIndex + 1);
            } else if (diff < 0 && hasPrev) {
                setCurrentIndex(currentIndex - 1);
            }
        }

        setTouchStart(null);
    };

    if (!currentItem) return null;

    return (
        <div
            className="media-viewer"
            onClick={() => setShowUI(!showUI)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            {/* Header */}
            {showUI && (
                <div className="media-viewer-header" onClick={(e) => e.stopPropagation()}>
                    <div className="media-viewer-counter">
                        {currentIndex + 1} / {items.length}
                    </div>
                    <button
                        className="media-viewer-close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <X size={24} />
                    </button>
                </div>
            )}

            {/* Image */}
            <div className="media-viewer-content">
                <img
                    src={currentItem.url}
                    alt="Media"
                    className="media-viewer-image"
                    onClick={(e) => e.stopPropagation()}
                />
            </div>

            {/* Navigation */}
            {showUI && items.length > 1 && (
                <>
                    {hasPrev && (
                        <button
                            className="media-viewer-nav media-viewer-nav-prev"
                            onClick={(e) => {
                                e.stopPropagation();
                                setCurrentIndex(currentIndex - 1);
                            }}
                            aria-label="Previous"
                        >
                            <ChevronLeft size={32} />
                        </button>
                    )}
                    {hasNext && (
                        <button
                            className="media-viewer-nav media-viewer-nav-next"
                            onClick={(e) => {
                                e.stopPropagation();
                                setCurrentIndex(currentIndex + 1);
                            }}
                            aria-label="Next"
                        >
                            <ChevronRight size={32} />
                        </button>
                    )}
                </>
            )}
        </div>
    );
}
