// =================================================================
// CONFIGURAÇÃO GOOGLE DRIVE API
// =================================================================
const CLIENT_ID = '748610201197-f31mfm8urml5b3ttsfcjuno3rhsrojfl.apps.googleusercontent.com'; // SEU ID DE CLIENTE
const API_KEY = 'AIzaSyCksEZCtHi5Mm5ud68HpCYvrP1vu3SOPes'; // SUA CHAVE DE API REAL
const SCOPES = 'https://www.googleapis.com/auth/drive.file'; 
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]; 

let tokenClient;
let accessToken = null; 

function gapiLoaded() {
  gapi.load('client', initializeGapiClient);
}

// 🛑 CORREÇÃO CRÍTICA AQUI: Carregamento explícito da API Drive para busca e evitar travamento
async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: DISCOVERY_DOCS,
  });
  
  try {
    // Carregamento explícito do módulo Drive para permitir a busca (list) e o PATCH
    await gapi.client.load('drive', 'v3'); 
    console.log("Google Drive API v3 carregada com sucesso.");
  } catch (error) {
    console.error("Falha ao carregar Google Drive API:", error);
  }
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (tokenResponse) => {
        if (tokenResponse.error) {
            console.error("Erro na autorização:", tokenResponse.error);
            alert("Erro ao autorizar o Google Drive. Detalhe: " + tokenResponse.error);
        } else {
            accessToken = tokenResponse.access_token; 
            document.getElementById('btn-sync').innerText = 'Sincronizar (Drive)';
            uploadToDrive();
        }
    },
  });
}

// Função auxiliar para converter ArrayBuffer para Base64 (foto no JSON)
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}


// FUNÇÃO PARA BUSCAR O ARQUIVO EXISTENTE (Necessário para sobrescrever)
async function searchExistingFile() {
    if (!gapi.client.drive) {
        console.warn('Google Drive API não carregada. Tentando o upload/criação padrão.');
        return null;
    }
    try {
        const response = await gapi.client.drive.files.list({
            'q': "name='brauna_obras_backup.json' and trashed=false",
            'spaces': 'drive',
            'fields': 'files(id)', 
            'pageSize': 1
        });
        const files = response.result.files;
        return files.length > 0 ? files[0].id : null;
    } catch (e) {
        console.error('Erro ao buscar arquivo existente (API call fail):', e);
        return null;
    }
}


function handleAuthClick() {
  if (!tokenClient || !gapi.client) {
    alert("Aguarde o carregamento das bibliotecas do Google (gapi/gis).");
    return;
  }
  
  if (accessToken) {
     uploadToDrive(); 
  } else {
     tokenClient.requestAccessToken();
  }
}

// FUNÇÃO PRINCIPAL DE BACKUP/UPLOAD (Agora usa POST ou PATCH)
async function uploadToDrive() {
  if (!accessToken) {
    alert("Token de acesso não disponível. Tente sincronizar novamente.");
    handleAuthClick(); 
    return;
  }
  
  // Prepara os dados (incluindo conversão Base64)
  const localData = {
      checklist: await getAll('checklist'), 
      photos: await getAll('photos'),
      lastSync: new Date().toISOString()
  };

  // Conversão de ArrayBuffer para Base64 (Necessário para serializar)
  if (localData.photos && localData.photos.length > 0) {
      localData.photos = localData.photos.map(p => {
          if (p.blob instanceof ArrayBuffer) { 
              const base64Data = arrayBufferToBase64(p.blob);
              return { 
                  id: p.id, name: p.name, mime: p.mime, date: p.date, itemId: p.itemId, 
                  base64Data: base64Data 
              };
          }
          return p;
      });
  }

  const content = JSON.stringify(localData);

  const fileMetadata = {
    'name': 'brauna_obras_backup.json',
    'mimeType': 'application/json',
    'parents': ['root'] // Salvando na pasta raiz (Meu Drive)
  };
  
  // LÓGICA DE SUBSTITUIÇÃO (POST/PATCH) 
  const existingFileId = await searchExistingFile(); 
  
  let method = 'POST'; // Padrão: Criar novo arquivo
  let path = '/upload/drive/v3/files';
  let params = { 'uploadType': 'multipart' };
  
  if (existingFileId) {
      // Se o arquivo existe, muda para PATCH (Atualizar)
      method = 'PATCH'; 
      path = `/upload/drive/v3/files/${existingFileId}`;
      delete fileMetadata.parents; // Não precisa de parents no PATCH
  }


  const boundary = 'brauna_boundary_data'; 
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delimiter = "\r\n--" + boundary + "--";

  let multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(fileMetadata) + 
      delimiter +
      'Content-Type: application/json\r\n\r\n' + 
      content + 
      close_delimiter;

  try {
    const request = gapi.client.request({
      path: path,
      method: method,
      params: params,
      headers: {
        'Content-Type': 'multipart/related; boundary="' + boundary + '"', 
        'Authorization': 'Bearer ' + accessToken 
      },
      body: multipartRequestBody,
    });
    
    const response = await request;

    if (response.status === 200) {
      document.getElementById('lastSync').innerText = 'Agora mesmo!';
      alert('Dados sincronizados com sucesso no Google Drive!');
      return;
    } 
    
    if (response.status === 401) {
         accessToken = null; 
         alert('Autorização expirada. Tentando re-autorizar.');
         handleAuthClick();
         return;
    }
    throw new Error(`Falha no upload. Código: ${response.status}`);
    
  } catch(error) {
    console.error('Erro de upload:', error);
    let errorMessage = (error.message || error);
    if (error.result && error.result.error && error.result.error.message) {
        errorMessage = error.result.error.message;
    }
    alert('Erro ao sincronizar. Detalhe: ' + errorMessage);
  }
}


