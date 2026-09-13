"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <Card className="w-full max-w-md">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-[#E9F5EE] rounded-full flex items-center justify-center mx-auto border border-[#C7E4D2]">
            <svg
              className="w-6 h-6 text-positive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="serif text-2xl text-primary">
            Check your email
          </h2>
          <p className="text-sm text-secondary">
            We sent a confirmation link to <strong>{email}</strong>. Please
            verify your email to continue.
          </p>
          <Link href="/login">
            <Button variant="secondary" className="mt-4">
              Back to Login
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="serif text-3xl text-primary">
            Create an account
          </h1>
          <p className="text-sm text-secondary mt-1">
            Start your smart finance journey with BuyWise
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="email"
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            id="password"
            label="Password"
            type="password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Input
            id="confirmPassword"
            label="Confirm Password"
            type="password"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          {error && (
            <div className="p-3 bg-[#FCE9E5] border border-[#F4C7BF] rounded-xl">
              <p className="text-sm text-negative">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full" loading={loading}>
            Create account
          </Button>
        </form>

        <p className="text-center text-sm text-secondary">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-primary font-medium underline hover:opacity-70"
          >
            Sign in
          </Link>
        </p>
      </div>
    </Card>
  );
}
