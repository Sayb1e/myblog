import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconOverview(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Base>
  );
}

export function IconDaily(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4" />
      <path d="M9 12h7M9 16h7" />
    </Base>
  );
}

export function IconChat(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 5h16v11H8l-4 4z" />
    </Base>
  );
}

export function IconTerminal(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9l3 3-3 3M13 15h4" />
    </Base>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </Base>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-1 1.46V21a2 2 0 1 1-4 0v-.09A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.46-1H3a2 2 0 1 1 0-4h.09A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.6 1.6 0 0 0 9 4.6a1.6 1.6 0 0 0 1-1.46V3a2 2 0 1 1 4 0v.09a1.6 1.6 0 0 0 1 1.46 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.6 1.6 0 0 0 19.4 9v.09a1.6 1.6 0 0 0 1.46 1H21a2 2 0 1 1 0 4h-.09a1.6 1.6 0 0 0-1.46 1z" />
    </Base>
  );
}

export function IconSun(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Base>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </Base>
  );
}

export function IconContrast(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 9l6 6 6-6" />
    </Base>
  );
}

export function IconChevron(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M15 6l-6 6 6 6" />
    </Base>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </Base>
  );
}

export function IconClose(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Base>
  );
}

export function IconMinimize(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 12h14" />
    </Base>
  );
}

export function IconMaximize(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="5" y="5" width="14" height="14" rx="1.5" />
    </Base>
  );
}

export function IconRestore(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="8" y="8" width="11" height="11" rx="1.5" />
      <path d="M5 16V6.5A1.5 1.5 0 0 1 6.5 5H16" />
    </Base>
  );
}

export function IconCopy(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </Base>
  );
}

export function IconDownload(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3v11M7 10l5 5 5-5M4 20h16" />
    </Base>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </Base>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </Base>
  );
}

export function IconSpark(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15l-1.8-4.2L5.5 9l4.7-1.3z" />
      <path d="M18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z" />
    </Base>
  );
}

export function IconCommand(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M9 9h6v6H9zM9 15H7.5a1.5 1.5 0 1 0 1.5 1.5zM15 9h1.5A1.5 1.5 0 1 0 15 7.5z" />
    </Base>
  );
}

export function IconArrowDown(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </Base>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </Base>
  );
}

export function IconSliders(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </Base>
  );
}

export function IconFolder(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 6h6l2 2h10v10H3z" />
    </Base>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  );
}

export function IconPencil(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M14 6l4 4" />
    </Base>
  );
}

export function IconFile(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4" />
    </Base>
  );
}

export function IconFolderOpen(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 7h6l2 2h10v3" />
      <path d="M3 7v12h18l1.6-7H8.4L6.6 19" />
    </Base>
  );
}

export function IconArrowLeft(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M15 5l-7 7 7 7" />
    </Base>
  );
}

export function IconWrench(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </Base>
  );
}

export function IconGit(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="6" cy="18" r="2.4" />
      <circle cx="18" cy="8" r="2.4" />
      <path d="M6 8.4v7.2M18 10.4c0 3-2.4 4.2-5.4 4.2H8.2" />
    </Base>
  );
}

export function IconTrophy(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M8 4h8v4a4 4 0 0 1-8 0z" />
      <path d="M8 5H5v1a3 3 0 0 0 3 3M16 5h3v1a3 3 0 0 1-3 3" />
      <path d="M12 12v4M9 20h6M10 20v-2h4v2" />
    </Base>
  );
}

export function IconPuzzle(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9 4a2 2 0 0 1 4 0v1h4a1 1 0 0 1 1 1v4h1a2 2 0 1 1 0 4h-1v4a1 1 0 0 1-1 1h-4v-1a2 2 0 1 0-4 0v1H5a1 1 0 0 1-1-1v-4h1a2 2 0 1 0 0-4H4V6a1 1 0 0 1 1-1h4z" />
    </Base>
  );
}
