"use client";

export default function BookmarkletPage() {
  const bookmarkletCode = `javascript:void((function(){var u=location.href;function mc(q){var el=document.querySelector(q);return el?((el.content||el.getAttribute('content')||'').trim()):''}var t=(mc('meta[property="og:title"]')||mc('meta[name="twitter:title"]')||document.title||'').slice(0,200);var desc=(mc('meta[property="og:description"]')||mc('meta[name="description"]')||mc('meta[name="twitter:description"]')||'').replace(/[\\r\\n]+/g,' ').slice(0,300);var s=mc('meta[property="og:site_name"]');var sel=(window.getSelection()||'').toString().slice(0,1200);function norm(r){if(!r)return null;var x=r.trim();if(!x)return null;if(x.startsWith('//')){x='https:'+x}if(x.startsWith('/')&&u){try{x=new URL(x,u).href}catch(e){return null}}if(!/^https?:\\/\\//.test(x))return null;return x.slice(0,2000)}function getImg(){var cs=[];function add(v){if(!v)return;if(typeof v==='string'){cs.push(v)}else if(Array.isArray(v)){v.forEach(add)}else if(v.url){cs.push(v.url)}}var metas=document.querySelectorAll('meta[property="og:image"],meta[property="og:image:secure_url"],meta[property="og:image:url"],meta[name="twitter:image"],meta[property="twitter:image"]');metas.forEach(function(m){add(m.content)});var lnk=document.querySelector('link[rel="image_src"]');if(lnk)add(lnk.href);var lds=document.querySelectorAll('script[type="application/ld+json"]');lds.forEach(function(ld){try{var j=JSON.parse(ld.textContent||'{}');if(j['@graph']){j['@graph'].forEach(function(g){add(g.image||g.thumbnailUrl)})}else{add(j.image||j.thumbnailUrl)}}catch(e){}});var az=document.querySelector('#landingImage');if(az){var h=az.getAttribute('data-old-hires');if(h)add(h);var d=az.getAttribute('data-a-dynamic-image');if(d){try{var o=JSON.parse(d),ks=Object.keys(o);if(ks.length){ks.sort(function(a,b){return(o[b][0]*o[b][1])-(o[a][0]*o[a][1])});add(ks[0])}}catch(e){}}}var azw=document.querySelector('#imgTagWrapperId img');if(azw)add(azw.src||azw.getAttribute('data-a-dynamic-image'));var azm=document.querySelectorAll('img[data-a-dynamic-image]');azm.forEach(function(im){var dd=im.getAttribute('data-a-dynamic-image');if(dd){try{var oo=JSON.parse(dd),kks=Object.keys(oo);if(kks.length){kks.sort(function(a,b){return(oo[b][0]*oo[b][1])-(oo[a][0]*oo[a][1])});add(kks[0])}}catch(e){}}});var fz=null;var imgs=document.querySelectorAll('img');imgs.forEach(function(im){var src=im.currentSrc||im.src||im.getAttribute('data-src')||im.getAttribute('data-original')||'';if(src&&(src.includes('pics.dmm.co.jp')||src.includes('dmm.co.jp'))){if(!fz||im.naturalWidth*im.naturalHeight>5000){fz=src}}});if(fz)cs.unshift(fz);for(var i=0;i<cs.length;i++){var n=norm(cs[i]);if(n)return n}return null}var img=getImg()||'';window.open('https://stillframe-phase0.vercel.app/app?auto=1&url='+encodeURIComponent(u)+'&title='+encodeURIComponent(t)+(desc?'&desc='+encodeURIComponent(desc):'')+(img?'&img='+encodeURIComponent(img):'')+(s?'&site='+encodeURIComponent(s.slice(0,100)):'')+(sel?'&s='+encodeURIComponent(sel):''),'_blank')})())`;

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
            background: "var(--accent-soft)",
            border: "1.5px solid var(--accent-mid)",
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
              background: "var(--accent-strong)",
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
              color: "var(--accent-strong)",
              textDecoration: "none",
              fontFamily: "var(--font-dm)",
            }}
          >
            Go to App →
          </a>
          <a
            href="/"
            style={{
              fontSize: 13,
              color: "#999",
              textDecoration: "none",
              fontFamily: "var(--font-dm)",
            }}
          >
            Back to Home
          </a>
        </div>

        {/* Technical details */}
        <div
          style={{
            marginTop: 48,
            padding: "16px 20px",
            borderRadius: 12,
            background: "#f9f9f9",
            border: "1px solid #e0e0e0",
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#2a2a2a", marginBottom: 8 }}>
            Enhanced image extraction
          </h3>
          <p style={{ fontSize: 12, color: "#777", lineHeight: 1.6, marginBottom: 8 }}>
            Supports: Open Graph, Twitter Cards, JSON-LD, Amazon product images, FANZA/DMM media
          </p>
          <ul style={{ fontSize: 11, color: "#999", lineHeight: 1.6, paddingLeft: 20 }}>
            <li>Amazon: #landingImage data-a-dynamic-image (largest resolution)</li>
            <li>FANZA/DMM: pics.dmm.co.jp images (auto-detected)</li>
            <li>Protocol-relative URLs (//...) auto-converted to https://</li>
            <li>Encoded URLs automatically normalized</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
