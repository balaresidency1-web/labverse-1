import test from 'node:test';
import assert from 'node:assert/strict';
import { applyHttpSecurity, handleApiError } from './httpSecurity.ts';

function response() {
  return { headers: {} as Record<string,string>, code: 200, body: null as any,
    setHeader(k: string,v: string) {this.headers[k]=v;return this;},
    status(c: number) {this.code=c;return this;}, json(b: any) {this.body=b;return this;} };
}
test('API origin guard blocks foreign origins, allows canonical origins and bearer clients', () => {
  const previous = process.env.APP_URL; process.env.APP_URL='https://labverse.example';
  try {
    for(const [origin, allowed] of [['https://evil.example',false],['https://labverse.example',true],[undefined,true]] as const) {
      const res=response();let continued=false;
      applyHttpSecurity({path:'/api/admin/invite-user', method:'POST',headers:{origin}} as any,res as any,()=>{continued=true;});
      assert.equal(continued,allowed);assert.equal(res.headers['Cache-Control'],'no-store');
      if(!allowed) assert.equal(res.code,403);
    }
  } finally { if(previous===undefined) delete process.env.APP_URL; else process.env.APP_URL=previous; }
});
test('API parser errors never reflect request contents or stack traces', () => {
  for (const [type,code] of [['entity.too.large',413],['entity.parse.failed',400],['other',500]] as const) {
    const res=response();handleApiError({type,message:'SECRET INTERNAL DETAIL'},{} as any,res as any,()=>{});
    assert.equal(res.code,code);assert.ok(!JSON.stringify(res.body).includes('SECRET'));
  }
});
