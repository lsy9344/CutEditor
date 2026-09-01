import React, { useState } from 'react';
import type { StickerCategory } from '../ui/stickerCatalog';

interface StickerGalleryProps {
    selectedCategory: StickerCategory | null;
    onSelectSticker: (src: string) => void;
}

export const StickerGallery: React.FC<StickerGalleryProps> = ({
    selectedCategory,
    onSelectSticker,
}) => {
    const [stickerPreviewIndexes, setStickerPreviewIndexes] = useState<Record<string, number>>({});

    const handleStickerPreviewError = (slotKey: string, candidateCount: number) => {
        setStickerPreviewIndexes((prev) => {
            const currentIndex = prev[slotKey] ?? 0;

            if (currentIndex >= candidateCount) {
                return prev;
            }

            return {
                ...prev,
                [slotKey]: currentIndex + 1,
            };
        });
    };

    if (!selectedCategory) {
        return (
            <div className="linear-fade-in" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                width: '100%',
                padding: '24px',
                textAlign: 'center',
                backgroundColor: 'var(--linear-neutral-700)',
            }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎨</div>
                <h2 style={{
                    fontSize: 'var(--linear-text-xl)',
                    fontWeight: 'var(--linear-font-bold)',
                    color: 'var(--linear-text-primary)'
                }}>
                    오른쪽에서 원하는 스티커 카테고리를 먼저 선택해 주세요!
                </h2>
            </div>
        );
    }

    return (
        <div className="linear-fade-in" style={{
            padding: '24px',
            overflowY: 'auto',
            height: '100%',
            width: '100%',
            backgroundColor: 'var(--linear-neutral-700)',
        }}>
            <h2 style={{
                fontSize: 'var(--linear-text-xl)',
                fontWeight: 'var(--linear-font-bold)',
                marginBottom: '24px',
                color: 'var(--linear-text-primary)'
            }}>
                {selectedCategory.label}
            </h2>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                gap: '16px'
            }}>
                {selectedCategory.stickers
                    .filter((slot) => (stickerPreviewIndexes[slot.key] ?? 0) < slot.candidates.length)
                    .map((slot) => {
                    const currentIndex = stickerPreviewIndexes[slot.key] ?? 0;
                    const previewSrc = slot.candidates[currentIndex];
                    const isReady = currentIndex < slot.candidates.length && Boolean(previewSrc);

                    return (
                        <button
                            key={slot.key}
                            className="frame-gallery-card"
                            onClick={() => {
                                if (isReady && previewSrc) {
                                    onSelectSticker(previewSrc);
                                }
                            }}
                            style={{
                                opacity: isReady ? 1 : 0.55,
                                cursor: isReady ? 'pointer' : 'not-allowed',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '16px'
                            }}
                        >
                            <div style={{ width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {isReady ? (
                                    <img
                                        src={previewSrc}
                                        alt={`${slot.key} sticker`}
                                        loading="lazy"
                                        onError={() => handleStickerPreviewError(slot.key, slot.candidates.length)}
                                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                    />
                                ) : null}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
