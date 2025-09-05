# 🔧 Configuração do Supabase

## 1. Obter Credenciais

### Acesse seu projeto no Supabase:
1. Vá para [supabase.com](https://supabase.com)
2. Acesse seu projeto: `sdpugrsgyqiykwowaswj`
3. Vá em **Settings > API**

### Copie as credenciais:
- **Project URL**: `https://sdpugrsgyqiykwowaswj.supabase.co` ✅ (já configurada)
- **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` ✅ (já configurada)
- **service_role key**: ⚠️ **PRECISA CONFIGURAR**

## 2. Configurar no .env

Adicione a service role key no seu arquivo `.env`:

```env
# Supabase
VITE_SUPABASE_URL=https://sdpugrsgyqiykwowaswj.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkcHVncnNneXFpeWt3b3dhc3dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjQ2NjUsImV4cCI6MjA3MjYwMDY2NX0.Fcor5cbZfPgrhhC4pYbk_7Vpqf7IN5xdI3beSyHSq4Y
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-aqui
```

## 3. Executar Migration

No **SQL Editor** do Supabase, execute:

```sql
-- Corrigir políticas RLS para tabela contacts
DROP POLICY IF EXISTS "Users can create own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can read own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete own contacts" ON contacts;

-- Recriar políticas com sintaxe correta
CREATE POLICY "Users can create own contacts"
  ON contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can read own contacts"
  ON contacts
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can update own contacts"
  ON contacts
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own contacts"
  ON contacts
  FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);
```

## 4. Reiniciar Servidor

```bash
yarn dev
```

## ⚠️ Importante

A **service_role key** tem privilégios administrativos e bypassa o RLS. 
É segura para usar no backend, mas nunca exponha no frontend!