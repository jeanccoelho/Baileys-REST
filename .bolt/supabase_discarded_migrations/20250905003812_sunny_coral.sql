/*
  # Corrigir políticas RLS para tabela contacts

  1. Políticas RLS
    - Corrigir função uid() para auth.uid()
    - Garantir que usuários autenticados possam criar/ler/atualizar/deletar seus próprios contatos
  
  2. Segurança
    - Manter RLS habilitado
    - Políticas baseadas em auth.uid() = user_id
*/

-- Remover políticas existentes se houver problemas
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

-- Garantir que RLS está habilitado
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;