(function initApprovalNotify() {
  if (window.__sf_approval_notify_installed) {
    return;
  }
  window.__sf_approval_notify_installed = true;

  var lastFireTs = 0;
  var COOLDOWN_MS = 30000;

  function getButtons() {
    return Array.from(document.querySelectorAll("button"));
  }

  function hasYesButton(buttons) {
    return buttons.some(function (button) {
      var text = (button.textContent || "").trim().toLowerCase();
      return text === "yes";
    });
  }

  function hasNoLikeButton(buttons) {
    return buttons.some(function (button) {
      var text = (button.textContent || "").trim().toLowerCase();
      return text === "no" || text === "cancel";
    });
  }

  function isApprovalPrompt() {
    var bodyText = (document.body && document.body.innerText) || "";
    var bodyLower = bodyText.toLowerCase();
    var buttons = getButtons();

    if (bodyLower.indexOf("do you want to make these changes?") !== -1 && hasYesButton(buttons)) {
      return true;
    }

    var hasJapaneseChangeText = bodyText.indexOf("変更") !== -1;
    var hasJapaneseOrEnglishYesNo = hasYesButton(buttons) && hasNoLikeButton(buttons);
    if (hasJapaneseChangeText && hasJapaneseOrEnglishYesNo) {
      return true;
    }

    return false;
  }

  function notifyApproval() {
    var now = Date.now();
    if (now - lastFireTs < COOLDOWN_MS) {
      return;
    }

    lastFireTs = now;

    try {
      chrome.runtime.sendMessage({ type: "SF_ALERT", kind: "approval" });
    } catch (_error) {
      // Ignore notification relay failures.
    }
  }

  function check() {
    if (isApprovalPrompt()) {
      notifyApproval();
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
