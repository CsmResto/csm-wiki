import { GetStaticPaths, GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import LocaleSwitcher from '@/components/LocaleSwitcher'
import { isLocale, Locale, locales } from '@/lib/i18n/locales'
import {
  getAllWikiRouteSlugs,
  getMarkdownData,
  getWikiDirectoryData,
  getWikiTree,
  isDirectorySlug,
  MarkdownData,
  WikiDirectoryData,
  WikiTreeNode,
} from '@/lib/markdown'

type BreadcrumbItem = {
  slug: string
  label: string
}

type PageProps =
  | {
      kind: 'directory'
      locale: Locale
      directory: WikiDirectoryData
      breadcrumbs: BreadcrumbItem[]
      tree: WikiTreeNode
    }
  | {
      kind: 'page'
      locale: Locale
      page: MarkdownData
      breadcrumbs: BreadcrumbItem[]
      tree: WikiTreeNode
    }

type UiText = {
  rootTitle: string
  homeDescription: string
  copyLabel: string
  copiedLabel: string
  copyFailedLabel: string
  themeLightLabel: string
  themeDarkLabel: string
}

const uiTextByLocale: Record<Locale, UiText> = {
  ru: {
    rootTitle: 'CSM Wiki',
    homeDescription: 'Корневая страница wiki',
    copyLabel: 'Копировать',
    copiedLabel: 'Скопировано',
    copyFailedLabel: 'Ошибка',
    themeLightLabel: 'Светлая',
    themeDarkLabel: 'Темная',
  },
  en: {
    rootTitle: 'CSM Wiki',
    homeDescription: 'Wiki root page',
    copyLabel: 'Copy',
    copiedLabel: 'Copied',
    copyFailedLabel: 'Failed',
    themeLightLabel: 'Light',
    themeDarkLabel: 'Dark',
  },
}

function buildWikiHref(locale: Locale, slug: string): string {
  const normalizedSlug = slug.replace(/^\/+|\/+$/g, '')
  return normalizedSlug ? `/${locale}/${normalizedSlug}` : `/${locale}`
}

function buildDirectoryBreadcrumbs(locale: Locale, slug: string): BreadcrumbItem[] {
  const normalizedSlug = slug.replace(/^\/+|\/+$/g, '')
  if (!normalizedSlug) {
    return []
  }

  const segments = normalizedSlug.split('/').filter(Boolean)
  return segments.map((_, index) => {
    const itemSlug = segments.slice(0, index + 1).join('/')
    const directory = getWikiDirectoryData(locale, itemSlug)

    return {
      slug: itemSlug,
      label: directory?.name ?? segments[index],
    }
  })
}

function buildPageBreadcrumbs(locale: Locale, page: MarkdownData): BreadcrumbItem[] {
  const segments = page.slug.split('/').filter(Boolean)
  const breadcrumbs: BreadcrumbItem[] = []

  for (let index = 0; index < segments.length - 1; index += 1) {
    const directorySlug = segments.slice(0, index + 1).join('/')
    const directory = getWikiDirectoryData(locale, directorySlug)

    breadcrumbs.push({
      slug: directorySlug,
      label: directory?.name ?? segments[index],
    })
  }

  breadcrumbs.push({
    slug: page.slug,
    label: page.title,
  })

  return breadcrumbs
}

function buildOpenSlugs(slug: string, kind: PageProps['kind']): Set<string> {
  const normalized = slug.replace(/^\/+|\/+$/g, '')
  if (!normalized) {
    return new Set()
  }

  const segments = normalized.split('/').filter(Boolean)
  const limit = kind === 'page' ? Math.max(segments.length - 1, 0) : segments.length
  const open = new Set<string>()

  for (let index = 0; index < limit; index += 1) {
    const segmentSlug = segments.slice(0, index + 1).join('/')
    if (segmentSlug) {
      open.add(segmentSlug)
    }
  }

  return open
}

export default function WikiPage(props: PageProps) {
  const { basePath } = useRouter()
  const [assetPrefix, setAssetPrefix] = useState(basePath ? `${basePath}/` : '/')
  const text = uiTextByLocale[props.locale]
  const currentSlug = props.kind === 'directory' ? props.directory.slug : props.page.slug
  const breadcrumbs = props.breadcrumbs
  const tree = props.tree
  const markdownContentRef = useRef<HTMLDivElement | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [isHeaderHidden, setIsHeaderHidden] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const openSlugs = buildOpenSlugs(currentSlug, props.kind)

  useEffect(() => {
    const stored = window.localStorage.getItem('wiki-theme')
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
    const initialTheme = stored === 'light' || stored === 'dark' ? stored : prefersLight ? 'light' : 'dark'
    setTheme(initialTheme)
    document.documentElement.setAttribute('data-theme', initialTheme)
  }, [])

  useEffect(() => {
    if (basePath) {
      setAssetPrefix(`${basePath}/`)
      return
    }
    if (typeof window === 'undefined') {
      return
    }
    const segments = window.location.pathname.split('/').filter(Boolean)
    if (segments.length > 1 && segments[1] === props.locale) {
      setAssetPrefix(`/${segments[0]}/`)
      return
    }
    if (segments.length > 0 && segments[0] === props.locale) {
      setAssetPrefix('/')
      return
    }
    setAssetPrefix('/')
  }, [basePath, props.locale])

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(nextTheme)
    document.documentElement.setAttribute('data-theme', nextTheme)
    window.localStorage.setItem('wiki-theme', nextTheme)
  }

  useEffect(() => {
    let lastY = window.scrollY
    let ticking = false

    const update = () => {
      const currentY = window.scrollY
      const delta = currentY - lastY
      const nextHidden = currentY > 80 && delta > 6
      const shouldShow = delta < -6 || currentY < 40

      if (nextHidden !== isHeaderHidden && nextHidden) {
        setIsHeaderHidden(true)
      } else if (shouldShow && isHeaderHidden) {
        setIsHeaderHidden(false)
      }

      lastY = currentY
      ticking = false
    }

    const onScroll = () => {
      if (!ticking) {
        ticking = true
        window.requestAnimationFrame(update)
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isHeaderHidden])

  const renderNavList = (node: WikiTreeNode, level: number, onNavigate?: () => void) => {
    const hasChildren = node.directories.length > 0 || node.pages.length > 0
    if (!hasChildren) {
      return null
    }

    return (
      <ul className={`wiki-nav-list ${level === 0 ? 'is-root' : ''}`}>
        {node.directories.map((directory) => {
          const isOpen = openSlugs.has(directory.slug)
          const isActive = currentSlug === directory.slug
          return (
            <li key={directory.slug} className={`wiki-nav-item ${isActive ? 'is-active' : ''}`}>
              <Link href={buildWikiHref(props.locale, directory.slug)} className="wiki-nav-link" onClick={onNavigate}>
                {directory.name}
              </Link>
              {isOpen && renderNavList(directory, level + 1, onNavigate)}
            </li>
          )
        })}
        {node.pages.map((page) => {
          const isActive = currentSlug === page.slug
          return (
            <li key={page.slug} className={`wiki-nav-item ${isActive ? 'is-active' : ''}`}>
              <Link href={buildWikiHref(props.locale, page.slug)} className="wiki-nav-link" onClick={onNavigate}>
                {page.title}
              </Link>
            </li>
          )
        })}
      </ul>
    )
  }

  useEffect(() => {
    if (props.kind !== 'page') {
      return
    }

    const root = markdownContentRef.current
    if (!root) {
      return
    }

    const buttons = root.querySelectorAll<HTMLButtonElement>('[data-copy-code]')
    buttons.forEach((button) => {
      button.textContent = text.copyLabel
    })

    const findAnchorTarget = (rawId: string): HTMLElement | null => {
      if (!rawId) {
        return null
      }
      const direct = document.getElementById(rawId)
      if (direct) {
        return direct
      }
      return document.getElementById(`user-content-${rawId}`)
    }

    const scrollToAnchor = (rawId: string) => {
      const target = findAnchorTarget(rawId)
      if (!target) {
        return false
      }
      target.scrollIntoView({ block: 'start' })
      history.replaceState(null, '', `#${encodeURIComponent(rawId)}`)
      return true
    }

    const onClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const headingLink = target?.closest<HTMLAnchorElement>('h1 > a, h2 > a, h3 > a, h4 > a, h5 > a, h6 > a, .heading-anchor')
      if (headingLink) {
        event.preventDefault()
        const url = `${window.location.origin}${window.location.pathname}${headingLink.getAttribute('href') ?? ''}`
        try {
          await navigator.clipboard.writeText(url)
        } catch {}
        return
      }

      const anchorLink = target?.closest<HTMLAnchorElement>('a[href^="#"]')
      if (anchorLink) {
        const href = anchorLink.getAttribute('href') ?? ''
        const id = decodeURIComponent(href.slice(1))
        if (id) {
          event.preventDefault()
          if (scrollToAnchor(id)) {
            return
          }
        }
      }

      const button = target?.closest<HTMLButtonElement>('[data-copy-code]')
      if (!button) {
        return
      }

      const codeNode = button.closest('.code-block')?.querySelector('pre code')
      const codeText = codeNode?.textContent ?? ''
      if (!codeText) {
        return
      }

      try {
        await navigator.clipboard.writeText(codeText)
        button.textContent = text.copiedLabel
        button.classList.add('is-copied')

        window.setTimeout(() => {
          button.textContent = text.copyLabel
          button.classList.remove('is-copied')
        }, 1400)
      } catch {
        button.textContent = text.copyFailedLabel
        button.classList.add('is-copy-failed')

        window.setTimeout(() => {
          button.textContent = text.copyLabel
          button.classList.remove('is-copy-failed')
        }, 1700)
      }
    }

    root.addEventListener('click', onClick)
    if (window.location.hash) {
      const rawId = decodeURIComponent(window.location.hash.slice(1))
      if (rawId) {
        window.setTimeout(() => scrollToAnchor(rawId), 0)
      }
    }
    return () => {
      root.removeEventListener('click', onClick)
    }
  }, [props.kind, text.copyFailedLabel, text.copiedLabel, text.copyLabel])

  useEffect(() => {
    if (!isMobileMenuOpen) {
      document.body.style.overflow = ''
      return
    }
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  if (props.kind === 'directory') {
    const { directory, locale } = props
    const isRootDirectory = directory.slug === ''
    const directoryTitle = isRootDirectory ? text.rootTitle : directory.name

    return (
      <>
        <Head>
          <title>{directoryTitle} | CSM Wiki</title>
          <meta name="description" content={text.homeDescription} />
        </Head>
        <main className="wiki-shell">
          <aside className="wiki-sidebar">
            <div className="wiki-sidebar__header">
              <Link href={buildWikiHref(locale, '')} className="wiki-sidebar__title" aria-label={text.rootTitle}>
                <span className="wiki-sidebar__logo" aria-hidden="true">
                  <img
                    className="wiki-logo__full"
                    src={`${assetPrefix}assets/logo-full${theme === 'light' ? '-accent' : ''}.svg`}
                    alt=""
                  />
                  <img
                    className="wiki-logo__compact"
                    src={`${assetPrefix}assets/logo-compact${theme === 'light' ? '-accent' : ''}.svg`}
                    alt=""
                  />
                </span>
              </Link>
            </div>
            {renderNavList(tree, 0)}
          </aside>
          <section className="wiki-content">
            <header className={`wiki-toolbar wiki-toolbar--sticky ${isHeaderHidden ? 'is-hidden' : ''}`}>
              {isRootDirectory ? (
                <span />
              ) : (
                <nav className="wiki-breadcrumbs" aria-label="Breadcrumb">
                  <Link href={buildWikiHref(locale, '')} className="wiki-breadcrumb-link">
                    {text.rootTitle}
                  </Link>
                  {breadcrumbs.map((item, index) => {
                    const isLast = index === breadcrumbs.length - 1
                    return (
                      <span key={item.slug} className="wiki-breadcrumb-item">
                        <span className="wiki-breadcrumb-separator">/</span>
                        {isLast ? (
                          <span className="wiki-breadcrumb-current">{item.label}</span>
                        ) : (
                          <Link href={buildWikiHref(locale, item.slug)} className="wiki-breadcrumb-link">
                            {item.label}
                          </Link>
                        )}
                      </span>
                    )
                  })}
                </nav>
              )}
              <div className="wiki-toolbar__controls">
                <button type="button" className="wiki-theme-toggle" onClick={toggleTheme} aria-pressed={theme === 'light'}>
                  {theme === 'light' ? text.themeLightLabel : text.themeDarkLabel}
                </button>
                <LocaleSwitcher locale={locale} slug={currentSlug} />
              </div>
              <button
                type="button"
                className="wiki-mobile-menu-toggle"
                aria-label="Open menu"
                aria-controls="wiki-mobile-menu"
                aria-expanded={isMobileMenuOpen}
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              >
                <span className="wiki-mobile-menu-toggle__bar" aria-hidden="true" />
                <span className="wiki-mobile-menu-toggle__bar" aria-hidden="true" />
                <span className="wiki-mobile-menu-toggle__bar" aria-hidden="true" />
              </button>
            </header>
            <div className={`wiki-mobile-menu ${isMobileMenuOpen ? 'is-open' : ''}`} id="wiki-mobile-menu">
              <button type="button" className="wiki-mobile-menu__backdrop" onClick={closeMobileMenu} aria-hidden="true" />
              <div className="wiki-mobile-menu__panel" role="dialog" aria-modal="true">
                <div className="wiki-mobile-menu__header">
                  <Link
                    href={buildWikiHref(locale, '')}
                    className="wiki-mobile-menu__logo"
                    aria-label={text.rootTitle}
                    onClick={closeMobileMenu}
                  >
                    <span className="wiki-mobile-menu__logo-image" aria-hidden="true">
                      <img
                        className="wiki-logo__full"
                        src={`${assetPrefix}assets/logo-full${theme === 'light' ? '-accent' : ''}.svg`}
                        alt=""
                      />
                      <img
                        className="wiki-logo__compact"
                        src={`${assetPrefix}assets/logo-compact${theme === 'light' ? '-accent' : ''}.svg`}
                        alt=""
                      />
                    </span>
                  </Link>
                  <button type="button" className="wiki-mobile-menu__close" onClick={closeMobileMenu} aria-label="Close menu">
                    <span className="wiki-mobile-menu__close-icon" aria-hidden="true" />
                    <span className="wiki-mobile-menu__close-icon" aria-hidden="true" />
                  </button>
                </div>
                <div className="wiki-mobile-menu__controls">
                  <button type="button" className="wiki-theme-toggle" onClick={toggleTheme} aria-pressed={theme === 'light'}>
                    {theme === 'light' ? text.themeLightLabel : text.themeDarkLabel}
                  </button>
                  <LocaleSwitcher locale={locale} slug={currentSlug} />
                </div>
                <nav className="wiki-mobile-menu__nav" aria-label="Site navigation">
                  {renderNavList(tree, 0, closeMobileMenu)}
                </nav>
              </div>
            </div>

            <h1>{directoryTitle}</h1>

            {directory.directories.length > 0 && (
              <ul className="wiki-tree-list">
                {directory.directories.map((folder) => (
                  <li key={folder.slug} className="wiki-page-list-item is-folder">
                    <Link href={buildWikiHref(locale, folder.slug)} className="wiki-page-link">
                      <span className="wiki-page-icon" aria-hidden="true">
                        📁
                      </span>
                      {folder.name}
                    </Link>
                    {folder.description && <p className="wiki-page-meta">{folder.description}</p>}
                  </li>
                ))}
              </ul>
            )}

            {directory.pages.length > 0 && (
              <ul className="wiki-tree-list">
                {directory.pages.map((page) => (
                  <li key={page.slug} className="wiki-page-list-item is-page">
                    <Link href={buildWikiHref(locale, page.slug)} className="wiki-page-link">
                      <span className="wiki-page-icon" aria-hidden="true">
                        📄
                      </span>
                      {page.title}
                    </Link>
                    {page.description && <p className="wiki-page-meta">{page.description}</p>}
                  </li>
                ))}
                </ul>
            )}
          </section>
        </main>
      </>
    )
  }

  const { page, locale } = props
  return (
    <>
      <Head>
        <title>{page.title} | CSM Wiki</title>
        {page.description && <meta name="description" content={page.description} />}
      </Head>
      <main className="wiki-shell">
        <aside className="wiki-sidebar">
          <div className="wiki-sidebar__header">
              <Link href={buildWikiHref(locale, '')} className="wiki-sidebar__title" aria-label={text.rootTitle}>
                <span className="wiki-sidebar__logo" aria-hidden="true">
                  <img
                    className="wiki-logo__full"
                    src={`${assetPrefix}assets/logo-full${theme === 'light' ? '-accent' : ''}.svg`}
                    alt=""
                  />
                  <img
                    className="wiki-logo__compact"
                    src={`${assetPrefix}assets/logo-compact${theme === 'light' ? '-accent' : ''}.svg`}
                    alt=""
                  />
                </span>
              </Link>
          </div>
          {renderNavList(tree, 0)}
        </aside>
        <section className="wiki-content">
          <header className={`wiki-toolbar wiki-toolbar--sticky ${isHeaderHidden ? 'is-hidden' : ''}`}>
            <nav className="wiki-breadcrumbs" aria-label="Breadcrumb">
              <Link href={buildWikiHref(locale, '')} className="wiki-breadcrumb-link">
                {text.rootTitle}
              </Link>
              {breadcrumbs.map((item, index) => {
                const isLast = index === breadcrumbs.length - 1
                return (
                  <span key={item.slug} className="wiki-breadcrumb-item">
                    <span className="wiki-breadcrumb-separator">/</span>
                    {isLast ? (
                      <span className="wiki-breadcrumb-current">{item.label}</span>
                    ) : (
                      <Link href={buildWikiHref(locale, item.slug)} className="wiki-breadcrumb-link">
                        {item.label}
                      </Link>
                    )}
                  </span>
                )
                })}
              </nav>
            <div className="wiki-toolbar__controls">
              <button type="button" className="wiki-theme-toggle" onClick={toggleTheme} aria-pressed={theme === 'light'}>
                {theme === 'light' ? text.themeLightLabel : text.themeDarkLabel}
              </button>
              <LocaleSwitcher locale={locale} slug={currentSlug} />
            </div>
            <button
              type="button"
              className="wiki-mobile-menu-toggle"
              aria-label="Open menu"
              aria-controls="wiki-mobile-menu"
              aria-expanded={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            >
              <span className="wiki-mobile-menu-toggle__bar" aria-hidden="true" />
              <span className="wiki-mobile-menu-toggle__bar" aria-hidden="true" />
              <span className="wiki-mobile-menu-toggle__bar" aria-hidden="true" />
            </button>
          </header>
          <div className={`wiki-mobile-menu ${isMobileMenuOpen ? 'is-open' : ''}`} id="wiki-mobile-menu">
            <button type="button" className="wiki-mobile-menu__backdrop" onClick={closeMobileMenu} aria-hidden="true" />
            <div className="wiki-mobile-menu__panel" role="dialog" aria-modal="true">
            <div className="wiki-mobile-menu__header">
                <Link
                  href={buildWikiHref(locale, '')}
                  className="wiki-mobile-menu__logo"
                  aria-label={text.rootTitle}
                  onClick={closeMobileMenu}
                >
                  <span className="wiki-mobile-menu__logo-image" aria-hidden="true">
                    <img
                      className="wiki-logo__full"
                      src={`${assetPrefix}assets/logo-full${theme === 'light' ? '-accent' : ''}.svg`}
                      alt=""
                    />
                    <img
                      className="wiki-logo__compact"
                      src={`${assetPrefix}assets/logo-compact${theme === 'light' ? '-accent' : ''}.svg`}
                      alt=""
                    />
                  </span>
                </Link>
              <button type="button" className="wiki-mobile-menu__close" onClick={closeMobileMenu} aria-label="Close menu">
                <span className="wiki-mobile-menu__close-icon" aria-hidden="true" />
                <span className="wiki-mobile-menu__close-icon" aria-hidden="true" />
              </button>
            </div>
              <div className="wiki-mobile-menu__controls">
                <button type="button" className="wiki-theme-toggle" onClick={toggleTheme} aria-pressed={theme === 'light'}>
                  {theme === 'light' ? text.themeLightLabel : text.themeDarkLabel}
                </button>
                <LocaleSwitcher locale={locale} slug={currentSlug} />
              </div>
              <nav className="wiki-mobile-menu__nav" aria-label="Site navigation">
                {renderNavList(tree, 0, closeMobileMenu)}
              </nav>
            </div>
          </div>

          <article className="wiki-article">
            <h1>{page.title}</h1>
            {page.description && <p className="wiki-subtitle">{page.description}</p>}
            <div ref={markdownContentRef} className="wiki-markdown" dangerouslySetInnerHTML={{ __html: page.contentHtml }} />
          </article>
        </section>
      </main>
    </>
  )
}

export const getStaticPaths: GetStaticPaths = async () => {
  const paths: Array<{ params: { locale: Locale; slug: string[] } }> = []

  for (const locale of locales) {
    paths.push({ params: { locale, slug: [] } })

    for (const slug of getAllWikiRouteSlugs(locale)) {
      paths.push({ params: { locale, slug: slug.split('/') } })
    }
  }

  return {
    paths,
    fallback: false,
  }
}

export const getStaticProps: GetStaticProps<PageProps, { locale: string; slug?: string[] }> = async ({ params }) => {
  if (!params?.locale || !isLocale(params.locale)) {
    return { notFound: true }
  }

  const locale = params.locale
  const slug = params.slug?.join('/') ?? ''

  if (isDirectorySlug(locale, slug)) {
    const directory = getWikiDirectoryData(locale, slug)
    if (!directory) {
      return { notFound: true }
    }

    return {
      props: {
        kind: 'directory',
        locale,
        directory,
        breadcrumbs: buildDirectoryBreadcrumbs(locale, slug),
        tree: getWikiTree(locale),
      },
    }
  }

  try {
    const page = await getMarkdownData(locale, slug)
    return {
      props: {
        kind: 'page',
        locale,
        page,
        breadcrumbs: buildPageBreadcrumbs(locale, page),
        tree: getWikiTree(locale),
      },
    }
  } catch {
    return { notFound: true }
  }
}
