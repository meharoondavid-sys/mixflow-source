import { EngineerProfile, Client, Project, Notification } from '../types';
import { generateWaveformPeaks } from '../utils/audioEngine';

export const INITIAL_ENGINEER: EngineerProfile = {
  id: 'eng_01',
  name: 'Alex Rivers',
  studioName: 'Sonic Horizon Studios',
  email: 'alex@sonichorizon.audio',
  role: 'Senior Mixing & Mastering Engineer',
  avatarUrl: '',
  hourlyRate: 85,
  currency: 'USD',
  razorpayKeyId: 'rzp_live_mixflow_demo981',
  stripeConnected: true,
  phone: '+1 (415) 890-4421',
  bio: 'Specializing in Modern Pop, Indie Synthwave, and Punchy Club Masters. 12+ years in commercial sound.'
};

export const INITIAL_CLIENTS: Client[] = [
  {
    id: 'cli_01',
    name: 'Sarah Jenkins',
    email: 'sarah.j@nightrecords.co',
    phone: '+1 (212) 555-0182',
    company: 'Nightfall Records',
    projectCount: 2,
    totalBilled: 1650,
    createdAt: '2026-08-14'
  },
  {
    id: 'cli_02',
    name: 'Marcus Vance',
    email: 'marcus@theechotrio.com',
    phone: '+44 20 7946 0912',
    company: 'The Midnight Trio',
    projectCount: 1,
    totalBilled: 800,
    createdAt: '2026-09-02'
  },
  {
    id: 'cli_03',
    name: 'Kaelen Miller',
    email: 'kaelen@soundpulse.io',
    phone: '+1 (310) 555-0199',
    company: 'Pulsewave Audio',
    projectCount: 3,
    totalBilled: 2400,
    createdAt: '2026-07-20'
  }
];

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj_01',
    title: 'Neon Nights (Main Vocal Mix)',
    artist: 'Sarah Jenkins',
    genre: 'Synthwave / Indie Pop',
    clientId: 'cli_01',
    clientName: 'Sarah Jenkins',
    clientEmail: 'sarah.j@nightrecords.co',
    clientPhone: '+1 (212) 555-0182',
    status: 'in-review',
    brief: 'Looking for a warm, punchy analog 80s feel with crisp modern vocal presence. Reference tracks: The Weeknd - Blinding Lights, Dua Lipa - Physical. Make the chorus explode with width.',
    referenceTracks: ['The Weeknd - Blinding Lights', 'The Midnight - Sunset'],
    totalAmount: 950,
    paidAmount: 450,
    shareToken: 'rev-neon-77a8',
    activeVersionId: 'v2',
    isApproved: false,
    invoiceNumber: 'INV-2026-0041',
    invoiceDate: '2026-09-24',
    dueDate: '2026-10-15',
    createdAt: '2026-09-22',
    versions: [
      {
        id: 'v2',
        projectId: 'proj_01',
        versionNumber: 2,
        versionName: 'Mix V2 - Tamed Sibilance & Louder Snare',
        notes: 'Addressed feedback from V1: De-essed vocals at 6.8kHz, boosted snare transient crack by 2dB, tightened sub-bass at 45Hz with SSL G-Bus sidechain.',
        durationSeconds: 184,
        sampleRate: '48.0 kHz',
        bitDepth: '24-bit',
        lufs: -10.2,
        createdAt: '2026-09-28',
        waveformPeaks: generateWaveformPeaks(42, 85, 1.25)
      },
      {
        id: 'v1',
        projectId: 'proj_01',
        versionNumber: 1,
        versionName: 'Mix V1 - Initial Rough Balance',
        notes: 'First full balance pass with analog tape saturation across master buss. Vocal leveling completed.',
        durationSeconds: 184,
        sampleRate: '48.0 kHz',
        bitDepth: '24-bit',
        lufs: -12.4,
        createdAt: '2026-09-23',
        waveformPeaks: generateWaveformPeaks(42, 85, 1.0)
      }
    ],
    comments: [
      {
        id: 'c_01',
        versionId: 'v1',
        author: 'Sarah Jenkins',
        authorRole: 'client',
        text: 'The lead vocal feels slightly piercing on the "S" sounds right here during the bridge entry.',
        timestampSeconds: 42,
        resolved: true,
        createdAt: '2026-09-24 14:22',
        replyText: 'Fixed in V2 with FabFilter Pro-DS dynamic notch.'
      },
      {
        id: 'c_02',
        versionId: 'v1',
        author: 'Sarah Jenkins',
        authorRole: 'client',
        text: 'Can we get a bit more slapback reverb on the synth lead before the drop?',
        timestampSeconds: 78,
        resolved: true,
        createdAt: '2026-09-24 14:28',
        replyText: 'Added Lexicon 224 plate throw on the lead synth.'
      },
      {
        id: 'c_03',
        versionId: 'v2',
        author: 'Sarah Jenkins',
        authorRole: 'client',
        text: 'V2 sounds incredible! Love the new vocal depth. Can we check the kick punch on phone speakers at the 1:52 breakdown?',
        timestampSeconds: 112,
        resolved: false,
        createdAt: '2026-09-29 18:10'
      }
    ],
    activities: [
      {
        id: 'act_01',
        timestamp: '2026-09-22 10:00',
        actor: 'Alex Rivers',
        type: 'created',
        description: 'Project created with initial stereo stems.'
      },
      {
        id: 'act_02',
        timestamp: '2026-09-23 16:30',
        actor: 'Alex Rivers',
        type: 'version_uploaded',
        description: 'Uploaded Mix V1 (Initial Balance).'
      },
      {
        id: 'act_03',
        timestamp: '2026-09-24 14:22',
        actor: 'Sarah Jenkins (Client)',
        type: 'comment_added',
        description: 'Left 2 timestamped feedback notes on V1.'
      },
      {
        id: 'act_04',
        timestamp: '2026-09-28 11:15',
        actor: 'Alex Rivers',
        type: 'version_uploaded',
        description: 'Uploaded Mix V2 with revision notes.'
      },
      {
        id: 'act_05',
        timestamp: '2026-09-29 18:10',
        actor: 'Sarah Jenkins (Client)',
        type: 'comment_added',
        description: 'Client opened review link and added note on V2 at 1:52.'
      }
    ],
    deliveries: [
      {
        id: 'del_01',
        name: 'Neon_Nights_Master_24bit_48k.wav',
        format: 'WAV 24-bit / 48kHz',
        size: '52.4 MB',
        type: 'master',
        downloadUrl: '#'
      },
      {
        id: 'del_02',
        name: 'Neon_Nights_Streaming_320k.mp3',
        format: 'MP3 320 kbps',
        size: '7.2 MB',
        type: 'master',
        downloadUrl: '#'
      },
      {
        id: 'del_03',
        name: 'Neon_Nights_Instrumental.wav',
        format: 'WAV 24-bit / 48kHz',
        size: '51.8 MB',
        type: 'instrumental',
        downloadUrl: '#'
      },
      {
        id: 'del_04',
        name: 'Neon_Nights_Full_Stems_Pack.zip',
        format: 'ZIP Archive (14 Stems)',
        size: '418.0 MB',
        type: 'stems',
        downloadUrl: '#'
      }
    ]
  },
  {
    id: 'proj_02',
    title: 'Echoes in the Rain (EP Title Track)',
    artist: 'The Midnight Trio',
    genre: 'Neo-Soul / R&B',
    clientId: 'cli_02',
    clientName: 'Marcus Vance',
    clientEmail: 'marcus@theechotrio.com',
    clientPhone: '+44 20 7946 0912',
    status: 'approved',
    brief: 'Silky analog soul sound. Rhodes piano needs to be lush and wide, warm upright bass character, vintage tape sheen.',
    referenceTracks: ['Leon Bridges - Texas Sun', 'Khruangbin - Texas Sun'],
    totalAmount: 800,
    paidAmount: 400,
    shareToken: 'rev-echo-33m9',
    activeVersionId: 'v1',
    isApproved: true,
    approvedAt: '2026-09-30 16:45',
    invoiceNumber: 'INV-2026-0042',
    invoiceDate: '2026-09-18',
    dueDate: '2026-10-05',
    createdAt: '2026-09-18',
    versions: [
      {
        id: 'v1',
        projectId: 'proj_02',
        versionNumber: 1,
        versionName: 'Mix V1 - Master Ready Pass',
        notes: 'Full analog summing pass through Neve 1073 preamps into Manley Variable-Mu compressor.',
        durationSeconds: 215,
        sampleRate: '96.0 kHz',
        bitDepth: '24-bit',
        lufs: -13.1,
        createdAt: '2026-09-25',
        waveformPeaks: generateWaveformPeaks(88, 85, 1.1)
      }
    ],
    comments: [
      {
        id: 'c_04',
        versionId: 'v1',
        author: 'Marcus Vance',
        authorRole: 'client',
        text: 'The warm tone on the acoustic bass is perfect. Everything sits right in the pocket!',
        timestampSeconds: 34,
        resolved: true,
        createdAt: '2026-09-29 11:20'
      }
    ],
    activities: [
      {
        id: 'act_06',
        timestamp: '2026-09-25 15:00',
        actor: 'Alex Rivers',
        type: 'version_uploaded',
        description: 'Uploaded Master Ready Pass V1.'
      },
      {
        id: 'act_07',
        timestamp: '2026-09-30 16:45',
        actor: 'Marcus Vance (Client)',
        type: 'approved',
        description: 'Client approved Mix V1 as Final Master! Awaiting final balance payment.'
      }
    ],
    deliveries: [
      {
        id: 'del_05',
        name: 'Echoes_In_The_Rain_Master_24bit_96k.wav',
        format: 'WAV 24-bit / 96kHz',
        size: '112.5 MB',
        type: 'master',
        downloadUrl: '#'
      },
      {
        id: 'del_06',
        name: 'Echoes_In_The_Rain_Instrumental.wav',
        format: 'WAV 24-bit / 96kHz',
        size: '110.2 MB',
        type: 'instrumental',
        downloadUrl: '#'
      }
    ]
  },
  {
    id: 'proj_03',
    title: 'Hyperdrive (Club Extended Mix)',
    artist: 'DJ Kaelen',
    genre: 'Melodic Techno / House',
    clientId: 'cli_03',
    clientName: 'Kaelen Miller',
    clientEmail: 'kaelen@soundpulse.io',
    clientPhone: '+1 (310) 555-0199',
    status: 'completed',
    brief: 'High energy festival club master. Target -8.0 LUFS without harsh distortion. Punchy sub at 38Hz.',
    referenceTracks: ['CamelPhat - Cola', 'ARTBAT - Horizon'],
    totalAmount: 750,
    paidAmount: 750,
    shareToken: 'rev-hype-88b1',
    activeVersionId: 'v3',
    isApproved: true,
    approvedAt: '2026-09-15 14:00',
    invoiceNumber: 'INV-2026-0038',
    invoiceDate: '2026-09-08',
    dueDate: '2026-09-22',
    createdAt: '2026-09-05',
    versions: [
      {
        id: 'v3',
        projectId: 'proj_03',
        versionNumber: 3,
        versionName: 'Mix V3 - Final Club Master (-8.0 LUFS)',
        notes: 'Final clip-limiting pass with Weiss DS1-MK3. Tested in club PA monitoring environment.',
        durationSeconds: 240,
        sampleRate: '48.0 kHz',
        bitDepth: '24-bit',
        lufs: -8.0,
        createdAt: '2026-09-14',
        waveformPeaks: generateWaveformPeaks(123, 85, 1.4)
      }
    ],
    comments: [],
    activities: [
      {
        id: 'act_08',
        timestamp: '2026-09-15 14:00',
        actor: 'Kaelen Miller (Client)',
        type: 'approved',
        description: 'Client approved Mix V3.'
      },
      {
        id: 'act_09',
        timestamp: '2026-09-15 14:15',
        actor: 'Kaelen Miller (Client)',
        type: 'payment_received',
        description: 'Balance payment of $750.00 received via Razorpay/Card.'
      },
      {
        id: 'act_10',
        timestamp: '2026-09-15 14:20',
        actor: 'Kaelen Miller (Client)',
        type: 'files_downloaded',
        description: 'Final 24-bit Masters package downloaded.'
      }
    ],
    deliveries: [
      {
        id: 'del_07',
        name: 'Hyperdrive_Club_Master_24bit.wav',
        format: 'WAV 24-bit / 48kHz',
        size: '68.0 MB',
        type: 'master',
        downloadUrl: '#'
      },
      {
        id: 'del_08',
        name: 'Hyperdrive_Radio_Edit.wav',
        format: 'WAV 24-bit / 48kHz',
        size: '42.1 MB',
        type: 'master',
        downloadUrl: '#'
      }
    ]
  }
];

export const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif_01',
    projectId: 'proj_01',
    projectTitle: 'Neon Nights (Main Vocal Mix)',
    title: 'New Client Feedback',
    message: 'Sarah Jenkins left a note at 01:52 on Mix V2: "Can we check the kick punch on phone speakers..."',
    time: '2 hours ago',
    read: false,
    type: 'comment'
  },
  {
    id: 'notif_02',
    projectId: 'proj_02',
    projectTitle: 'Echoes in the Rain (EP Title Track)',
    title: 'Mix Approved!',
    message: 'Marcus Vance approved Mix V1 as Final Master! Awaiting final balance payment.',
    time: 'Yesterday',
    read: false,
    type: 'approval'
  },
  {
    id: 'notif_03',
    projectId: 'proj_03',
    projectTitle: 'Hyperdrive (Club Extended Mix)',
    title: 'Payment Received ($750)',
    message: 'DJ Kaelen paid invoice INV-2026-0038 in full. Final files downloaded.',
    time: '3 days ago',
    read: true,
    type: 'payment'
  }
];
