'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),yaml=require('js-yaml');const root=path.join(__dirname,'..');
const key=process.env.ATA74_SIGNING_PRIVATE_KEY||fs.readFileSync(process.env.ATA74_SIGNING_KEY_FILE||path.join(root,'.release-private','release-signing-key.pem'),'utf8');
const pub=fs.readFileSync(path.join(root,'update-public-key.pem'),'utf8');if(!crypto.createPublicKey(key).export({type:'spki',format:'der'}).equals(crypto.createPublicKey(pub).export({type:'spki',format:'der'})))throw Error('İmzalama anahtarı uygulamadaki açık anahtarla uyuşmuyor.');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')),dir=path.join(root,'dist-update'),asset=`Ata74-Setup-${pkg.version}.exe`,file=path.join(dir,asset),bytes=fs.readFileSync(file),sha512=crypto.createHash('sha512').update(bytes).digest('base64');
const latest=yaml.load(fs.readFileSync(path.join(dir,'latest.yml'),'utf8'));if(latest.version!==pkg.version||latest.path!==asset||latest.sha512!==sha512)throw Error('Manifest ve yerel kurulum uyuşmuyor.');
const manifest=Buffer.from(JSON.stringify({schema:1,version:pkg.version,platform:'win32',arch:'x64',asset,size:bytes.length,sha512},null,2)+'\n');
fs.writeFileSync(path.join(dir,'ata74-update.json'),manifest);fs.writeFileSync(path.join(dir,'ata74-update.sig'),crypto.sign(null,manifest,key).toString('base64')+'\n');
if(!crypto.verify(null,manifest,pub,crypto.sign(null,manifest,key)))throw Error('İmza öz denetimi başarısız.');console.log('İmzalı güncelleme kaydı üretildi: '+pkg.version);
