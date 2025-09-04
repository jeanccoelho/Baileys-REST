# WhatsApp REST API com Baileys

API REST completa para WhatsApp usando a biblioteca Baileys v6.7.19.

## Funcionalidades

- ✅ **WhatsApp Multi-Instância**: Múltiplas conexões simultâneas
- ✅ **Autenticação JWT**: Sistema completo de usuários
- ✅ **Envio de Mensagens**: Texto e arquivos
- ✅ **QR Code e Pairing Code**: Dois métodos de conexão
- ✅ **Validação de Números**: Verificar se número está no WhatsApp
- ✅ **Recuperação de Senha**: Sistema de reset por email

## Instalação

```bash
npm install
```

## Configuração

1. Copie o arquivo de exemplo:
```bash
cp .env.example .env
```

2. Configure as variáveis de ambiente no arquivo `.env`:
```env
# JWT Secret (OBRIGATÓRIO - mude em produção)
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Email SMTP (para recuperação de senha)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## Desenvolvimento

```bash
npm run dev
```

## Build e Produção

```bash
npm run build
npm start
```

## 🔐 Endpoints de Autenticação

### `POST /api/auth/register`
Registra um novo usuário.

**Body:**
```json
{
  "name": "João Silva",
  "email": "joao@exemplo.com",
  "password": "MinhaSenh@123"
}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "João Silva",
      "email": "joao@exemplo.com",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "jwt-token-aqui"
  }
}
```

### `POST /api/auth/login`
Autentica um usuário.

**Body:**
```json
{
  "email": "joao@exemplo.com",
  "password": "MinhaSenh@123"
}
```

### `POST /api/auth/forgot-password`
Solicita recuperação de senha.

**Body:**
```json
{
  "email": "joao@exemplo.com"
}
```

### `POST /api/auth/reset-password`
Redefine a senha usando token.

**Body:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "NovaSenha@123"
}
```

### `PUT /api/auth/update-password`
Atualiza senha (requer autenticação).

**Headers:**
```
Authorization: Bearer jwt-token-aqui
```

**Body:**
```json
{
  "currentPassword": "SenhaAtual@123",
  "newPassword": "NovaSenha@123"
}
```

### `GET /api/auth/profile`
Obtém perfil do usuário (requer autenticação).

**Headers:**
```
Authorization: Bearer jwt-token-aqui
```

## 📱 Endpoints do WhatsApp

**⚠️ IMPORTANTE: Todas as rotas do WhatsApp agora requerem autenticação JWT!**

**Headers obrigatórios:**
```
Authorization: Bearer jwt-token-aqui
```

### Conexões

#### `POST /api/connection`
Cria uma nova conexão WhatsApp e retorna QR Code para escaneamento (requer autenticação).

**Headers:**
```
Authorization: Bearer jwt-token-aqui
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "connectionId": "uuid-v4",
    "qrCode": "data:image/png;base64,..."
  }
}
```

#### `PUT /api/connection`
Valida uma conexão usando código de emparelhamento (requer autenticação).

**Headers:**
```
Authorization: Bearer jwt-token-aqui
```

**Body:**
```json
{
  "connectionId": "uuid-v4",
  "code": "codigo-de-emparelhamento"
}
```

#### `DELETE /api/connection/:connectionId`
Remove uma conexão específica (requer autenticação).

**Headers:**
```
Authorization: Bearer jwt-token-aqui
```

#### `GET /api/connection`
Lista todas as conexões ativas do usuário autenticado (requer autenticação).

**Headers:**
```
Authorization: Bearer jwt-token-aqui
```

### Mensagens

#### `POST /api/send-message`
Envia mensagem de texto (requer autenticação).

**Headers:**
```
Authorization: Bearer jwt-token-aqui
```

**Body:**
```json
{
  "connectionId": "uuid-v4",
  "to": "5511999999999",
  "message": "Olá, mundo!"
}
```

#### `POST /api/send-file`
Envia arquivo com caption opcional (requer autenticação).

**Headers:**
```
Authorization: Bearer jwt-token-aqui
```

**Form Data:**
- `connectionId`: ID da conexão
- `to`: Número do destinatário
- `caption`: Legenda do arquivo (opcional)
- `file`: Arquivo a ser enviado

#### `POST /api/validate-number`
Valida se um número está no WhatsApp e retorna informações disponíveis (requer autenticação).

**Headers:**
```
Authorization: Bearer jwt-token-aqui
```

**Body:**
```json
{
  "connectionId": "uuid-v4",
  "number": "5511999999999"
}
```

**Resposta:**
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

### Contatos e Grupos

#### `GET /api/contacts/:connectionId`
Lista todos os contatos da conexão (requer autenticação).

**Headers:**
```
Authorization: Bearer jwt-token-aqui
```

#### `GET /api/groups/:connectionId`
Lista todos os grupos da conexão (requer autenticação).

**Headers:**
```
Authorization: Bearer jwt-token-aqui
```

## Estrutura do Projeto

```
src/
├── controllers/     # Controladores das rotas
├── services/        # Lógica de negócio
├── types/          # Definições de tipos TypeScript
├── middleware/     # Middlewares customizados
├── routes/         # Definição das rotas
├── utils/          # Utilitários
├── app.ts          # Configuração do Express
└── server.ts       # Servidor principal
```

## Logs

Os logs são salvos em:
- `logs/error.log` - Apenas erros
- `logs/combined.log` - Todos os logs

## Observações Importantes

1. **Autenticação Obrigatória**: Todas as rotas do WhatsApp agora requerem JWT token
2. **Isolamento por Usuário**: Cada usuário só acessa suas próprias conexões
1. **Sessões**: Cada conexão cria uma sessão independente salva em `auth_sessions/`
3. **Autenticação**: Sistema JWT com tokens que expiram em 7 dias
4. **Senhas**: Validação rigorosa (maiúscula, minúscula, número, 6+ caracteres)
5. **Email**: Sistema de recuperação de senha via SMTP
6. **Arquivos**: Suporte para envio de imagens, vídeos, áudios e documentos
7. **QR Code**: Gerado automaticamente como Data URL
8. **Múltiplas Conexões**: Suporte para múltiplas instâncias WhatsApp simultâneas
9. **Tratamento de Erros**: Sistema robusto de logs e tratamento de erros
10. **TypeScript**: Tipagem completa para maior segurança

## 🔒 Segurança

- **Senhas**: Hash com bcrypt (12 rounds)
- **JWT**: Tokens assinados e com expiração
- **Validação**: Entrada validada em todos os endpoints
- **Rate Limiting**: Recomendado implementar em produção
- **HTTPS**: Obrigatório em produção

## Health Check

Acesse `GET /health` para verificar se a API está funcionando.