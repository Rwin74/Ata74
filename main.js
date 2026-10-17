const { app, BrowserWindow, ipcMain, Tray, Menu, Notification, nativeImage, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { setupUpdates } = require('./updater');
let updateService;
const child_process = require('child_process');

// --- UAC / Admin Check ---
if (process.platform === 'win32') {
    try {
        child_process.execSync('net session', { stdio: 'ignore' });
    } catch (e) {
        // Not admin, relaunch as admin
        const exePath = process.execPath;
        try {
            // Start-Process with Verb RunAs triggers the UAC prompt
            child_process.execSync(`powershell.exe -Command "Start-Process -FilePath '${exePath}' -Verb RunAs"`, { stdio: 'ignore' });
        } catch (err) {
            console.error("UAC iptal edildi veya hata oluştu.");
        }
        app.quit();
        return;
    }
}


let mainWindow;
let dpiProcess = null;
let launcherBusy = false;
let timerResolutionProc = null;

function startLauncher(mode) {
    // Implementation details for launch
}
let isQuiting = false;

// Electron Window Creation
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1160,
        minWidth: 900,
        minHeight: 680,
        height: 800,
        frame: false,
        transparent: false,
        backgroundColor: '#f7f8fa',
        resizable: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile('index.html');
    
    mainWindow.on('close', function (event) {
        if (!isQuiting) {
            event.preventDefault();
            mainWindow.hide();
        }
        return false;
    });
}

app.whenReady().then(() => {
    createWindow();
    const { autoUpdater } = require('electron-updater');
    updateService = setupUpdates({
        app, ipcMain, updater: autoUpdater,
        configured: Boolean(require('./update-config.json').owner),
        send: state => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updates-event',state); },
        canInstall: () => !launcherBusy,
        beforeInstall: () => {
            isQuiting = true;
            stopDPI();
            if (timerResolutionProc) { timerResolutionProc.kill(); timerResolutionProc = null; }
        }
    });
    mainWindow.webContents.once('did-finish-load', () => updateService.check());

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    const iconBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsQAAA7EAZUrDhsAAAApSURBVDhPY3gro/iPgQhgAmKCw0xQDAyD1gChbDSMFgOhAoaBofYBAwAAB2AHA7fV9jAAAAAASUVORK5CYII=';
    const iconImage = nativeImage.createFromDataURL('data:image/png;base64,' + iconBase64);
    
    tray = new Tray(iconImage);
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Göster', click: function () { mainWindow.show(); } },
        { label: 'Çıkış', click: function () { 
            isQuiting = true; 
            app.quit(); 
        } }
    ]);
    tray.setToolTip('Universal Network Bypass');
    tray.setContextMenu(contextMenu);
    
    tray.on('click', () => {
        mainWindow.show();
    });

    app.setAppUserModelId("Ata74.DPI.Bypass");
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Sistemdeki tüm GoodbyeDPI süreçlerini ve mevcut süreci kapat
function stopDPI() {
    if (dpiProcess) { dpiProcess.kill(); dpiProcess = null; }
}

app.on('will-quit', () => {
    stopDPI();
});

// --- IPC Handlers ---

ipcMain.handle('get-username', () => {
    return os.userInfo().username;
});

ipcMain.handle('optimize-tcp', () => {
    try {
        const script = `
        Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" -Name "NetworkThrottlingIndex" -Value 0xffffffff -Type DWord -Force
        $adapters = Get-Item -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces\\*"
        foreach ($adapter in $adapters) {
            Set-ItemProperty -Path $adapter.PSPath -Name "TcpAckFrequency" -Value 1 -Type DWord -Force
            Set-ItemProperty -Path $adapter.PSPath -Name "TCPNoDelay" -Value 1 -Type DWord -Force
        }
        `;
        child_process.execSync(`powershell.exe -Command "${script.replace(/\n/g, '; ')}"`, { windowsHide: true });
        return { success: true, message: 'Oyun Modu aktif! (Yeniden başlatma önerilir)' };
    } catch(e) { return { success: false, message: (e.stderr && e.stderr.toString().trim()) || 'İşlem desteklenmiyor veya yetki reddedildi.' }; }
});

