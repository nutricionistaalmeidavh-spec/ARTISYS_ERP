export type AdvancedWorkspaceId='accounting'|'projects'|'crm'|'shop-floor'|'stock-logistics'|'assets';
const ITEMS:Array<{id:AdvancedWorkspaceId;label:string;legacy:string;description:string}>=[
 {id:'accounting',label:'Contabilidade',legacy:'Accounting Core',description:'Plano de contas, lançamentos e demonstrativos'},
 {id:'projects',label:'Projetos',legacy:'Projects 2.0',description:'Custos, horas, receitas e rentabilidade'},
 {id:'crm',label:'CRM',legacy:'CRM',description:'Leads, oportunidades e atividades'},
 {id:'shop-floor',label:'Chão de fábrica',legacy:'Manufacturing Shop Floor',description:'Operações, postos, roteiros e job cards'},
 {id:'stock-logistics',label:'Logística',legacy:'Stock Logistics',description:'Putaway, picking, packing e expedição'},
 {id:'assets',label:'Patrimônio',legacy:'Asset Accounting',description:'Capitalização, depreciação e custódia'}
];
export function WorkspaceNav({value,onChange}:{value:AdvancedWorkspaceId;onChange:(id:AdvancedWorkspaceId)=>void}){return <nav className="advanced-workspace-nav" aria-label="Áreas da gestão avançada">{ITEMS.map(item=><button key={item.id} type="button" data-testid={`advanced-nav-${item.id}`} className={`advanced-nav-item ${value===item.id?'active':''}`} aria-current={value===item.id?'page':undefined} onClick={()=>onChange(item.id)}><span>{item.label}</span><small>{item.legacy}</small><em>{item.description}</em></button>)}</nav>}
