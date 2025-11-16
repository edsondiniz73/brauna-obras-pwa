// =================================================================
// CONFIGURAÇÃO GOOGLE DRIVE API
// =================================================================
const CLIENT_ID = '748610201197-f31mfm8urml5b3ttsfcjuno3rhsrojfl.apps.googleusercontent.com'; // SEU ID DE CLIENTE
const API_KEY = 'AIzaSyCksEZCtHi5Mm5ud68HpCYvrP1vu3SOPes'; // SUA CHAVE DE API REAL
const SCOPES = 'https://www.googleapis.com/auth/drive.file'; 
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

let tokenClient;
let accessToken = null; // Armazenará o token de acesso (MUITO IMPORTANTE)

// Funções chamadas globalmente quando os scripts do Google carregam (dependem do index.html)
function gapiLoaded() {
  gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: DISCOVERY_DOCS,
  });
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    // O callback agora guarda o token e tenta o upload
    callback: (tokenResponse) => {
        if (tokenResponse.error) {
            console.error("Erro na autorização:", tokenResponse.error);
            alert("Erro ao autorizar o Google Drive. Detalhe: " + tokenResponse.error);
        } else {
            accessToken = tokenResponse.access_token; // Guarda o token
            document.getElementById('btn-sync').innerText = 'Sincronizar (Drive)';
            uploadToDrive(); // Tenta o upload imediatamente
        }
    },
  });
}

// Função para iniciar o fluxo de autorização
function handleAuthClick() {
  if (!tokenClient || !gapi.client) {
    alert("Aguarde o carregamento das bibliotecas do Google (gapi/gis).");
    return;
  }
  
  // Se já tiver um token (usuário já logou), tenta o upload diretamente
  if (accessToken) {
     uploadToDrive(); 
  } else {
     // Se não tiver token, pede autorização
     tokenClient.requestAccessToken();
  }
}

// FUNÇÃO PRINCIPAL DE BACKUP/UPLOAD - VERSÃO ROBUSTA (Corrigindo o 403 de formato)
async function uploadToDrive() {
  if (!accessToken) {
    alert("Token de acesso não disponível. Tente sincronizar novamente.");
    handleAuthClick(); 
    return;
  }
  
  // 1. Prepara os dados locais
  const localData = {
      checklist: await getAll('checklist'), 
      photos: await getAll('photos'),
      lastSync: new Date().toISOString()
  };
  const content = JSON.stringify(localData);

  // 2. Metadados do arquivo
  const fileMetadata = {
    'name': 'brauna_obras_backup.json',
    'mimeType': 'application/json',
    'parents': ['appDataFolder'] 
  };
  
  // 3. Monta o corpo da requisição Multi-part de forma manual
  const boundary = 'brauna_boundary_data'; 
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delimiter = "\r\n--" + boundary + "--";

  let multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(fileMetadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' + // Tipo de conteúdo dos dados (JSON)
      content + 
      close_delimiter;

  try {
    // Usa gapi.client.request para forçar o formato de upload correto
    const request = gapi.client.request({
      path: '/upload/drive/v3/files',
      method: 'POST',
      params: { 'uploadType': 'multipart' },
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
    
    // Tratamento de erro
    if (response.status === 401) {
         accessToken = null; // Limpa o token expirado
         alert('Autorização expirada. Tentando re-autorizar.');
         handleAuthClick();
         return;
    }
    // Lançar erro para o catch
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


// Constantes de Configuração (ajustadas para usar as chaves principais)
const APP_NAME = "Braúna Obras";

// Mapeamento de Views
const views = {
    dashboard: document.getElementById('view-dashboard'),
    checklist: document.getElementById('view-checklist'),
    photos: document.getElementById('view-photos'),
    reports: document.getElementById('view-reports'),
    config: document.getElementById('view-config')
};

// Função para Mudar a View
function show(view){ 
    for(const k in views){ 
        views[k].style.display='none'; 
    } 
    views[view].style.display='block'; 
    document.querySelectorAll('aside nav button').forEach(b=>b.classList.remove('active')); 
    document.getElementById('menu-'+view).classList.add('active'); 
}


// NOVO: CONEXÃO DOS BOTÕES DO MENU (Função que corrige os menus travados)
function attachMenuListeners() {
    ['dashboard', 'checklist', 'photos', 'reports', 'config'].forEach(view => {
        const btn = document.getElementById(`menu-${view}`);
        // Se o botão existir no HTML, anexa o listener
        if (btn) { 
            btn.addEventListener('click', () => show(view));
        }
    });
    // Conecta o botão de Gerar PDF da dashboard que leva para a view de reports
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

// Inicialização e Renderização da UI
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

async function renderPhotoGrid(){ 
    const photos = await getAll('photos'); 
    const grid=document.getElementById('photoGrid'); 
    grid.innerHTML=''; 
    for(const p of photos){ 
        const blob = new Blob([p.blob], {type: p.mime}); 
        const url = URL.createObjectURL(blob); 
        const div=document.createElement('div'); 
        div.innerHTML = `<img class='photo-thumb' src='${url}' alt='${p.name}'><div class='small'>${p.name}</div>`; 
        grid.appendChild(div); 
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
            doc.text('  Obs: '+it.note,16,y); 
            y+=6; 
        } 
        if(it.photos && it.photos.length){ 
            doc.setFontSize(8); 
            doc.text('  Fotos anexadas: '+it.photos.length,16,y); 
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
        handleAuthClick(); // Chama a função que gerencia a autorização/upload
    });
}


// Inicia a aplicação
(async ()=>{ 
    await init(); 
    renderPhotoGrid();
    attachMenuListeners(); // <--- CHAMA A FUNÇÃO CORRIGIDA AQUI!
    
    // Se o app já estiver instalado, esconde o botão (lógica de PWA)
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
        const installBtn = document.getElementById('installBtn');
        if (installBtn) {
            installBtn.style.display = 'none';
        }
    }
})();
