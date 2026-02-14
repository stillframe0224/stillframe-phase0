"use client";

export default function BookmarkletPage() {
  const bookmarkletCode = `javascript:void((function(){var u=location.href,t=(document.title||'').slice(0,200),s=(document.querySelector('meta[property="og:site_name"]')||{}).content||'',sel=(window.getSelection()||'').toString().slice(0,1200),img='';function getImg(){var m=document.querySelector('meta[property="og:image"]')||document.querySelector('meta[property="og:image:secure_url"]')||document.querySelector('meta[name="twitter:image"]')||document.querySelector('meta[property="twitter:image"]')||document.querySelector('link[rel="image_src"]');if(m)return(m.content||m.href||'').slice(0,2000);var ld=document.querySelector('script[type="application/ld+json"]');if(ld){try{var j=JSON.parse(ld.textContent||'');if(j.image)return(typeof j.image==='string'?j.image:(j.image.url||j.image[0]||'')).slice(0,2000)}catch(e){}}var az=document.querySelector('#landingImage');if(az){var h=az.getAttribute('data-old-hires');if(h&&/^https?:\\/\\//.test(h))return h.slice(0,2000);var d=az.getAttribute('data-a-dynamic-image');if(d){try{var o=JSON.parse(d),k=Object.keys(o);if(k.length)return k.sort((a,b)=>(o[b][0]*o[b][1])-(o[a][0]*o[a][1]))[0].slice(0,2000)}catch(e){}}}return''}img=getImg();window.open('https://stillframe-phase0.vercel.app/app?auto=1&url='+encodeURIComponent(u)+'&title='+encodeURIComponent(t)+(img?'&img='+encodeURIComponent(img):'')+(s?'&site='+encodeURIComponent(s.slice(0,100)):'')+(sel?'&s='+encodeURIComponent(sel):''),'_blank')})())`;

  return (
    <div
      style={{
        minHeight: "100vh",
        fontFamily: "var(--font-dm), system-ui, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 520, width: "100%" }}>
        <a
          href="/"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 600,
            color: "#2a2a2a",
            textDecoration: "none",
            letterSpacing: "-0.01em",
          }}
        >
          SHINEN
        </a>

        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: "#2a2a2a",
            marginTop: 24,
            marginBottom: 8,
          }}
        >
          Bookmarklet
        </h1>
        <p style={{ fontSize: 14, color: "#777", lineHeight: 1.6, marginBottom: 24 }}>
          Save any page to SHINEN with one click. Drag the link below to your
          bookmark bar, then click it on any page to automatically save
          the URL and title as a card.
        </p>

        {/* Bookmarklet drag target */}
        <div
          style={{
            padding: "16px 20px",
            borderRadius: 12,
            background: "#FFF8F0",
            border: "1.5px solid #F5C882",
            marginBottom: 24,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 12, color: "#999", marginBottom: 10 }}>
            Drag this to your bookmark bar:
          </p>
          <a
            href={bookmarkletCode}
            onClick={(e) => e.preventDefault()}
            style={{
              display: "inline-block",
              padding: "8px 20px",
              borderRadius: 8,
              background: "#D9A441",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              fontFamily: "var(--font-dm)",
              cursor: "grab",
            }}
          >
            + Save to SHINEN
          </a>
        </div>

        {/* Instructions */}
        <ol style={{ fontSize: 13, color: "#555", lineHeight: 1.8, paddingLeft: 20 }}>
          <li>Drag the button above to your bookmark bar</li>
          <li>Visit any page you want to save</li>
          <li>Click &quot;+ Save to SHINEN&quot; in your bookmarks</li>
          <li>SHINEN opens and saves the page automatically</li>
          <li>A green &quot;Saved&quot; banner confirms success</li>
        </ol>

        <div style={{ marginTop: 32, display: "flex", gap: 16 }}>
          <a
            href="/app"
            style={{
              fontSize: 13,
              color: "#D9A441",
              textDecoration: "none",
              fontFamily: "var(--font-dm)",
            }}
          >
            Back to app
          </a>
        </div>
      </div>
    </div>
  );
}
