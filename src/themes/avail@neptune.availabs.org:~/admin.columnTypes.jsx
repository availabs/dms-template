import React from 'react'
import { ThemeContext, getComponentTheme } from '../../dms/packages/dms/src/ui/useTheme'

const AVATAR_COLORS = [
  'bg-[#5D8A85]', 'bg-[#B45309]', 'bg-[#B5532C]', 'bg-[#4A5160]', 'bg-[#2A2F36]',
];

function colorIndex(str) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff;
  return h % AVATAR_COLORS.length;
}

export function TypeBadgeView({ value }) {
  const { theme: themeFromContext = {} } = React.useContext(ThemeContext) || {};
  const t = getComponentTheme(themeFromContext, 'admin');
  const variantKey = { page: 'typeBadgePage', datasets: 'typeBadgeDatasets', forms: 'typeBadgeForms', auth: 'typeBadgeAuth', mapeditor: 'typeBadgeMapeditor' }[value];
  if (!value) return null;
  return <span className={`${t.typeBadge || ''} ${t[variantKey] || ''}`}>{value}</span>;
}

export function TypeBadgeEdit({ value }) {
  return <span>{value || ''}</span>;
}

export function SubdomainPillView({ value }) {
  const { theme: themeFromContext = {} } = React.useContext(ThemeContext) || {};
  const t = getComponentTheme(themeFromContext, 'admin');
  const isGlobal = !value || value === '*';
  return (
    <span className={`${t.subdomainPill || ''} ${isGlobal ? t.subdomainPillGlobal || '' : ''}`}>
      {isGlobal ? '* global' : value}
    </span>
  );
}

export function SubdomainPillEdit({ value }) {
  return <span>{value || ''}</span>;
}

export function UserAvatarView({ value }) {
  const { theme: themeFromContext = {} } = React.useContext(ThemeContext) || {};
  const t = getComponentTheme(themeFromContext, 'admin');
  const email = value || '';
  const initials = email.slice(0, 2).toUpperCase();
  const color = AVATAR_COLORS[colorIndex(email)];
  return (
    <span className={`${t.avatar || ''} ${color} rounded-full`} title={email}>
      {initials}
    </span>
  );
}

export function UserAvatarEdit({ value }) {
  return <span>{value || ''}</span>;
}

export function GroupPillView({ value }) {
  const { theme: themeFromContext = {} } = React.useContext(ThemeContext) || {};
  const t = getComponentTheme(themeFromContext, 'admin');
  const groups = Array.isArray(value) ? value : (value ? [value] : []);
  return (
    <div className="flex flex-wrap gap-1">
      {groups.map(g => {
        const variant = /admin/i.test(g) ? t.groupPillAdmin || ''
          : /edit|steward|author/i.test(g) ? t.groupPillEditor || ''
          : '';
        return <span key={g} className={`${t.groupPill || ''} ${variant}`}>{g}</span>;
      })}
    </div>
  );
}

export function GroupPillEdit({ value }) {
  return <span>{Array.isArray(value) ? value.join(', ') : value || ''}</span>;
}

export function PermBadgeView({ value }) {
  const { theme: themeFromContext = {} } = React.useContext(ThemeContext) || {};
  const t = getComponentTheme(themeFromContext, 'admin');
  const variantKey = { admin: 'permBadgeAdmin', editor: 'permBadgeEditor', viewer: 'permBadgeViewer', public: 'permBadgePublic' }[value];
  return <span className={`${t.permBadge || ''} ${t[variantKey] || t.permBadgeViewer || ''}`}>{value || '—'}</span>;
}

export function PermBadgeEdit({ value }) {
  return <span>{value || ''}</span>;
}

export function AvatarStackView({ value }) {
  const { theme: themeFromContext = {} } = React.useContext(ThemeContext) || {};
  const t = getComponentTheme(themeFromContext, 'admin');
  const count = typeof value === 'number' ? value : 0;
  const show = Math.min(count, 3);
  const overflow = count - show;
  return (
    <div className={t.avatarStack || 'flex'}>
      {Array.from({ length: show }).map((_, i) => (
        <span key={i} className={`${t.avatarStackItem || ''} ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`} />
      ))}
      {overflow > 0 && (
        <span className={`${t.avatarStackItem || ''} ${t.avatarStackOverflow || ''}`}>+{overflow}</span>
      )}
    </div>
  );
}
