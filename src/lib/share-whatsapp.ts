/**
 * Open WhatsApp share reliably from any context (incl. Lovable preview iframe).
 *
 * Why: api.whatsapp.com sets X-Frame-Options: DENY -> opening it inside an
 * iframe (the Lovable preview, an in-app webview, etc.) yields ERR_BLOCKED_BY_RESPONSE.
 * Strategy:
 *  1) Mobile -> use the whatsapp:// scheme (jumps directly into the app).
 *  2) Desktop -> open https://wa.me/?text=... in the *top-level* window with
 *     noopener, so it cannot be embedded by the parent frame.
 */
export function openWhatsAppShare(text: string, phone?: string) {
  const encoded = encodeURIComponent(text);
  const phoneSegment = phone ? phone.replace(/\D/g, "") : "";

  const isMobile = /android|iphone|ipad|ipod/i.test(
    typeof navigator !== "undefined" ? navigator.userAgent : ""
  );

  const webUrl = `https://wa.me/${phoneSegment}?text=${encoded}`;
  const appUrl = `whatsapp://send?${phoneSegment ? `phone=${phoneSegment}&` : ""}text=${encoded}`;

  // Prefer the top-most window so X-Frame-Options can't block us.
  const top = (() => {
    try {
      return window.top ?? window;
    } catch {
      return window;
    }
  })();

  if (isMobile) {
    // whatsapp:// scheme bypasses iframe restrictions entirely.
    try {
      top.location.href = appUrl;
      return;
    } catch {
      // fall through to web url
    }
  }

  // Desktop or fallback: open wa.me in a fresh top-level tab.
  const opened = window.open(webUrl, "_blank", "noopener,noreferrer");
  if (!opened) {
    // Popup blocked -> navigate the top frame as last resort.
    try {
      top.location.href = webUrl;
    } catch {
      window.location.href = webUrl;
    }
  }
}
