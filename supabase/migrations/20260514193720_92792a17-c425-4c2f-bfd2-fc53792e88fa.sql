-- Adicionar colunas de metadados em generated_documents
ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS word_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revision_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS area_of_law text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Trigger para manter updated_at sincronizado
DROP TRIGGER IF EXISTS update_generated_documents_updated_at ON public.generated_documents;
CREATE TRIGGER update_generated_documents_updated_at
BEFORE UPDATE ON public.generated_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Política de UPDATE (faltava — autosave/edição precisa)
DROP POLICY IF EXISTS "Users can update own generated documents" ON public.generated_documents;
CREATE POLICY "Users can update own generated documents"
ON public.generated_documents
FOR UPDATE
USING (auth.uid() = user_id);

-- Índices úteis para o painel de casos (filtros/ordenação)
CREATE INDEX IF NOT EXISTS idx_generated_documents_case_id ON public.generated_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_generated_documents_user_updated ON public.generated_documents(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_documents_area ON public.generated_documents(area_of_law);