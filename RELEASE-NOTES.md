# Ata74 1.6.0

- Yinelenen dosya bulucu: aynı içerikli dosyaları SHA-256 ile gruplar, mantıksal kopya boyutunu gösterir ve konumlarını açar. Dosya silmez. Tarama durdurulabilir; boyut, süre ve okuma sınırlarında kısmi sonuç gösterilir.
- Başlangıç uygulamaları: mevcut hesabın desteklenen Run kayıtlarını ve başlangıç kısayollarını kullanıcı onayıyla yedekleyerek duraklatır / geri yükler. Dışarıdan değişen kayıtların üzerine yazmaz. Sistem geneli kayıtlar salt okunurdur.
- Windows'un başlangıç tercihi ayrıca geçerlidir; servisler, zamanlanmış görevler ve Store görevleri listede kapsanmaz.
- Ed25519 imzalı güncelleme ve kurulum öncesi dosya doğrulaması korunur.

Testler geçici dosyalarda gerçek içerik taraması, sınırlar ve iptal; sahte kayıt arka ucunda yedekleme, çakışma ve geri yükleme senaryolarını kapsar. Gerçek başlangıç ayarları değiştirilmemiştir. Ata74 VPN değildir; ping/FPS artışı garanti etmez.