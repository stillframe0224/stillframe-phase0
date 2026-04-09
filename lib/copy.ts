export type Lang = "en" | "ja";

const copy = {
  nav: {
    brand: "SHINEN",
    byline: { en: "by StillFrame", ja: "by StillFrame" },
    langLabel: { en: "日本語", ja: "English" },
  },
  hero: {
    h1: {
      en: "Every thought gets a picture.",
      ja: "すべての思考に、画像がつく。",
    },
    sub: {
      en: "Paste a URL — the image appears. Drop a photo — it becomes a card. Do nothing at all — a gentle illustration fills the space. No image hunting, no blank cards.",
      ja: "URLを貼れば画像が現れる。写真を落とせばカードになる。何もしなくても、やさしいイラストが空白を埋める。画像探しも、空白のカードも、もういらない。",
    },
    cta: {
      en: "Join Waitlist →",
      ja: "ウェイトリストに参加 →",
    },
  },
  demo: {
    h2: { en: "Try Quick Capture", ja: "Quick Capture を試す" },
    placeholder: {
      en: "Type a thought…",
      ja: "思いつきを入力…",
    },
    reset: { en: "Reset", ja: "リセット" },
    note: {
      en: "Nothing is saved — just explore freely.",
      ja: "何も保存されません。自由に試してみてください。",
    },
  },
  howImages: {
    h2: {
      en: "How images work",
      ja: "画像のしくみ",
    },
    cols: [
      {
        title: { en: "Paste a URL", ja: "URLを貼る" },
        desc: {
          en: "OGP image fetches automatically. Zero steps. Zero friction. Done.",
          ja: "OGP画像が自動で取得される。手作業ゼロ。摩擦ゼロ。完了。",
        },
      },
      {
        title: { en: "Drop a photo", ja: "写真をドロップ" },
        desc: {
          en: "One click. Your image becomes the card. No editing, no uploading.",
          ja: "ワンクリック。画像がカードになる。編集も、アップロードも不要。",
        },
      },
      {
        title: { en: "Or do nothing", ja: "何もしなくても" },
        desc: {
          en: "We'll add a gentle illustration. No blank cards. Ever.",
          ja: "やさしいイラストが自動で入る。空白のカードは、もう存在しない。",
        },
      },
    ],
  },
  pricing: {
    h2: { en: "Simple pricing", ja: "シンプルな料金" },
    price: "$29",
    period: { en: "/mo", ja: "/月" },
    features: {
      en: [
        "Unlimited cards",
        "Auto image capture",
        "8 thought types",
        "Export & API access",
      ],
      ja: [
        "カード無制限",
        "画像自動取得",
        "8つの思考タイプ",
        "エクスポート & API",
      ],
    },
    cta: { en: "Claim Early Access →", ja: "早期アクセスを確保 →" },
    urgency: {
      en: "Early-bird pricing · first 20 members keep this price forever",
      ja: "先着20名限定 · この価格をずっと維持できます",
    },
  },
  waitlist: {
    h2: { en: "Stay in the loop", ja: "最新情報を受け取る" },
    placeholder: { en: "you@email.com", ja: "you@email.com" },
    cta: { en: "Notify me", ja: "通知を受け取る" },
    submitting: { en: "Sending...", ja: "送信中..." },
    trust: {
      en: "Just launch updates. No spam, no sharing.",
      ja: "お知らせのみ。スパム配信・第三者共有はしません。",
    },
    success: {
      en: "You're in. We'll be in touch.",
      ja: "登録完了。ご連絡します。",
    },
    error: {
      en: "Could not submit. Please try again.",
      ja: "送信できませんでした。もう一度お試しください。",
    },
    errorNetwork: {
      en: "Could not connect. Please check your internet connection and try again.",
      ja: "接続できませんでした。インターネット接続を確認してもう一度お試しください。",
    },
  },
  footer: {
    brand: "StillFrame",
    tagline: {
      en: "Where meaning settles.",
      ja: "意味が沈殿する場所。",
    },
    copyright: {
      en: "© 2026 StillFrame. All rights reserved.",
      ja: "© 2026 StillFrame",
    },
    navLabel: {
      en: "Footer navigation",
      ja: "フッターナビゲーション",
    },
    nav: {
      demo: { en: "Demo", ja: "デモ" },
      "how-it-works": { en: "How it works", ja: "しくみ" },
      pricing: { en: "Pricing", ja: "料金" },
      waitlist: { en: "Waitlist", ja: "ウェイトリスト" },
    } as Record<string, { en: string; ja: string }>,
  },
  cardSamples: {
    memo: {
      en: "A character who only speaks in questions",
      ja: "質問でしか話さないキャラクター",
    },
    idea: {
      en: "What if notebooks had weather?",
      ja: "ノートに天気があったら？",
    },
    quote: {
      en: '"The only way out is through" — Frost',
      ja: "「抜ける道は通り抜けるしかない」— フロスト",
    },
    task: {
      en: "Fix the bridge section before Friday",
      ja: "金曜までにブリッジセクションを直す",
    },
    feeling: {
      en: "Restless but not anxious — what is this?",
      ja: "落ち着かないけど不安じゃない——これは何？",
    },
    image: {
      en: "That specific blue in Vermeer's Girl",
      ja: "フェルメールの少女のあの青",
    },
    fragment: {
      en: "Something about trains and forgetting",
      ja: "電車と忘却について、何か",
    },
    dream: {
      en: "A building made entirely of frozen music",
      ja: "凍った音楽でできた建物",
    },
  },
} as const;

export default copy;
