class AudioClipper {
    constructor() {
        this.audioFile = null;
        this.audioBuffer = null;
        this.audioContext = null;
        this.canvas = document.getElementById('waveform');
        this.ctx = this.canvas.getContext('2d');
        this.player = document.getElementById('audioPlayer');
        this.startTime = 0;
        this.endTime = 5;
        this.duration = 0;
        this.isDragging = false;
        this.dragTarget = null;
        this.isPreviewPlaying = false;
        this.previewStartTime = null;
        
        this.initializeEventListeners();
        this.checkBackgroundVideo();
    }

    initializeEventListeners() {
        document.getElementById('audioFile').addEventListener('change', this.handleFileUpload.bind(this));
        document.getElementById('startTime').addEventListener('input', this.handleTimeChange.bind(this));
        document.getElementById('endTime').addEventListener('input', this.handleTimeChange.bind(this));
        document.getElementById('previewClip').addEventListener('click', this.previewClip.bind(this));
        document.getElementById('downloadClip').addEventListener('click', this.downloadClip.bind(this));
        
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.audioFile = file;
        const url = URL.createObjectURL(file);
        this.player.src = url;
        
        const progressBar = document.getElementById('uploadProgress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        progressBar.style.display = 'block';
        progressFill.style.width = '10%';
        progressText.textContent = 'Loading audio file...';
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            progressFill.style.width = '30%';
            progressText.textContent = 'Reading audio data...';
            
            const arrayBuffer = await file.arrayBuffer();
            progressFill.style.width = '60%';
            progressText.textContent = 'Decoding audio...';
            
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            progressFill.style.width = '80%';
            progressText.textContent = 'Generating waveform...';
            
            this.duration = this.audioBuffer.duration;
            
            this.endTime = Math.min(5, this.duration);
            document.getElementById('endTime').value = this.endTime;
            document.getElementById('endTime').max = this.duration;
            document.getElementById('startTime').max = this.duration - 5;
            
            this.drawWaveform();
            this.updateClipDuration();
            
            progressFill.style.width = '100%';
            progressText.textContent = 'Complete!';
            
            setTimeout(() => {
                progressBar.style.display = 'none';
                document.getElementById('playerSection').style.display = 'block';
            }, 500);
            
        } catch (error) {
            console.error('Error processing audio file:', error);
            progressBar.style.display = 'none';
            alert('Error processing audio file. Please try a different file.');
        }
    }

    drawWaveform() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const data = this.audioBuffer.getChannelData(0);
        const step = Math.ceil(data.length / width);
        const amp = height / 2;

        this.ctx.fillStyle = '#2a2a2a';
        this.ctx.fillRect(0, 0, width, height);

        this.ctx.beginPath();
        this.ctx.moveTo(0, amp);
        this.ctx.strokeStyle = '#d0d0d0';
        this.ctx.lineWidth = 1;

        for (let i = 0; i < width; i++) {
            let min = 1.0;
            let max = -1.0;
            
            for (let j = 0; j < step; j++) {
                const datum = data[(i * step) + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            
            this.ctx.moveTo(i, (1 + min) * amp);
            this.ctx.lineTo(i, (1 + max) * amp);
        }
        
        this.ctx.stroke();
        this.drawClipSelection();
        this.drawMarkers();
    }

    drawClipSelection() {
        const width = this.canvas.width;
        const startX = (this.startTime / this.duration) * width;
        const endX = (this.endTime / this.duration) * width;
        
        this.ctx.fillStyle = 'rgba(40, 167, 69, 0.2)';
        this.ctx.fillRect(startX, 0, endX - startX, this.canvas.height);
    }

    drawMarkers() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const startX = (this.startTime / this.duration) * width;
        const endX = (this.endTime / this.duration) * width;
        
        // Start marker (green)
        this.ctx.fillStyle = '#28a745';
        this.ctx.fillRect(startX - 2, 0, 4, height);
        
        // Start marker handle
        this.ctx.fillStyle = '#28a745';
        this.ctx.fillRect(startX - 8, 0, 16, 20);
        this.ctx.fillStyle = 'white';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('S', startX, 14);
        
        // End marker (red)
        this.ctx.fillStyle = '#dc3545';
        this.ctx.fillRect(endX - 2, 0, 4, height);
        
        // End marker handle
        this.ctx.fillStyle = '#dc3545';
        this.ctx.fillRect(endX - 8, 0, 16, 20);
        this.ctx.fillStyle = 'white';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('E', endX, 14);
    }

    drawProgressBar(currentTime) {
        if (!this.isPreviewPlaying) return;
        
        const width = this.canvas.width;
        const progressX = ((currentTime - this.startTime) / (this.endTime - this.startTime)) * 
                         ((this.endTime / this.duration) * width - (this.startTime / this.duration) * width) +
                         (this.startTime / this.duration) * width;
        
        this.ctx.strokeStyle = '#007bff';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(progressX, 0);
        this.ctx.lineTo(progressX, this.canvas.height);
        this.ctx.stroke();
    }

