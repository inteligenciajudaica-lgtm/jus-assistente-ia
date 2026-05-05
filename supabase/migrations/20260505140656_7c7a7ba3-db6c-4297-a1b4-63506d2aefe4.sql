
CREATE TABLE public.document_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_versions_doc ON public.document_versions(document_id, created_at DESC);

ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own versions"
ON public.document_versions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own versions"
ON public.document_versions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own versions"
ON public.document_versions FOR DELETE
USING (auth.uid() = user_id);
