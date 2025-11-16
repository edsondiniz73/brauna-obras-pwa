// =================================================================
// CONFIGURAÇÃO GOOGLE DRIVE API
// =================================================================
const CLIENT_ID = '748610201197-f31mfm8urml5b3ttsfcjuno3rhsrojfl.apps.googleusercontent.com'; // SEU ID DE CLIENTE
const API_KEY = 'AIzaSyCksEZCtHi5Mm5ud68HpCYvrP1vu3SOPes'; // SUA CHAVE DE API REAL
const SCOPES = 'https://www.googleapis.com/auth/drive.file'; 
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

let tokenClient;

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
    callback: '', // O callback será definido no momento do clique do botão
  });
}

// Função para iniciar o fluxo de autorização
function handleAuthClick(callback) {
  if (!tokenClient || !gapi.client || !gapi.client.getToken) {
    alert("Aguarde o carregamento das bibliotecas do Google (gapi/gis).");
    return;
  }
  
  tokenClient.callback = (tokenResponse) => {
    if (tokenResponse.error) {
      console.error("Erro na autorização:", tokenResponse.error);
      alert("Erro ao autorizar o Google Drive.");
    } else {
      document.getElementById('btn-sync').innerText = 'Sincronizar (Drive)';
      if (callback) callback(); // Executa a ação (upload) após a autorização
    }
  };
  
  // Se já tiver um token (usuário já logou), executa o callback diretamente
  if (gapi.client.getToken() && gapi.client.getToken().access_token) {
     if (callback) callback(); 
  } else {
     // Se não tiver token, pede autorização
     tokenClient.requestAccessToken();
  }
}

// FUNÇÃO PRINCIPAL DE BACKUP/UPLOAD
async function uploadToDrive() {
  const localData = {
      checklist: await getAll('checklist'), 
      photos: await getAll('photos'),
      lastSync: new Date().toISOString()
  };
  const content = JSON.stringify(localData);

  const fileMetadata = {
    'name': 'brauna_obras_backup.json',
    'mimeType': 'application/json',
    'parents': ['appDataFolder'] 
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: 'application/json' }));

  try {
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: new Headers({ 'Authorization': 'Bearer ' + gapi.client.getToken().access_token }),
      body: form,
    });
    
    if (response.ok) {
      document.getElementById('lastSync').innerText = 'Agora mesmo!';
      alert('Dados sincronizados com sucesso no Google Drive!');
    } else {
        throw new Error(`Falha no upload. Código: ${response.status}`);
    }
  } catch(error) {
    console.error('Erro de upload:', error);
    alert('Erro ao sincronizar. Detalhe: ' + (error.message || error));
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

// Event Listeners para o Menu de Navegação
document.getElementById('menu-dashboard').addEventListener('click', ()=>show('dashboard'));
document.getElementById('menu-checklist').addEventListener('click', ()=>show('checklist'));
document.getElementById('menu-photos').addEventListener('click', ()=>show('photos'));
document.getElementById('menu-reports').addEventListener('click', ()=>show('reports'));
document.getElementById('menu-config').addEventListener('click', ()=>show('config'));

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

// NOVO: CONEXÃO DO BOTÃO DE SINCRONIZAÇÃO
const syncButton = document.getElementById('btn-sync');
if (syncButton) {
    syncButton.addEventListener('click', () => {
        // Tenta autorizar. Se for bem-sucedido, chama uploadToDrive.
        handleAuthClick(uploadToDrive); 
    });
}


// Inicia a aplicação
(async ()=>{ 
    await init(); 
    renderPhotoGrid();
    
    // Se o app já estiver instalado, esconde o botão (lógica de PWA)
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
        const installBtn = document.getElementById('installBtn');
        if (installBtn) {
            installBtn.style.display = 'none';
        }
    }
})();