ipcMain.handle('revert-tcp', () => {
    try {
        const script = `
        Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile" -Name "NetworkThrottlingIndex" -Value 10 -Type DWord -Force
        $adapters = Get-Item -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces\\*"
        foreach ($adapter in $adapters) {
            Remove-ItemProperty -Path $adapter.PSPath -Name "TcpAckFrequency" -ErrorAction SilentlyContinue
            Remove-ItemProperty -Path $adapter.PSPath -Name "TCPNoDelay" -ErrorAction SilentlyContinue
        }
        `;
        child_process.execSync(`powershell.exe -Command "${script.replace(/\n/g, '; ')}"`, { windowsHide: true });
        return { success: true, message: 'Ayarlar geri alındı!' };
    } catch(e) { return { success: false, message: (e.stderr && e.stderr.toString().trim()) || 'İşlem desteklenmiyor veya yetki reddedildi.' }; }
});

ipcMain.handle('optimize-dns', async () => {
    try {
        const dnsList = [
            { name: 'Cloudflare', ip: '1.1.1.1' },
            { name: 'Google', ip: '8.8.8.8' },
            { name: 'Quad9', ip: '9.9.9.9' },
            { name: 'OpenDNS', ip: '208.67.222.222' }
        ];
        let best = null;
        let lowest = 9999;
        
        for (let dns of dnsList) {
            try {
                const stdout = child_process.execSync(`ping ${dns.ip} -n 1 -w 1000`, { windowsHide: true }).toString();
                const match = stdout.match(/time=(\d+)ms/i) || stdout.match(/süre=(\d+)ms/i);
                if (match && match[1]) {
                    const ping = parseInt(match[1]);
                    if (ping < lowest) {
                        lowest = ping;
                        best = dns;
                    }
                }
            } catch(e) {}
        }

        if (!best) return { success: false, message: 'Ping ölçülemedi.' };

        const applyScript = `Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | Set-DnsClientServerAddress -ServerAddresses '${best.ip}'`;
        child_process.execSync(`powershell.exe -Command "${applyScript}"`, { windowsHide: true });
        child_process.execSync('ipconfig /flushdns', { stdio: 'ignore', windowsHide: true });

        return { success: true, message: `En hızlı DNS: ${best.name} (${lowest}ms) uygulandı!` };
    } catch(e) { return { success: false, message: (e.stderr && e.stderr.toString().trim()) || 'İşlem desteklenmiyor veya yetki reddedildi.' }; }
});

ipcMain.handle('revert-dns', () => {
    try {
        const applyScript = `Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | Set-DnsClientServerAddress -ResetServerAddresses`;
        child_process.execSync(`powershell.exe -Command "${applyScript}"`, { windowsHide: true });
        child_process.execSync('ipconfig /flushdns', { stdio: 'ignore', windowsHide: true });
        return { success: true, message: 'DNS varsayılana sıfırlandı (DHCP).' };
    } catch(e) { return { success: false, message: (e.stderr && e.stderr.toString().trim()) || 'İşlem desteklenmiyor veya yetki reddedildi.' }; }
});

ipcMain.handle('flush-network', () => {
    try {
        child_process.execSync('ipconfig /flushdns', { stdio: 'ignore', windowsHide: true });
        return { success: true, message: 'Ağ önbelleği (DNS) temizlendi!' };
    } catch(e) { return { success: false, message: (e.stderr && e.stderr.toString().trim()) || 'İşlem desteklenmiyor veya yetki reddedildi.' }; }
});

ipcMain.handle('optimize-fps', () => {
    try {
        const script = `
        powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c
        Stop-Service -Name "SysMain" -Force -ErrorAction SilentlyContinue
        Stop-Service -Name "DiagTrack" -Force -ErrorAction SilentlyContinue
        Stop-Service -Name "Spooler" -Force -ErrorAction SilentlyContinue
        Stop-Service -Name "DPS" -Force -ErrorAction SilentlyContinue
        Remove-Item -Path "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue
        `;
        child_process.execSync(`powershell.exe -Command "${script.replace(/\n/g, '; ')}"`, { windowsHide: true });
        return { success: true, message: 'FPS Modu aktif! (Servisler kapatıldı, Temp silindi)' };
    } catch(e) { return { success: false, message: (e.stderr && e.stderr.toString().trim()) || 'İşlem desteklenmiyor veya yetki reddedildi.' }; }
});

