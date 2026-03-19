"use client";

import { useState, useEffect, useCallback } from "react";
import { ColorPicker, useColor, type IColor } from "react-color-palette";
import "react-color-palette/css";

// ─── build CSS vars from full IColor (HSV + RGB) ─────────────────────────────

function buildVars(color: IColor): Record<string, string> {
  const { r, g, b } = color.rgb;
  const { h, s, v } = color.hsv;

  // Derive dark backgrounds by dropping brightness + saturation
  const bgBase   = hsvToRgbStr(h, Math.min(s, 60),  Math.max(v * 0.10, 6));
  const bgDeep   = hsvToRgbStr(h, Math.min(s, 50),  Math.max(v * 0.07, 4));
  const bgRaised = hsvToRgbStr(h, Math.min(s, 55),  Math.max(v * 0.14, 9));

  const accent       = `rgb(${r},${g},${b})`;
  const accentGlow   = `rgba(${r},${g},${b},0.20)`;
  const accentGlowLg = `rgba(${r},${g},${b},0.10)`;
  const glassBg      = `rgba(${r * 0.12 | 0},${g * 0.12 | 0},${b * 0.12 | 0},0.55)`;
  const glassBgHov   = `rgba(${r * 0.16 | 0},${g * 0.16 | 0},${b * 0.16 | 0},0.78)`;
  const glassBorder  = `rgba(${r},${g},${b},0.13)`;
  const glassBorderH = `rgba(${r},${g},${b},0.30)`;

  // Bright variant — bump value to 95, full sat
  const [br, bg2, bb] = hsvToRgb(h, Math.min(s + 5, 100), Math.min(v + 20, 95));
  // Dim variant — lower value
  const [dr, dg, db]  = hsvToRgb(h, s, Math.max(v - 20, 20));

  return {
    "--bg-base":             bgBase,
    "--bg-deep":             bgDeep,
    "--bg-raised":           bgRaised,
    "--glass-bg":            glassBg,
    "--glass-bg-hover":      glassBgHov,
    "--glass-border":        glassBorder,
    "--glass-border-hover":  glassBorderH,
    "--glass-shadow":        `0 8px 32px rgba(0,0,0,.52),0 1px 0 rgba(255,255,255,.04) inset`,
    "--glass-shadow-lg":     `0 24px 64px rgba(0,0,0,.62),0 1px 0 rgba(255,255,255,.05) inset`,
    "--accent":              accent,
    "--accent-bright":       `rgb(${br},${bg2},${bb})`,
    "--accent-dim":          `rgb(${dr},${dg},${db})`,
    "--accent-glow":         accentGlow,
    "--accent-glow-lg":      accentGlowLg,
    "--text-primary":        "rgba(255,255,255,.92)",
    "--text-secondary":      "rgba(255,255,255,.55)",
    "--text-muted":          "rgba(255,255,255,.25)",
    "--text-accent":         `rgb(${br},${bg2},${bb})`,
    "--status-live":         accent,
    "--status-ok":           "rgb(104,211,145)",
    "--status-warn":         "rgb(251,191,36)",
    "--status-danger":       "rgb(248,113,113)",
    "--mesh-a":              `rgba(${r},${g},${b},0.09)`,
    "--mesh-b":              `rgba(${dr},${dg},${db},0.06)`,
    "--mesh-c":              "rgba(0,0,0,0)",
  };
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  s /= 100; v /= 100;
  const i = Math.floor(h / 60) % 6;
  const f = h / 60 - Math.floor(h / 60);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const m = [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]][i];
  return [Math.round(m[0]*255), Math.round(m[1]*255), Math.round(m[2]*255)];
}

function hsvToRgbStr(h: number, s: number, v: number) {
  const [r, g, b] = hsvToRgb(h, s, v);
  return `rgb(${r},${g},${b})`;
}

function applyColor(color: IColor) {
  const vars = buildVars(color);
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  localStorage.setItem("tier1-color", color.hex);
}

// ─── component ───────────────────────────────────────────────────────────────

