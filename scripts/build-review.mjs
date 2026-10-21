import {readFile,mkdir,writeFile,copyFile,rm} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';
export async function buildReview(output='review-dist'){
 const root=resolve(output),expected=resolve('review-dist');
 if(root!==expected)throw new Error('Review output must be the fixed workspace review-dist directory');
 const scope=JSON.parse(await readFile('deployment/review-scope.json','utf8'));
 if(scope.publicDeploymentApproved!==false||scope.approvedConsentEndpoints.length)throw new Error('Endpoint/publication scope requires separate reviewed implementation');
 await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:200});await mkdir(root,{recursive:true});
 for(const [route,file] of Object.entries(scope.routes)){
  const source=resolve('site',file),dest=resolve(root,file);
  if(!source.startsWith(resolve('site')+sep)||!dest.startsWith(root+sep)||!route.startsWith('/'))throw new Error('Invalid allowlist');
  await mkdir(dirname(dest),{recursive:true});await copyFile(source,dest);
 }
 await writeFile(resolve(root,'404.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><title>CareText</title><p>This page is not available.</p></html>');
 // Exact static allowlist first; forced fallback denies every unlisted URL, including API/function aliases.
 await writeFile(resolve(root,'_redirects'),Object.entries(scope.routes).map(([route,file])=>`${route} /${file} 200!`).join('\n')+'\n/* /404.html 404!\n');
 await writeFile(resolve(root,'_headers'),`/*
  Content-Security-Policy: default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Cache-Control: no-store
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  X-Robots-Tag: noindex, nofollow
`);
 return scope;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve('scripts/build-review.mjs'))await buildReview();
