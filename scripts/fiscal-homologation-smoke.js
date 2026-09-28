'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const{createBundledAcbrMonitorRuntime}=require('../desktop/acbr-monitor-runtime.cjs');
const{createAcbrMonitorTcpTransport}=require('../server/fiscal-sidecar/acbr-monitor-protocol');

function required(name){const value=String(process.env[name]||'').trim();if(!value)throw new Error(`${name} obrigatorio para homologacao fiscal real.`);return value;}
function certificateBase64(){const direct=String(process.env.ERP_FISCAL_A1_BASE64||'').trim();if(direct)return direct;const rawPath=String(process.env.ERP_FISCAL_A1_PATH||'').trim();if(!rawPath)throw new Error('ERP_FISCAL_A1_BASE64 ou ERP_FISCAL_A1_PATH obrigatorio para homologacao fiscal real.');const certificatePath=path.resolve(rawPath);if(!fs.existsSync(certificatePath))throw new Error(`Certificado A1 nao encontrado: ${certificatePath}`);return fs.readFileSync(certificatePath).toString('base64');}
async function main(){
 if(process.platform!=='win32')throw new Error('Smoke fiscal ACBr real deve ser executado no Windows, onde o ACBrMonitor embutido e suportado.');
 const root=path.resolve(__dirname,'..'),bundleRoot=path.resolve(process.env.ERP_ACBR_BUNDLE_ROOT||path.join(root,'fiscal-runtime','acbr'));
 const writableRoot=fs.mkdtempSync(path.join(os.tmpdir(),'artisys-acbr-homolog-'));const runtime=createBundledAcbrMonitorRuntime({bundleRoot,writableRoot});
 try{
  await runtime.start();
  await runtime.configureCredentials({pfxBase64:certificateBase64(),password:process.env.ERP_FISCAL_A1_PASSWORD||'',csc:required('ERP_FISCAL_CSC'),cscId:required('ERP_FISCAL_CSC_ID')});
  await runtime.configureFiscal({state:required('ERP_FISCAL_UF'),environment:'homologation'});
  const client=createAcbrMonitorTcpTransport({host:runtime.host,port:runtime.port,timeoutMs:30000});
  const response=await client.send('NFe.StatusServico()');
  const match=String(response).match(/CStat\s*=\s*(\d+)/i),cStat=match?Number(match[1]):null;
  if(cStat!==107&&!/servi[cç]o\s+em\s+opera[cç][aã]o/i.test(String(response)))throw new Error(`SEFAZ homologacao indisponivel ou resposta inesperada: ${String(response).slice(0,500)}`);
  console.log(JSON.stringify({ok:true,provider:'acbr-local',environment:'homologation',uf:required('ERP_FISCAL_UF').toUpperCase(),cStat},null,2));
 }finally{await runtime.stop().catch(()=>{});fs.rmSync(writableRoot,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error?.stack||error);process.exit(1);});
