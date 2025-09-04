# Exemplos cURL - WhatsApp REST API

## 🔗 Base URL
```
http://localhost:3000
```

## 📋 Health Check

### Verificar se a API está funcionando
```bash
curl -X GET http://localhost:3000/health
```

## 🔐 Endpoints de Autenticação

### 1. Registrar Usuário
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "joao@exemplo.com",
    "password": "MinhaSenh@123"
  }'
```

**Resposta esperada:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-v4-aqui",
      "name": "João Silva",
      "email": "joao@exemplo.com",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Registro realizado com sucesso"
}
```

### 2. Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "joao@exemplo.com",
    "password": "MinhaSenh@123"
  }'
```

### 3. Recuperar Senha
```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "joao@exemplo.com"
  }'
```

### 4. Redefinir Senha
```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "token-recebido-por-email",
    "newPassword": "NovaSenha@123"
  }'
```

### 5. Atualizar Senha (Autenticado)
```bash
curl -X PUT http://localhost:3000/api/auth/update-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_JWT_TOKEN_AQUI" \
  -d '{
    "currentPassword": "MinhaSenh@123",
    "newPassword": "NovaSenha@456"
  }'
```

### 6. Obter Perfil (Autenticado)
```bash
curl -X GET http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer SEU_JWT_TOKEN_AQUI"
```

## 🔌 Endpoints de Conexão

### 1. Criar Nova Conexão WhatsApp (QR Code)
```bash
curl -X POST http://localhost:3000/api/connection \
  -H "Content-Type: application/json" \
  -d '{"pairingMethod": "qr"}'
```

**Resposta esperada:**
```json
{
  "success": true,
  "data": {
    "connectionId": "uuid-v4-aqui",
    "pairingMethod": "qr",
    "qrCode": "data:image/png;base64,..."
    "message": "Scan the QR code with your WhatsApp to connect"
  },
  "message": "Connection created successfully"
}
```

### 1.1. Criar Nova Conexão WhatsApp (Código de Emparelhamento)
```bash
curl -X POST http://localhost:3000/api/connection \
  -H "Content-Type: application/json" \
  -d '{
    "pairingMethod": "code",
    "phoneNumber": "5511999999999"
  }'
```

**Resposta esperada:**
```json
{
  "success": true,
  "data": {
    "connectionId": "uuid-v4-aqui",
    "pairingMethod": "code",
    "pairingCode": "ABCD-1234",
    "message": "Enter the pairing code in your WhatsApp: Settings > Linked Devices > Link a Device > Link with phone number instead"
  },
  "message": "Connection created successfully"
}
```

### 2. Validar Conexão com Código
```bash
curl -X PUT http://localhost:3000/api/connection \
  -H "Content-Type: application/json" \
  -d '{
    "connectionId": "SEU_CONNECTION_ID_AQUI",
    "code": "codigo-de-emparelhamento"
  }'
```

### 3. Listar Todas as Conexões
```bash
curl -X GET http://localhost:3000/api/connection
```

### 3.1. Obter Status de Conexão Específica (com QR Code atualizado)
```bash
curl -X GET http://localhost:3000/api/connection/SEU_CONNECTION_ID_AQUI
```

**Resposta esperada:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-v4-aqui",
    "status": "qr_pending",
    "qr": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "createdAt": "2024-01-01T10:00:00.000Z",
    "lastActivity": null,
    "phoneNumber": null
  },
  "message": "Connection status retrieved successfully"
}
```

### 4. Remover Conexão Específica
```bash
curl -X DELETE http://localhost:3000/api/connection/SEU_CONNECTION_ID_AQUI
```

### 4.1. Reiniciar Conexão Específica
```bash
curl -X POST http://localhost:3000/api/connection/SEU_CONNECTION_ID_AQUI/restart
```

**Resposta esperada:**
```json
{
  "success": true,
  "data": {
    "connectionId": "uuid-v4-aqui",
    "qrCode": "data:image/png;base64,..." // ou pairingCode se for método code
  },
  "message": "Connection restarted successfully"
}
```

## 💬 Endpoints de Mensagens

### 5. Enviar Mensagem de Texto
```bash
curl -X POST http://localhost:3000/api/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "connectionId": "SEU_CONNECTION_ID_AQUI",
    "to": "5511999999999",
    "message": "Olá! Esta é uma mensagem de teste da API."
  }'
```

**Resposta esperada:**
```json
{
  "success": true,
  "data": {
    "wa_id": "5511999999999@s.whatsapp.net",
    "original_number": "5511999999999"
  },
  "message": "Mensagem enviada com sucesso"
}
```

**Nota**: Para números brasileiros, a API testa automaticamente os formatos com e sem o 9 (ex: 5511999999999 e 551199999999) e retorna o `wa_id` correto.

