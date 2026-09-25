'use strict';
(async()=>{
  const baseUrl=await window.erpDesktop.getBaseUrl();const api=new window.ErpApi(baseUrl);
  const login=document.getElementById('login'),app=document.getElementById('app'),content=document.getElementById('content'),title=document.getElementById('view-title'),subtitle=document.getElementById('view-subtitle'),badge=document.getElementById('user-badge');
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((Number(v)||0)/100);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const panel=(name,body)=>`<div class="panel"><h3>${esc(name)}</h3>${body}</div>`;const metric=(name,value)=>`<div class="metric"><span>${esc(name)}</span><strong>${esc(value)}</strong></div>`;
  async function safe(path){try{return await api.request(path);}catch(error){return{__error:error.message};}}
  async function render(view){document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));content.innerHTML='<div class="panel">Carregando…</div>';
    if(view==='dashboard'){title.textContent='Dashboard';subtitle.textContent='Visão geral do negócio';const d=await safe('/api/v1/finance/dashboard');if(d.__error){content.innerHTML=panel('Dashboard',`<div class="notice">${esc(d.__error)}</div>`);return;}content.innerHTML=`<div data-testid="view-dashboard"><div class="grid">${metric('A receber',money(d.receivablesOpenCents??d.receivableOpenCents))}${metric('A pagar',money(d.payablesOpenCents??d.payableOpenCents))}${metric('Caixa realizado',money(d.cashNetCents??d.netCashCents))}${metric('Resultado',money(d.resultCents??d.netResultCents))}</div></div>`;return;}
    if(view==='cadastros'){title.textContent='Cadastros';subtitle.textContent='Clientes, fornecedores, categorias e produtos';await window.ErpViews.cadastros({api,root:content});return;}
    if(view==='estoque'){title.textContent='Estoque';subtitle.textContent='Saldos, ajustes, transferências e reservas';await window.ErpViews.estoque({api,root:content});return;}
    if(view==='compras'){title.textContent='Compras';subtitle.textContent='Solicitações, cotações, aprovações, pedidos e recebimentos';await window.ErpViews.compras({api,root:content});return;}
    if(view==='vendas'){title.textContent='Vendas';subtitle.textContent='Orçamentos, pedidos e faturamento administrativo';await window.ErpViews.vendas({api,root:content});return;}
    if(view==='financeiro'){title.textContent='Financeiro';subtitle.textContent='Contas, AP/AR, conciliação, recorrências e alertas';await window.ErpViews.financeiro({api,root:content});return;}
    if(view==='relatorios'){title.textContent='Relatórios';subtitle.textContent='Vendas, compras e estoque';const [s,p,i]=await Promise.all([safe('/api/v1/reports/sales'),safe('/api/v1/reports/purchases'),safe('/api/v1/reports/inventory')]);content.innerHTML=panel('Vendas',`<pre>${esc(JSON.stringify(s,null,2))}</pre>`)+panel('Compras',`<pre>${esc(JSON.stringify(p,null,2))}</pre>`)+panel('Estoque',`<pre>${esc(JSON.stringify(i,null,2))}</pre>`);return;}
    title.textContent='Configurações';subtitle.textContent='Operação local do produto';const health=await safe('/api/v1/health');content.innerHTML=panel('Sistema',`<div class="grid">${metric('Produto','ArtiSys ERP')}${metric('Servidor',health.ok?'Online':'Indisponível')}${metric('Modo','Local-first')}${metric('Base local',baseUrl)}</div>`);
  }
  document.getElementById('login-form').addEventListener('submit',async event=>{event.preventDefault();const error=document.getElementById('login-error');error.textContent='';try{const data=await api.login(document.getElementById('username').value,document.getElementById('password').value);api.setToken(data.token);badge.textContent=`${data.user.name} · ${data.user.role}`;login.hidden=true;app.hidden=false;await render('dashboard');}catch(e){error.textContent=e.message;}});
  document.getElementById('nav').addEventListener('click',event=>{const button=event.target.closest('button[data-view]');if(button)render(button.dataset.view);});
  document.getElementById('logout').addEventListener('click',async()=>{try{await api.logout();}catch{}app.hidden=true;login.hidden=false;content.innerHTML='';});
  try{const health=await api.request('/api/v1/health');document.getElementById('server-status').textContent=health.ok?'Local · online':'Local';}catch{document.getElementById('server-status').textContent='Local · offline';}
})();