ipcMain.handle('revert-fps', () => {
    try {
        const script = `
        powercfg -setactive 381b4222-f694-41f0-9685-ff5bb260df2e
        Start-Service -Name "SysMain" -ErrorAction SilentlyContinue
        Start-Service -Name "DiagTrack" -ErrorAction SilentlyContinue
        Start-Service -Name "Spooler" -ErrorAction SilentlyContinue
        Start-Service -Name "DPS" -ErrorAction SilentlyContinue
        `;
        child_process.execSync(`powershell.exe -Command "${script.replace(/\n/g, '; ')}"`, { windowsHide: true });
        return { success: true, message: 'Servisler başlatıldı, Dengeli moda dönüldü.' };
    } catch(e) { return { success: false, message: (e.stderr && e.stderr.toString().trim()) || 'İşlem desteklenmiyor veya yetki reddedildi.' }; }
});

ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return { success: true, folder: result.filePaths[0] };
    }
    return { success: false };
});

ipcMain.handle('compress-folder', async (event, folderPath) => {
    return new Promise((resolve) => {
        const proc = child_process.spawn('compact.exe', ['/c', '/s', '/a', '/i', '/exe:lzx', '*'], { cwd: folderPath, shell: true, windowsHide: true });
        let fileCount = 0;
        proc.stdout.on('data', (data) => {
            const text = data.toString();
            const matches = (text.match(/\[OK\]/g) || []).length;
            if (matches > 0) {
                fileCount += matches;
                event.sender.send('compression-progress', { type: 'compress', count: fileCount });
            }
        });
        proc.on('close', (code) => {
            event.sender.send('compression-progress', { type: 'compress', count: 'done' });
            resolve({ success: code === 0, message: code === 0 ? `Sıkıştırma tamamlandı! ${fileCount} dosya işlendi.` : 'İşlem tamamlandı (hatalar olabilir).' });
        });
        proc.on('error', (error) => {
            resolve({ success: false, message: 'Sıkıştırma başlatılamadı: ' + error.message });
        });
    });
});

ipcMain.handle('uncompress-folder', async (event, folderPath) => {
    return new Promise((resolve) => {
        const proc = child_process.spawn('compact.exe', ['/u', '/s', '/a', '/i', '/exe', '*'], { cwd: folderPath, shell: true, windowsHide: true });
        let fileCount = 0;
        proc.stdout.on('data', (data) => {
            const text = data.toString();
            const matches = (text.match(/\[OK\]/g) || []).length;
            if (matches > 0) {
                fileCount += matches;
                event.sender.send('compression-progress', { type: 'uncompress', count: fileCount });
            }
        });
        proc.on('close', (code) => {
            event.sender.send('compression-progress', { type: 'uncompress', count: 'done' });
            resolve({ success: code === 0, message: code === 0 ? `Geri alma tamamlandı! ${fileCount} dosya normale döndü.` : 'İşlem tamamlandı (hatalar olabilir).' });
        });
        proc.on('error', (error) => {
            resolve({ success: false, message: 'İşlem başlatılamadı: ' + error.message });
        });
    });
});

ipcMain.handle('set-shutdown', (event, mins) => {
    try {
        const seconds = parseInt(mins) * 60;
        child_process.execSync(`shutdown -s -t ${seconds}`, { stdio: 'ignore', windowsHide: true });
        return { success: true, message: `Bilgisayar ${mins} dakika sonra kapanacak!` };
    } catch(e) { return { success: false, message: (e.stderr && e.stderr.toString().trim()) || 'İşlem desteklenmiyor veya yetki reddedildi.' }; }
});

ipcMain.handle('cancel-shutdown', () => {
    try {
        child_process.execSync(`shutdown -a`, { stdio: 'ignore', windowsHide: true });
        return { success: true, message: 'Zamanlayıcı iptal edildi!' };
    } catch(e) { return { success: false, message: 'Zamanlayıcı bulunamadı.' }; }
});

