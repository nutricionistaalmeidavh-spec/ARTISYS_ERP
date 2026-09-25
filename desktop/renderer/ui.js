'use strict';
(()=>{
  const modalRoot=document.getElementById('modal-root');
  const toastRoot=document.getElementById('toast-root');
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
  window.ErpUi={openModal,closeModal,confirm:customConfirm,toast,setBusy,escapeHtml};
})();
