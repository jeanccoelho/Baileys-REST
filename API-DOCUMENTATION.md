# 📱 WhatsApp REST API - Documentação Completa

## 🌟 Visão Geral

API REST completa para WhatsApp usando Baileys v6.7.19 com sistema de autenticação JWT, multi-instâncias e sincronização completa de dados.

**Base URL:** `http://localhost:3000`

---

## 🔐 Sistema de Autenticação

### Headers Obrigatórios (Rotas Protegidas)
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### 1. Registrar Usuário
```http
POST /api/auth/register
```

**Body:**
```json
{
  "name": "João Silva",
  "email": "joao@exemplo.com",
  "password": "MinhaSenh@123"
}
```

**Resposta (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-v4",
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
```http
POST /api/auth/login
```

**Body:**
```json
{
  "email": "joao@exemplo.com",
  "password": "MinhaSenh@123"
}
```

**Resposta (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-v4",
      "name": "João Silva",
      "email": "joao@exemplo.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Autenticação bem-sucedida"
}
```

### 3. Recuperar Senha
```http
POST /api/auth/forgot-password
```

**Body:**
```json
{
  "email": "joao@exemplo.com"
}
```

### 4. Redefinir Senha
```http
POST /api/auth/reset-password
```

**Body:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "NovaSenha@123"
}
```

### 5. Atualizar Senha (Autenticado)
```http
PUT /api/auth/update-password
Authorization: Bearer <token>
```

**Body:**
```json
{
  "currentPassword": "SenhaAtual@123",
  "newPassword": "NovaSenha@123"
}
```

### 6. Obter Perfil (Autenticado)
```http
GET /api/auth/profile
Authorization: Bearer <token>
```

---

## 📱 Gerenciamento de Conexões WhatsApp

---

## 📞 Gerenciamento de Contatos Armazenados

### 20. Criar Contato
```http
POST /api/contacts-storage
Authorization: Bearer <token>
```

**Body:**
```json
{
  "phoneNumber": "5511999999999",
  "name": "João Silva"
}
```

**Resposta (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-v4",
    "userId": "user-uuid",
    "phoneNumber": "5511999999999",
    "name": "João Silva",
    "createdAt": "2024-01-01T10:00:00.000Z",
    "updatedAt": "2024-01-01T10:00:00.000Z"
  },
  "message": "Contato criado com sucesso"
}
```

### 21. Listar Contatos Armazenados
```http
GET /api/contacts-storage
Authorization: Bearer <token>
```

**Resposta (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-v4",
      "userId": "user-uuid",
      "phoneNumber": "5511999999999",
      "name": "João Silva",
      "createdAt": "2024-01-01T10:00:00.000Z",
      "updatedAt": "2024-01-01T10:00:00.000Z"
    }
  ],
  "message": "Contatos recuperados com sucesso"
}
```

### 22. Obter Contato por ID
```http
GET /api/contacts-storage/:contactId
Authorization: Bearer <token>
```

### 23. Atualizar Contato
```http
PUT /api/contacts-storage/:contactId
Authorization: Bearer <token>
```

**Body:**
```json
{
  "name": "João Silva Santos"
}
```

### 24. Remover Contato
```http
DELETE /api/contacts-storage/:contactId
Authorization: Bearer <token>
```