ipcMain.handle('clean-desktop', () => {
    try {
        const desktopPath = path.join(os.homedir(), 'Desktop');
        const organizedPath = path.join(desktopPath, 'Toplanmış Masaüstü');
        
        if (!fs.existsSync(organizedPath)) {
            fs.mkdirSync(organizedPath);
        }
        
        const files = fs.readdirSync(desktopPath);
        let movedCount = 0;
        
        for (const file of files) {
            if (file === 'Toplanmış Masaüstü') continue;
            
            const filePath = path.join(desktopPath, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isFile() && !file.toLowerCase().endsWith('.lnk') && !file.toLowerCase().endsWith('.url') && !file.toLowerCase().endsWith('.ini')) {
                const ext = path.extname(file).toLowerCase().replace('.', '') || 'Diger';
                let category = 'Diger';
                
                if (['jpg','jpeg','png','gif','webp'].includes(ext)) category = 'Resimler';
                else if (['mp4','mkv','avi','mov'].includes(ext)) category = 'Videolar';
                else if (['doc','docx','pdf','txt','xls','xlsx'].includes(ext)) category = 'Belgeler';
                else if (['zip','rar','7z'].includes(ext)) category = 'Arsivler';
                
                const catPath = path.join(organizedPath, category);
                if (!fs.existsSync(catPath)) fs.mkdirSync(catPath);
                
                fs.renameSync(filePath, path.join(catPath, file));
                movedCount++;
            }
        }
        
        return { success: true, message: `${movedCount} dosya başarıyla Toplanmış Masaüstü klasörüne taşındı!` };
    } catch(e) { return { success: false, message: (e.stderr && e.stderr.toString().trim()) || 'İşlem desteklenmiyor veya yetki reddedildi.' }; }
});

ipcMain.handle('enable-timer-res', () => {
    if (timerResolutionProc) return { success: true, message: '0.5ms Modu zaten aktif!' };
    try {
        const code = `
        Add-Type -TypeDefinition @'
        using System.Runtime.InteropServices;
        public class TimerHack {
            [DllImport("ntdll.dll", EntryPoint="NtSetTimerResolution")]
            public static extern void NtSetTimerResolution(uint DesiredResolution, bool SetResolution, ref uint CurrentResolution);
            public static void Maximize() {
                uint currentRes = 0;
                NtSetTimerResolution(5000, true, ref currentRes);
            }
        }
        '@
        [TimerHack]::Maximize()
        while($true) { Start-Sleep -Seconds 3600 }
        `;
        timerResolutionProc = child_process.spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', code], { windowsHide: true });
        return { success: true, message: 'Zamanlayıcı 0.5ms (Maksimum) seviyesine kilitlendi!' };
    } catch(e) { return { success: false, message: (e.stderr && e.stderr.toString().trim()) || 'İşlem desteklenmiyor veya yetki reddedildi.' }; }
});

ipcMain.handle('disable-timer-res', () => {
    if (timerResolutionProc) {
        timerResolutionProc.kill();
        timerResolutionProc = null;
        return { success: true, message: 'Zamanlayıcı kiliti kaldırıldı (15.6ms Windows Varsayılanı).' };
    }
    return { success: true, message: 'Zaten aktif değildi.' };
});

ipcMain.handle('enable-msi', () => {
    try {
        const script = `
        $classes = @("Net", "Display")
        foreach($class in $classes) {
            $devs = Get-WmiObject Win32_PnPEntity | Where-Object {$_.PNPClass -eq $class -and $_.PNPDeviceID -match "^PCI\\\\"}
            foreach($dev in $devs) {
                $regPath = "HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\$($dev.PNPDeviceID)\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties"
                if(Test-Path $regPath) {
                    Set-ItemProperty -Path $regPath -Name "MSISupported" -Value 1 -Type DWord -Force
                }
            }
        }
        `;
        child_process.execSync(`powershell.exe -Command "${script.replace(/\n/g, '; ')}"`, { windowsHide: true });
        return { success: true, message: 'MSI Modu Aktif! (Tam etki için PC yeniden başlatılmalı).' };
    } catch(e) { return { success: false, message: (e.stderr && e.stderr.toString().trim()) || 'İşlem desteklenmiyor veya yetki reddedildi.' }; }
});

ipcMain.handle('disable-msi', () => {
    try {
        const script = `
        $classes = @("Net", "Display")
        foreach($class in $classes) {
            $devs = Get-WmiObject Win32_PnPEntity | Where-Object {$_.PNPClass -eq $class -and $_.PNPDeviceID -match "^PCI\\\\"}
            foreach($dev in $devs) {
                $regPath = "HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\$($dev.PNPDeviceID)\\Device Parameters\\Interrupt Management\\MessageSignaledInterruptProperties"
                if(Test-Path $regPath) {
                    Set-ItemProperty -Path $regPath -Name "MSISupported" -Value 0 -Type DWord -Force
                }
            }
        }
        `;
        child_process.execSync(`powershell.exe -Command "${script.replace(/\n/g, '; ')}"`, { windowsHide: true });
        return { success: true, message: 'MSI Modu kapatıldı (Windows Varsayılanı).' };
    } catch(e) { return { success: false, message: (e.stderr && e.stderr.toString().trim()) || 'İşlem desteklenmiyor veya yetki reddedildi.' }; }
});

