# Ata74 1.6.0

Windows için GoodbyeDPI istemcisi, ağ araçları, depolama analizi ve kapatma zamanlayıcısı.

[Son sürümü indir](https://github.com/Rwin74/Ata74/releases/latest). Kurulum: `Ata74-Setup` dosyası. Önceki taşınabilir uygulamayı tepsiden kapatın. Windows yönetici izni ister. Ata74 VPN değildir; IP değiştirmez ve ping/FPS artışı garanti etmez.

## Güncelleme güvenliği

1.5.0'dan itibaren yeni sürümün küçük yayın kaydı, uygulamaya gömülü Ed25519 açık anahtarla doğrulanır. Ardından sürüm, dosya adı, platform, boyut ve SHA512 özeti GitHub güncelleme listesiyle karşılaştırılır. İndirme bitince ve kurulumdan hemen önce EXE yeniden doğrulanır. İmzasız/uyuşmayan paket kurulmaz. Kullanıcı indirmeyi iptal edebilir; indirme ve kurulum ayrı onay adımlarıdır.

**İlk geçiş:** 1.4.0 ve öncesi yeni imzayı doğrulamaz. 1.5.0'a geçiş mevcut GitHub/HTTPS ve SHA512 mekanizmasıyla olur. İmza zorunluluğu 1.5.0 kurulduktan sonraki güncellemelerde başlar. Bu, Windows Authenticode sertifikası değildir ve SmartScreen uyarısını kaldırmaz. GitHub veya ağ erişimi engellenirse güncelleme kontrolü başarısız olabilir; mevcut uygulama kullanılmaya devam eder.

İmzalama anahtarı yerel `.release-private/release-signing-key.pem` dosyasında tutulur; Git tarafından yok sayılır ve uygulamaya eklenmez. Bu klasörü kaybetmeyin, güvenli bir yedeğini koruyun. **Anahtarı kaynak ZIP'ine, GitHub deposuna veya Release dosyalarına koymayın.** Anahtar kaybolursa mevcut istemcilere farklı anahtarla normal güncelleme yapılamaz. Başka bilgisayarda yayın için aynı özel anahtar gerekir. Anahtar değişimi ayrı bir geçiş sürümü gerektirir.

## Depolama analizi

Seçilen normal klasör veya sürücüde en büyük dosyalar, üst klasör toplamları ve dosya türleri listelenir. Dosya içeriği okunmaz; hiçbir şey silinmez. Sembolik bağlantı/junction klasörleri takip edilmez. Erişim hatası ve 300.000 giriş / 90 saniye sınırı varsa sonuç kısmi olarak etiketlenir. Taranan dosyaların görünen mantıksal boyutu diskte tahsis edilen fiziksel alanla aynı değildir. Sıkıştırılmış/sparse dosyalar farklı yer kaplayabilir; görülen sabit bağlantı tekrarları bir kez sayılır. Tarama ayrı iş parçacığında çalışır ve durdurulabilir.

## Yinelenen dosyalar

Seçilen klasörde aynı boyuttaki dosyalar tam SHA-256 içerik özetiyle karşılaştırılır. Boş dosyalar, bağlantılar, sabit bağlantı tekrarları ve 2 GiB üstü dosyalar atlanır. 150.000 giriş, 120 saniye veya 4 GiB toplam içerik okuma sınırında kısmi sonuç gösterilir. Disk yükü oluşturabilir; durdurulabilir. En fazla 100 grup ve grup başına 20 yol gösterilir. Hiçbir dosya silinmez; yalnızca konumu açılır. Görünen fazladan kopya boyutu fiziksel disk kazancı garantisi değildir.

## Başlangıç uygulamaları

Ata74'ün çalıştığı hesabın HKCU Run kayıtları ve kullanıcı başlangıç klasöründeki küçük `.lnk` / `.url` dosyaları tek tek yedeklenerek duraklatılabilir ve geri yüklenebilir. Sistem genelindeki kayıtlar salt okunurdur. Çalışan uygulamalar kapatılmaz. İşlem öncesinde kullanıcı onayı istenir; dışarıdan değişen kayıtların üzerine yazılmaz. Kısayol yedeklerinin küçük kopyaları geri yüklemeden sonra da kullanıcı verisi klasöründe korunur.

Liste, Windows'un etkinlik tercihiyle aynı şey değildir. Store başlangıç görevleri, servisler ve zamanlanmış görevler kapsam dışıdır; Windows başlangıç ayarları ayrıca açılabilir. Gerçek bilgisayarda yalnızca listeleme kontrol edilmiştir; değiştirme/geri yükleme testleri geçici dosyalar ve sahte kayıt arka ucuyla yapılmıştır.
## Kapatma zamanlayıcısı

1–1440 dakika arasında, ayrı kullanıcı onayıyla planlanır. Geri sayım ve iptal düğmesi vardır. Uygulama tepsideyken çalışır; tam çıkış, uyku veya yeniden başlatma iptal eder. Süre dolunca `/s /t 0` ile normal kapatma istenir; `/f` kullanılmaz. Kaydedilmemiş işler kapatmayı engelleyebilir. Zamanlayıcı etkinken güncelleme kurulumu başlatılmaz; önce iptal edilmelidir.

## Ağ ve sistem araçları

- Tek hedefe 12 ICMP denemesi: ortalama/en az/en çok RTT, yanıtsız oranı ve ardışık başarılı örneklerde RTT değişimi. Sonuç oyun/Discord ses gecikmesi değildir.
- Dört DNS sağlayıcısında üç alan adı, ikişer gerçek sorgu. Medyan ve başarı sayısı gösterilir; ölçüm kendiliğinden ayar değiştirmez.
- Seçili fiziksel kartın IPv4 DNS atama türü ve adresleri değişiklikten önce kaydedilir. Güç planı kimliği de kaydedilir. Sonuç tekrar okunur; geri almada dışarıdan değiştirilmiş ayarın üzerine yazılmaz.
- Salt okunur bellek/servis/TCP kayıtları ve ağ kartı kesme ayarı; yerel JSON tanı raporu.

Eski sürümlerin RAM temizleme, 0,5 ms kilidi, toplu MSI/TCP ve servis müdahaleleri kaldırılmıştır. 1.3.0 ve öncesi ilk ayarları kaydetmediğinden eski değişiklikler tahmini değerlerle geri alınmaz. Dosya sıkıştırma ve masaüstü dosyalarını toplu taşıma geri getirilmemiştir.

## Geliştirme ve yayın

Windows, Node.js 22+:

```powershell
npm ci
npm test
./scripts/check-powershell.ps1
npm run build
```

`npm run build` kurulum paketini üretir ve mevcut özel anahtarla `ata74-update.json` / `ata74-update.sig` dosyalarını imzalar. Anahtar yoksa yayın imzası üretilemez. Uygulama geliştirmek ve test çalıştırmak için özel anahtar gerekmez. Mevcut açık anahtarı rastgele yenilemeyin.

Sürümü artırın, kaynakları commit/push yapın, eşleşen sürüm etiketini gönderin; sonra `npm run release` kullanın. Komut temiz ve GitHub main ile eşleşen kaynak ister, paketi kaynakla karşılaştırır, beş yayın dosyasını önce taslağa yükler, ardından herkese açar. Yayınlanmış sürümün dosyalarını değiştirmez; yeni sürüm numarası gerekir. Yerelde önceden derlenmiş aynı kaynak için `npm run release -- --skip-build` kullanılabilir.

GitHub hesabında Actions kısıtlaması vardır. Çözüldüğünde CI için `ATA74_SIGNING_PRIVATE_KEY` adlı GitHub Actions secret'ına aynı özel anahtarın ayrıca eklenmesi gerekir. Bu görev sırasında özel anahtar GitHub'a aktarılmamıştır. [Yayın rehberi](README-GUNCELLEME.md).

## Doğrulama sınırları

Gerçek Ed25519 imza/hash testleri; yanlış anahtar, değiştirilmiş paket, sürüm/listenin uyuşmaması, indirme iptali ve kurulum öncesi yeniden doğrulama testleri vardır. Depolama testleri geçici dosyalarda gerçek tarama, junction atlama, kısmi sonuç ve iptal içerir. Zamanlayıcı testlerinde gerçek kapatma komutu çalıştırılmamıştır. Önceki Windows salt okunur ve arayüz kontrolleri korunur. İki gerçek kurulu sürüm arasında uçtan uca güncelleme ve yurt ağındaki ses/UDP bağlantısı ayrıca doğrulanmalıdır.

GoodbyeDPI 0.2.2 / WinDivert lisansları: `core/licenses`. Kaynak: https://github.com/ValdikSS/GoodbyeDPI
