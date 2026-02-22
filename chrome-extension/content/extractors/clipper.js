import { extractYouTube } from "./youtube.js";
import { extractX } from "./x.js";
import { extractNote } from "./note.js";
import { extractMedium } from "./medium.js";
import { extractInstagram } from "./instagram.js";
import { extractGeneric } from "./generic.js";

function detectSite() {
  const host = window.location.hostname;
  if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
  if (host.includes("x.com") || host.includes("twitter.com")) return "x";
  if (host.includes("note.com")) return "note";
  if (host.includes("medium.com")) return "medium";
  if (host.includes("instagram.com")) return "instagram";
  return "generic";
}

export async function clipCurrentPage() {
  const site = detectSite();
  let data;

  switch (site) {
    case "youtube":
      data = extractYouTube();
      break;
    case "x":
      data = extractX();
      break;
    case "note":
      data = extractNote();
      break;
    case "medium":
      data = extractMedium();
      break;
    case "instagram":
      data = extractInstagram();
      break;
    default:
      data = extractGeneric();
      break;
  }

  return data;
}
