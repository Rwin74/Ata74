const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const input = process.argv[2] || '';
const match = input.match(/^(?:https:\/\/github\.com\/)?([a-zA-Z0-9-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?\/?$/);
if (!match) { console.error('Kullanim: npm run configure:github -- kullanici/depo'); process.exit(1); }
const pkgPath = path.join(root,'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath,'utf8'));
pkg.build.publish = [{ provider:'github', owner:match[1], repo:match[2], releaseType:'release' }];
pkg.repository = {type:'git',url:`https://github.com/${match[1]}/${match[2]}.git`};
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+'\n');
console.log('GitHub guncelleme deposu: '+match[1]+'/'+match[2]);

fs.writeFileSync(path.join(root,'update-config.json'),JSON.stringify({owner:match[1],repo:match[2]},null,2));
