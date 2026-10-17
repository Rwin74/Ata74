'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');const root=path.join(__dirname,'..');
const secret=path.join(root,'.release-private','release-signing-key.pem'),pub=path.join(root,'update-public-key.pem');
if(fs.existsSync(pub)&&!fs.existsSync(secret))throw Error('Açık anahtar var, özel anahtar yok. Yeni anahtar üretmeden önce eski anahtarı kurtarın.');
if(!fs.existsSync(secret)){fs.mkdirSync(path.dirname(secret),{recursive:true});const keys=crypto.generateKeyPairSync('ed25519');fs.writeFileSync(secret,keys.privateKey.export({type:'pkcs8',format:'pem'}),{flag:'wx',mode:0o600});fs.writeFileSync(pub,keys.publicKey.export({type:'spki',format:'pem'}),{flag:'wx'});}
const actual=crypto.createPublicKey(fs.readFileSync(secret)).export({type:'spki',format:'der'});if(!actual.equals(crypto.createPublicKey(fs.readFileSync(pub)).export({type:'spki',format:'der'})))throw Error('İmzalama anahtar çifti uyuşmuyor.');console.log('İmzalama anahtar çifti hazır. Özel anahtar depoya ve uygulamaya eklenmez.');
