(function initApprovalNotify() {
  if (window.__sf_approval_notify_installed) {
    return;
  }
  window.__sf_approval_notify_installed = true;

  var lastFireTs = 0;
  var COOLDOWN_MS = 30000;
  var APPROVAL_WORDS = [
    /allow/i,
    /許可/,
    /approve/i,
    /承認/,
    /deny/i,
    /拒否/,
    /always/i,
    /常に許可/,
    /one[\s-]?time/i,
    /一度だけ/,
    /この一回/
  ];
  var ATTR_HINT = /(approval|approve|allow|deny)/i;

  window.__SF_APPROVAL_ALERT = window.__SF_APPROVAL_ALERT || {
    lastTs: 0,
    hits: 0,
    lastReason: ""
  };

  function hasModalStructure(modal) {
    if (!modal) {
      return false;
    }

    var hasPreOrCode = !!modal.querySelector("pre, code");
    var hasButtons = modal.querySelectorAll("button").length > 0;
    return hasPreOrCode && hasButtons;
  }

  function buttonMatches(button) {
    var text = (button.textContent || "").trim();
    for (var i = 0; i < APPROVAL_WORDS.length; i += 1) {
      if (APPROVAL_WORDS[i].test(text)) {
        return true;
      }
    }

    var dataTestId = button.getAttribute("data-testid") || "";
    var className = button.className || "";
    return ATTR_HINT.test(dataTestId) || ATTR_HINT.test(String(className));
  }

  function hasApprovalButtons(modal) {
    var buttons = Array.from(modal.querySelectorAll("button"));
    var hitCount = 0;

    for (var i = 0; i < buttons.length; i += 1) {
      if (buttonMatches(buttons[i])) {
        hitCount += 1;
      }
    }

    return hitCount >= 2;
  }

  function findApprovalPrompt() {
    var modalCandidates = Array.from(document.querySelectorAll('[role="dialog"], dialog, [aria-modal="true"]'));

    for (var i = 0; i < modalCandidates.length; i += 1) {
      var modal = modalCandidates[i];
      if (!hasModalStructure(modal)) {
        continue;
      }
      if (hasApprovalButtons(modal)) {
        return { hit: true, reason: "modal+buttons+code" };
      }
    }

    return { hit: false, reason: "" };
  }

  function notifyApproval(reason) {
    var now = Date.now();
    if (now - lastFireTs < COOLDOWN_MS) {
      return;
    }

    lastFireTs = now;
    window.__SF_APPROVAL_ALERT.lastTs = now;
    window.__SF_APPROVAL_ALERT.hits += 1;
    window.__SF_APPROVAL_ALERT.lastReason = reason || "";

    try {
      chrome.runtime.sendMessage({ type: "SF_ALERT", kind: "approval" });
    } catch (_error) {
      // Ignore notification relay failures.
    }
  }

  function check() {
    var result = findApprovalPrompt();
    if (result.hit) {
      notifyApproval(result.reason);
    }
  }

  var observer = new MutationObserver(check);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  check();
})();
