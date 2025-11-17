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

// Função auxiliar para converter ArrayBuffer para Base64 (NECESSÁRIO PARA SALVAR IMAGEM NO JSON)
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}


// 🆕 FUNÇÃO PARA BUSCAR O ARQUIVO EXISTENTE
async function searchExistingFile() {
    try {
        // Busca o arquivo com o nome 'brauna_obras_backup.json' na pasta root (Meu Drive)
        const response = await gapi.client.drive.files.list({
            'q': "name='brauna_obras_backup.json' and trashed=false",
            'spaces': 'drive',
            'fields': 'files(id)', // Pede apenas o ID do arquivo
            'pageSize': 1
        });

        const files = response.result.files;
        // Retorna o ID do primeiro arquivo encontrado ou null
        return files.length > 0 ? files[0].id : null;
    } catch (e) {
        console.error('Erro ao buscar arquivo existente:', e);
        return null;
    }
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

// FUNÇÃO PRINCIPAL DE BACKUP/UPLOAD - VERSÃO CORRIGIDA COM ATUALIZAÇÃO (PATCH)
async function uploadToDrive() {
  if (!accessToken) {
    alert("Token de acesso não disponível. Tente sincronizar novamente.");
    handleAuthClick(); 
    return;
  }
  
  // 1. Prepara os dados locais (mesmo código da conversão Base64)
  const localData = {
      checklist: await getAll('checklist'), 
      photos: await getAll('photos'),
      lastSync: new Date().toISOString()
  };

  // ⚠️ CORREÇÃO CRÍTICA: Converter ArrayBuffer para Base64 antes de serializar em JSON
  if (localData.photos && localData.photos.length > 0) {
      localData.photos = localData.photos.map(p => {
          if (p.blob instanceof ArrayBuffer) {
              const base64Data = arrayBufferToBase64(p.blob);
              return { 
                  id: p.id, 
                  name: p.name, 
                  mime: p.mime, 
                  date: p.date, 
                  itemId: p.itemId, 
                  base64Data: base64Data
              };
          }
          return p;
      });
  }

  const content = JSON.stringify(localData);

  // 2. Metadados do arquivo (só é necessário no POST, mas incluímos no PATCH por segurança)
  const fileMetadata = {
    'name': 'brauna_obras_backup.json',
    'mimeType': 'application/json',
    'parents': ['root']
  };
  
  // 3. ⭐️ LÓGICA DE SUBSTITUIÇÃO (POST/PATCH) ⭐️
  const existingFileId = await searchExistingFile(); 
  
  let method = 'POST'; // Padrão: Criar novo arquivo
  let path = '/upload/drive/v3/files';
  let params = { 'uploadType': 'multipart' };
  
  if (existingFileId) {
      // Se o arquivo existe, mudamos para PATCH (Atualizar) e passamos o ID
      method = 'PATCH'; 
      path = `/upload/drive/v3/files/${existingFileId}`;
      // Não é necessário incluir metadados no PATCH, mas é mais simples deixar no corpo multipart
  }


  // 4. Monta o corpo da requisição Multi-part
  const boundary = 'brauna_boundary_data'; 
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delimiter = "\r\n--" + boundary + "--";

  let multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      // Inclui metadados no corpo da requisição
      JSON.stringify(fileMetadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' + // Tipo de conteúdo dos dados (JSON)
      content + 
      close_delimiter;

  try {
    // 5. Executa a requisição (POST ou PATCH)
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
    
    // Tratamento de erro
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

// O restante do código (init, put, getAll, render functions, etc.) permanece o mesmo.

// ... (Restante do Código)
