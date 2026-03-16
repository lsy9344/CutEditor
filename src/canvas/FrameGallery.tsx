import React, { useState } from 'react';
import { FRAME_LAYOUTS, type FrameType, type FrameOption } from '../types/frame';

interface FrameGalleryProps {
    selectedCategory: string | null;
    options: FrameOption[];
    onSelectFrame: (frame: FrameType) => void;
}

export const FrameGallery: React.FC<FrameGalleryProps> = ({
    selectedCategory,
    options,
    onSelectFrame,
}) => {
    const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
    const [previewSources, setPreviewSources] = useState<Record<string, string>>({});

    const handleImageLoad = (value: string) => {
        setLoadedImages((prev) => ({ ...prev, [value]: true }));
    };

    const getPreviewSource = (option: FrameOption): string => {
        return previewSources[option.value] ?? `/popover/${option.image}`;
    };

    const handleImageError = (option: FrameOption) => {
        const fallbackSource = FRAME_LAYOUTS[option.value]?.imagePath;
        if (!fallbackSource) return;

        setPreviewSources((prev) => {
            if (prev[option.value] === fallbackSource) {
                return prev;
            }
            return { ...prev, [option.value]: fallbackSource };
        });
        setLoadedImages((prev) => ({ ...prev, [option.value]: false }));
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
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🖼️</div>
                <h2 style={{
                    fontSize: 'var(--linear-text-xl)',
                    fontWeight: 'var(--linear-font-bold)',
                    color: 'var(--linear-text-primary)'
                }}>
                    왼쪽에서 원하는 컷 수를 먼저 선택해 주세요!
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
                {selectedCategory} 프레임 선택
            </h2>

            <div className="frame-gallery-grid">
                {options.map((option) => (
                    <div
                        key={option.value}
                        className={`frame-gallery-card ${option.orientation === 'horizontal' ? 'span-2' : ''}`}
                        onClick={() => onSelectFrame(option.value)}
                    >
                        <div className={`frame-gallery-image-container ${loadedImages[option.value] ? 'loaded' : 'loading'}`}>
                            <img
                                src={getPreviewSource(option)}
                                alt={option.label}
                                loading="lazy"
                                onLoad={() => handleImageLoad(option.value)}
                                onError={() => handleImageError(option)}
                            />
                        </div>
                        <div className="frame-gallery-label">
                            <span className="label-text">{option.label}</span>
                            {option.description && (
                                <span className="label-desc">{option.description}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
