import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
const magic=Buffer.from('CTBACKUP1');
const max=128*1024*1024;
// Authenticated envelope; raw keys are supplied by the custodian, never embedded.
// This bounded in-memory primitive is for rehearsals, not a hosted export command.
export function encryptRecovery(bytes,key){
 if(!Buffer.isBuffer(key)||key.length!==32||!Buffer.isBuffer(bytes)||bytes.length>max)throw new Error('Invalid recovery input');
 const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(magic);
 const ciphertext=Buffer.concat([cipher.update(bytes),cipher.final()]);
 return Buffer.concat([magic,nonce,cipher.getAuthTag(),ciphertext]);
}
export function decryptRecovery(envelope,key){
 if(!Buffer.isBuffer(key)||key.length!==32||!Buffer.isBuffer(envelope)||envelope.length<37||envelope.length>max+37||!envelope.subarray(0,9).equals(magic))throw new Error('Invalid recovery envelope');
 try{const decipher=createDecipheriv('aes-256-gcm',key,envelope.subarray(9,21));decipher.setAAD(magic);decipher.setAuthTag(envelope.subarray(21,37));return Buffer.concat([decipher.update(envelope.subarray(37)),decipher.final()]);}catch{throw new Error('Recovery authentication failed');}
}
export function recoveryTargets({backupAt,incidentAt,restoredAt,validated=false}){
 const b=Date.parse(backupAt),i=Date.parse(incidentAt),r=Date.parse(restoredAt);
 if(![b,i,r].every(Number.isFinite)||b>i||i>r)throw new Error('Invalid recovery timestamps');
 return {rpoHours:(i-b)/3600000,rtoHours:(r-i)/3600000,meetsTargets:validated===true&&i-b<=86400000&&r-i<=86400000};
}
