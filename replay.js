export class Replay {
    constructor() {
        this.frames = [];
        this.isPlaying = false;
        this.playbackFrameIndex = 0;
        this.endPauseCounter = 0;
        this.endPauseDurationSeconds = 3;
        this.playbackTime = 0;
    }

    recordFrame(player, platforms, cameraY, deltaTime) {
        if (this.isPlaying) return;

        const frameData = {
            player: { 
                x: player.x, 
                y: player.y, 
                width: player.width, 
                height: player.height,
                scale: player.scale,
            },
            platforms: platforms.map(p => ({ x: p.x, y: p.y, width: p.width, height: p.height })),
            cameraY: cameraY,
            dt: deltaTime
        };

        this.frames.push(frameData);
    }

    startPlayback() {
        if (this.frames.length === 0) return;
        this.isPlaying = true;
        this.playbackFrameIndex = 0;
        this.endPauseCounter = 0;
        this.playbackTime = 0;
    }

    stopPlayback() {
        this.isPlaying = false;
        this.frames = [];
    }

    getPlaybackFrame(deltaTime) {
        if (!this.isPlaying || this.frames.length === 0) return null;

        this.playbackTime += deltaTime;
        
        const totalDuration = this.frames.reduce((total, frame) => total + frame.dt, 0);

        if (totalDuration > 0 && this.playbackTime >= totalDuration) {
            this.playbackTime %= totalDuration;
        }
        
        let cumulativeTime = 0;
        let frameToDisplayIndex = 0; // Default to first frame

        for (let i = 0; i < this.frames.length; i++) {
            cumulativeTime += this.frames[i].dt;
            if (this.playbackTime < cumulativeTime) {
                frameToDisplayIndex = i;
                break;
            }
             // Handle case where playbackTime is exactly totalDuration or slightly off due to float precision
            if (i === this.frames.length - 1) {
                frameToDisplayIndex = i;
            }
        }
        
        return this.frames[frameToDisplayIndex];
    }
}