import { GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { getWikiDirectoryData, WikiDirectoryData } from '@/lib/markdown'

interface HomeProps {
  directory: WikiDirectoryData
}

export default function Home({ directory }: HomeProps) {
  return (
    <>
      <Head>
        <title>CSM Wiki</title>
        <meta name="description" content="Корневая страница wiki" />
      </Head>
      <main className="wiki-layout">
        <h1>CSM Wiki</h1>

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
              <p className="wiki-page-meta">{page.slug}</p>
              {page.description && <p className="wiki-page-meta">{page.description}</p>}
            </li>
          ))}
        </ul>
      </main>
    </>
  )
}

export const getStaticProps: GetStaticProps<HomeProps> = async () => {
  const directory = getWikiDirectoryData('')

  if (!directory) {
    return { notFound: true }
  }

  return {
    props: {
      directory,
    },
  }
}