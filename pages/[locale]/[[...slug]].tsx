import { GetStaticPaths, GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import LocaleSwitcher from '@/components/LocaleSwitcher'
import { isLocale, Locale, locales } from '@/lib/i18n/locales'
import {
  getAllWikiRouteSlugs,
  getMarkdownData,
  getWikiDirectoryData,
  isDirectorySlug,
  MarkdownData,
  WikiDirectoryData,
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
    }
  | {
      kind: 'page'
      locale: Locale
      page: MarkdownData
      breadcrumbs: BreadcrumbItem[]
    }

type UiText = {
  rootTitle: string
  homeDescription: string
  copyLabel: string
  copiedLabel: string
  copyFailedLabel: string
}

const uiTextByLocale: Record<Locale, UiText> = {
  ru: {
    rootTitle: 'CSM Wiki',
    homeDescription: 'Корневая страница wiki',
    copyLabel: 'Копировать',
    copiedLabel: 'Скопировано',
    copyFailedLabel: 'Ошибка',
  },
  en: {
    rootTitle: 'CSM Wiki',
    homeDescription: 'Wiki root page',
    copyLabel: 'Copy',
    copiedLabel: 'Copied',
    copyFailedLabel: 'Failed',
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

export default function WikiPage(props: PageProps) {
  const text = uiTextByLocale[props.locale]
  const currentSlug = props.kind === 'directory' ? props.directory.slug : props.page.slug
  const breadcrumbs = props.breadcrumbs
  const markdownContentRef = useRef<HTMLDivElement | null>(null)

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
        <main className="wiki-layout">
          <header className="wiki-toolbar">
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
            <LocaleSwitcher locale={locale} slug={currentSlug} />
          </header>

          <h1>{directoryTitle}</h1>

          <ul className="wiki-tree-list">
            {directory.directories.map((folder) => (
              <li key={folder.slug} className="wiki-page-list-item">
                <Link href={buildWikiHref(locale, folder.slug)} className="wiki-page-link">
                  {folder.name}
                </Link>
              </li>
            ))}

            {directory.pages.map((page) => (
              <li key={page.slug} className="wiki-page-list-item">
                <Link href={buildWikiHref(locale, page.slug)} className="wiki-page-link">
                  {page.title}
                </Link>
                {page.description && <p className="wiki-page-meta">{page.description}</p>}
              </li>
            ))}
          </ul>
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
      <main className="wiki-layout">
        <header className="wiki-toolbar">
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
          <LocaleSwitcher locale={locale} slug={currentSlug} />
        </header>

        <article className="wiki-article">
          <h1>{page.title}</h1>
          {page.description && <p className="wiki-subtitle">{page.description}</p>}
          <div ref={markdownContentRef} className="wiki-markdown" dangerouslySetInnerHTML={{ __html: page.contentHtml }} />
        </article>
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
      },
    }
  } catch {
    return { notFound: true }
  }
}
