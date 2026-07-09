const fs = require('fs');

let css = fs.readFileSync('frontend/src/index.css', 'utf8');

css = css.replace(/:root\s*\{[^}]+\}/, `:root, [data-theme="dark"] {
  --c-bg: #06060f;
  --c-surface: #0d0d1f;
  --c-surface-rgb: 13, 13, 31;
  --c-surface2: #13132a;
  --c-surface2-rgb: 19, 19, 42;
  --c-border: rgba(139, 92, 246, 0.12);
  --c-neon: #8b5cf6;
  --c-neon-rgb: 139, 92, 246;
  --c-neon2: #06b6d4;
  --c-neon2-rgb: 6, 182, 212;
  --c-neon3: #f59e0b;
  --c-text: #e2e8f0;
  --c-text-rgb: 226, 232, 240;
  --c-muted: #64748b;
  --c-white-rgb: 255, 255, 255;
  --c-black-rgb: 0, 0, 0;

  --plyr-color-main: var(--c-neon);
  --plyr-video-background: var(--c-bg);
  --plyr-font-family: 'Inter', sans-serif;
  --plyr-control-spacing: 14px;
  --plyr-range-thumb-height: 14px;
  --plyr-range-track-height: 4px;
}

[data-theme="light"] {
  --c-bg: #f8fafc;
  --c-surface: #ffffff;
  --c-surface-rgb: 255, 255, 255;
  --c-surface2: #f1f5f9;
  --c-surface2-rgb: 241, 245, 249;
  --c-border: rgba(99, 102, 241, 0.12);
  --c-neon: #6366f1;
  --c-neon-rgb: 99, 102, 241;
  --c-neon2: #0ea5e9;
  --c-neon2-rgb: 14, 165, 233;
  --c-neon3: #f59e0b;
  --c-text: #0f172a;
  --c-text-rgb: 15, 23, 42;
  --c-muted: #64748b;
  --c-white-rgb: 15, 23, 42; /* Inverted for light mode */
  --c-black-rgb: 255, 255, 255;
}

[data-theme="pink"] {
  --c-bg: #1f0b1b;
  --c-surface: #2b0f25;
  --c-surface-rgb: 43, 15, 37;
  --c-surface2: #3a1532;
  --c-surface2-rgb: 58, 21, 50;
  --c-border: rgba(236, 72, 153, 0.2);
  --c-neon: #ec4899;
  --c-neon-rgb: 236, 72, 153;
  --c-neon2: #f43f5e;
  --c-neon2-rgb: 244, 63, 94;
  --c-neon3: #fbbf24;
  --c-text: #fce7f3;
  --c-text-rgb: 252, 231, 243;
  --c-muted: #fbcfe8;
  --c-white-rgb: 255, 255, 255;
  --c-black-rgb: 0, 0, 0;
}

[data-theme="baby-pink"] {
  --c-bg: #fff1f2;
  --c-surface: #ffe4e6;
  --c-surface-rgb: 255, 228, 230;
  --c-surface2: #fecdd3;
  --c-surface2-rgb: 254, 205, 211;
  --c-border: rgba(244, 63, 94, 0.15);
  --c-neon: #f43f5e;
  --c-neon-rgb: 244, 63, 94;
  --c-neon2: #fb7185;
  --c-neon2-rgb: 251, 113, 133;
  --c-neon3: #fbbf24;
  --c-text: #881337;
  --c-text-rgb: 136, 19, 55;
  --c-muted: #be123c;
  --c-white-rgb: 136, 19, 55;
  --c-black-rgb: 255, 255, 255;
}

[data-theme="ocean"] {
  --c-bg: #041221;
  --c-surface: #09213b;
  --c-surface-rgb: 9, 33, 59;
  --c-surface2: #0f3052;
  --c-surface2-rgb: 15, 48, 82;
  --c-border: rgba(14, 165, 233, 0.15);
  --c-neon: #0ea5e9;
  --c-neon-rgb: 14, 165, 233;
  --c-neon2: #10b981;
  --c-neon2-rgb: 16, 185, 129;
  --c-neon3: #f59e0b;
  --c-text: #e0f2fe;
  --c-text-rgb: 224, 242, 254;
  --c-muted: #7dd3fc;
  --c-white-rgb: 255, 255, 255;
  --c-black-rgb: 0, 0, 0;
}`);

// Replacements for exact hex colors used across the file
css = css.replace(/#8b5cf6/g, 'var(--c-neon)');
css = css.replace(/#7c3aed/g, 'var(--c-neon)');
css = css.replace(/#a855f7/g, 'var(--c-neon2)');
css = css.replace(/#6d28d9/g, 'var(--c-neon)');
css = css.replace(/#a78bfa/g, 'var(--c-neon)');

css = css.replace(/#06b6d4/g, 'var(--c-neon2)');
css = css.replace(/#67e8f9/g, 'var(--c-neon2)');
css = css.replace(/#0891b2/g, 'var(--c-neon2)');

css = css.replace(/#0d0d1f/g, 'var(--c-surface)');
css = css.replace(/#16162e/g, 'var(--c-surface2)');

// Replacements for RGBA
css = css.replace(/rgba\(\s*139\s*,\s*92\s*,\s*246\s*,\s*([0-9.]+)\s*\)/g, 'rgba(var(--c-neon-rgb), $1)');
css = css.replace(/rgba\(\s*124\s*,\s*58\s*,\s*237\s*,\s*([0-9.]+)\s*\)/g, 'rgba(var(--c-neon-rgb), $1)');

css = css.replace(/rgba\(\s*6\s*,\s*182\s*,\s*212\s*,\s*([0-9.]+)\s*\)/g, 'rgba(var(--c-neon2-rgb), $1)');

css = css.replace(/rgba\(\s*13\s*,\s*13\s*,\s*31\s*,\s*([0-9.]+)\s*\)/g, 'rgba(var(--c-surface-rgb), $1)');
css = css.replace(/rgba\(\s*19\s*,\s*19\s*,\s*42\s*,\s*([0-9.]+)\s*\)/g, 'rgba(var(--c-surface2-rgb), $1)');

css = css.replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([0-9.]+)\s*\)/g, 'rgba(var(--c-white-rgb), $1)');
css = css.replace(/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([0-9.]+)\s*\)/g, 'rgba(var(--c-black-rgb), $1)');

fs.writeFileSync('frontend/src/index.css', css);
console.log('CSS modified successfully');
