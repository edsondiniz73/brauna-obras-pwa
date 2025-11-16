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

// FUNÇÃO PRINCIPAL DE BACKUP/UPLOAD - VERSÃO ROBUSTA (Corrigindo o 403)
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
  
  // 3. Monta o corpo da requisição Multi-part de forma manual (essencial para evitar o 403)
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

// O RESTANTE DO CÓDIGO PERMANECE O MESMO
// ...
// NOVO: CONEXÃO DO BOTÃO DE SINCRONIZAÇÃO (usado no final do main.js)
const syncButton = document.getElementById('btn-sync');
if (syncButton) {
    syncButton.addEventListener('click', () => {
        handleAuthClick(); // Chama a função que gerencia a autorização/upload
    });
}

// ... (todo o resto do seu código, garantindo que as funções de DB fiquem intactas)
