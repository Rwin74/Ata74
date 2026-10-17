'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');const root=path.join(__dirname,'..');
function git(args){const r=cp.spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true});if(r.status!==0)throw Error('Git işlemi başarısız: '+args[0]);return r.stdout.trim();}
async function main(){
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')),tag='v'+pkg.version,base='https://api.github.com/repos/Rwin74/Ata74';
 if(git(['status','--porcelain','--untracked-files=no']))throw Error('Önce kaynak değişikliklerini commit edip GitHub’a gönderin.');
 const commit=git(['rev-parse','HEAD']),remote=git(['ls-remote','origin','refs/heads/main']).split(/\s+/)[0];if(commit!==remote)throw Error('Yerel commit GitHub main ile aynı değil. Önce push yapın.');
 let token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN;
 if(!token){const r=cp.spawnSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',windowsHide:true,cwd:root});const values=Object.fromEntries(r.stdout.split(/\r?\n/).filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)]}));token=values.password;}
 if(!token)throw Error('GitHub oturumu yok. GitHub hesabınızı Git Credential Manager ile bağlayın.');
 const headers={Authorization:'Bearer '+token,'User-Agent':'Ata74-release','Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
 async function api(url,options={}){const response=await fetch(url,{...options,headers:{...headers,...options.headers}});if(!response.ok)throw Error('GitHub HTTP '+response.status+' '+(await response.text()).slice(0,200));return response.status===204?null:response.json();}
 const releases=await api(base+'/releases?per_page=100');let release=releases.find(r=>r.tag_name===tag);if(release&&!release.draft)throw Error('Bu sürüm zaten yayınlanmış. Dosyaları değiştirmek yerine sürüm numarasını artırın.');
 if(!process.argv.includes('--skip-build')){const result=cp.spawnSync(process.platform==='win32'?(process.env.ComSpec||'cmd.exe'):'npm',process.platform==='win32'?['/d','/s','/c','npm run build']:['run','build'],{cwd:root,stdio:'inherit',windowsHide:true});if(result.status!==0)throw Error('Derleme veya imzalama başarısız. Yayın yapılmadı.');}
 const asar=require('@electron/asar'),resources=path.join(root,'dist-update/win-unpacked/resources');
 for(const name of pkg.build.files){if(name==='package.json')continue;if(!asar.extractFile(path.join(resources,'app.asar'),name).equals(fs.readFileSync(path.join(root,name))))throw Error('Paket güncel kaynakla uyuşmuyor: '+name);}
 for(const name of ['storage-worker.js','duplicate-worker.js','system-scripts/system.ps1','system-scripts/startup.ps1'])if(!fs.readFileSync(path.join(resources,name)).equals(fs.readFileSync(path.join(root,name))))throw Error('Paket kaynağı uyuşmuyor: '+name);
 const sign=cp.spawnSync(process.execPath,[path.join(__dirname,'sign-release.cjs')],{cwd:root,stdio:'inherit',windowsHide:true});if(sign.status!==0)throw Error('İmza üretilemedi. Yayın yapılmadı.');
 const files=[`Ata74-Setup-${pkg.version}.exe`,`Ata74-Setup-${pkg.version}.exe.blockmap`,'latest.yml','ata74-update.json','ata74-update.sig'];
 const notes=fs.readFileSync(path.join(root,'RELEASE-NOTES.md'),'utf8');
 if(!release)release=await api(base+'/releases',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tag_name:tag,target_commitish:commit,name:'Ata74 '+pkg.version,body:notes,draft:true,prerelease:false})});
 const tagInfo=await api(base+'/git/ref/tags/'+tag);let tagCommit=tagInfo.object.sha;if(tagInfo.object.type==='tag')tagCommit=(await api(base+'/git/tags/'+tagCommit)).object.sha;if(tagCommit!==commit)throw Error('Sürüm etiketi yayınlanan kaynak commit’i ile uyuşmuyor.');
 for(const name of files){const bytes=fs.readFileSync(path.join(root,'dist-update',name)),hash='sha256:'+crypto.createHash('sha256').update(bytes).digest('hex'),existing=release.assets.find(a=>a.name===name);if(existing){if(existing.digest!==hash)throw Error('Taslakta aynı adlı farklı dosya var: '+name);continue;}
  const asset=await api(release.upload_url.split('{')[0]+'?name='+encodeURIComponent(name),{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:bytes});if(asset.digest&&asset.digest!==hash)throw Error('Yüklenen dosya özeti uyuşmuyor.');console.log('Yüklendi: '+name);
 }
 const published=await api(base+'/releases/'+release.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({draft:false,make_latest:'true',body:notes})});console.log('Yayınlandı: '+published.html_url);
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
