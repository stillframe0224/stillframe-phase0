export type Lang = "en" | "ja";

const copy = {
  nav: {
    brand: "SHINEN",
    byline: { en: "by StillFrame", ja: "by StillFrame" },
    langLabel: { en: "日本語", ja: "English" },
  },
  hero: {
    h1: {
      en: "Think it. See it.",
      ja: "考えた瞬間、画になる。",
    },
    sub: {
      en: "Paste a link — the image appears. Drop a photo — it becomes a card. Do nothing — AI fills the canvas. No hunting for images. No empty thoughts.",
      ja: "リンクを貼れば画像が現れる。写真を落とせばカードになる。何もしなくてもAIが埋める。画像を探す手間なし。空白の思考なし。",
    },
    cta: {
      en: "Start Capturing Your Thoughts",
      ja: "思考のキャプチャを始める",
    },
  },
  demo: {
    h2: { en: "Start Capturing Your Thoughts", ja: "思考のキャプチャを始める" },
    placeholder: {
      en: "Type a thought…",
      ja: "思いつきを入力…",
    },
    reset: { en: "Reset", ja: "リセット" },
    note: {
      en: "Nothing is saved. This is just a preview.",
      ja: "何も保存されません。プレビューです。",
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
          en: "OGP image is fetched automatically, no manual fetch needed.",
          ja: "OGP画像を自動取得。手作業の取得は不要。",
        },
      },
      {
        title: { en: "Drop a photo", ja: "写真をドロップ" },
        desc: {
          en: "Your image becomes the card thumbnail.",
          ja: "画像がそのままサムネイルに。",
        },
      },
      {
        title: { en: "Or do nothing", ja: "何もしなくても" },
        desc: {
          en: "A gentle SVG illustration fills the space.",
          ja: "やさしいSVGイラストが空白を埋める。",
        },
      },
    ],
  },
  pricing: {
    h2: { en: "Simple pricing", ja: "シンプルな料金" },
    price: "$10",
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
    cta: { en: "Get Early Access", ja: "早期アクセスを取得" },
    urgency: {
      en: "Early-bird pricing: first 20 members keep this price forever",
      ja: "先着20名はこの価格をずっと維持できます",
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
  },
  footer: {
    brand: "StillFrame",
    tagline: {
      en: "Where meaning settles.",
      ja: "意味が沈殿する場所。",
    },
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
