export {};

declare global {
  type FlockSession = {
    token: string;
    email: string;
    role: string;
    expiresAt?: number;
    displayName?: string;
    roleLevel?: number;
    permissions?: Record<string, boolean>;
    groups?: string | string[];
    isSeed?: boolean;
    churchName?: string;
    [key: string]: any;
  };

  interface Window {
    BEZALEL_CODE_GS: string;
    BEZALEL_CODE_GS_LINES: number;
    TheVine: any;
    UpperRoom: any;
    TheWellspring: any;
    Nehemiah: any;
    TheHarvest: any;
    TheFold: any;
    TheTruth: any;
    TheScribes: any;
    Trumpet: any;
    NCAppSwitcher: any;
    Modules: any;
    firebase: any;
    FLOCK_FIREBASE_CONFIG: any;
    FLOCK_CHURCH_ID: string;
    FLOCK_TRUTH_USE_LOCAL: boolean;
    __lifeReloadIx: any;
    _INVITE_SHARE_URL: string;
    _openOutreachModal: any;
  }

  interface EventTarget {
    closest(selectors: string): Element | null;
  }

  interface Element {
    style: CSSStyleDeclaration;
    value: string;
    disabled: boolean;
    checked: boolean;
    dataset: DOMStringMap;
    options: HTMLOptionsCollection;
    selectedIndex: number;
    open?: boolean;
    focus(): void;
    src: string;
    href: string;
    innerHTML: string;
    contains(other: any): boolean;
    closest(selectors: string): Element | null;
    _wired?: boolean;
    _userEdited?: boolean;
    _prayerSummaryFn?: () => string | Promise<string>;
  }

  var UpperRoom: any;
  var TheVine: any;
  var TheWellspring: any;
  var Modules: any;
  var firebase: any;
  var XLSX: any;
  var Trumpet: any;
  var Nehemiah: any;
  var TheHarvest: any;
  var TheFold: any;
  var TheTruth: any;
  var TheScribes: any;
  var NCAppSwitcher: any;

  function navigate(route: string): void;
}
