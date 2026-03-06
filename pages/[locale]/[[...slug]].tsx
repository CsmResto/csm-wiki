import { GetStaticPaths, GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
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

type PageProps =
  | {
      kind: 'directory'
      locale: Locale
      directory: WikiDirectoryData
      parentHref: string
    }
  | {
      kind: 'page'
      locale: Locale
      page: MarkdownData
      parentHref: string
    }

type UiText = {
  back: string
  rootTitle: string
  homeDescription: string
}

const uiTextByLocale: Record<Locale, UiText> = {
  ru: {
    back: 'Назад',
    rootTitle: 'CSM Wiki',
    homeDescription: 'Корневая страница wiki',
  },
  en: {
    back: 'Back',
    rootTitle: 'CSM Wiki',
    homeDescription: 'Wiki root page',
  },
}

function buildWikiHref(locale: Locale, slug: string): string {
  const normalizedSlug = slug.replace(/^\/+|\/+$/g, '')
  return normalizedSlug ? `/${locale}/${normalizedSlug}` : `/${locale}`
}

function getParentHref(locale: Locale, slug: string): string {
  const segments = slug.split('/').filter(Boolean)
  if (segments.length <= 1) {
    return `/${locale}`
  }

  return `/${locale}/${segments.slice(0, -1).join('/')}`
}

export default function WikiPage(props: PageProps) {
  const text = uiTextByLocale[props.locale]
  const currentSlug = props.kind === 'directory' ? props.directory.slug : props.page.slug

  if (props.kind === 'directory') {
    const { directory, parentHref, locale } = props
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
            {isRootDirectory ? <span /> : <p><Link href={parentHref}>← {text.back}</Link></p>}
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

  const { page, parentHref, locale } = props
  return (
    <>
      <Head>
        <title>{page.title} | CSM Wiki</title>
        {page.description && <meta name="description" content={page.description} />}
      </Head>
      <main className="wiki-layout">
        <header className="wiki-toolbar">
          <p>
            <Link href={parentHref}>← {text.back}</Link>
          </p>
          <LocaleSwitcher locale={locale} slug={currentSlug} />
        </header>

        <article className="wiki-article">
          <h1>{page.title}</h1>
          {page.description && <p className="wiki-subtitle">{page.description}</p>}
          <div dangerouslySetInnerHTML={{ __html: page.contentHtml }} />
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
  const parentHref = getParentHref(locale, slug)

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
        parentHref,
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
        parentHref,
      },
    }
  } catch {
    return { notFound: true }
  }
}