export type ViewId='dashboard'|'cadastros'|'estoque'|'compras'|'vendas'|'operacao'|'servicos'|'producao'|'financeiro'|'relatorios'|'rastreabilidade'|'administracao'|'inteligencia'|'gestao-avancada'|'configuracoes';
export type NavGroupId='inicio'|'operacao'|'gestao'|'controle'|'sistema';
export type NavItem={id:ViewId;label:string;subtitle:string};
export type NavGroup={id:NavGroupId;label:string;hint:string;defaultOpen:boolean;items:NavItem[]};

export const NAV_GROUPS:NavGroup[]=[
 {id:'inicio',label:'Início',hint:'Visão geral',defaultOpen:true,items:[
  {id:'dashboard',label:'Dashboard',subtitle:'Visão geral do negócio'}
 ]},
 {id:'operacao',label:'Operação',hint:'Rotina da empresa',defaultOpen:true,items:[
  {id:'cadastros',label:'Cadastros',subtitle:'Clientes, fornecedores, categorias e produtos'},
  {id:'estoque',label:'Estoque',subtitle:'Saldos, ajustes, transferências e reservas'},
  {id:'compras',label:'Compras',subtitle:'Solicitações, cotações, aprovações, pedidos e recebimentos'},
  {id:'vendas',label:'Vendas',subtitle:'Orçamentos, pedidos e faturamento administrativo'},
  {id:'operacao',label:'Frente de caixa',subtitle:'Venda rápida, catálogo, devoluções, transferências e importação'},
  {id:'servicos',label:'Serviços',subtitle:'Ordens de serviço, peças, execução e manutenção'}
 ]},
 {id:'gestao',label:'Gestão',hint:'Financeiro e análise',defaultOpen:true,items:[
  {id:'financeiro',label:'Financeiro',subtitle:'Contas, AP/AR, conciliação, recorrências e alertas'},
  {id:'relatorios',label:'Relatórios',subtitle:'Vendas, compras e estoque'}
 ]},
 {id:'controle',label:'Especialistas',hint:'Produção e gestão avançada',defaultOpen:false,items:[
  {id:'producao',label:'Produção',subtitle:'Ordens de produção, consumo, apontamentos e MRP'},
  {id:'rastreabilidade',label:'Rastreabilidade',subtitle:'Origem, custos, margens e lead times por produto'},
  {id:'inteligencia',label:'Inteligência',subtitle:'BI, alertas, preços, workflows, ativos, manutenção e projetos'},
  {id:'gestao-avancada',label:'Gestão avançada',subtitle:'Contabilidade, projetos, CRM, chão de fábrica, logística e patrimônio'}
 ]},
 {id:'sistema',label:'Sistema',hint:'Administração e preferências',defaultOpen:false,items:[
  {id:'administracao',label:'Administração',subtitle:'Empresas, usuários, backups, documentos e integrações'},
  {id:'configuracoes',label:'Configurações',subtitle:'Operação local do produto'}
 ]}
];

export const NAV:NavItem[]=NAV_GROUPS.flatMap(group=>group.items);
export const navGroupFor=(view:ViewId)=>NAV_GROUPS.find(group=>group.items.some(item=>item.id===view));