### 25. Importar Contatos via TXT
```http
POST /api/contacts-storage/import
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: Arquivo TXT com números (um por linha)

**Exemplo de arquivo TXT:**
```
5511999999999
5511888888888
5511777777777
```

**Resposta (200):**
```json
{
  "success": true,
  "data": {
    "imported": 2,
    "skipped": 1,
    "errors": ["5511invalid: Número de telefone deve ter entre 10 e 15 dígitos"]
  },
  "message": "Importação concluída: 2 importados, 1 ignorados, 1 erros"
}
```

### 26. Remover Todos os Contatos
```http
DELETE /api/contacts-storage
Authorization: Bearer <token>
```

**Resposta (200):**
```json
{
  "success": true,
  "data": {
    "deletedCount": 15
  },
  "message": "15 contatos removidos com sucesso"
}
```

---

### 7. Criar Nova Conexão (QR Code)
```http
POST /api/connection
Authorization: Bearer <token>
```

**Body:**
```json
{
  "pairingMethod": "qr"
}
```

**Resposta (201):**
```json
{
  "success": true,
  "data": {
    "connectionId": "uuid-v4",
    "pairingMethod": "qr",
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "message": "Escaneie o QR code com seu WhatsApp para conectar"
  },
  "message": "Connection created successfully"
}
```

### 8. Criar Nova Conexão (Código de Emparelhamento)
```http
POST /api/connection
Authorization: Bearer <token>
```

**Body:**
```json
{
  "pairingMethod": "code",
  "phoneNumber": "5511999999999"
}
```

**Resposta (201):**
```json
{
  "success": true,
  "data": {
    "connectionId": "uuid-v4",
    "pairingMethod": "code",
    "pairingCode": "ABCD-1234",
    "message": "Digite o código ABCD-1234 no WhatsApp: Configurações > Aparelhos conectados"
  },
  "message": "Connection created successfully"
}
```

### 9. Listar Todas as Conexões
```http
GET /api/connection
Authorization: Bearer <token>
```

**Resposta (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-v4",
      "userId": "user-uuid",
      "status": "connected",
      "phoneNumber": "5511999999999",
      "profilePicture": "https://pps.whatsapp.net/v/t61.24694-24/...",
      "createdAt": "2024-01-01T10:00:00.000Z",
      "lastActivity": "2024-01-01T10:30:00.000Z"
    }
  ],
  "message": "Connections retrieved successfully"
}
```

### 10. Obter Status de Conexão Específica
```http
GET /api/connection/:connectionId
Authorization: Bearer <token>
```

**Resposta (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-v4",
    "status": "connected",
    "phoneNumber": "5511999999999",
    "profilePicture": "https://pps.whatsapp.net/v/t61.24694-24/...",
    "qr": "data:image/png;base64,..." // Se status for qr_pending
  },
  "message": "Connection status retrieved successfully"
}
```

### 11. Reiniciar Conexão
```http
POST /api/connection/:connectionId/restart
Authorization: Bearer <token>
```

**Resposta (200):**
```json
{
  "success": true,
  "data": {
    "connectionId": "uuid-v4",
    "qrCode": "data:image/png;base64,..."
  },
  "message": "Connection restarted successfully"
}
```

### 12. Remover Conexão
```http
DELETE /api/connection/:connectionId
Authorization: Bearer <token>
```

---

## 💬 Envio de Mensagens

### 13. Enviar Mensagem de Texto
```http
POST /api/send-message
Authorization: Bearer <token>
```

**Body:**
```json
{
  "connectionId": "uuid-v4",
  "to": "5511999999999",
  "message": "Olá! Esta é uma mensagem de teste."
}
```

**Resposta (200):**
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

### 14. Enviar Arquivo
```http
POST /api/send-file
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `connectionId`: uuid-v4
- `to`: 5511999999999
- `caption`: Legenda do arquivo (opcional)
- `file`: Arquivo a ser enviado

**Resposta (200):**
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

### 15. Validar Número WhatsApp
```http
POST /api/validate-number
Authorization: Bearer <token>
```

**Body:**
```json
{
  "connectionId": "uuid-v4",
  "number": "5511999999999"
}
```

**Resposta (200):**
```json
{
  "success": true,
  "data": {
    "exists": true,
    "jid": "5511999999999@s.whatsapp.net",
    "status": "Status do usuário",
    "picture": "url-da-foto",
    "business": false
  },
  "message": "Number validated successfully"
}
```

---

## 👥 Dados Sincronizados do WhatsApp

### 16. Listar Contatos
```http
GET /api/contacts/:connectionId
Authorization: Bearer <token>
```

**Resposta (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "5511999999999@s.whatsapp.net",
      "name": "João Silva",
      "notify": "João",
      "verifiedName": "João Silva Oficial",
      "imgUrl": "https://pps.whatsapp.net/v/t61.24694-24/...",
      "status": "Disponível"
    }
  ],
  "message": "Contacts retrieved successfully"
}
```

### 17. Listar Chats
```http
GET /api/chats/:connectionId
Authorization: Bearer <token>
```

**Resposta (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "5511999999999@s.whatsapp.net",
      "name": "João Silva",
      "conversationTimestamp": 1704067200,
      "unreadCount": 3,
      "archived": false,
      "pinned": true,
      "muteEndTime": null,
      "lastMessageTime": 1704067200
    }
  ],
  "message": "Chats retrieved successfully"
}
```

