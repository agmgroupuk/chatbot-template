import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createInterface} from 'node:readline';
const cli=process.platform==='win32'?join(process.env.APPDATA,'npm/node_modules/@railway/cli/bin/railway.exe'):'railway';
const flags=['--project','3c67a3e5-8d96-462c-8ed1-9c2c64a4949f','--service','4c84fc8a-e259-4a50-9de3-6be2e88a8911','--environment','production'];
const status=JSON.parse(execFileSync(cli,['status','--json'],{encoding:'utf8'}));if(status.id!=='3c67a3e5-8d96-462c-8ed1-9c2c64a4949f')throw new Error('Wrong project.');
const variables=JSON.parse(execFileSync(cli,['variables','--service',flags[3],'--environment','production','--json'],{encoding:'utf8'}));
if(variables.NEXT_PUBLIC_SITE_URL!=='https://onefinsolution.online')throw new Error('Wrong site.');
let secret;
if(process.argv.includes('--stdin-webhook')){if(process.stdin.isTTY)process.stdin.setRawMode(true);const input=createInterface({input:process.stdin,terminal:false});secret=await new Promise(resolve=>input.once('line',resolve));input.close();if(!/^whsec_[a-zA-Z0-9]+$/.test(secret))throw new Error('Invalid signing secret.');}
const changes={STRIPE_EXPECTED_ACCOUNT_ID:'acct_1UOhth9TlJVLQeem',...(!variables.WORKSPACE_SIGNING_KEY?{WORKSPACE_SIGNING_KEY:randomBytes(32).toString('hex')}:{ }),...(secret?{STRIPE_WEBHOOK_SECRET:secret}:{})};
for(const [name,value]of Object.entries(changes))execFileSync(cli,['variables','set',name,'--stdin','--skip-deploys',...flags],{input:value,stdio:['pipe','pipe','pipe']});
console.log(`Configured names only: ${Object.keys(changes).join(', ')}. No keys printed or saved to files.`);
process.exit(0);
