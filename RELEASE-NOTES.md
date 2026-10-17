# Ata74 1.5.0

- Ed25519 imzalı sürüm kaydı: indirme öncesi yayıncı doğrulaması ve kurulum öncesi EXE özeti yeniden kontrolü. İmzasız/uyuşmayan yeni sürüm kurulmaz. İndirme iptal edilebilir.
- Depolama analizi: seçilen klasör veya sürücüde büyük dosyalar, üst klasörler ve dosya türleri. Silme yapmaz, bağlantı klasörlerini atlar; erişilemeyen veya sınıra takılan tarama kısmi sonuç olarak gösterilir.
- İptal edilebilir kapatma zamanlayıcısı: uygulama açık/tepsideyken çalışır. Uyku ve tam çıkışta iptal olur. Süre dolunca Windows'a zorlamasız normal kapatma isteği gönderir; kaydedilmemiş işler kapatmayı engelleyebilir.

**İlk geçiş:** 1.4.0 ve öncesi bu yeni imzayı kontrol etmez; 1.5.0'a ilk geçiş mevcut GitHub/HTTPS ve SHA512 mekanizmasıyla yapılır. İmza zorunluluğu 1.5.0 kurulduktan sonraki güncellemelerde geçerlidir. Bu imza Windows Authenticode sertifikası değildir; SmartScreen uyarısını kaldırmaz.

**VPN değildir; ping düşüşü veya her filtreyi aşma garantisi yoktur.** Mevcut ölçüm ve geri alınabilir DNS/güç araçları korunur. Gerçek bilgisayarı kapatmadan, sahte kapatma yürütücüsüyle zamanlayıcı test edilmiştir.