### 18. Listar Mensagens
```http
GET /api/messages/:connectionId?limit=50
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (opcional): Número máximo de mensagens (padrão: 50)

**Resposta (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "message-id",
      "from": "5511999999999@s.whatsapp.net",
      "participant": null,
      "timestamp": 1704067200000,
      "message": {
        "conversation": "Olá, como você está?"
      },
      "isFromMe": false,
      "status": "read"
    }
  ],
  "message": "Messages retrieved successfully"
}
```

### 19. Listar Grupos
```http
GET /api/groups/:connectionId
Authorization: Bearer <token>
```

**Resposta (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "120363043123456789@g.us",
      "subject": "Grupo da Família",
      "owner": "5511999999999@s.whatsapp.net",
      "creation": 1704067200,
      "desc": "Grupo para conversas da família",
      "participants": [
        {
          "id": "5511999999999@s.whatsapp.net",
          "admin": "admin"
        }
      ],
      "size": 15
    }
  ],
  "message": "Groups retrieved successfully"
}
```

---

## 🔄 Status das Conexões

### Estados Possíveis:
- `connecting` - Conectando ao WhatsApp
- `qr_pending` - Aguardando escaneamento do QR Code
- `code_pending` - Aguardando inserção do código de emparelhamento
- `connected` - Conectado e funcionando
- `disconnected` - Desconectado

---

## 🚨 Tratamento de Erros

### Estrutura de Erro Padrão:
```json
{
  "success": false,
  "error": "Descrição do erro",
  "message": "Mensagem amigável para o usuário"
}
```

### Códigos de Status HTTP:
- `200` - Sucesso
- `201` - Criado com sucesso
- `400` - Dados inválidos
- `401` - Não autenticado
- `404` - Não encontrado
- `500` - Erro interno do servidor

---

## 🎯 Exemplos de Uso Frontend

### 1. Gerenciar Contatos Armazenados
```javascript
// Criar contato
const createContact = async (phoneNumber, name) => {
  const response = await fetch('/api/contacts-storage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ phoneNumber, name })
  });
  
  const result = await response.json();
  return result;
};

// Listar contatos
const loadContacts = async () => {
  const response = await fetch('/api/contacts-storage', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const { data: contacts } = await response.json();
  
  // Renderizar lista de contatos
  const contactList = document.getElementById('contact-list');
  contactList.innerHTML = contacts.map(contact => `
    <div class="contact-item" data-id="${contact.id}">
      <div class="contact-name">${contact.name || 'Sem nome'}</div>
      <div class="contact-phone">${contact.phoneNumber}</div>
      <button onclick="deleteContact('${contact.id}')">Remover</button>
    </div>
  `).join('');
};

// Importar contatos via TXT
const importContacts = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('/api/contacts-storage/import', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  
  const result = await response.json();
  
  if (result.success) {
    alert(`Importação concluída: ${result.data.imported} importados, ${result.data.skipped} ignorados`);
    loadContacts(); // Recarregar lista
  }
};
```

### 1. Fluxo de Autenticação
```javascript
// Login
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const { data } = await loginResponse.json();
const token = data.token;

// Salvar token para próximas requisições
localStorage.setItem('whatsapp_token', token);
```

### 2. Criar e Monitorar Conexão
```javascript
// Criar conexão
const connectionResponse = await fetch('/api/connection', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ pairingMethod: 'qr' })
});

const { data: connection } = await connectionResponse.json();
const connectionId = connection.connectionId;

// Exibir QR Code
document.getElementById('qr-code').src = connection.qrCode;

