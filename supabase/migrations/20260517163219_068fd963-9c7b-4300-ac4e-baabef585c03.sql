CREATE TABLE public.tracked_processes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  case_id UUID,
  numero_processo TEXT NOT NULL,
  tribunal TEXT NOT NULL,
  nickname TEXT,
  classe TEXT,
  assuntos JSONB DEFAULT '[]'::jsonb,
  orgao_julgador TEXT,
  data_ajuizamento TIMESTAMPTZ,
  grau TEXT,
  ultimo_movimento TEXT,
  ultimo_movimento_data TIMESTAMPTZ,
  movimentos_count INTEGER NOT NULL DEFAULT 0,
  raw_data JSONB,
  last_synced_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tracked_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tracked processes"
ON public.tracked_processes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tracked processes"
ON public.tracked_processes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tracked processes"
ON public.tracked_processes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tracked processes"
ON public.tracked_processes FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_tracked_processes_user ON public.tracked_processes(user_id, updated_at DESC);
CREATE INDEX idx_tracked_processes_numero ON public.tracked_processes(numero_processo);
CREATE UNIQUE INDEX idx_tracked_processes_user_numero ON public.tracked_processes(user_id, numero_processo);

CREATE TRIGGER update_tracked_processes_updated_at
BEFORE UPDATE ON public.tracked_processes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();