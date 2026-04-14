import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [oabNumber, setOabNumber] = useState("");
  const [oabState, setOabState] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, oab_number: oabNumber, oab_state: oabState },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({
          title: "Cadastro realizado!",
          description: "Verifique seu e-mail para confirmar a conta.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="size-10 bg-primary rounded flex items-center justify-center text-primary-foreground font-mono font-bold">
              JA
            </div>
            <span className="font-semibold tracking-tight text-2xl">JURIS AI</span>
          </div>
          <p className="text-muted-foreground text-sm">
            {isLogin ? "Acesse sua conta" : "Crie sua conta"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-sm p-8 space-y-5">
          {!isLogin && (
            <>
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dr. João Silva" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="oabNumber">Nº OAB</Label>
                  <Input id="oabNumber" value={oabNumber} onChange={(e) => setOabNumber(e.target.value)} placeholder="123.456" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="oabState">Estado</Label>
                  <Input id="oabState" value={oabState} onChange={(e) => setOabState(e.target.value)} placeholder="SP" maxLength={2} />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Aguarde..." : isLogin ? "Entrar" : "Criar Conta"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}
            <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-accent underline">
              {isLogin ? "Cadastre-se" : "Faça login"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
