const GRAVITY = 1200; // pixels/second^2
const BOUNCE_VELOCITY = -600; // pixels/second
const HORIZONTAL_SPEED = 12; // multiplier for tilt
const MAX_HORIZONTAL_SPEED = 400; // pixels/second

export class Player {
    constructor(x, y, image) {
        this.width = 50;
        this.height = 50;
        this.x = x - this.width / 2;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.image = image;
        this.scale = 1;
        this.bounceAnimTime = 0;
        this.bounceAnimDuration = 0.3; // Animation duration in seconds
    }

    update(tilt, platforms, canvasWidth, deltaTime) {
        let bounced = false;
        // Horizontal movement
        this.vx = tilt * HORIZONTAL_SPEED;
        this.vx = Math.max(-MAX_HORIZONTAL_SPEED, Math.min(MAX_HORIZONTAL_SPEED, this.vx));
        this.x += this.vx * deltaTime;

        // Apply gravity
        this.vy += GRAVITY * deltaTime;
        this.y += this.vy * deltaTime;

        // Wall collision
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvasWidth) this.x = canvasWidth - this.width;

        // Animate bounce effect
        if (this.bounceAnimTime > 0) {
            this.bounceAnimTime -= deltaTime;
            const progress = 1 - (this.bounceAnimTime / this.bounceAnimDuration); // Goes from 0 to 1
            // Use a sine wave for a smooth pulse (1 -> 1.2 -> 1)
            this.scale = 1 + 0.2 * Math.sin(progress * Math.PI);
        } else {
            this.scale = 1;
        }

        // Platform collision (only when falling)
        if (this.vy > 0) {
            for (const platform of platforms) {
                if (
                    this.x < platform.x + platform.width &&
                    this.x + this.width > platform.x &&
                    this.y + this.height > platform.y &&
                    this.y + this.height < platform.y + platform.height
                ) {
                    this.vy = BOUNCE_VELOCITY;
                    this.bounceAnimTime = this.bounceAnimDuration; // Trigger bounce animation
                    bounced = true;
                    break;
                }
            }
        }
        return bounced;
    }

    draw(ctx) {
        if (this.image && this.image.complete) {
            ctx.save();

            const scaledWidth = this.width * this.scale;
            const scaledHeight = this.height * this.scale;
            const centerX = this.x + this.width / 2;
            const centerY = this.y + this.height / 2;

            // Create circular clipping path centered on the player
            ctx.beginPath();
            ctx.arc(centerX, centerY, this.width / 2, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();

            // Draw the image, centered and scaled from its center
            ctx.drawImage(
                this.image,
                centerX - scaledWidth / 2,
                centerY - scaledHeight / 2,
                scaledWidth,
                scaledHeight
            );

            ctx.restore();
        }
        // Do not draw anything if the image is not available.
    }
}