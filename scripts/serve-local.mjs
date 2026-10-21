import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/__test/link' && process.env.CARETEXT_BROWSER_FIXTURE==='1'){
      const fixture=JSON.parse(await readFile('test-results/browser-fixture.json','utf8'));
      const destination=new URL(fixture.link);
      if(destination.origin!=='https://ixpniaronwgjimqyeowq.supabase.co')throw new Error('Invalid fixture');
      res.writeHead(302,{Location:destination.href,'Cache-Control':'no-store'}).end();return;
    }
    const route=['/privacy','/terms','/invite'].includes(pathname.replace(/\/$/,'')) ? pathname.replace(/\/$/,'')+'/index.html' : pathname;
    const path=resolve(root,'.'+(route==='/'?'/index.html':route));
    if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}
    const body=await readFile(path);
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store'}).end(body);
  }catch{res.writeHead(404).end('Not found');}
}).listen(4173,'127.0.0.1',()=>console.log('CareText local-only preview: http://localhost:4173/account.html'));
