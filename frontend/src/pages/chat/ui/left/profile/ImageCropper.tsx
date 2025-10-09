import { useEffect, useRef, useState } from "react";
import type { Size2D, Rect } from "../../../../../core/types";

interface ImageCropperProps {
    onCrop: (croppedImageData: string) => void;
    onCancel: () => void;
    imageFile: File | null;
}

export function ImageCropper({ onCrop, onCancel, imageFile }: ImageCropperProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const [src, setSrc] = useState<string | undefined>(undefined);
    const [isLoaded, setIsLoaded] = useState(false);
    const [cropArea, setCropArea] = useState<Rect>({ x: 0, y: 0, width: 200, height: 200 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<Size2D>({ x: 0, y: 0 });

    useEffect(() => {
        if (imageFile) {
            const reader = new FileReader();

            function handleImageLoad() {
                setIsLoaded(true);
                // Initialize crop area to center of image
                const img = imageRef.current;
                if (img) {
                    const size = Math.min(img.naturalWidth, img.naturalHeight) * 0.8;
                    setCropArea({
                        x: (img.naturalWidth - size) / 2,
                        y: (img.naturalHeight - size) / 2,
                        width: size,
                        height: size
                    });
                }
            }

            function handleReaderLoad() {
                if (imageRef.current) {
                    setSrc(reader.result as string);
                    imageRef.current.addEventListener("load", handleImageLoad);
                }
            }

            reader.addEventListener("load", handleReaderLoad);
            reader.readAsDataURL(imageFile);

            return () => {
                reader.abort();
                reader.removeEventListener("load", handleReaderLoad);
                imageRef.current?.removeEventListener("load", handleImageLoad);
            }
        }
    }, [imageFile]);

    function handleMouseDown(e: React.MouseEvent) {
        if (!isLoaded) return;
        
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Check if click is within crop area
        if (x >= cropArea.x && x <= cropArea.x + cropArea.width &&
            y >= cropArea.y && y <= cropArea.y + cropArea.height) {
            setIsDragging(true);
            setDragStart({ x: x - cropArea.x, y: y - cropArea.y });
        }
    };

    function handleMouseMove(e: React.MouseEvent) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (isDragging && isLoaded && rect && imageRef.current) {
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const newX = Math.max(
                0, 
                Math.min(
                    x - dragStart.x, 
                    imageRef.current.naturalWidth - cropArea.width
                )
            );
            const newY = Math.max(
                0, 
                Math.min(
                    y - dragStart.y, 
                    imageRef.current.naturalHeight - cropArea.height
                )
            );

            setCropArea(prev => ({ ...prev, x: newX, y: newY }));
        }
    };

    function handleMouseUp() {
        setIsDragging(false);
    };

    function handleCrop() {
        if (!canvasRef.current || !imageRef.current || !isLoaded) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size to crop area
        canvas.width = cropArea.width;
        canvas.height = cropArea.height;

        // Draw cropped portion
        ctx.drawImage(
            imageRef.current,
            cropArea.x, cropArea.y, cropArea.width, cropArea.height,
            0, 0, cropArea.width, cropArea.height
        );

        // Convert to data URL
        const croppedImageData = canvas.toDataURL('image/jpeg', 0.9);
        onCrop(croppedImageData);
    };

    function drawCropArea() {
        if (!canvasRef.current || !imageRef.current || !isLoaded) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw image
        ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);

        // Draw crop overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Clear crop area
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);

        // Draw crop border
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
    };

    useEffect(() => {
        drawCropArea();
    }, [cropArea, isLoaded]);

    if (!imageFile) return null;

    return (
        <div className="cropper-container">
            <canvas
                ref={canvasRef}
                width={400}
                height={400}
                style={{ 
                    cursor: isDragging ? 'grabbing' : 'grab',
                    border: '1px solid #ccc',
                    maxWidth: '100%',
                    height: 'auto'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            />
            <img
                ref={imageRef}
                src={src}
                style={{ display: 'none' }}
                alt="Crop source"
            />
            <div className="cropper-actions">
                <mdui-button onClick={handleCrop} disabled={!isLoaded}>
                    Обрезать
                </mdui-button>
                <mdui-button variant="outlined" onClick={onCancel}>
                    Отмена
                </mdui-button>
            </div>
        </div>
    );
}
