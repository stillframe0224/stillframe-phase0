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
          __html: `window.__SUPABASE_CONFIG__=${JSON.stringify({ url: supabaseUrl, key: supabaseAnonKey })};(function(){var _a=${JSON.stringify(e2eAllowed)};var _h=location.hostname;var _ok=_a&&(_h==="localhost"||_h==="127.0.0.1");Object.defineProperty(window,"__E2E_ALLOWED__",{value:_ok,writable:false,configurable:false});if(!_ok&&new URLSearchParams(location.search).get("e2e")==="1"){console.warn("[shinen] e2e bypass attempted on non-localhost host: "+_h+" — request ignored");}})()`,
        }}
      />
      {children}
    </>
  );
}
