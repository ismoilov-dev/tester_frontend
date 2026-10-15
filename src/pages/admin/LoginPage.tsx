import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { login } from "../../api/admin";
import { toApiError } from "../../api/errors";
import { Button, Card, ErrorBox, Hint, Input, Label } from "../../components/ui";
import { useAuth } from "../../stores/auth";

const schema = z.object({
  email: z.string().email("Email noto'g'ri"),
  password: z.string().min(1, "Parolni kiriting"),
});
type Form = z.infer<typeof schema>;

export default function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const access = useAuth(s => s.access);
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });

  if (access) return <Navigate to="/admin" replace />;

  async function onSubmit(f: Form) {
    setError("");
    try {
      const r = await login(f.email, f.password);
      useAuth.getState().setTokens(r.access, r.refresh, r.user);
      nav((loc.state as any)?.from ?? "/admin", { replace: true });
    } catch (e) {
      const err = toApiError(e);
      if (err.status === 401) setError("Email yoki parol noto'g'ri");
      else if (err.status === 429) setError(`Juda ko'p urinish. ${err.details?.retry_after_seconds ? `${err.details.retry_after_seconds} s dan keyin` : "Biroz kuting"}`);
      else setError(err.message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-100 px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="gradient-aurora mb-6 h-10 w-10 rounded-full" />
        <h1 className="text-[28px] font-semibold leading-[34px] tracking-tight">Admin kirish</h1>
        <p className="mb-6 mt-1 text-ink-muted">Testlarni boshqarish uchun kiring.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <label className="block">
            <Label>Email</Label>
            <Input type="email" autoComplete="username" autoFocus {...register("email")} />
            <Hint error>{errors.email?.message}</Hint>
          </label>
          <label className="block">
            <Label>Parol</Label>
            <Input type="password" autoComplete="current-password" {...register("password")} />
            <Hint error>{errors.password?.message}</Hint>
          </label>
          <ErrorBox>{error}</ErrorBox>
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Kirish</Button>
        </form>
      </Card>
    </div>
  );
}
