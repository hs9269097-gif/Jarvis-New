// Custom JARVIS icon set — one consistent 1.5px line style, no icon-library soup.
import type { SVGProps } from "react";

const paths: Record<string, React.ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></>,
  chat: <><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2-5.6A8.5 8.5 0 1 1 21 11.5Z" /><path d="M8.5 11h7M8.5 14.5h4.5" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" /><path d="M12 18v3" /></>,
  tasks: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9l2 2 4-4" /><path d="M8 15.5h8" /></>,
  automation: <><circle cx="5" cy="6" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><path d="M7 6h10M5.8 7.6 11 16.4M18.2 7.6 13 16.4" /></>,
  memory: <><ellipse cx="12" cy="5.5" rx="8" ry="3" /><path d="M4 5.5V12c0 1.7 3.6 3 8 3s8-1.3 8-3V5.5" /><path d="M4 12v6.5c0 1.7 3.6 3 8 3s8-1.3 8-3V12" /></>,
  tools: <><path d="M14.5 6.5a4 4 0 0 0 5 5L16 15l-2.5-.5L13 12l-3.5 3.5a4 4 0 1 0 1 5L14 17l2 1.5" /><circle cx="6.5" cy="17.5" r="1.3" /></>,
  web: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  files: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h6" /></>,
  code: <><path d="m8 8-5 4 5 4M16 8l5 4-5 4" /><path d="m13.5 5-3 14" /></>,
  system: <><path d="M3 12h4l2.5-6 4 12 2.5-6H21" /></>,
  security: <><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6Z" /><path d="m9 12 2 2 4-4" /></>,
  logs: <><path d="M4 6h16M4 12h16M4 18h10" /><circle cx="18" cy="18" r="2.2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" /></>,
  send: <><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4Z" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 20h16" /></>,
  image: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m4 17 4.5-4.5 3 3L16 11l4 4" /></>,
  stop: <rect x="6" y="6" width="12" height="12" rx="1.5" />,
  x: <><path d="M6 6l12 12M18 6 6 18" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  alert: <><path d="M12 3 2.5 20h19Z" /><path d="M12 9.5V14M12 16.8v.2" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  sigma: <><path d="M18 5H6l6 7-6 7h12" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  database: <><ellipse cx="12" cy="5.5" rx="8" ry="3" /><path d="M4 5.5V12c0 1.7 3.6 3 8 3s8-1.3 8-3V5.5" /><path d="M4 12v6.5c0 1.7 3.6 3 8 3s8-1.3 8-3V12" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></>,
  shield: <><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6Z" /></>,
  activity: <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />,
  play: <path d="M7 5v14l12-7Z" />,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  retry: <><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 3v4h-4" /></>,
  trash: <><path d="M4 7h16M9 7V5h6v2M6.5 7l1 13h9l1-13" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  zap: <path d="M13 2 4 14h6l-1 8 9-12h-6Z" />,
  layers: <><path d="m12 3 9 5-9 5-9-5Z" /><path d="m3 13 9 5 9-5" /></>,
  eye: <><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="2.8" /></>,
  filter: <path d="M4 5h16l-6 7v5l-4 2v-7Z" />,
  bolt: <path d="M13 2 4 14h6l-1 8 9-12h-6Z" />,
  terminal: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 9 3 3-3 3M12.5 15H17" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 3v4h-4" /></>,
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 18, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
