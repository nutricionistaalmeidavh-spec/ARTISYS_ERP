'use strict';
window.ErpApi=class ErpApi{
  constructor(baseUrl){this.baseUrl=String(baseUrl||'').replace(/\/$/,'');this.token=sessionStorage.getItem('erp-token')||'';}
  setToken(token){this.token=token||'';if(this.token)sessionStorage.setItem('erp-token',this.token);else sessionStorage.removeItem('erp-token');}
  async request(path,{method='GET',body}={}){const headers={Accept:'application/json'};if(this.token)headers.Authorization=`Bearer ${this.token}`;if(body!==undefined)headers['Content-Type']='application/json';const response=await fetch(`${this.baseUrl}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const text=await response.text();let data=null;try{data=text?JSON.parse(text):null;}catch{data=text;}if(!response.ok)throw new Error(data?.error||`HTTP ${response.status}`);return data;}
  login(email,password){return this.request('/api/v1/auth/login',{method:'POST',body:{email,password}});}
  logout(){return this.request('/api/v1/auth/logout',{method:'POST'}).finally(()=>this.setToken(''));}
};