    handleMouseDown(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const width = this.canvas.width;
        
        const startX = (this.startTime / this.duration) * width;
        const endX = (this.endTime / this.duration) * width;
        
        if (Math.abs(x - startX) < 15) {
            this.isDragging = true;
            this.dragTarget = 'start';
            this.canvas.style.cursor = 'grabbing';
        } else if (Math.abs(x - endX) < 15) {
            this.isDragging = true;
            this.dragTarget = 'end';
            this.canvas.style.cursor = 'grabbing';
        }
    }

    handleMouseMove(event) {
        if (!this.audioBuffer) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const width = this.canvas.width;
        
        if (this.isDragging) {
            const newTime = (x / width) * this.duration;
            
            if (this.dragTarget === 'start') {
                this.startTime = Math.max(0, Math.min(newTime, this.endTime - 5));
                document.getElementById('startTime').value = this.startTime.toFixed(1);
            } else if (this.dragTarget === 'end') {
                this.endTime = Math.min(this.duration, Math.max(newTime, this.startTime + 5));
                document.getElementById('endTime').value = this.endTime.toFixed(1);
            }
            
            this.updateClipDuration();
            this.drawWaveform();
        } else {
            const startX = (this.startTime / this.duration) * width;
            const endX = (this.endTime / this.duration) * width;
            
            if (Math.abs(x - startX) < 15 || Math.abs(x - endX) < 15) {
                this.canvas.style.cursor = 'grab';
            } else {
                this.canvas.style.cursor = 'default';
            }
        }
    }

    handleMouseUp() {
        this.isDragging = false;
        this.dragTarget = null;
        this.canvas.style.cursor = 'default';
    }

    handleTimeChange() {
        const startInput = document.getElementById('startTime');
        const endInput = document.getElementById('endTime');
        
        let startTime = parseFloat(startInput.value);
        let endTime = parseFloat(endInput.value);
        
        if (endTime - startTime < 5) {
            if (event.target.id === 'startTime') {
                endTime = Math.min(this.duration, startTime + 5);
                endInput.value = endTime.toFixed(1);
            } else {
                startTime = Math.max(0, endTime - 5);
                startInput.value = startTime.toFixed(1);
            }
        }
        
        this.startTime = startTime;
        this.endTime = endTime;
        this.updateClipDuration();
        
        if (this.audioBuffer) {
            this.drawWaveform();
        }
    }

    updateClipDuration() {
        const duration = this.endTime - this.startTime;
        document.getElementById('clipDuration').textContent = `Duration: ${duration.toFixed(1)}s`;
    }

    previewClip() {
        if (!this.audioBuffer) return;
        
        this.isPreviewPlaying = true;
        this.previewStartTime = Date.now();
        this.player.currentTime = this.startTime;
        this.player.play();
        
        const animateProgress = () => {
            if (!this.isPreviewPlaying) return;
            
            const elapsed = (Date.now() - this.previewStartTime) / 1000;
            const currentTime = this.startTime + elapsed;
            
            if (currentTime >= this.endTime) {
                this.player.pause();
                this.isPreviewPlaying = false;
                this.drawWaveform();
                return;
            }
            
            this.drawWaveform();
            this.drawProgressBar(currentTime);
            requestAnimationFrame(animateProgress);
        };
        
        requestAnimationFrame(animateProgress);
        
        setTimeout(() => {
            this.player.pause();
            this.isPreviewPlaying = false;
            this.drawWaveform();
        }, (this.endTime - this.startTime) * 1000);
    }

    async downloadClip() {
        if (!this.audioBuffer) return;
        
        try {
            const sampleRate = this.audioBuffer.sampleRate;
            const startSample = Math.floor(this.startTime * sampleRate);
            const endSample = Math.floor(this.endTime * sampleRate);
            const clipLength = endSample - startSample;
            
            const offlineContext = new OfflineAudioContext(
                this.audioBuffer.numberOfChannels,
                clipLength,
                sampleRate
            );
            
            const source = offlineContext.createBufferSource();
            source.buffer = this.audioBuffer;
            source.connect(offlineContext.destination);
            source.start(0, this.startTime, this.endTime - this.startTime);
            
            const renderedBuffer = await offlineContext.startRendering();
            const audioBlob = this.bufferToWave(renderedBuffer);
            
            const url = URL.createObjectURL(audioBlob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `clip_${this.startTime.toFixed(1)}s-${this.endTime.toFixed(1)}s.wav`;
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            
        } catch (error) {
            console.error('Error creating clip:', error);
            alert('Error creating clip. Please try again.');
        }
    }

    bufferToWave(buffer) {
        const length = buffer.length;
        const numberOfChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
        const view = new DataView(arrayBuffer);
        
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + length * numberOfChannels * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numberOfChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numberOfChannels * 2, true);
        view.setUint16(32, numberOfChannels * 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, length * numberOfChannels * 2, true);
        
        let offset = 44;
        for (let i = 0; i < length; i++) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
                view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
                offset += 2;
            }
        }
        
        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }

    checkBackgroundVideo() {
        const video = document.getElementById('backgroundVideo');
        if (video) {
            video.addEventListener('canplaythrough', () => {
                video.style.display = 'block';
            });
            
            video.addEventListener('error', () => {
                console.log('Background video not found - using gradient background');
                video.style.display = 'none';
            });
        }
    }
}

const clipper = new AudioClipper();