// Constantes e Mapeamento de Views
const APP_NAME = "Braúna Obras";

const views = {
    dashboard: document.getElementById('view-dashboard'),
    checklist: document.getElementById('view-checklist'),
    photos: document.getElementById('view-photos'),
    reports: document.getElementById('view-reports'),
    config: document.getElementById('view-config')
};

function show(view){ 
    for(const k in views){ 
        views[k].style.display='none'; 
    } 
    views[view].style.display='block'; 
    document.querySelectorAll('aside nav button').forEach(b=>b.classList.remove('active')); 
    document.getElementById('menu-'+view).classList.add('active'); 
}

function attachMenuListeners() {
    ['dashboard', 'checklist', 'photos', 'reports', 'config'].forEach(view => {
        const btn = document.getElementById(`menu-${view}`);
        if (btn) { 
            btn.addEventListener('click', () => show(view));
        }
    });
    const reportBtn = document.getElementById('btn-report');
    if (reportBtn) {
        reportBtn.addEventListener('click', () => show('reports'));
    }
}


// Configuração do IndexedDB
const DB_NAME='brauna_prof_v1', DB_VERSION=1; 
let db;

function openDB(){ 
    return new Promise((res,rej)=>{ 
        const rq=indexedDB.open(DB_NAME,DB_VERSION); 
        rq.onupgradeneeded = e => { 
            const idb=e.target.result; 
            if(!idb.objectStoreNames.contains('checklist')) 
                idb.createObjectStore('checklist',{keyPath:'id'}); 
            if(!idb.objectStoreNames.contains('photos')) 
                idb.createObjectStore('photos',{keyPath:'id'}); 
        }; 
        rq.onsuccess = e => { 
            db=e.target.result; 
            res(db); 
        }; 
        rq.onerror= e => rej(e); 
    }); 
}

function put(store, val){ 
    return new Promise((res,rej)=>{ 
        const tx=db.transaction(store,'readwrite'); 
        const st=tx.objectStore(store); 
        const rq=st.put(val); 
        rq.onsuccess=()=>res(rq.result); 
        rq.onerror=e=>rej(e); 
    }); 
}

function getAll(store){ 
    return new Promise((res,rej)=>{ 
        const tx=db.transaction(store,'readonly'); 
        const st=tx.objectStore(store); 
        const rq=st.getAll(); 
        rq.onsuccess=()=>res(rq.result); 
        rq.onerror=e=>rej(e); 
    }); 
}

// 🆕 FUNÇÕES AUXILIARES PARA DELETAR E OBTER POR ID (Necessário para a exclusão de fotos)
function deleteById(store, key){
    return new Promise((res,rej)=>{
        const tx=db.transaction(store,'readwrite');
        const st=tx.objectStore(store);
        const rq=st.delete(key);
        rq.onsuccess=()=>res();
        rq.onerror=e=>rej(e);
    });
}

function getById(store, key){
    return new Promise((res,rej)=>{
        const tx=db.transaction(store,'readonly');
        const st=tx.objectStore(store);
        const rq=st.get(key);
        rq.onsuccess=()=>res(rq.result);
        rq.onerror=e=>rej(e);
    });
}


