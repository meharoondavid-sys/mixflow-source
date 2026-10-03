import JSZip from 'jszip';

// Use Vite's native raw glob import to bundle all project source code dynamically
const sourceFiles = import.meta.glob(
  [
    '../**/*.{ts,tsx,css,json,html,js}',
    '../../index.html',
    '../../package.json',
    '../../tsconfig.json',
    '../../vite.config.ts',
    '../../metadata.json',
    '../../.env.example'
  ],
  { query: '?raw', eager: true, import: 'default' }
);

export async function downloadProjectSourceZip() {
  const zip = new JSZip();

  // Root folder in the zip
  const root = zip.folder('mixflow-app') || zip;

  for (const [path, content] of Object.entries(sourceFiles)) {
    // Normalize path to remove relative prefixes like '../../' or '../'
    let cleanPath = path.replace(/^\.\.\/\.\.\//, '').replace(/^\.\.\//, 'src/');
    // If it started with ../src, clean it up
    cleanPath = cleanPath.replace(/^src\/src\//, 'src/');
    root.file(cleanPath, content as string);
  }

  // Add README.md
  root.file(
    'README.md',
    `# MixFlow - SaaS for Freelance Music Mixing & Mastering Engineers

MixFlow is a modern music-tech platform for audio professionals to manage clients, track revisions, collect timestamped feedback on waveform audio, approve mixes, receive payments (Razorpay/Stripe), and deliver final 24-bit masters.

## Tech Stack
- React 19 + TypeScript
- Tailwind CSS v4
- Web Audio API (real-time studio synth & audio playback engine)
- Lucide React Icons

## Getting Started

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Run local development server:
\`\`\`bash
npm run dev
\`\`\`

3. Build for production:
\`\`\`bash
npm run build
\`\`\`
`
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mixflow-complete-source-${new Date().toISOString().split('T')[0]}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
