/*
  # Criar tabela de contatos

  1. Nova Tabela
    - `contacts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key para auth.users)
      - `phone_number` (text, único por usuário)
      - `name` (text, opcional)
      - `whatsapp_exists` (boolean, null por padrão)
      - `whatsapp_jid` (text, JID do WhatsApp se existir)
      - `whatsapp_status` (text, status do usuário no WhatsApp)
      - `whatsapp_picture` (text, URL da foto de perfil)
      - `whatsapp_business` (boolean, se é conta business)
      - `whatsapp_verified_name` (text, nome verificado)
      - `last_whatsapp_check` (timestamptz, última verificação)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Segurança
    - Habilitar RLS na tabela `contacts`
    - Políticas para usuários autenticados acessarem apenas seus contatos

  3. Índices
    - Índice único em (user_id, phone_number)
    - Índice em user_id para consultas rápidas
*/

-- Criar tabela de contatos
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  phone_number text NOT NULL,
  name text,
  whatsapp_exists boolean DEFAULT null,
  whatsapp_jid text,
  whatsapp_status text,
  whatsapp_picture text,
  whatsapp_business boolean DEFAULT false,
  whatsapp_verified_name text,
  last_whatsapp_check timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar índice único para phone_number por usuário
CREATE UNIQUE INDEX IF NOT EXISTS contacts_user_phone_unique 
ON contacts(user_id, phone_number);

-- Criar índice para consultas por usuário
CREATE INDEX IF NOT EXISTS contacts_user_id_idx ON contacts(user_id);

-- Criar índice para consultas por número
CREATE INDEX IF NOT EXISTS contacts_phone_number_idx ON contacts(phone_number);

-- Habilitar RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Política para usuários autenticados lerem seus próprios contatos
CREATE POLICY "Users can read own contacts"
  ON contacts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Política para usuários autenticados criarem seus próprios contatos
CREATE POLICY "Users can create own contacts"
  ON contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Política para usuários autenticados atualizarem seus próprios contatos
CREATE POLICY "Users can update own contacts"
  ON contacts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política para usuários autenticados removerem seus próprios contatos
CREATE POLICY "Users can delete own contacts"
  ON contacts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();