### 6. Enviar Arquivo (Imagem)
```bash
curl -X POST http://localhost:3000/api/send-file \
  -F "connectionId=SEU_CONNECTION_ID_AQUI" \
  -F "to=5511999999999" \
  -F "caption=Legenda da imagem" \
  -F "file=@/caminho/para/sua/imagem.jpg"
```

**Resposta esperada:**
```json
{
  "success": true,
  "data": {
    "wa_id": "5511999999999@s.whatsapp.net",
    "original_number": "5511999999999",
    "file_name": "imagem.jpg",
    "file_type": "image/jpeg"
  },
  "message": "Arquivo enviado com sucesso"
}
```

### 7. Enviar Arquivo (Documento PDF)
```bash
curl -X POST http://localhost:3000/api/send-file \
  -F "connectionId=SEU_CONNECTION_ID_AQUI" \
  -F "to=5511999999999" \
  -F "caption=Documento importante" \
  -F "file=@/caminho/para/documento.pdf"
```

### 8. Enviar Arquivo (Áudio)
```bash
curl -X POST http://localhost:3000/api/send-file \
  -F "connectionId=SEU_CONNECTION_ID_AQUI" \
  -F "to=5511999999999" \
  -F "file=@/caminho/para/audio.mp3"
```

### 9. Validar Número WhatsApp
```bash
curl -X POST http://localhost:3000/api/validate-number \
  -H "Content-Type: application/json" \
  -d '{
    "connectionId": "SEU_CONNECTION_ID_AQUI",
    "number": "5511999999999"
  }'
```

**Resposta esperada:**
```json
{
  "success": true,
  "data": {
    "exists": true,
    "jid": "5511999999999@s.whatsapp.net",
    "status": "Status do usuário",
    "picture": "url-da-foto",
    "business": false
  }
}
```

## 👥 Endpoints de Contatos e Grupos

### 10. Listar Contatos
```bash
curl -X GET http://localhost:3000/api/contacts/SEU_CONNECTION_ID_AQUI
```

### 11. Listar Grupos
```bash
curl -X GET http://localhost:3000/api/groups/SEU_CONNECTION_ID_AQUI
```

## 📱 Exemplos com Números Brasileiros

### Enviar para Celular Brasileiro
```bash
curl -X POST http://localhost:3000/api/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "connectionId": "SEU_CONNECTION_ID_AQUI",
    "to": "5511987654321",
    "message": "Mensagem para número brasileiro"
  }'
```

### Enviar para Grupo (JID completo)
```bash
curl -X POST http://localhost:3000/api/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "connectionId": "SEU_CONNECTION_ID_AQUI",
    "to": "120363043123456789@g.us",
    "message": "Mensagem para grupo"
  }'
```

## 🔄 Fluxo Completo de Uso

### Passo 1: Criar conexão
```bash
curl -X POST http://localhost:3000/api/connection \
  -H "Content-Type: application/json"
```

### Passo 2: Escanear QR Code
- Use o QR Code retornado no passo 1 para conectar seu WhatsApp

### Passo 3: Verificar conexões ativas
```bash
curl -X GET http://localhost:3000/api/connection
```

### Passo 4: Enviar mensagem de teste
```bash
curl -X POST http://localhost:3000/api/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "connectionId": "CONNECTION_ID_DO_PASSO_1",
    "to": "SEU_NUMERO_DE_TESTE",
    "message": "API funcionando perfeitamente! 🚀"
  }'
```

## 🔄 Fluxo com Autenticação

### Passo 1: Registrar usuário
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Seu Nome",
    "email": "seu@email.com",
    "password": "SuaSenha@123"
  }'
```

### Passo 2: Salvar o token JWT
```bash
# Salve o token retornado no passo 1
export JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Passo 3: Usar endpoints protegidos
```bash
curl -X GET http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer $JWT_TOKEN"
```

## 🛠️ Para Usar no Insomnia

1. **Importe como cURL**: Copie qualquer comando acima
2. **Substitua variáveis**: 
   - `SEU_CONNECTION_ID_AQUI` pelo ID real da conexão
   - `5511999999999` pelo número de destino real
   - Caminhos de arquivo pelos caminhos reais
3. **Configure ambiente**: Crie variável `base_url` = `http://localhost:3000`

## 📝 Notas Importantes

- **Connection ID**: Sempre use o ID retornado ao criar uma conexão
- **JWT Token**: Salve o token após login/registro para usar em endpoints protegidos
- **Senhas**: Devem ter pelo menos 6 caracteres, com maiúscula, minúscula e número
- **Email**: Configure SMTP no .env para recuperação de senha funcionar
- **Números**: Use formato internacional (55 + DDD + número)
- **Arquivos**: Tamanho máximo de 50MB
- **Grupos**: Use o JID completo terminado em `@g.us`
- **Status**: Verifique se a conexão está `connected` antes de enviar mensagens