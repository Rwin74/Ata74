# Ata74 yayınlama

## Normal güncelleme

1. `npm version patch --no-git-tag-version` ile sürümü artır.
2. RELEASE-NOTES.md dosyasını son değişikliklere göre düzenle.
3. `npm test` ve `./scripts/check-powershell.ps1` çalıştır.
4. Kaynakları commit edip `git push origin main` ile gönder.
5. `git tag v1.5.1` gibi package.json ile eşleşen etiket oluştur ve `git push origin v1.5.1` ile gönder.
6. `npm run release` çalıştır. Derler, imzalar ve beş dosyalı Release yayınlar.

GitHub Actions şu an hesap kısıtlaması nedeniyle çalışmıyor. Yerel yayın komutu Git Credential Manager oturumunu kullanabilir. Uygulamaya GitHub token'ı eklenmez. Actions yeniden açılırsa aynı özel anahtar `ATA74_SIGNING_PRIVATE_KEY` secret'ına yetkili kullanıcı tarafından ayrıca konmalıdır.

## Anahtar

Mevcut özel anahtar `.release-private/release-signing-key.pem` içindedir. Bu klasör Git'e ve pakete dahil edilmez. Güvenli yedeğini sakla. Anahtarı depoya, kaynak ZIP'ine, Release'a veya arkadaşına gönderme. Uygulama yalnızca update-public-key.pem dosyasını içerir.

Başka bilgisayarda yayın için aynı özel anahtar gerekir. `ATA74_SIGNING_KEY_FILE` ortam değişkeniyle özel anahtar dosyası seçilebilir. Açık anahtarla eşleşmeyen anahtar reddedilir. Anahtar üretme betiği mevcut açık anahtar varken özel anahtar yoksa yeni anahtar üretmez; önce eski anahtarı kurtarmak gerekir.

## Yayın dosyaları

- Ata74-Setup-SURUM.exe
- Ata74-Setup-SURUM.exe.blockmap
- latest.yml
- ata74-update.json
- ata74-update.sig

Yalnızca EXE yüklemek yeterli değildir. İmza dosyaları yoksa 1.5.0 ve sonrası yeni sürümü reddeder. Windows Authenticode sertifikası henüz yoktur; ayrı yayın kaydı imzası SmartScreen uyarısını kaldırmaz.

1.4.0 ve öncesinden 1.5.0'a ilk geçiş eski mekanizma ile olur. Yeni zorunlu imza doğrulaması 1.5.0 kurulduktan sonra devreye girer.
