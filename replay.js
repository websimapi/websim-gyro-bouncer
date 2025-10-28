const REPLAY_BUFFER_SIZE = 300; // 5 seconds at 60fps

export class Replay {
    constructor() {
        this.frames = [];
        this.isPlaying = false;
        this.playbackFrameIndex = 0;
    }

    recordFrame(player, platforms, cameraY) {
        if (this.isPlaying) return;

        const frameData = {
            player: { x: player.x, y: player.y },
            platforms: platforms.map(p => ({ x: p.x, y: p.y, width: p.width, height: p.height })),
            cameraY: cameraY
        };

        this.frames.push(frameData);

        if (this.frames.length > REPLAY_BUFFER_SIZE) {
            this.frames.shift();
        }
    }

    startPlayback() {
        if (this.frames.length === 0) return;
        this.isPlaying = true;
        this.playbackFrameIndex = 0;
    }

    stopPlayback() {
        this.isPlaying = false;
        this.frames = [];
    }

    getPlaybackFrame() {
        if (!this.isPlaying || this.frames.length === 0) return null;

        const frame = this.frames[this.playbackFrameIndex];
        this.playbackFrameIndex++;

        if (this.playbackFrameIndex >= this.frames.length) {
            this.playbackFrameIndex = 0; // Loop the replay
        }

        return frame;
    }
}