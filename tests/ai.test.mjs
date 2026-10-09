import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
function provider(env,create) {
 class APIError extends Error {constructor(status){super('provider secret details');this.status=status;}}
 class SDK {static APIError=APIError;constructor(options){this.options=options;this.responses={create:body=>create(options,body,'responses')};this.chat={completions:{create:body=>create(options,body,'chat')}};}}
 const exports={}; const {outputText}=ts.transpileModule(readFileSync(new URL('../lib/ai.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}});
 runInNewContext(outputText,{exports,require:name=>name==='openai'?SDK:{},process:{env}});return {api:exports,APIError};
}
test('OpenAI uses Responses without storage and xAI uses the configured compatible endpoint',async()=>{
 let called=0;
 const openai=provider({AI_PROVIDER:'openai',OPENAI_API_KEY:'unit-fixture',OPENAI_MODEL:'gpt-4.1-mini'},async(options,body,kind)=>{
  called++;assert.equal(kind,'responses');assert.equal(options.baseURL,'https://api.openai.com/v1');assert.equal(body.store,false);assert.equal(body.model,'gpt-4.1-mini');assert.equal(body.input[0].role,'user');return {output_text:'OpenAI fixture response'};
 });
 assert.equal(await openai.api.generateResponse([{sender:'user',content:'Hi'}]),'OpenAI fixture response');
 const xai=provider({AI_PROVIDER:'xai',XAI_API_KEY:'unit-fixture',XAI_MODEL:'grok-4.3'},async(options,body,kind)=>{
  called++;assert.equal(kind,'chat');assert.equal(options.baseURL,'https://api.x.ai/v1');assert.equal(body.model,'grok-4.3');return {choices:[{message:{content:'xAI fixture response'}}]};
 });
 assert.equal(await xai.api.generateResponse([{sender:'user',content:'Hi'}]),'xAI fixture response');assert.equal(called,2);
});
test('missing credentials and rate limits fail safely without leaking provider error details',async()=>{
 const missing=provider({},()=>{throw new Error('must not call');});
 await assert.rejects(missing.api.generateResponse([{sender:'user',content:'Hi'}]),/not configured/);
 let error;const limited=provider({OPENAI_API_KEY:'unit-fixture'},()=>{throw error;});error=new limited.APIError(429);
 await assert.rejects(limited.api.generateResponse([{sender:'user',content:'Hi'}]),/service is busy/);
});
