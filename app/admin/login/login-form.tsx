'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { adminSignInSchema } from '@/lib/validation/schemas';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/states';
import { cn } from '@/lib/utils';
import type { z } from 'zod';

type FormValues = z.infer<typeof adminSignInSchema>;

/**
 * Admin sign-in.
 *
 * Supabase Auth handles the credential exchange; this form only collects and
 * validates. Failures are reported generically — telling an attacker that an
 * email exists but the password is wrong is a free account-enumeration oracle,
 * so a wrong password and an unknown account read identically.
 */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(adminSignInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);

    startTransition(async () => {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (authError) {
        setError('بيانات الدخول غير صحيحة.');
        return;
      }

      // A full navigation, not router.push: the middleware needs to see the
      // fresh session cookie before the guarded layout renders.
      router.replace(next);
      router.refresh();
    });
  });

  const inputClass = (hasError: boolean) =>
    cn(
      'h-12 w-full rounded-lg border bg-white px-4 text-base text-ink-800',
      'placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-burgundy-500/30',
      hasError ? 'border-[#C2485A]' : 'border-ink-300 focus:border-burgundy-500',
    );

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-5 rounded-xl border border-ink-200 bg-white p-6"
    >
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-ink-700">
          البريد الإلكتروني
        </label>
        <input
          id="email"
          type="email"
          dir="ltr"
          autoComplete="username"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className={cn(inputClass(Boolean(errors.email)), 'text-left')}
          {...register('email')}
        />
        {errors.email && (
          <p id="email-error" role="alert" className="text-xs font-medium text-[#C2485A]">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium text-ink-700">
          كلمة المرور
        </label>
        <input
          id="password"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? 'password-error' : undefined}
          className={cn(inputClass(Boolean(errors.password)), 'text-left')}
          {...register('password')}
        />
        {errors.password && (
          <p id="password-error" role="alert" className="text-xs font-medium text-[#C2485A]">
            {errors.password.message}
          </p>
        )}
      </div>

      {error && <InlineError message={error} />}

      <Button type="submit" size="lg" fullWidth loading={isPending} loadingLabel="جارٍ الدخول…">
        <LogIn className="size-4" aria-hidden="true" />
        تسجيل الدخول
      </Button>
    </form>
  );
}
