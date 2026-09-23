let config = {};

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');
const screenSelect = document.getElementById('screenSelect');

let localStream = null;
let publisher = null;

function loadRemotePublisherScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load publisher.js from ${url}`));
        document.head.appendChild(script);
    });
}

async function init() {
    try {
        config = await window.electronAPI.getConfig();

        const publisherUrl = `http://${config.mediaMtxServer}:${config.mediaMtxPort}/${config.mediaMtxPath}/publisher.js`;
        
        statusDiv.innerText = "Downloading MediaMTX WebRTC client...";
        await loadRemotePublisherScript(publisherUrl);

        statusDiv.innerText = "Status: Ready to publish.";
        startBtn.innerText = "Start Publishing";
        startBtn.disabled = false;

        await loadSources();
    } catch (err) {
        console.error("Initialization error:", err);
        statusDiv.innerText = `Error connecting to MediaMTX: ${err.message}`;
    }
}

async function loadSources() {
    const sources = await window.electronAPI.getSources();
    screenSelect.innerHTML = '';
    sources.forEach(source => {
        const option = document.createElement('option');
        option.value = source.id;
        option.text = source.name;
        screenSelect.appendChild(option);
    });
}

function stopPublishing(customStatus = "Publishing stopped.") {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (publisher) {
        try { publisher.close(); } catch (e) {}
        publisher = null;
    }
    statusDiv.innerText = customStatus;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    screenSelect.disabled = false;
}

startBtn.onclick = async () => {
    try {
        const selectedSourceId = screenSelect.value;
        if (!selectedSourceId) return;

        localStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: selectedSourceId,
                    maxFrameRate: 30
                }
            }
        });

        statusDiv.innerText = "Connecting to MediaMTX...";
        startBtn.disabled = true;
        stopBtn.disabled = false;
        screenSelect.disabled = true;

        localStream.getVideoTracks()[0].onended = () => stopPublishing();

        const whipUrl = `http://${config.mediaMtxServer}:${config.mediaMtxPort}/${config.mediaMtxPath}/whip`;

        publisher = new MediaMTXWebRTCPublisher({
            url: new URL(whipUrl),
            user: config.user,
            pass: config.pass,
            stream: localStream,
            videoCodec: 'h264',
            videoBitrate: 0,
            onConnected: () => {
                statusDiv.innerText = "Publishing to MediaMTX.";
            },
            onError: (err) => {
                console.error("MediaMTX error:", err);
                stopPublishing(`Error connecting to MediaMTX: ${err}`);
            }
        });

    } catch (err) {
        console.error("Capture error:", err);
        stopPublishing(`Error capturing screen: ${err.message}`);
    }
};

stopBtn.onclick = stopPublishing;

init();