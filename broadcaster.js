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
        script.onerror = () => reject(new Error(`No se pudo cargar publisher.js desde ${url}`));
        document.head.appendChild(script);
    });
}

async function init() {
    try {
        config = await window.electronAPI.getConfig();

        const publisherUrl = `http://${config.mediaMtxServer}:${config.mediaMtxPort}/${config.mediaMtxPath}/publisher.js`;
        
        statusDiv.innerText = "Descargando cliente WebRTC de MediaMTX...";
        await loadRemotePublisherScript(publisherUrl);

        statusDiv.innerText = "Estado: Listo para transmitir.";
        startBtn.innerText = "Iniciar Transmisión";
        startBtn.disabled = false;

        await loadSources();
    } catch (err) {
        console.error("Error en la inicialización:", err);
        statusDiv.innerText = `Error al conectar con MediaMTX: ${err.message}`;
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

function stopTransmission(customStatus = "Transmisión detenida.") {
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

        statusDiv.innerText = "Conectando al servidor...";
        startBtn.disabled = true;
        stopBtn.disabled = false;
        screenSelect.disabled = true;

        localStream.getVideoTracks()[0].onended = () => stopTransmission();

        const whipUrl = `http://${config.mediaMtxServer}:${config.mediaMtxPort}/${config.mediaMtxPath}/whip`;

        publisher = new MediaMTXWebRTCPublisher({
            url: new URL(whipUrl),
            user: config.user,
            pass: config.pass,
            stream: localStream,
            videoCodec: 'h264',
            videoBitrate: 0,
            onConnected: () => {
                statusDiv.innerText = `Transmitiendo hacia "${config.videowallId || 'VideoWall'}"`;
            },
            onError: (err) => {
                console.error("Error detallado de MediaMTX:", err);
                stopTransmission(`Error al conectar con MediaMTX: ${err}`);
            }
        });

    } catch (err) {
        console.error("Error al iniciar captura:", err);
        stopTransmission(`Error al capturar pantalla: ${err.message}`);
    }
};

stopBtn.onclick = stopTransmission;

init();