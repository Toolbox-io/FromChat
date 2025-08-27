/**
 * @fileoverview Canvas-based image cropping component
 * @description Provides circular image cropping functionality with drag support
 * @author Cursor
 * @version 1.0.0
 */

import type { Size2D } from "../../core/types";

/**
 * Image cropper class for circular profile picture cropping
 * @class ImageCropper
 */
export class ImageCropper {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    /**
     * Image element to be cropped
     * @type {HTMLImageElement}
     * @private
     */
    private image!: HTMLImageElement;

    /**
     * Size of the crop area (diameter)
     * @type {number}
     * @private
     */
    private cropSize: number = 200;
    private isDragging: boolean = false;

    /**
     * Starting position of the drag operation
     * @type {Size2D}
     * @private
     */
    private dragStart: Size2D = { x: 0, y: 0 };

    /**
     * Current position of the crop area
     * @type {Size2D}
     * @private
     */
    private cropPosition: Size2D = { x: 0, y: 0 };

    /**
     * Creates a new ImageCropper instance
     * @param {HTMLElement} container - Container element to append the canvas to
     * @constructor
     * @example
     * const cropper = new ImageCropper(document.getElementById('cropper-area'));
     */
    constructor(container: HTMLElement) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.cropSize;
        this.canvas.height = this.cropSize;
        this.ctx = this.canvas.getContext('2d')!;
        
        container.appendChild(this.canvas);
        this.setupEventListeners();
    }

    /**
     * Sets up mouse and touch event listeners
     * @private
     */
    private setupEventListeners(): void {
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
    }

    /**
     * Handles mouse down events
     * @param {MouseEvent} e - Mouse event
     * @private
     */
    private onMouseDown(e: MouseEvent): void {
        this.isDragging = true;
        this.dragStart = { x: e.clientX, y: e.clientY };
    }

    /**
     * Handles mouse move events during dragging
     * @param {MouseEvent} e - Mouse event
     * @private
     */
    private onMouseMove(e: MouseEvent): void {
        if (!this.isDragging) return;
        
        const deltaX = e.clientX - this.dragStart.x;
        const deltaY = e.clientY - this.dragStart.y;
        
        this.cropPosition.x += deltaX;
        this.cropPosition.y += deltaY;
        
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.render();
    }

    /**
     * Handles mouse up events
     * @private
     */
    private onMouseUp(): void {
        this.isDragging = false;
    }

    /**
     * Handles touch start events
     * @param {TouchEvent} e - Touch event
     * @private
     */
    private onTouchStart(e: TouchEvent): void {
        e.preventDefault();
        const touch = e.touches[0];
        this.isDragging = true;
        this.dragStart = { x: touch.clientX, y: touch.clientY };
    }

    /**
     * Handles touch move events during dragging
     * @param {TouchEvent} e - Touch event
     * @private
     */
    private onTouchMove(e: TouchEvent): void {
        e.preventDefault();
        if (!this.isDragging) return;
        
        const touch = e.touches[0];
        const deltaX = touch.clientX - this.dragStart.x;
        const deltaY = touch.clientY - this.dragStart.y;
        
        this.cropPosition.x += deltaX;
        this.cropPosition.y += deltaY;
        
        this.dragStart = { x: touch.clientX, y: touch.clientY };
        this.render();
    }

    /**
     * Handles touch end events
     * @private
     */
    private onTouchEnd(): void {
        this.isDragging = false;
    }

    /**
     * Loads an image file for cropping
     * @param {File} file - Image file to load
     * @returns {Promise<void>} Promise that resolves when image is loaded
     */
    loadImage(file: File): Promise<void> {
        return new Promise((resolve) => {
            this.image = new Image();
            this.image.onload = () => {
                this.render();
                resolve();
            };
            this.image.src = URL.createObjectURL(file);
        });
    }

    /**
     * Renders the image with circular crop overlay
     * @private
     */
    private render(): void {
        if (!this.image) return;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Calculate crop area
        const scale = Math.max(this.cropSize / this.image.width, this.cropSize / this.image.height);
        const scaledWidth = this.image.width * scale;
        const scaledHeight = this.image.height * scale;

        // Draw image
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.drawImage(
            this.image,
            this.cropPosition.x,
            this.cropPosition.y,
            scaledWidth,
            scaledHeight
        );
        this.ctx.restore();

        // Draw crop overlay
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'destination-in';
        this.ctx.beginPath();
        this.ctx.arc(this.cropSize / 2, this.cropSize / 2, this.cropSize / 2, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.restore();
    }

    /**
     * Gets the cropped image as a data URL
     * @returns {string} Data URL of the cropped image
     */
    getCroppedImage(): string {
        return this.canvas.toDataURL('image/jpeg', 0.8);
    }

    /**
     * Destroys the cropper and removes the canvas from DOM
     */
    destroy(): void {
        this.canvas.remove();
    }
}
