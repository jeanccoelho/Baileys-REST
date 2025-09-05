# 🐘 Configuração do PostgreSQL

## 1. Instalar PostgreSQL

### macOS (Homebrew)
```bash
brew install postgresql@15
brew services start postgresql@15
```

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Windows
1. Baixe o instalador do [PostgreSQL.org](https://www.postgresql.org/download/windows/)
2. Execute o instalador e siga as instruções
3. Anote a senha do usuário `postgres`

## 2. Configurar Banco de Dados

### Conectar ao PostgreSQL
```bash
# macOS/Linux
sudo -u postgres psql

# Windows (no Command Prompt como Administrador)
psql -U postgres
```

### Criar banco e usuário
```sql
-- Criar banco de dados
CREATE DATABASE whatsapp_api;

-- Criar usuário (opcional, pode usar postgres)
CREATE USER whatsapp_user WITH PASSWORD 'sua_senha_aqui';

-- Dar permissões
GRANT ALL PRIVILEGES ON DATABASE whatsapp_api TO whatsapp_user;

-- Sair
\q
```

## 3. Configurar .env

Edite o arquivo `.env` com suas credenciais:

```env
# PostgreSQL Database
DATABASE_URL="postgresql://postgres:sua_senha@localhost:5432/whatsapp_api?schema=public"

# Ou se criou usuário específico:
# DATABASE_URL="postgresql://whatsapp_user:sua_senha@localhost:5432/whatsapp_api?schema=public"
```

## 4. Executar Migrações

```bash
# Gerar cliente Prisma
npm run db:generate

# Aplicar schema ao banco
npm run db:push

# (Opcional) Visualizar dados
npm run db:studio
```

## 5. Verificar Conexão

```bash
# Testar conexão
psql "postgresql://postgres:sua_senha@localhost:5432/whatsapp_api"

# Listar tabelas
\dt

# Sair
\q
```

## 🔧 Comandos Úteis

```bash
# Ver status do PostgreSQL
brew services list | grep postgresql  # macOS
sudo systemctl status postgresql      # Linux

# Parar/Iniciar PostgreSQL
brew services stop postgresql@15      # macOS
brew services start postgresql@15     # macOS
sudo systemctl stop postgresql        # Linux
sudo systemctl start postgresql       # Linux

# Reset do banco (cuidado!)
npm run db:reset
```

## 🚨 Troubleshooting

### Erro de conexão
1. Verifique se PostgreSQL está rodando
2. Confirme usuário e senha
3. Teste conexão manual com `psql`

### Erro de permissão
```sql
-- Conectar como postgres e dar permissões
sudo -u postgres psql
GRANT ALL PRIVILEGES ON DATABASE whatsapp_api TO seu_usuario;
```

### Porta ocupada
```bash
# Ver qual processo usa a porta 5432
lsof -i :5432

# Matar processo se necessário
sudo kill -9 PID
```