ipcMain.handle('disable-interrupt', () => {
    try {
        const script = `Set-NetAdapterAdvancedProperty -Name "*" -DisplayName "Interrupt Moderation" -DisplayValue "Disabled" -ErrorAction SilentlyContinue`;
        child_process.execSync(`powershell.exe -Command "${script}"`, { windowsHide: true });
        return { success: true, message: 'Ağ paketi geciktirme kapatıldı! Ping anında düşecek.' };
    } catch(e) { return { success: false, message: (e.stderr && e.stderr.toString().trim()) || 'İşlem desteklenmiyor veya yetki reddedildi.' }; }
});

ipcMain.handle('enable-interrupt', () => {
    try {
        const script = `Set-NetAdapterAdvancedProperty -Name "*" -DisplayName "Interrupt Moderation" -DisplayValue "Enabled" -ErrorAction SilentlyContinue`;
        child_process.execSync(`powershell.exe -Command "${script}"`, { windowsHide: true });
        return { success: true, message: 'Ağ paketi geciktirme geri açıldı.' };
    } catch(e) { return { success: false, message: (e.stderr && e.stderr.toString().trim()) || 'İşlem desteklenmiyor veya yetki reddedildi.' }; }
});

ipcMain.handle('flush-ram', () => {
    try {
        const script = `
        Add-Type -TypeDefinition @'
        using System;
        using System.Runtime.InteropServices;
        public class RAM {
            [DllImport("ntdll.dll")]
            public static extern int NtSetSystemInformation(int Class, IntPtr Info, int Length);
            public static void Flush() {
                int cmd = 4;
                IntPtr ptr = Marshal.AllocHGlobal(4);
                Marshal.WriteInt32(ptr, cmd);
                NtSetSystemInformation(80, ptr, 4);
                Marshal.FreeHGlobal(ptr);
            }
        }
        '@
        [RAM]::Flush()
        `;
        child_process.execSync(`powershell.exe -Command "${script.replace(/\n/g, '; ')}"`, { windowsHide: true });
        return { success: true, message: 'Standby List (Ölü RAM) başarıyla temizlendi!' };
    } catch(e) { return { success: false, message: (e.stderr && e.stderr.toString().trim()) || 'İşlem desteklenmiyor veya yetki reddedildi.' }; }
});

ipcMain.handle('nuke-telemetry', () => {
    try {
        const script = `
        Stop-Service -Name "DiagTrack" -Force -ErrorAction SilentlyContinue
        Set-Service -Name "DiagTrack" -StartupType Disabled -ErrorAction SilentlyContinue
        Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" -Name "AllowTelemetry" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
        `;
        child_process.execSync(`powershell.exe -Command "${script.replace(/\n/g, '; ')}"`, { windowsHide: true });
        return { success: true, message: 'Windows Telemetry (Ajan Servisler) yok edildi!' };
    } catch(e) { return { success: false, message: (e.stderr && e.stderr.toString().trim()) || 'İşlem desteklenmiyor veya yetki reddedildi.' }; }
});

ipcMain.handle('restore-telemetry', () => {
    try {
        const script = `
        Set-Service -Name "DiagTrack" -StartupType Automatic -ErrorAction SilentlyContinue
        Start-Service -Name "DiagTrack" -ErrorAction SilentlyContinue
        Remove-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" -Name "AllowTelemetry" -ErrorAction SilentlyContinue
        `;
        child_process.execSync(`powershell.exe -Command "${script.replace(/\n/g, '; ')}"`, { windowsHide: true });
        return { success: true, message: 'Windows Telemetry servisleri geri getirildi.' };
    } catch(e) { return { success: false, message: (e.stderr && e.stderr.toString().trim()) || 'İşlem desteklenmiyor veya yetki reddedildi.' }; }
});

