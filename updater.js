'use strict';
// All download URLs and hashes are handled by electron-updater, never by the renderer.
function setupUpdates({ app, ipcMain, updater, send, beforeInstall, canInstall, configured }) {
    let state = { status: 'idle', version: app.getVersion(), message: 'Güncelleme kontrolü hazır.' };
    let busy = false;
    const publish = patch => { state = { ...state, ...patch }; send(state); };
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;
    updater.on('checking-for-update', () => publish({ status: 'checking', message: 'Güncelleme kontrol ediliyor...' }));
    updater.on('update-available', info => publish({ status: 'available', nextVersion: info.version, message: `Yeni sürüm ${info.version} hazır.` }));
    updater.on('update-not-available', () => publish({ status: 'current', message: 'En güncel sürüm kullanılıyor.' }));
    updater.on('download-progress', info => publish({ status: 'downloading', percent: Math.round(info.percent), message: `Güncelleme indiriliyor: %${Math.round(info.percent)}` }));
    updater.on('update-downloaded', info => publish({ status: 'downloaded', nextVersion: info.version, message: 'İndirildi. Kur ve yeniden başlat ile güncelleyin.' }));
    updater.on('error', error => {
        console.error('Update error:', error);
        publish({ status: 'error', message: 'Güncelleme alınamadı. İnternet bağlantısını ve GitHub sürüm yayınını kontrol edip tekrar deneyin.' });
    });
    async function check() {
        if (busy || ['downloading', 'downloaded'].includes(state.status)) return state;
        if (!configured || !app.isPackaged) {
            publish({ status: 'unconfigured', message: configured ? 'Güncelleme kontrolü kurulu uygulamada çalışır.' : 'GitHub güncelleme deposu henüz ayarlanmamış.' });
            return state;
        }
        busy = true;
        try { await updater.checkForUpdates(); }
        catch (error) { publish({ status: 'error', message: 'Güncelleme kontrol edilemedi. Tekrar deneyebilirsiniz.' }); }
        finally { busy = false; }
        return state;
    }
    ipcMain.handle('updates-state', () => state);
    ipcMain.handle('updates-check', check);
    ipcMain.handle('updates-download', async () => {
        if (busy || state.status !== 'available') return state;
        busy = true;
        publish({ status: 'downloading', percent: 0, message: 'İndirme başlıyor...' });
        try { await updater.downloadUpdate(); }
        catch (error) { publish({ status: 'error', message: 'İndirme başarısız. Güncellemeleri yeniden kontrol edin.' }); }
        finally { busy = false; }
        return state;
    });
    ipcMain.handle('updates-install', () => {
        if (state.status !== 'downloaded') return { success: false, message: 'Önce güncellemeyi indirin.' };
        if (!canInstall()) return { success: false, message: 'Önce devam eden ağ denemesinin bitmesini bekleyin.' };
        // Reply to IPC before closing the app for the installer.
        setImmediate(() => { beforeInstall(); updater.quitAndInstall(false, true); });
        return { success: true };
    });
    return { check, getState: () => state };
}
module.exports = { setupUpdates };