export function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useColor("#3B82F6");

  // Restore saved color
  useEffect(() => {
    const saved = localStorage.getItem("tier1-color");
    if (saved) {
      // Trigger a color update via a temp element trick — useColor is init-only
      // so we just applyColor directly from hex on mount
      const hex = saved;
      const r = parseInt(hex.slice(1,3),16);
      const g = parseInt(hex.slice(3,5),16);
      const b = parseInt(hex.slice(5,7),16);
      // Build a minimal IColor from hex to apply vars
      const fakeColor: IColor = {
        hex,
        rgb: { r, g, b, a: 1 },
        hsv: rgbToHsv(r, g, b),
      };
      applyColor(fakeColor);
    }
  }, []);

  const handleChange = useCallback((c: IColor) => {
    setColor(c);
  }, [setColor]);

  const handleChangeComplete = useCallback((c: IColor) => {
    applyColor(c);
  }, []);

  return (
    <div className="relative">
      {/* Trigger pill */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-full transition-all"
        style={{
          background:     "var(--glass-bg)",
          backdropFilter: "blur(12px)",
          border:         "1px solid var(--glass-border)",
          fontFamily:     "var(--font-mono), monospace",
          color:          "var(--text-secondary)",
          fontSize:       "10px",
        }}
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0 transition-all"
          style={{
            background: color.hex,
            boxShadow:  `0 0 6px ${color.hex}`,
          }}
        />
        <span className="hidden sm:block uppercase tracking-[0.1em]">
          Theme
        </span>
        <span
          className="hidden sm:block uppercase tracking-[0.08em]"
          style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-muted)" }}
        >
          {color.hex.toUpperCase()}
        </span>
      </button>

      {/* Picker popover */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[190]"
            onClick={() => { setOpen(false); applyColor(color); }}
          />

          <div
            className="absolute top-full right-0 mt-2 z-[200] rounded-2xl p-3 animate-fade-up"
            style={{
              background:           "var(--glass-bg)",
              backdropFilter:       "blur(32px) saturate(180%)",
              WebkitBackdropFilter: "blur(32px) saturate(180%)",
              border:               "1px solid var(--glass-border)",
              boxShadow:            "var(--glass-shadow-lg)",
            }}
          >
            {/* Library picker — full saturation field + hue + alpha + inputs */}
            <ColorPicker
              color={color}
              onChange={handleChange}
              onChangeComplete={handleChangeComplete}
              hideInput={["hsv"]}
            />

            {/* Live preview strip */}
            <div
              className="mt-2 rounded-xl p-3 flex items-center gap-3"
              style={{
                background: `rgba(${color.rgb.r * 0.15 | 0},${color.rgb.g * 0.15 | 0},${color.rgb.b * 0.15 | 0},0.6)`,
                border:     `1px solid rgba(${color.rgb.r},${color.rgb.g},${color.rgb.b},0.2)`,
              }}
            >
              <div
                className="w-8 h-8 rounded-lg shrink-0"
                style={{
                  background: color.hex,
                  boxShadow:  `0 0 12px rgba(${color.rgb.r},${color.rgb.g},${color.rgb.b},0.5)`,
                }}
              />
              <div className="flex-1 min-w-0">
                <p style={{ fontSize:10, fontFamily:"var(--font-display)",  color:"var(--text-primary)",   margin:0, fontWeight:500 }}>
                  Glass Preview
                </p>
                <p style={{ fontSize:9,  fontFamily:"var(--font-mono)",     color:"var(--text-muted)",     margin:0, textTransform:"uppercase", letterSpacing:"0.1em" }}>
                  {color.hex.toUpperCase()} · hsv({Math.round(color.hsv.h)}°,{Math.round(color.hsv.s)}%,{Math.round(color.hsv.v)}%)
                </p>
              </div>
              {/* 5-stop derived swatch */}
              <div style={{ display:"flex", gap:3 }}>
                {[0.07,0.14,0.30,0.55,1].map((alpha, i) => (
                  <div key={i} style={{
                    width:12, height:12, borderRadius:3,
                    background: `rgba(${color.rgb.r},${color.rgb.g},${color.rgb.b},${alpha})`,
                    border: "1px solid rgba(255,255,255,0.08)",
                  }} />
                ))}
              </div>
            </div>

            {/* Apply button */}
            <button
              onClick={() => { applyColor(color); setOpen(false); }}
              className="mt-2 w-full py-2 rounded-xl transition-all text-[10px] uppercase tracking-[0.12em]"
              style={{
                background:    `rgba(${color.rgb.r},${color.rgb.g},${color.rgb.b},0.15)`,
                border:        `1px solid rgba(${color.rgb.r},${color.rgb.g},${color.rgb.b},0.30)`,
                color:         color.hex,
                fontFamily:    "var(--font-mono), monospace",
                cursor:        "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = `rgba(${color.rgb.r},${color.rgb.g},${color.rgb.b},0.25)`)}
              onMouseLeave={(e) => (e.currentTarget.style.background = `rgba(${color.rgb.r},${color.rgb.g},${color.rgb.b},0.15)`)}
            >
              Apply Theme
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number; a: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, v: v * 100, a: 1 };
}