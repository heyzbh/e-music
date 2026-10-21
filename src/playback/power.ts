import EPlayer from '../../modules/e-player';

export interface PowerGuide {
  vendor: string;
  steps: string[];
}

// Wording follows the current vendor skins; menu names shift slightly between versions.
const GUIDES: Record<string, PowerGuide> = {
  xiaomi: {
    vendor: 'Xiaomi / Redmi / POCO (HyperOS, MIUI)',
    steps: [
      'Open Autostart and enable it for E Music.',
      'App info > Battery saver > No restrictions.',
      'Recent apps: long-press E Music and tap the lock icon.',
    ],
  },
  samsung: {
    vendor: 'Samsung (One UI)',
    steps: [
      'App info > Battery > Unrestricted.',
      'Settings > Battery > Background usage limits: make sure E Music is not in Sleeping or Deep sleeping apps.',
      'Add E Music to Never sleeping apps.',
    ],
  },
  huawei: {
    vendor: 'Huawei (EMUI)',
    steps: [
      'Open App launch, turn off Manage automatically for E Music.',
      'Enable Auto-launch, Secondary launch and Run in background.',
      'Recent apps: swipe down on E Music to lock it.',
    ],
  },
  honor: {
    vendor: 'Honor (MagicOS)',
    steps: ['Open App launch, turn off Manage automatically, enable all three options.'],
  },
  oppo: {
    vendor: 'Oppo / Realme / OnePlus (ColorOS, OxygenOS)',
    steps: ['Allow Auto launch for E Music.', 'App info > Battery usage > Allow background activity.'],
  },
  vivo: {
    vendor: 'Vivo (Funtouch / OriginOS)',
    steps: ['Allow background startup for E Music.', 'Battery > High background power consumption: allow E Music.'],
  },
};

const GENERIC: PowerGuide = {
  vendor: 'Android',
  steps: ['App info > Battery > Unrestricted (or "Don\'t optimise").'],
};

export function getPowerGuide(): PowerGuide {
  return GUIDES[EPlayer.getDeviceInfo().manufacturer] ?? GENERIC;
}

export const isBatteryOptimised = (): boolean => !EPlayer.isIgnoringBatteryOptimizations();
