# Ata74

Windows için GoodbyeDPI arayüzü. Discord ve Roblox erişimi için ağ profilleri ve GitHub üzerinden kullanıcı onaylı güncellemeler sunar.

**VPN değildir:** IP adresinizi değiştirmez ve şifreli bir VPN tüneli oluşturmaz. Her filtreyi aşma garantisi yoktur. Özel yurt ağında erişim henüz canlı olarak doğrulanmamıştır.

## Kurulum

[Releases](https://github.com/Rwin74/Ata74/releases/latest) sayfasından `Ata74-Setup` kurulumunu indirin. Önceki taşınabilir uygulamayı tepsi menüsünden kapatın. Windows yönetici izni ister. Kod imzalama sertifikası eklenmemiştir.

Yurt ağının giriş/onay sayfasını tamamlayın. “Özel Yurt · Otomatik deneme” profilini başlatın. HTTPS kontrolü başarılıysa Discord'u açın; ses bağlantısını ayrıca deneyin. Başarısızsa gerçek VPN bağlantısı veya ağ yönetiminin desteği gerekebilir.

## Güncellemeler

Uygulama açılışta yeni sürümü kontrol eder. İndirme ve kurulum ayrı ayrı kullanıcı tarafından başlatılır. Eski 1.1.0 taşınabilir sürüm için yeni kurulum bir kez gereklidir.

## Geliştirme ve yayın

Node.js 22 veya üstü, Windows:

```powershell
npm ci
npm test
npm run build
```

Sürüm numarasını artırıp eşleşen `v1.3.1` gibi etiketi gönderin. GitHub Actions kurulum paketini, blockmap dosyasını ve `latest.yml` güncelleme manifestini yayınlar. Ayrıntılar: [Yayınlama rehberi](README-GUNCELLEME.md).

## Doğrulama kapsamı

Güncelleme durum akışı taklit testlerle, arayüz geçişleri ve başlat/durdur görsel akışı sahte motor yanıtlarıyla kontrol edilmiştir. Paket derlemesi ve çalışma zamanı bağımlılık taraması geçmiştir. Gerçek yurt ağında erişim, tüm Windows sistem araçları ve iki kurulu sürüm arasındaki canlı güncelleme henüz uçtan uca test edilmemiştir.

GoodbyeDPI 0.2.2 ve WinDivert bileşenlerinin lisansları `core/licenses` içindedir. Kaynak: https://github.com/ValdikSS/GoodbyeDPI