ipcMain.handle('get-ping', async () => {
    return new Promise((resolve) => {
        child_process.exec('ping discord.com -n 1 -w 1000', { windowsHide: true }, (error, stdout, stderr) => {
            if (error) {
                resolve(-1);
                return;
            }
            const match = stdout.match(/time=(\d+)ms/i) || stdout.match(/süre=(\d+)ms/i);
            if (match && match[1]) {
                resolve(parseInt(match[1]));
            } else {
                resolve(-1);
            }
        });
    });
});

ipcMain.on('close-app', () => {
    if (mainWindow) mainWindow.hide();
});


const https = require('https');
const { profiles } = require('./profiles');
function checkDiscord(url) {
    return new Promise(resolve => {
        let settled = false;
        const finish = value => { if (!settled) { settled = true; clearTimeout(deadline); resolve(value); } };
        const req = https.get(url, {agent:false}, res => {
            res.resume();
            finish(res.statusCode >= 200 && res.statusCode < 300);
        });
        const deadline = setTimeout(() => { req.destroy(); finish(false); }, 6000);
        req.on('error', () => finish(false));
    });
}
ipcMain.handle('stop-launcher', () => {
    stopDPI();
    return {success:true};
});
ipcMain.handle('start-launcher', async (event, mode) => {
    if (launcherBusy) return {success:false, error:'Bir deneme zaten çalışıyor.'};
    if (!Object.hasOwn(profiles, mode)) return {success:false, error:'Geçersiz ağ profili.'};
    launcherBusy = true;
    const corePath = app.isPackaged ? path.join(process.resourcesPath, 'core') : path.join(__dirname,'core');
    const dpiPath = path.join(corePath,'goodbyedpi.exe');
    const logPath = path.join(app.getPath('userData'),'yurt-diagnostic.log');
    const log = text => fs.appendFileSync(logPath, new Date().toISOString() + ' ' + text + '\n');
    try {
        if (!fs.existsSync(dpiPath)) throw new Error('core/goodbyedpi.exe bulunamadı.');
        // Do not terminate other VPNs, update processes or driver services.
        stopDPI();
        const conflicts = await new Promise(resolve => {
            child_process.execFile('tasklist.exe', ['/FI','IMAGENAME eq goodbyedpi.exe','/FO','CSV','/NH'], {windowsHide:true}, (err,out) => resolve(!err && /goodbyedpi.exe/i.test(out)));
        });
        if (conflicts) throw new Error('Başka GoodbyeDPI çalışıyor. Önce onu kapatın veya kendi hizmet kaldırma aracını kullanın.');
        for (const profile of profiles[mode]) {
            stopDPI();
            event.sender.send('launcher-progress', profile.name + ': deneniyor...');
            log(profile.name + ' ' + JSON.stringify(profile.args));
            const proc = child_process.spawn(dpiPath,profile.args,{windowsHide:true,cwd:corePath});
            dpiProcess = proc;
            let launchError = null;
            proc.on('error', err => { launchError = err; });
            proc.stdout.on('data', data => log(data.toString().slice(0,4000)));
            proc.stderr.on('data', data => log(data.toString().slice(0,4000)));
            await new Promise(resolve => setTimeout(resolve,1000));
            if (launchError || proc.exitCode !== null) {
                log('Başlatma başarısız');
                continue;
            }
            if (mode !== 'yurt_auto') {
                return {success:true, message:'Profil çalışıyor. Discord erişimi doğrulanmadı.'};
            }
            const results = await Promise.all([
                checkDiscord('https://discord.com/api/v10/gateway'),
                checkDiscord('https://discord.com/app'),
                checkDiscord('https://updates.discord.com/')
            ]);
            log('HTTPS sonuçları: ' + JSON.stringify(results));
            if (results[0] && results[1] && proc.exitCode === null && !launchError) {
                return {success:true, message:profile.name + ': Discord HTTPS erişimi doğrulandı. Discord’u açın; ses bağlantısını ayrıca deneyin.'};
            }
        }
        stopDPI();
        throw new Error('Hiçbir yöntem doğrulanamadı. Yurt giriş sayfasını tamamlayın. IP/UDP engeli için gerçek VPN veya ağ yönetimi gerekir. Kayıt: ' + logPath);
    } catch (error) {
        stopDPI();
        return {success:false,error:error.message};
    } finally { launcherBusy = false; }
});

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => { if (mainWindow?.isMaximized()) mainWindow.unmaximize(); else mainWindow?.maximize(); });
