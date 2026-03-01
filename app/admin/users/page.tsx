"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  companyId: string;
  createdAt: string;
};

async function fetchUsers(): Promise<User[]> {
  const res = await fetch("/api/users");
  if (!res.ok) throw new Error("Falha ao carregar usuários");
  const data = await res.json();
  return data.users ?? [];
}

async function createUser(payload: any) {
  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Falha ao criar usuário");
  }
  return res.json();
}

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const { data: users, error, isLoading } = useQuery({ queryKey: ["users"], queryFn: fetchUsers });

  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState("USER");
  const [msg, setMsg] = React.useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      setMsg("Usuário criado!");
      setEmail("");
      setName("");
      setPassword("");
      setRole("USER");
      await qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Admin · Usuários</h1>

      <Card>
        <CardHeader>
          <CardTitle>Criar usuário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input placeholder="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Input placeholder="Role (ADMIN/USER)" value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
          <Button onClick={() => createMut.mutate({ email, name, password, role })} disabled={createMut.isPending}>
            {createMut.isPending ? "Criando..." : "Criar"}
          </Button>
          {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p>Carregando...</p>}
          {error && <p className="text-red-600">Erro ao carregar.</p>}
          <div className="space-y-2">
            {(users ?? []).map((u) => (
              <div key={u.id} className="flex items-center justify-between border rounded p-3">
                <div>
                  <div className="font-medium">
                    {u.name} <span className="text-xs text-muted-foreground">({u.role})</span>
                  </div>
                  <div className="text-sm text-muted-foreground">{u.email}</div>
                </div>
                <div className="text-sm">{u.isActive ? "Ativo" : "Inativo"}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
