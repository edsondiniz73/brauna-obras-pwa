BRAÚNA OBRAS - PWA (PROFISSIONAL)
Arquivos incluídos:
- index.html  -> aplicação PWA (layout profissional, checklist, fotos, relatórios)
- manifest.json
- sw.js
- icon-192.png / icon-512.png / icon-64.png
- README.txt (este arquivo)

Instruções rápidas para testar localmente:
1) Salve a pasta brauna_obras_professional em seu computador.
2) Abra um terminal nela e rode: python3 -m http.server 8000
3) Abra no navegador Chrome/Edge: http://localhost:8000
4) No Chrome/Edge: menu (⋮) > Instalar Braúna Obras (ou Add to Home screen no Android)
5) Para ativar sincronização com Google Drive:
   - Crie um projeto no Google Cloud Console
   - Ative Google Drive API
   - Crie OAuth 2.0 Client ID (tipo Web Application)
   - Adicione origin http://localhost:8000 (para testes locais)
   - Substitua CLIENT_ID_PLACEHOLDER e API_KEY_PLACEHOLDER no index.html pelos valores gerados
6) Para publicar (GitHub Pages):
   - Crie repositório no GitHub e envie todos os arquivos desta pasta
   - No repositório: Settings -> Pages -> Source: main branch / root -> Save
   - Aguarde o link https://<seuusuario>.github.io/<repo>/ e abra no celular/PC

Próximos passos que posso fazer para você:
- Substituir CLIENT_ID e API_KEY no código (se você me fornecer)
- Hospedar eu mesmo em GitHub Pages e te enviar o link
- Adicionar fila de upload e compressão de imagens antes do envio
- Implementar autenticação de usuários/equipes
