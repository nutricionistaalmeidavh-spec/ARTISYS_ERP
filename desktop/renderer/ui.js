'use strict';
(()=>{
  const modalRoot=document.getElementById('modal-root');
  const toastRoot=document.getElementById('toast-root');
  const STATUS={DRAFT:'Rascunho',OPEN:'Em aberto',PARTIAL:'Parcial',SETTLED:'Quitado',CANCELLED:'Cancelado',ACTIVE:'Ativo',INACTIVE:'Inativo',PAUSED:'Pausado',UNMATCHED:'Não conciliado',MATCHED:'Conciliado',ACCEPTED:'Aceito',APPROVED:'Aprovado',PENDING:'Pendente',SUBMITTED:'Enviado',SENT:'Enviado',QUOTING:'Em cotação',ORDERED:'Pedido gerado',RECEIVED:'Recebido',EXCESS:'Com excedente',SUPERSEDED:'Substituído',INVALIDATED:'Invalidado',INVOICE_PARTIAL:'Faturado parcialmente',INVOICED:'Faturado',PAYABLE:'A pagar',RECEIVABLE:'A receber',BANK:'Banco',CARD:'Cartão',CASH:'Caixa',OTHER:'Outro',EXPENSE:'Despesa',INCOME:'Receita',ADMIN:'Administrador',MANAGER:'Gerente',DIRECTOR:'Diretor',OPERATOR:'Operador',LOW:'Baixa',MEDIUM:'Média',HIGH:'Alta',CRITICAL:'Crítica',INFO:'Informativo',WARNING:'Atenção',ERROR:'Erro'};
  function closeModal(){modalRoot.replaceChildren();modalRoot.hidden=true;}
  function openModal({title,content,actions=[]}={}){
    closeModal();modalRoot.hidden=false;
    const backdrop=document.createElement('div');backdrop.className='modal-backdrop';
    const modal=document.createElement('section');modal.className='modal-card';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
    const head=document.createElement('header');head.className='modal-header';const h=document.createElement('h3');h.textContent=title||'';head.append(h);modal.append(head);
    const body=document.createElement('div');body.className='modal-body';if(typeof content==='string')body.innerHTML=content;else if(content)body.append(content);modal.append(body);
    const foot=document.createElement('footer');foot.className='modal-actions';
    for(const action of actions){const button=document.createElement('button');button.type='button';button.textContent=action.label||'OK';button.className=action.danger?'danger':(action.primary?'primary':'secondary-action');if(action.testId)button.dataset.testid=action.testId;button.addEventListener('click',()=>action.onClick?.({modal,body,button,close:closeModal}));foot.append(button);}modal.append(foot);backdrop.append(modal);modalRoot.append(backdrop);return{modal,body,close:closeModal};
  }
  function customConfirm({title='Confirmar',message='',confirmLabel='Confirmar',danger=false}={}){return new Promise(resolve=>{openModal({title,content:`<p>${escapeHtml(message)}</p>`,actions:[{label:'Cancelar',testId:'confirm-cancel',onClick:()=>{closeModal();resolve(false);}},{label:confirmLabel,primary:!danger,danger,testId:'confirm-accept',onClick:()=>{closeModal();resolve(true);}}]});});}
  function toast(message,{type='success'}={}){const item=document.createElement('div');item.className=`toast ${type}`;item.textContent=String(message||'');toastRoot.append(item);setTimeout(()=>item.remove(),3500);return item;}
  function setBusy(element,busy){if(!element)return;element.toggleAttribute('disabled',Boolean(busy));element.setAttribute('aria-busy',busy?'true':'false');}
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function statusLabel(value){const key=String(value??'').toUpperCase();return STATUS[key]||String(value??'');}
  function loading(label='Carregando…'){return `<div class="state-card" role="status">${escapeHtml(label)}</div>`;}
  function empty(label='Nenhum registro encontrado.'){return `<div class="state-card empty">${escapeHtml(label)}</div>`;}
  function errorState(message){return `<div class="state-card error" role="alert">${escapeHtml(message||'Não foi possível carregar os dados.')}</div>`;}
  window.ErpUi={openModal,closeModal,confirm:customConfirm,toast,setBusy,escapeHtml,statusLabel,loading,empty,errorState};
})();