function clearStore(store){ 
    return new Promise((res,rej)=>{ 
        const tx=db.transaction(store,'readwrite'); 
        const st=tx.objectStore(store); 
        const rq=st.clear(); 
        rq.onsuccess=()=>res(); 
        rq.onerror=e=>rej(e); 
    }); 
}

const defaultChecklist = ['Projeto executivo completo aprovado','Memorial descritivo atualizado','ARTs/RRTs emitidas e registradas','Cronograma físico-financeiro definido','Licenças liberadas (alvará, ambiental)','Planilha orçamentária revisada','Diário de obra atualizado','Equipe registrada e com ASOs válidos','Checklists de cada etapa executiva','Armazenamento de materiais adequado','Medições de serviço aprovadas','Limpeza final e checklist de entrega'];

async function init(){ 
    await openDB(); 
    const items = await getAll('checklist'); 
    if(!items || items.length===0){ 
        for(let i=0;i<defaultChecklist.length;i++){ 
            await put('checklist',{id:'item_'+i, text: defaultChecklist[i], status:'Pendente', photos:[], note:''}); 
        } 
    } 
    await refreshUI(); 
}

async function refreshUI(){ 
    const items = await getAll('checklist'); 
    document.getElementById('totalItems').innerText = items.length; 
    document.getElementById('doneCount').innerText = items.filter(i=>i.status==='Concluído').length; 
    renderChecklist(items); 
    const photos = await getAll('photos'); 
    document.getElementById('photoCount').innerText = photos.length + ' fotos'; 
}

function renderChecklist(items){ 
    const tbody=document.querySelector('#checklistTable tbody'); 
    tbody.innerHTML=''; 
    items.forEach(it=>{ 
        const tr=document.createElement('tr'); 
        let statusClass = it.status==='Concluído' ? 'status-concluido' : (it.status==='Em Andamento' ? 'status-andamento' : 'status-pendente'); 
        const photosCount = it.photos? it.photos.length:0; 
        tr.innerHTML = `<td>${it.text}</td><td><span class="status-pill ${statusClass}">${it.status||'Pendente'}</span></td><td>${it.note? ('Obs: '+it.note+' ') : ''}${photosCount?(' • Fotos: '+photosCount):''}</td><td><button class='btn ghost' onclick="editItem('${it.id}')">Editar</button> <button class='btn' onclick="attachPhoto('${it.id}')">Anexar foto</button></td>`; 
        tbody.appendChild(tr); 
    }); 
}

window.editItem = async function(id){ 
    const tx = db.transaction('checklist','readwrite'); 
    const st = tx.objectStore('checklist'); 
    const rq = st.get(id); 
    rq.onsuccess = async ()=>{ 
        const it = rq.result; 
        const newStatus = prompt('Status (Pendente / Concluído / Em Andamento):', it.status||'Pendente'); 
        if(newStatus===null) return; 
        const newNote = prompt('Observações:', it.note||''); 
        it.status=newStatus; 
        it.note=newNote||''; 
        await put('checklist', it); 
        await refreshUI(); 
    }; 
}

window.attachPhoto = async function(itemId){ 
    const input = document.createElement('input'); 
    input.type='file'; 
    input.accept='image/*'; 
    input.capture='environment'; 
    input.onchange = async ()=>{ 
        const file = input.files[0]; 
        if(!file) return; 
        const id='photo_'+Date.now(); 
        const buf = await file.arrayBuffer(); 
        await put('photos',{id:id, blob:buf, name:file.name, mime:file.type, date:Date.now(), itemId}); 
        const req = db.transaction('checklist','readwrite').objectStore('checklist').get(itemId); 
        req.onsuccess = async ()=>{ 
            const it = req.result; 
            it.photos = it.photos||[]; 
            it.photos.push(id); 
            await put('checklist', it); 
            await refreshUI(); 
            await renderPhotoGrid(); 
        }; 
    }; 
    input.click(); 
}

// 🆕 FUNÇÃO PARA DELETAR FOTO (A peça que estava faltando!)
window.deletePhoto = async function(photoId, itemId) {
    if (!confirm('Tem certeza que deseja apagar esta foto?')) return;

    try {
        // 1. Deleta do store 'photos'
        await deleteById('photos', photoId);

        // 2. Remove a referência do item do checklist (se houver)
        if (itemId && itemId !== 'null') { 
            const item = await getById('checklist', itemId);
            if (item && item.photos) {
                // Filtra o array removendo o ID da foto
                item.photos = item.photos.filter(id => id !== photoId);
                await put('checklist', item);
            }
        }

        alert('Foto apagada com sucesso!');
        await refreshUI();
        await renderPhotoGrid();

    } catch (e) {
        console.error("Erro ao apagar foto:", e);
        alert("Erro ao apagar foto. Veja o console para detalhes.");
    }
};


