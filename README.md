# Ata74 1.4.0

Windows için GoodbyeDPI istemcisi ve ağ tanılama araçları.

**VPN değildir:** IP adresini değiştirmez, şifreli VPN tüneli oluşturmaz. Her filtreyi aşma veya ping/FPS artışı garantisi yoktur. Özel yurt ağındaki Discord erişimi ve ses bağlantısı ayrıca denenmelidir.

[Son sürümü indir](https://github.com/Rwin74/Ata74/releases/latest). Kurulum için `Ata74-Setup` dosyasını kullanın. Önceki taşınabilir uygulamayı tepsiden tamamen kapatın. Windows yönetici izni ister; kod imzalama sertifikası eklenmemiştir.

## Gerçek ölçümler

- Kullanıcının seçtiği tek hedefe 12 ICMP denemesi: ortalama/en az/en çok RTT, yanıtsız oranı ve ardışık başarılı örneklerde RTT değişimi.
- Önceki aynı hedef ölçümüyle karşılaştırma. Ağ ve yük değişirse sonuçlar doğrudan karşılaştırılmamalıdır.
- Discord web/API ve genel HTTPS adresinin ayrı kontrolü. Ses/UDP ve WebSocket doğrulanmaz.
- Dört DNS sağlayıcısında üç alan adı, ikişer gerçek A sorgusu. Medyan ve başarı sayısı gösterilir; eksik sonuç veren sağlayıcı önerilmez. Bu test oyun pingini ölçmez ve ayar değiştirmez.

## Kontrollü ayarlar

- IPv4 DNS yalnızca seçilen bağlı fiziksel ağ kartında ve kullanıcı onayıyla değiştirilir. IPv6, IP ve ağ geçidi korunur.
- DNS'in önceki otomatik/elle atama türü ve adresleri yazmadan önce kaydedilir. Sonuç Windows'tan yeniden okunarak doğrulanır.
- Güç planı yalnızca cihazda kurulu planlar arasından seçilir. Servis kapatılmaz, dosya silinmez. Önceki özel güç planı dahil tam plan kimliği kaydedilir.
- Başarısız değişiklikte önceki ayar geri yüklenmeye çalışılır. Geri alma başarısızsa yedek korunur. Başka bir uygulamanın sonradan değiştirdiği ayarın üzerine yazılmaz.
- DNS temizliği, salt okunur bellek/servis/TCP kayıtları ve Interrupt Moderation görünümü, yerel JSON tanı raporu.

Yedekler uygulamanın kullanıcı veri klasöründeki `settings-backup-v1.json` dosyasında tutulur. Dosyayı silmeyin; bozuksa uygulama tahmini ayarla devam etmez.

## Kaldırılan özellikler ve geçiş

RAM boşaltma, zorla 0,5 ms zamanlayıcı, toplu MSI/TCP kayıt değişiklikleri, kesme ayarını zorla değiştirme ve telemetri kapatma kaldırıldı. Evrensel performans kazancı sağlamazlar. Dosya sıkıştırma, masaüstü dosyalarını taşıma ve bilgisayarı kapatma araçları da ağ istemcisinin kapsamından çıkarıldı.

**1.3.0 ve öncesi önceki ayarları yedeklemedi.** Bu nedenle eski değişiklikler otomatik geri alınmaz. Sistem durumu ekranı mevcut değerleri gösterir; kaynağı bilinmeyen değerler standart olduğu varsayılarak silinmez. İlk çalıştırmada eski kayıt veya servisler değiştirilmez.

## Geliştirme ve yayın

Windows, Node.js 22 veya üstü:

```powershell
npm ci
npm test
./scripts/check-powershell.ps1
npm run build
```

Güncelleme adresi: `Rwin74/Ata74`. Yeni sürüm için `package.json` ve kilit dosyasındaki numarayı artırıp eşleşen `v1.4.1` etiketini gönderin. GitHub Actions testleri çalıştırır, kurulum ve güncelleme dosyalarını yayınlar. Gerektiğinde Actions ekranından aynı iş akışı elle de başlatılabilir. Ayrıntılar: [Yayın rehberi](README-GUNCELLEME.md).

## Doğrulama kapsamı

Birim ve IPC testleri: RTT hesaplama, hedef doğrulama, DNS sorgu seçimi, yedeklemeden önce yazmama, birebir geri yükleme, dış değişiklik çatışması, işlem hatası/geri alma hatası, iptal edilen onay ve güncelleme durum akışı. Arayüz testleri test yanıtlarıyla yapılır.

Windows'ta salt okunur ağ kartı, güç planı, bellek/servis okuma; gerçek ICMP, DNS ve HTTPS ölçümleri denenmiştir. Kullanıcının gerçek DNS/güç ayarları test amacıyla değiştirilmemiştir. Fiziksel aygıtta değiştir/geri al ve kurulu iki sürüm arasında güncellemenin tamamı henüz uçtan uca doğrulanmamıştır.

GoodbyeDPI 0.2.2 ve WinDivert lisansları `core/licenses` içindedir. Kaynak: https://github.com/ValdikSS/GoodbyeDPI
