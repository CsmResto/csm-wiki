import { GetStaticPaths, GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
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
      directory: WikiDirectoryData
      parentHref: string
    }
  | {
      kind: 'page'
      page: MarkdownData
      parentHref: string
    }

function getParentHref(slug: string): string {
  const segments = slug.split('/').filter(Boolean)
  if (segments.length <= 1) {
    return '/'
  }

  return `/${segments.slice(0, -1).join('/')}`
}

export default function Page(props: PageProps) {
  if (props.kind === 'directory') {
    const { directory, parentHref } = props
    return (
      <>
        <Head>
          <title>{directory.name} | CSM Wiki</title>
        </Head>
        <main className="wiki-layout">
          <p>
            <Link href={parentHref}>← Назад</Link>
          </p>
          <h1>{directory.name}</h1>

          <ul className="wiki-tree-list">
            {directory.directories.map((folder) => (
              <li key={folder.slug} className="wiki-page-list-item">
                <Link href={`/${folder.slug}`} className="wiki-page-link">
                  {folder.name}
                </Link>
              </li>
            ))}

            {directory.pages.map((page) => (
              <li key={page.slug} className="wiki-page-list-item">
                <Link href={`/${page.slug}`} className="wiki-page-link">
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

  const { page, parentHref } = props
  return (
    <>
      <Head>
        <title>{page.title} | CSM Wiki</title>
        {page.description && <meta name="description" content={page.description} />}
      </Head>
      <main className="wiki-layout">
        <p>
          <Link href={parentHref}>← Назад</Link>
        </p>
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
  const routeSlugs = getAllWikiRouteSlugs()
  const paths = routeSlugs.map((slug) => ({
    params: { slug: slug.split('/') },
  }))

  return {
    paths,
    fallback: false,
  }
}

export const getStaticProps: GetStaticProps<PageProps, { slug: string[] }> = async ({ params }) => {
  if (!params?.slug) {
    return { notFound: true }
  }

  const slug = params.slug.join('/')
  const parentHref = getParentHref(slug)

  if (isDirectorySlug(slug)) {
    const directory = getWikiDirectoryData(slug)
    if (!directory) {
      return { notFound: true }
    }

    return {
      props: {
        kind: 'directory',
        directory,
        parentHref,
      },
    }
  }

  const page = await getMarkdownData(slug)
  return {
    props: {
      kind: 'page',
      page,
      parentHref,
    },
  }
}