async function renderPhotoGrid(){ 
    const photos = await getAll('photos'); 
    const grid=document.getElementById('photoGrid'); 
    grid.innerHTML=''; 
    for(const p of photos){ 
        if (p.blob instanceof ArrayBuffer) {
            const blob = new Blob([p.blob], {type: p.mime}); 
            const url = URL.createObjectURL(blob); 
            const div=document.createElement('div'); 
            // 🆕 Este é o HTML que insere o botão "Apagar"
            div.innerHTML = `
                <img class='photo-thumb' src='${url}' alt='${p.name}'>
                <div class='photo-info'>
                    <div class='small'>${p.name}</div>
                    <button class='btn-delete' onclick="deletePhoto('${p.id}', '${p.itemId}')">Apagar</button>
                </div>
            `; 
            grid.appendChild(div); 
        } 
    } 
}

document.getElementById('addItemBtn').addEventListener('click', async ()=>{ 
    const text = prompt('Descrição do novo item:'); 
    if(!text) return; 
    const id='item_'+Date.now(); 
    await put('checklist',{id,text,status:'Pendente',photos:[],note:''}); 
    await refreshUI(); 
});

document.getElementById('photoInput').addEventListener('change', async (e)=>{ 
    const files = e.target.files; 
    for(const f of files){ 
        const id='photo_'+Date.now()+'_'+Math.floor(Math.random()*1000); 
        const buf = await f.arrayBuffer(); 
        await put('photos',{id, blob:buf, name:f.name, mime:f.type, date:Date.now(), itemId:null}); 
    } 
    await renderPhotoGrid(); 
    await refreshUI(); 
    e.target.value=''; 
});

document.getElementById('clearLocalBtn').addEventListener('click', async ()=>{ 
    if(!confirm('Apagar todos os dados locais?')) return; 
    await clearStore('checklist'); 
    await clearStore('photos'); 
    await init(); 
    alert('Dados locais apagados'); 
});

document.getElementById('genReportBtn').addEventListener('click', async ()=>{ 
    const { jsPDF } = window.jspdf; 
    const doc = new jsPDF({unit:'mm',format:'a4'}); 
    doc.setFontSize(14); 
    doc.text('RELATÓRIO - '+APP_NAME,14,16); 
    doc.setFontSize(10); 
    doc.text('Obra: Prédio de Refeitório - ETEX / Gypsum Petrolina-PE',14,24); 
    let y=30; 
    const items = await getAll('checklist'); 
    for(const it of items){ 
        doc.setFontSize(10); 
        doc.text('- '+it.text + ' [' + (it.status||'Pendente') + ']',14,y); 
        y+=6; 
        if(it.note){ 
            doc.setFontSize(9); 
            doc.text('  Obs: '+it.note,16,y); 
            y+=6; 
        } 
        if(it.photos && it.photos.length){ 
            doc.setFontSize(8); 
            doc.text('  Fotos anexadas: '+it.photos.length,16,y); 
            y+=6; 
        } 
        if(y>260){ 
            doc.addPage(); 
            y=20; 
        } 
    } 
    doc.save('Relatorio_Brauna_'+Date.now()+'.pdf'); 
});

// Lógica de Instalação do PWA
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e)=>{ 
    e.preventDefault(); 
    deferredPrompt = e; 
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.style.display='inline-block'; 
    }
});

document.getElementById('installBtn').addEventListener('click', async ()=>{ 
    if(deferredPrompt){ 
        deferredPrompt.prompt(); 
        const choice = await deferredPrompt.userChoice; 
        if(choice.outcome==='accepted'){ 
            alert('App instalado!'); 
        } 
        deferredPrompt = null; 
    } else { 
        alert('Instalação não disponível');
    } 
});

// Registro do Service Worker
if('serviceWorker' in navigator){ 
    navigator.serviceWorker.register('sw.js').catch(()=>{}); 
}

// CONEXÃO DO BOTÃO DE SINCRONIZAÇÃO
const syncButton = document.getElementById('btn-sync');
if (syncButton) {
    syncButton.addEventListener('click', () => {
        handleAuthClick(); 
    });
}


// Inicia a aplicação
(async ()=>{ 
    await init(); 
    renderPhotoGrid();
    attachMenuListeners(); 
    
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
        const installBtn = document.getElementById('installBtn');
        if (installBtn) {
            installBtn.style.display = 'none';
        }
    }
})();
