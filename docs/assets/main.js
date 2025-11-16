// =================================================================
// CONFIGURAÇÃO GOOGLE DRIVE API
// =================================================================
const CLIENT_ID = '748610201197-f31mfm8urml5b3ttsfcjuno3rhsrojfl.apps.googleusercontent.com'; // SEU ID DE CLIENTE
const API_KEY = 'AIzaSyCksEZCtHi5Mm5ud68HpCYvrP1vu3SOPes'; // <<< COLE A CHAVE DE API AQUI!
const SCOPES = 'https://www.googleapis.com/auth/drive.file'; 
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

let tokenClient;

// Funções chamadas globalmente quando os scripts do Google carregam (ver index.html)
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
    callback: '', 
  });
}

function handleAuthClick(callback) {
  if (!tokenClient || !gapi.client) {
    alert("Aguarde o carregamento das bibliotecas do Google.");
    return;
  }
  
  tokenClient.callback = (tokenResponse) => {
    if (tokenResponse.error) {
      console.error("Erro na autorização:", tokenResponse.error);
      alert("Erro ao autorizar o Google Drive.");
    } else {
      document.getElementById('btn-sync').innerText = 'Sincronizar (Drive)';
      if (callback) callback(); 
    }
  };
  
  if (!gapi.client.getToken() || gapi.client.getToken().access_token === undefined) {
    tokenClient.requestAccessToken();
  } else {
     if (callback) callback(); 
  }
}

// FUNÇÃO PRINCIPAL DE BACKUP/UPLOAD
async function uploadToDrive() {
  // Coleta dados locais
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
    alert('Erro ao sincronizar. Verifique a chave de API e a conexão. Detalhe: ' + (error.message || error));
  }
}

// ... (CONTINUAÇÃO DO CÓDIGO ORIGINAL DO main.js) ...

// O novo listener do botão e a lógica de PWA devem ser inseridos no final:

// NOVO: CONEXÃO DO BOTÃO DE SINCRONIZAÇÃO
document.getElementById('btn-sync').addEventListener('click', () => {
    handleAuthClick(uploadToDrive); 
});

// Lógica de PWA (adaptada para a nova estrutura de `main.js`)
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
            console.log('App instalado!'); 
        } 
        deferredPrompt = null; 
    } else { 
        alert('Instalação não disponível');
    } 
});

// Se o app já estiver instalado, esconde o botão
if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.style.display = 'none';
    }
}

// Registro do Service Worker
if('serviceWorker' in navigator){ 
    navigator.serviceWorker.register('sw.js').catch(()=>{}); 
}

// Inicia a aplicação
(async ()=>{ 
    await init(); 
    renderPhotoGrid(); 
})();
