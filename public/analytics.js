!function () {
  "use strict";
  (t => {
    const {
      screen: { width: e, height: a },
      navigator: { language: n, doNotTrack: i, msDoNotTrack: r },
      location: o,
      document: s,
      history: c,
      top: u,
      doNotTrack: d
    } = t, {
      currentScript: l,
      referrer: h
    } = s;

    if (!l) return;

    const logDebug = (...args) => {
      if (t.__avail_debug__) console.log('[avail]', ...args);
    };

    if (l.getAttribute("data-debug") === "true") {
      t.__avail_debug__ = true;
      logDebug("Debugging enabled");
    }

    const pgEnv = l.getAttribute("data-pg-env");
    const viewId = l.getAttribute("data-view-id");

    const SESSION_KEY = 'avail_analytics_session';
    const SESSION_TIMEOUT_MS = (minutes = 30) => minutes * 60 * 1000;
    // Set session timeout in minutes
    // const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

    function getSession() {
      const now = Date.now();
      let session = {};

      try {
        const stored = localStorage.getItem(SESSION_KEY);
        if (stored) {
          session = JSON.parse(stored);

          if (now - session.timestamp > SESSION_TIMEOUT_MS(30)) {
            session = {
              session_id: crypto.randomUUID(),
              timestamp: now
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
          } else {
            session.timestamp = now;
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
          }
        } else {
          session = {
            session_id: crypto.randomUUID(),
            timestamp: now
          };
          localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        }
      } catch (err) {
        console.warn('[avail] session storage error:', err);
        session = {
          session_id: crypto.randomUUID(),
          timestamp: now
        };
      }

      return session?.session_id;
    }

    const getSessionId = () => getSession();

    const {
      hostname: f,
      href: m,
      origin: p
    } = o,
      y = m.startsWith("data:") ? void 0 : t.localStorage,
      g = "data-",
      b = "true",
      v = l.getAttribute.bind(l),
      w = v(g + "website-id"),
      S = v(g + "host-url"),
      k = v(g + "before-send"),
      N = v(g + "tag") || void 0,
      T = "false" !== v(g + "auto-track"),
      A = v(g + "do-not-track") === b,
      j = v(g + "exclude-search") === b,
      x = v(g + "exclude-hash") === b,
      $ = v(g + "domains") || "",
      E = $.split(",").map(t => t.trim()),
      K = `${(S || l.src.split("/").slice(0, -1).join("/"))}/dama-admin/analytics/api/send`,
      L = `${e}x${a}`,
      O = /data-avail-event-([\w-_]+)/,
      _ = g + "avail-event",
      D = 300,
      U = () => ({
        website: w,
        screen: L,
        language: n,
        title: s.title,
        hostname: f,
        url: z,
        referrer: F,
        tag: N,
        id: q || void 0,
        session_id: getSessionId()
      }),
      W = (t, e, a) => {
        if (a) {
          F = z,
            z = new URL(a, o.href),
            j && (z.search = ""),
            x && (z.hash = ""),
            z = z.toString(),
            z !== F && setTimeout(J, D);
        }
      },
      B = () => H || !w || y && y.getItem("avail.disabled") || $ && !E.includes(f) || A && (() => {
        const t = d || i || r;
        return 1 === t || "1" === t || "yes" === t;
      })(),
      C = async (e, a = "event") => {
        if (B()) return;
        const n = t[k];
        if ("function" == typeof n && (e = n(a, e)), e) try {
          const t = await fetch(K, {
            method: "POST",
            body: JSON.stringify({ type: a, payload: { ...e, view_id: viewId, pg_env: pgEnv } }),
            headers: {
              "Content-Type": "application/json",
              ...void 0 !== R && { "x-avail-cache": R }
            },
            credentials: "omit"
          }),
            n = await t.json();
          n && (H = !!n.disabled, R = n.cache);
        } catch (t) { /* empty */ }
      },
      J = (t, e) => {
        const payload = "string" == typeof t ? { ...U(), name: t, data: e } :
          "object" == typeof t ? { ...t } :
            "function" == typeof t ? t(U()) : U();
        logDebug("Tracking event:", payload);
        return C(payload, "event");
      },
      P = (t, e) => ("string" == typeof t && (q = t), R = "", C({ ...U(), data: "object" == typeof t ? t : e }, "identify"));

    function setupHistoryListeners() {
      const override = method => {
        const original = c[method];
        c[method] = function (...args) {
          const url = args[2];
          if (url) {
            F = z;
            z = new URL(url, o.href).toString();
            setTimeout(() => J("pageview"), D);
          }
          return original.apply(this, args);
        };
      };
      override("pushState");
      override("replaceState");
    }

    function setupClickListeners() {
      const handler = async t => {
        const e = t.getAttribute(_);
        if (e) {
          const a = {};
          t.getAttributeNames().forEach(n => {
            const match = n.match(O);
            if (match) a[match[1]] = t.getAttribute(n);
          });
          J(e, a);
        }
      };

      s.addEventListener("click", async e => {
        const el = e.target;
        const n = el.closest("a,button");
        if (!n) return handler(el);

        const { href: i, target: r } = n;
        if (n.getAttribute(_)) {
          if ("BUTTON" === n.tagName) return handler(n);
          if ("A" === n.tagName && i) {
            const a = "_blank" === r || e.ctrlKey || e.shiftKey || e.metaKey || e.button && 1 === e.button;
            if (!a) e.preventDefault();
            await handler(n);
            if (!a) ("_top" === r ? u.location : o).href = i;
          }
        }
      }, true);
    }

    function trackAllUserEvents() {
        
      const events = [
        // "click", 
        // "dblclick", 
        // "submit", 
        // "change", 
        // "input",
        // "focus", 
        // "blur", 
        // "scroll", 
        // "copy", 
        // "paste",
        // "keydown", 
        // "keyup", 
        // "visibilitychange"
      ];

      const handler = e => {
        const el = e.target;
        const name = `ui_${e.type}`;
        const data = {
          tag: el.tagName,
          id: el.id,
          class: el.className,
          nameAttr: el.getAttribute?.("name"),
          type: el.type || '',
          eventType: e.type
        };
        logDebug("User interaction:", name, data);
        J(name, data);
      };

      events.forEach(evt => {
        document.addEventListener(evt, handler, true);
      });
    }

    function init() {
      if (G) return;
      G = true;
      J("pageview");
      setupHistoryListeners();
      setupClickListeners();
      trackAllUserEvents();

      window.addEventListener("popstate", () => {
        F = z;
        z = location.href;
        J("pageview");
      });
    }

    t.avail || (t.avail = { track: J, identify: P });

    let R, q, z = m, F = h.startsWith(p) ? "" : h, G = !1, H = !1;

    T && !B() && ("complete" === s.readyState ? init() : s.addEventListener("readystatechange", init, !0));
  })(window);
}();
