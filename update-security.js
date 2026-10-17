'use strict';
const fs=require('fs'),crypto=require('crypto'),path=require('path');
function versionParts(v){if(typeof v!=='string'||!/^\d+\.\d+\.\d+$/.test(v))throw Error('Geçersiz kararlı sürüm.');const parts=v.split('.').map(Number);if(parts.some(x=>!Number.isSafeInteger(x)))throw Error('Geçersiz sürüm.');return parts;}
function newer(a,b){const x=versionParts(a),y=versionParts(b);for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]>y[i];}return false;}
function verifyManifest(bytes,signature,publicKey,version,currentVersion){
 if(!Buffer.isBuffer(bytes)||bytes.length>16384)throw Error('İmzalı sürüm kaydı geçersiz.');
 const encoded=String(signature).trim();if(!/^[A-Za-z0-9+/]{86}==$/.test(encoded))throw Error('Güncelleme imzası geçersiz.');
 if(!crypto.verify(null,bytes,publicKey,Buffer.from(encoded,'base64')))throw Error('Yayıncı imzası doğrulanamadı. Kurulum engellendi.');
 const m=JSON.parse(bytes.toString('utf8'));
 if(m.schema!==1||m.version!==version||!newer(m.version,currentVersion)||m.platform!=='win32'||m.arch!=='x64'||m.asset!==`Ata74-Setup-${m.version}.exe`||!Number.isSafeInteger(m.size)||m.size<1||m.size>500*1024*1024||typeof m.sha512!=='string'||Buffer.from(m.sha512,'base64').length!==64||Buffer.from(m.sha512,'base64').toString('base64')!==m.sha512)throw Error('İmzalı paket bilgileri uyuşmuyor.');
 return Object.freeze(m);
}
function matchUpdateInfo(info,m){if(info.version!==m.version||info.packages||!Array.isArray(info.files)||info.files.length!==1)throw Error('Güncelleme listesi imzalı kayıtla uyuşmuyor.');const file=info.files[0];if(file.url!==m.asset||file.sha512!==m.sha512||file.size!==m.size||(info.path&&info.path!==m.asset))throw Error('Paket adresi, boyutu veya özeti imzalı kayıtla uyuşmuyor.');}
async function readReleaseAsset(url,fetcher=fetch){
 let next=url;
 for(let i=0;i<5;i++){
  const u=new URL(next);if(u.protocol!=='https:'||(u.port&&u.port!=='443')||u.username||u.password||!['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(u.hostname))throw Error('Güvenilmeyen güncelleme adresi.');
  const response=await fetcher(u,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'User-Agent':'Ata74-Signed-Updates'}});
  if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');await response.body?.cancel();if(!location)throw Error('Güncelleme yönlendirmesi geçersiz.');next=new URL(location,u).href;continue;}
  if(!response.ok){await response.body?.cancel();throw Error('İmzalı sürüm kaydı indirilemedi (HTTP '+response.status+').');}
  if(Number(response.headers.get('content-length'))>16384){await response.body?.cancel();throw Error('Sürüm kaydı çok büyük.');}
  const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>16384){await response.body.cancel().catch(()=>{});throw Error('Sürüm kaydı boyut sınırını aşıyor.');}chunks.push(chunk);}return Buffer.concat(chunks);
 }
 throw Error('Çok fazla güncelleme yönlendirmesi.');
}
async function loadSignedRelease(version,currentVersion,{publicKey=fs.readFileSync(path.join(__dirname,'update-public-key.pem')),fetchAsset=readReleaseAsset}={}){
 versionParts(version);const base=`https://github.com/Rwin74/Ata74/releases/download/v${version}/`;
 const [bytes,signature]=await Promise.all([fetchAsset(base+'ata74-update.json'),fetchAsset(base+'ata74-update.sig')]);
 return verifyManifest(bytes,signature.toString('utf8'),publicKey,version,currentVersion);
}
async function verifyArtifact(file,m){
 if(typeof file!=='string'||!path.isAbsolute(file)||path.extname(file).toLowerCase()!=='.exe')throw Error('İndirilen kurulum dosyası geçersiz.');
 const stat=await fs.promises.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==m.size)throw Error('Kurulum dosyası türü veya boyutu uyuşmuyor.');
 const hash=crypto.createHash('sha512');for await(const chunk of fs.createReadStream(file))hash.update(chunk);const actual=hash.digest();if(!crypto.timingSafeEqual(actual,Buffer.from(m.sha512,'base64')))throw Error('Kurulum dosyası imzalı özetle uyuşmuyor.');
 return file;
}
module.exports={newer,versionParts,verifyManifest,matchUpdateInfo,readReleaseAsset,loadSignedRelease,verifyArtifact};
