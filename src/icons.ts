import type { IconName } from "./types";

export const icons: Record<IconName, string> = {
  leaf: '<svg class="icon" viewBox="0 0 24 24"><path d="M11 20A7 7 0 0 1 4 13c0-3.8 3.2-7 7-7 2.8 0 5.3 1.7 6.4 4.1"></path><path d="M11 20c0-4.4 3.6-8 8-8h1v1c0 4.4-3.6 8-8 8h-1z"></path><path d="M15 15l-4 4"></path></svg>',
  users:
    '<svg class="icon" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
  bowl: '<svg class="icon" viewBox="0 0 24 24"><path d="M4 11a8 8 0 0 0 16 0"></path><path d="M4 11h16"></path><path d="M12 3v8"></path><path d="M8 3v3"></path><path d="M16 3v3"></path></svg>',
  pot: '<svg class="icon" viewBox="0 0 24 24"><path d="M5 6h14"></path><path d="M5 6l1.5 13h11L19 6"></path><path d="M8 6V4h8v2"></path><path d="M3 10h2"></path><path d="M19 10h2"></path></svg>',
  link: '<svg class="icon" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.1 0l2.1-2.1a5 5 0 0 0-7.1-7.1L11 4.9"></path><path d="M14 11a5 5 0 0 0-7.1 0l-2.1 2.1a5 5 0 0 0 7.1 7.1L13 19.1"></path></svg>',
  clock:
    '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>',
  zap: '<svg class="icon" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>',
  heart:
    '<svg class="icon" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"></path></svg>',
  salt: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 2v20"></path><path d="M8 6h8"></path><path d="M8 10h8"></path><path d="M9 22h6"></path></svg>',
  globe:
    '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="M2 12h20"></path><path d="M12 2a15 15 0 0 1 0 20"></path><path d="M12 2a15 15 0 0 0 0 20"></path></svg>',
  bag: '<svg class="icon" viewBox="0 0 24 24"><path d="M3 10h18"></path><path d="M5 10v10h14V10"></path><path d="M7 10V6a5 5 0 0 1 10 0v4"></path></svg>',
  ban: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="M4.9 4.9l14.2 14.2"></path></svg>',
  alert:
    '<svg class="icon" viewBox="0 0 24 24"><path d="M10.3 3.3L2.7 20.7a1.5 1.5 0 0 0 1.4 2.1h15.8a1.5 1.5 0 0 0 1.4-2.1L13.7 3.3a1.9 1.9 0 0 0-3.4 0z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>',
  note: '<svg class="icon" viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path></svg>',
  copy: '<svg class="icon" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path></svg>',
  adult:
    '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="7" r="4"></circle><path d="M5.5 21a6.5 6.5 0 0 1 13 0"></path></svg>',
  senior:
    '<svg class="icon" viewBox="0 0 24 24"><circle cx="10" cy="5" r="3"></circle><path d="M10 8v5l-3 4"></path><path d="M10 13l4 2"></path><path d="M17 22V10"></path><path d="M17 10h3"></path></svg>',
  child:
    '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="5" r="3"></circle><path d="M12 8v8"></path><path d="M5 11l7-3 7 3"></path><path d="M8 21l4-5 4 5"></path></svg>',
  baby: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="7" r="3"></circle><path d="M8 14h8"></path><path d="M9 11l-3 3 3 3"></path><path d="M15 11l3 3-3 3"></path><path d="M8 20h8"></path></svg>',
};

export const icon = (name: IconName): string => icons[name] ?? "";
