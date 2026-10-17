document.addEventListener('DOMContentLoaded', async () => {
    const greetingEl = document.getElementById('greeting');
    const startBtn = document.getElementById('start-btn');
    const statusEl = document.getElementById('status');
    const closeBtn = document.getElementById('close-btn');

    // Get system username via IPC
    try {
        const username = await window.api.getUsername();
        greetingEl.textContent = `${username}`;
    } catch (err) {
        console.error('Failed to get username:', err);
        greetingEl.textContent = 'Hoşgeldin';
    }

    
    // Close button
    document.getElementById('close-btn').addEventListener('click', () => {
        window.api.closeApp();
    });

    function showToast(msg, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerText = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // Ping updater
    const pingIndicator = document.getElementById('ping-indicator');
    
    async function updatePing() {
        try {
            const ping = await window.api.getPing();
            if (ping === -1) {
                pingIndicator.innerHTML = '<span class="ping-dot"></span>Ping: Zaman Aşımı';
                pingIndicator.className = 'ping-text ping-bad';
            } else if (ping === null) {
                pingIndicator.innerHTML = '<span class="ping-dot"></span>Ping: Hesaplanıyor...';
                pingIndicator.className = 'ping-text';
            } else {
                pingIndicator.innerHTML = `<span class="ping-dot"></span>Ping: ${ping} ms`;
                if (ping < 70) pingIndicator.className = 'ping-text ping-good';
                else if (ping < 150) pingIndicator.className = 'ping-text ping-med';
                else pingIndicator.className = 'ping-text ping-bad';
            }
        } catch (e) {
            console.error(e);
        }
    }
    
    // Her 3 saniyede bir ping güncelle
    setInterval(updatePing, 3000);
    updatePing();

    const card = document.querySelector('.connection-card');
    const stopBtn = document.getElementById('stop-btn');
    function connectionState(state, title, description, badge) {
        card.dataset.state = state;
        document.getElementById('connection-title').textContent = title;
        document.getElementById('connection-description').textContent = description;
        document.getElementById('connection-badge').textContent = badge;
        stopBtn.disabled = state !== 'running';
        document.getElementById('network-mode').disabled = state === 'loading';
    }
    document.getElementById('minimize-btn').addEventListener('click', () => window.api.minimizeWindow());
    document.getElementById('maximize-btn').addEventListener('click', () => window.api.maximizeWindow());
    document.getElementById('network-mode').addEventListener('change', event => {
        document.getElementById('profile-caption').textContent = event.target.value === 'yurt_auto' ? '5 yöntem, sırayla' : 'Tek profil';
    });
    // Handle start button
    startBtn.addEventListener('click', async () => {
        if (startBtn.classList.contains('loading') || startBtn.classList.contains('success')) {
            return; // Prevent multiple clicks
        }

        connectionState('loading', 'Bağlantı deneniyor', 'Seçili profil için erişim kontrol ediliyor.', 'Deneniyor');
        // Set Loading state
        startBtn.classList.add('loading');
        startBtn.textContent = 'Bağlanıyor...';
        statusEl.textContent = 'Profil hazırlanıyor; otomatik deneme yaklaşık 40 saniye sürebilir...';
        statusEl.classList.add('visible');

        try {
            // Trigger main process start sequence
            const mode = document.getElementById('network-mode').value;
            const result = await window.api.startLauncher(mode);
            
            if (result.success) {
                // Set Success state
                startBtn.classList.remove('loading');
                startBtn.classList.add('success');
                startBtn.textContent = 'Yeniden Dene';
                startBtn.classList.remove('success');
                statusEl.textContent = result.message;
                connectionState('running', mode === 'yurt_auto' ? 'HTTPS erişimi doğrulandı' : 'Profil çalışıyor', mode === 'yurt_auto' ? 'Discord’u açabilirsin. Ses bağlantısını ayrıca dene.' : 'Uygulamayı açarak erişimi kontrol edebilirsin.', 'Çalışıyor');
            } else {
                throw new Error(result.error || 'Bilinmeyen bir hata oluştu.');
            }
        } catch (error) {
            startBtn.classList.remove('loading');
            startBtn.textContent = 'Yeniden dene';
            connectionState('error', 'Bağlantı doğrulanamadı', 'Aşağıdaki işlem durumunu kontrol edip tekrar dene.', 'Kontrol gerekli');
            statusEl.textContent = 'Bağlantı Başarısız: ' + error.message;
            statusEl.className = 'status-text visible';
        }
    });

    window.api.onLauncherProgress(text => { statusEl.textContent = text; });
    document.getElementById('stop-btn').addEventListener('click', async () => {
        if (startBtn.classList.contains('loading')) return;
        await window.api.stopLauncher();
        statusEl.textContent = 'Durduruldu.';
        startBtn.classList.remove('success');
        startBtn.textContent = 'Bağlantıyı başlat';
        connectionState('idle', 'Başlamaya hazır', 'Bir profil seçerek bağlantıyı başlat.', 'Hazır');
    });

    // Tabs logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const viewPanels = document.querySelectorAll('.view-panel');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            viewPanels.forEach(p => p.style.display = 'none');
            
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).style.display = 'block';
            const pages = {
                'bypass-view': ['Bağlantı', 'Bağlantın, kontrolünde.', 'Ağına uygun profili seç. Gerisini Ata74 denesin.'],
                'boost-view': ['Ağ ayarları', 'Ağına ince ayar.', 'DNS, TCP ve güç seçeneklerini tek yerden yönet.'],
                'tools-view': ['Araçlar', 'Günlük işlere biraz alan.', 'Dosyalarını düzenle, sıkıştır ve zamanını planla.'],
                'pro-view': ['Gelişmiş', 'Daha fazla kontrol.', 'Windows servisleri ve donanım ayarları. Değişiklikler sistem genelinde uygulanır.']
            };
            const page = pages[btn.dataset.target];
            document.getElementById('page-label').textContent = page[0];
            document.getElementById('page-title').textContent = page[1];
            document.getElementById('page-description').textContent = page[2];
            document.querySelector('.content').scrollTop = 0;
        });
    });

    // Boost Logic
    const boostStatus = document.getElementById('boost-status');
    const setBoostStatus = (msg, isSuccess = true) => {
        boostStatus.innerText = msg;
        boostStatus.className = 'status-text visible ' + (isSuccess ? 'status-success' : '');
        showToast(msg, isSuccess ? 'success' : 'error');
    };

    document.getElementById('tcp-opt-btn').addEventListener('click', async () => {
        setBoostStatus('Oyun modu açılıyor...');
        const res = await window.api.optimizeTCP();
        setBoostStatus(res.message, res.success);
    });
    document.getElementById('tcp-rev-btn').addEventListener('click', async () => {
        setBoostStatus('Oyun modu kapatılıyor...');
        const res = await window.api.revertTCP();
        setBoostStatus(res.message, res.success);
    });
    document.getElementById('dns-opt-btn').addEventListener('click', async () => {
        setBoostStatus('DNS test ediliyor... (10-15sn sürebilir)');
        const res = await window.api.optimizeDNS();
        setBoostStatus(res.message, res.success);
    });
    document.getElementById('dns-rev-btn').addEventListener('click', async () => {
        setBoostStatus('DNS varsayılana sıfırlanıyor...');
        const res = await window.api.revertDNS();
        setBoostStatus(res.message, res.success);
    });
    document.getElementById('flush-btn').addEventListener('click', async () => {
        setBoostStatus('Ağ temizleniyor...');
        const res = await window.api.flushNetwork();
        setBoostStatus(res.message, res.success);
    });
    document.getElementById('fps-opt-btn').addEventListener('click', async () => {
        setBoostStatus('FPS modu açılıyor...');
        const res = await window.api.optimizeFPS();
        setBoostStatus(res.message, res.success);
    });
    document.getElementById('fps-rev-btn').addEventListener('click', async () => {
        setBoostStatus('FPS modu kapatılıyor...');
        const res = await window.api.revertFPS();
        setBoostStatus(res.message, res.success);
    });

    // Tools Logic
    const toolsStatus = document.getElementById('tools-status');
    const setToolsStatus = (msg, isSuccess = true) => {
        toolsStatus.innerText = msg;
        toolsStatus.className = 'status-text visible ' + (isSuccess ? 'status-success' : '');
        showToast(msg, isSuccess ? 'success' : 'error');
    };

    let selectedFolder = null;
    document.getElementById('select-folder-btn').addEventListener('click', async () => {
        const res = await window.api.selectFolder();
        if (res.success && res.folder) {
            selectedFolder = res.folder;
            document.getElementById('selected-folder-text').innerText = 'Seçili: ' + selectedFolder;
        }
    });

    document.getElementById('compress-btn').addEventListener('click', async () => {
        if (!selectedFolder) return setToolsStatus('Lütfen önce klasör seçin!', false);
        setToolsStatus('Sıkıştırılıyor... (Bu işlem uzun sürebilir, bekleyin)');
        const res = await window.api.compressFolder(selectedFolder);
        setToolsStatus(res.message, res.success);
    });

    document.getElementById('uncompress-btn').addEventListener('click', async () => {
        if (!selectedFolder) return setToolsStatus('Lütfen önce klasör seçin!', false);
        setToolsStatus('Geri alınıyor... Lütfen bekleyin.');
        const res = await window.api.uncompressFolder(selectedFolder);
        setToolsStatus(res.message, res.success);
    });

    if (window.api.onCompressProgress) {
        window.api.onCompressProgress((data) => {
            const container = document.getElementById('compression-progress-container');
            const text = document.getElementById('compression-progress-text');
            if (data.count === 'done') {
                container.style.display = 'none';
            } else {
                container.style.display = 'block';
                const action = data.type === 'compress' ? 'Sıkıştırılıyor' : 'Geri alınıyor';
                text.innerText = `${action}... (${data.count} dosya işlendi)`;
            }
        });
    }

    document.getElementById('timer-start-btn').addEventListener('click', async () => {
        const mins = document.getElementById('timer-select').value;
        setToolsStatus('Zamanlayıcı ayarlanıyor...');
        const res = await window.api.setShutdown(mins);
        setToolsStatus(res.message, res.success);
    });

    document.getElementById('timer-cancel-btn').addEventListener('click', async () => {
        setToolsStatus('Zamanlayıcı iptal ediliyor...');
        const res = await window.api.cancelShutdown();
        setToolsStatus(res.message, res.success);
    });

    document.getElementById('clean-desktop-btn').addEventListener('click', async () => {
        setToolsStatus('Masaüstü toplanıyor...');
        const res = await window.api.cleanDesktop();
        setToolsStatus(res.message, res.success);
    });

    // PRO Logic
    const proStatus = document.getElementById('pro-status');
    const setProStatus = (msg, isSuccess = true) => {
        proStatus.innerText = msg;
        proStatus.className = 'status-text visible ' + (isSuccess ? 'status-success' : '');
        showToast(msg, isSuccess ? 'success' : 'error');
    };

    document.getElementById('timer-opt-btn').addEventListener('click', async () => {
        setProStatus('Zamanlayıcı çözünürlüğü değiştiriliyor...');
        const res = await window.api.enableTimerRes();
        setProStatus(res.message, res.success);
    });
    document.getElementById('timer-rev-btn').addEventListener('click', async () => {
        setProStatus('Zamanlayıcı kapatılıyor...');
        const res = await window.api.disableTimerRes();
        setProStatus(res.message, res.success);
    });

    document.getElementById('msi-opt-btn').addEventListener('click', async () => {
        setProStatus('Kayıt Defteri MSI yapılandırması uygulanıyor...');
        const res = await window.api.enableMSI();
        setProStatus(res.message, res.success);
    });
    document.getElementById('msi-rev-btn').addEventListener('click', async () => {
        setProStatus('Kayıt Defteri geri alınıyor...');
        const res = await window.api.disableMSI();
        setProStatus(res.message, res.success);
    });

    document.getElementById('int-opt-btn').addEventListener('click', async () => {
        setProStatus('Ağ kartı yeniden yapılandırılıyor (İnternet anlık gidebilir)...');
        const res = await window.api.disableInterrupt();
        setProStatus(res.message, res.success);
    });
    document.getElementById('int-rev-btn').addEventListener('click', async () => {
        setProStatus('Ağ kartı standart ayarlara dönüyor...');
        const res = await window.api.enableInterrupt();
        setProStatus(res.message, res.success);
    });

    document.getElementById('ram-opt-btn').addEventListener('click', async () => {
        setProStatus('Bekleme belleği temizleniyor...');
        const res = await window.api.flushRAM();
        setProStatus(res.message, res.success);
    });

    document.getElementById('tel-opt-btn').addEventListener('click', async () => {
        setProStatus('Tanılama servisleri kapatılıyor...');
        const res = await window.api.nukeTelemetry();
        setProStatus(res.message, res.success);
    });
    document.getElementById('tel-rev-btn').addEventListener('click', async () => {
        setProStatus('Servisler eski haline getiriliyor...');
        const res = await window.api.restoreTelemetry();
        setProStatus(res.message, res.success);
    });
});

document.addEventListener('DOMContentLoaded', async () => {
    const status = document.getElementById('update-status');
    const check = document.getElementById('update-check');
    const download = document.getElementById('update-download');
    const install = document.getElementById('update-install');
    function render(state) {
        status.textContent = 'v' + state.version + ' · ' + state.message;
        check.disabled = ['checking','downloading','downloaded'].includes(state.status);
        download.hidden = state.status !== 'available';
        install.hidden = state.status !== 'downloaded';
    }
    window.api.onUpdateState(render);
    async function action(button, fn) {
        button.disabled = true;
        try { const result = await fn(); if (result.message && result.success === false) status.textContent = result.message; else if (result.status) render(result); }
        catch { status.textContent = 'Güncelleme işlemi tamamlanamadı. Tekrar deneyin.'; }
        finally { button.disabled = false; }
    }
    check.addEventListener('click', () => action(check, window.api.checkUpdates));
    download.addEventListener('click', () => action(download, window.api.downloadUpdate));
    install.addEventListener('click', () => action(install, window.api.installUpdate));
    try { render(await window.api.getUpdateState()); } catch { status.textContent = 'Güncelleme kontrolüne ulaşılamadı.'; }
});
