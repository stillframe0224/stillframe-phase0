export interface CardType {
  bg: string;
  border: string;
  accent: string;
  accentRgb: string; // "R,G,B" for use in CSS rgba(var(--accent-rgb), alpha)
  label: string;
}

export const cardTypes: CardType[] = [
  { bg: "#FFF8F0", border: "#F5C882", accent: "#D9A441", accentRgb: "217,164,65",  label: "memo" },
  { bg: "#EEF2FF", border: "#A0B8F5", accent: "#4F6ED9", accentRgb: "79,110,217",  label: "idea" },
  { bg: "#FEFCE8", border: "#E5D560", accent: "#A89620", accentRgb: "168,150,32",  label: "quote" },
  { bg: "#F0FFF4", border: "#7EDBA0", accent: "#2D8F50", accentRgb: "45,143,80",   label: "task" },
  { bg: "#FFF5EB", border: "#F0B870", accent: "#C07820", accentRgb: "192,120,32",  label: "feeling" },
  { bg: "#F5F0FF", border: "#BBA0F5", accent: "#7B4FD9", accentRgb: "123,79,217",  label: "image" },
  { bg: "#F0FDFA", border: "#70D4C0", accent: "#208F78", accentRgb: "32,143,120",  label: "fragment" },
  { bg: "#FDF2F8", border: "#F0A0D0", accent: "#C04890", accentRgb: "192,72,144",  label: "dream" },
];

export function getCardType(label: string): CardType {
  return cardTypes.find((t) => t.label === label) || cardTypes[0];
}
