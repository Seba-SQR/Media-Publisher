const { app, BrowserWindow, Tray, Menu, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');

function getConfigPath() {
    if (app.isPackaged) {
        return path.join(path.dirname(process.execPath), 'config.json');
    } else {
        return path.join(__dirname, 'config.json');
    }
}

ipcMain.handle('get-config', async () => {
    try {
        const configPath = getConfigPath();
        const rawData = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(rawData);
    } catch (error) {
        console.error("Failed to read config.json:", error);
        throw error
    }
});

let mainWindow;
let tray = null;

app.whenReady().then(() => {

    mainWindow = new BrowserWindow({
        width: 500,
        height: 450,
        icon: path.join(__dirname, 'assets', 'icons', 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true
        }
    });

    mainWindow.loadFile('index.html');

    // Debug
    //mainWindow.webContents.openDevTools();

    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
        return false;
    });

    ipcMain.handle('get-sources', async () => {
        const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
        return sources.map(source => ({
            id: source.id,
            name: source.name
        }));
    });

    tray = new Tray(path.join(__dirname, 'assets', 'icons', 'icon.png'));
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show Window', click: () => mainWindow.show() },
        { type: 'separator' },
        { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
    ]);
    tray.setContextMenu(contextMenu);
    tray.on('click', () => mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show());

});