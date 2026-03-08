const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const isDev = !app.isPackaged;

let mainWindow;
let ollamaProcess;

function startOllama() {
    console.log('🤖 Electron: Starting Ollama lifecycle management...');

    // Check if ollama is already running
    exec('tasklist /FI "IMAGENAME eq ollama.exe"', (err, stdout) => {
        if (stdout.includes('ollama.exe')) {
            console.log('✅ Electron: Ollama is already running.');
            return;
        }

        console.log('🚀 Electron: Launching Ollama serve...');
        // We set OLLAMA_ORIGINS="*" to bypass CORS manually for the app
        ollamaProcess = spawn('ollama', ['serve'], {
            env: { ...process.env, OLLAMA_ORIGINS: "*" },
            shell: true
        });

        ollamaProcess.stdout.on('data', (data) => console.log(`Ollama: ${data}`));
        ollamaProcess.stderr.on('data', (data) => console.error(`Ollama Error: ${data}`));
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        title: "Dukan Sathi Desktop",
        icon: path.join(__dirname, '../frontend/public/pwa-512x512.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        backgroundColor: '#020617', // Match slate-950
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    startOllama();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Clean up Ollama on exit if we started it
app.on('will-quit', () => {
    if (ollamaProcess) {
        console.log('🛑 Electron: Shutting down Ollama...');
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', ollamaProcess.pid, '/f', '/t']);
        } else {
            ollamaProcess.kill();
        }
    }
});
