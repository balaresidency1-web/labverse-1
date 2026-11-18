import test from 'node:test';
import assert from 'node:assert/strict';
import { processAdminInviteRequest } from './adminInviteHandler.ts';
const body={email:'assistant@example.edu',name:'Demo Assistant',identifier:'STAFF01'};
const deps={adminClient:null,anonClient:null,supabaseEnvConfigured:false};
test('invitation rejects unexpected types, whitespace, control characters and oversized fields',async()=>{
  for(const changes of [{name:{}},{name:' '},{name:'x'.repeat(121)},{email:'x\n@example.edu'},{assignedLabIds:[null]},{assignedLabIds:Array(101).fill('lab')}]) {
    assert.equal((await processAdminInviteRequest({body:{...body,...changes},deps})).statusCode,400);
  }
});
test('shared invitation limiter fails closed and does not send email',async()=>{
  for(const limitResult of [{data:false,error:null},{data:null,error:{message:'private detail'}}]) {
    let sent=false;
    const client:any={
      auth:{getUser:async()=>({data:{user:{id:'admin'}}}),admin:{inviteUserByEmail:async()=>{sent=true;throw Error('must not send');}}},
      rpc:async()=>limitResult,
      from:(table:string)=>{const chain:any={select:()=>chain,eq:()=>chain,ilike:()=>chain,single:async()=>({data:table==='profiles'?{role:'college_admin',status:'active',institution_id:'inst'}:{id:'inst',code:'MVIT',active:true}})};return chain;}
    };
    const result=await processAdminInviteRequest({authHeader:'Bearer token',body,deps:{adminClient:client,anonClient:{},supabaseEnvConfigured:true}});
    assert.equal(result.statusCode,limitResult.error?503:429);assert.equal(sent,false);
  }
});
