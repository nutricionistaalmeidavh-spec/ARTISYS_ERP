import{useEffect,useState,type ReactNode}from'react';
import type{ErpApi}from'../../services/api';
import{ActionDialog}from'../advanced/ActionDialog';
import{FormField}from'../advanced/FormField';

type Product={id:string;name:string;sku?:string;barcode?:string|null};
type Customer={id:string;name:string;cpfCnpj?:string|null;document?:string|null};
type Location={id:string;name:string;type?:string};

type CommonSelectProps={
 api:ErpApi;
 name:string;
 label:string;
 testId?:string;
 required?:boolean;
 defaultValue?:string;
 emptyLabel?:string;
 hint?:string;
};

const normalizeList=<T,>(value:any):T[]=>Array.isArray(value)?value:Array.isArray(value?.items)?value.items:[];

function useOptions<T>(api:ErpApi,path:string){
 const[items,setItems]=useState<T[]>([]);
 const[loading,setLoading]=useState(true);
 const[error,setError]=useState('');
 useEffect(()=>{let active=true;setLoading(true);setError('');api.request<any>(path).then(value=>{if(active)setItems(normalizeList<T>(value))}).catch(e=>{if(active)setError(e instanceof Error?e.message:String(e))}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[api,path]);
 return{items,loading,error};
}

export function moneyInputToCents(value:FormDataEntryValue|string|number|null|undefined){
 const raw=String(value??'').trim().replace(/^R\$\s*/i,'').replace(/\s/g,'');
 if(!raw)return 0;
 const normalized=raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw;
 const amount=Number(normalized);
 if(!Number.isFinite(amount))throw new Error('Informe um valor monetário válido.');
 return Math.round(amount*100);
}

export function MoneyField({label,name,testId,defaultValue='0,00',required=false,hint}:{label:string;name:string;testId?:string;defaultValue?:string;required?:boolean;hint?:string}){
 return <FormField label={label} hint={hint}><div className="money-field"><span aria-hidden="true">R$</span><input data-testid={testId} name={name} defaultValue={defaultValue} inputMode="decimal" placeholder="0,00" required={required}/></div></FormField>;
}

export function StockQuantityField({label='Quantidade',name,testId,defaultValue='',required=false,hint}:{label?:string;name:string;testId?:string;defaultValue?:string;required?:boolean;hint?:string}){
 return <FormField label={label} hint={hint}><input data-testid={testId} name={name} type="number" min="0.001" step="0.001" defaultValue={defaultValue} required={required}/></FormField>;
}

export function ProductSelect({api,name,label,testId,required=false,defaultValue='',emptyLabel='Selecione um produto',hint}:CommonSelectProps){
 const{items,loading,error}=useOptions<Product>(api,'/api/v1/products');const[value,setValue]=useState(defaultValue);
 return <FormField label={label} hint={error?`Não foi possível carregar produtos: ${error}`:hint}><select className="operational-entity-select" data-testid={testId} name={name} value={value} onChange={e=>setValue(e.target.value)} required={required}><option value="">{loading?'Carregando produtos…':emptyLabel}</option>{items.map(item=><option key={item.id} value={item.id}>{item.name}{item.sku?` · ${item.sku}`:''}</option>)}</select></FormField>;
}

export function CustomerSelect({api,name,label,testId,required=false,defaultValue='',emptyLabel='Selecione um cliente',hint}:CommonSelectProps){
 const{items,loading,error}=useOptions<Customer>(api,'/api/v1/customers');const[value,setValue]=useState(defaultValue);
 return <FormField label={label} hint={error?`Não foi possível carregar clientes: ${error}`:hint}><select className="operational-entity-select" data-testid={testId} name={name} value={value} onChange={e=>setValue(e.target.value)} required={required}><option value="">{loading?'Carregando clientes…':emptyLabel}</option>{items.map(item=><option key={item.id} value={item.id}>{item.name}{(item.cpfCnpj||item.document)?` · ${item.cpfCnpj||item.document}`:''}</option>)}</select></FormField>;
}

export function StockLocationSelect({api,name,label,testId,required=false,defaultValue='',emptyLabel='Selecione um local',hint}:CommonSelectProps){
 const{items,loading,error}=useOptions<Location>(api,'/api/v1/inventory/locations?includeInactive=false');const[value,setValue]=useState(defaultValue);
 return <FormField label={label} hint={error?`Não foi possível carregar locais: ${error}`:hint}><select className="operational-entity-select" data-testid={testId} name={name} value={value} onChange={e=>setValue(e.target.value)} required={required}><option value="">{loading?'Carregando locais…':emptyLabel}</option>{items.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></FormField>;
}

export function ConfirmActionButton({label,title,description,impact,confirmLabel='Confirmar',tone='danger',onConfirm,testId}:{label:string;title:string;description?:string;impact:ReactNode;confirmLabel?:string;tone?:'danger'|'primary';onConfirm:()=>void|Promise<void>;testId?:string}){
 const[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const confirm=async()=>{setBusy(true);setError('');try{await onConfirm();setOpen(false)}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}};
 return <><button type="button" data-testid={testId} className={tone==='danger'?'danger':'primary'} onClick={()=>setOpen(true)}>{label}</button><ActionDialog open={open} title={title} description={description} onClose={()=>!busy&&setOpen(false)} footer={<><button type="button" onClick={()=>setOpen(false)} disabled={busy}>Voltar</button><button type="button" className={tone==='danger'?'danger':'primary'} disabled={busy} onClick={confirm}>{busy?'Processando…':confirmLabel}</button></>}><div className="confirm-impact">{impact}</div>{error&&<p className="form-error" role="alert">{error}</p>}</ActionDialog></>;
}
