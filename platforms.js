import Matter from 'https://esm.sh/matter-js';

class Platform {
    constructor(x, y, width, image, world, options) {
        this.width = width;
        if (image && image.naturalWidth > 0) {
            this.height = width * (image.naturalHeight / image.naturalWidth);
        } else {
            this.height = 20; // Fallback height
        }
        this.image = image;
        
        this.body = Matter.Bodies.rectangle(x + width / 2, y + this.height / 2, this.width, this.height, {
            isStatic: true,
            restitution: options.restitution,
            friction: 0,
            label: 'platform'
        });
        Matter.World.add(world, this.body);
    }

    draw(ctx) {
        const pos = this.body.position;
        ctx.drawImage(this.image, pos.x - this.width / 2, pos.y - this.height / 2, this.width, this.height);
    }

    destroy(world) {
        Matter.World.remove(world, this.body);
    }
}

export class PlatformManager {
    constructor(canvasWidth, canvasHeight, image, world, options) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.platformImg = image;
        this.world = world;
        this.options = options;
        this.platforms = [];
        this.platformWidth = 100;
        this.minGap = 80;
        this.maxGap = 150;
        this.nextPlatformY = canvasHeight - 50;
    }

    generateInitialPlatforms() {
        // Clear existing platforms from world
        this.platforms.forEach(p => p.destroy(this.world));
        this.platforms = [];

        // Starting platform is now the ground, so generate the first one higher up
        this.nextPlatformY = this.canvasHeight - 200;
        this.addPlatform(this.canvasWidth / 2 - this.platformWidth / 2, this.nextPlatformY);


        for (let i = 0; i < 20; i++) {
            this.generatePlatform();
        }
    }

    addPlatform(x, y) {
        const newPlatform = new Platform(x, y, this.platformWidth, this.platformImg, this.world, this.options);
        this.platforms.push(newPlatform);
        return newPlatform;
    }

    generatePlatform() {
        const y = this.nextPlatformY - (this.minGap + Math.random() * (this.maxGap - this.minGap));
        const x = Math.random() * (this.canvasWidth - this.platformWidth);
        this.addPlatform(x, y);
        this.nextPlatformY = y;
    }

    update(cameraY, playerY) {
        // Generate new platforms as camera moves up
        if (this.nextPlatformY > cameraY - this.canvasHeight) {
            this.generatePlatform();
        }

        // Remove platforms that are off-screen below
        const platformsToRemove = this.platforms.filter(p => p.body.position.y > cameraY + this.canvasHeight + 100);
        platformsToRemove.forEach(p => p.destroy(this.world));
        this.platforms = this.platforms.filter(p => p.body.position.y <= cameraY + this.canvasHeight + 100);
    }

    draw(ctx) {
        for (const platform of this.platforms) {
            platform.draw(ctx);
        }
    }
}