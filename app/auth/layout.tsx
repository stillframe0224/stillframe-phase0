export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__SUPABASE_CONFIG__=${JSON.stringify({ url: supabaseUrl, key: supabaseAnonKey })}`,
        }}
      />
      {children}
    </>
  );
}
