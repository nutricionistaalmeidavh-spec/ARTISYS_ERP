function stableBody(value:unknown):unknown{if(Array.isArray(value))return value.map(stableBody);if(value&&typeof value==='object'){return Object.fromEntries(Object.entries(value as Record<string,unknown>).filter(([key])=>key!=='idempotencyKey').sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,stableBody(item)]));}return value;}
function requestKey(method:string,path:string,body:unknown){return`${method} ${path} ${body===undefined?'':JSON.stringify(stableBody(body))}`;}

export class ErpApi{
 baseUrl:string;token:string;private inFlight=new Map<string,Promise<unknown>>();
 constructor(baseUrl:string){this.baseUrl=String(baseUrl||'').replace(/\/$/,'');this.token=sessionStorage.getItem('erp-token')||'';}
 setToken(token:string){this.token=token||'';if(this.token)sessionStorage.setItem('erp-token',this.token);else sessionStorage.removeItem('erp-token');}
 async request<T=unknown>(path:string,{method='GET',body}:{method?:string;body?:unknown}={}):Promise<T>{
  const verb=String(method||'GET').toUpperCase(),key=requestKey(verb,path,body);
  const current=this.inFlight.get(key);if(current)return current as Promise<T>;
  const execute=async()=>{const headers:Record<string,string>={Accept:'application/json'};if(this.token)headers.Authorization=`Bearer ${this.token}`;if(body!==undefined)headers['Content-Type']='application/json';const response=await fetch(`${this.baseUrl}${path}`,{method:verb,headers,body:body===undefined?undefined:JSON.stringify(body)});const text=await response.text();let data:unknown=null;try{data=text?JSON.parse(text):null;}catch{data=text;}if(!response.ok)throw new Error(typeof data==='object'&&data&&'error'in data?String((data as {error:unknown}).error):`HTTP ${response.status}`);return data as T;};
  const promise=execute();this.inFlight.set(key,promise);
  try{return await promise;}finally{if(this.inFlight.get(key)===promise)this.inFlight.delete(key);}
 }
 login(username:string,password:string){return this.request<{token:string;user:{name:string;role:string}}>('/api/v1/auth/login',{method:'POST',body:{username,password}});}
 logout(){return this.request('/api/v1/auth/logout',{method:'POST'}).finally(()=>this.setToken(''));}
}
