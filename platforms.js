class Platform {
    constructor(x, y, width, image) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = 20;
        this.image = image;
    }

    draw(ctx) {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
    }
}

export class PlatformManager {
    constructor(canvasWidth, canvasHeight, image) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.platformImg = image;
        this.platforms = [];
        this.platformWidth = 80;
        this.minGap = 50;
        this.maxGap = 120;
        this.nextPlatformY = canvasHeight - 50;
    }

    generateInitialPlatforms() {
        // Starting platform
        this.platforms.push(new Platform(this.canvasWidth / 2 - this.platformWidth / 2, this.canvasHeight - 50, this.platformWidth, this.platformImg));
        this.nextPlatformY = this.canvasHeight - 50;

        for (let i = 0; i < 20; i++) {
            this.generatePlatform();
        }
    }

    generatePlatform() {
        const y = this.nextPlatformY - (this.minGap + Math.random() * (this.maxGap - this.minGap));
        const x = Math.random() * (this.canvasWidth - this.platformWidth);
        this.platforms.push(new Platform(x, y, this.platformWidth, this.platformImg));
        this.nextPlatformY = y;
    }

    update(cameraY) {
        // Generate new platforms as camera moves up
        if (this.nextPlatformY > cameraY - this.canvasHeight) {
            this.generatePlatform();
        }

        // Remove platforms that are off-screen below
        this.platforms = this.platforms.filter(p => p.y < cameraY + this.canvasHeight + 100);
    }

    draw(ctx) {
        for (const platform of this.platforms) {
            platform.draw(ctx);
        }
    }
}