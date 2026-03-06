import Link from 'next/link'
import { Locale, locales } from '@/lib/i18n/locales'

interface LocaleSwitcherProps {
  locale: Locale
  slug: string
}

function getHref(locale: Locale, slug: string): string {
  const normalizedSlug = slug.replace(/^\/+|\/+$/g, '')
  return normalizedSlug ? `/${locale}/${normalizedSlug}` : `/${locale}`
}

export default function LocaleSwitcher({ locale, slug }: LocaleSwitcherProps) {
  return (
    <nav className="locale-switcher" aria-label="Language switcher">
      {locales.map((value) => (
        <Link
          key={value}
          href={getHref(value, slug)}
          className={`locale-switcher-link${value === locale ? ' is-active' : ''}`}
          aria-current={value === locale ? 'page' : undefined}
        >
          {value.toUpperCase()}
        </Link>
      ))}
    </nav>
  )
}
