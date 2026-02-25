"use client";

export default function BookmarkletPage() {
  const bookmarkletCore = `
    (function () {
      var u = location.href;
      function mc(q) {
        var el = document.querySelector(q);
        return el ? ((el.content || el.getAttribute("content") || "").trim()) : "";
      }
      function canonicalUrl(raw) {
        try {
          var p = new URL(raw);
          p.hash = "";
          var drop = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id", "fbclid", "gclid"];
          for (var i = 0; i < drop.length; i++) p.searchParams.delete(drop[i]);
          return p.toString();
        } catch (e) {
          return raw;
        }
      }
      u = canonicalUrl(u);
      function upgradeIg(raw) {
        if (!raw) return raw;
        var h = "";
        try { h = new URL(raw, u).hostname.toLowerCase(); } catch (e) { return raw; }
        if (!(h.includes("instagram.") || h.includes("cdninstagram.com") || h.includes("fbcdn.net"))) return raw;
        return raw.replace(/([/_])(p|s)(150|240|320|480|540|640|720|750)x\\3(?=([/_\\\\.-]|$))/gi, "$1$21080x1080");
      }
      function upgradeXOrig(raw) {
        var abs = norm(raw);
        if (!abs) return null;
        try {
          var p = new URL(abs);
          var host = (p.hostname || "").toLowerCase();
          if (!host.includes("twimg.com")) return p.toString();
          p.pathname = p.pathname.replace(/:(small|medium|large|orig)$/i, ":orig");
          var name = (p.searchParams.get("name") || "").toLowerCase();
          if (!name || name === "small" || name === "medium" || name === "large" || name === "thumb") {
            p.searchParams.set("name", "orig");
          }
          return p.toString();
        } catch (e) {
          return abs;
        }
      }
      function norm(r) {
        if (!r) return null;
        var x = String(r).replace(/&amp;/gi, "&").trim();
        if (!x) return null;
        if (x.startsWith("//")) x = "https:" + x;
        if (x.startsWith("/")) { try { x = new URL(x, u).href; } catch (e) { return null; } }
        if (!/^https?:\\/\\//i.test(x)) return null;
        return upgradeIg(x).slice(0, 2000);
      }
      function isUiAsset(src) {
        var low = String(src || "").toLowerCase();
        if (!low) return true;
        if (low.startsWith("data:")) return true;
        if (/\\.svg(\\?|$)/i.test(low)) return true;
        return /(favicon|sprite|emoji|icon|avatar|profile)/i.test(low);
      }
      function parseSrcsetMax(raw) {
        if (!raw) return null;
        var best = null;
        var maxW = 0;
        var entries = String(raw).split(",");
        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i].trim();
          if (!entry) continue;
          var bits = entry.split(/\\s+/).filter(Boolean);
          if (!bits.length) continue;
          var src = norm(bits[0]);
          if (!src || isUiAsset(src)) continue;
          var descriptor = bits[bits.length - 1] || "";
          var w = /\\d+w$/i.test(descriptor) ? Number(descriptor.slice(0, -1)) : 1;
          if (!best || w > maxW) {
            best = { src: src, w: w };
            maxW = w;
          }
        }
        return best;
      }
      function pickLargestNatural(matchFn) {
        var best = null;
        Array.prototype.forEach.call(document.images || [], function (im) {
          var src = (im.currentSrc || im.src || im.getAttribute("data-src") || im.getAttribute("data-original") || "").trim();
          if (!src) return;
          var n = norm(src);
          if (!n || isUiAsset(n)) return;
          if (typeof matchFn === "function" && !matchFn(n, im)) return;
          var w = Number(im.naturalWidth || im.width || 0);
          var h = Number(im.naturalHeight || im.height || 0);
          if (w < 200 || h < 200) return;
          var area = w * h;
          if (!best || area > best.area) best = { src: n, area: area };
        });
        return best ? best.src : null;
      }
      function pickInstagramLargest() {
        var host = (location.hostname || "").toLowerCase();
        if (!(host.includes("instagram.") || host === "instagr.am")) return null;
        var bestSrcset = null;
        var bestW = 0;
        var srcsetNodes = document.querySelectorAll("img[srcset]");
        srcsetNodes.forEach(function (im) {
          var candidate = parseSrcsetMax(im.getAttribute("srcset") || im.srcset || "");
          if (!candidate) return;
          var w = Number(candidate.w || 1);
          if (!bestSrcset || w > bestW) {
            bestSrcset = candidate.src;
            bestW = w;
          }
        });
        if (bestSrcset) return norm(bestSrcset);
        return pickLargestNatural();
      }
      function detectXEmbed(rawUrl) {
        try {
          var parsed = new URL(rawUrl);
          var host = (parsed.hostname || "").toLowerCase();
          if (!(host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com"))) return null;
          var m = parsed.pathname.match(/^\\/([^/]+)\\/status(?:es)?\\/(\\d+)/i);
          if (!m) return null;
          var tweetUrl = "https://x.com/" + m[1] + "/status/" + m[2];
          return {
            mk: "embed",
            provider: "x",
            embed: "https://platform.twitter.com/embed/Tweet.html?dnt=1&url=" + encodeURIComponent(tweetUrl),
          };
        } catch (e) {
          return null;
        }
      }
      function detectInstagramEmbed(rawUrl) {
        try {
          var parsed = new URL(rawUrl);
          var host = (parsed.hostname || "").toLowerCase();
          if (!(host === "instagram.com" || host.endsWith(".instagram.com") || host === "instagr.am")) return null;
          var ig = parsed.pathname.match(/^\\/(p|reel|tv)\\/([A-Za-z0-9_-]+)/i);
          if (!ig) return null;
          return {
            mk: "embed",
            provider: "instagram",
            embed: "https://www.instagram.com/" + ig[1].toLowerCase() + "/" + ig[2] + "/embed/",
          };
        } catch (e) {
          return null;
        }
      }
      function extractPlatformMedia() {
        var host = (location.hostname || "").toLowerCase();
        if (host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com")) {
          var xEmbed = detectXEmbed(u);
          if (!xEmbed) return null;
          var bestPoster = null;
          var bestVideoArea = 0;
          var videos = document.querySelectorAll("video");
          videos.forEach(function (v) {
            var poster = upgradeXOrig(v.poster || v.getAttribute("poster") || "");
            if (!poster) return;
            var area = Number(v.videoWidth || v.width || 0) * Number(v.videoHeight || v.height || 0);
            if (!bestPoster || area >= bestVideoArea) {
              bestPoster = poster;
              bestVideoArea = area;
            }
          });
          var bestImage = pickLargestNatural(function (src) {
            try {
              var p = new URL(src);
              return p.hostname.indexOf("pbs.twimg.com") >= 0 && /\\/media\\//i.test(p.pathname);
            } catch (e) {
              return false;
            }
          });
          if (bestImage) bestImage = upgradeXOrig(bestImage);
          if (bestPoster) {
            return { provider: "x", kind: "embed", mk: "embed", embed: xEmbed.embed, poster: bestPoster, image: bestImage || "" };
          }
          if (bestImage) {
            return { provider: "x", kind: "image", mk: "embed", embed: xEmbed.embed, poster: bestImage, image: bestImage };
          }
          return { provider: "x", kind: "embed", mk: "embed", embed: xEmbed.embed, poster: "", image: "" };
        }
        if (host === "instagram.com" || host.endsWith(".instagram.com") || host === "instagr.am") {
          var igImage = pickInstagramLargest();
          var igEmbed = detectInstagramEmbed(u);
          var isReel = /\\/(reel|tv)\\//i.test(location.pathname || "");
          if (isReel && igEmbed) {
            return { provider: "instagram", kind: "embed", mk: "embed", embed: igEmbed.embed, poster: igImage || "", image: igImage || "" };
          }
          if (igImage) {
            return { provider: "instagram", kind: "image", image: igImage, poster: igImage };
          }
          if (isReel && igEmbed) {
            return { provider: "instagram", kind: "embed", mk: "embed", embed: igEmbed.embed, poster: "", image: "" };
          }
        }
        return null;
      }
      function addAmazonDynamic(d, add) {
        if (!d) return;
        try {
          var o = JSON.parse(d), ks = Object.keys(o || {});
          if (ks.length) {
            ks.sort(function (a, b) { return (o[b][0] * o[b][1]) - (o[a][0] * o[a][1]); });
            add(ks[0]);
          }
        } catch (e) {}
      }
      function getImg() {
        var platform = extractPlatformMedia();
        if (platform && (platform.image || platform.poster)) return platform.image || platform.poster;
        var host = (location.hostname || "").toLowerCase();
        var xHost = host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com");
        var igHost = host === "instagram.com" || host.endsWith(".instagram.com") || host === "instagr.am";
        if (platform && (platform.provider === "x" || platform.provider === "instagram")) return null;
        if ((xHost || igHost) && (!platform || !(platform.image || platform.poster))) return null;
        var cs = [];
        function add(v) {
          if (!v) return;
          if (typeof v === "string") cs.push(v);
          else if (Array.isArray(v)) v.forEach(add);
          else if (v.url) cs.push(v.url);
        }
        var metas = document.querySelectorAll('meta[property="og:image"],meta[property="og:image:secure_url"],meta[property="og:image:url"],meta[name="twitter:image"],meta[property="twitter:image"]');
        metas.forEach(function (m) { add(m.content); });
        var lnk = document.querySelector('link[rel="image_src"]');
        if (lnk) add(lnk.href);
        var lds = document.querySelectorAll('script[type="application/ld+json"]');
        lds.forEach(function (ld) {
          try {
            var j = JSON.parse(ld.textContent || "{}");
            if (j["@graph"]) j["@graph"].forEach(function (g) { add(g.image || g.thumbnailUrl); });
            else add(j.image || j.thumbnailUrl);
          } catch (e) {}
        });
        var az = document.querySelector("#landingImage");
        if (az) {
          add(az.getAttribute("data-old-hires") || az.getAttribute("src"));
          addAmazonDynamic(az.getAttribute("data-a-dynamic-image"), add);
        }
        var azw = document.querySelector("#imgTagWrapperId img");
        if (azw) add(azw.src || azw.getAttribute("data-a-dynamic-image"));
        var azm = document.querySelectorAll("img[data-a-dynamic-image]");
        azm.forEach(function (im) { addAmazonDynamic(im.getAttribute("data-a-dynamic-image"), add); });
        var fz = null;
        var imgs = document.querySelectorAll("img");
        imgs.forEach(function (im) {
          var src = im.currentSrc || im.src || im.getAttribute("data-src") || im.getAttribute("data-original") || "";
          if (src && (src.includes("pics.dmm.co.jp") || src.includes("dmm.co.jp"))) {
            var area = (im.naturalWidth || 0) * (im.naturalHeight || 0);
            if (!fz || area > fz.area) fz = { src: src, area: area };
          }
        });
        if (fz) cs.unshift(fz.src);
        for (var i = 0; i < cs.length; i++) {
          var n = norm(cs[i]);
          if (n) return n;
        }
        return null;
      }
      var t = (mc('meta[property="og:title"]') || mc('meta[name="twitter:title"]') || document.title || "").slice(0, 200);
      var desc = (mc('meta[property="og:description"]') || mc('meta[name="description"]') || mc('meta[name="twitter:description"]') || "").replace(/[\\r\\n]+/g, " ").slice(0, 300);
      var s = mc('meta[property="og:site_name"]');
      var sel = (window.getSelection() || "").toString().slice(0, 1200);
      var media = extractPlatformMedia();
      var img = (media && (media.image || media.poster)) || getImg() || "";
      var poster = (media && media.poster) || img;
      var embed = (media && media.mk && media.embed) ? media : null;
      window.open(
        "https://stillframe-phase0.vercel.app/app?auto=1&url=" + encodeURIComponent(u) +
          "&title=" + encodeURIComponent(t) +
          (desc ? "&desc=" + encodeURIComponent(desc) : "") +
          (img ? "&img=" + encodeURIComponent(img) : "") +
          (poster ? "&poster=" + encodeURIComponent(poster) : "") +
          (embed && embed.mk ? "&mk=" + encodeURIComponent(embed.mk) : "") +
          (embed && embed.embed ? "&embed=" + encodeURIComponent(embed.embed) : "") +
          (embed && embed.provider ? "&provider=" + encodeURIComponent(embed.provider) : "") +
          (s ? "&site=" + encodeURIComponent(s.slice(0, 100)) : "") +
          (sel ? "&s=" + encodeURIComponent(sel) : ""),
        "_blank"
      );
    })();
  `;
  const bookmarkletCode = `javascript:${bookmarkletCore.replace(/\s+/g, " ").trim()}`;

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
