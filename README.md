# WhatsApp REST API com Baileys

API REST completa para WhatsApp usando a biblioteca Baileys v6.7.19.

## Instalação

```bash
npm install
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

## Endpoints Disponíveis

### Conexões

#### `POST /api/connection`
Cria uma nova conexão WhatsApp e retorna QR Code para escaneamento.

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
Valida uma conexão usando código de emparelhamento.

**Body:**
```json
{
  "connectionId": "uuid-v4",
  "code": "codigo-de-emparelhamento"
}
```

#### `DELETE /api/connection/:connectionId`
Remove uma conexão específica.

#### `GET /api/connection`
Lista todas as conexões ativas.

### Mensagens

#### `POST /api/send-message`
Envia mensagem de texto.

**Body:**
```json
{
  "connectionId": "uuid-v4",
  "to": "5511999999999",
  "message": "Olá, mundo!"
}
```

#### `POST /api/send-file`
Envia arquivo com caption opcional.

**Form Data:**
- `connectionId`: ID da conexão
- `to`: Número do destinatário
- `caption`: Legenda do arquivo (opcional)
- `file`: Arquivo a ser enviado

#### `POST /api/validate-number`
Valida se um número está no WhatsApp e retorna informações disponíveis.

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
Lista todos os contatos da conexão.

#### `GET /api/groups/:connectionId`
Lista todos os grupos da conexão.

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

1. **Sessões**: Cada conexão cria uma sessão independente salva em `auth_sessions/`
2. **Arquivos**: Suporte para envio de imagens, vídeos, áudios e documentos
3. **QR Code**: Gerado automaticamente como Data URL
4. **Múltiplas Conexões**: Suporte para múltiplas instâncias WhatsApp simultâneas
5. **Tratamento de Erros**: Sistema robusto de logs e tratamento de erros
6. **TypeScript**: Tipagem completa para maior segurança

## Health Check

Acesse `GET /health` para verificar se a API está funcionando.