// Monitorar status da conexão
const checkStatus = async () => {
  const statusResponse = await fetch(`/api/connection/${connectionId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const { data: status } = await statusResponse.json();
  
  if (status.status === 'connected') {
    // Conexão estabelecida!
    loadChats();
  } else {
    // Continuar monitorando
    setTimeout(checkStatus, 2000);
  }
};

checkStatus();
```

### 3. Carregar e Exibir Chats
```javascript
const loadChats = async () => {
  const chatsResponse = await fetch(`/api/chats/${connectionId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const { data: chats } = await chatsResponse.json();
  
  // Renderizar lista de chats
  const chatList = document.getElementById('chat-list');
  chatList.innerHTML = chats.map(chat => `
    <div class="chat-item" onclick="openChat('${chat.id}')">
      <div class="chat-name">${chat.name}</div>
      <div class="chat-unread">${chat.unreadCount}</div>
    </div>
  `).join('');
};
```

### 4. Enviar Mensagem
```javascript
const sendMessage = async (to, message) => {
  const response = await fetch('/api/send-message', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      connectionId,
      to,
      message
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    // Mensagem enviada com sucesso
    addMessageToChat(to, message, true);
  } else {
    // Tratar erro
    showError(result.error);
  }
};
```

### 5. Upload e Envio de Arquivo
```javascript
const sendFile = async (to, file, caption = '') => {
  const formData = new FormData();
  formData.append('connectionId', connectionId);
  formData.append('to', to);
  formData.append('file', file);
  if (caption) formData.append('caption', caption);
  
  const response = await fetch('/api/send-file', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  
  const result = await response.json();
  return result;
};
```

---

## 🎨 Sugestões para o Frontend

### Componentes Essenciais:
1. **LoginForm** - Formulário de login/registro
2. **ConnectionManager** - Gerenciar conexões WhatsApp
3. **QRCodeDisplay** - Exibir QR Code para conexão
4. **ContactManager** - Gerenciar contatos armazenados
5. **ContactImport** - Importar contatos via TXT
6. **ChatList** - Lista de conversas
7. **ChatWindow** - Janela de conversa
8. **MessageInput** - Input para enviar mensagens
9. **FileUpload** - Upload de arquivos
10. **ContactList** - Lista de contatos do WhatsApp
11. **StatusIndicator** - Status da conexão

### Funcionalidades Recomendadas:
- ✅ Auto-refresh do status da conexão
- ✅ Notificações em tempo real
- ✅ Gerenciamento completo de contatos
- ✅ Importação de contatos via arquivo TXT
- ✅ Validação de números de telefone
- ✅ Upload de arquivos por drag & drop
- ✅ Preview de imagens/vídeos
- ✅ Busca em chats e contatos
- ✅ Modo escuro/claro
- ✅ Responsivo para mobile
- ✅ Indicadores de mensagem enviada/lida
- ✅ Emoji picker
- ✅ Histórico de mensagens paginado

### Tecnologias Sugeridas:
- **React/Vue/Angular** - Framework principal
- **Socket.io** - Para atualizações em tempo real (futuro)
- **Tailwind CSS** - Estilização
- **React Query/SWR** - Cache e sincronização de dados
- **Zustand/Redux** - Gerenciamento de estado
- **React Hook Form** - Formulários
- **Framer Motion** - Animações

---

## 🔧 Health Check

```http
GET /health
```

**Resposta:**
```json
{
  "success": true,
  "message": "WhatsApp API is running",
  "timestamp": "2024-01-01T10:00:00.000Z"
}
```

---

## 📝 Notas Importantes

1. **Autenticação JWT**: Todas as rotas do WhatsApp requerem token
2. **Isolamento por Usuário**: Cada usuário só acessa suas próprias conexões
3. **Reinicialização Automática**: Instâncias se reiniciam automaticamente quando necessário
4. **Dados em Tempo Real**: Chats, contatos e mensagens são sincronizados automaticamente
5. **Suporte a Arquivos**: Máximo 50MB por arquivo
6. **Números Brasileiros**: API testa automaticamente formatos com/sem 9
7. **Grupos**: Use JID completo terminado em `@g.us`
8. **Validação de Senhas**: Mínimo 6 caracteres, maiúscula, minúscula e número

---

Esta documentação fornece tudo que você precisa para criar um frontend completo e profissional para a API WhatsApp! 🚀