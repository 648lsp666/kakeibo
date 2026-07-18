# Theme and global styles

## Framework

- React 19, Vite 7, TypeScript
- Tailwind 4 is imported but UI composition is primarily inline styles + CSS variables
- Framer Motion for sheets, list entry, and swipe actions
- System Chinese sans-serif stack

## `src/styles/theme.css` (complete token source)

```css
:root {
  color-scheme: light;
  --color-bg:#f7f6ed; --color-bg-secondary:#eef1e3; --color-bg-card:#fffdf7; --color-bg-elevated:#ffffff;
  --color-text:#344033; --color-text-secondary:#5f6b5d; --color-text-tertiary:#9ca597; --color-text-small:#5f6b5d;
  --color-border:#e2e5d8; --color-primary:#718b61; --color-primary-text:#405c36; --color-on-primary:#12170f;
  --color-primary-hover:#7b966a; --color-primary-strong:#58734c; --color-primary-soft:#e1ebd3;
  --color-income:#4f8a70; --color-income-text:#28664e; --color-income-soft:#eef8f1;
  --color-expense:#c96f68; --color-expense-text:#9c3f3b; --color-expense-soft:#fdf1ed;
  --color-warning:#b6813f; --color-warning-text:#76501d; --color-danger-soft:#f9e7e3; --color-on-danger:#12170f;
  --color-source-wechat:var(--color-income-text); --color-source-wechat-soft:var(--color-primary-soft);
  --color-source-alipay:var(--color-primary-text); --color-source-alipay-soft:var(--color-primary-soft);
  --color-source-bank:var(--color-warning-text); --color-source-bank-soft:var(--color-bg-secondary);
  --color-overlay:rgb(35 44 32 / 48%); --shadow-card:0 10px 30px rgb(76 91 62 / 10%); --shadow-fab:0 8px 20px rgb(89 113 82 / 30%);
  --radius-hero:22px; --radius-card:16px; --radius-control:14px; --tap-size:44px;
}
@media (prefers-color-scheme:dark) {
  :root {
    color-scheme:dark; --color-bg:#1c211b; --color-bg-secondary:#272e24; --color-bg-card:#242a22; --color-bg-elevated:#2d342a;
    --color-text:#edf1e7; --color-text-secondary:#b3bdad; --color-text-tertiary:#858f80; --color-text-small:#b3bdad; --color-border:#394135;
    --color-primary:#9db88b; --color-primary-text:#b4cba4; --color-primary-hover:#b4cba4; --color-primary-strong:#b4cba4; --color-primary-soft:#34422f;
    --color-income:#7fc39f; --color-income-text:#91d4b1; --color-income-soft:#24342c;
    --color-expense:#e0938c; --color-expense-text:#f0aaa3; --color-expense-soft:#342826;
    --color-warning:#d3a15e; --color-warning-text:#edbd77; --color-danger-soft:#442c2a;
    --color-overlay:rgb(8 12 8 / 68%); --shadow-card:inset 0 0 0 1px rgb(255 255 255 / 4%); --shadow-fab:0 8px 20px rgb(8 12 8 / 35%);
  }
}
```

## Global component conventions (`src/index.css`)

```css
body { background:var(--color-bg); color:var(--color-text); font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Segoe UI",sans-serif; }
:focus-visible { outline:3px solid var(--color-primary); outline-offset:2px; }
.surface { background:var(--color-bg-card); border:1px solid var(--color-border); border-radius:var(--radius-card); box-shadow:var(--shadow-card); }
.icon-button { align-items:center; background:transparent; border:0; border-radius:var(--radius-control); display:inline-flex; justify-content:center; min-height:var(--tap-size); min-width:var(--tap-size); }
.primary-button,.secondary-button { align-items:center; border-radius:var(--radius-control); display:inline-flex; font-weight:600; justify-content:center; min-height:var(--tap-size); padding:0 18px; }
.primary-button { background:var(--color-primary); border:1px solid var(--color-primary); color:var(--color-on-primary); }
.secondary-button { background:var(--color-bg-card); border:1px solid var(--color-border); color:var(--color-primary-strong); }
.page-scroll { height:100%; overflow-y:auto; padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left)); }
```
