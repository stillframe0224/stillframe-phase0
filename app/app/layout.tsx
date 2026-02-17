export const dynamic = "force-dynamic";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const e2eAllowed = process.env.E2E === "1";

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__SUPABASE_CONFIG__=${JSON.stringify({ url: supabaseUrl, key: supabaseAnonKey })};Object.defineProperty(window,"__E2E_ALLOWED__",{value:${JSON.stringify(e2eAllowed)}&&(location.hostname==="localhost"||location.hostname==="127.0.0.1"),writable:false,configurable:false})`,
        }}
      />
      {children}
    </>
  );
}
