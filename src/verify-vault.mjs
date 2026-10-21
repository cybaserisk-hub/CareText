import {generateKeyPairSync,privateDecrypt,constants} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
export const vaultPath=()=>join(process.env.LOCALAPPDATA,'CareText','verify-controlled-test');
function powershell(command,input){
 const r=spawnSync('pwsh.exe',['-NoProfile','-NonInteractive','-Command',command],{input,encoding:'utf8',windowsHide:true});
 if(r.status!==0)throw new Error('Windows credential vault unavailable');
 return r.stdout.trim();
}
export function initializeVault(){
 if(process.platform!=='win32')throw new Error('Windows DPAPI required');
 const root=vaultPath();mkdirSync(root,{recursive:true});
 // Remove inherited access and grant only this Windows user and SYSTEM.
 const r=spawnSync('icacls.exe',[root,'/inheritance:r','/grant:r',`${process.env.USERDOMAIN}\\${process.env.USERNAME}:(OI)(CI)F`,'SYSTEM:(OI)(CI)F'],{windowsHide:true});
 if(r.status!==0)throw new Error('Could not restrict vault access');
 if(existsSync(join(root,'private.dpapi')))return root;
 const pair=generateKeyPairSync('rsa',{modulusLength:4096,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
 const encrypted=powershell("$s=[Console]::In.ReadToEnd(); ConvertFrom-SecureString (ConvertTo-SecureString $s -AsPlainText -Force)",pair.privateKey);
 writeFileSync(join(root,'private.dpapi'),encrypted,{flag:'wx'});
 writeFileSync(join(root,'public.pem'),pair.publicKey,{flag:'wx'});
 return root;
}
export function readVault(){
 const root=vaultPath();
 const pem=powershell("$s=ConvertTo-SecureString ([Console]::In.ReadToEnd()); $p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($p))} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}",readFileSync(join(root,'private.dpapi'),'utf8'));
 return JSON.parse(privateDecrypt({key:pem,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},readFileSync(join(root,'credentials.enc'))).toString('utf8'));
}
