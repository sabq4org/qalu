/**
 * ويدجت «ماذا قالوا؟» — ضَع في صفحتك:
 * <div data-qalu-figure="slug" data-limit="3"></div>
 * <script async src="https://qalu.dev/embed.js"></script>
 */
(function () {
  var SCRIPT = document.currentScript;
  var ORIGIN = (SCRIPT && SCRIPT.src) ? SCRIPT.src.replace(/\/embed\.js.*$/, "") : "";

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c) n.appendChild(c);
    });
    return n;
  }

  function render(host, data) {
    var site = data.site || ORIGIN || "https://qalu.dev";
    var root = el("div", {
      style:
        "font-family:Tahoma,Arial,sans-serif;direction:rtl;border:1px solid #232c3a;border-radius:14px;background:#121821;color:#eaf0f7;padding:14px;max-width:420px",
    });
    root.appendChild(
      el("a", {
        href: site + "/f/" + encodeURIComponent(data.figure.slug),
        style: "color:#00e0a4;font-weight:700;text-decoration:none;font-size:15px",
        text: data.figure.name + (data.figure.verified ? " ✓" : ""),
      }),
    );
    if (data.figure.title) {
      root.appendChild(
        el("div", { style: "color:#8b97a8;font-size:12px;margin-top:4px", text: data.figure.title }),
      );
    }
    (data.statements || []).forEach(function (s) {
      var box = el("div", {
        style: "margin-top:12px;padding-top:12px;border-top:1px solid #232c3a",
      });
      box.appendChild(
        el("div", {
          style: "font-size:13px;line-height:1.6;font-weight:600",
          text: "«" + s.text + "»",
        }),
      );
      box.appendChild(
        el("a", {
          href: s.sourceUrl,
          target: "_blank",
          rel: "noopener",
          style: "display:inline-block;margin-top:6px;font-size:11px;color:#00e0a4",
          text: "المصدر ↗",
        }),
      );
      root.appendChild(box);
    });
    root.appendChild(
      el("a", {
        href: site,
        style: "display:block;margin-top:12px;font-size:11px;color:#8b97a8;text-decoration:none",
        text: "مدعوم من ماذا قالوا؟",
      }),
    );
    host.innerHTML = "";
    host.appendChild(root);
  }

  function boot() {
    var nodes = document.querySelectorAll("[data-qalu-figure]");
    nodes.forEach(function (host) {
      var slug = host.getAttribute("data-qalu-figure");
      var limit = host.getAttribute("data-limit") || "3";
      if (!slug) return;
      var url = ORIGIN + "/api/embed/" + encodeURIComponent(slug) + "?limit=" + encodeURIComponent(limit);
      fetch(url)
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          if (data.figure) render(host, data);
          else host.textContent = "تعذر تحميل التصريحات";
        })
        .catch(function () {
          host.textContent = "تعذر تحميل التصريحات";
        });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
