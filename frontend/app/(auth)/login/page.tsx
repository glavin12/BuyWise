import LoginForm from "./login-form";

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ auth_error?: string }>;
}) {
  const params = await searchParams;
  return <LoginForm authError={Boolean(params.auth_error)} />;
}
